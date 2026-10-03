import { expect, it, vi } from 'vitest';
import { RoomTransitionHookRegistry, areHookEntriesSkippable, runRoomHandlersEachSafe, runRoomHandlersSeq } from '../../src/engine/scenes/RoomTransitionHookRegistry';
const ctx = { roomId: 'a', lastRoom: null, visitCount: 1, isFirstEnter: true };
it('room hook clearing preserves global hooks and other rooms', () => {
  const hooks = new RoomTransitionHookRegistry();
  hooks.whenEnterAnyRoom(() => {});
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
it('lazy room registration is isolated and reused', async () => {
  vi.resetModules();
  const registry = await import('../../src/engine/scripting/registerRoomScript');
  const callback = vi.fn();
  const load = vi.fn(async () => { registry.registerRoomScript(callback); });
  registry.registerRoomScriptModuleLoaders(new Map([['a', load]]));
  await registry.ensureRoomScriptLoaded('a');
  await registry.ensureRoomScriptLoaded('a');
  expect(load).toHaveBeenCalledOnce();
  expect(registry.getCallbacksForRoom('a')).toEqual([callback]);
  expect(registry.getCallbacksForRoom('b')).toEqual([]);
});
it('concurrent room imports retain their own registration context', async () => {
  vi.resetModules();
  const registry = await import('../../src/engine/scripting/registerRoomScript');
  const a = vi.fn(), b = vi.fn();
  registry.registerRoomScriptModuleLoaders(new Map([
    ['a', async () => { await new Promise(r => setTimeout(r, 5)); registry.registerRoomScript(a); }],
    ['b', async () => { await Promise.resolve(); registry.registerRoomScript(b); }],
  ]));
  await Promise.all([registry.ensureRoomScriptLoaded('a'), registry.ensureRoomScriptLoaded('b')]);
  expect(registry.getCallbacksForRoom('a')).toEqual([a]);
  expect(registry.getCallbacksForRoom('b')).toEqual([b]);
});
it('deduplicates in-flight imports and permits a clean retry after failure', async () => {
  vi.resetModules();
  const registry = await import('../../src/engine/scripting/registerRoomScript');
  let attempts = 0;
  const callback = vi.fn();
  const loader = vi.fn(async () => { attempts++; await Promise.resolve(); registry.registerRoomScript(callback); if (attempts === 1) throw Error('load'); });
  registry.registerRoomScriptModuleLoaders(new Map([['a', loader]]));
  const results = await Promise.allSettled([registry.ensureRoomScriptLoaded('a'), registry.ensureRoomScriptLoaded('a')]);
  expect(results.map(r => r.status)).toEqual(['rejected', 'rejected']);
  expect(loader).toHaveBeenCalledOnce();
  await registry.ensureRoomScriptLoaded('a');
  expect(registry.getCallbacksForRoom('a')).toEqual([callback]);
});
