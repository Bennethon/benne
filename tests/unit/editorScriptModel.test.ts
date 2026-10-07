// The editor's BenneScript ScriptModel (docs/bennescript-ergonomics-refactor.md §9): the checks
// that hold for any game, run on the template in src/game. Each template's own content checks are
// in tests/unit/<template>/editorScriptModel.test.ts.
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { addNamedImport } from '../../benne-editor/src/bennescript/scriptEdits';
import { parseScriptModel, playFromNames, resolveScriptRef } from '../../benne-editor/src/bennescript/scriptModel';
import { readRoomPlayFromNamesFromSource } from '../../benne-editor/src/playFromDiscovery';
import { gameRoot, index, model, scriptFiles } from '../support/scriptModelGame';

describe('ScriptModel', () => {
  it('resolves every registration receiver in every script', () => {
    const unresolved: string[] = [];
    for (const file of scriptFiles()) {
      const m = model(file);
      for (const r of m.registrations) {
        if (r.receiver === null || r.receiver.root === 'button' || r.receiver.root === 'game' || r.receiver.root === 'pointer') continue;
        if (!resolveScriptRef(m, index, r.receiver)) unresolved.push(`${path.basename(file)}: ${r.receiverText}.${r.method}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('ignores commented and quoted registrations, and Play From names are static', () => {
    const src = [
      "import { playFrom } from '@benne/script';",
      "// playFrom('commented', () => {})",
      "const s = \"playFrom('quoted', () => {})\"",
      "playFrom('start', () => {})",
      "playFrom(`start`, () => {})",
      'playFrom(`dynamic-${s}`, () => {})',
      "playFrom('second', () => {})",
    ].join('\n');
    expect(playFromNames(parseScriptModel(ts, 'x.room.ts', src))).toEqual(['start', 'second']);
    expect(readRoomPlayFromNamesFromSource(src)).toEqual(['start', 'second']);
  });
});

describe('stubs', () => {
  it('adds imports in the usual order', () => {
    const file = path.join(gameRoot, 'rooms/x/x.room.ts');
    const add = (text: string, module: string, name: string) => addNamedImport(parseScriptModel(ts, file, text), { module, name });
    expect(add("import { room } from './x.ids';\n", '@game', 'items')).toBe("import { items } from '@game';\nimport { room } from './x.ids';\n");
    expect(add("import { items } from '@game';\n", '@benne/script', 'wait')).toBe("import { wait } from '@benne/script';\nimport { items } from '@game';\n");
    expect(add("import { items } from '@game';\n", '@game', 'rooms')).toBe("import { items, rooms } from '@game';\n");
    expect(add('// header\n', '@game', 'items')).toBe("// header\nimport { items } from '@game';\n");
  });
});
