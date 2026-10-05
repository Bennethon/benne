import { SCENE_ROOM } from '../../game/boot/constants.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
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
import { currentContext } from './interactionContext.js';
import { Task } from './task.js';

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
  const fromHandler = currentContext().scene;
  if (fromHandler) {
    return fromHandler;
  }
  return tryGetActiveBenneGame()?.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
}

/**
 * Types the author sees for timed actions return `void` (§6.3): the transform waits on them, and
 * a bare call must type-check. At runtime they return the {@link Task}.
 */
function blocking<A extends unknown[]>(fn: (...args: A) => Task): (...args: A) => void {
  return fn as unknown as (...args: A) => void;
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

/** Walk the player to the clicked thing's walk-to point, then face it. Waits. */
export const walkToClicked = blocking((): Task => {
  const clicked = clickedTarget('walkToClicked');
  if (!clicked) {
    return Task.resolved();
  }
  const { scene, walkTarget, faceLookWorld } = clicked;
  if (walkTarget == null) {
    warnOnce('walkToClicked:no-target', 'walkToClicked: this click has no room walk target — ignored.');
    return Task.resolved();
  }
  return new Task(
    scene.walkPlayerTo(walkTarget).then(() => scene.facePlayerTowardClicked(faceLookWorld, walkTarget)),
  );
});

/** Turn the player toward the clicked thing. */
export const faceClicked = blocking((): Task => {
  const clicked = clickedTarget('faceClicked');
  if (clicked && (clicked.walkTarget != null || clicked.faceLookWorld != null)) {
    clicked.scene.facePlayerTowardClicked(clicked.faceLookWorld, clicked.walkTarget);
  }
  return Task.resolved();
});

/** Pause for `seconds`. Returns at once while a cutscene skip is fast-forwarding. */
export const wait = blocking((seconds: number): Task => {
  const scene = activeRoomScene();
  if (!scene || scene.isCutsceneSkipFastForwarding()) {
    return Task.resolved();
  }
  return new Task(
    new Promise<void>((resolve) => {
      let unregisterSkip: (() => void) | null = null;
      const timer = scene.time.delayedCall(Math.max(0, seconds * 1000), () => {
        unregisterSkip?.();
        resolve();
      });
      unregisterSkip = scene.registerCutsceneSkipFinisher(() => {
        timer.remove(false);
        resolve();
      });
    }),
  );
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
