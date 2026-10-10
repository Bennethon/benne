import { getDialogSettingsFromConfig, getGameSettings, getSpeechSettingsFromConfig } from '../ConfigManager.js';
import {
  clearPersistedDialogChoiceOptionsViewportHeightPx,
  clearPersistedDialogUsedColor,
  readEffectiveDialogSettings,
  writePersistedDialogChoiceOptionsViewportHeightPx,
  writePersistedDialogUsedColor,
} from '../dialog/dialogGameState.js';
import {
  readEffectiveSpeechSettings,
  writePersistedSpeechClickToSkip,
  writePersistedSpeechDefaultTalkOffset,
  writePersistedSpeechDurationMultiplier,
  writePersistedSpeechMaxDurationMs,
  writePersistedSpeechMinDurationMs,
  writePersistedSpeechMsPerCharacter,
  writePersistedSpeechShowText,
} from '../dialog/speechGameState.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
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
import { getActionSentence } from '../verbs/actionSentence.js';
import { inventoryItemLabel } from '../verbs/targetLabel.js';
import { composeVerbLineText, resolveGameDefaultVerbId } from '../verbs/verbConfig.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
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

  /**
   * Every room, before its own `onEnter`. `from` is the room the player came from.
   * `{ skippable: false }` keeps ESC from skipping the enter phase.
   */
  onEnterAnyRoom(handler: (from: RoomRef | null) => void, options?: CutsceneOptions): void {
    registerAnyRoomHandler('enter', handler, options);
  },

  /** Every room, after the fade-in and before its own `onEnterAfterFade`. */
  onEnterAnyRoomAfterFade(handler: (from: RoomRef | null) => void, options?: CutsceneOptions): void {
    registerAnyRoomHandler('enterAfterFade', handler, options);
  },

  /** Every room a save loads into, before its own `onLoaded` (the enter hooks don't run on a load). */
  onLoadedAnyRoom(handler: (from: RoomRef | null) => void): void {
    registerAnyRoomHandler('loaded', handler);
  },

  /** True while a cutscene runs: a `cutscene(…)` block or a room's enter hooks. */
  get isCutsceneActive(): boolean {
    return activeRoomScene()?.isCutsceneActive() ?? false;
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

const settingsChangeHandlers: Array<() => void> = [];

/** After any setting changes: the room refreshes its speech / dialog overlays, then `settings.onChange` handlers run. */
function settingsChanged(): void {
  emitBenneSpeechSettingsChanged();
  for (const handler of settingsChangeHandlers) {
    runDetached('settings.onChange', handler);
  }
}

/** Writes a setting through the game state manager, or warns once when the game isn't running. */
function writeSetting(what: string, write: (m: NonNullable<ReturnType<typeof tryGetActiveGameStateManager>>) => void): void {
  const m = tryGetActiveGameStateManager();
  if (!m) {
    devWarn(`settings.${what}: the game is not running — ignored.`);
    return;
  }
  write(m);
  settingsChanged();
}

function speechNow() {
  const m = tryGetActiveGameStateManager();
  return m ? readEffectiveSpeechSettings(m) : getSpeechSettingsFromConfig();
}

function dialogNow() {
  const m = tryGetActiveGameStateManager();
  return m ? readEffectiveDialogSettings(m) : getDialogSettingsFromConfig();
}

/**
 * Speech settings, named as in `game-config.json`'s `speech` section. Setting one overrides the
 * config for this player (saved with the settings, not in save slots).
 */
const speechSettings = {
  /** Whether a click dismisses the current line. Same as `settings.clickToSkip`. */
  get clickToSkip(): boolean {
    return speechNow().clickToSkip;
  },
  set clickToSkip(on: boolean) {
    writeSetting('speech.clickToSkip', (m) => writePersistedSpeechClickToSkip(m, on));
  },
  /** Whether lines show as text (timing still runs when they don't). */
  get showText(): boolean {
    return speechNow().showText;
  },
  set showText(on: boolean) {
    writeSetting('speech.showText', (m) => writePersistedSpeechShowText(m, on));
  },
  /** Milliseconds each character adds to a line's duration. */
  get msPerCharacter(): number {
    return speechNow().msPerCharacter;
  },
  set msPerCharacter(ms: number) {
    writeSetting('speech.msPerCharacter', (m) => writePersistedSpeechMsPerCharacter(m, ms));
  },
  /** Scales every line's duration. Same as `settings.textSpeed`. */
  get durationMultiplier(): number {
    return speechNow().durationMultiplier;
  },
  set durationMultiplier(multiplier: number) {
    writeSetting('speech.durationMultiplier', (m) => writePersistedSpeechDurationMultiplier(m, multiplier));
  },
  /** Shortest a line stays up, in milliseconds. */
  get minDurationMs(): number {
    return speechNow().minDurationMs;
  },
  set minDurationMs(ms: number) {
    writeSetting('speech.minDurationMs', (m) => writePersistedSpeechMinDurationMs(m, ms));
  },
  /** Longest a line stays up, in milliseconds. */
  get maxDurationMs(): number {
    return speechNow().maxDurationMs;
  },
  set maxDurationMs(ms: number) {
    writeSetting('speech.maxDurationMs', (m) => writePersistedSpeechMaxDurationMs(m, ms));
  },
  /** Offset, in game canvas pixels, of every line from its character's talk point. */
  get defaultTalkOffset(): { x: number; y: number } {
    const o = speechNow().defaultTalkOffset;
    return { x: o.x, y: o.y };
  },
  set defaultTalkOffset(offset: { x: number; y: number }) {
    writeSetting('speech.defaultTalkOffset', (m) => writePersistedSpeechDefaultTalkOffset(m, offset));
  },
};

/** Dialog settings, named as in `game-config.json`'s `dialog` section. `undefined` goes back to the config. */
const dialogSettings = {
  /** Height in pixels of the scrolling choice list. */
  get choiceOptionsViewportHeightPx(): number | undefined {
    return dialogNow().choiceOptionsViewportHeightPx;
  },
  set choiceOptionsViewportHeightPx(px: number | undefined) {
    writeSetting('dialog.choiceOptionsViewportHeightPx', (m) =>
      px === undefined ? clearPersistedDialogChoiceOptionsViewportHeightPx(m) : writePersistedDialogChoiceOptionsViewportHeightPx(m, px),
    );
  },
  /** Color of options the player has already chosen (`'#888888'`). */
  get usedColor(): string | undefined {
    return dialogNow().usedColor;
  },
  set usedColor(color: string | undefined) {
    writeSetting('dialog.usedColor', (m) =>
      color === undefined ? clearPersistedDialogUsedColor(m) : writePersistedDialogUsedColor(m, color),
    );
  },
};

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
    settingsChanged();
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
    settingsChanged();
  },

  /** How long speech lines stay up: a multiplier, 1 = as configured, 2 = twice as long. Same as `speech.durationMultiplier`. */
  get textSpeed(): number {
    return speechSettings.durationMultiplier;
  },
  set textSpeed(multiplier: number) {
    speechSettings.durationMultiplier = multiplier;
  },

  /** Whether a click dismisses the current speech line. Same as `speech.clickToSkip`. */
  get clickToSkip(): boolean {
    return speechSettings.clickToSkip;
  },
  set clickToSkip(on: boolean) {
    speechSettings.clickToSkip = on;
  },

  /** Every speech setting from `game-config.json`'s `speech` section. */
  speech: speechSettings,

  /** Every dialog setting from `game-config.json`'s `dialog` section. */
  dialog: dialogSettings,

  /** Runs `handler` after any setting changes (a settings menu that shows live values). */
  onChange(handler: () => void): void {
    warnIfUntransformed('settings.onChange', handler);
    settingsChangeHandlers.push(handler);
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

const KIND: Record<string, PointerHover['kind']> = {
  prop: 'prop',
  hotspot: 'hotspot',
  character: 'character',
  inventoryRow: 'item',
};

/** The verb / item / hover context of the pointer (§4.15). */
export const pointer = {
  /** The armed verb (a `verbs.x` handle), or `null` in walk mode. Set it to arm a verb, or `null` to clear it. */
  get verb(): VerbHandle | null {
    return lookupVerbHandle(tryGetActiveGameStateManager()?.getActiveVerb());
  },

  set verb(verb: { readonly id: string } | null) {
    const m = tryGetActiveGameStateManager();
    if (!m) {
      devWarn('pointer.verb: the game is not running — ignored.');
    } else if (verb) {
      m.setActiveVerb(verb.id);
    } else {
      m.clearActiveVerb();
    }
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

  /** What the pointer is over (`{ kind, id, description, defaultVerb }`), or `null`. */
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

  /**
   * The standard verb line: "Walk to", "Look at Door", "Use Coffee with Coffee maker" (§8.4). While a
   * clicked verb runs (an armed verb, or a right-click's default verb), it is that action's line until
   * its handler finishes, whatever the pointer is over.
   */
  get sentence(): string {
    const running = getActionSentence();
    if (running !== null) {
      return running;
    }
    const m = tryGetActiveGameStateManager();
    const itemId = m?.getActiveInventoryItemId();
    return composeVerbLineText(
      getGameSettings(),
      m?.getActiveVerb() ?? null,
      getBenneVerbContextHoverDescription(),
      itemId ? inventoryItemLabel(itemId) : null,
    ).trim();
  },

  /** Runs `handler` whenever the armed verb, the armed item or the hover target changes, or a clicked action starts or finishes. */
  onContextChange(handler: () => void): void {
    warnIfUntransformed('pointer.onContextChange', handler);
    getBenneVerbContextChangedEmitter().on(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT, () =>
      runDetached('pointer.onContextChange', handler),
    );
  },
};
