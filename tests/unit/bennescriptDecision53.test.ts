/**
 * The decision 53 changes: `face` waits, `alpha` on props, characters and the player, timed
 * actions refuse to start in `onUpdate`, and `saves.autosave`. Handlers are written as the
 * transform leaves them (async functions).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { player } from '../../src/engine/bennescript/actions';
import { background } from '../../src/engine/bennescript/blocks';
import { onUpdate } from '../../src/engine/bennescript/globalHandlers';
import { CharacterHandle, PropHandle } from '../../src/engine/bennescript/handles';
import { cancelAllInteractions, runHandler, TimedActionInUpdateError } from '../../src/engine/bennescript/interactionContext';
import { runOnUpdateHandlers } from '../../src/engine/bennescript/onUpdateRegistry';
import { saves } from '../../src/engine/bennescript/saves';
import { isTask, isTaskWait } from '../../src/engine/bennescript/task';
import { gameEvents } from '../../src/engine/events/EventBus';
import { setActiveBenneGame } from '../../src/engine/gameState/activeBenneGame';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';
import { clearInteractionActivity } from '../../src/engine/interaction/interactionActivity';
import { GAME_STATE_REPLACED_EVENT } from '../../src/types/gameState';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => runOnUpdateHandlers({ deltaSeconds: 1 / 60, roomId: 'r' });

/** A running game with a variable store and saves, plus whatever `scene` adds to the room. */
function fakeGame(scene: Record<string, unknown> = {}) {
  const vars = new Map<string, unknown>();
  const saved: Array<{ name: string; slot?: number }> = [];
  const manager = {
    vars,
    saved,
    getVariable: (k: string) => vars.get(k),
    hasVariable: (k: string) => vars.has(k),
    setVariable: (k: string, v: unknown) => vars.set(k, v),
    getActivePlayerCharacterId: () => 'hank',
    getSaveList: () => saved.map((s, i) => ({ ...s, timestamp: i })),
    save: (name: string, slot?: number) => saved.push({ name, slot }),
  };
  const room = {
    isCutsceneSkipFastForwarding: () => false,
    isCutsceneActive: () => false,
    getActivePlayerCharacterId: () => 'hank',
    scene: { isActive: () => false },
    ...scene,
  };
  setActiveBenneGame({ scene: { getScene: () => room }, registry: new Map() } as never);
  setActiveGameStateManager(manager as never);
  return manager;
}

afterEach(() => {
  cancelAllInteractions();
  clearInteractionActivity();
  setActiveBenneGame(null);
  setActiveGameStateManager(null);
  vi.restoreAllMocks();
});

describe('face waits (§5)', () => {
  it('is a timed action: the blocking form returns a wait marker, .now a Task', () => {
    const turned: string[] = [];
    fakeGame({
      faceCharacterScriptDirection: (id: string, d: string) => turned.push(`${id} ${d}`),
      facePlayerScriptDirection: (d: string) => turned.push(`player ${d}`),
    });
    const penny = new CharacterHandle(null, 'penny');
    expect(isTaskWait(penny.face('L'))).toBe(true);
    const task = player.face.now('U');
    expect(isTask(task)).toBe(true);
    expect(turned).toEqual(['penny L', 'player U']);
  });
});

describe('alpha (§4.10)', () => {
  it('props and characters read the sprite and set alpha through an instant, saved fade', () => {
    const fades: string[] = [];
    fakeGame({
      getCurrentRoomId: () => 'r',
      getPropSprite: (id: string) => (id === 'lamp' ? { alpha: 0.25 } : undefined),
      getCharacterSprite: (id: string) => (id === 'penny' ? { alpha: 0.5 } : undefined),
      fadePropScriptAlpha: (id: string, from: number, to: number, s: number) => {
        fades.push(`prop ${id} ${from}->${to} ${s}s`);
        return Promise.resolve();
      },
      fadeCharacterScriptAlpha: (id: string, from: number, to: number, s: number) => {
        fades.push(`character ${id} ${from}->${to} ${s}s`);
        return Promise.resolve();
      },
    });
    const lamp = new PropHandle('r', 'lamp');
    const penny = new CharacterHandle(null, 'penny');
    expect(lamp.alpha).toBe(0.25);
    expect(penny.alpha).toBe(0.5);
    lamp.alpha = 0.75;
    penny.alpha = 0;
    player.alpha = 1;
    expect(fades).toEqual(['prop lamp 0.75->0.75 0s', 'character penny 0->0 0s', 'character hank 1->1 0s']);
  });

  it("a prop outside its room reads and writes its room's saved alpha", () => {
    const m = fakeGame({ getCurrentRoomId: () => 'elsewhere', getPropSprite: () => ({ alpha: 0.9 }) });
    const lamp = new PropHandle('r', 'lamp');
    expect(lamp.alpha).toBe(1);
    lamp.alpha = 0.3;
    expect([...m.vars.entries()]).toEqual([['room:r:prop:lamp:alpha', 0.3]]);
    expect(lamp.alpha).toBe(0.3);
  });

  it('a character not in the room reads and writes its saved alpha', () => {
    const m = fakeGame({ getCharacterSprite: () => undefined });
    setActiveBenneGame(null);
    const penny = new CharacterHandle(null, 'penny');
    expect(penny.alpha).toBe(1);
    penny.alpha = 0.4;
    expect([...m.vars.values()]).toEqual([0.4]);
    expect(penny.alpha).toBe(0.4);
  });
});

describe('timed actions in onUpdate (§4.18)', () => {
  it('throw TimedActionInUpdateError, logged once; background blocks may start them', async () => {
    const turned: string[] = [];
    fakeGame({ facePlayerScriptDirection: (d: string) => turned.push(d) });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let after = 0;
    // onUpdate handlers last for the game, so these switch themselves off for the other tests.
    let on = true;
    onUpdate(() => {
      if (!on) return;
      player.face('L');
      after += 1;
    });
    onUpdate(() => {
      if (!on) return;
      background(async () => {
        player.face('R');
      });
    });
    frame();
    frame();
    await flush();
    expect(after).toBe(0);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0]![1]).toBeInstanceOf(TimedActionInUpdateError);
    expect(turned).toEqual(['R', 'R']);
    on = false;
  });
});

describe('saves.autosave (§4.16)', () => {
  it('saves at once when allowed, else at the first frame where saving is allowed', async () => {
    const m = fakeGame();
    saves.autosave();
    expect(m.saved).toEqual([{ name: 'Autosave', slot: undefined }]);

    let release!: () => void;
    const busy = runHandler('test', undefined, null, async () => {
      saves.autosave('Chapter 2');
      await new Promise<void>((resolve) => (release = resolve));
    });
    await flush();
    frame();
    expect(m.saved).toHaveLength(1);
    release();
    await busy;
    frame();
    frame();
    expect(m.saved).toEqual([
      { name: 'Autosave', slot: undefined },
      { name: 'Chapter 2', slot: undefined },
    ]);
  });

  it('loading a game drops a pending autosave', async () => {
    const m = fakeGame();
    let release!: () => void;
    const busy = runHandler('test', undefined, null, async () => {
      saves.autosave(3);
      await new Promise<void>((resolve) => (release = resolve));
    });
    await flush();
    gameEvents.emit(GAME_STATE_REPLACED_EVENT);
    release();
    await busy;
    frame();
    expect(m.saved).toEqual([]);
  });
});
