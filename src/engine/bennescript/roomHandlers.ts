import type { EventBus } from '../events/EventBus.js';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnPropEventId,
} from '../events/inventoryOnVerbEvents.js';
import {
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { tryGetGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import { shouldDropActiveInventoryOnUse } from '../verbs/dispatchInventoryOnVerbTarget.js';
import { runHandler, warnIfUntransformed } from './interactionContext.js';

export type TargetKind = 'prop' | 'hotspot' | 'character';

export interface TargetRef {
  readonly kind: TargetKind;
  readonly id: string;
}

type Handler = (...args: never[]) => unknown;

type RoomLifecycle = 'enter' | 'enterAfterFade' | 'leave' | 'loaded';

type Registration =
  | { kind: 'verb'; target: TargetRef; verb: string; handler: Handler }
  | { kind: 'verbItem'; target: TargetRef; verb: string; itemId: string; handler: Handler }
  | { kind: RoomLifecycle; handler: Handler };

/**
 * Handlers registered at the top level of each room's script, per room id. A module evaluates
 * once, so the table is permanent; {@link attachRoomHandlers} wires it up every time the room's
 * scene is created and the returned disposer unwires it on shutdown.
 */
const tables = new Map<string, Registration[]>();

function register(roomId: string, registration: Registration, label: string): void {
  warnIfUntransformed(label, registration.handler);
  let table = tables.get(roomId);
  if (!table) {
    table = [];
    tables.set(roomId, table);
  }
  table.push(registration);
}

export function registerVerbHandler(roomId: string, target: TargetRef, verb: string, handler: Handler): void {
  register(roomId, { kind: 'verb', target, verb, handler }, `${roomId}: ${target.id} "${verb}"`);
}

export function registerVerbItemHandler(
  roomId: string,
  target: TargetRef,
  verb: string,
  itemId: string,
  handler: Handler,
): void {
  register(
    roomId,
    { kind: 'verbItem', target, verb, itemId, handler },
    `${roomId}: ${itemId} "${verb}" on ${target.id}`,
  );
}

export function registerRoomLifecycleHandler(roomId: string, kind: RoomLifecycle, handler: Handler): void {
  register(roomId, { kind, handler }, `${roomId}: ${kind}`);
}

function verbEventId(roomId: string, target: TargetRef, verb: string): string {
  switch (target.kind) {
    case 'prop':
      return roomPropVerbEventId(roomId, target.id, verb);
    case 'hotspot':
      return roomHotspotVerbEventId(roomId, target.id, verb);
    case 'character':
      return roomCharacterVerbEventId(roomId, target.id, verb);
  }
}

function verbItemEventId(roomId: string, target: TargetRef, itemId: string): string {
  switch (target.kind) {
    case 'prop':
      return roomInventoryOnPropEventId(roomId, target.id, itemId);
    case 'hotspot':
      return roomInventoryOnHotspotEventId(roomId, target.id, itemId);
    case 'character':
      return roomInventoryOnCharacterEventId(roomId, target.id, itemId);
  }
}

/** Same drop policy the old `whenInventoryUsedOn` applies once its queue drains. */
function applyInventoryDropPolicy(itemId: string): void {
  if (!shouldDropActiveInventoryOnUse(itemId)) {
    return;
  }
  const manager = tryGetActiveGameStateManager();
  manager?.clearActiveInventoryItem();
  manager?.clearActiveVerb();
}

/**
 * Subscribes this room's new-style handlers. Old `register*Script` handlers for the same room are
 * subscribed by `RoomScene` as before; dispatch is listener-first, so each event reaches whichever
 * API registered it (Phase 1 side-by-side routing, deleted in Phase 6).
 */
export function attachRoomHandlers(roomId: string, scene: RoomScene, events: EventBus): () => void {
  const table = tables.get(roomId);
  if (!table || table.length === 0) {
    return () => {};
  }

  const offs: Array<() => void> = [];
  const listen = (eventId: string, listener: (payload: unknown) => void): void => {
    if (import.meta.env.DEV && events.listeners(eventId).length > 0) {
      console.warn(`[Benne] ${eventId} already has a handler; both will run.`);
    }
    events.on(eventId, listener);
    offs.push(() => events.off(eventId, listener));
  };

  // Item handlers share one event per (target, item); the verb picks the registration.
  const byItemEvent = new Map<string, Array<Extract<Registration, { kind: 'verbItem' }>>>();
  const hooks = tryGetGlobalRoomHookRegistry();

  for (const reg of table) {
    switch (reg.kind) {
      case 'verb': {
        const label = `${roomId} ${reg.target.id} "${reg.verb}"`;
        listen(verbEventId(roomId, reg.target, reg.verb), (payload) => {
          void runHandler(label, scene, payload, reg.handler);
        });
        break;
      }
      case 'verbItem': {
        const eventId = verbItemEventId(roomId, reg.target, reg.itemId);
        const regs = byItemEvent.get(eventId) ?? [];
        regs.push(reg);
        byItemEvent.set(eventId, regs);
        break;
      }
      case 'enter':
        hooks?.registerRoomEnterRoom(roomId, () => runHandler(`${roomId} onEnter`, scene, null, reg.handler).then(() => {}));
        break;
      case 'enterAfterFade':
        hooks?.registerRoomEnterRoomAfterFade(roomId, () =>
          runHandler(`${roomId} onEnterAfterFade`, scene, null, reg.handler).then(() => {}),
        );
        break;
      case 'leave':
        hooks?.registerRoomLeaveRoom(roomId, () => runHandler(`${roomId} onLeave`, scene, null, reg.handler).then(() => {}));
        break;
      case 'loaded':
        hooks?.registerRoomLoadedRoom(roomId, () => runHandler(`${roomId} onLoaded`, scene, null, reg.handler).then(() => {}));
        break;
    }
  }

  for (const [eventId, regs] of byItemEvent) {
    listen(eventId, (payload) => {
      const p = payload as { verbId?: string; itemId: string };
      const reg = regs.find((r) => r.verb === p.verbId);
      if (!reg) {
        // Another item verb than the ones handled here: fall through like an unhandled item.
        events.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, payload);
        return;
      }
      const label = `${roomId} ${reg.itemId} "${reg.verb}" on ${reg.target.id}`;
      void runHandler(label, scene, payload, reg.handler).then((outcome) => {
        if (outcome === 'finished' || outcome === 'ended') {
          applyInventoryDropPolicy(reg.itemId);
        }
      });
    });
  }

  return () => {
    for (const off of offs) {
      off();
    }
  };
}
