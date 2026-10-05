import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transformWithOxc } from 'vite';
import {
  buildSpeakerTable,
  isBenneScriptFile,
  transformBenneScript,
  usesNewBenneScriptApi,
} from '../../scripts/lib/bennescriptTransform.mjs';
import {
  cancelAllInteractions,
  currentContext,
  runHandler,
  type HandlerOutcome,
} from '../../src/engine/bennescript/interactionContext';
import { Task } from '../../src/engine/bennescript/task';
import { isInteractionActivityRunning } from '../../src/engine/interaction/interactionActivity';

const speakers = buildSpeakerTable([
  { id: 'hank', name: 'Hank' },
  { id: 'botti3-disembodied', name: 'BOTT-i3 Disembodied' },
  { id: 'bob', name: 'Robert' },
  { id: 'robert', name: 'Bob' },
]);
const transform = (code: string) => transformBenneScript(code, { filename: 'test.room.ts', speakers });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Compiles a script snippet the way the game does (transform, then strip types) and runs its
 * top-level registrations against fakes. `h.onLook(fn)` collects handlers.
 */
async function load(source: string) {
  const out = transform(source);
  if (!out) throw new Error('nothing transformed');
  const js = (await transformWithOxc(out.code, 'test.ts')).code.replace(
    /import\s*\{\s*__runtime as __bs\s*\}\s*from\s*["']@benne\/script["'];?/,
    '',
  );
  const log: string[] = [];
  const gates: Array<() => void> = [];
  const flags: Record<string, boolean> = {};
  const handlers: Array<() => void> = [];
  const runtime = {
    ctx: currentContext,
    say: (id: string, text: string) => {
      log.push(`${id}: ${text}`);
      return Task.resolved();
    },
  };
  const api = {
    h: { onLook: (fn: () => void) => handlers.push(fn), onUpdate: (fn: () => void) => handlers.push(fn) },
    log: (line: string) => {
      log.push(line);
    },
    wait: () => new Task(new Promise<void>((resolve) => gates.push(resolve))),
    clicked: () => {
      log.push(`clicked ${String(currentContext().payload)}`);
    },
    flags,
  };
  new Function('__bs', ...Object.keys(api), js)(runtime, ...Object.values(api));
  const run = (payload: unknown = null) => {
    let outcome: HandlerOutcome | null = null;
    void runHandler('test', undefined, payload, handlers[0]!).then((o) => {
      outcome = o;
    });
    return () => outcome;
  };
  const open = async () => {
    gates.shift()!();
    await flush();
  };
  return { log, flags, run, open, js };
}

describe('BenneScript transform', () => {
  it('applies only to script files that use the new API', () => {
    expect(isBenneScriptFile('/g/src/game/rooms/cafe/cafe.room.ts')).toBe(true);
    expect(isBenneScriptFile('/g/src/game/globalScript.ts?v=1')).toBe(true);
    expect(isBenneScriptFile('/g/src/game/rooms/cafe/cafe.ids.ts')).toBe(false);
    expect(usesNewBenneScriptApi(`import { wait } from '@benne/script';`)).toBe(true);
    expect(usesNewBenneScriptApi(`import { door } from './cafe.ids';`)).toBe(true);
    expect(usesNewBenneScriptApi(`import { registerRoomScript } from '@engine/scripting';`)).toBe(false);
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

  it('keeps every source line on the same line (the café)', () => {
    const source = readFileSync('src/game/rooms/cafe/cafe.room.ts', 'utf8');
    const out = transformBenneScript(source, {
      filename: 'cafe.room.ts',
      speakers: buildSpeakerTable([{ id: 'hank', name: 'Hank' }, { id: 'customer', name: 'customer' }]),
    })!;
    const before = source.split('\n');
    const after = out.code.split('\n');
    expect(after.length).toBe(before.length + 2); // + the runtime import at the end
    before.forEach((line, i) => {
      const text = /"([^"]+)"/.exec(line)?.[1];
      if (text) expect(after[i]).toContain(text);
    });
  });
});

describe('BenneScript step runtime', () => {
  it('runs lines in order: a line after a timed action waits for it', async () => {
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

  it('helpers join the calling handler: waits, return values and the clicked target', async () => {
    const g = await load(
      'function ready() {\n  clicked()\n  wait()\n  return true\n}\nh.onLook(() => {\n  if (ready()) log("ready")\n})\n',
    );
    g.run('door');
    await flush();
    expect(g.log).toEqual(['clicked door']);
    await g.open();
    expect(g.log).toEqual(['clicked door', 'ready']);
  });

  it('a cancelled handler stops at its current step', async () => {
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
});
