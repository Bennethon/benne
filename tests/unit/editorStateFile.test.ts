// The State view's model of src/game/state.ts (docs/bennescript-ergonomics-refactor.md §4.7):
// reading every template's flags and vars, and the edits keeping the author's layout and comments.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  addStateEntry,
  createStateFileText,
  ensureStateSection,
  formatVarLiteral,
  parseStateFile,
  removeStateEntry,
  setFlagDefault,
  setVarValue,
  type StateSectionKind,
} from '../../benne-editor/src/bennescript/stateFile';
import { validateStateName } from '../../benne-editor/src/bennescript/stateNames';

const FILE = 'state.ts';
const parse = (text: string) => parseStateFile(ts, FILE, text);

function add(text: string, kind: StateSectionKind, name: string, source: string): string {
  const file = parse(text);
  return addStateEntry(text, file, file[kind]!, name, source).text;
}

function remove(text: string, kind: StateSectionKind, name: string): string {
  const section = parse(text)[kind]!;
  return removeStateEntry(text, section, section.entries.find((e) => e.name === name)!).text;
}

/** Parses as TypeScript with no syntax errors. */
function expectValid(text: string): void {
  const sf = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
  expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
}

const MULTI = `import { defineFlags, defineVars, flag } from '@benne/script';

export const flags = defineFlags({
  // Hallway
  gotKey: false,
  allDone: flag(true, { saveKey: 'all done' }), // kept for old saves

  // Finale
});

export const vars = defineVars({
  coins: 0,
  name: 'Hank',
  list: [] as string[],
  bag: { apples: 2, 'odd key': [true, null] },
  later: makeDefault(),
});
`;

describe('parseStateFile', () => {
  it('reads every template’s state.ts', () => {
    const templates = path.resolve(__dirname, '../../game-templates');
    for (const name of readdirSync(templates)) {
      const text = readFileSync(path.join(templates, name, 'state.ts'), 'utf8');
      const file = parse(text);
      expect(file.flags, name).not.toBeNull();
      expect(file.vars, name).not.toBeNull();
      // The blank template defines no flags; every other template should yield some.
      if (!/defineFlags\(\{\s*\}\)/.test(text)) {
        expect(file.flags!.entries.length, name).toBeGreaterThan(0);
      }
      for (const e of [...file.flags!.entries, ...file.vars!.entries]) {
        expect(e.editable, `${name}: ${e.name}`).toBe(true);
        expect(text.slice(e.nameStart, e.nameEnd)).toBe(e.name);
      }
    }
  });

  it('reads flag() defaults with their save keys', () => {
    const flags = parse(MULTI).flags!;
    expect(flags.entries.map((e) => [e.name, e.value, e.saveKey])).toEqual([
      ['gotKey', false, undefined],
      ['allDone', true, 'all done'],
    ]);
    const allDone = flags.entries[1];
    expect(MULTI.slice(allDone.valueStart, allDone.valueEnd)).toBe('true');
  });

  it('reads var literals, looks past `as`, and leaves other values read-only', () => {
    const vars = parse(MULTI).vars!;
    expect(vars.entries.map((e) => [e.name, e.editable, e.value])).toEqual([
      ['coins', true, 0],
      ['name', true, 'Hank'],
      ['list', true, []],
      ['bag', true, { apples: 2, 'odd key': [true, null] }],
      ['later', false, undefined],
    ]);
    const list = vars.entries[2];
    expect(MULTI.slice(list.valueStart, list.valueEnd)).toBe('[]');
  });

  it('reports a missing section as null', () => {
    const file = parse(`import { defineFlags } from '@benne/script';\nexport const flags = defineFlags({});\n`);
    expect(file.flags?.entries).toEqual([]);
    expect(file.vars).toBeNull();
  });
});

describe('value edits', () => {
  it('toggles a flag, inside flag() too', () => {
    const flags = parse(MULTI).flags!;
    let text = setFlagDefault(MULTI, flags.entries[0], true).text;
    expect(text).toContain('  gotKey: true,\n');
    text = setFlagDefault(text, parse(text).flags!.entries[1], false).text;
    expect(text).toContain(`allDone: flag(false, { saveKey: 'all done' }), // kept for old saves`);
  });

  it('replaces a var value and keeps its `as` type', () => {
    const vars = parse(MULTI).vars!;
    let text = setVarValue(MULTI, vars.entries[2], ['a', "it's"]).text;
    expect(text).toContain(`  list: ['a', 'it\\'s'] as string[],\n`);
    text = setVarValue(text, parse(text).vars!.entries[0], -3.5).text;
    expect(text).toContain('  coins: -3.5,\n');
    expectValid(text);
    expect(parse(text).vars!.entries[0].value).toBe(-3.5);
  });

  it('formats var literals in the scripts’ style', () => {
    expect(formatVarLiteral({ a: 1, 'b-c': [null, false], d: {} })).toBe(`{ a: 1, 'b-c': [null, false], d: {} }`);
    expect(formatVarLiteral('line\nnext')).toBe(`'line\\nnext'`);
    expect(() => formatVarLiteral(Number.NaN)).toThrow();
  });
});

describe('addStateEntry', () => {
  it('opens up an empty {}', () => {
    const text = add(createStateFileText(), 'vars', 'coins', '0');
    expect(text).toContain('export const vars = defineVars({\n  coins: 0,\n});\n');
    expectValid(text);
  });

  it('adds after the last entry and any trailing comments', () => {
    const text = add(MULTI, 'flags', 'escaped', 'false');
    expect(text).toContain(`  // Finale\n  escaped: false,\n});`);
    expectValid(text);
  });

  it('adds a comma to a last entry that has none', () => {
    const before = `export const flags = defineFlags({\n    a: false\n});\n`;
    expect(add(before, 'flags', 'b', 'true')).toBe(`export const flags = defineFlags({\n    a: false,\n    b: true\n});\n`);
  });

  it('uses the file’s indent for a list with only comments', () => {
    const before = `export const flags = defineFlags({\n    x: false,\n});\nexport const vars = defineVars({\n    // none yet\n});\n`;
    expect(add(before, 'vars', 'n', '1')).toContain(`defineVars({\n    // none yet\n    n: 1,\n});`);
  });

  it('stays on one line for a one-line list', () => {
    const before = `export const flags = defineFlags({ a: false, b: true });\n`;
    expect(add(before, 'flags', 'c', 'false')).toBe(`export const flags = defineFlags({ a: false, b: true, c: false });\n`);
  });

  it('returns the new entry’s range', () => {
    const file = parse(MULTI);
    const r = addStateEntry(MULTI, file, file.vars!, 'score', '10');
    expect(r.text.slice(r.start, r.end)).toBe('score: 10');
  });
});

describe('removeStateEntry', () => {
  it('removes the first, middle and last entries with their lines', () => {
    let text = remove(MULTI, 'vars', 'coins');
    expect(text).toContain('defineVars({\n  name: \'Hank\',\n');
    text = remove(text, 'vars', 'list');
    expect(text).not.toContain('list');
    text = remove(text, 'vars', 'later');
    expect(text).toContain(`  bag: { apples: 2, 'odd key': [true, null] },\n});`);
    expectValid(text);
  });

  it('removes a trailing line comment with its entry but keeps section comments', () => {
    const text = remove(MULTI, 'flags', 'allDone');
    expect(text).toContain('  // Hallway\n  gotKey: false,\n\n  // Finale\n});');
  });

  it('empties a list back to {}', () => {
    const one = `export const flags = defineFlags({\n  a: false,\n});\n`;
    expect(remove(one, 'flags', 'a')).toBe('export const flags = defineFlags({});\n');
    expect(remove(`export const flags = defineFlags({ a: false });\n`, 'flags', 'a')).toBe(
      'export const flags = defineFlags({});\n',
    );
  });

  it('removes from a one-line list', () => {
    const line = `export const flags = defineFlags({ a: false, b: true, c: false });\n`;
    expect(remove(line, 'flags', 'b')).toBe(`export const flags = defineFlags({ a: false, c: false });\n`);
    expect(remove(line, 'flags', 'c')).toBe(`export const flags = defineFlags({ a: false, b: true });\n`);
  });
});

describe('ensureStateSection', () => {
  it('adds a missing section and its import', () => {
    const before = `import { defineFlags } from '@benne/script';\n\nexport const flags = defineFlags({});\n`;
    const text = ensureStateSection(ts, FILE, before, 'vars');
    expect(text).toBe(
      `import { defineFlags, defineVars } from '@benne/script';\n\nexport const flags = defineFlags({});\n\nexport const vars = defineVars({});\n`,
    );
    expect(ensureStateSection(ts, FILE, text, 'vars')).toBe(text);
  });
});

describe('validateStateName', () => {
  const names = parse(MULTI).flags!.entries.map((e) => e.name);
  it('accepts a new identifier', () => {
    expect(validateStateName('openedDoor', 'flags', names)).toBeUndefined();
  });
  it('rejects bad, reserved and taken names', () => {
    expect(validateStateName('', 'flags', names)).toBeDefined();
    expect(validateStateName('2fast', 'flags', names)).toBeDefined();
    expect(validateStateName('got key', 'flags', names)).toBeDefined();
    expect(validateStateName('delete', 'flags', names)).toBeDefined();
    expect(validateStateName('gotKey', 'flags', names)).toMatch(/already a flag/);
    expect(validateStateName('gotKey', 'flags', names, 'gotKey')).toBeUndefined();
  });
});
