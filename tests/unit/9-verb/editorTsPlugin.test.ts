// The BENNE TS server plugin's BenneScript features (docs/bennescript-ergonomics-refactor.md §9),
// run on a real language service over the 9-verb template. Generated handles are served from memory.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { init } from '../../../benne-editor/src/tsServerPlugin';
import * as editorArrowSpeech from '../../../benne-editor/src/bennescript/tsPluginFeatures';
import { BENNESCRIPT_DIAGNOSTIC } from '../../../benne-editor/src/bennescript/tsPluginFeatures';
import { IdsIndex } from '../../../benne-editor/src/bennescript/idsIndex';
import { insertHandlerStub, type HandlerSpec } from '../../../benne-editor/src/bennescript/handlerSpecs';
import { buildSpeakerTable, readCharacterSpeakers } from '../../../scripts/lib/benneSpeakers.mjs';
import * as buildArrowSpeech from '../../../scripts/lib/bennescriptTransform.mjs';
import { transformBenneScript } from '../../../scripts/lib/bennescriptTransform.mjs';
import { generateGameHandles } from '../../../scripts/lib/generateGameHandles.mjs';

const repo = path.resolve('.');
const gameRoot = path.join(repo, 'src/game');
const generated = generateGameHandles(gameRoot);
const generatedText = (file: string): string | undefined =>
  generated.files.get(path.relative(gameRoot, file).split(path.sep).join('/'));

const config = ts.getParsedCommandLineOfConfigFile(path.join(repo, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: () => {},
})!;
const apartmentScript = path.join(gameRoot, 'rooms/apartment/apartment.room.ts');
const apartmentText = readFileSync(apartmentScript, 'utf8');

function pluginService(overrides: Record<string, string>) {
  const files = [...new Set([...config.fileNames, ...[...generated.files.keys()].map((f) => path.join(gameRoot, f)), ...Object.keys(overrides)])];
  const read = (file: string): string | undefined =>
    overrides[file] ?? generatedText(file) ?? (existsSync(file) ? readFileSync(file, 'utf8') : undefined);
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => files,
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => {
      const text = read(f);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => repo,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => read(f) !== undefined,
    readFile: read,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const languageService = ts.createLanguageService(host);
  return init({ typescript: ts as never }).create({ languageService } as never);
}

/** The apartment script with `snippet` appended inside a new handler; returns the cursor offset of `|`. */
function withHandler(body: string): { text: string; at: number } {
  const marker = body.indexOf('|');
  const prefix = `${apartmentText}\nroom.onEnter(() => {\n  `;
  return { text: `${prefix}${body.replace('|', '')}\n})\n`, at: prefix.length + marker };
}

describe('BENNE TS plugin', { timeout: 60000 }, () => {
  it('reports unknown and ambiguous speakers like the build', () => {
    const text = `${apartmentText}\nroom.onEnter(() => {\n  Hnak: "Hi"\n  Hank: "fine"\n  outer: for (;;) break outer\n})\nHank: "stray"\n`;
    const ls = pluginService({ [apartmentScript]: text });
    const ours = ls.getSemanticDiagnostics(apartmentScript).filter((d) => d.source === 'bennescript');
    expect(ours.map((d) => [d.code, text.slice(d.start!, d.start! + d.length!), d.messageText])).toEqual([
      [BENNESCRIPT_DIAGNOSTIC.unknownSpeaker, 'Hnak', 'Unknown speaker `Hnak`. Did you mean `Hank`?'],
      [BENNESCRIPT_DIAGNOSTIC.strayLabel, 'Hank', expect.stringContaining('is outside a handler')],
    ]);
  });

  it('explains a speech line used as an arrow body', () => {
    const text = `${apartmentText}\ncouch.onLook(() => Hank: "Hi")\n`;
    const ls = pluginService({ [apartmentScript]: text });
    const errors = ls.getSyntacticDiagnostics(apartmentScript);
    expect(errors.map((d) => [text[d.start], d.messageText])).toEqual([
      [':', expect.stringContaining('Put it in braces: `() => { Hank: "…" }`')],
    ]);
  });

  it('detects and words an arrow-body speech line like the build', () => {
    const cases: Array<[string, number]> = [
      ['x.onLook(() => Hank: "Hi")', 19],
      ['x.onLook(() =>\n  Player: "Hi")', 23],
      ['const o = { a: 1 }', 13],
      ['f(() => a ? b : c)', 14],
    ];
    for (const [code, pos] of cases) {
      const label = buildArrowSpeech.arrowSpeechLabelAt(code, pos);
      expect(editorArrowSpeech.arrowSpeechLabelAt(code, pos)).toBe(label);
      if (label) {
        expect(editorArrowSpeech.arrowSpeechMessage(label)).toBe(buildArrowSpeech.arrowSpeechMessage(label));
      }
    }
    expect(buildArrowSpeech.arrowSpeechLabelAt(cases[0]![0], cases[0]![1])).toBe('Hank');
    expect(buildArrowSpeech.arrowSpeechLabelAt(cases[1]![0], cases[1]![1])).toBe('Player');
  });

  it('checks say block speakers', () => {
    const text = `${apartmentText}\nroom.onEnter(() => {\n  say\`\n    Hank: ok\n    Nobody: hm\n    no colon here\n  \`\n})\n`;
    const ls = pluginService({ [apartmentScript]: text });
    const ours = ls.getSemanticDiagnostics(apartmentScript).filter((d) => d.source === 'bennescript');
    expect(ours.map((d) => [d.code, text.slice(d.start!, d.start! + d.length!)])).toEqual([
      [BENNESCRIPT_DIAGNOSTIC.unknownSpeaker, 'Nobody'],
      [BENNESCRIPT_DIAGNOSTIC.blockLine, 'no colon here'],
    ]);
  });

  it('offers speaker lines at the start of a statement', () => {
    const { text, at } = withHandler('Ha|');
    const ls = pluginService({ [apartmentScript]: text });
    const entries = ls.getCompletionsAtPosition(apartmentScript, at, {})!.entries;
    const hank = entries.find((e) => e.name === 'Hank:')!;
    expect(hank).toMatchObject({ insertText: 'Hank: "$1"', isSnippet: true, replacementSpan: { start: at - 2, length: 2 } });
    expect(entries.some((e) => e.name === 'Penny:')).toBe(true);
    // Not after a dot, not in lower case, not at the top level.
    const member = withHandler('hank.Fa|');
    expect(pluginService({ [apartmentScript]: member.text }).getCompletionsAtPosition(apartmentScript, member.at, {})?.entries.some((e) => e.name === 'Hank:')).toBe(false);
    const lower = withHandler('ha|');
    expect(pluginService({ [apartmentScript]: lower.text }).getCompletionsAtPosition(apartmentScript, lower.at, {})?.entries.some((e) => e.name === 'Hank:')).toBe(false);
  });

  it('puts string-union values first and lets them match without quotes', () => {
    for (const body of ['hank.face(|)', 'couch.animation = |', "couch.on([|"]) {
      const { text, at } = withHandler(body);
      const ls = pluginService({ [apartmentScript]: text });
      const entries = ls.getCompletionsAtPosition(apartmentScript, at, {})?.entries ?? [];
      const sorted = [...entries].sort((a, b) => a.sortText.localeCompare(b.sortText));
      expect(sorted[0]!.kind, body).toBe('string');
      expect(sorted[0]!.filterText).toBe(sorted[0]!.name.slice(1, -1));
    }
    const face = withHandler('hank.face(|)');
    const faces = pluginService({ [apartmentScript]: face.text }).getCompletionsAtPosition(apartmentScript, face.at, {})!.entries.filter((e) => e.kind === 'string');
    expect(faces.map((e) => e.name)).toEqual(expect.arrayContaining(["'U'", "'D'", "'L'", "'R'"]));
  });

  it('goes from a generated handle to its JSON', () => {
    const ls = pluginService({});
    const def = (needle: string, offset = 0) => {
      const at = apartmentText.indexOf(needle) + offset;
      const d = ls.getDefinitionAndBoundSpan(apartmentScript, at)!.definitions![0]!;
      const target = readFileSync(d.fileName, 'utf8');
      return [path.relative(gameRoot, d.fileName), target.slice(d.textSpan.start, d.textSpan.start + d.textSpan.length)];
    };
    expect(def('couch.onLook')).toEqual(['rooms/apartment/apartment.room.json', '"Couch"']);
    expect(def('items.broom', 6)).toEqual(['inventory/Broom/Broom.inventory.json', '"Broom"']);
    expect(def('regions.darkness', 8)).toEqual(['rooms/apartment/apartment.room.json', '"darkness"']);
    expect(def('dialogs.chatwithpenny', 8)).toEqual(['dialogs/chatwithpenny/chatwithpenny.dialog.json', '"chatwithpenny"']);
    expect(def('music.myCatIsCrazy', 6)[0]).toMatch(/^assets\/audio\/music\/my-cat-is-crazy\./);
    // Engine API is unchanged.
    expect(def('walkToClicked()')[0]).toMatch(/engine\/bennescript\/actions\.ts$/);
  });

  it('writes stubs that type-check and build', () => {
    const index = new IdsIndex(ts, gameRoot, generatedText);
    const specs: HandlerSpec[] = [
      { kind: 'verb', target: { kind: 'prop', roomId: 'apartment', id: 'Fan' }, verbId: 'look' },
      { kind: 'verb', target: { kind: 'character', roomId: 'apartment', id: 'penny' }, verbId: 'pickUp' },
      { kind: 'anyItem', target: { kind: 'prop', roomId: 'apartment', id: 'Table' } },
      { kind: 'room', roomId: 'apartment', hook: 'onLeave' },
      { kind: 'update', roomId: 'apartment' },
      { kind: 'region', roomId: 'apartment', regionId: 'darkness', hook: 'onExit' },
      { kind: 'playFrom', name: "Hank's \"start\"" },
    ];
    let text = apartmentText;
    for (const spec of specs) {
      const r = insertHandlerStub(ts, index, apartmentScript, text, spec);
      if ('error' in r) throw new Error(r.error);
      text = r.text;
    }
    const ls = pluginService({ [apartmentScript]: text });
    const errors = [...ls.getSyntacticDiagnostics(apartmentScript), ...ls.getSemanticDiagnostics(apartmentScript)];
    expect(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    const speakers = buildSpeakerTable(readCharacterSpeakers(gameRoot));
    expect(transformBenneScript(text, { filename: apartmentScript, speakers })?.code).toContain('playFrom(');
  });
});

