/**
 * `RoomScene`'s script alpha fades: a fade replaced by another (or by `alpha =`, a zero-length
 * fade) settles, so a handler waiting on it carries on (decision 53 review).
 */
import { describe, expect, it, vi } from 'vitest';
import { BENNE_GAME_STATE_REGISTRY_KEY } from '../../src/engine/gameState/registryKey';
import { RoomScene } from '../../src/engine/scenes/RoomScene';

// RoomScene subclasses and references Phaser classes when it loads; nothing here renders.
vi.mock('phaser', () => {
  const Stub = class {};
  const stubs = new Proxy({}, { get: () => Stub });
  return new Proxy(
    {
      Scene: Stub,
      Events: { EventEmitter: Stub },
      Math: { Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)) },
      BlendModes: {},
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : stubs) },
  );
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A scene with only the state the fade path reads; the methods are RoomScene's own. */
function fadeScene() {
  const tweens: Array<{ stopped: boolean; finish: () => void }> = [];
  const sprite = {
    alpha: 1,
    setAlpha(a: number) {
      this.alpha = a;
    },
  };
  const manager = { setVariable: () => {} };
  const scene: RoomScene = Object.assign(Object.create(RoomScene.prototype) as RoomScene, {
    game: { registry: new Map([[BENNE_GAME_STATE_REGISTRY_KEY, manager]]) },
    roomData: { id: 'r' },
    propSpritesById: new Map([['door', sprite]]),
    spriteAlphaFades: new Map(),
    cutsceneSkipFinishers: new Set(),
    cutsceneSkipFastForwardActive: false,
    tweens: {
      add: (config: { onComplete: () => void }) => {
        const tween = {
          stopped: false,
          stop() {
            this.stopped = true;
          },
          finish: config.onComplete,
        };
        tweens.push(tween);
        return tween;
      },
    },
  });
  return { scene, sprite, tweens };
}

describe('RoomScene script alpha fades', () => {
  it('a running fade settles when alpha is set, and its tween stops', async () => {
    const { scene, sprite, tweens } = fadeScene();
    let settled = false;
    void scene.fadePropScriptAlpha('door', 1, 0, 2).then(() => (settled = true));
    await scene.fadePropScriptAlpha('door', 0.5, 0.5, 0);
    await flush();
    expect(settled).toBe(true);
    expect(tweens[0]!.stopped).toBe(true);
    expect(sprite.alpha).toBe(0.5);
  });

  it('a running fade settles when another fade replaces it; the new one runs to the end', async () => {
    const { scene, tweens } = fadeScene();
    let first = false;
    let second = false;
    void scene.fadePropScriptAlpha('door', 1, 0, 2).then(() => (first = true));
    void scene.fadePropScriptAlpha('door', 0, 1, 2).then(() => (second = true));
    await flush();
    expect([first, second]).toEqual([true, false]);
    tweens[1]!.finish();
    await flush();
    expect(second).toBe(true);
    expect(tweens[1]!.stopped).toBe(false);
  });
});
