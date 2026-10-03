import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { resolvePointerVerbForTarget as world, resolvePointerVerbForInventoryItem as item } from '../../src/engine/verbs/resolvePointerVerb';
vi.mock('../../src/engine/ConfigManager', () => ({ getGameSettings: () => ({ verbs: [{ id: 'use' }], inputProfile: { primaryButtonVerb: 'walkTo', secondaryButtonVerb: 'look' } }) }));
const pointer = (button: string) => ({ leftButtonDown: () => button === 'left', rightButtonDown: () => button === 'right' }) as Phaser.Input.Pointer;
const profile = { primaryButtonVerb: 'walkTo', secondaryButtonVerb: 'defaultVerb' };
it.each([
  ['left', null, null, { kind: 'walkToTarget' }],
  ['right', null, null, { kind: 'verb', verbId: 'talk', consumeActive: false }],
  ['left', 'open', null, { kind: 'verb', verbId: 'open', consumeActive: true }],
  ['right', 'open', null, { kind: 'clearActive' }],
  ['right', null, 'key', { kind: 'clearActive' }],
  ['left', null, 'key', { kind: 'verb', verbId: 'use', consumeActive: false }],
  ['middle', 'open', 'key', { kind: 'none' }],
] as const)('world %s verb=%s item=%s', (button, verb, armed, expected) => {
  expect(world(pointer(button), profile, { defaultVerb: 'talk' }, verb, armed)).toEqual(expected);
});
it('inventory rows resolve walking to their default verb and preserve an armed verb', () => {
  expect(item(pointer('left'), profile, { defaultVerb: 'look' }, null)).toEqual({ kind: 'verb', verbId: 'look', consumeActive: false });
  expect(item(pointer('left'), profile, {}, 'give', 'key')).toEqual({ kind: 'verb', verbId: 'give', consumeActive: false });
});
it('two-click profile uses authored verbs', () => {
  expect(world(pointer('left'), { primaryButtonVerb: 'use', secondaryButtonVerb: 'look' }, {}, null)).toEqual({ kind: 'verb', verbId: 'use', consumeActive: false });
});
