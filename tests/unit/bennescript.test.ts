import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformWithOxc } from 'vite';
import {
  buildSpeakerTable,
  isBenneScriptFile,
  transformBenneScript,
} from '../../scripts/lib/bennescriptTransform.mjs';
import { readCharacterSpeakers } from '../../scripts/lib/benneSpeakers.mjs';

import { background, cutscene, together, withInputDisabled } from '../../src/engine/bennescript/blocks';
import { dialogStackForTesting } from '../../src/engine/bennescript/dialogs';
import { DialogHandle, RoomHandle } from '../../src/engine/bennescript/handles';
import {
  cancelAllInteractions,
  currentContext,
  runHandler,
  unhandled,
  type HandlerOutcome,
} from '../../src/engine/bennescript/interactionContext';
import { saves } from '../../src/engine/bennescript/saves';
import { Task, timed, type TaskHooks } from '../../src/engine/bennescript/task';
import { gameEvents } from '../../src/engine/events/EventBus';
import { guiButtonClickEventId } from '../../src/engine/events/guiButtonEvents';
import { setActiveBenneGame, tryGetActiveBenneGame } from '../../src/engine/gameState/activeBenneGame';
import { BENNE_GAME_STATE_REGISTRY_KEY } from '../../src/engine/gameState/registryKey';
import { setActiveGameStateManager } from '../../src/engine/gameState/resolveGameStateManager';
import { BENNE_USER_INPUT_DISABLED_REGISTRY_KEY } from '../../src/engine/input/userInputDisabledRegistry';
import {
  admitGameplayClick,
  beginInteractionActivity,
  clearInteractionActivity,
  currentInteraction,
  isGameplayInteractionRunning,
  isInteractionActivityRunning,
  type InteractionActivity,
} from '../../src/engine/interaction/interactionActivity';
import { registerDialogDefinition } from '../../src/engine/dialog/dialogDefinitionRegistry';
import { endDialogSessionIfMatches, getActiveDialogSession, openDialogSession } from '../../src/engine/dialog/dialogSession';
import { GAME_STATE_REPLACED_EVENT } from '../../src/types/gameState';

const speakers = buildSpeakerTable([
  { id: 'hank', name: 'Hank' },
  { id: 'botti3-disembodied', name: 'BOTT-i3 Disembodied' },
  { id: 'bob', name: 'Robert' },
  { id: 'robert', name: 'Bob' },
]);
const transform = (code: string) => transformBenneScript(code, { filename: 'test.room.ts', speakers });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A stand-in RoomScene: the cutscene stack, skip and input state the runtime touches. */
function fakeScene() {
  const finishers = new Set<() => void>();
  let depth = 0;
  let fastForward = false;
  const registry = new Map<string, unknown>();
  return {
    registry,
    get cutsceneDepth() {
      return depth;
    },
    pushCutscene: () => {
      depth += 1;
    },
    popCutscene: () => {
      depth -= 1;
      if (depth === 0) fastForward = false;
    },
    isCutsceneActive: () => depth > 0,
    isCutsceneSkipFastForwarding: () => fastForward,
    registerCutsceneSkipFinisher: (finish: () => void) => {
      finishers.add(finish);
      return () => finishers.delete(finish);
    },
    /** The skip key, as `RoomScene.requestCutsceneSkip`. */
    skip: () => {
      fastForward = true;
      const pending = [...finishers];
      finishers.clear();
      pending.forEach((f) => f());
    },
    setUserInputDisabled: (disabled: boolean) => registry.set(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY, disabled),
    hideDialogChoicesWhileChoiceRuns: () => {},
    showDialogChoicesAfterChoice: () => {},
  };
}
type FakeScene = ReturnType<typeof fakeScene>;

/** Installs a fake running game whose room is `scene`, with a fake state manager. */
function fakeGame(scene: FakeScene) {
  const saved: Array<{ name: string; slot?: number }> = [];
  const manager = {
    saved,
    setVariable: () => {},
    clearVariable: () => {},
    hasVariable: () => false,
    getVariable: () => undefined,
    save: (name: string, slot?: number) => saved.push({ name, slot }),
    load: () => false,
    getSaveList: () => [],
  };
  scene.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, manager);
  setActiveBenneGame({ scene: { getScene: () => scene }, registry: scene.registry } as never);
  setActiveGameStateManager(manager as never);
  return manager;
}

afterEach(() => {
  cancelAllInteractions();
  clearInteractionActivity();
  const active = getActiveDialogSession();
  if (active) endDialogSessionIfMatches(active);
  setActiveBenneGame(null);
  setActiveGameStateManager(null);
});

/**
 * Compiles a script snippet the way the game does (transform, then strip types) and runs its
 * top-level registrations against fakes. `h.onLook(fn)` collects handlers.
 *
 * Timed fakes: `wait()`, `talk()` (any non-walk action) and `walk()` (a player walk) each start a
 * task that stays open until `open()`. `probe()` logs the ambient payload when it starts.
 */
async function load(source: string, extra: Record<string, unknown> = {}) {
  const out = transform(source);
  if (!out) throw new Error('nothing transformed');
  const js = (await transformWithOxc(out.code, 'test.ts')).code.replace(
    /import\s*\{\s*__runtime as __bs\s*\}\s*from\s*["']@benne\/script["'];?/,
    '',
  );
  const log: string[] = [];
  const gates: Array<() => void> = [];
  const finished: string[] = [];
  const flags: Record<string, boolean> = {};
  const handlers: Array<() => void> = [];
  const activities: InteractionActivity[] = [];
  const gate = (name: string, hooks: TaskHooks = {}) => {
    let open!: () => void;
    const p = new Promise<void>((resolve) => {
      open = resolve;
    });
    gates.push(open);
    activities.push(currentInteraction()!);
    return new Task(p, { ...hooks, finishNow: () => finished.push(name) });
  };
  const runtime = {
    ctx: currentContext,
    say: (id: string, text: string) => {
      log.push(`${id}: ${text}`);
      return Task.resolved().wait();
    },
  };
  const api = {
    h: { onLook: (fn: () => void) => handlers.push(fn), onUpdate: (fn: () => void) => handlers.push(fn) },
    log: (line: string) => {
      log.push(line);
    },
    wait: timed(() => gate('wait')),
    talk: timed(() => gate('talk')),
    walk: timed(() => gate('walk', { playerWalk: true })),
    turn: timed(() => Task.resolved({ turn: true })),
    probe: timed(() => {
      log.push(`probe ${String(currentContext().payload)}`);
      return gate('probe');
    }),
    clicked: () => {
      log.push(`clicked ${String(currentContext().payload)}`);
    },
    flags,
    cutscene,
    together,
    background,
    withInputDisabled,
    unhandled,
    saves,
    rooms: { lab: new RoomHandle('lab') },
    ...extra,
  };
  new Function('__bs', ...Object.keys(api), js)(runtime, ...Object.values(api));
  const run = (payload: unknown = null, scene?: FakeScene, index = 0) => {
    let outcome: HandlerOutcome | null = null;
    void runHandler('test', scene as never, payload, handlers[index]!).then((o) => {
      outcome = o;
    });
    return () => outcome;
  };
  const open = async () => {
    gates.shift()!();
    await flush();
  };
  return { log, flags, run, open, finished, activities, gates, js };
}

describe('BenneScript transform', () => {
  it('applies to script files only', () => {
    expect(isBenneScriptFile('/g/src/game/rooms/cafe/cafe.room.ts')).toBe(true);
    expect(isBenneScriptFile('/g/src/game/globalScript.ts?v=1')).toBe(true);
    expect(isBenneScriptFile('/g/src/game/scripts/doors.script.ts')).toBe(true);
    expect(isBenneScriptFile('/g/src/game/rooms/cafe/cafe.ids.ts')).toBe(false);
    expect(isBenneScriptFile('/g/src/game/state.ts')).toBe(false);
  });

  it('makes handlers async and waits on every statement-level call', () => {
    const out = transform(`door.onUse(() => {\n  walkToClicked()\n  if (x) unhandled()\n  flags.a = true\n})\n`)!;
    expect(out.code).toContain('door.onUse(async () => { const __$ = __bs.ctx();');
    expect(out.code).toContain('await __$.step(() => walkToClicked())');
    expect(out.code).toContain('if (x) await __$.step(() => unhandled())');
    expect(out.code).toContain('flags.a = true\n');
    expect(out.code).toMatch(/import \{ __runtime as __bs \} from "@benne\/script";\n$/);
  });

  it('turns speaker labels into say calls by id or normalised display name', () => {
    const out = transform(
      'h.onLook(() => {\n  Hank: "Hi"\n  HANK: `It is ${n}`\n  BOTTi3Disembodied: "Denied."\n  Player: "Me"\n})\n',
    )!;
    expect(out.code).toContain('await __$.step(() => __bs.say("hank", "Hi"))');
    expect(out.code).toContain('await __$.step(() => __bs.say("hank", `It is ${n}`))');
    expect(out.code).toContain('__bs.say("botti3-disembodied", "Denied.")');
    expect(out.code).toContain('__bs.say("Player", "Me")');
  });

  it('treats onX.doNotActivate(…) callbacks as handlers', () => {
    const out = transform('items.key.onUse.doNotActivate(() => {\n  Hank: "Hi"\n})\nx.foo.doNotActivate(() => {})\n')!;
    expect(out.code).toContain('items.key.onUse.doNotActivate(async () => { const __$ = __bs.ctx();');
    expect(out.code).toContain('x.foo.doNotActivate(() => {})');
  });

  it('keeps ordinary labels', () => {
    const out = transform('h.onLook(() => {\n  outer: for (const a of b) { if (a) break outer }\n})\n')!;
    expect(out.code).toContain('outer: for (const a of b)');
  });

  it('reports unknown and ambiguous speakers', () => {
    expect(() => transform('h.onLook(() => { Hnak: "Hi" })')).toThrow(/Unknown speaker `Hnak`\. Did you mean `Hank`\?/);
    expect(() => transform('h.onLook(() => { Bob: "Hi" })')).toThrow(/matches more than one character: bob, robert/);
  });

  it('rejects speech lines that would never run', () => {
    expect(() => transform('function f() {}\nconst g = [1].map(() => { Hank: "x" })')).toThrow(/outside a handler/);
    expect(() => transform('h.onUpdate(() => { Hank: "x" })')).toThrow(/outside a handler/);
    // `() => Hank: "…"` doesn't parse; the error says to add braces.
    expect(() => transform('h.onLook(() => Hank: "Hi")')).toThrow(/Put it in braces: \(\) => \{ Hank: `…` \}/);
    expect(() => transform('h.onLook(() =>\n  Hank: `Hi`\n)')).toThrow(/whole body of an arrow function/);
    expect(() => transform('h.onLook(() => { Hank "Hi" })')).not.toThrow(/arrow function/);
  });

  it('rejects a step function passed as a value to a non-BenneScript call', () => {
    expect(() => transform('function handOver(p) { wait(1) }\nh.onLook(() => { parts.forEach(handOver) })')).toThrow(
      /for \(const x of list\) handOver\(x\)/,
    );
  });

  it('awaits step functions called in expression position', () => {
    const out = transform('function ready() { return true }\nh.onLook(() => { if (ready()) go() })')!;
    expect(out.code).toContain('async function ready()');
    expect(out.code).toContain('if ((await __$.step(() => ready()))) await __$.step(() => go())');
  });

  it('wraps concise arrow bodies, including parenthesised ones', () => {
    expect(transform('door.onUse(() => rooms.plaza.goTo())')!.code).toContain(
      'door.onUse(async () => { const __$ = __bs.ctx(); return await __$.step(() => ( rooms.plaza.goTo())); })',
    );
    expect(transform('const f = () => ({ a: 1 })')!.code).toContain(
      'const f = async () => { const __$ = __bs.ctx(); return ( ({ a: 1 })); }',
    );
  });

  it('keeps every source line on the same line (every room script in src/game)', () => {
    const rooms = path.resolve('src/game/rooms');
    const roomSpeakers = buildSpeakerTable(readCharacterSpeakers(path.resolve('src/game')));
    const scripts = readdirSync(rooms, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.room.ts'));
    expect(scripts.length).toBeGreaterThan(0);
    for (const file of scripts) {
      const source = readFileSync(path.join(rooms, file), 'utf8');
      const out = transformBenneScript(source, { filename: path.basename(file), speakers: roomSpeakers });
      if (!out) continue;
      const before = source.split('\n');
      const after = out.code.split('\n');
      expect(after.length, file).toBe(before.length + 2); // + the runtime import at the end
      before.forEach((line, i) => {
        const text = /"([^"]+)"/.exec(line)?.[1];
        if (text) expect(after[i], `${file}:${i + 1}`).toContain(text);
      });
    }
  });
});

describe('BenneScript sequencing rules (§5)', () => {
  it('rule 1: a handler body runs top to bottom, each line after the previous one', async () => {
    const g = await load('h.onLook(() => {\n  log("a")\n  wait()\n  log("b")\n  flags.x = true\n  Hank: "done"\n})\n');
    const outcome = g.run();
    await flush();
    expect(g.log).toEqual(['a']);
    expect(g.flags.x).toBeUndefined();
    expect(isInteractionActivityRunning()).toBe(true);
    await g.open();
    expect(g.log).toEqual(['a', 'b', 'hank: done']);
    expect(g.flags.x).toBe(true);
    expect(outcome()).toBe('finished');
    expect(isInteractionActivityRunning()).toBe(false);
  });

  it('rule 2: a timed action is finished when it completes; anything else, and helpers, as defined', async () => {
    const g = await load(
      'function helper() {\n  talk()\n  log("helper done")\n}\n' +
        'h.onLook(() => {\n  log("instant")\n  helper()\n  log("after helper")\n})\n',
    );
    g.run();
    await flush();
    expect(g.log).toEqual(['instant']);
    await g.open();
    expect(g.log).toEqual(['instant', 'helper done', 'after helper']);
  });

  it('rule 3: .now starts the action at its line and does not wait, in any position', async () => {
    const g = await load(
      'h.onLook(() => {\n  log("a")\n  probe.now()\n  log("b")\n  const t = probe.now()\n  log(String(t.done))\n})\n',
    );
    const outcome = g.run('door');
    await flush();
    // Both probes started where they are written, with the click as their context, and nothing waited.
    expect(g.log).toEqual(['a', 'probe door', 'b', 'probe door', 'false']);
    expect(outcome()).toBe('finished');
    expect(g.gates).toHaveLength(2);
    expect(g.js).toContain('const t = __$.run(() => probe.now())');
  });

  it('rule 4: Task.wait() waits for a .now task later in the handler', async () => {
    const g = await load('h.onLook(() => {\n  const t = wait.now()\n  log("while waiting")\n  t.wait()\n  log("after")\n})\n');
    g.run();
    await flush();
    expect(g.log).toEqual(['while waiting']);
    await g.open();
    expect(g.log).toEqual(['while waiting', 'after']);
  });

  it('rule 5: goTo, saves.load, unhandled and dialog.end end the handler', async () => {
    const cases: Array<[string, HandlerOutcome]> = [
      ['rooms.lab.goTo()', 'ended'],
      ['saves.load(1)', 'ended'],
      ['unhandled()', 'unhandled'],
      ['d.end()', 'ended'],
    ];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const [call, expected] of cases) {
      const g = await load(`h.onLook(() => {\n  log("before")\n  ${call}\n  log("after")\n})\n`, {
        d: new DialogHandle('d', {}),
      });
      const outcome = g.run();
      await flush();
      expect(g.log, call).toEqual(['before']);
      expect(outcome(), call).toBe(expected);
    }
  });

  it('rule 6: reads see the world as it is at that line, not at click time', async () => {
    const g = await load('h.onLook(() => {\n  log(`before ${flags.x}`)\n  wait()\n  log(`after ${flags.x}`)\n})\n');
    g.flags.x = false;
    g.run();
    await flush();
    g.flags.x = true; // changed by something else while the handler waits
    await g.open();
    expect(g.log).toEqual(['before false', 'after true']);
  });

  it('rule 7: a room change stops the handler at its current step', async () => {
    const g = await load('h.onLook(() => {\n  log("a")\n  wait()\n  log("b")\n})\n');
    const outcome = g.run();
    await flush();
    cancelAllInteractions();
    await flush();
    expect(outcome()).toBe('cancelled');
    expect(isInteractionActivityRunning()).toBe(false);
    await g.open();
    expect(g.log).toEqual(['a']);
  });

  it('rule 7: a save load stops running handlers and background blocks', async () => {
    const g = await load(
      'h.onLook(() => {\n  background(() => {\n    wait()\n    log("background")\n  })\n  wait()\n  log("handler")\n})\n',
    );
    const outcome = g.run();
    await flush();
    gameEvents.emit(GAME_STATE_REPLACED_EVENT, { snapshot: {} });
    await flush();
    await g.open();
    await g.open();
    expect(outcome()).toBe('cancelled');
    expect(g.log).toEqual([]);
  });

  it('rule 8: skipping a cutscene finishes its timed steps at once, then the handler continues', async () => {
    const scene = fakeScene();
    const g = await load(
      'h.onLook(() => {\n  cutscene(() => {\n    wait()\n    log("a")\n    talk()\n    log("b")\n  })\n  log("after")\n  wait()\n  log("end")\n})\n',
    );
    const outcome = g.run(null, scene);
    await flush();
    expect(scene.cutsceneDepth).toBe(1);
    expect(g.log).toEqual([]);
    scene.skip(); // in flight: the first wait is finished by the skip
    await flush();
    // The rest of the block ran without opening any gate; the step after it waits normally again.
    expect(g.finished).toEqual(['wait', 'talk']);
    expect(g.log).toEqual(['a', 'b', 'after']);
    expect(scene.cutsceneDepth).toBe(0);
    expect(outcome()).toBeNull();
    g.gates.splice(0, 2);
    await g.open();
    expect(g.log).toEqual(['a', 'b', 'after', 'end']);
    expect(outcome()).toBe('finished');
  });
});

describe('BenneScript blocks', () => {
  it('together starts every branch at once and waits for all of them', async () => {
    const g = await load(
      'h.onLook(() => {\n  together(\n    () => { wait(); log("one") },\n    () => { log("two starts"); talk(); log("two") },\n  )\n  log("both")\n})\n',
    );
    g.run();
    await flush();
    expect(g.log).toEqual(['two starts']);
    await g.open();
    expect(g.log).toEqual(['two starts', 'one']);
    await g.open();
    expect(g.log).toEqual(['two starts', 'one', 'two', 'both']);
  });

  it('background runs alongside and can be waited for later', async () => {
    const g = await load(
      'h.onLook(() => {\n  const bg = background(() => {\n    wait()\n    log("bg")\n  })\n  log("handler")\n  bg.wait()\n  log("joined")\n})\n',
    );
    g.run();
    await flush();
    expect(g.log).toEqual(['handler']);
    await g.open();
    expect(g.log).toEqual(['handler', 'bg', 'joined']);
  });

  it('withInputDisabled re-enables input afterwards, even when the handler is cancelled', async () => {
    const scene = fakeScene();
    fakeGame(scene);
    const g = await load('h.onLook(() => {\n  withInputDisabled(() => {\n    wait()\n  })\n})\n');
    g.run(null, scene);
    await flush();
    expect(scene.registry.get(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY)).toBe(true);
    cancelAllInteractions();
    await flush();
    expect(scene.registry.get(BENNE_USER_INPUT_DISABLED_REGISTRY_KEY)).toBe(false);
  });
});

describe('BenneScript interrupt policy (§5 rule 9, decision 1)', () => {
  it('a click during the opening walk cancels the handler', async () => {
    const g = await load('h.onLook(() => {\n  walk()\n  log("arrived")\n})\n');
    const outcome = g.run();
    await flush();
    expect(admitGameplayClick()).toBe(true);
    await flush();
    expect(outcome()).toBe('cancelled');
    await g.open();
    expect(g.log).toEqual([]);
  });

  it('once anything else has started, clicks are ignored until the handler ends', async () => {
    const g = await load('h.onLook(() => {\n  walk()\n  talk()\n  walk()\n  log("done")\n})\n');
    const outcome = g.run();
    await flush();
    await g.open(); // the opening walk arrives
    expect(admitGameplayClick()).toBe(false); // speaking
    await g.open();
    expect(admitGameplayClick()).toBe(false); // a second walk is not an opening walk
    await g.open();
    expect(outcome()).toBe('finished');
    expect(admitGameplayClick()).toBe(true);
  });

  it('a turn before the walk keeps it the opening walk (decision 53)', async () => {
    const g = await load('h.onLook(() => {\n  turn()\n  walk()\n  log("arrived")\n})\n');
    const outcome = g.run();
    await flush();
    expect(admitGameplayClick()).toBe(true);
    await flush();
    expect(outcome()).toBe('cancelled');
  });

  it('a handler whose first timed step is not a walk ignores clicks from the start', async () => {
    const g = await load('h.onLook(() => {\n  talk()\n})\n');
    g.run();
    await flush();
    expect(admitGameplayClick()).toBe(false);
  });

  it('inside a cutscene, clicks are ignored even during a walk', async () => {
    const g = await load('h.onLook(() => {\n  cutscene(() => {\n    walk()\n  })\n})\n');
    const outcome = g.run(null, fakeScene());
    await flush();
    expect(admitGameplayClick()).toBe(false);
    await g.open();
    expect(outcome()).toBe('finished');
  });

  it('background blocks and activities without a click policy do not take the lock', async () => {
    const g = await load('h.onLook(() => {\n  background(() => {\n    talk()\n  })\n})\n');
    g.run();
    await flush();
    expect(admitGameplayClick()).toBe(true);
    const old = beginInteractionActivity();
    expect(admitGameplayClick()).toBe(true);
    old.end();
  });

  it('a dropped opening walk (abandoned by the room) cancels the handler', async () => {
    const g = await load('h.onLook(() => {\n  walk()\n  log("arrived")\n})\n');
    const outcome = g.run();
    await flush();
    g.activities[0]!.abandon();
    await flush();
    expect(outcome()).toBe('cancelled');
    expect(isInteractionActivityRunning()).toBe(false);
  });
});

describe('BenneScript save policy (decision 2)', () => {
  it('refuses to save while a gameplay interaction runs', async () => {
    const manager = fakeGame(fakeScene());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = await load('h.onLook(() => {\n  log(String(saves.canSaveNow))\n  saves.save(1, "mid")\n  talk()\n})\n');
    expect(saves.canSaveNow).toBe(true);
    const outcome = g.run();
    await flush();
    expect(g.log).toEqual(['false']);
    expect(manager.saved).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('saves.save(1): refused'));
    await g.open();
    expect(outcome()).toBe('finished');
    expect(saves.canSaveNow).toBe(true);
    saves.save(2, 'idle');
    expect(manager.saved).toEqual([{ name: 'idle', slot: 2 }]);
  });

  it('GUI handlers do not block saving; an open dialog does', () => {
    fakeGame(fakeScene());
    const gui = beginInteractionActivity({ gameplay: false });
    expect(saves.canSaveNow).toBe(true);
    gui.end();
    registerDialogDefinition({ id: 'd', options: [] } as never);
    openDialogSession(tryGetActiveBenneGame()!, 'd');
    expect(saves.canSaveNow).toBe(false);
  });
});

describe('BenneScript dialogs (decision 3)', () => {
  for (const id of ['parent', 'child', 'd']) registerDialogDefinition({ id, options: [] } as never);

  it('start() waits for the conversation; a sub-dialog returns to its parent', async () => {
    const scene = fakeScene();
    fakeGame(scene);
    const parent = new DialogHandle('parent', { more: 'more' });
    const child = new DialogHandle('child', { back: 'back' });
    const g = await load(
      'parent.options.more.onChoose(() => {\n  log("into child")\n  child.start()\n  log("back in parent")\n})\n' +
        'child.options.back.onChoose(() => {\n  log("bye")\n  child.end()\n  log("never")\n})\n' +
        'h.onLook(() => {\n  parent.start()\n  log("conversation over")\n})\n',
      { parent, child },
    );
    const outcome = g.run();
    await flush();
    expect(getActiveDialogSession()?.dialogId).toBe('parent');
    // Waiting on the player is not "busy", but it is still an interaction for saving.
    expect(isInteractionActivityRunning()).toBe(false);
    expect(isGameplayInteractionRunning()).toBe(true);

    gameEvents.emit(guiButtonClickEventId('dialog', 'dc__more'), {});
    await flush();
    expect(getActiveDialogSession()?.dialogId).toBe('child');
    expect(dialogStackForTesting()).toEqual(['parent (suspended)', 'child']);

    gameEvents.emit(guiButtonClickEventId('dialog', 'dc__back'), {});
    await flush();
    expect(g.log).toEqual(['into child', 'bye', 'back in parent']);
    expect(getActiveDialogSession()?.dialogId).toBe('parent');
    expect(dialogStackForTesting()).toEqual(['parent']);
    expect(outcome()).toBeNull();

    endDialogSessionIfMatches(getActiveDialogSession()!);
    await flush();
    expect(g.log).toEqual(['into child', 'bye', 'back in parent', 'conversation over']);
    expect(outcome()).toBe('finished');
  });

  it('starting a dialog that is already open is an error in DEV', async () => {
    fakeGame(fakeScene());
    const d = new DialogHandle('d', { again: 'again' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const g = await load('d.options.again.onChoose(() => {\n  d.start()\n})\nh.onLook(() => {\n  d.start()\n})\n', { d });
    g.run();
    await flush();
    gameEvents.emit(guiButtonClickEventId('dialog', 'dc__again'), {});
    await flush();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Error in dialog d option'), expect.any(Error));
    expect(getActiveDialogSession()?.dialogId).toBe('d');
  });
});
