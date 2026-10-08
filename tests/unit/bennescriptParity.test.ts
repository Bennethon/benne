/**
 * The old `B` features ported to BenneScript (decision 50): the event bus, sound and video
 * controls, speech and dialog settings, speech position and follow state, GUI events, any-room
 * and unhandled hooks, `pointer.verb`, named saves, `inventory.clear()` and `doNotClear`.
 * Handlers are written as the transform leaves them (async functions).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSpeakerTable, transformBenneScript } from '../../scripts/lib/bennescriptTransform.mjs';
import { inventory, player } from '../../src/engine/bennescript/actions';
import { events } from '../../src/engine/bennescript/events';
import { game, pointer, settings } from '../../src/engine/bennescript/game';
import {
  CharacterHandle,
  FallbacksHandle,
  GuiHandle,
  ItemHandle,
  RoomHandle,
  SfxHandle,
  VerbHandle,
  VideoHandle,
  withSfxControls,
  withVideoControls,
} from '../../src/engine/bennescript/handles';
import { cancelAllInteractions, unhandled } from '../../src/engine/bennescript/interactionContext';
import { attachRoomHandlers } from '../../src/engine/bennescript/roomHandlers';
import { saves } from '../../src/engine/bennescript/saves';
import { gameEvents } from '../../src/engine/events/EventBus';
import { guiAllButtonsClickEventId, guiButtonClickEventId } from '../../src/engine/events/guiButtonEvents';
import { guiListBoxItemActivatedEventId } from '../../src/engine/events/guiListBoxEvents';
import { guiTextInputSubmitEventId } from '../../src/engine/events/guiTextInputEvents';
import {
  globalInventoryOnInventoryItemEventId,
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  roomInventoryOnCharacterAnySourceEventId,
  roomInventoryOnCharacterEventId,
  roomInventoryOnPropEventId,
} from '../../src/engine/events/inventoryOnVerbEvents';
import { VERB_UNHANDLED_EVENT } from '../../src/engine/events/verbInteractionEvents';
import { setActiveBenneGame } from '../../src/engine/gameState/activeBenneGame';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';
import { clearInteractionActivity } from '../../src/engine/interaction/interactionActivity';
import { registerRoomModuleLoaders, ensureRoomScriptLoaded } from '../../src/engine/scenes/roomScriptModules';
import { RoomTransitionHookRegistry } from '../../src/engine/scenes/RoomTransitionHookRegistry';
import { setGlobalRoomHookRegistry } from '../../src/engine/scenes/roomHookRegistrySingleton';
import {
  attachGlobalRoomHooks,
  registerCharacterAnyItemHandler,
  registerCharacterVerbItemHandler,
} from '../../src/engine/bennescript/globalHandlers';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

interface FakeSave {
  name: string;
  slot?: number;
  timestamp: number;
}

/** A running game with a real variable store, saves and a bag, plus whatever `scene` adds to the room. */
function fakeGame(scene: Record<string, unknown> = {}, soundManager?: unknown) {
  const vars = new Map<string, unknown>();
  const saveList: FakeSave[] = [];
  const state = { verb: null as string | null, item: null as string | null, cleared: [] as Array<string | undefined>, loaded: [] as unknown[] };
  const manager = {
    state,
    saveList,
    getVariable: (k: string) => vars.get(k),
    hasVariable: (k: string) => vars.has(k),
    setVariable: (k: string, v: unknown) => vars.set(k, v),
    clearVariable: (k: string) => vars.delete(k),
    getActiveVerb: () => state.verb,
    setActiveVerb: (v: string | null) => (state.verb = v),
    clearActiveVerb: () => (state.verb = null),
    getActiveInventoryItemId: () => state.item,
    setActiveInventoryItem: (id: string | null) => (state.item = id),
    clearActiveInventoryItem: () => (state.item = null),
    getActivePlayerCharacterId: () => 'hank',
    clearInventory: (who?: string) => state.cleared.push(who),
    getSaveList: () => saveList,
    save: (name: string, slot?: number) => saveList.push({ name, slot, timestamp: saveList.length }),
    load: (ref: string | number) => {
      state.loaded.push(ref);
      return saveList.some((s) => (typeof ref === 'number' ? s.slot === ref : s.name === ref));
    },
    renameSave: (from: string, to: string) => {
      const s = saveList.find((x) => x.name === from);
      if (s) s.name = to;
    },
    exportSnapshotJson: () => '{"version":2}',
    importSnapshotJson: (json: string) => {
      state.loaded.push(json);
      return json.startsWith('{');
    },
  };
  const room = {
    isCutsceneSkipFastForwarding: () => false,
    isCutsceneActive: () => false,
    getActivePlayerCharacterId: () => 'hank',
    getCurrentRoomId: () => 'r',
    scene: { isActive: () => false },
    ...scene,
  };
  const registry = new Map<string, unknown>(soundManager ? [['benneSoundManager', soundManager]] : []);
  setActiveBenneGame({ scene: { getScene: () => room }, registry } as never);
  setActiveGameStateManager(manager as never);
  return manager;
}

afterEach(() => {
  cancelAllInteractions();
  clearInteractionActivity();
  setActiveBenneGame(null);
  setActiveGameStateManager(null);
});

describe('events', () => {
  it('on / once / off / emit on the game bus, with the event arguments', async () => {
    fakeGame();
    const log: string[] = [];
    const listener = async (n: number) => {
      log.push(`on ${n}`);
    };
    events.on('test:parity', listener);
    events.once('test:parity', async (n: number) => {
      log.push(`once ${n}`);
    });
    expect(events.emit('test:parity', 1)).toBe(true);
    events.emit('test:parity', 2);
    events.off('test:parity', listener);
    expect(events.emit('test:parity', 3)).toBe(false);
    await flush();
    expect(log).toEqual(['on 1', 'once 1', 'on 2']);
  });

  it('in a room script, listens only while that room is active', async () => {
    fakeGame();
    const log: string[] = [];
    registerRoomModuleLoaders(
      new Map([
        [
          'evroom',
          async () => {
            events.on('test:room', async () => {
              log.push('heard');
            });
          },
        ],
      ]),
    );
    await ensureRoomScriptLoaded('evroom');
    events.emit('test:room');
    const detach = attachRoomHandlers('evroom', {} as never, gameEvents);
    events.emit('test:room');
    detach();
    events.emit('test:room');
    await flush();
    expect(log).toEqual(['heard']);
  });

  it('the transform treats events.once callbacks as handlers', () => {
    const out = transformBenneScript('events.once("x", () => {\n  Hank: "Hi"\n})\n', {
      filename: '/g/src/game/globalScript.ts',
      speakers: buildSpeakerTable([{ id: 'hank', name: 'Hank' }]),
    })!;
    expect(out.code).toContain('events.once("x", async () => { const __$ = __bs.ctx();');
  });
});

describe('sound and video controls', () => {
  it('sfx.x.isPlaying, sfx.stopAll(), video pause / resume / seek / stop / isPlaying / current', () => {
    const calls: string[] = [];
    let videoKey: string | null = 'intro';
    const sound = {
      isSfxPlaying: (id: string) => id === 'door',
      stopSfx: (id?: string) => calls.push(`stopSfx ${id ?? 'all'}`),
    };
    fakeGame({
      isRoomVideoPlaying: () => videoKey != null,
      getRoomVideoKey: () => videoKey,
      pauseRoomVideo: () => calls.push('pause'),
      resumeRoomVideo: () => calls.push('resume'),
      seekRoomVideo: (s: number) => calls.push(`seek ${s}`),
      stopRoomVideo: () => {
        calls.push('stop');
        videoKey = null;
      },
    }, sound);
    const sfx = withSfxControls({ door: new SfxHandle('door'), bell: new SfxHandle('bell') });
    const video = withVideoControls({ intro: new VideoHandle('intro'), outro: new VideoHandle('outro') });
    expect(video.isPlaying).toBe(true);
    expect(video.current).toBe(video.intro);
    expect(video.intro.isPlaying).toBe(true);
    expect(video.outro.isPlaying).toBe(false);
    video.pause();
    video.resume();
    video.seek(2.5);
    video.stop();
    expect(video.isPlaying).toBe(false);
    expect(video.current).toBeNull();
    expect(sfx.door.isPlaying).toBe(true);
    expect(sfx.bell.isPlaying).toBe(false);
    sfx.stopAll();
    expect(calls).toEqual(['pause', 'resume', 'seek 2.5', 'stop', 'stopSfx all']);
  });
});

describe('speech and dialog settings', () => {
  it('every speech and dialog setting reads the override or the config, and onChange runs after a change', async () => {
    const m = fakeGame();
    let changes = 0;
    settings.onChange(async () => {
      changes += 1;
    });
    settings.speech.showText = false;
    settings.speech.msPerCharacter = 40;
    settings.speech.minDurationMs = 500;
    settings.speech.maxDurationMs = 3000;
    settings.speech.defaultTalkOffset = { x: 2, y: -4 };
    settings.textSpeed = 1.5;
    settings.dialog.usedColor = '#123456';
    settings.dialog.choiceOptionsViewportHeightPx = 60;
    expect(settings.speech).toMatchObject({
      showText: false,
      msPerCharacter: 40,
      minDurationMs: 500,
      maxDurationMs: 3000,
      durationMultiplier: 1.5,
      defaultTalkOffset: { x: 2, y: -4 },
    });
    expect(settings.dialog).toMatchObject({ usedColor: '#123456', choiceOptionsViewportHeightPx: 60 });
    settings.dialog.usedColor = undefined;
    expect(m.hasVariable('dialog:usedColor')).toBe(false);
    await flush();
    expect(changes).toBe(9);
  });
});

describe('characters and the player', () => {
  it('speech position and offset are saved per character and reset together; follow state reads back as handles', () => {
    const m = fakeGame();
    const jensen = new CharacterHandle('parityroom', 'jensen');
    jensen.speechPosition = { x: 10, y: 20 };
    jensen.speechOffset = { x: 0, y: -8 };
    expect(jensen.speechPosition).toEqual({ x: 10, y: 20 });
    expect(jensen.speechOffset).toEqual({ x: 0, y: -8 });
    jensen.resetSpeechPosition();
    expect(jensen.speechPosition).toBeNull();
    expect(jensen.speechOffset).toBeNull();
    player.speechOffset = { x: 3, y: 3 };
    expect(player.speechOffset).toEqual({ x: 3, y: 3 });

    expect(jensen.isFollowing).toBe(false);
    m.setVariable('character:jensen:followingTarget', 'player');
    expect(jensen.isFollowing).toBe(true);
    expect(jensen.followingTarget).toBe(player);
  });
});

describe('GUI events: any click, submit, activate', () => {
  it('onAnyClick gets the clicked control handle; onSubmit the text; onActivate the row', async () => {
    fakeGame();
    const gui = new GuiHandle('paritymenu', { saveBtn: 'save-btn', name: 'name', list: 'list' });
    const log: unknown[] = [];
    gui.onAnyClick(async (button) => {
      log.push(button);
    });
    gui.controls.name.onSubmit(async (text) => {
      log.push(`submit ${text}`);
    });
    gui.controls.list.onActivate(async (i) => {
      log.push(`activate ${i}`);
    });
    gameEvents.emit(guiButtonClickEventId('paritymenu', 'save-btn'));
    gameEvents.emit(guiAllButtonsClickEventId('paritymenu'), { buttonId: 'save-btn' });
    gameEvents.emit(guiAllButtonsClickEventId('paritymenu'), { buttonId: 'dc__row' });
    gameEvents.emit(guiTextInputSubmitEventId('paritymenu', 'name'), { finalValue: 'Hank' });
    gameEvents.emit(guiListBoxItemActivatedEventId('paritymenu', 'list'), { index: 2 });
    await flush();
    expect(log[0]).toBe(gui.controls.saveBtn);
    expect((log[1] as { id: string }).id).toBe('dc__row');
    expect(log.slice(2)).toEqual(['submit Hank', 'activate 2']);
  });
});

describe('hooks: any room loaded, skippable enter, unhandled verbs', () => {
  it('game.onLoadedAnyRoom and room hook options reach the room hook registry', async () => {
    fakeGame();
    const registry = new RoomTransitionHookRegistry();
    setGlobalRoomHookRegistry(registry);
    game.onLoadedAnyRoom(async () => {});
    game.onEnterAnyRoom(async () => {}, { skippable: false });
    attachGlobalRoomHooks();
    expect(registry.getAnyLoaded().length).toBeGreaterThan(0);
    expect(registry.getAnyEnter().some((e) => e.skippable === false)).toBe(true);

    const room = new RoomHandle('parityhooks');
    room.onEnterAfterFade(async () => {}, { skippable: false });
    attachRoomHandlers('parityhooks', {} as never, gameEvents);
    expect(registry.getAfterFadeHandlersForRoom('parityhooks')[0]?.skippable).toBe(false);
  });

  it('fallbacks.onUnhandled gets the verb handle and the target', async () => {
    fakeGame();
    const look = new VerbHandle({ id: 'look', label: 'Look at', preposition: null, usesItem: false, method: 'onLook', itemMethod: null });
    const seen: unknown[] = [];
    new FallbacksHandle().onUnhandled(async (verb, target) => {
      seen.push(verb, target);
    });
    gameEvents.emit(VERB_UNHANDLED_EVENT, {
      verbId: 'look',
      target: { type: 'prop', propId: 'vase', tag: '', roomId: 'r', description: 'Vase' },
      fallbackLine: '',
    });
    await flush();
    expect(seen).toEqual([look, { kind: 'prop', id: 'vase', name: 'Vase' }]);
  });

  it('game.isCutsceneActive reads the room', () => {
    fakeGame({ isCutsceneActive: () => true });
    expect(game.isCutsceneActive).toBe(true);
  });
});

describe('pointer.verb, inventory.clear(), saves', () => {
  it('pointer.verb arms and clears a verb; inventory.clear empties the bag', () => {
    const m = fakeGame();
    pointer.verb = { id: 'use' };
    expect(m.state.verb).toBe('use');
    pointer.verb = null;
    expect(m.state.verb).toBeNull();
    inventory.clear();
    new CharacterHandle(null, 'jensen').inventory.clear();
    expect(m.state.cleared).toEqual([undefined, 'jensen']);
  });

  it('named saves next to slots; rename; export; load and import end the handler', () => {
    const m = fakeGame();
    saves.save(0, 'First');
    saves.save('checkpoint');
    expect(saves.list().map((s) => [s.slot, s.name])).toEqual([[0, 'First'], [null, 'checkpoint']]);
    expect(saves.get('checkpoint')?.slot).toBeNull();
    saves.rename(0, 'Renamed');
    expect(saves.get(0)?.name).toBe('Renamed');
    expect(saves.export()).toBe('{"version":2}');
    expect(() => saves.load('checkpoint')).toThrow();
    expect(() => saves.import('{"version":2}')).toThrow();
    expect(m.state.loaded).toEqual(['checkpoint', '{"version":2}']);
  });
});

describe('doNotClear on item handlers', () => {
  it('keeps the item armed after a room item handler and an item-on-item handler', async () => {
    const m = fakeGame();
    vi.spyOn(await import('../../src/engine/verbs/dispatchInventoryOnVerbTarget'), 'shouldDropActiveInventoryOnUse').mockReturnValue(true);
    const knife = new ItemHandle('parity-knife');
    const bread = new ItemHandle('parity-bread');
    const table = { kind: 'prop' as const, id: 'table', roomId: 'paritydrop' };
    const { registerVerbItemHandler } = await import('../../src/engine/bennescript/roomHandlers');
    registerVerbItemHandler('paritydrop', table, null, knife.id, async () => {}, { doNotClear: true });
    bread.onCombine(knife, async () => {}, { doNotClear: true });
    attachRoomHandlers('paritydrop', {} as never, gameEvents);

    m.state.item = knife.id;
    m.state.verb = 'use';
    gameEvents.emit(roomInventoryOnPropEventId('paritydrop', 'table', knife.id), { itemId: knife.id, verbId: 'use' });
    await flush();
    expect(m.state.item).toBe(knife.id);
    gameEvents.emit(globalInventoryOnInventoryItemEventId(bread.id, knife.id), { itemId: knife.id, verbId: 'use' });
    await flush();
    expect(m.state.item).toBe(knife.id);
  });
});

describe('item dispatch tiers', () => {
  it('unhandled() in each tier hands the item to the next tier, each tier once', async () => {
    fakeGame();
    const knife = new ItemHandle('tier-knife');
    const guard = { kind: 'character' as const, id: 'tier-guard', roomId: 'tierroom' };
    const log: string[] = [];
    const pass = (tier: string) => async () => {
      log.push(tier);
      unhandled();
    };
    const { registerVerbItemHandler, registerAnyItemHandler } = await import('../../src/engine/bennescript/roomHandlers');
    registerVerbItemHandler('tierroom', guard, null, knife.id, pass('room item'));
    registerAnyItemHandler('tierroom', guard, pass('room any'));
    registerCharacterVerbItemHandler('tier-guard', null, knife.id, pass('character item'));
    registerCharacterAnyItemHandler('tier-guard', pass('character any'));
    const fallback = () => log.push('fallback');
    gameEvents.on(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, fallback);
    const detach = attachRoomHandlers('tierroom', {} as never, gameEvents);

    const payload = { targetType: 'character', roomId: 'tierroom', characterId: 'tier-guard', itemId: knife.id, verbId: 'use' };
    gameEvents.emit(roomInventoryOnCharacterEventId('tierroom', 'tier-guard', knife.id), payload);
    await flush();
    expect(log).toEqual(['room item', 'room any', 'character item', 'character any', 'fallback']);

    // Without a per-item handler, the room's any-item tier is the first one.
    log.length = 0;
    gameEvents.emit(roomInventoryOnCharacterAnySourceEventId('tierroom', 'tier-guard'), { ...payload, itemId: 'tier-other' });
    await flush();
    expect(log).toEqual(['room any', 'character any', 'fallback']);

    detach();
    gameEvents.off(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, fallback);
  });
});
