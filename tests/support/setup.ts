import { afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Only the event/number surface used by logic tests. Rendering is tested in a real browser.
vi.mock('phaser', () => ({
  Events: { EventEmitter },
  Math: { Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)), Linear: (a: number, b: number, t: number) => a + (b - a) * t },
}));
afterEach(() => { vi.useRealTimers(); });
