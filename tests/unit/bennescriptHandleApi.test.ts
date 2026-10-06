/**
 * Phase 4 runtime: item verbs and arming, item-on-item, fallbacks, character scripts, regions,
 * GUI controls, `pointer`, `waitForClick` and `say` blocks. Handlers are written as the transform
 * leaves them (async functions), so these run against the real dispatch channels.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildSpeakerTable, transformBenneScript } from '../../scripts/lib/bennescriptTransform.mjs';
import { say, waitForClick } from '../../src/engine/bennescript/actions';
import { pointer } from '../../src/engine/bennescript/game';
import {
  CharacterHandle,
  FallbacksHandle,
  GuiControlHandle,
  ItemHandle,
  RegionHandle,
  VerbHandle,
  withVerbMethods,
} from '../../src/engine/bennescript/handles';
import { cancelAllInteractions, currentContext, unhandled } from '../../src/engine/bennescript/interactionContext';
import { attachRoomHandlers } from '../../src/engine/bennescript/roomHandlers';
import { gameEvents } from '../../src/engine/events/EventBus';
import { guiButtonClickEventId } from '../../src/engine/events/guiButtonEvents';
import { guiSliderValueChangedEventId } from '../../src/engine/events/guiSliderEvents';
import {
  INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT,
  globalInventoryOnInventoryItemEventId,
} from '../../src/engine/events/inventoryOnVerbEvents';
import { roomRegionEnterEventId } from '../../src/engine/events/regionEnterExitEvents';
import { characterVerbEventId, globalVerbHandlerEventId } from '../../src/engine/events/verbInteractionEvents';
import { setActiveBenneGame } from '../../src/engine/gameState/activeBenneGame';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';
import { clearInteractionActivity, isInteractionActivityRunning } from '../../src/engine/interaction/interactionActivity';
import { dispatchInventoryVerbInteraction } from '../../src/engine/verbs/dispatchInventoryVerb';
import { publishBenneVerbHoverContext } from '../../src/engine/verbs/verbContext';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A running game whose active verb, armed item and verb log the tests read. */
function fakeGame(scene: Record<string, unknown> = {}) {
  const state = { verb: null as string | null, item: null as string | null };
  const manager = {
    state,
    getActiveVerb: () => state.verb,
    setActiveVerb: (v: string | null) => {
      state.verb = v;
    },
    clearActiveVerb: () => {
      state.verb = null;
    },
    getActiveInventoryItemId: () => state.item,
    setActiveInventoryItem: (id: string | null) => {
      state.item = id;
    },
    clearActiveInventoryItem: () => {
      state.item = null;
    },
    getVariable: () => undefined,
    hasVariable: () => false,
  };
  const room = { isCutsceneSkipFastForwarding: () => false, isCutsceneActive: () => false, scene: { isActive: () => false }, ...scene };
  setActiveBenneGame({ scene: { getScene: () => room }, registry: new Map() } as never);
  setActiveGameStateManager(manager as never);
  return manager;
}

afterEach(() => {
  cancelAllInteractions();
  clearInteractionActivity();
  setActiveBenneGame(null);
  setActiveGameStateManager(null);
});

/** Verb specs as the generator writes them (AI Apocalypse's `use` is an item verb). */
const verbSpecs = [
  { id: 'look', label: 'Look at', preposition: null, usesItem: false, method: 'onLook', itemMethod: null },
  { id: 'use', label: 'Use', preposition: 'with', usesItem: true, method: 'onUse', itemMethod: 'onUseItem' },
] as const;

type ItemMethods = {
  onLook(fn: () => void): void;
  onUse: ((fn: () => void) => void) & { doNotActivate(fn: () => void): void };
};

describe('inventory items (§4.6, §8.4)', () => {
  it('an item verb arms the item after its handler; doNotActivate opts out; other verbs never arm', async () => {
    const m = fakeGame();
    const log: string[] = [];
    const coin = withVerbMethods<ItemHandle, ItemMethods>(new ItemHandle('t1-coin'), verbSpecs);
    coin.onLook(async () => {
      log.push('look');
    });

    // No handler for "use": the engine arms it (decision 28), as for an item with no script at all.
    dispatchInventoryVerbInteraction(gameEvents, 'use', 't1-coin', 'r');
    expect(m.state.item).toBe('t1-coin');

    m.state.item = null;
    dispatchInventoryVerbInteraction(gameEvents, 'look', 't1-coin', 'r');
    await flush();
    expect(log).toEqual(['look']);
    expect(m.state.item).toBeNull();

    const key = withVerbMethods<ItemHandle, ItemMethods>(new ItemHandle('t1-key'), verbSpecs);
    key.onUse.doNotActivate(async () => {
      log.push('use key');
    });
    dispatchInventoryVerbInteraction(gameEvents, 'use', 't1-key', 'r');
    await flush();
    expect(log).toEqual(['look', 'use key']);
    expect(m.state.item).toBeNull();
  });

  it('onCombine runs for that item only; other items fall through to the unhandled fallback', async () => {
    fakeGame();
    const log: string[] = [];
    const magnet = new ItemHandle('t2-magnet');
    magnet.onCombine({ id: 't2-antenna' }, async () => {
      log.push('combined');
    });
    const onUnhandled = (p: { itemId: string }) => log.push(`unhandled ${p.itemId}`);
    gameEvents.on(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, onUnhandled);
    try {
      const payload = (itemId: string) => ({ targetType: 'inventoryItem', itemId, verbId: 'use', roomId: 'r', targetItemId: 't2-magnet' });
      gameEvents.emit(globalInventoryOnInventoryItemEventId('t2-magnet', 't2-antenna'), payload('t2-antenna'));
      await flush();
      expect(log).toEqual(['combined']);
    } finally {
      gameEvents.off(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, onUnhandled);
    }
  });
});

describe('fallbacks and character scripts (§4.9, §4.17)', () => {
  it('fallbacks run per verb, and item fallbacks get the item and the target', async () => {
    fakeGame();
    const log: string[] = [];
    const fallbacks = new FallbacksHandle();
    fallbacks.on('t3-look', async () => {
      log.push(`look ${String(currentContext().payload && 'payload')}`);
    });
    fallbacks.onItemUnhandled(async (item, target) => {
      log.push(`item ${item.id} on ${target.kind} ${target.id}`);
    });
    gameEvents.emit(globalVerbHandlerEventId('t3-look'), { propId: 'door', verbId: 't3-look' });
    gameEvents.emit(INVENTORY_ON_VERB_TARGET_UNHANDLED_EVENT, {
      targetType: 'hotspot',
      itemId: 'soda',
      verbId: 'use',
      roomId: 'r',
      hotspotId: 'battery',
    });
    await flush();
    expect(log).toEqual(['look payload', 'item soda on hotspot battery']);
  });

  it("a character script's unhandled() falls through to the global verb handler", async () => {
    fakeGame();
    const log: string[] = [];
    const penny = new CharacterHandle(null, 't4-penny');
    penny.on('t4-look', async () => {
      log.push('penny')
      unhandled()
    });
    const onGlobal = () => log.push('global');
    gameEvents.on(globalVerbHandlerEventId('t4-look'), onGlobal);
    try {
      gameEvents.emit(characterVerbEventId('t4-penny', 't4-look'), { characterId: 't4-penny', roomId: 'r', verbId: 't4-look' });
      await flush();
      await flush();
      expect(log).toEqual(['penny', 'global']);
    } finally {
      gameEvents.off(globalVerbHandlerEventId('t4-look'), onGlobal);
    }
  });
});

describe('regions (§4.14)', () => {
  it("passes the room's own character handle as `who`", async () => {
    fakeGame();
    const hank = new CharacterHandle('t5-room', 'hank');
    const seen: unknown[] = [];
    new RegionHandle('t5-room', 'exit').onEnter(async (who) => {
      seen.push(who);
    });
    const off = attachRoomHandlers('t5-room', {} as never, gameEvents);
    try {
      gameEvents.emit(roomRegionEnterEventId('t5-room', 'exit'), { characterId: 'hank', roomId: 't5-room', regionId: 'exit' });
      await flush();
      expect(seen).toEqual([hank]);
      expect(seen[0]).toBe(hank);
    } finally {
      off();
    }
  });
});

describe('GUI controls (§4.15)', () => {
  it('onClick runs as a non-gameplay handler; onChange gets a slider value immediately', async () => {
    fakeGame();
    const log: string[] = [];
    let release!: () => void;
    const button = new GuiControlHandle('t6-menu', 'ok');
    button.onClick(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      log.push('clicked');
    });
    new GuiControlHandle('t6-menu', 'volume').onChange((v: number) => log.push(`volume ${v}`));

    gameEvents.emit(guiButtonClickEventId('t6-menu', 'ok'));
    expect(isInteractionActivityRunning()).toBe(true);
    const { saves } = await import('../../src/engine/bennescript/saves');
    expect(saves.canSaveNow).toBe(true); // GUI handlers don't block saving
    gameEvents.emit(guiSliderValueChangedEventId('t6-menu', 'volume'), { value: 40 });
    expect(log).toEqual(['volume 40']);
    release();
    await flush();
    expect(log).toEqual(['volume 40', 'clicked']);
  });
});

describe('pointer (§4.15, §8.4)', () => {
  it('builds the verb line and resolves the hover default verb to its handle', () => {
    const m = fakeGame();
    const look = new VerbHandle({ ...verbSpecs[0] });
    expect(pointer.sentence).toBe('Walk to');
    publishBenneVerbHoverContext('Door', { description: 'Door', targetType: 'hotspot', targetId: 'door' });
    m.state.verb = 'use';
    expect(pointer.sentence).toBe('Use Door');
    expect(pointer.hover?.defaultVerb).toBe(look);
    publishBenneVerbHoverContext(null, null);
  });
});

describe('waitForClick (§4.12)', () => {
  function clickRoom() {
    let onClick: (() => void) | null = null;
    const timers: Array<() => void> = [];
    return {
      room: {
        setScriptedDialogClickToSkip: (fn: () => void) => {
          onClick = fn;
        },
        clearScriptedDialogClickToSkipIf: (fn: () => void) => {
          if (onClick === fn) onClick = null;
        },
        time: {
          delayedCall: (_ms: number, fn: () => void) => {
            timers.push(fn);
            return { remove: () => {} };
          },
        },
      },
      click: () => onClick?.(),
      timeout: () => timers.pop()?.(),
      get armed() {
        return onClick != null;
      },
    };
  }

  it('waits for a click, or for the timeout', async () => {
    const r = clickRoom();
    fakeGame(r.room);
    const byClick = waitForClick.now({ timeout: 10 });
    expect(r.armed).toBe(true);
    r.click();
    await flush();
    expect(byClick.done).toBe(true);
    expect(r.armed).toBe(false);

    const byTimeout = waitForClick.now({ timeout: 10 });
    r.timeout();
    await flush();
    expect(byTimeout.done).toBe(true);
    expect(r.armed).toBe(false);
  });
});

describe('say blocks (§4.2)', () => {
  const speakers = buildSpeakerTable([
    { id: 'hank', name: 'Hank' },
    { id: 'botti3-disembodied', name: 'BOTT-i3 Disembodied' },
  ]);
  const transform = (code: string) => transformBenneScript(code, { filename: 'test.room.ts', speakers });

  it('resolves speakers at build time, by ID or display name as written in JSON', () => {
    const out = transform('x.onLook(() => {\n  say`\n    Hank: Hi\n    BOTT-i3 Disembodied: Hello\n    botti3-disembodied: ${name}\n  `\n})\n')!;
    expect(out.code).toContain(
      'say.__withSpeakers({"Hank":"hank","BOTT-i3 Disembodied":"botti3-disembodied","botti3-disembodied":"botti3-disembodied"})`',
    );
  });

  it('fails the build on an unknown speaker, with a suggestion', () => {
    expect(() => transform('x.onLook(() => { say`Hnak: Hi` })')).toThrow(/Unknown speaker `Hnak`. Did you mean `Hank`\?/);
  });

  it('plays the lines in order with the resolved speakers', async () => {
    const lines: string[] = [];
    fakeGame({
      getActivePlayerCharacterId: () => 'hank',
      isCutsceneSkipFastForwarding: () => true, // lines end at once
    });
    const original = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      const block = say.__withSpeakers({ Hank: 'hank', Jensen: 'jensen' });
      const task = block.now`
        Hank: One
        // a comment
        Jensen: Two
      `;
      await task.promise;
    } finally {
      console.log = original;
    }
    expect(lines).toEqual(['[Player] One', '[Character jensen] Two']);
  });
});
