import { getGameSettings } from '../ConfigManager.js';
import { writePersistedSpeechClickToSkip, writePersistedSpeechDurationMultiplier, readEffectiveSpeechSettings } from '../dialog/speechGameState.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import { readEffectiveInventoryDescription } from '../inventory/inventoryScriptingAnimations.js';
import { tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import { getBenneEnvironment, quitBenneApplication } from '../benneEnvironment.js';
import { emitBenneSpeechSettingsChanged } from '../dialog/speechSettingsEvents.js';
import {
  BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT,
  getBenneVerbContextChangedEmitter,
  getBenneVerbContextHoverDescription,
  getBenneVerbContextHoverTarget,
} from '../verbs/verbContext.js';
import {
  readPersistedMusicSessionVolume,
  readPersistedSfxSessionVolume,
  writePersistedMusicSessionVolume,
  writePersistedSfxSessionVolume,
} from '../sound/audioGameState.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import { composeVerbLineText, resolveGameDefaultVerbId } from '../verbs/verbConfig.js';
import type { GameSettings } from '../../types/game.js';
import { activeRoomScene } from './actions.js';
import { registerAnyRoomHandler } from './globalHandlers.js';
import { endHandler, runDetached, warnIfUntransformed } from './interactionContext.js';
import type { ItemHandle, VerbHandle } from './handles.js';
import { lookupItemHandle, lookupRoomHandle, lookupVerbHandle } from './registry.js';

function devWarn(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[Benne] ${message}`);
  }
}

interface RoomRef {
  readonly id: string;
}

// ─── game ────────────────────────────────────────────────────────────────────

/** The running game (§4.16, §4.17). */
export const game = {
  /** True in the desktop (Electron) build, where `quit()` closes the window. */
  get isDesktop(): boolean {
    return getBenneEnvironment() === 'electron';
  },

  /** Closes the desktop app. Does nothing in a browser. */
  quit(): void {
    quitBenneApplication();
  },

  /**
   * Starts a fresh game: resets all state, then goes to `startRoom` (the configured starting room
   * by default). Ends the handler.
   */
  newGame(startRoom?: RoomRef): never {
    const manager = tryGetActiveGameStateManager();
    const orch = tryGetRoomTransitionOrchestrator();
    if (!manager || !orch) {
      devWarn('game.newGame(): the game is not running — ignored.');
      return endHandler();
    }
    manager.resetToInitial({ preserveRoomContext: true });
    orch.armNextChangeAsFreshStart();
    void orch.changeTo(startRoom?.id ?? getGameSettings().startingRoomId ?? manager.getCurrentRoom(), false);
    return endHandler();
  },

  /** The room the player is in (a `rooms.x` handle), or `null` before the first room. */
  get currentRoom(): RoomRef | null {
    return lookupRoomHandle<RoomRef>(tryGetActiveGameStateManager()?.getCurrentRoom());
  },

  /** `game-config.json`. */
  get config(): GameSettings {
    return getGameSettings();
  },

  /** Seconds since the room started (the room clock; pauses with it). */
  get time(): number {
    return (activeRoomScene()?.time.now ?? 0) / 1000;
  },

  /** Every room, before its own `onEnter`. `from` is the room the player came from. */
  onEnterAnyRoom(handler: (from: RoomRef | null) => void): void {
    registerAnyRoomHandler('enter', handler);
  },

  /** Every room, after the fade-in and before its own `onEnterAfterFade`. */
  onEnterAnyRoomAfterFade(handler: (from: RoomRef | null) => void): void {
    registerAnyRoomHandler('enterAfterFade', handler);
  },

  /** Every room change, before the room is left. */
  onLeaveAnyRoom(handler: () => void): void {
    registerAnyRoomHandler('leave', handler);
  },
};

// ─── settings ────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function soundManager() {
  const g = tryGetActiveBenneGame();
  return g ? tryGetBenneSoundManager(g) : null;
}

/** Player settings (§4.16). Saved with the game's settings, not with save slots. */
export const settings = {
  /** Sound effects volume, 0–1. */
  get sfxVolume(): number {
    const sm = soundManager();
    if (sm) {
      return sm.getSfxSessionVolume();
    }
    const m = tryGetActiveGameStateManager();
    return m ? readPersistedSfxSessionVolume(m) : clamp01(getGameSettings().audio.sfxVolume);
  },
  set sfxVolume(volume: number) {
    const v = clamp01(volume);
    soundManager()?.setSfxSessionVolume(v);
    const m = tryGetActiveGameStateManager();
    if (m) {
      writePersistedSfxSessionVolume(m, v);
    }
  },

  /** Music volume, 0–1. */
  get musicVolume(): number {
    const sm = soundManager();
    if (sm) {
      return sm.getMusicSessionVolume();
    }
    const m = tryGetActiveGameStateManager();
    return m ? readPersistedMusicSessionVolume(m) : clamp01(getGameSettings().audio.musicVolume);
  },
  set musicVolume(volume: number) {
    const v = clamp01(volume);
    soundManager()?.setMusicSessionVolume(v);
    const m = tryGetActiveGameStateManager();
    if (m) {
      writePersistedMusicSessionVolume(m, v);
    }
  },

  /** How long speech lines stay up: a multiplier, 1 = as configured, 2 = twice as long. */
  get textSpeed(): number {
    const m = tryGetActiveGameStateManager();
    return m ? readEffectiveSpeechSettings(m).durationMultiplier : 1;
  },
  set textSpeed(multiplier: number) {
    const m = tryGetActiveGameStateManager();
    if (m) {
      writePersistedSpeechDurationMultiplier(m, multiplier);
      emitBenneSpeechSettingsChanged();
    }
  },

  /** Whether a click dismisses the current speech line. */
  get clickToSkip(): boolean {
    const m = tryGetActiveGameStateManager();
    return m ? readEffectiveSpeechSettings(m).clickToSkip : true;
  },
  set clickToSkip(on: boolean) {
    const m = tryGetActiveGameStateManager();
    if (m) {
      writePersistedSpeechClickToSkip(m, on);
      emitBenneSpeechSettingsChanged();
    }
  },
};

// ─── pointer ─────────────────────────────────────────────────────────────────

/** What the pointer is over. */
export interface PointerHover {
  readonly kind: 'prop' | 'hotspot' | 'character' | 'item' | null;
  /** Prop, hotspot, character or item id. */
  readonly id: string | null;
  /** The hover description shown in the verb line. */
  readonly description: string | null;
  /** The verb a plain click would use (its own `defaultVerb`, else the game's): a `verbs.x` handle. */
  readonly defaultVerb: VerbHandle | null;
}

function activeItemName(itemId: string): string {
  const def = getInventoryDefinition(itemId);
  const m = tryGetActiveGameStateManager();
  const description = def && m ? readEffectiveInventoryDescription(m, def) : def?.description;
  return description || def?.name || itemId;
}

const KIND: Record<string, PointerHover['kind']> = {
  prop: 'prop',
  hotspot: 'hotspot',
  character: 'character',
  inventoryRow: 'item',
};

/** The verb / item / hover context of the pointer (§4.15). */
export const pointer = {
  /** The armed verb (a `verbs.x` handle), or `null` in walk mode. */
  get verb(): VerbHandle | null {
    return lookupVerbHandle(tryGetActiveGameStateManager()?.getActiveVerb());
  },

  /**
   * The armed inventory item (an `items.x` handle), or `null`. Set it to arm an item (`pointer.item =
   * items.knife`) or to drop the armed one (`pointer.item = null`).
   */
  get item(): ItemHandle | null {
    return lookupItemHandle(tryGetActiveGameStateManager()?.getActiveInventoryItemId());
  },

  set item(item: { readonly id: string } | null) {
    const m = tryGetActiveGameStateManager();
    if (!m) {
      devWarn('pointer.item: the game is not running — ignored.');
    } else if (item) {
      m.setActiveInventoryItem(item.id);
    } else {
      m.clearActiveInventoryItem();
    }
  },

  get hover(): PointerHover | null {
    const target = getBenneVerbContextHoverTarget();
    if (!target) {
      return null;
    }
    const verbId = target.defaultVerb?.trim() || resolveGameDefaultVerbId(getGameSettings());
    return {
      kind: target.targetType ? (KIND[target.targetType] ?? null) : null,
      id: target.targetId ?? target.itemId ?? null,
      description: target.description,
      defaultVerb: lookupVerbHandle(verbId),
    };
  },

  /** The standard verb line: "Walk to", "Look at Door", "Use Coffee with Coffee maker" (§8.4). */
  get sentence(): string {
    const m = tryGetActiveGameStateManager();
    const itemId = m?.getActiveInventoryItemId();
    return composeVerbLineText(
      getGameSettings(),
      m?.getActiveVerb() ?? null,
      getBenneVerbContextHoverDescription(),
      itemId ? activeItemName(itemId) : null,
    ).trim();
  },

  /** Runs `handler` whenever the armed verb, the armed item or the hover target changes. */
  onContextChange(handler: () => void): void {
    warnIfUntransformed('pointer.onContextChange', handler);
    getBenneVerbContextChangedEmitter().on(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT, () =>
      runDetached('pointer.onContextChange', handler),
    );
  },
};
