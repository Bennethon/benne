import {
  clearSavedCharacterSpeechPosition,
  readSavedCharacterAlpha,
  readSavedCharacterFollowingTarget,
  readSavedCharacterSpeechOffset,
  readSavedCharacterSpeechPosition,
  writeSavedCharacterAlpha,
  writeSavedCharacterSpeechOffset,
  writeSavedCharacterSpeechPosition,
} from '../benneAnimationRuntime.js';
import { getCharacterWorldFeet } from '../characterFeet.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { BENNE_SCREEN_FADE_DEFAULT_COLOR, BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC } from '../scenes/roomScreenFadeConstants.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playScriptedSayLine,
  resolveBenneSayRuntimeLine,
  type ScriptedSayLineOptions,
} from './speech.js';
import {
  resolveFaceLookWorldFromPayload,
  resolveWalkToClickedTargetFromPayload,
} from './verbClickTarget.js';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { CharacterFollowOptions } from '../../types/characterFollow.js';
import type { Point2 } from '../../types/room.js';
import { currentContext } from './interactionContext.js';
import { lookupCharacterHandle, lookupItemHandle } from './registry.js';
import { liveRoomScene } from './scene.js';
import { Task, timed } from './task.js';
import * as Phaser from 'phaser';

/** Speaker id the transform emits for `Player:` labels: the active player character. */
export const PLAYER_SPEAKER = 'Player';

const warned = new Set<string>();

export function warnOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || warned.has(key)) {
    return;
  }
  warned.add(key);
  console.warn(`[Benne] ${message}`);
}

/** The room the running handler belongs to, else the active room. */
export function activeRoomScene(): RoomScene | undefined {
  return currentContext().scene ?? liveRoomScene();
}

/** The active room, or a one-time DEV warning naming `what`. */
export function roomFor(what: string): RoomScene | undefined {
  const scene = activeRoomScene();
  if (!scene) {
    warnOnce(`${what}:no-room`, `${what}: no active room — ignored.`);
  }
  return scene;
}

function clickedTarget(name: string) {
  const ctx = currentContext();
  const scene = ctx.scene ?? activeRoomScene();
  if (!scene) {
    warnOnce(`${name}:no-room`, `${name}: no active room — ignored.`);
    return null;
  }
  if (ctx.payload == null) {
    warnOnce(`${name}:outside-verb`, `${name} called outside a verb handler — ignored.`);
    return null;
  }
  const walkTarget = resolveWalkToClickedTargetFromPayload(ctx.payload);
  const faceLookWorld = scene.player ? resolveFaceLookWorldFromPayload(ctx.payload, scene) : null;
  return { scene, walkTarget, faceLookWorld };
}

/** A walk of the active player: the interrupt policy's opening walk (§5 rule 9). */
function playerWalkTask(scene: RoomScene, walk: Promise<void>): Task {
  return new Task(walk, { playerWalk: true, cancel: () => scene.interruptPlayerWalk() });
}

/** Walk the player to the clicked thing's walk-to point, then face it. Waits. */
export const walkToClicked = timed((): Task => {
  const clicked = clickedTarget('walkToClicked');
  if (!clicked) {
    return Task.resolved();
  }
  const { scene, walkTarget, faceLookWorld } = clicked;
  if (walkTarget == null) {
    warnOnce('walkToClicked:no-target', 'walkToClicked: this click has no room walk target — ignored.');
    return Task.resolved();
  }
  return playerWalkTask(
    scene,
    scene.walkPlayerTo(walkTarget).then(() => scene.facePlayerTowardClicked(faceLookWorld, walkTarget)),
  );
});

/** Turn the player toward the clicked thing. */
export const faceClicked = timed((): Task => {
  const clicked = clickedTarget('faceClicked');
  if (clicked && (clicked.walkTarget != null || clicked.faceLookWorld != null)) {
    clicked.scene.facePlayerTowardClicked(clicked.faceLookWorld, clicked.walkTarget);
  }
  return Task.resolved({ turn: true });
});

/** Pause for `seconds`. Returns at once in skip mode. */
export const wait = timed((seconds: number): Task => {
  const scene = activeRoomScene();
  if (!scene || scene.isCutsceneSkipFastForwarding()) {
    return Task.resolved();
  }
  let timer: ReturnType<RoomScene['time']['delayedCall']> | null = null;
  const elapsed = new Promise<void>((resolve) => {
    timer = scene.time.delayedCall(Math.max(0, seconds * 1000), () => resolve());
  });
  const stop = () => timer?.remove(false);
  return new Task(elapsed, { finishNow: stop, cancel: stop });
});

/**
 * Waits for a left click (the same click that skips a speech line), or until `timeout` seconds
 * have passed. Works inside cutscenes, where world clicks are otherwise ignored.
 */
export const waitForClick = timed((options: { timeout?: number } = {}): Task => {
  const scene = activeRoomScene();
  if (!scene || scene.isCutsceneSkipFastForwarding()) {
    return Task.resolved();
  }
  let timer: ReturnType<RoomScene['time']['delayedCall']> | null = null;
  let finish!: () => void;
  const clicked = new Promise<void>((resolve) => {
    finish = () => {
      timer?.remove(false);
      timer = null;
      scene.clearScriptedDialogClickToSkipIf(finish);
      resolve();
    };
  });
  scene.setScriptedDialogClickToSkip(finish);
  if (options.timeout != null) {
    timer = scene.time.delayedCall(Math.max(0, options.timeout * 1000), finish);
  }
  return new Task(clicked, { finishNow: finish, cancel: finish });
});

// ─── Speech ──────────────────────────────────────────────────────────────────

/**
 * One speech line. `speakerId` is a character id, or {@link PLAYER_SPEAKER}. The transform emits
 * this for `Hank: "…"` labels with the label already resolved to an id.
 */
export function sayTask(speakerId: string, text: unknown, options?: ScriptedSayLineOptions): Task {
  const scene = activeRoomScene();
  if (!scene) {
    warnOnce('say:no-room', 'say: no active room — ignored.');
    return Task.resolved();
  }
  const playerId = scene.getActivePlayerCharacterId();
  const characterId = speakerId === PLAYER_SPEAKER ? playerId : speakerId;
  const line = resolveBenneSayRuntimeLine(String(text), characterId);
  // One console line per spoken line (the café playthrough reads them).
  console.log(characterId === playerId ? `[Player] ${line.text}` : `[Character ${characterId}] ${line.text}`);
  return new Task(playScriptedSayLine(scene, line.text, characterId, options, line.voiceStem));
}

/** `say` as the transform emits it for labels: one line, waited for. */
export function sayLine(speakerId: string, text: unknown): void {
  return sayTask(speakerId, text).wait();
}

const normalizeLabel = (label: string): string => label.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

/** `Name: text` lines of a `say` block. `//` comments and blank lines are skipped. */
function parseSayBlock(strings: TemplateStringsArray, values: readonly unknown[]): Array<{ label: string; text: string }> {
  let body = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    body += String(values[i]) + (strings[i + 1] ?? '');
  }
  const out: Array<{ label: string; text: string }> = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) {
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) {
      throw new Error(`[Benne] say: expected "Speaker: text" on each line — missing ":" in ${JSON.stringify(line)}.`);
    }
    const text = line.slice(colon + 1).trim();
    if (text) {
      out.push({ label: line.slice(0, colon).trim(), text });
    }
  }
  return out;
}

/**
 * Resolves a block label to a speaker id: the build transform passes the labels it resolved
 * (`speakers`); without it, `Player` and the characters in the room match by normalised id.
 */
function resolveBlockSpeaker(label: string, speakers: Readonly<Record<string, string>> | undefined, scene: RoomScene): string {
  const known = speakers?.[label];
  if (known) {
    return known;
  }
  const wanted = normalizeLabel(label);
  if (wanted === 'player') {
    return PLAYER_SPEAKER;
  }
  const id = scene.getSpawnedCharacterDefinitionIds().find((c) => normalizeLabel(c) === wanted);
  if (!id) {
    throw new Error(`[Benne] say: unknown speaker "${label}".`);
  }
  return id;
}

function sayBlockTask(
  strings: TemplateStringsArray,
  values: readonly unknown[],
  speakers?: Readonly<Record<string, string>>,
): Task {
  const scene = activeRoomScene();
  if (!scene) {
    warnOnce('say:no-room', 'say: no active room — ignored.');
    return Task.resolved();
  }
  const lines = parseSayBlock(strings, values).map((l) => ({ id: resolveBlockSpeaker(l.label, speakers, scene), text: l.text }));
  let stopped = false;
  const run = async () => {
    for (const line of lines) {
      if (stopped) {
        return;
      }
      await sayTask(line.id, line.text).promise;
    }
  };
  // Skip and cancel stop the block; the room dismisses the line on screen itself.
  const stop = () => {
    stopped = true;
  };
  return new Task(run(), { finishNow: stop, cancel: stop });
}

type SayBlock = ((strings: TemplateStringsArray, ...values: unknown[]) => void) & {
  now(strings: TemplateStringsArray, ...values: unknown[]): Task;
};

const sayBlock = (speakers?: Readonly<Record<string, string>>): SayBlock =>
  timed((strings: TemplateStringsArray, ...values: unknown[]) => sayBlockTask(strings, values, speakers)) as SayBlock;

/**
 * A multi-line exchange, one `Speaker: text` line each (§4.2). Speakers are written as in the
 * character JSON (ID or display name, any case). Waits for the last line.
 */
export const say: SayBlock & {
  /** @internal Emitted by the build transform with the speakers it resolved. */
  __withSpeakers(speakers: Readonly<Record<string, string>>): SayBlock;
} = Object.assign(sayBlock(), { __withSpeakers: sayBlock });

/** Narration in the display-text overlay. Waits until clicked away (or skipped). */
export const display = timed((text: string): Task => {
  const scene = roomFor('display');
  // A skipped cutscene shows no narration; the end state is simply "dismissed".
  if (!scene || scene.isCutsceneSkipFastForwarding()) {
    return Task.resolved();
  }
  let finish!: () => void;
  const shown = new Promise<void>((resolve) => {
    let completed = false;
    let unregisterSkip: (() => void) | null = null;
    finish = () => {
      if (completed) {
        return;
      }
      completed = true;
      unregisterSkip?.();
      scene.clearScriptedDialogClickToSkip();
      scene.setDisplayTextOverlay({ visible: false });
      scene.popScriptedDialogInputSuppression();
      resolve();
    };
    scene.pushScriptedDialogInputSuppression();
    scene.setDisplayTextOverlay({ visible: true, text });
    scene.setScriptedDialogClickToSkip(finish);
    unregisterSkip = scene.registerCutsceneSkipFinisher(finish);
  });
  return new Task(shown, { finishNow: finish, cancel: finish });
});

// ─── Screen fades ────────────────────────────────────────────────────────────

function screenFade(toAlpha: number, seconds?: number, color?: number): Task {
  const scene = roomFor(toAlpha > 0 ? 'fadeOut' : 'fadeIn');
  if (!scene) {
    return Task.resolved();
  }
  return new Task(
    scene.queueScreenFadeToAlpha(
      toAlpha,
      seconds ?? BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
      color ?? BENNE_SCREEN_FADE_DEFAULT_COLOR,
    ),
  );
}

/** Fades the screen to `color` (black by default) over `seconds`. Waits. */
export const fadeOut = timed((seconds?: number, color?: number): Task => screenFade(1, seconds, color));

/** Fades the screen back in over `seconds`. Waits. */
export const fadeIn = timed((seconds?: number, color?: number): Task => screenFade(0, seconds, color));

// ─── Characters ──────────────────────────────────────────────────────────────

/** Where to walk: a named room point / thing id, raw room pixels, or a handle with an id. */
export type WalkTarget = Point2 | string | { readonly id: string };

export function walkTargetOf(target: WalkTarget): Point2 | string {
  return typeof target === 'object' && 'id' in target ? target.id : target;
}

/** `characterId`, or the active player when it is `null`. */
function characterIdIn(scene: RoomScene, characterId: string | null): string {
  return characterId ?? scene.getActivePlayerCharacterId();
}

function isPlayerIn(scene: RoomScene, characterId: string | null): boolean {
  return characterId == null || characterId === scene.getActivePlayerCharacterId();
}

/** Walks a character; the active player's walk is a player walk (interrupt policy). */
export function walkCharacterTask(characterId: string | null, target: WalkTarget): Task {
  const scene = roomFor('walkTo');
  if (!scene) {
    return Task.resolved();
  }
  const dest = walkTargetOf(target);
  if (isPlayerIn(scene, characterId)) {
    return playerWalkTask(scene, scene.walkPlayerTo(dest));
  }
  return new Task(scene.walkCharacterTo(characterId!, dest));
}

/**
 * Turns a character. A timed action: turning is instant today, so the task is already done, but
 * scripts wait on it, so a turning animation can be added without changing them (decision 53). A
 * turn leaves the interrupt policy's phase alone (`TaskHooks.turn`).
 */
export function faceCharacterTask(characterId: string | null, direction: CharacterFacingLetter): Task {
  const scene = roomFor('face');
  if (scene) {
    if (isPlayerIn(scene, characterId)) {
      scene.facePlayerScriptDirection(direction);
    } else {
      scene.faceCharacterScriptDirection(characterId!, direction);
    }
  }
  return Task.resolved({ turn: true });
}

/**
 * The operations character handles and `player` share. `characterId` `null` is the active player.
 * Everything here is instant except {@link characterOps.play} and {@link characterOps.fade}, which
 * return their {@link Task}.
 */
export const characterOps = {
  moveTo(characterId: string | null, target: WalkTarget): void {
    const scene = roomFor('moveTo');
    if (!scene) {
      return;
    }
    if (isPlayerIn(scene, characterId)) {
      scene.movePlayerToNow(walkTargetOf(target));
    } else {
      scene.moveCharacterToNow(characterId!, walkTargetOf(target));
    }
  },

  stopWalking(characterId: string | null): void {
    const scene = roomFor('stopWalking');
    if (scene) {
      scene.interruptCharacterWalkForScriptedSpeech(characterIdIn(scene, characterId));
    }
  },

  /** Feet position in room pixels. */
  position(characterId: string | null): Point2 {
    const scene = activeRoomScene();
    const sprite = scene ? scene.getCharacterSprite(characterIdIn(scene, characterId)) : undefined;
    return sprite instanceof Phaser.GameObjects.Sprite ? getCharacterWorldFeet(sprite) : { x: 0, y: 0 };
  },

  play(characterId: string | null, tag: string): Task {
    const scene = roomFor('play');
    return scene ? new Task(scene.playCharacterScriptAnimationOneShot(characterIdIn(scene, characterId), tag)) : Task.resolved();
  },

  fade(characterId: string | null, toAlpha: number, seconds: number): Task {
    const scene = roomFor('fade');
    if (!scene) {
      return Task.resolved();
    }
    const id = characterIdIn(scene, characterId);
    const from = scene.getCharacterSprite(id)?.alpha ?? 1;
    return new Task(scene.fadeCharacterScriptAlpha(id, from, toAlpha, seconds));
  },

  /** The sprite's alpha when spawned, else the saved one (1 by default). */
  getAlpha(characterId: string | null): number {
    const scene = activeRoomScene();
    const id = scene ? characterIdIn(scene, characterId) : (characterId ?? tryGetActiveGameStateManager()?.getActivePlayerCharacterId());
    const sprite = scene && id ? scene.getCharacterSprite(id) : undefined;
    if (sprite) {
      return sprite.alpha;
    }
    const m = tryGetActiveGameStateManager();
    return m && id ? readSavedCharacterAlpha(m, id) : 1;
  },

  /** Sets alpha at once (stopping a running fade) and saves it, spawned or not. */
  setAlpha(characterId: string | null, alpha: number): void {
    const scene = activeRoomScene();
    if (scene) {
      const id = characterIdIn(scene, characterId);
      void scene.fadeCharacterScriptAlpha(id, alpha, alpha, 0);
      return;
    }
    const m = tryGetActiveGameStateManager();
    const id = characterId ?? m?.getActivePlayerCharacterId();
    if (m && id) {
      writeSavedCharacterAlpha(m, id, alpha);
    } else {
      warnOnce('alpha:no-game', 'alpha: the game is not running — ignored.');
    }
  },

  stopAnimation(characterId: string | null): void {
    const scene = roomFor('stopAnimation');
    if (scene) {
      scene.stopCharacterScriptAnimation(characterIdIn(scene, characterId));
    }
  },

  getAnimation(characterId: string | null): string {
    const scene = activeRoomScene();
    return scene ? scene.getCharacterScriptEffectiveAnimationTag(characterIdIn(scene, characterId)) : '';
  },

  setAnimation(characterId: string | null, tag: string | null): void {
    const scene = roomFor('animation');
    if (scene) {
      scene.setCharacterScriptAnimationOverride(characterIdIn(scene, characterId), tag);
    }
  },

  getVisible(characterId: string | null): boolean {
    const scene = activeRoomScene();
    return scene ? scene.getCharacterScriptVisible(characterIdIn(scene, characterId)) : false;
  },

  setVisible(characterId: string | null, visible: boolean): void {
    const scene = roomFor('visible');
    if (scene) {
      scene.setCharacterScriptVisible(characterIdIn(scene, characterId), visible);
    }
  },

  getMovable(characterId: string | null): boolean {
    const scene = activeRoomScene();
    return scene ? scene.getCharacterScriptMovable(characterIdIn(scene, characterId)) : true;
  },

  setMovable(characterId: string | null, movable: boolean): void {
    const scene = roomFor('movable');
    if (scene) {
      scene.setCharacterScriptMovable(characterIdIn(scene, characterId), movable);
    }
  },

  getClickable(characterId: string | null): boolean {
    const scene = activeRoomScene();
    return scene ? scene.getCharacterScriptClickable(characterIdIn(scene, characterId)) : false;
  },

  setClickable(characterId: string | null, clickable: boolean): void {
    const scene = roomFor('clickable');
    if (scene) {
      scene.setCharacterScriptClickable(characterIdIn(scene, characterId), clickable);
    }
  },

  getDescription(characterId: string | null): string {
    const scene = activeRoomScene();
    return scene ? scene.getCharacterScriptDescription(characterIdIn(scene, characterId)) : '';
  },

  setDescription(characterId: string | null, description: string): void {
    const scene = roomFor('description');
    if (scene) {
      scene.setCharacterScriptDescription(characterIdIn(scene, characterId), description);
    }
  },

  startFollowing(characterId: string | null, target: { readonly id: string } | null, options?: CharacterFollowOptions): void {
    const scene = roomFor('startFollowing');
    if (scene) {
      scene.startCharacterFollowingCharacter(characterIdIn(scene, characterId), target?.id ?? 'player', options);
    }
  },

  stopFollowing(characterId: string | null): void {
    const scene = roomFor('stopFollowing');
    if (scene) {
      scene.stopCharacterFollowingCharacter(characterIdIn(scene, characterId));
    }
  },

  /** `target` `null` is the active player. */
  startFacing(characterId: string | null, target: { readonly id: string } | null, options: FacingOptions = {}): void {
    const scene = roomFor('startFacing');
    if (scene) {
      scene.startCharacterFacingCharacter(
        characterIdIn(scene, characterId),
        target?.id ?? scene.getActivePlayerCharacterId(),
        options.minWait,
        options.maxWait,
      );
    }
  },

  stopFacing(characterId: string | null): void {
    const scene = roomFor('stopFacing');
    if (scene) {
      scene.stopCharacterFacingCharacter(characterIdIn(scene, characterId));
    }
  },

  /** `characterId` `null` is the active player; outside a room the game state's player. */
  idOf(characterId: string | null): string {
    return characterId ?? player.id;
  },

  /** The handle `characterId` follows: the room's (or `characters.x`), `player`, or `null`. */
  followingTarget(characterId: string | null): { readonly id: string } | null {
    const m = tryGetActiveGameStateManager();
    const target = m ? readSavedCharacterFollowingTarget(m, characterOps.idOf(characterId)) : null;
    if (target == null) {
      return null;
    }
    if (target === 'player') {
      return player;
    }
    const roomId = activeRoomScene()?.getCurrentRoomId() ?? null;
    return lookupCharacterHandle<{ readonly id: string }>(roomId, target) ?? { id: target };
  },

  getSpeechPoint(characterId: string | null, which: 'position' | 'offset'): Point2 | null {
    const m = tryGetActiveGameStateManager();
    if (!m) {
      return null;
    }
    const id = characterOps.idOf(characterId);
    return which === 'position' ? readSavedCharacterSpeechPosition(m, id) : readSavedCharacterSpeechOffset(m, id);
  },

  setSpeechPoint(characterId: string | null, which: 'position' | 'offset', point: Point2 | null): void {
    const m = tryGetActiveGameStateManager();
    if (!m) {
      warnOnce(`speech${which}:no-game`, `speech${which === 'position' ? 'Position' : 'Offset'}: the game is not running — ignored.`);
      return;
    }
    const id = characterOps.idOf(characterId);
    if (which === 'position') {
      writeSavedCharacterSpeechPosition(m, id, point);
    } else {
      writeSavedCharacterSpeechOffset(m, id, point);
    }
  },

  resetSpeechPosition(characterId: string | null): void {
    const m = tryGetActiveGameStateManager();
    if (m) {
      clearSavedCharacterSpeechPosition(m, characterOps.idOf(characterId));
    }
  },
};

/** How quickly a character turns to keep facing another (`startFacing`). */
export interface FacingOptions {
  /** Shortest delay, in seconds, before turning after either character moves. Default 0.2. */
  readonly minWait?: number;
  /** Longest delay, in seconds. Default 0.4. */
  readonly maxWait?: number;
}

/** The active player character (§4.3). */
export const player = {
  /** The active player's character id. */
  get id(): string {
    const scene = activeRoomScene();
    return scene?.getActivePlayerCharacterId() ?? tryGetActiveGameStateManager()?.getActivePlayerCharacterId() ?? '';
  },
  /** Walks to a point, a named point or a thing's walk-to point. Waits. `.now` doesn't. */
  walkTo: timed((target: WalkTarget): Task => walkCharacterTask(null, target)),
  /** Teleports (instant). */
  moveTo(target: WalkTarget): void {
    characterOps.moveTo(null, target);
  },
  /** Stops a walk where the player is now. */
  stopWalking(): void {
    characterOps.stopWalking(null);
  },
  /** Feet position in room pixels. */
  get position(): Point2 {
    return characterOps.position(null);
  },
  /** Turns to `'U'`, `'D'`, `'L'` or `'R'`. Waits for the turn; `.now` doesn't. */
  face: timed((direction: CharacterFacingLetter): Task => faceCharacterTask(null, direction)),
  /** One speech line. Waits. Same as a `Player: "…"` label. */
  say: timed((text: string, options?: ScriptedSayLineOptions): Task => sayTask(PLAYER_SPEAKER, text, options)),
  /** One-shot animation; waits for it to finish, then returns to the base animation. */
  play: timed((tag: string): Task => characterOps.play(null, tag)),
  /** Fades to `alpha` (0–1) over `seconds`. Waits. */
  fade: timed((alpha: number, seconds: number): Task => characterOps.fade(null, alpha, seconds)),
  /** Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. */
  get alpha(): number {
    return characterOps.getAlpha(null);
  },
  set alpha(value: number) {
    characterOps.setAlpha(null, value);
  },
  /** Back to directional idle. */
  stopAnimation(): void {
    characterOps.stopAnimation(null);
  },
  /** Animation override (instant, saved). */
  get animation(): string {
    return characterOps.getAnimation(null);
  },
  set animation(tag: string) {
    characterOps.setAnimation(null, tag);
  },
  /** Hidden, the player isn't drawn. Instant, saved. */
  get visible(): boolean {
    return characterOps.getVisible(null);
  },
  set visible(value: boolean) {
    characterOps.setVisible(null, value);
  },
  /** Same as `visible = true`. */
  show(): void {
    characterOps.setVisible(null, true);
  },
  /** Same as `visible = false`. */
  hide(): void {
    characterOps.setVisible(null, false);
  },
  /** When false, walks (including click-to-walk) are ignored; `moveTo` still works. Saved. */
  get movable(): boolean {
    return characterOps.getMovable(null);
  },
  set movable(value: boolean) {
    characterOps.setMovable(null, value);
  },
  /** Follows `target` (another character) around the room. Saved. */
  startFollowing(target: { readonly id: string }, options?: CharacterFollowOptions): void {
    characterOps.startFollowing(null, target, options);
  },
  /** Stops following (`startFollowing`). */
  stopFollowing(): void {
    characterOps.stopFollowing(null);
  },
  /** True while following someone (`startFollowing`). */
  get isFollowing(): boolean {
    return characterOps.followingTarget(null) != null;
  },
  /** The character being followed, or `null`. */
  get followingTarget(): { readonly id: string } | null {
    return characterOps.followingTarget(null);
  },
  /**
   * Where the player's speech lines appear, in room pixels (bottom centre), instead of above the
   * talk point. `null` goes back to the talk point. Saved.
   */
  get speechPosition(): Point2 | null {
    return characterOps.getSpeechPoint(null, 'position');
  },
  set speechPosition(point: Point2 | null) {
    characterOps.setSpeechPoint(null, 'position', point);
  },
  /** Extra offset of the player's speech lines, in game canvas pixels. `null` clears it. Saved. */
  get speechOffset(): Point2 | null {
    return characterOps.getSpeechPoint(null, 'offset');
  },
  set speechOffset(offset: Point2 | null) {
    characterOps.setSpeechPoint(null, 'offset', offset);
  },
  /** Clears both {@link speechPosition} and {@link speechOffset}. */
  resetSpeechPosition(): void {
    characterOps.resetSpeechPosition(null);
  },
  /**
   * Hands control to another character in the room (instant, saved): from the next line on,
   * `player` and `Player:` mean that character.
   */
  switchTo(character: { readonly id: string }): void {
    const scene = activeRoomScene();
    if (scene) {
      scene.switchPlayerCharacter(character.id);
      return;
    }
    const m = tryGetActiveGameStateManager();
    if (m) {
      m.setActivePlayerCharacterId(character.id);
    } else {
      warnOnce('player.switchTo:no-game', 'player.switchTo: the game is not running — ignored.');
    }
  },
};

// ─── Inventory ───────────────────────────────────────────────────────────────

/** Anything with an item ID: an `items.x` handle. */
export interface ItemRef {
  readonly id: string;
}

function manager(what: string) {
  const m = tryGetActiveGameStateManager();
  if (!m) {
    warnOnce(`inventory:${what}`, `inventory.${what}: the game is not running — ignored.`);
  }
  return m;
}

export interface Inventory {
  /** Adds `quantity` (default 1) of the item. Instant. */
  add(item: ItemRef, quantity?: number): void;
  /** Removes `quantity` (default 1) of the item. Instant. */
  remove(item: ItemRef, quantity?: number): void;
  /** True when the bag holds the item. */
  has(item: ItemRef): boolean;
  /** How many of the item the bag holds. */
  count(item: ItemRef): number;
  /** Empties the bag. */
  clear(): void;
  /** What is in the bag, in order. */
  readonly items: Array<{ item: ItemRef; quantity: number }>;
}

/**
 * A character's bag; `owner` `null` is the active player's (`inventory`). Changes are instant
 * (§5): the script does not wait for the GUI.
 */
export function inventoryOf(owner: string | null): Inventory {
  const who = owner ?? undefined;
  return {
    add(item, quantity = 1) {
      void manager('add')?.addInventory(item.id, quantity, who);
    },
    remove(item, quantity = 1) {
      void manager('remove')?.removeFromInventory(item.id, quantity, who);
    },
    has(item) {
      return manager('has')?.hasInInventory(item.id, who) ?? false;
    },
    count(item) {
      return manager('count')?.quantityOf(item.id, who) ?? 0;
    },
    clear() {
      manager('clear')?.clearInventory(who);
    },
    get items() {
      return (manager('items')?.getInventoryItems(who) ?? []).map((i) => ({
        item: lookupItemHandle<ItemRef>(i.id) ?? { id: i.id },
        quantity: i.quantity,
      }));
    },
  };
}

/** The active player's inventory. */
export const inventory: Inventory = inventoryOf(null);
