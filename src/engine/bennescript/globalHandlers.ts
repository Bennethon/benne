import { gameEvents } from '../events/EventBus.js';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  globalInventoryOnCharacterAnySourceEventId,
  globalInventoryOnCharacterEventId,
  type AnyInventoryUsedOnPayload,
} from '../events/inventoryOnVerbEvents.js';
import {
  VERB_GLOBAL_FALLBACK_EVENT,
  VERB_UNHANDLED_EVENT,
  characterVerbEventId,
  globalVerbHandlerEventId,
  type VerbInteractTarget,
  type VerbUnhandledPayload,
} from '../events/verbInteractionEvents.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { tryGetGlobalRoomHookRegistry } from '../scenes/roomHookRegistrySingleton.js';
import { registerOnUpdateHandler, reportOnUpdateFailure, type OnUpdateHandler } from './onUpdateRegistry.js';
import {
  continueInventoryOnDispatchAfterGlobal,
  shouldDropActiveInventoryOnUse,
} from '../verbs/dispatchInventoryOnVerbTarget.js';
import { continueVerbDispatchToGlobal } from '../verbs/dispatchVerb.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { RoomTransitionContext } from '../../types/roomTransition.js';
import { createFrameRunner, runHandler, warnIfUntransformed, type HandlerOutcome } from './interactionContext.js';
import { lookupItemHandle, lookupRoomHandle, lookupVerbHandle } from './registry.js';
import { liveRoomScene } from './scene.js';

/**
 * Handlers that are not tied to one room (§4.9, §4.17): global fallbacks, character scripts and
 * the any-room hooks. They register once, at module top level, and stay subscribed for the whole
 * session (character handlers only fire for characters in the current room anyway).
 */

type Handler = (...args: never[]) => unknown;

function listen(eventId: string, listener: (payload: unknown) => void): void {
  gameEvents.on(eventId, listener);
}

/** Options for item handlers (`door.onUseItem(items.key, fn, { doNotClear: true })`). */
export interface ItemHandlerOptions {
  /** Keep the item armed after this handler, whatever the drop policy says. */
  readonly doNotClear?: boolean;
}

/** The armed item's drop policy (`dropWhenUsed` / `dropWhenInventoryUsed`), applied after an item handler. */
export function applyInventoryDropPolicy(itemId: string, options?: ItemHandlerOptions): void {
  if (options?.doNotClear || !shouldDropActiveInventoryOnUse(itemId)) {
    return;
  }
  const manager = tryGetActiveGameStateManager();
  manager?.clearActiveInventoryItem();
  manager?.clearActiveVerb();
}

/** What a fallback item handler was used on (§8.2). */
export interface FallbackTarget {
  readonly kind: 'prop' | 'hotspot' | 'character' | 'item';
  readonly id: string;
  /** The hover description shown in the verb line. */
  readonly name: string;
}

function fallbackTargetOf(p: AnyInventoryUsedOnPayload): FallbackTarget {
  const name = p.description ?? '';
  switch (p.targetType) {
    case 'prop':
      return { kind: 'prop', id: p.propId, name };
    case 'hotspot':
      return { kind: 'hotspot', id: p.hotspotId, name };
    case 'character':
      return { kind: 'character', id: p.characterId, name };
    case 'inventoryItem':
      return { kind: 'item', id: p.targetItemId, name };
  }
}

// ─── Fallbacks ───────────────────────────────────────────────────────────────

const fallbackVerbs = new Set<string>();

/** `fallbacks.on<Verb>`: the verb on anything with no handler of its own. */
export function registerFallbackVerb(verb: string, handler: Handler): void {
  warnIfUntransformed(`fallbacks "${verb}"`, handler);
  if (fallbackVerbs.has(verb) && import.meta.env.DEV) {
    console.warn(`[Benne] fallbacks: "${verb}" already has a handler; both will run.`);
  }
  fallbackVerbs.add(verb);
  listen(globalVerbHandlerEventId(verb), (payload) => {
    void runHandler(`fallback "${verb}"`, liveRoomScene(), payload, handler);
  });
}

/** `fallbacks.onAnyVerb`: any verb with no handler and no per-verb fallback. */
export function registerFallbackAnyVerb(handler: Handler): void {
  warnIfUntransformed('fallbacks.onAnyVerb', handler);
  listen(VERB_GLOBAL_FALLBACK_EVENT, (payload) => {
    void runHandler('fallback (any verb)', liveRoomScene(), payload, handler);
  });
}

function fallbackTargetOfVerb(target: VerbInteractTarget): FallbackTarget {
  const name = target.description ?? '';
  switch (target.type) {
    case 'prop':
      return { kind: 'prop', id: target.propId, name };
    case 'hotspot':
      return { kind: 'hotspot', id: target.hotspotId, name };
    case 'character':
      return { kind: 'character', id: target.characterId, name };
    case 'inventoryItem':
      return { kind: 'item', id: target.itemId, name };
  }
}

/**
 * `fallbacks.onUnhandled((verb, target) => …)`: the last tier, a verb that nothing handled, not even
 * `fallbacks.onAnyVerb` (useful as a DEV diagnostic). The engine also logs it in DEV.
 */
export function registerFallbackUnhandled(handler: Handler): void {
  warnIfUntransformed('fallbacks.onUnhandled', handler);
  listen(VERB_UNHANDLED_EVENT, (payload) => {
    const p = payload as VerbUnhandledPayload;
    const verb = lookupVerbHandle<{ id: string }>(p.verbId) ?? { id: p.verbId };
    void runHandler(`fallback unhandled "${p.verbId}"`, liveRoomScene(), null, handler, [verb, fallbackTargetOfVerb(p.target)]);
  });
}

const itemFallbacks = new Map<string, Handler>();
let anyItemFallback: Handler | null = null;
let itemFallbackListening = false;

function listenForUnhandledItems(): void {
  if (itemFallbackListening) {
    return;
  }
  itemFallbackListening = true;
  listen(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, (payload) => {
    const p = payload as AnyInventoryUsedOnPayload;
    const handler = itemFallbacks.get(p.verbId) ?? anyItemFallback;
    if (!handler) {
      return;
    }
    const item = lookupItemHandle<{ id: string }>(p.itemId) ?? { id: p.itemId };
    void runHandler(`fallback item "${p.verbId}"`, liveRoomScene(), payload, handler, [item, fallbackTargetOf(p)]).then(() =>
      applyInventoryDropPolicy(p.itemId),
    );
  });
}

/** `fallbacks.on<Verb>Item((item, target) => …)`: an item verb nothing else handled. */
export function registerFallbackVerbItem(verb: string, handler: Handler): void {
  warnIfUntransformed(`fallbacks "${verb}" item`, handler);
  itemFallbacks.set(verb, handler);
  listenForUnhandledItems();
}

/** `fallbacks.onItemUnhandled((item, target) => …)`: any item use nothing else handled. */
export function registerFallbackItemUnhandled(handler: Handler): void {
  warnIfUntransformed('fallbacks.onItemUnhandled', handler);
  anyItemFallback = handler;
  listenForUnhandledItems();
}

// ─── Character scripts (§4.9) ────────────────────────────────────────────────

/** Rebuilds the clicked character from a character verb payload, for falling through. */
function characterTargetOf(p: Record<string, unknown>): VerbInteractTarget {
  return {
    type: 'character',
    characterId: String(p.characterId ?? ''),
    instanceId: String(p.instanceId ?? p.characterId ?? ''),
    roomId: String(p.roomId ?? ''),
    description: p.description as string | undefined,
  };
}

/** `penny.on<Verb>` in `penny.character.ts` (or `characters.penny.on<Verb>` anywhere): wherever the character is spawned. */
export function registerCharacterVerbHandler(characterId: string, verb: string, handler: Handler): void {
  warnIfUntransformed(`character ${characterId} "${verb}"`, handler);
  listen(characterVerbEventId(characterId, verb), (payload) => {
    void runHandler(`character ${characterId} "${verb}"`, liveRoomScene(), payload, handler).then((outcome) => {
      if (outcome === 'unhandled') {
        continueVerbDispatchToGlobal(gameEvents, verb, characterTargetOf(payload as Record<string, unknown>));
      }
    });
  });
}

/** `verb` `null`: any item verb (`onItem`). */
const characterItemHandlers = new Map<string, Array<{ verb: string | null; handler: Handler; options?: ItemHandlerOptions }>>();

/** `penny.on<Verb>Item(item, …)` / `onItem(item, …)` in a character script (or on `characters.penny`). */
export function registerCharacterVerbItemHandler(
  characterId: string,
  verb: string | null,
  itemId: string,
  handler: Handler,
  options?: ItemHandlerOptions,
): void {
  warnIfUntransformed(`character ${characterId}: ${itemId}${verb ? ` "${verb}"` : ''}`, handler);
  const eventId = globalInventoryOnCharacterEventId(characterId, itemId);
  let regs = characterItemHandlers.get(eventId);
  if (!regs) {
    regs = [];
    characterItemHandlers.set(eventId, regs);
    const forEvent = regs;
    listen(eventId, (payload) => {
      const p = payload as AnyInventoryUsedOnPayload;
      const reg = forEvent.find((r) => r.verb === p.verbId) ?? forEvent.find((r) => r.verb == null);
      const label = `character ${characterId}: ${itemId} "${p.verbId}"`;
      const done = reg ? runHandler(label, liveRoomScene(), payload, reg.handler) : Promise.resolve<HandlerOutcome>('unhandled');
      void done.then((outcome) => {
        if (outcome === 'unhandled') {
          continueInventoryOnDispatchAfterGlobal(gameEvents, p);
        } else {
          applyInventoryDropPolicy(itemId, reg?.options);
        }
      });
    });
  }
  regs.push({ verb, handler, options });
}

/**
 * `characters.x.onAnyItem((item, verb) => …)` in a character script: any item without a handler of
 * its own, on that character in any room. The room's own item handlers run first (dispatch tiers).
 */
export function registerCharacterAnyItemHandler(characterId: string, handler: Handler, options?: ItemHandlerOptions): void {
  warnIfUntransformed(`characters.${characterId}.onAnyItem`, handler);
  listen(globalInventoryOnCharacterAnySourceEventId(characterId), (payload) => {
    const p = payload as AnyInventoryUsedOnPayload;
    const item = lookupItemHandle<{ id: string }>(p.itemId) ?? { id: p.itemId };
    const verb = lookupVerbHandle<{ id: string }>(p.verbId) ?? { id: p.verbId };
    void runHandler(`characters.${characterId}.onAnyItem`, liveRoomScene(), payload, handler, [item, verb]).then((outcome) => {
      if (outcome === 'unhandled') {
        // This is the last per-target tier: straight to the fallback (continuing "after global"
        // would emit this channel again).
        gameEvents.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, p);
      } else if (outcome !== 'cancelled') {
        applyInventoryDropPolicy(p.itemId, options);
      }
    });
  });
}

// ─── Any-room hooks (§4.17) ──────────────────────────────────────────────────

type AnyRoomKind = 'enter' | 'enterAfterFade' | 'leave' | 'loaded';

const anyRoomHandlers: Array<{ kind: AnyRoomKind; handler: Handler; options?: CutsceneOptions }> = [];
let hooksAttached = false;

function attachAnyRoomHandler(kind: AnyRoomKind, handler: Handler, options?: CutsceneOptions): void {
  const registry = tryGetGlobalRoomHookRegistry();
  if (!registry) {
    return;
  }
  const run = (ctx: RoomTransitionContext): Promise<void> =>
    runHandler(`any room ${kind}`, liveRoomScene(), null, handler, [lookupRoomHandle(ctx.lastRoom)]).then(() => {});
  switch (kind) {
    case 'enter':
      registry.registerAnyEnterRoom(run, options);
      return;
    case 'enterAfterFade':
      registry.registerAnyEnterRoomAfterFade(run, options);
      return;
    case 'leave':
      registry.registerAnyLeaveRoom(run);
      return;
    case 'loaded':
      registry.registerAnyLoadedRoom(run);
      return;
  }
}

/** `game.onEnterAnyRoom` and friends. Script modules load before the game exists, so these wait for it. */
export function registerAnyRoomHandler(kind: AnyRoomKind, handler: Handler, options?: CutsceneOptions): void {
  warnIfUntransformed(`game any-room ${kind}`, handler);
  anyRoomHandlers.push({ kind, handler, options });
  if (hooksAttached) {
    attachAnyRoomHandler(kind, handler, options);
  }
}

/** Called once the room hook registry exists (`wireRoomTransitions`). */
export function attachGlobalRoomHooks(): void {
  hooksAttached = true;
  for (const { kind, handler, options } of anyRoomHandlers) {
    attachAnyRoomHandler(kind, handler, options);
  }
}

// ─── Per-frame updates (§4.18) ───────────────────────────────────────────────

/**
 * Runs `fn` every frame with the seconds since the last one. Not sequenced: a timed action started
 * here throws (`TimedActionInUpdateError`); start a `background(…)` block from a frame check instead.
 */
export function onUpdate(fn: (deltaSeconds: number) => void): void {
  const handler: OnUpdateHandler = (ctx) => run(fn as Handler, [ctx.deltaSeconds]);
  const run = createFrameRunner((err) => reportOnUpdateFailure(handler, err));
  registerOnUpdateHandler(handler);
}
