/**
 * Props, hotspots, regions and walkable polygons keep their state in their own room: in that room
 * it goes through the scene, from any other room it reads and writes that room's saved state (not
 * the active room's, and never a same-ID thing of the active room).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotspotHandle, PropHandle, RegionHandle, WalkableHandle } from '../../src/engine/bennescript/handles';
import { setActiveBenneGame } from '../../src/engine/gameState/activeBenneGame';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';

/** A running game in room `plaza` whose scene records every call it gets. */
function inPlaza() {
  const vars = new Map<string, unknown>();
  const sceneCalls: string[] = [];
  const record =
    (name: string, result?: unknown) =>
    (...args: unknown[]) => {
      sceneCalls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
      return result;
    };
  const room = {
    getCurrentRoomId: () => 'plaza',
    getPropSprite: () => ({ alpha: 1 }),
    getPropScriptVisible: record('getPropScriptVisible', true),
    setPropScriptVisible: record('setPropScriptVisible'),
    setPropScriptClickable: record('setPropScriptClickable'),
    setPropScriptDescription: record('setPropScriptDescription'),
    setPropScriptBaseAnimationTag: record('setPropScriptBaseAnimationTag'),
    movePropToNow: record('movePropToNow'),
    fadePropScriptAlpha: record('fadePropScriptAlpha', Promise.resolve()),
    playPropScriptAnimationOneShot: record('playPropScriptAnimationOneShot', Promise.resolve()),
    setHotspotScriptActive: record('setHotspotScriptActive'),
    setHotspotScriptDescription: record('setHotspotScriptDescription'),
    getRegionScriptActive: record('getRegionScriptActive', true),
    setRegionScriptActive: record('setRegionScriptActive'),
    getWalkableScriptActive: record('getWalkableScriptActive', true),
    setWalkableScriptActive: record('setWalkableScriptActive'),
    isCutsceneSkipFastForwarding: () => false,
  };
  setActiveBenneGame({ scene: { getScene: () => room }, registry: new Map() } as never);
  setActiveGameStateManager({
    getVariable: (k: string) => vars.get(k),
    hasVariable: (k: string) => vars.has(k),
    setVariable: (k: string, v: unknown) => vars.set(k, v),
  } as never);
  return { vars, sceneCalls };
}

afterEach(() => {
  setActiveBenneGame(null);
  setActiveGameStateManager(null);
  vi.restoreAllMocks();
});

describe("a prop of another room", () => {
  it("writes to its own room's saved state and never touches the active room's prop with the same ID", () => {
    const { vars, sceneCalls } = inPlaza();
    const cafeBg = new PropHandle('cafe', 'bg');
    cafeBg.visible = false;
    cafeBg.clickable = true;
    cafeBg.description = 'old wallpaper';
    cafeBg.animation = 'bg-night';
    cafeBg.alpha = 0.5;
    cafeBg.moveTo({ x: 3, y: 4 });
    cafeBg.fade.now(0.25, 2);
    cafeBg.slideTo.now({ x: 5, y: 6 }, 2);
    expect(sceneCalls).toEqual([]);
    expect(Object.fromEntries(vars)).toEqual({
      'room:cafe:prop:bg:visible': false,
      'room:cafe:prop:bg:clickable': true,
      'room:cafe:prop:bg:description': 'old wallpaper',
      'room:cafe:prop:bg:animation': 'bg-night',
      'room:cafe:prop:bg:alpha': 0.25,
      'room:cafe:prop:bg:position': { x: 5, y: 6 },
    });
  });

  it('reads the saved state, else its room JSON', () => {
    inPlaza();
    const ghost = new PropHandle('cafe', 'ghost', { visible: false, clickable: true, description: 'a ghost', tag: 'ghost-idle', alpha: 0.4 });
    expect([ghost.visible, ghost.clickable, ghost.description, ghost.animation, ghost.alpha]).toEqual([
      false,
      true,
      'a ghost',
      'ghost-idle',
      0.4,
    ]);
    const plain = new PropHandle('cafe', 'cup');
    expect([plain.visible, plain.clickable, plain.description, plain.animation, plain.alpha]).toEqual([true, false, '', 'cup', 1]);
    ghost.visible = true;
    ghost.description = '';
    expect([ghost.visible, ghost.description]).toEqual([true, '']);
  });

  it('play only works in its room (warns, does nothing)', () => {
    const { sceneCalls } = inPlaza();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new PropHandle('cafe', 'bg').play.now('bg-flicker');
    expect(sceneCalls).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bg.play: only works in room "cafe"'));
  });
});

describe('a prop in the active room', () => {
  it('goes through the scene', () => {
    const { vars, sceneCalls } = inPlaza();
    const bg = new PropHandle('plaza', 'bg');
    bg.visible = false;
    bg.description = 'sky';
    expect(bg.visible).toBe(true);
    expect(sceneCalls).toEqual(['setPropScriptVisible("bg", false)', 'setPropScriptDescription("bg", "sky")', 'getPropScriptVisible("bg")']);
    expect(vars.size).toBe(0);
  });
});

describe('a hotspot of another room', () => {
  it("reads and writes its own room's saved state", () => {
    const { vars, sceneCalls } = inPlaza();
    const door = new HotspotHandle('cafe', 'door', { active: false, description: 'door' });
    expect([door.active, door.description]).toEqual([false, 'door']);
    door.active = true;
    door.description = 'open door';
    expect([door.active, door.clickable, door.description]).toEqual([true, true, 'open door']);
    expect(sceneCalls).toEqual([]);
    expect(Object.fromEntries(vars)).toEqual({ 'room:cafe:hotspot:door:active': true, 'room:cafe:hotspot:door:description': 'open door' });
  });
});

describe('regions and walkables of another room', () => {
  it("read and write their own room's saved state, never the active room's same-ID ones", () => {
    const { vars, sceneCalls } = inPlaza();
    const trap = new RegionHandle('cafe', 'exit', { active: false });
    const floor = new WalkableHandle('cafe', 'floor');
    expect([trap.active, floor.active]).toEqual([false, true]);
    trap.active = true;
    floor.active = false;
    expect([trap.active, floor.active]).toEqual([true, false]);
    expect(sceneCalls).toEqual([]);
    expect(Object.fromEntries(vars)).toEqual({ 'room:cafe:region:exit:active': true, 'room:cafe:walkable:floor:active': false });
  });

  it('go through the scene in their own room', () => {
    const { vars, sceneCalls } = inPlaza();
    const exit = new RegionHandle('plaza', 'exit');
    const floor = new WalkableHandle('plaza', 'floor');
    exit.active = false;
    floor.active = false;
    expect([exit.active, floor.active]).toEqual([true, true]); // the fake scene's answer
    expect(sceneCalls).toEqual([
      'setRegionScriptActive("exit", false)',
      'setWalkableScriptActive("floor", false)',
      'getRegionScriptActive("exit")',
      'getWalkableScriptActive("floor")',
    ]);
    expect(vars.size).toBe(0);
  });
});
