// Runtime side of the generated handles (docs/bennescript-ergonomics-refactor.md §4.7, §8).
import { afterEach, expect, it } from 'vitest';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';
import {
  defineFlags,
  defineVars,
  flag,
  HotspotHandle,
  VerbHandle,
  withVerbMethods,
  type VerbSpec,
} from '../../src/engine/bennescript/handles';
import { isItemVerb, resolveGameDefaultVerbId } from '../../src/engine/verbs/verbConfig';
import type { GameSettings } from '../../src/types/game';

function fakeState() {
  const flags = new Map<string, unknown>();
  const variables = new Map<string, unknown>();
  let activeVerb: string | null = null;
  const manager = {
    flags,
    variables,
    getFlag: (k: string) => flags.get(k),
    setFlag: (k: string, v: unknown) => void flags.set(k, v),
    hasVariable: (k: string) => variables.has(k),
    getVariable: (k: string) => variables.get(k),
    setVariable: (k: string, v: unknown) => void variables.set(k, v),
    getActiveVerb: () => activeVerb,
    setActiveVerb: (v: string | null) => void (activeVerb = v),
  };
  setActiveGameStateManager(manager as never);
  return manager;
}

afterEach(() => setActiveGameStateManager(null));

const specs: VerbSpec[] = [
  { id: 'look', label: 'Look at', preposition: null, usesItem: false, method: 'onLook', itemMethod: null },
  { id: 'throw', label: 'Throw', preposition: 'at', usesItem: true, method: 'onThrow', itemMethod: 'onThrowItem' },
];

it('verb methods come from the generated specs and forward to on / onVerbItem', () => {
  const calls: unknown[][] = [];
  const handle = new HotspotHandle('room', 'window');
  handle.on = (verb, handler) => void calls.push(['on', verb, handler]);
  handle.onVerbItem = (verb, item, handler) => void calls.push(['item', verb, item.id, handler]);
  const h = withVerbMethods<HotspotHandle, { onLook(f: () => void): void; onThrowItem(i: { id: string }, f: () => void): void }>(
    handle,
    specs,
  );
  const fn = () => {};
  h.onLook(fn);
  h.onThrowItem({ id: 'rock' }, fn);
  expect(calls).toEqual([['on', 'look', fn], ['item', 'throw', 'rock', fn]]);
  expect('onLookItem' in h).toBe(false);
});

it('flags read defaults, write the state, and honour saveKey', () => {
  const state = fakeState();
  const flags = defineFlags({ batteryClean: false, escapedCloset: flag(true, { saveKey: 'escaped closet' }) });
  expect(flags.batteryClean).toBe(false);
  expect(flags.escapedCloset).toBe(true);
  flags.batteryClean = true;
  flags.escapedCloset = false;
  expect([...state.flags]).toEqual([['batteryClean', true], ['escaped closet', false]]);
  expect(flags.escapedCloset).toBe(false);
});

it('vars read defaults, and object defaults are copied into the state so in-place changes are saved', () => {
  const state = fakeState();
  const defaults = { coins: 0, seen: [] as string[] };
  const vars = defineVars(defaults);
  expect(vars.coins).toBe(0);
  vars.coins += 2;
  vars.seen.push('lab');
  expect(state.variables.get('coins')).toBe(2);
  expect(state.variables.get('seen')).toEqual(['lab']);
  expect(defaults.seen).toEqual([]);
});

it('verbs.x.select() sets the active verb', () => {
  fakeState();
  const clean = new VerbHandle(specs[0]!);
  expect(clean.isActive).toBe(false);
  clean.select();
  expect(clean.isActive).toBe(true);
  expect([clean.id, clean.label, clean.usesItem]).toEqual(['look', 'Look at', false]);
});

it('usesItem defaults from the preposition; the game default verb is configured, look, or the first verb', () => {
  expect(isItemVerb({ id: 'use', preposition: 'with' })).toBe(true);
  expect(isItemVerb({ id: 'give', preposition: 'to', usesItem: false })).toBe(false);
  expect(isItemVerb({ id: 'throw', usesItem: true })).toBe(true);
  expect(isItemVerb({ id: 'look' })).toBe(false);
  const settings = (verbs: string[], defaultVerb?: string) =>
    ({ verbs: verbs.map((id) => ({ id })), defaultVerb }) as unknown as GameSettings;
  expect(resolveGameDefaultVerbId(settings(['use', 'look'], 'use'))).toBe('use');
  expect(resolveGameDefaultVerbId(settings(['use', 'look'], 'smell'))).toBe('look');
  expect(resolveGameDefaultVerbId(settings(['interact', 'talk']))).toBe('interact');
});
