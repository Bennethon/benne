import * as Phaser from 'phaser';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { CharacterFollowOptions } from '../../types/characterFollow.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { Point2 } from '../../types/room.js';
import type {
  CharacterId,
  GameVerbId,
  InventoryItemId,
  ResolvableTargetId,
} from '../../types/generated/benne-game-ids.js';
import { getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/boot/constants.js';
import { computeSpeechLineDurationMs, getSpeechSettings, getGameSettings } from '../ConfigManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  applyCharacterEffectiveAnimation,
  applyPersistedCharacterFollowFromScript,
  clearSavedCharacterFollowState,
  clearSavedCharacterSpeechPosition,
  getCharacterAnimationOverrideTag,
  readSavedCharacterFollowingTarget,
  readSavedCharacterClickable,
  readSavedCharacterDescription,
  readSavedCharacterMovable,
  readSavedCharacterVisible,
  writeSavedCharacterClickable,
  writeSavedCharacterDescription,
  writeSavedCharacterMovable,
  writeSavedCharacterSpeechOffset,
  writeSavedCharacterSpeechPosition,
  writeSavedCharacterVisible,
} from '../benneAnimationRuntime.js';
import {
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CharacterFacing,
} from '../directionalCharacterAnimation.js';
import { getEffectiveVerbDefinitions, WALK_TO_VERB_ID } from '../verbs/verbConfig.js';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry.js';
import type { InventoryItemDefinition, VerbDefinition, VerbHoverTarget } from '../../types/verbContext.js';
import {
  getBenneSpeechSettingsChangedEmitter,
} from './benneSpeechSettingsScriptSurface.js';
import {
  getBenneVerbContextChangedEmitter,
  getBenneVerbContextHoverDescription,
  getBenneVerbContextHoverTarget,
} from './benneVerbContextScriptSurface.js';
import {
  resolveGameStateManager,
  tryGetActiveGameStateManager,
} from '../gameState/resolveGameStateManager.js';
import type { AnyInventoryUsedOnPayload } from '../events/inventoryOnVerbEvents.js';
import { INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT } from '../events/inventoryOnVerbEvents.js';
import { shouldDropActiveInventoryOnUse } from '../verbs/dispatchInventoryOnVerbTarget.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import {
  createLazyBenneScriptCharacterInventoryNamespace,
  createLazyBenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import type {
  BenneScriptCharacterFacade,
  BenneScriptCameraFacade,
  BenneScriptDialogSettingsFacade,
  BenneScriptPlayerFacade,
  BenneScriptRoomFacade,
  BenneScriptSoundFacade,
  BenneScriptSpeechSettingsFacade,
  BenneScriptVideoFacade,
} from './benneScriptFacades.js';
import { createBenneScriptDialogSettingsFacade } from './benneScriptDialogSettingsApi.js';
import { createBenneScriptSpeechSettingsFacade } from './benneScriptSpeechSettingsApi.js';
import { createBenneScriptCameraFacade } from './benneScriptCameraApi.js';
import { createBenneScriptSoundFacade } from './benneScriptSoundApi.js';
import { createBenneScriptVideoFacade } from './benneScriptVideoApi.js';
import type { VerbInteractTarget } from '../events/verbInteractionEvents.js';
import { getCharacterWorldFeet } from '../characterFeet.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import {
  BENNE_SCREEN_FADE_DEFAULT_COLOR,
  BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
} from '../scenes/roomScreenFadeConstants.js';
import { bindRoomFacadeForBenneScriptCore } from './benneScriptRoomApi.js';
import type { UpdateContext } from './types.js';

/**
 * Callable that participates in the interaction queue; **`fn.now`** runs the same action immediately
 * without blocking subsequent chained steps (fire-and-forget).
 */
export type BlockingWithNow<TArgs extends readonly unknown[] = readonly unknown[]> = ((
  ...args: TArgs
) => void) & { now: (...args: TArgs) => void };

export function withNow<TArgs extends readonly unknown[]>(
  blocking: (...args: TArgs) => void,
  nowImpl: (...args: TArgs) => void,
): BlockingWithNow<TArgs> {
  const fn = blocking as BlockingWithNow<TArgs>;
  fn.now = nowImpl;
  return fn;
}

/**
 * Resolves the string id (or explicit `{ x, y }`) to pass to {@link RoomScene.walkPlayerTo} for
 * **`walkToClicked`** / **`walkToClicked.now`**, from the event payload of a verb handler.
 *
 * Returns **`null`** when the interaction is not tied to a room hit target (e.g. inventory-row
 * verbs from {@link import('../events/inventoryVerbEvents.js').dispatchInventoryVerbInteraction},
 * or use-on-another-inventory-item).
 */
function resolveWalkToClickedTargetFromPayload(payload: unknown): Point2 | ResolvableTargetId | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  const p = payload as Record<string, unknown>;

  if ('target' in p && p.target && typeof p.target === 'object' && 'type' in (p.target as object)) {
    const t = p.target as VerbInteractTarget;
    if (t.type === 'prop') return t.propId;
    if (t.type === 'hotspot') return t.hotspotId;
    if (t.type === 'character') return t.characterId;
    if (t.type === 'inventoryItem') return null;
  }

  if (typeof p.propId === 'string') return p.propId;
  if (typeof p.hotspotId === 'string') return p.hotspotId;
  if (typeof p.characterId === 'string') return p.characterId;

  if (p.targetType === 'inventoryItem') {
    return null;
  }

  // `InventoryVerbInteractPayload` — look/use on a row in the inventory UI only.
  if (
    typeof p.itemId === 'string' &&
    typeof p.roomId === 'string' &&
    typeof p.verbId === 'string' &&
    !('targetType' in p) &&
    !('instanceId' in p) &&
    !('propId' in p) &&
    !('hotspotId' in p) &&
    !('characterId' in p) &&
    !('tag' in p)
  ) {
    return null;
  }

  return null;
}

/** Per-handler context for {@link BenneScriptCore.walkToClicked} / {@link BenneScriptCore.faceClicked}. */
interface VerbClickScriptContext {
  walkTarget: Point2 | ResolvableTargetId | null;
  /** Room-space point for facing (payload `lookAtPoint`, or NPC feet for characters); `null` uses walk resolution only. */
  faceLookWorld: Point2 | null;
}

function readPayloadLookAtPoint(payload: Record<string, unknown>): Point2 | null {
  const lp = payload.lookAtPoint;
  if (lp && typeof lp === 'object' && typeof (lp as Point2).x === 'number' && typeof (lp as Point2).y === 'number') {
    return { x: (lp as Point2).x, y: (lp as Point2).y };
  }
  return null;
}

/**
 * World / room pixel point the player should face for **`faceClicked`**: payload **`lookAtPoint`**
 * when present, else the clicked **character’s feet** (no `lookAtPoint` on characters in data).
 */
function resolveFaceLookWorldFromPayload(payload: unknown, scene: RoomScene): Point2 | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  const p = payload as Record<string, unknown>;

  const fromLookAt = readPayloadLookAtPoint(p);
  if (fromLookAt) {
    return fromLookAt;
  }

  // Character verbs / inventory-on-character: face the NPC’s feet (not talkPoint).
  if (typeof p.characterId === 'string' && typeof p.propId !== 'string') {
    const sprite = scene.getCharacterSprite(p.characterId);
    if (sprite) {
      return getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    }
    return null;
  }

  if ('target' in p && p.target && typeof p.target === 'object' && 'type' in (p.target as object)) {
    const t = p.target as VerbInteractTarget;
    if (t.type === 'prop' && t.lookAtPoint) {
      return { x: t.lookAtPoint.x, y: t.lookAtPoint.y };
    }
    if (t.type === 'hotspot' && t.lookAtPoint) {
      return { x: t.lookAtPoint.x, y: t.lookAtPoint.y };
    }
    if (t.type === 'character') {
      const sprite = scene.getCharacterSprite(t.characterId);
      if (sprite) {
        return getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
      }
    }
    if (t.type === 'inventoryItem') {
      return null;
    }
  }

  return null;
}

/** Internal keys for {@link BenneScriptCore.resolveVerbId}. */
export type VerbAlias =
  | 'look'
  | 'use'
  | 'pickUp'
  | 'give'
  | 'talkTo'
  | 'push'
  | 'pull'
  | 'open'
  | 'close';

const VERB_ALIAS_CANDIDATES: Record<VerbAlias, readonly string[]> = {
  look: ['look', 'examine'],
  use: ['use', 'interact'],
  pickUp: ['pickUp', 'pickup', 'take'],
  give: ['give'],
  talkTo: ['talkTo', 'talk', 'speak'],
  push: ['push'],
  pull: ['pull'],
  open: ['open'],
  close: ['close'],
};

/** Optional flags for `say` / `.say.now` on character/player facades. */
export interface BenneScriptSayLineOptions {
  clickToSkip?: boolean;
}

export type BenneScriptSayArgs = [line: string, options?: BenneScriptSayLineOptions];

/** Scope for {@link BenneScriptCore.parseDialogueLines}. */
export type BenneSayDialogueScope =
  | { mode: 'free' }
  | { mode: 'fixed'; definitionId: string };

/** **`B.say`**…`` / **`B.say.now`**…`` — multi-line dialogue (tagged template only). */
export type BenneScriptSayDialogueTagged = ((
  strings: TemplateStringsArray,
  ...exprValues: unknown[]
) => void) & {
  readonly now: (strings: TemplateStringsArray, ...exprValues: unknown[]) => void;
};

/**
 * Character / player facade **`say`**: string line + options, **or** tagged dialogue; **`.now`** mirrors both.
 */
export type BenneScriptSayDialogueHybrid = {
  (line: string, options?: BenneScriptSayLineOptions): void;
  (strings: TemplateStringsArray, ...exprValues: unknown[]): void;
  readonly now: {
    (line: string, options?: BenneScriptSayLineOptions): void;
    (strings: TemplateStringsArray, ...exprValues: unknown[]): void;
  };
};

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value) &&
    'raw' in value &&
    typeof (value as TemplateStringsArray).raw === 'object' &&
    Array.isArray((value as TemplateStringsArray).raw)
  );
}

function cookTaggedTemplateStrings(strings: TemplateStringsArray, exprValues: readonly unknown[]): string {
  let out = strings[0] ?? '';
  for (let i = 0; i < exprValues.length; i++) {
    out += String(exprValues[i] ?? '') + (strings[i + 1] ?? '');
  }
  return out;
}

function stripTrailingLineComment(line: string): string {
  const idx = line.search(/\s\/\//);
  if (idx < 0) {
    return line;
  }
  return line.slice(0, idx).trimEnd();
}

export interface BenneSayVoiceMarkerParseResult {
  readonly text: string;
  readonly voiceNumber: string | null;
}

export function parseBenneSayVoiceMarker(line: string): BenneSayVoiceMarkerParseResult {
  const m = /^\|(\d+)\|\s*/.exec(line);
  if (!m) {
    return { text: line, voiceNumber: null };
  }
  return { text: line.slice(m[0].length), voiceNumber: m[1] ?? null };
}

interface BenneSayRuntimeLine {
  readonly text: string;
  readonly voiceStem: string | null;
}

function resolveBenneSayRuntimeLine(line: string, talkCharacterDefinitionId: string): BenneSayRuntimeLine {
  const parsed = parseBenneSayVoiceMarker(line);
  return {
    text: parsed.text,
    voiceStem: parsed.voiceNumber == null ? null : `${talkCharacterDefinitionId}${parsed.voiceNumber}`,
  };
}

/**
 * Shared interaction queue, verb alias resolution, dialog line + input lock, and `wait` / `raw`
 * for room, character, global, and GUI Bennescript facades.
 */
export abstract class BenneScriptCore {
  private static warnedOnUpdateUnsupported = false;
  private static unresolvedVerbWarnings = new Set<string>();
  private static warnedPlayerFacadeNoRoomScene = false;
  private static warnedSayDialogueNoRoomScene = false;
  private static warnedDisplayDialogueNoRoomScene = false;
  private static walkToClickedDevWarnKeys = new Set<string>();
  private static faceClickedDevWarnKeys = new Set<string>();
  private static warnedScreenFadeNoRoom = false;
  private static warnedCharacterFacadeNoRoomScene = false;

  protected readonly events: Phaser.Events.EventEmitter;
  private disposers: Array<() => void> = [];
  private interactionTail: Promise<void> = Promise.resolve();
  private readonly getClock: () => Phaser.Time.Clock | null;
  private readonly getPlayerWalkRoomScene: () => RoomScene | undefined;

  /**
   * While a Bennescript **`subscribe`** / **`subscribeAfterInteractionTail`** handler runs, holds
   * nested click context from each payload (**`walkToClicked`** + **`faceClicked`**).
   */
  private readonly verbClickContextStack: VerbClickScriptContext[] = [];

  /**
   * Pause the interaction chain for **`seconds`**. **`.wait.now`** schedules the delay only (does not block the queue).
   */
  readonly wait: BlockingWithNow<[number]>;

  /**
   * Walk the player to the **current verb interaction** target (prop / hotspot / character id, or
   * the same shape as **`B.player.walkTo('…')`**), using {@link RoomScene.walkPlayerTo} (same string
   * id resolution as **`walkTo`**), then applies the same facing as **`faceClicked`** once the walk
   * finishes (see {@link RoomScene.facePlayerTowardClicked}). **`.now`** does not block the interaction
   * queue. Only meaningful inside handlers registered via **`subscribe`** /
   * **`subscribeAfterInteractionTail`** (room / global / character / inventory verbs, inventory
   * use-on-target, etc.); outside that, a **dev** one-time **`console.warn`** applies.
   */
  readonly walkToClicked: BlockingWithNow<[]>;

  /**
   * Face the player toward the interaction’s **`lookAtPoint`** when the payload includes it (prop /
   * hotspot); for **characters**, faces the clicked character’s **feet**. Otherwise falls back to the
   * same stand point as **`walkToClicked`** (see {@link RoomScene.facePlayerTowardClicked}). **`.now`**
   * does not block the queue.
   */
  readonly faceClicked: BlockingWithNow<[]>;

  /**
   * Full-screen fade to opaque. Default duration **0.35** s, default color black (`0x000000`).
   * Queues on the interaction tail; **`fadeOut.now`** does not.
   */
  readonly fadeOut: BlockingWithNow<[durationSeconds?: number, color?: number]>;

  /** Full-screen fade to transparent. Same defaults and queuing as {@link fadeOut}. */
  readonly fadeIn: BlockingWithNow<[durationSeconds?: number, color?: number]>;

  /**
   * Cutscene sequence. Pushes the active {@link RoomScene}'s cutscene stack while the callback's
   * queued steps execute, then pops it.
   *
   * **Blocking form** (`B.cutscene(callback)`): waits for any previously-queued steps to drain,
   * then pushes the cutscene flag, runs `callback` synchronously (which may queue further
   * `B.*` steps on this tail), and pops the flag after all those steps complete.
   *
   * **`.now` form** (`B.cutscene.now(callback)`): pushes the cutscene flag and runs the callback
   * immediately (without waiting for the existing queue), then pops after any steps queued by
   * the callback finish.
   *
   * During the cutscene: all pointer input is suppressed (props, hotspots, characters, GUI
   * buttons, inventory rows, background walks); the custom cursor switches to the configured
   * `busyAnimation` or is hidden. Only the click-to-skip scripted dialog path remains live.
   *
   * **Skipping**: unless `game-config.json` sets **`cutscenesSkippable: false`**, the player can
   * press **ESC** to fast-forward the cutscene — every remaining step still runs, but timed steps
   * complete instantly at their final value, so the end state matches a cutscene that played out.
   * Pass **`{ skippable: false }`** to make one cutscene unskippable (same shape as per-line
   * **`say('…', { clickToSkip: false })`**).
   */
  readonly cutscene: BlockingWithNow<[callback: () => void, options?: CutsceneOptions]>;

  /** Room id / transitions (`B.room.changeTo`, `current` / `last` from game state). */
  readonly room: BenneScriptRoomFacade;

  /** SFX + music (`B.sound.play('creak')`, `B.sound.playMusic('song')`, …). */
  readonly sound: BenneScriptSoundFacade;

  /** Cinematic video playback (`B.video.play('intro')`, `B.video.playAndWait('outro')`, …). */
  readonly video: BenneScriptVideoFacade;

  /** Script camera control (`B.camera.focus`, `B.camera.setZoom`, …). */
  readonly camera: BenneScriptCameraFacade;

  /** Runtime speech prefs (`B.speechSettings.clickToSkip`, timing, talk offset, …). */
  readonly speechSettings: BenneScriptSpeechSettingsFacade;

  /** Runtime dialog prefs (`B.dialogSettings.choiceOptionsViewportHeightPx`). */
  readonly dialogSettings: BenneScriptDialogSettingsFacade;

  /**
   * PowerQuest-style **`B.say`**…``: lines **`Speaker: text`** (blank lines and **`//`** line / trailing comments ignored). **`Player`** (any case) → active player character. Queues each line on the interaction tail; **`B.say.now`**… does not wait behind prior queued steps (each line still uses the dialog overlay lock).
   */
  readonly say: BenneScriptSayDialogueTagged;

  /**
   * Narration / on-screen Display Text via the **`display-text`** GUI. Blocks until the player
   * left-clicks to dismiss (same input suppression as scripted **`say`** lines). **`display.now`** skips the interaction tail.
   */
  readonly display: BlockingWithNow<[text: string]>;

  readonly raw: {
    on: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    once: (event: string | symbol, fn: (...args: unknown[]) => void, context?: unknown) => void;
    off: (event: string | symbol, fn?: (...args: unknown[]) => void, context?: unknown) => void;
    emit: (event: string | symbol, ...args: unknown[]) => boolean;
  };

  constructor(
    events: Phaser.Events.EventEmitter,
    getClock: () => Phaser.Time.Clock | null,
    getPlayerWalkRoomScene?: () => RoomScene | undefined,
  ) {
    this.events = events;
    this.getClock = getClock;
    this.getPlayerWalkRoomScene = getPlayerWalkRoomScene ?? (() => undefined);

    this.raw = {
      on: (event, fn, context) => this.events.on(event, fn as (...args: unknown[]) => void, context),
      once: (event, fn, context) => this.events.once(event, fn as (...args: unknown[]) => void, context),
      off: (event, fn, context) => this.events.off(event, fn as never, context),
      emit: (event, ...args) => this.events.emit(event, ...args),
    };

    this.wait = withNow(
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.chain(
          () =>
            new Promise<void>((resolve) => {
              const scene = this.getPlayerWalkRoomScene();
              const clock = this.getClock();
              if (!clock || scene?.isCutsceneSkipFastForwarding()) {
                resolve();
                return;
              }
              let unregisterSkipFinisher: (() => void) | null = null;
              const timer = clock.delayedCall(ms, () => {
                unregisterSkipFinisher?.();
                unregisterSkipFinisher = null;
                resolve();
              });
              unregisterSkipFinisher =
                scene?.registerCutsceneSkipFinisher(() => {
                  unregisterSkipFinisher = null;
                  timer.remove(false);
                  resolve();
                }) ?? null;
            }),
        );
      },
      (seconds: number) => {
        const ms = Math.max(0, seconds * 1000);
        this.getClock()?.delayedCall(ms, () => {});
      },
    );

    this.walkToClicked = withNow(
      () => this.performWalkToClicked(true),
      () => this.performWalkToClicked(false),
    );

    this.faceClicked = withNow(
      () => this.performFaceClicked(true),
      () => this.performFaceClicked(false),
    );

    this.fadeOut = withNow(
      (durationSeconds?: number, color?: number) =>
        this.performScreenFade(1, true, durationSeconds, color),
      (durationSeconds?: number, color?: number) =>
        this.performScreenFade(1, false, durationSeconds, color),
    );
    this.fadeIn = withNow(
      (durationSeconds?: number, color?: number) =>
        this.performScreenFade(0, true, durationSeconds, color),
      (durationSeconds?: number, color?: number) =>
        this.performScreenFade(0, false, durationSeconds, color),
    );

    this.cutscene = withNow(
      (callback: () => void, options?: CutsceneOptions) => {
        // Blocking form: wait for prior tail to drain, then push cutscene, run callback
        // (which appends its own sub-steps to the tail), then append the pop.
        // Crucially the pop must be chained INSIDE the factory (after callback()), not in the
        // outer synchronous call, so it comes after callback's sub-steps rather than before them.
        this.chain(() => {
          this.getPlayerWalkRoomScene()?.pushCutscene(options);
          callback(); // synchronously appends sub-steps A, B, … to this.interactionTail
          // Pop step is appended here, after A and B — final chain order: push → A → B → pop.
          this.chain(() => {
            this.getPlayerWalkRoomScene()?.popCutscene();
            return Promise.resolve();
          });
          return Promise.resolve();
        });
      },
      (callback: () => void, options?: CutsceneOptions) => {
        // .now: push immediately, run callback, chain pop at end of whatever callback added.
        this.getPlayerWalkRoomScene()?.pushCutscene(options);
        callback(); // appends sub-steps to this.interactionTail
        this.chain(() => {
          this.getPlayerWalkRoomScene()?.popCutscene();
          return Promise.resolve();
        });
      },
    );

    this.say = this.createFreeScopeSayDialogue();

    this.display = withNow(
      (text: string) => {
        const scene = this.getPlayerWalkRoomScene();
        if (!scene) {
          BenneScriptCore.warnDisplayDialogueNoRoomOnce();
          return;
        }
        this.chain(() => this.createDisplayTextPromise(scene, text));
      },
      (text: string) => {
        const scene = this.getPlayerWalkRoomScene();
        if (!scene) {
          BenneScriptCore.warnDisplayDialogueNoRoomOnce();
          return;
        }
        void this.createDisplayTextPromise(scene, text);
      },
    );

    this.room = bindRoomFacadeForBenneScriptCore((f) => this.chain(f));
    this.sound = createBenneScriptSoundFacade(
      (f) => this.chain(f),
      () => this.getPlayerWalkRoomScene(),
    );
    this.video = createBenneScriptVideoFacade(
      (f) => this.chain(f),
      () => this.getPlayerWalkRoomScene(),
    );
    this.camera = createBenneScriptCameraFacade(
      (f) => this.chain(f),
      () => this.getPlayerWalkRoomScene(),
    );
    this.speechSettings = createBenneScriptSpeechSettingsFacade();
    this.dialogSettings = createBenneScriptDialogSettingsFacade();
  }

  /**
   * Engine hook: discards the interaction queue (room change, not normal script use).
   */
  resetInteractionTailForEngine(): void {
    this.interactionTail = Promise.resolve();
  }

  private static warnWalkToClickedDevOnce(key: string, message: string): void {
    if (!import.meta.env.DEV || BenneScriptCore.walkToClickedDevWarnKeys.has(key)) {
      return;
    }
    BenneScriptCore.walkToClickedDevWarnKeys.add(key);
    console.warn(`[Benne] ${message}`);
  }

  private static warnFaceClickedDevOnce(key: string, message: string): void {
    if (!import.meta.env.DEV || BenneScriptCore.faceClickedDevWarnKeys.has(key)) {
      return;
    }
    BenneScriptCore.faceClickedDevWarnKeys.add(key);
    console.warn(`[Benne] ${message}`);
  }

  protected pushVerbWalkContext(payload: unknown): void {
    const scene = this.getPlayerWalkRoomScene();
    const faceLookWorld =
      scene && scene.player ? resolveFaceLookWorldFromPayload(payload, scene) : null;
    this.verbClickContextStack.push({
      walkTarget: resolveWalkToClickedTargetFromPayload(payload),
      faceLookWorld,
    });
  }

  protected popVerbWalkContext(): void {
    this.verbClickContextStack.pop();
  }

  private resolveRoomSceneForScreenFade(): RoomScene | undefined {
    const direct = this.getPlayerWalkRoomScene();
    if (direct) {
      return direct;
    }
    const game = tryGetActiveBenneGame();
    if (!game) {
      return undefined;
    }
    return game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
  }

  private performScreenFade(
    toAlpha: number,
    chain: boolean,
    durationSeconds?: number,
    color?: number,
  ): void {
    const scene = this.resolveRoomSceneForScreenFade();
    if (!scene) {
      if (import.meta.env.DEV && !BenneScriptCore.warnedScreenFadeNoRoom) {
        BenneScriptCore.warnedScreenFadeNoRoom = true;
        console.warn('[Benne] B.fadeOut / B.fadeIn: no active RoomScene — ignored.');
      }
      return;
    }
    const duration = durationSeconds ?? BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC;
    const fillColor = color ?? BENNE_SCREEN_FADE_DEFAULT_COLOR;
    if (chain) {
      this.chain(() => scene.queueScreenFadeToAlpha(toAlpha, duration, fillColor));
    } else {
      void scene.queueScreenFadeToAlpha(toAlpha, duration, fillColor);
    }
  }

  /**
   * Queues (or fires) **`walkPlayerTo`** for the innermost verb payload’s walk target, then
   * {@link RoomScene.facePlayerTowardClicked} with the same payload snapshot **`faceClicked`** uses.
   * Shared by **`B.walkToClicked`** and **`B.player.walkToClicked`** on the same script instance.
   */
  protected performWalkToClicked(chain: boolean): void {
    const scene = this.getPlayerWalkRoomScene();
    if (!scene) {
      BenneScriptCore.warnWalkToClickedDevOnce(
        'walkToClicked:no-room',
        'walkToClicked: no active RoomScene — ignored.',
      );
      return;
    }

    if (this.verbClickContextStack.length === 0) {
      BenneScriptCore.warnWalkToClickedDevOnce(
        'walkToClicked:outside-verb',
        'walkToClicked called outside a verb handler (no interaction payload) — ignored.',
      );
      return;
    }

    const ctx = this.verbClickContextStack[this.verbClickContextStack.length - 1]!;
    const target = ctx.walkTarget;
    if (target == null) {
      BenneScriptCore.warnWalkToClickedDevOnce(
        'walkToClicked:no-world-target',
        'walkToClicked: this verb has no room walk target (e.g. inventory row only) — ignored.',
      );
      return;
    }

    const faceAfterWalk = (): void => {
      scene.facePlayerTowardClicked(ctx.faceLookWorld, ctx.walkTarget);
    };

    if (chain) {
      this.chain(() => scene.walkPlayerTo(target).then(faceAfterWalk));
    } else {
      void scene.walkPlayerTo(target).then(faceAfterWalk);
    }
  }

  /**
   * Queues (or runs) {@link RoomScene.facePlayerTowardClicked} for the innermost verb payload.
   * Shared by **`B.faceClicked`** and **`B.player.faceClicked`**.
   */
  protected performFaceClicked(chain: boolean): void {
    const scene = this.getPlayerWalkRoomScene();
    if (!scene) {
      BenneScriptCore.warnFaceClickedDevOnce(
        'faceClicked:no-room',
        'faceClicked: no active RoomScene — ignored.',
      );
      return;
    }

    if (this.verbClickContextStack.length === 0) {
      BenneScriptCore.warnFaceClickedDevOnce(
        'faceClicked:outside-verb',
        'faceClicked called outside a verb handler (no interaction payload) — ignored.',
      );
      return;
    }

    const ctx = this.verbClickContextStack[this.verbClickContextStack.length - 1]!;
    if (ctx.walkTarget == null && ctx.faceLookWorld == null) {
      BenneScriptCore.warnFaceClickedDevOnce(
        'faceClicked:no-world-target',
        'faceClicked: this verb has no room target (e.g. inventory row only) — ignored.',
      );
      return;
    }

    const run = (): void => {
      scene.facePlayerTowardClicked(ctx.faceLookWorld, ctx.walkTarget);
    };

    if (chain) {
      this.chain(() => {
        run();
        return Promise.resolve();
      });
    } else {
      run();
    }
  }

  dispose(): void {
    for (const off of this.disposers) {
      off();
    }
    this.disposers = [];
  }

  /**
   * Non-blocking per-frame hook (PowerQuest **`void Update()`** equivalent). Runs every
   * {@link RoomScene} frame **outside** the interaction queue; **no** **`.now`** variant.
   * Supported on **room** and **global** **`B`** only — other facades log once in dev and ignore.
   */
  onUpdate(handler: (ctx: UpdateContext) => void): void {
    const off = this.acquireOnUpdateSubscription(handler);
    if (off == null) {
      if (import.meta.env.DEV && !BenneScriptCore.warnedOnUpdateUnsupported) {
        BenneScriptCore.warnedOnUpdateUnsupported = true;
        console.warn('[Benne] B.onUpdate is only supported on room and global script facades.');
      }
      return;
    }
    this.registerDisposable(off);
  }

  /**
   * Room / global subclasses return an unregister callback; all others return **`null`**.
   */
  protected acquireOnUpdateSubscription(_handler: (ctx: UpdateContext) => void): (() => void) | null {
    return null;
  }

  /**
   * Set the runtime "active verb" (see {@link GameStateManager.setActiveVerb}). Available on every
   * Bennescript facade (room / character / global / inventory / GUI) via `B.setActiveVerb(...)`.
   * Pass `null` or an empty string to clear. Typical wiring: a verb GUI button calls
   * `B.setActiveVerb('open')` from its `whenButtonClick` handler.
   */
  setActiveVerb(verbId: GameVerbId | null): void {
    const manager = tryGetActiveGameStateManager();
    if (!manager) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Benne] B.setActiveVerb called before the game was created — ignored.',
        );
      }
      return;
    }
    manager.setActiveVerb(verbId);
  }

  /** Current active verb id, or `null` when none is set. */
  getActiveVerb(): GameVerbId | null {
    return tryGetActiveGameStateManager()?.getActiveVerb() ?? null;
  }

  /** Convenience for `setActiveVerb(null)`. */
  clearActiveVerb(): void {
    tryGetActiveGameStateManager()?.clearActiveVerb();
  }

  /**
   * Set the runtime active inventory item for use-on-target (see {@link GameStateManager.setActiveInventoryItem}).
   * Available on every Bennescript facade via `B.setActiveInventory(...)` and on `B.state`. Pass `null` or an
   * empty string to clear.
   */
  setActiveInventory(id: InventoryItemId | null): void {
    const manager = tryGetActiveGameStateManager();
    if (!manager) {
      if (import.meta.env.DEV) {
        console.warn(
          '[Benne] B.setActiveInventory called before the game was created — ignored.',
        );
      }
      return;
    }
    manager.setActiveInventoryItem(id);
  }

  /** Current active inventory item id, or `null` when none is set. */
  getActiveInventoryItemId(): InventoryItemId | null {
    return tryGetActiveGameStateManager()?.getActiveInventoryItemId() ?? null;
  }

  /** Convenience for `setActiveInventory(null)`. */
  clearActiveInventory(): void {
    tryGetActiveGameStateManager()?.clearActiveInventoryItem();
  }

  /**
   * Configured verb object for {@link getActiveVerb}, or `null` in implicit walk pointer mode /
   * when nothing is armed.
   */
  get activeVerb(): VerbDefinition | null {
    const id = this.getActiveVerb();
    const trimmed = id?.trim() ?? '';
    if (trimmed.length === 0 || trimmed === WALK_TO_VERB_ID) {
      return null;
    }
    const defs = getEffectiveVerbDefinitions(getGameSettings());
    return defs.find((v) => v.id === trimmed) ?? { id: trimmed };
  }

  /** Registered inventory definition for {@link getActiveInventoryItemId}, or `null`. */
  get activeInventory(): InventoryItemDefinition | null {
    const itemId = this.getActiveInventoryItemId();
    if (itemId == null || itemId.length === 0) {
      return null;
    }
    return getInventoryDefinition(itemId) ?? null;
  }

  /**
   * Subscribe with **`B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, handler)`**
   * (import **`BENNE_VERB_CONTEXT_CHANGED_EVENT`** from **`@engine/scripting`**). Emits whenever active verb,
   * active inventory item, or hover target/description changes. **`RoomScene`** removes all listeners for that
   * event when the scene shuts down (e.g. room change).
   */
  get onVerbContextChanged(): Phaser.Events.EventEmitter {
    return getBenneVerbContextChangedEmitter();
  }

  /**
   * Subscribe with **`B.onSpeechSettingsChanged.on(BENNE_SPEECH_SETTINGS_CHANGED_EVENT, handler)`**
   * (import from **`@engine/scripting`**). Emits when any **`B.speechSettings`** or **`B.dialogSettings`** property is written.
   */
  get onSpeechSettingsChanged(): Phaser.Events.EventEmitter {
    return getBenneSpeechSettingsChangedEmitter();
  }

  /** Verb-line hover description from {@link RoomScene} hit-testing (`null` when none / suppressed). */
  get currentHoverDescription(): string | null {
    return getBenneVerbContextHoverDescription();
  }

  get currentHoverTarget(): VerbHoverTarget | null {
    return getBenneVerbContextHoverTarget();
  }

  protected beginInteraction(): void {
    this.interactionTail = Promise.resolve();
  }

  protected endInteraction(): Promise<void> {
    return this.interactionTail;
  }

  /**
   * Resolves after queued blocking work on this script surface finishes — e.g. `B.inventory.add` without
   * **`.now`**, **`walkTo`**, **`say`** — all appended via {@link chain}.
   */
  waitForInteractionQueue(): Promise<void> {
    return this.interactionTail;
  }

  /**
   * Append async work to the interaction tail (lazy `factory` — see class docstring).
   * Subclasses (e.g. GUI Bennescript) use this for queued tweens.
   */
  protected chain(factory: () => Promise<unknown>): void {
    this.interactionTail = this.interactionTail.then(factory).then(() => undefined);
  }

  /** Paired cleanup for listeners not registered via {@link subscribe} (dispose removes `events.off`/`TimerEvent`, etc.). */
  protected registerDisposable(off: () => void): void {
    this.disposers.push(off);
  }

  protected subscribe(eventId: string, run: (payload: unknown) => void): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        this.pushVerbWalkContext(payload);
        try {
          run(payload);
        } finally {
          this.popVerbWalkContext();
        }
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Like {@link subscribe}, then invokes **`afterTail`** synchronously after the interaction queue drains.
   * Use for follow-ups that must run after queued `walkTo` / `say` steps from **`run`** (e.g. inventory use-on-target activation).
   */
  protected subscribeAfterInteractionTail(
    eventId: string,
    run: (payload: unknown) => void,
    afterTail: () => void,
  ): void {
    const wrapped = async (payload: unknown) => {
      this.beginInteraction();
      try {
        this.pushVerbWalkContext(payload);
        try {
          run(payload);
        } finally {
          this.popVerbWalkContext();
        }
        await this.endInteraction();
        afterTail();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, wrapped);
    this.disposers.push(() => this.events.off(eventId, wrapped));
  }

  /**
   * Clears active inventory + active verb when {@link shouldDropActiveInventoryOnUse} is true for `sourceItemId`.
   * **`doNotClear: true`** skips (per-`whenInventoryUsedOn` handler opt-out).
   */
  protected applyInventoryUseDropPolicyAfterInteraction(
    sourceItemId: string | undefined,
    doNotClear: boolean,
  ): void {
    if (doNotClear) {
      return;
    }
    if (sourceItemId == null) {
      return;
    }
    if (shouldDropActiveInventoryOnUse(sourceItemId)) {
      this.clearActiveInventory();
      this.clearActiveVerb();
    }
  }

  /**
   * Subscribes to room + global inventory-on-target ids. After the handler’s queued steps, the
   * active inventory item **and** the active verb are cleared together according to the **drop policy**,
   * unless the handler delegated to {@link INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT}.
   *
   * **Returning `false` from the payload handler** (“not handled”) re-emits
   * {@link INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT} so `B.whenInventoryOnVerbTargetUnhandled` runs.
   * In that case this subscription’s **`afterTail`** does **not** apply the drop policy (the global
   * listener’s tail owns clearing).
   *
   * - **`doNotClear: true`** — per-handler hard opt-out; never clear here.
   * - Otherwise (and not delegated), consult {@link shouldDropActiveInventoryOnUse} for the payload's `itemId`
   *   (per-item **`dropWhenUsed`** → global **`dropWhenInventoryUsed`** → default **`false`**).
   *
   * Synchronous clearing for dispatch with **no scoped listeners** remains in `RoomScene` / `buildGuiOverlay`.
   */
  protected subscribeInventoryUsedOnTargetEvents(
    roomEventId: string,
    globalEventId: string,
    handler:
      | ((p: AnyInventoryUsedOnPayload) => void | false)
      | (() => void),
    doNotClear: boolean,
  ): void {
    let lastPayload: AnyInventoryUsedOnPayload | null = null;
    let delegatedToGlobalUnhandled = false;
    const run = (payload: unknown): void => {
      delegatedToGlobalUnhandled = false;
      const p = payload as AnyInventoryUsedOnPayload;
      lastPayload = p;
      if (handler.length === 0) {
        (handler as () => void)();
      } else {
        const result = (handler as (x: AnyInventoryUsedOnPayload) => void | false)(p);
        if (result === false) {
          delegatedToGlobalUnhandled = true;
          this.events.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, p);
        }
      }
    };
    const afterTail = (): void => {
      if (delegatedToGlobalUnhandled) {
        return;
      }
      this.applyInventoryUseDropPolicyAfterInteraction(lastPayload?.itemId, doNotClear);
    };
    this.subscribeAfterInteractionTail(roomEventId, run, afterTail);
    this.subscribeAfterInteractionTail(globalEventId, run, afterTail);
  }

  /**
   * Like {@link subscribe}, but the handler runs **synchronously** and never awaits the interaction tail.
   * Use for high-frequency events (e.g. GUI pointer hover) that must not serialize behind queued tweens.
   */
  protected subscribeImmediate(eventId: string, run: () => void): void {
    const fn = (): void => {
      try {
        run();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, fn);
    this.disposers.push(() => this.events.off(eventId, fn));
  }

  /**
   * Like {@link subscribeImmediate}, but forwards the event payload to `run`.
   * Use for high-frequency handlers that need event data (e.g. slider value changes).
   */
  protected subscribeImmediateWithPayload(eventId: string, run: (payload: unknown) => void): void {
    const fn = (payload: unknown): void => {
      try {
        run(payload);
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} handler:`, err);
      }
    };
    this.events.on(eventId, fn);
    this.disposers.push(() => this.events.off(eventId, fn));
  }

  /**
   * Maps a Bennescript alias to the first matching `verbs[].id` from `game-config.json`.
   */
  protected resolveVerbId(alias: VerbAlias): string {
    const settings = getGameSettings();
    const configured = new Set(getEffectiveVerbDefinitions(settings).map((v) => v.id));
    const candidates = VERB_ALIAS_CANDIDATES[alias];
    for (const id of candidates) {
      if (configured.has(id)) {
        return id;
      }
    }
    const warnKey = alias;
    if (!BenneScriptCore.unresolvedVerbWarnings.has(warnKey)) {
      BenneScriptCore.unresolvedVerbWarnings.add(warnKey);
      console.warn(
        `[Benne] No verb in game-config matches alias "${alias}" (tried: ${candidates.join(', ')}). ` +
          `Handlers register under id "${alias}". Add a matching verb to game-config.json.`,
      );
    }
    return alias;
  }

  protected applySayLineDirectionalBase(
    scene: RoomScene,
    characterDefinitionId: string,
    baseName: 'Talk' | 'Idle',
  ): void {
    const sprite = scene.getCharacterSprite(characterDefinitionId);
    if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
      return;
    }
    if (getCharacterAnimationOverrideTag(sprite)) {
      if (baseName === 'Talk') {
        return;
      }
      applyCharacterEffectiveAnimation(sprite);
      return;
    }
    const facing: CharacterFacing =
      (sprite.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(sprite);
    playDirectionalAnimation(sprite, baseName, facing);
  }

  /**
   * One scripted dialog line through completion (overlay + input suppression), for **`say`** sequencing.
   */
  protected createSayLinePromise(
    scene: RoomScene,
    line: string,
    talkCharacterDefinitionId: string,
    options?: BenneScriptSayLineOptions,
    voiceStem?: string | null,
  ): Promise<void> {
    // A skipped cutscene plays no lines: no overlay, no voice, no timer — the end state of a
    // say line is simply "line finished".
    if (scene.isCutsceneSkipFastForwarding()) {
      return Promise.resolve();
    }
    const manager = resolveGameStateManager(scene.game);
    const speech = getSpeechSettings(manager);
    const voice = voiceStem ? tryGetBenneSoundManager(scene.game)?.playVoice(voiceStem) ?? null : null;
    const textMs = computeSpeechLineDurationMs(line, manager);
    const ms =
      voice?.durationMs == null
        ? textMs
        : Math.round(Math.min(speech.maxDurationMs, Math.max(speech.minDurationMs, voice.durationMs)));
    const lineOpt = options?.clickToSkip;
    const allowClickToSkip =
      lineOpt === true || (lineOpt !== false && speech.clickToSkip);

    return new Promise<void>((resolve) => {
      let completed = false;
      let timer: Phaser.Time.TimerEvent | null = null;
      let unregisterSkipFinisher: (() => void) | null = null;

      const finish = (): void => {
        if (completed) {
          return;
        }
        completed = true;
        unregisterSkipFinisher?.();
        unregisterSkipFinisher = null;
        voice?.stop();
        timer?.remove(false);
        timer = null;
        scene.clearScriptedDialogClickToSkip();
        this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Idle');
        scene.setDialogTextOverlay({ visible: false });
        scene.popScriptedDialogInputSuppression();
        resolve();
      };

      scene.interruptCharacterWalkForScriptedSpeech(talkCharacterDefinitionId);
      scene.pushScriptedDialogInputSuppression();
      scene.setDialogTextOverlay({
        visible: true,
        text: line,
        talkCharacterDefinitionId,
      });
      this.applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Talk');

      timer = scene.time.delayedCall(ms, finish);
      // ESC ends the line the same way its timer would, whatever the per-line click-to-skip setting.
      unregisterSkipFinisher = scene.registerCutsceneSkipFinisher(finish);

      if (allowClickToSkip) {
        scene.setScriptedDialogClickToSkip(() => {
          timer?.remove(false);
          timer = null;
          finish();
        });
      }
    });
  }

  /**
   * Display Text overlay — click anywhere to dismiss (no timer), same scripted-input suppression as **`say`**.
   */
  protected createDisplayTextPromise(scene: RoomScene, line: string): Promise<void> {
    // A skipped cutscene shows no narration; the end state is simply "dismissed".
    if (scene.isCutsceneSkipFastForwarding()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let completed = false;
      let unregisterSkipFinisher: (() => void) | null = null;

      const finish = (): void => {
        if (completed) {
          return;
        }
        completed = true;
        unregisterSkipFinisher?.();
        unregisterSkipFinisher = null;
        scene.clearScriptedDialogClickToSkip();
        scene.setDisplayTextOverlay({ visible: false });
        scene.popScriptedDialogInputSuppression();
        resolve();
      };

      scene.pushScriptedDialogInputSuppression();
      scene.setDisplayTextOverlay({ visible: true, text: line });
      scene.setScriptedDialogClickToSkip(finish);
      unregisterSkipFinisher = scene.registerCutsceneSkipFinisher(finish);
    });
  }

  protected queueSayDialogWithInputLock(
    scene: RoomScene,
    line: string,
    talkCharacterDefinitionId: string,
    chain: boolean,
    options?: BenneScriptSayLineOptions,
    voiceStem?: string | null,
  ): void {
    if (chain) {
      this.chain(() =>
        this.createSayLinePromise(scene, line, talkCharacterDefinitionId, options, voiceStem),
      );
    } else {
      void this.createSayLinePromise(scene, line, talkCharacterDefinitionId, options, voiceStem);
    }
  }

  private static warnSayDialogueNoRoomOnce(): void {
    if (!import.meta.env.DEV || BenneScriptCore.warnedSayDialogueNoRoomScene) {
      return;
    }
    BenneScriptCore.warnedSayDialogueNoRoomScene = true;
    console.warn('[Benne] B.say`…`: RoomScene is not active — ignored.');
  }

  private static warnDisplayDialogueNoRoomOnce(): void {
    if (!import.meta.env.DEV || BenneScriptCore.warnedDisplayDialogueNoRoomScene) {
      return;
    }
    BenneScriptCore.warnedDisplayDialogueNoRoomScene = true;
    console.warn('[Benne] B.display: RoomScene is not active — ignored.');
  }

  /**
   * Parses **`Speaker: text`** lines; throws on unknown speaker (free) or mismatched speaker (fixed).
   * Non-**`Player`** names match spawned character ids **case-insensitively** (resolved to the room’s canonical id).
   */
  protected parseDialogueLines(
    body: string,
    scope: BenneSayDialogueScope,
    scene: RoomScene,
  ): ReadonlyArray<{ definitionId: string; text: string }> {
    const rows = body.split(/\r?\n/);
    const out: Array<{ definitionId: string; text: string }> = [];

    const spawnedIds = scene.getSpawnedCharacterDefinitionIds();
    const spawnedByLower = new Map<string, string>();
    for (const id of spawnedIds) {
      const k = id.toLowerCase();
      if (!spawnedByLower.has(k)) {
        spawnedByLower.set(k, id);
      }
    }

    const unknownSpeakerMessage = (label: string): string => {
      const hint = spawnedIds.length ? spawnedIds.join(', ') : '(no spawned characters)';
      return (
        `[Benne] say: unknown speaker "${label}" — not spawned in this room. ` +
        `Known ids (case-insensitive): ${hint} (use "Player" for the protagonist).`
      );
    };

    const resolveLabel = (label: string): string => {
      const t = label.trim();
      if (!t) {
        throw new Error('[Benne] say: empty speaker name before ":".');
      }
      if (t.toLowerCase() === 'player') {
        return scene.getActivePlayerCharacterId();
      }
      const canon = spawnedByLower.get(t.toLowerCase());
      if (canon == null) {
        throw new Error(unknownSpeakerMessage(t));
      }
      return canon;
    };

    for (const rawLine of rows) {
      const decommented = stripTrailingLineComment(rawLine);
      const trimmed = decommented.trim();
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }

      if (scope.mode === 'free') {
        const colon = trimmed.indexOf(':');
        if (colon < 0) {
          throw new Error(
            `[Benne] say: expected "Speaker: text" per line — missing ":" in ${JSON.stringify(trimmed)}.`,
          );
        }
        const speakerLabel = trimmed.slice(0, colon).trim();
        const text = trimmed.slice(colon + 1).trim();
        if (!text) {
          continue;
        }
        out.push({ definitionId: resolveLabel(speakerLabel), text });
      } else {
        const fixedId = scope.definitionId;
        const colon = trimmed.indexOf(':');
        if (colon < 0) {
          out.push({ definitionId: fixedId, text: trimmed });
        } else {
          const speakerLabel = trimmed.slice(0, colon).trim();
          const text = trimmed.slice(colon + 1).trim();
          if (!text) {
            continue;
          }
          const id = resolveLabel(speakerLabel);
          if (id.toLowerCase() !== fixedId.toLowerCase()) {
            throw new Error(
              `[Benne] say: line attributes speech to "${speakerLabel.trim()}" but this block is scoped to "${fixedId}". ` +
                `Omit the "Name:" prefix or use only that speaker (matching is case-insensitive).`,
            );
          }
          out.push({ definitionId: id, text });
        }
      }
    }

    return out;
  }

  protected runDialogueFromTaggedTemplate(
    strings: TemplateStringsArray,
    exprValues: readonly unknown[],
    scope: BenneSayDialogueScope,
    chain: boolean,
    scene: RoomScene,
    logLine: (text: string) => void,
  ): void {
    const cooked = cookTaggedTemplateStrings(strings, exprValues);
    const entries = this.parseDialogueLines(cooked, scope, scene);
    if (entries.length === 0) {
      return;
    }
    if (chain) {
      for (const { definitionId, text } of entries) {
        const runtimeLine = resolveBenneSayRuntimeLine(text, definitionId);
        logLine(runtimeLine.text);
        this.chain(() =>
          this.createSayLinePromise(
            scene,
            runtimeLine.text,
            definitionId,
            undefined,
            runtimeLine.voiceStem,
          ),
        );
      }
      return;
    }
    if (entries.length === 1) {
      const only = entries[0]!;
      const runtimeLine = resolveBenneSayRuntimeLine(only.text, only.definitionId);
      logLine(runtimeLine.text);
      this.queueSayDialogWithInputLock(
        scene,
        runtimeLine.text,
        only.definitionId,
        false,
        undefined,
        runtimeLine.voiceStem,
      );
      return;
    }
    void (async () => {
      for (const { definitionId, text } of entries) {
        const runtimeLine = resolveBenneSayRuntimeLine(text, definitionId);
        logLine(runtimeLine.text);
        await this.createSayLinePromise(
          scene,
          runtimeLine.text,
          definitionId,
          undefined,
          runtimeLine.voiceStem,
        );
      }
    })();
  }

  private createFreeScopeSayDialogue(): BenneScriptSayDialogueTagged {
    const run = (strings: TemplateStringsArray, ...exprValues: unknown[]): void => {
      const scene = this.getPlayerWalkRoomScene();
      if (!scene) {
        BenneScriptCore.warnSayDialogueNoRoomOnce();
        return;
      }
      this.runDialogueFromTaggedTemplate(strings, exprValues, { mode: 'free' }, true, scene, () => {});
    };
    const runNow = (strings: TemplateStringsArray, ...exprValues: unknown[]): void => {
      const scene = this.getPlayerWalkRoomScene();
      if (!scene) {
        BenneScriptCore.warnSayDialogueNoRoomOnce();
        return;
      }
      this.runDialogueFromTaggedTemplate(strings, exprValues, { mode: 'free' }, false, scene, () => {});
    };
    return Object.assign(run, { now: runNow }) as BenneScriptSayDialogueTagged;
  }

  protected composeFixedCharacterSayHybrid(
    scene: RoomScene,
    definitionId: string,
    logSay: (line: string) => void,
  ): BenneScriptSayDialogueHybrid {
    const scope: BenneSayDialogueScope = { mode: 'fixed', definitionId };
    const runStr = (line: string, opts: BenneScriptSayLineOptions | undefined, chain: boolean): void => {
      const runtimeLine = resolveBenneSayRuntimeLine(line, definitionId);
      logSay(runtimeLine.text);
      this.queueSayDialogWithInputLock(
        scene,
        runtimeLine.text,
        definitionId,
        chain,
        opts,
        runtimeLine.voiceStem,
      );
    };
    const blocking = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      if (isTemplateStringsArray(first)) {
        this.runDialogueFromTaggedTemplate(first, rest, scope, true, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, true);
      }
    };
    const now = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      if (isTemplateStringsArray(first)) {
        this.runDialogueFromTaggedTemplate(first, rest, scope, false, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, false);
      }
    };
    return Object.assign(blocking, { now }) as BenneScriptSayDialogueHybrid;
  }

  /**
   * Like {@link composeFixedCharacterSayHybrid} but resolves **`RoomScene`** on each call (dialog / global / GUI).
   */
  protected composeFixedCharacterSayHybridLazy(
    getScene: () => RoomScene | undefined,
    definitionId: string,
    logSay: (line: string) => void,
    warnNoRoom: () => void,
  ): BenneScriptSayDialogueHybrid {
    const scope: BenneSayDialogueScope = { mode: 'fixed', definitionId };
    const runStr = (line: string, opts: BenneScriptSayLineOptions | undefined, chain: boolean): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      const runtimeLine = resolveBenneSayRuntimeLine(line, definitionId);
      logSay(runtimeLine.text);
      this.queueSayDialogWithInputLock(
        scene,
        runtimeLine.text,
        definitionId,
        chain,
        opts,
        runtimeLine.voiceStem,
      );
    };
    const blocking = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      if (isTemplateStringsArray(first)) {
        this.runDialogueFromTaggedTemplate(first, rest, scope, true, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, true);
      }
    };
    const now = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      if (isTemplateStringsArray(first)) {
        this.runDialogueFromTaggedTemplate(first, rest, scope, false, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, false);
      }
    };
    return Object.assign(blocking, { now }) as BenneScriptSayDialogueHybrid;
  }

  protected composeFixedPlayerSayHybridLazy(
    getScene: () => RoomScene | undefined,
    logSay: (line: string) => void,
    warnNoRoom: () => void,
  ): BenneScriptSayDialogueHybrid {
    const runStr = (line: string, opts: BenneScriptSayLineOptions | undefined, chain: boolean): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      const pid = scene.getActivePlayerCharacterId();
      const runtimeLine = resolveBenneSayRuntimeLine(line, pid);
      logSay(runtimeLine.text);
      this.queueSayDialogWithInputLock(
        scene,
        runtimeLine.text,
        pid,
        chain,
        opts,
        runtimeLine.voiceStem,
      );
    };
    const blocking = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      if (isTemplateStringsArray(first)) {
        const scope: BenneSayDialogueScope = {
          mode: 'fixed',
          definitionId: scene.getActivePlayerCharacterId(),
        };
        this.runDialogueFromTaggedTemplate(first, rest, scope, true, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, true);
      }
    };
    const now = (first: string | TemplateStringsArray, ...rest: unknown[]): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      if (isTemplateStringsArray(first)) {
        const scope: BenneSayDialogueScope = {
          mode: 'fixed',
          definitionId: scene.getActivePlayerCharacterId(),
        };
        this.runDialogueFromTaggedTemplate(first, rest, scope, false, scene, logSay);
      } else {
        runStr(first as string, rest[0] as BenneScriptSayLineOptions | undefined, false);
      }
    };
    return Object.assign(blocking, { now }) as BenneScriptSayDialogueHybrid;
  }

  /**
   * Shared speech GUI positioning methods for {@link makePlayerFacadeFromScene} and
   * {@link makeCharacterFacadeLazy}.
   */
  private makeCharacterSpeechPositionMethods(
    getScene: () => RoomScene | undefined,
    definitionId: string,
    warnNoRoom: () => void,
  ): Pick<
    BenneScriptCharacterFacade,
    'setSpeechPosition' | 'setSpeechOffset' | 'resetSpeechPosition'
  > {
    const applySpeechPosition = (x: number, y: number): void => {
      const scene = getScene();
      if (scene) {
        scene.setCharacterScriptSpeechPosition(definitionId, x, y);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writeSavedCharacterSpeechPosition(mgr, definitionId, { x, y });
        return;
      }
      warnNoRoom();
    };

    const applySpeechOffset = (x: number, y: number): void => {
      const scene = getScene();
      if (scene) {
        scene.setCharacterScriptSpeechOffset(definitionId, x, y);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writeSavedCharacterSpeechOffset(mgr, definitionId, { x, y });
        return;
      }
      warnNoRoom();
    };

    const applyResetSpeechPosition = (): void => {
      const scene = getScene();
      if (scene) {
        scene.resetCharacterScriptSpeechPosition(definitionId);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        clearSavedCharacterSpeechPosition(mgr, definitionId);
        return;
      }
      warnNoRoom();
    };

    return {
      setSpeechPosition: withNow(
        (x: number, y: number) => {
          this.chain(() => {
            applySpeechPosition(x, y);
            return Promise.resolve();
          });
        },
        applySpeechPosition,
      ),
      setSpeechOffset: withNow(
        (x: number, y: number) => {
          this.chain(() => {
            applySpeechOffset(x, y);
            return Promise.resolve();
          });
        },
        applySpeechOffset,
      ),
      resetSpeechPosition: withNow(
        () => {
          this.chain(() => {
            applyResetSpeechPosition();
            return Promise.resolve();
          });
        },
        applyResetSpeechPosition,
      ),
    };
  }

  private makeDynamicCharacterSpeechPositionMethods(
    getScene: () => RoomScene | undefined,
    getDefinitionId: () => string,
    warnNoRoom: () => void,
  ): Pick<
    BenneScriptCharacterFacade,
    'setSpeechPosition' | 'setSpeechOffset' | 'resetSpeechPosition'
  > {
    const applySpeechPosition = (x: number, y: number): void => {
      const definitionId = getDefinitionId();
      const scene = getScene();
      if (scene) {
        scene.setCharacterScriptSpeechPosition(definitionId, x, y);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writeSavedCharacterSpeechPosition(mgr, definitionId, { x, y });
        return;
      }
      warnNoRoom();
    };

    const applySpeechOffset = (x: number, y: number): void => {
      const definitionId = getDefinitionId();
      const scene = getScene();
      if (scene) {
        scene.setCharacterScriptSpeechOffset(definitionId, x, y);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        writeSavedCharacterSpeechOffset(mgr, definitionId, { x, y });
        return;
      }
      warnNoRoom();
    };

    const applyResetSpeechPosition = (): void => {
      const definitionId = getDefinitionId();
      const scene = getScene();
      if (scene) {
        scene.resetCharacterScriptSpeechPosition(definitionId);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        clearSavedCharacterSpeechPosition(mgr, definitionId);
        return;
      }
      warnNoRoom();
    };

    return {
      setSpeechPosition: withNow(
        (x: number, y: number) => {
          this.chain(() => {
            applySpeechPosition(x, y);
            return Promise.resolve();
          });
        },
        applySpeechPosition,
      ),
      setSpeechOffset: withNow(
        (x: number, y: number) => {
          this.chain(() => {
            applySpeechOffset(x, y);
            return Promise.resolve();
          });
        },
        applySpeechOffset,
      ),
      resetSpeechPosition: withNow(
        () => {
          this.chain(() => {
            applyResetSpeechPosition();
            return Promise.resolve();
          });
        },
        applyResetSpeechPosition,
      ),
    };
  }

  /**
   * Shared with {@link import('./GlobalBenneScript.js').GlobalBenneScript} so global handlers can use **`B.player.say`**
   * (resolves the room scene on each call).
   */
  protected makePlayerFacadeFromScene(resolveScene: () => RoomScene | null | undefined): BenneScriptPlayerFacade {
    const core = this;
    const getScene = (): RoomScene | undefined => resolveScene() ?? undefined;

    const warnNoRoom = (): void => {
      if (import.meta.env.DEV && !BenneScriptCore.warnedPlayerFacadeNoRoomScene) {
        BenneScriptCore.warnedPlayerFacadeNoRoomScene = true;
        console.warn('[Benne] B.player used while RoomScene is not active — ignored.');
      }
    };

    const activePlayerId = (): CharacterId => {
      const scene = getScene();
      if (scene) {
        return scene.getActivePlayerCharacterId() as CharacterId;
      }
      const mgr = tryGetActiveGameStateManager();
      return (mgr?.getActivePlayerCharacterId() ?? getStartingPlayerCharacterId()) as CharacterId;
    };

    const runSwitchPlayer = (characterId: CharacterId): void => {
      const scene = getScene();
      if (scene) {
        scene.switchPlayerCharacter(characterId);
        return;
      }
      const mgr = tryGetActiveGameStateManager();
      if (mgr) {
        mgr.setActivePlayerCharacterId(characterId);
        return;
      }
      warnNoRoom();
    };

    const runPlayerFace = (direction: CharacterFacingLetter): void => {
      const scene = getScene();
      if (!scene) {
        return;
      }
      scene.facePlayerScriptDirection(direction);
    };

    const logPlayerSay = (line: string): void => {
      console.log(`[Player] ${line}`);
    };

    const walkPlayerWithNow = withNow(
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        core.chain(() => scene.walkPlayerTo(target));
      },
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        void scene.walkPlayerTo(target);
      },
    );
    const moveToTeleport = withNow(
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        core.chain(() => {
          scene.movePlayerToNow(target);
          return Promise.resolve();
        });
      },
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.movePlayerToNow(target);
      },
    );
    return {
      sound: core.sound,
      video: core.video,
      get id() {
        return activePlayerId();
      },
      switchTo: withNow(
        (characterId: CharacterId) => {
          core.chain(() => {
            runSwitchPlayer(characterId);
            return Promise.resolve();
          });
        },
        runSwitchPlayer,
      ),
      switchToNow(characterId: CharacterId): void {
        runSwitchPlayer(characterId);
      },
      walkTo: walkPlayerWithNow,
      moveTo: moveToTeleport,
      moveToNow: (target: Point2 | ResolvableTargetId) => {
        moveToTeleport.now(target);
      },
      walkToClicked: withNow(
        () => core.performWalkToClicked(true),
        () => core.performWalkToClicked(false),
      ),
      faceClicked: withNow(
        () => core.performFaceClicked(true),
        () => core.performFaceClicked(false),
      ),
      playAnimation: withNow(
        (tag: string) => {
          core.chain(() => {
            const scene = getScene();
            if (!scene) {
              warnNoRoom();
              return Promise.resolve();
            }
            return scene.playCharacterScriptAnimationOneShot(activePlayerId(), tag);
          });
        },
        (tag: string) => {
          const scene = getScene();
          if (scene) {
            void scene.playCharacterScriptAnimationOneShot(activePlayerId(), tag);
          }
        },
      ),
      say: core.composeFixedPlayerSayHybridLazy(getScene, logPlayerSay, warnNoRoom),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          core.chain(() => {
            runPlayerFace(direction);
            return Promise.resolve();
          });
        },
        runPlayerFace,
      ),
      get animation() {
        const scene = getScene();
        return scene ? scene.getCharacterScriptEffectiveAnimationTag(activePlayerId()) : '';
      },
      set animation(tag: string | null) {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
          } else {
            scene.setCharacterScriptAnimationOverride(activePlayerId(), tag);
          }
          return Promise.resolve();
        });
      },
      animationNow(tag: string | null): void {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.setCharacterScriptAnimationOverride(activePlayerId(), tag);
      },
      stopAnimation(): void {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.stopCharacterScriptAnimation(activePlayerId());
      },
      get movable() {
        const scene = getScene();
        const pid = activePlayerId();
        if (scene) {
          return scene.getCharacterScriptMovable(pid);
        }
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterMovable(mgr, pid, true) : true;
      },
      set movable(v: boolean) {
        core.chain(() => {
          const scene = getScene();
          const pid = activePlayerId();
          if (scene) {
            scene.setCharacterScriptMovable(pid, v);
          } else {
            const mgr = tryGetActiveGameStateManager();
            if (mgr) {
              writeSavedCharacterMovable(mgr, pid, v);
            } else {
              warnNoRoom();
            }
          }
          return Promise.resolve();
        });
      },
      startFollowingCharacter(
        targetId: CharacterId | 'player',
        options?: CharacterFollowOptions,
      ): void {
        core.chain(() => {
          const scene = getScene();
          const mgr = tryGetActiveGameStateManager();
          const pid = activePlayerId();
          if (scene) {
            scene.startCharacterFollowingCharacter(pid, targetId, options);
          } else if (mgr) {
            applyPersistedCharacterFollowFromScript(mgr, pid, targetId, options);
          } else {
            warnNoRoom();
          }
          return Promise.resolve();
        });
      },
      stopFollowingCharacter(): void {
        core.chain(() => {
          const scene = getScene();
          const mgr = tryGetActiveGameStateManager();
          const pid = activePlayerId();
          if (scene) {
            scene.stopCharacterFollowingCharacter(pid);
          } else if (mgr) {
            clearSavedCharacterFollowState(mgr, pid);
          } else {
            warnNoRoom();
          }
          return Promise.resolve();
        });
      },
      get isFollowing() {
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterFollowingTarget(mgr, activePlayerId()) != null : false;
      },
      get followingTarget() {
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterFollowingTarget(mgr, activePlayerId()) : null;
      },
      inventory: createLazyBenneScriptInventoryNamespace(
        () => tryGetActiveGameStateManager(),
        getScene,
        (factory) => core.chain(factory),
      ),
      ...this.makeDynamicCharacterSpeechPositionMethods(getScene, activePlayerId, warnNoRoom),
    } as BenneScriptPlayerFacade;
  }

  /**
   * Movement / speech / facing for an NPC **spawned in the active room**, resolved via the same
   * **`getPlayerWalkRoomScene`** hook as **`B.player`** (room/character/inventory pass a stable
   * **`() => this.roomScene`** closure; dialog/global/gui pass **`() => game.scene.getScene(SCENE_ROOM)`**).
   * **`description`** still persists to **`GameStateManager`** when a manager is active even if
   * **`RoomScene`** is not resolved yet.
   */
  character(definitionId: CharacterId): BenneScriptCharacterFacade {
    return this.makeCharacterFacadeLazy(() => this.getPlayerWalkRoomScene(), definitionId);
  }

  private makeCharacterFacadeLazy(
    getScene: () => RoomScene | undefined,
    definitionId: string,
  ): BenneScriptCharacterFacade {
    const core = this;
    const warnNoRoom = (): void => {
      if (import.meta.env.DEV && !BenneScriptCore.warnedCharacterFacadeNoRoomScene) {
        BenneScriptCore.warnedCharacterFacadeNoRoomScene = true;
        console.warn('[Benne] B.character used while RoomScene is not active — ignored.');
      }
    };
    const logCharacterSay = (line: string): void => {
      console.log(`[Character ${definitionId}] ${line}`);
    };
    const runCharacterFace = (direction: CharacterFacingLetter): void => {
      const scene = getScene();
      if (!scene) {
        warnNoRoom();
        return;
      }
      scene.faceCharacterScriptDirection(definitionId, direction);
    };
    const walkCharacterWithNow = withNow(
      (target: Point2 | ResolvableTargetId) => {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return Promise.resolve();
          }
          return scene.walkCharacterTo(definitionId, target);
        });
      },
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        void scene.walkCharacterTo(definitionId, target);
      },
    );
    const moveToTeleport = withNow(
      (target: Point2 | ResolvableTargetId) => {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return Promise.resolve();
          }
          scene.moveCharacterToNow(definitionId, target);
          return Promise.resolve();
        });
      },
      (target: Point2 | ResolvableTargetId) => {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.moveCharacterToNow(definitionId, target);
      },
    );
    return {
      sound: core.sound,
      video: core.video,
      walkTo: walkCharacterWithNow,
      moveTo: moveToTeleport,
      moveToNow: (target: Point2 | ResolvableTargetId) => {
        moveToTeleport.now(target);
      },
      hide: withNow(
        () => {
          core.chain(() => {
            const scene = getScene();
            if (scene) {
              scene.setCharacterScriptVisible(definitionId, false);
            } else {
              const mgr = tryGetActiveGameStateManager();
              if (mgr) {
                writeSavedCharacterVisible(mgr, definitionId, false);
              } else {
                warnNoRoom();
              }
            }
            return Promise.resolve();
          });
        },
        () => {
          const scene = getScene();
          if (scene) {
            scene.setCharacterScriptVisible(definitionId, false);
            return;
          }
          const mgr = tryGetActiveGameStateManager();
          if (mgr) {
            writeSavedCharacterVisible(mgr, definitionId, false);
            return;
          }
          warnNoRoom();
        },
      ),
      show: withNow(
        () => {
          core.chain(() => {
            const scene = getScene();
            if (scene) {
              scene.setCharacterScriptVisible(definitionId, true);
            } else {
              const mgr = tryGetActiveGameStateManager();
              if (mgr) {
                writeSavedCharacterVisible(mgr, definitionId, true);
              } else {
                warnNoRoom();
              }
            }
            return Promise.resolve();
          });
        },
        () => {
          const scene = getScene();
          if (scene) {
            scene.setCharacterScriptVisible(definitionId, true);
            return;
          }
          const mgr = tryGetActiveGameStateManager();
          if (mgr) {
            writeSavedCharacterVisible(mgr, definitionId, true);
            return;
          }
          warnNoRoom();
        },
      ),
      get visible() {
        const scene = getScene();
        if (scene) {
          return scene.getCharacterScriptVisible(definitionId);
        }
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterVisible(mgr, definitionId, true) : true;
      },
      set visible(v: boolean) {
        core.chain(() => {
          const scene = getScene();
          if (scene) {
            scene.setCharacterScriptVisible(definitionId, v);
          } else {
            const mgr = tryGetActiveGameStateManager();
            if (mgr) {
              writeSavedCharacterVisible(mgr, definitionId, v);
            } else {
              warnNoRoom();
            }
          }
          return Promise.resolve();
        });
      },
      visibleNow(v: boolean): void {
        const scene = getScene();
        if (scene) {
          scene.setCharacterScriptVisible(definitionId, v);
          return;
        }
        const mgr = tryGetActiveGameStateManager();
        if (mgr) {
          writeSavedCharacterVisible(mgr, definitionId, v);
          return;
        }
        warnNoRoom();
      },
      get animation() {
        const scene = getScene();
        return scene ? scene.getCharacterScriptEffectiveAnimationTag(definitionId) : '';
      },
      set animation(tag: string | null) {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
          } else {
            scene.setCharacterScriptAnimationOverride(definitionId, tag);
          }
          return Promise.resolve();
        });
      },
      animationNow(tag: string | null): void {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.setCharacterScriptAnimationOverride(definitionId, tag);
      },
      playAnimation: withNow(
        (tag: string) => {
          core.chain(() => {
            const scene = getScene();
            if (!scene) {
              warnNoRoom();
              return Promise.resolve();
            }
            return scene.playCharacterScriptAnimationOneShot(definitionId, tag);
          });
        },
        (tag: string) => {
          const scene = getScene();
          if (scene) {
            void scene.playCharacterScriptAnimationOneShot(definitionId, tag);
          }
        },
      ),
      stopAnimation(): void {
        const scene = getScene();
        if (!scene) {
          warnNoRoom();
          return;
        }
        scene.stopCharacterScriptAnimation(definitionId);
      },
      say: core.composeFixedCharacterSayHybridLazy(getScene, definitionId, logCharacterSay, warnNoRoom),
      face: withNow(
        (direction: CharacterFacingLetter) => {
          core.chain(() => {
            runCharacterFace(direction);
            return Promise.resolve();
          });
        },
        runCharacterFace,
      ),
      startFacingCharacter(character: CharacterId, minWaitTime?: number, maxWaitTime?: number): void {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return Promise.resolve();
          }
          scene.startCharacterFacingCharacter(
            definitionId,
            character,
            minWaitTime ?? 0.2,
            maxWaitTime ?? 0.4,
          );
          return Promise.resolve();
        });
      },
      stopFacingCharacter(): void {
        core.chain(() => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return Promise.resolve();
          }
          scene.stopCharacterFacingCharacter(definitionId);
          return Promise.resolve();
        });
      },
      fade: withNow(
        (fromAlpha: number, toAlpha: number, durationSeconds: number) => {
          core.chain(() => {
            const scene = getScene();
            if (!scene) {
              warnNoRoom();
              return Promise.resolve();
            }
            return scene.fadeCharacterScriptAlpha(definitionId, fromAlpha, toAlpha, durationSeconds);
          });
        },
        (fromAlpha: number, toAlpha: number, durationSeconds: number) => {
          const scene = getScene();
          if (!scene) {
            warnNoRoom();
            return;
          }
          void scene.fadeCharacterScriptAlpha(definitionId, fromAlpha, toAlpha, durationSeconds);
        },
      ),
      get movable() {
        const scene = getScene();
        if (scene) {
          return scene.getCharacterScriptMovable(definitionId);
        }
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterMovable(mgr, definitionId, true) : true;
      },
      set movable(v: boolean) {
        core.chain(() => {
          const scene = getScene();
          if (scene) {
            scene.setCharacterScriptMovable(definitionId, v);
          } else {
            const mgr = tryGetActiveGameStateManager();
            if (mgr) {
              writeSavedCharacterMovable(mgr, definitionId, v);
            } else {
              warnNoRoom();
            }
          }
          return Promise.resolve();
        });
      },
      get clickable() {
        const scene = getScene();
        if (scene) {
          return scene.getCharacterScriptClickable(definitionId);
        }
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterClickable(mgr, definitionId, true) : true;
      },
      set clickable(v: boolean) {
        core.chain(() => {
          const scene = getScene();
          if (scene) {
            scene.setCharacterScriptClickable(definitionId, v);
          } else {
            const mgr = tryGetActiveGameStateManager();
            if (mgr) {
              writeSavedCharacterClickable(mgr, definitionId, v);
            } else {
              warnNoRoom();
            }
          }
          return Promise.resolve();
        });
      },
      get description() {
        const scene = getScene();
        if (scene) {
          return scene.getCharacterScriptDescription(definitionId);
        }
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterDescription(mgr, definitionId, '') : '';
      },
      set description(v: string) {
        const scene = getScene();
        if (scene) {
          scene.setCharacterScriptDescription(definitionId, v);
        } else {
          const mgr = tryGetActiveGameStateManager();
          if (mgr) {
            writeSavedCharacterDescription(mgr, definitionId, v);
          } else {
            warnNoRoom();
          }
        }
      },
      startFollowingCharacter(
        targetId: CharacterId | 'player',
        options?: CharacterFollowOptions,
      ): void {
        core.chain(() => {
          const scene = getScene();
          const mgr = tryGetActiveGameStateManager();
          if (scene) {
            scene.startCharacterFollowingCharacter(definitionId, targetId, options);
          } else if (mgr) {
            applyPersistedCharacterFollowFromScript(mgr, definitionId, targetId, options);
          } else {
            warnNoRoom();
          }
          return Promise.resolve();
        });
      },
      stopFollowingCharacter(): void {
        core.chain(() => {
          const scene = getScene();
          const mgr = tryGetActiveGameStateManager();
          if (scene) {
            scene.stopCharacterFollowingCharacter(definitionId);
          } else if (mgr) {
            clearSavedCharacterFollowState(mgr, definitionId);
          } else {
            warnNoRoom();
          }
          return Promise.resolve();
        });
      },
      get isFollowing() {
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterFollowingTarget(mgr, definitionId) != null : false;
      },
      get followingTarget() {
        const mgr = tryGetActiveGameStateManager();
        return mgr ? readSavedCharacterFollowingTarget(mgr, definitionId) : null;
      },
      inventory: createLazyBenneScriptCharacterInventoryNamespace(
        () => tryGetActiveGameStateManager(),
        definitionId,
        (factory) => core.chain(factory),
      ),
      ...this.makeCharacterSpeechPositionMethods(getScene, definitionId, warnNoRoom),
    } as BenneScriptCharacterFacade;
  }
}
