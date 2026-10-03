import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { GameStateManager } from '../../src/engine/gameState/GameStateManager';
import { registerInventoryDefinition } from '../../src/engine/inventory/inventoryDefinitionRegistry';
import { registerSnapshotFlushHook } from '../../src/engine/gameState/snapshotFlushHooks';
import { normalizeSerializedInventory, buildInitialInventoryByCharacter } from '../../src/engine/gameState/characterInventory';
import v1 from '../fixtures/saves/v1.json';
import v2 from '../fixtures/saves/v2.json';
vi.mock('../../src/engine/ConfigManager', () => ({
  getGameSettings: () => ({ startingPlayerCharacter: 'hero', initialGameState: { flags: { fresh: true } } }),
  getDialogSettingsFromConfig: () => ({}), getSpeechSettingsFromConfig: () => ({}),
}));
let state: GameStateManager;
let off: (() => void) | undefined;
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); },
  });
  state = new GameStateManager(new EventEmitter() as unknown as Phaser.Events.EventEmitter);
  registerInventoryDefinition({ id: 'coin', name: 'Coin', description: '', stackable: true, display: { aseprite: false } });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { off?.(); off = undefined; });
it('normalizes legacy inventory and keeps character ownership separate', () => {
  expect(normalizeSerializedInventory(['key', 'key', '', 3])).toEqual({ key: 2 });
  expect(normalizeSerializedInventory({ coin: '2.8', bad: NaN, zero: 0, negative: -1 })).toEqual({ coin: 2 });
  expect(buildInitialInventoryByCharacter({ startingPlayerCharacterId: 'hero', inventoryByCharacter: { friend: { key: 1 } }, legacyInventory: ['coin'] })).toEqual({ hero: { coin: 1 }, friend: { key: 1 } });
});
it('migrates a historical v1 save to the starting player bag', () => {
  state.importSnapshotJson(JSON.stringify(v1));
  expect(state.getSnapshot()).toMatchObject({ version: 2, inventoryByCharacter: { hero: { key: 2 } }, currentRoom: 'hall', lastRoom: 'start' });
});
it('round-trips historical v2 saves including player and armed item', () => {
  state.importSnapshotJson(JSON.stringify(v2));
  expect(JSON.parse(state.exportSnapshotJson())).toEqual(v2);
});
it('uses independent bags and disarms an exhausted inventory selection', () => {
  state.addInventory('coin', 3);
  state.addInventory('coin', 2, 'friend');
  state.setActiveInventoryItem('coin');
  state.removeFromInventory('coin', 3);
  expect(state.getActiveInventoryItemId()).toBeNull();
  expect(state.quantityOf('coin', 'friend')).toBe(2);
  state.setActivePlayerCharacterId('friend');
  expect(state.quantityOf('coin')).toBe(2);
});
it('nonstackable additions do not duplicate items', () => {
  expect(state.addInventory('key')).toBe(true);
  expect(state.addInventory('key')).toBe(false);
  expect(state.quantityOf('key')).toBe(1);
});
it('flushes live positions for saves but never while applying loaded state', () => {
  const flush = vi.fn(() => state.setVariable('position', 99));
  off = registerSnapshotFlushHook(flush);
  expect(state.getSnapshot().variables.position).toBe(99);
  flush.mockClear();
  state.importSnapshotJson(JSON.stringify({ ...v2, variables: { position: 7 } }));
  expect(flush).not.toHaveBeenCalled();
  expect(state.getSnapshot({ runFlushHooks: false }).variables.position).toBe(7);
});
it('named save rename, overwrite, load and delete retain the correct payload', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01'));
  state.setFlag('score', 1); state.save(' First ');
  vi.advanceTimersByTime(1000);
  state.setFlag('score', 2); state.save('second');
  state.renameSave('FIRST', 'second');
  expect(state.getSaveList()).toHaveLength(1);
  expect(state.load('SECOND')).toBe(true);
  expect(state.getFlag('score')).toBe(1);
  state.deleteSave('second');
  expect(state.getSaveList()).toEqual([]);
  expect(state.load('second')).toBe(false);
});
it('discovers legacy slots once', () => {
  state.saveToLocalStorage(3);
  expect(state.getSaveList()).toMatchObject([{ name: 'Slot 3', slot: 3 }]);
  expect(state.getSaveList()).toHaveLength(1);
});
it.each(['{', 'null', '{"version":99}', '{"version":2,"flags":[],"variables":{}}'])('rejects invalid saves atomically: %s', raw => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.setFlag('preserved', true);
  const before = state.exportSnapshotJson();
  localStorage.setItem('benne-save-0', raw);
  expect(state.loadFromLocalStorage()).toBe(false);
  expect(state.exportSnapshotJson()).toBe(before);
});
it('storage write failures do not add a save manifest entry', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw Error('quota'); });
  state.save('failed');
  expect(state.getSaveList()).toEqual([]);
});
