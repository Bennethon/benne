import type { EventBus } from '../events/EventBus.js';
import {
  roomInventoryOnCharacterAnySourceEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnHotspotAnySourceEventId,
  roomInventoryOnHotspotEventId,
  roomInventoryOnPropAnySourceEventId,
  roomInventoryOnPropEventId,
} from '../events/inventoryOnVerbEvents.js';
import { roomRegionEnterEventId, roomRegionExitEventId } from '../events/regionEnterExitEvents.js';
import {
  roomCharacterVerbEventId,
  roomHotspotVerbEventId,
  roomPropVerbEventId,
} from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { tryGetGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import { registerPlayFromForRoom } from '../scenes/playFromRegistry.js';
import { getLoadingRoomScriptId } from '../scenes/roomScriptModules.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { RegionEnterExitContext } from '../../types/regionEnterExit.js';
import {
  continueInventoryOnDispatchAfterRoom,
  continueInventoryOnDispatchAfterRoomAny,
} from '../verbs/dispatchInventoryOnVerbTarget.js';
import { continueVerbDispatchAfterRoom } from '../verbs/dispatchVerb.js';
import { applyInventoryDropPolicy, type ItemHandlerOptions } from './globalHandlers.js';
import { subscribeEvent } from './events.js';
import { runHandler, warnIfUntransformed } from './interactionContext.js';
import { lookupCharacterHandle, lookupItemHandle, lookupVerbHandle } from './registry.js';

export type TargetKind = 'prop' | 'hotspot' | 'character';

export interface TargetRef {
  readonly kind: TargetKind;
  readonly id: string;
}

type Handler = (...args: never[]) => unknown;

type RoomLifecycle = 'enter' | 'enterAfterFade' | 'leave' | 'loaded';

type Registration =
  | { kind: 'verb'; target: TargetRef; verb: string; handler: Handler }
  /** `verb` `null`: any item verb (`onItem`). */
  | { kind: 'verbItem'; target: TargetRef; verb: string | null; itemId: string; handler: Handler; options?: ItemHandlerOptions }
  | { kind: 'anyItem'; target: TargetRef; handler: Handler; options?: ItemHandlerOptions }
  | { kind: 'region'; regionId: string; exit: boolean; handler: Handler }
  | { kind: 'playFrom'; name: string; handler: Handler }
  /** `events.on` / `once` in a room script: listens only while the room is active. */
  | { kind: 'event'; name: string; once: boolean; handler: Handler }
  | { kind: RoomLifecycle; handler: Handler; options?: CutsceneOptions };

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
  verb: string | null,
  itemId: string,
  handler: Handler,
  options?: ItemHandlerOptions,
): void {
  register(
    roomId,
    { kind: 'verbItem', target, verb, itemId, handler, options },
    `${roomId}: ${itemId}${verb ? ` "${verb}"` : ''} on ${target.id}`,
  );
}

export function registerAnyItemHandler(roomId: string, target: TargetRef, handler: Handler, options?: ItemHandlerOptions): void {
  register(roomId, { kind: 'anyItem', target, handler, options }, `${roomId}: any item on ${target.id}`);
}

export function registerRegionHandler(roomId: string, regionId: string, exit: boolean, handler: Handler): void {
  register(roomId, { kind: 'region', regionId, exit, handler }, `${roomId}: region ${regionId} ${exit ? 'exit' : 'enter'}`);
}

/**
 * A named starting state for BENNE Play's "Play From" (§4.19), written at the top level of a room
 * script. It runs before the room's enter handlers, only when BENNE Play asks for it by name.
 */
export function playFrom(name: string, setup: () => void): void {
  const roomId = getLoadingRoomScriptId();
  if (roomId == null) {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] playFrom("${name}") belongs at the top level of a *.room.ts file — ignored.`);
    }
    return;
  }
  register(roomId, { kind: 'playFrom', name, handler: setup }, `${roomId}: playFrom "${name}"`);
}

export function registerRoomEventHandler(roomId: string, name: string, once: boolean, handler: Handler): void {
  register(roomId, { kind: 'event', name, once, handler }, `${roomId}: events.${once ? 'once' : 'on'}("${name}")`);
}

export function registerRoomLifecycleHandler(
  roomId: string,
  kind: RoomLifecycle,
  handler: Handler,
  options?: CutsceneOptions,
): void {
  register(roomId, { kind, handler, options }, `${roomId}: ${kind}`);
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

function anyItemEventId(roomId: string, target: TargetRef): string {
  switch (target.kind) {
    case 'prop':
      return roomInventoryOnPropAnySourceEventId(roomId, target.id);
    case 'hotspot':
      return roomInventoryOnHotspotAnySourceEventId(roomId, target.id);
    case 'character':
      return roomInventoryOnCharacterAnySourceEventId(roomId, target.id);
  }
}

/**
 * Subscribes this room's handlers (`RoomScene.create`); the returned function unsubscribes them
 * when the room shuts down. Dispatch is listener-first: a room handler for an event wins over the
 * character script, item script and global tiers.
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
          void runHandler(label, scene, payload, reg.handler).then((outcome) => {
            if (outcome === 'unhandled') {
              continueVerbDispatchAfterRoom(events, payload);
            }
          });
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
        hooks?.registerRoomEnterRoom(
          roomId,
          () => runHandler(`${roomId} onEnter`, scene, null, reg.handler).then(() => {}),
          reg.options,
        );
        break;
      case 'enterAfterFade':
        hooks?.registerRoomEnterRoomAfterFade(
          roomId,
          () => runHandler(`${roomId} onEnterAfterFade`, scene, null, reg.handler).then(() => {}),
          reg.options,
        );
        break;
      case 'leave':
        hooks?.registerRoomLeaveRoom(roomId, () => runHandler(`${roomId} onLeave`, scene, null, reg.handler).then(() => {}));
        break;
      case 'loaded':
        hooks?.registerRoomLoadedRoom(roomId, () => runHandler(`${roomId} onLoaded`, scene, null, reg.handler).then(() => {}));
        break;
      case 'anyItem': {
        const label = `${roomId} any item on ${reg.target.id}`;
        listen(anyItemEventId(roomId, reg.target), (payload) => {
          const p = payload as AnyInventoryUsedOnPayload;
          const item = lookupItemHandle<{ id: string }>(p.itemId) ?? { id: p.itemId };
          const verb = lookupVerbHandle<{ id: string }>(p.verbId) ?? { id: p.verbId };
          void runHandler(label, scene, payload, reg.handler, [item, verb]).then((outcome) => {
            if (outcome === 'unhandled') {
              continueInventoryOnDispatchAfterRoomAny(events, p);
            } else if (outcome !== 'cancelled') {
              applyInventoryDropPolicy(p.itemId, reg.options);
            }
          });
        });
        break;
      }
      case 'region': {
        const label = `${roomId} region ${reg.regionId} ${reg.exit ? 'exit' : 'enter'}`;
        const eventId = reg.exit ? roomRegionExitEventId(roomId, reg.regionId) : roomRegionEnterEventId(roomId, reg.regionId);
        listen(eventId, (payload) => {
          const p = payload as RegionEnterExitContext;
          const who = lookupCharacterHandle(roomId, p.characterId) ?? { id: p.characterId };
          void runHandler(label, scene, null, reg.handler, [who]);
        });
        break;
      }
      case 'playFrom':
        registerPlayFromForRoom(roomId, reg.name, () =>
          runHandler(`${roomId} playFrom "${reg.name}"`, scene, null, reg.handler, [], { gameplay: false }).then(() => {}),
        );
        break;
      case 'event':
        offs.push(subscribeEvent(reg.name, reg.handler, reg.once));
        break;
    }
  }

  for (const [eventId, regs] of byItemEvent) {
    listen(eventId, (payload) => {
      const p = payload as AnyInventoryUsedOnPayload;
      const reg = regs.find((r) => r.verb === p.verbId) ?? regs.find((r) => r.verb == null);
      if (!reg) {
        // Another item verb than the ones handled here: fall through like an unhandled item.
        continueInventoryOnDispatchAfterRoom(events, p);
        return;
      }
      const label = `${roomId} ${reg.itemId} "${p.verbId}" on ${reg.target.id}`;
      void runHandler(label, scene, payload, reg.handler).then((outcome) => {
        if (outcome === 'finished' || outcome === 'ended') {
          applyInventoryDropPolicy(p.itemId, reg.options);
        } else if (outcome === 'unhandled') {
          continueInventoryOnDispatchAfterRoom(events, p);
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
