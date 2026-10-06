import * as Phaser from 'phaser';
import {
  GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT,
  GAME_STATE_ACTIVE_VERB_CHANGED_EVENT,
} from '../../types/gameState.js';
import type { VerbHoverTarget } from '../../types/verbContext.js';

/** Event id emitted when the active verb, the armed item or the hover target changes (per room; see the persistent one below). */
export const BENNE_VERB_CONTEXT_CHANGED_EVENT = 'benne:verbContextChanged' as const;

/**
 * Emitted together with {@link BENNE_VERB_CONTEXT_CHANGED_EVENT}, but `RoomScene` does not clear its
 * listeners on room shutdown. BenneScript's `pointer.onContextChange` handlers are registered once, at
 * module top level, so they listen here.
 */
export const BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT = 'benne:verbContextChanged:persistent' as const;

/** Listeners subscribe with **`BENNE_VERB_CONTEXT_CHANGED_EVENT`** (cleared by the room scene on shutdown) or the persistent event (`pointer.onContextChange`). */
const emitter = new Phaser.Events.EventEmitter();

let hoverDescriptionScript: string | null = null;
let hoverTargetScript: VerbHoverTarget | null = null;

function targetsEqual(a: VerbHoverTarget | null, b: VerbHoverTarget | null): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return (
    a.description === b.description &&
    a.targetType === b.targetType &&
    a.targetId === b.targetId &&
    a.itemId === b.itemId &&
    a.defaultVerb === b.defaultVerb
  );
}

export function emitBenneVerbContextChanged(): void {
  emitter.emit(BENNE_VERB_CONTEXT_CHANGED_EVENT);
  emitter.emit(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT);
}

export function publishBenneVerbHoverContext(
  description: string | null,
  target: VerbHoverTarget | null,
): void {
  if (hoverDescriptionScript === description && targetsEqual(hoverTargetScript, target)) {
    return;
  }
  hoverDescriptionScript = description;
  hoverTargetScript = target;
  emitter.emit(BENNE_VERB_CONTEXT_CHANGED_EVENT);
  emitter.emit(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT);
}

export function clearBenneVerbHoverContext(): void {
  publishBenneVerbHoverContext(null, null);
}

export function getBenneVerbContextHoverDescription(): string | null {
  return hoverDescriptionScript;
}

export function getBenneVerbContextHoverTarget(): VerbHoverTarget | null {
  return hoverTargetScript;
}

export function getBenneVerbContextChangedEmitter(): Phaser.Events.EventEmitter {
  return emitter;
}

const relayCleanups = new Map<Phaser.Events.EventEmitter, () => void>();

/** Subscribe on the same `EventEmitter` passed into `GameStateManager` (global `gameEvents` in-game, `game.events` in GUI preview). */
export function wireBenneVerbContextGameStateRelay(events: Phaser.Events.EventEmitter): void {
  if (relayCleanups.has(events)) {
    return;
  }
  const fn = (): void => {
    emitBenneVerbContextChanged();
  };
  events.on(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, fn);
  events.on(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, fn);
  relayCleanups.set(events, () => {
    events.off(GAME_STATE_ACTIVE_VERB_CHANGED_EVENT, fn);
    events.off(GAME_STATE_ACTIVE_INVENTORY_ITEM_CHANGED_EVENT, fn);
    relayCleanups.delete(events);
  });
}

export function unwireBenneVerbContextGameStateRelay(events: Phaser.Events.EventEmitter): void {
  relayCleanups.get(events)?.();
}
