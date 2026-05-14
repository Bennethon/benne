import type { UpdateContext } from './types.js';

export type BenneScriptOnUpdateHandler = (ctx: UpdateContext) => void;

const globalHandlers: BenneScriptOnUpdateHandler[] = [];

/**
 * Registers a global **`B.onUpdate`** handler for the lifetime of the game (cleared on
 * {@link Phaser.Core.Events.DESTROY} from {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts}).
 */
export function registerGlobalBenneScriptOnUpdateHandler(handler: BenneScriptOnUpdateHandler): () => void {
  globalHandlers.push(handler);
  return () => {
    const i = globalHandlers.indexOf(handler);
    if (i >= 0) {
      globalHandlers.splice(i, 1);
    }
  };
}

export function clearGlobalBenneScriptOnUpdateHandlers(): void {
  globalHandlers.length = 0;
}

export function runGlobalBenneScriptOnUpdateHandlers(ctx: UpdateContext): void {
  const snapshot = [...globalHandlers];
  for (let i = 0; i < snapshot.length; i += 1) {
    try {
      snapshot[i]!(ctx);
    } catch (e) {
      console.error(`[Benne] B.onUpdate (global) handler #${i} failed:`, e);
    }
  }
}
