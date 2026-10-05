import type { CutsceneOptions } from '../../types/cutscene.js';
import { tryGetActiveBenneGame } from '../gameState/activeBenneGame.js';
import { BENNE_USER_INPUT_DISABLED_REGISTRY_KEY } from '../input/userInputDisabledRegistry.js';
import { currentContext, startBackground } from './interactionContext.js';
import { liveRoomScene } from './scene.js';
import type { Task } from './task.js';

/**
 * Block APIs (§4.12, §4.13). Their callbacks are step functions (the transform makes them async),
 * so each returns a promise that the calling statement's `$.step` waits on. `background` is the
 * exception: it returns a `Task` and the caller continues.
 */

/** A block body as the author writes it. */
type Block = () => void;

/**
 * Runs `fn` as a cutscene: world clicks are ignored, click-to-skip on speech still works, and the
 * skip key fast-forwards the whole block (timed steps finish at their end state). Waits.
 */
export function cutscene(fn: Block, options?: CutsceneOptions): void {
  const ctx = currentContext();
  const scene = ctx.roomScene();
  scene?.pushCutscene(options);
  ctx.cutsceneDepth += 1;
  const body = (async () => {
    try {
      await ctx.step(fn);
    } finally {
      ctx.cutsceneDepth -= 1;
      // A cancelled handler is cancelled by a room change or load, which already emptied the
      // cutscene stack; popping now could pop the next room's entry.
      if (!ctx.cancelled) {
        scene?.popCutscene();
      }
    }
  })();
  return body as unknown as void;
}

/** Starts every function at once and waits until all of them have finished. */
export function together(...fns: Block[]): void {
  const ctx = currentContext();
  return Promise.all(fns.map((fn) => ctx.step(fn))) as unknown as void;
}

/**
 * Runs `fn` alongside the scene without waiting for it (§4.13). It doesn't take the interaction
 * lock and stops on a room change or save load. `task.wait()` waits for it later.
 */
export function background(fn: Block): Task {
  return startBackground(fn);
}

let inputDisabledDepth = 0;

function setInputDisabled(disabled: boolean): void {
  liveRoomScene()?.setUserInputDisabled(disabled);
}

/** Player input. `input.disabled = true` locks out clicks until set back (survives room changes). */
export const input = {
  get disabled(): boolean {
    return tryGetActiveBenneGame()?.registry.get(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY) === true;
  },
  set disabled(value: boolean) {
    setInputDisabled(value === true);
  },
};

/** Runs `fn` with player input disabled, and re-enables it afterwards, even if the room changes. Waits. */
export function withInputDisabled(fn: Block): void {
  const ctx = currentContext();
  inputDisabledDepth += 1;
  setInputDisabled(true);
  const body = (async () => {
    try {
      await ctx.step(fn);
    } finally {
      inputDisabledDepth -= 1;
      if (inputDisabledDepth === 0) {
        setInputDisabled(false);
      }
    }
  })();
  return body as unknown as void;
}
