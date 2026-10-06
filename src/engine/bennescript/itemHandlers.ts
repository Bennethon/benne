import { getGameSettings } from '../ConfigManager.js';
import { gameEvents } from '../events/EventBus.js';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  globalInventoryOnInventoryItemEventId,
  globalInventoryOnInventoryRowEventId,
  type InventoryUsedOnInventoryItemPayload,
} from '../events/inventoryOnVerbEvents.js';
import { inventoryVerbEventId, type InventoryVerbInteractPayload } from '../events/inventoryVerbEvents.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { readEffectiveInventoryDescription } from '../inventory/inventoryScriptingAnimations.js';
import { continueInventoryOnDispatchAfterGlobal } from '../verbs/dispatchInventoryOnVerbTarget.js';
import { continueVerbDispatchToGlobal } from '../verbs/dispatchVerb.js';
import { getEffectiveVerbDefinitions, isItemVerb } from '../verbs/verbConfig.js';
import { applyInventoryDropPolicy, type ItemHandlerOptions } from './globalHandlers.js';
import { runHandler, warnIfUntransformed } from './interactionContext.js';
import { lookupItemHandle, lookupVerbHandle } from './registry.js';
import { liveRoomScene } from './scene.js';

/**
 * Inventory item handlers (`*.inventory.ts`, §4.6). Items are not in a room, so these register once,
 * at module top level, on the global inventory channels.
 *
 * Every `usesItem` verb on an item's row arms the item for "use on target" after its handler, or
 * at once when it has none (§8.4; the engine arms items with no handler for that verb, decision 28).
 * `onUse.doNotActivate(…)` opts out for that verb.
 */

type Handler = (...args: never[]) => unknown;

function itemVerbIds(): Set<string> {
  return new Set(getEffectiveVerbDefinitions(getGameSettings()).filter(isItemVerb).map((v) => v.id));
}

function arm(itemId: string): void {
  tryGetActiveGameStateManager()?.setActiveInventoryItem(itemId);
}

// ─── Verbs on the item's row ─────────────────────────────────────────────────

const verbHandlers = new Map<string, Map<string, { handler: Handler; arms: boolean }>>();
const listening = new Set<string>();

function rowTarget(p: InventoryVerbInteractPayload) {
  const def = getInventoryDefinition(p.itemId);
  const manager = tryGetActiveGameStateManager();
  const description = def && manager ? readEffectiveInventoryDescription(manager, def) : def?.description;
  return {
    type: 'inventoryItem' as const,
    itemId: p.itemId,
    roomId: p.roomId,
    ...(description ? { description } : {}),
  };
}

function listenForVerb(itemId: string, verb: string): void {
  const eventId = inventoryVerbEventId(itemId, verb);
  if (listening.has(eventId)) {
    return;
  }
  listening.add(eventId);
  const usesItem = itemVerbIds().has(verb);
  gameEvents.on(eventId, (payload: unknown) => {
    const p = payload as InventoryVerbInteractPayload;
    const reg = verbHandlers.get(itemId)?.get(verb);
    if (!reg) {
      return;
    }
    void runHandler(`items.${itemId} "${verb}"`, liveRoomScene(), payload, reg.handler).then((outcome) => {
      if (outcome === 'unhandled') {
        continueVerbDispatchToGlobal(gameEvents, verb, rowTarget(p));
      } else if (usesItem && reg.arms && outcome !== 'cancelled') {
        arm(itemId);
      }
    });
  });
}

/** `items.x.on<Verb>(…)`: `verb` used on the item's inventory row. `arms: false` is `doNotActivate`. */
export function registerItemVerbHandler(itemId: string, verb: string, handler: Handler, arms = true): void {
  warnIfUntransformed(`items.${itemId} "${verb}"`, handler);
  let byVerb = verbHandlers.get(itemId);
  if (!byVerb) {
    byVerb = new Map();
    verbHandlers.set(itemId, byVerb);
  }
  if (byVerb.has(verb) && import.meta.env.DEV) {
    console.warn(`[Benne] items.${itemId}: "${verb}" already has a handler; the last one wins.`);
  }
  byVerb.set(verb, { handler, arms });
  listenForVerb(itemId, verb);
}

// ─── Other items used on this one ────────────────────────────────────────────

/** `verb` `null` is any item verb (`onItem` / `onCombine`). */
const comboHandlers = new Map<string, Array<{ verb: string | null; handler: Handler; options?: ItemHandlerOptions }>>();

/** `items.x.on<Verb>Item(item, …)` / `onItem` / `onCombine`: `sourceItemId` used on `itemId`. */
export function registerItemComboHandler(
  itemId: string,
  verb: string | null,
  sourceItemId: string,
  handler: Handler,
  options?: ItemHandlerOptions,
): void {
  warnIfUntransformed(`items.${itemId}: ${sourceItemId}${verb ? ` "${verb}"` : ''}`, handler);
  const eventId = globalInventoryOnInventoryItemEventId(itemId, sourceItemId);
  let regs = comboHandlers.get(eventId);
  if (!regs) {
    regs = [];
    comboHandlers.set(eventId, regs);
    const forEvent = regs;
    gameEvents.on(eventId, (payload: unknown) => {
      const p = payload as InventoryUsedOnInventoryItemPayload;
      const reg = forEvent.find((r) => r.verb === p.verbId) ?? forEvent.find((r) => r.verb == null);
      if (!reg) {
        continueInventoryOnDispatchAfterGlobal(gameEvents, p);
        return;
      }
      void runHandler(`items.${itemId}: ${p.itemId} "${p.verbId}"`, liveRoomScene(), payload, reg.handler).then((outcome) => {
        if (outcome === 'unhandled') {
          continueInventoryOnDispatchAfterGlobal(gameEvents, p);
        } else if (outcome !== 'cancelled') {
          applyInventoryDropPolicy(p.itemId, reg.options);
        }
      });
    });
  }
  regs.push({ verb, handler, options });
}

/** `items.x.onAnyItem((item, verb) => …)`: any other item, any item verb, on this one. */
export function registerItemAnyComboHandler(itemId: string, handler: Handler, options?: ItemHandlerOptions): void {
  warnIfUntransformed(`items.${itemId}.onAnyItem`, handler);
  gameEvents.on(globalInventoryOnInventoryRowEventId(itemId), (payload: unknown) => {
    const p = payload as InventoryUsedOnInventoryItemPayload;
    const source = lookupItemHandle<{ id: string }>(p.itemId) ?? { id: p.itemId };
    const verb = lookupVerbHandle<{ id: string }>(p.verbId) ?? { id: p.verbId };
    void runHandler(`items.${itemId}.onAnyItem`, liveRoomScene(), payload, handler, [source, verb]).then((outcome) => {
      if (outcome === 'unhandled') {
        gameEvents.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, p);
      } else if (outcome !== 'cancelled') {
        applyInventoryDropPolicy(p.itemId, options);
      }
    });
  });
}
