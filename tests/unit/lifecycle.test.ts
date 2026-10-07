import { expect, it, vi } from 'vitest';
import { RoomTransitionHookRegistry, areHookEntriesSkippable, runRoomHandlersEachSafe, runRoomHandlersSeq } from '../../src/engine/scenes/RoomTransitionHookRegistry';
const ctx = { roomId: 'a', lastRoom: null, visitCount: 1, isFirstEnter: true };
it('room hook clearing preserves global hooks and other rooms', () => {
  const hooks = new RoomTransitionHookRegistry();
  hooks.registerAnyEnterRoom(() => {});
  for (const id of ['a', 'b']) {
    hooks.registerRoomEnterRoom(id, () => {}, { skippable: false });
    hooks.registerRoomLeaveRoom(id, () => {});
    hooks.registerRoomLoadedRoom(id, () => {});
    hooks.registerRoomEnterRoomAfterFade(id, () => {});
  }
  hooks.clearPerRoomScriptHooksForRoomId('a');
  expect(hooks.getEnterHandlersForRoom('a')).toHaveLength(0);
  expect(hooks.getLeaveHandlersForRoom('a')).toHaveLength(0);
  expect(hooks.getLoadedHandlersForRoom('a')).toHaveLength(0);
  expect(hooks.getAfterFadeHandlersForRoom('a')).toHaveLength(0);
  expect(hooks.getAnyEnter()).toHaveLength(1);
  expect(hooks.getEnterHandlersForRoom('b')).toHaveLength(1);
  expect(areHookEntriesSkippable(hooks.getEnterHandlersForRoom('b'))).toBe(false);
  expect(areHookEntriesSkippable([])).toBe(true);
});
it('awaits each hook and propagates leave failures', async () => {
  const trace: number[] = [];
  await expect(runRoomHandlersSeq([async () => { await Promise.resolve(); trace.push(1); }, () => { throw Error('leave'); }, () => { trace.push(3); }], ctx)).rejects.toThrow('leave');
  expect(trace).toEqual([1]);
});
it('safe enter execution logs a failed hook and continues', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const next = vi.fn();
  await runRoomHandlersEachSafe([() => { throw Error('enter'); }, next], ctx, 'test');
  expect(error).toHaveBeenCalledOnce();
  expect(next).toHaveBeenCalledWith(ctx);
});
it('room script modules load once, with their room as the loading room', async () => {
  vi.resetModules();
  const modules = await import('../../src/engine/scenes/roomScriptModules');
  const seen: Array<string | null> = [];
  const load = vi.fn(async () => { seen.push(modules.getLoadingRoomScriptId()); });
  modules.registerRoomModuleLoaders(new Map([['a', load]]));
  await modules.ensureRoomScriptLoaded('a');
  await modules.ensureRoomScriptLoaded('a');
  await modules.ensureRoomScriptLoaded('b');
  expect(load).toHaveBeenCalledOnce();
  expect(seen).toEqual(['a']);
  expect(modules.getLoadingRoomScriptId()).toBeNull();
});
it('concurrent room imports keep their own loading room', async () => {
  vi.resetModules();
  const modules = await import('../../src/engine/scenes/roomScriptModules');
  const seen: Record<string, Array<string | null>> = { a: [], b: [] };
  modules.registerRoomModuleLoaders(new Map([
    ['a', async () => { seen.a!.push(modules.getLoadingRoomScriptId()); await new Promise(r => setTimeout(r, 5)); seen.a!.push(modules.getLoadingRoomScriptId()); }],
    ['b', async () => { await Promise.resolve(); seen.b!.push(modules.getLoadingRoomScriptId()); }],
  ]));
  await Promise.all([modules.ensureRoomScriptLoaded('a'), modules.ensureRoomScriptLoaded('b')]);
  expect(seen).toEqual({ a: ['a', 'a'], b: ['b'] });
});
it('deduplicates in-flight imports and permits a clean retry after failure', async () => {
  vi.resetModules();
  const modules = await import('../../src/engine/scenes/roomScriptModules');
  let attempts = 0;
  const loader = vi.fn(async () => { attempts++; await Promise.resolve(); if (attempts === 1) throw Error('load'); });
  modules.registerRoomModuleLoaders(new Map([['a', loader]]));
  const results = await Promise.allSettled([modules.ensureRoomScriptLoaded('a'), modules.ensureRoomScriptLoaded('a')]);
  expect(results.map(r => r.status)).toEqual(['rejected', 'rejected']);
  expect(loader).toHaveBeenCalledOnce();
  await modules.ensureRoomScriptLoaded('a');
  expect(loader).toHaveBeenCalledTimes(2);
  await modules.ensureRoomScriptLoaded('a');
  expect(loader).toHaveBeenCalledTimes(2);
});
