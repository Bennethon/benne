import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import {
  playScriptedSayLine,
  resolveBenneSayRuntimeLine,
  type ScriptedSayLineOptions,
} from '../scripting/scriptedSpeech.js';
import {
  resolveFaceLookWorldFromPayload,
  resolveWalkToClickedTargetFromPayload,
} from '../scripting/verbClickTarget.js';
import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import { currentContext } from './interactionContext.js';
import { liveRoomScene } from './scene.js';
import { Task, timed } from './task.js';

/** Speaker id the transform emits for `Player:` labels: the active player character. */
export const PLAYER_SPEAKER = 'Player';

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
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
  return Task.resolved();
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
  // Same console line as the old `B.player.say` / `B.character(id).say`.
  console.log(characterId === playerId ? `[Player] ${line.text}` : `[Character ${characterId}] ${line.text}`);
  return new Task(playScriptedSayLine(scene, line.text, characterId, options, line.voiceStem));
}

/** `say` as the transform emits it for labels: one line, waited for. */
export function sayLine(speakerId: string, text: unknown): void {
  return sayTask(speakerId, text).wait();
}

/** Where to walk: a named room point / thing id, raw room pixels, or a handle with an id. */
export type WalkTarget = Point2 | string | { readonly id: string };

function walkTargetOf(target: WalkTarget): Point2 | string {
  return typeof target === 'object' && 'id' in target ? target.id : target;
}

function noRoom(what: string): Task {
  warnOnce(`${what}:no-room`, `${what}: no active room — ignored.`);
  return Task.resolved();
}

/** Walks a character; the active player's walk is a player walk (interrupt policy). */
export function walkCharacterTask(characterId: string | null, target: WalkTarget): Task {
  const scene = activeRoomScene();
  if (!scene) {
    return noRoom('walkTo');
  }
  const dest = walkTargetOf(target);
  if (characterId == null || characterId === scene.getActivePlayerCharacterId()) {
    return playerWalkTask(scene, scene.walkPlayerTo(dest));
  }
  return new Task(scene.walkCharacterTo(characterId, dest));
}

export function faceCharacter(characterId: string | null, direction: CharacterFacingLetter): void {
  const scene = activeRoomScene();
  if (!scene) {
    noRoom('face');
    return;
  }
  if (characterId == null || characterId === scene.getActivePlayerCharacterId()) {
    scene.facePlayerScriptDirection(direction);
  } else {
    scene.faceCharacterScriptDirection(characterId, direction);
  }
}

/** The active player character (§4.3). */
export const player = {
  /** Walks to a point, a named point or a thing's walk-to point. Waits. `.now` doesn't. */
  walkTo: timed((target: WalkTarget): Task => walkCharacterTask(null, target)),
  face(direction: CharacterFacingLetter): void {
    faceCharacter(null, direction);
  },
  /** One speech line. Waits. Same as a `Player: "…"` label. */
  say: timed((text: string, options?: ScriptedSayLineOptions): Task => sayTask(PLAYER_SPEAKER, text, options)),
};

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

/** The active player's inventory. Changes are instant (§5): the script does not wait for the GUI. */
export const inventory = {
  add(item: ItemRef, quantity = 1): void {
    void manager('add')?.addInventory(item.id, quantity);
  },
  remove(item: ItemRef, quantity = 1): void {
    void manager('remove')?.removeFromInventory(item.id, quantity);
  },
  has(item: ItemRef): boolean {
    return manager('has')?.hasInInventory(item.id) ?? false;
  },
  count(item: ItemRef): number {
    return manager('count')?.quantityOf(item.id) ?? 0;
  },
};
