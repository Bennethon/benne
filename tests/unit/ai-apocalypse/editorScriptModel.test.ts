// The editor's BenneScript ScriptModel (docs/bennescript-ergonomics-refactor.md §9), checked
// against the real AI Apocalypse scripts and against the build transform's own rules. The checks
// that hold for any game are in tests/unit/editorScriptModel.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { ContentRef } from '../../../benne-editor/src/bennescript/idsIndex';
import { findHandlers, insertHandlerStub, type HandlerSpec } from '../../../benne-editor/src/bennescript/handlerSpecs';
import { parseScriptModel } from '../../../benne-editor/src/bennescript/scriptModel';
import * as editorSpeakers from '../../../benne-editor/src/bennescript/speakers';
import { collectVoiceLines } from '../../../benne-editor/src/bennescript/voiceLines';
import { readRoomPlayFromNamesFromSource } from '../../../benne-editor/src/playFromDiscovery';
import * as buildSpeakers from '../../../scripts/lib/benneSpeakers.mjs';
import { transformBenneScript } from '../../../scripts/lib/bennescriptTransform.mjs';
import { gameRoot, index, model, readGenerated, scriptFiles } from '../../support/scriptModelGame';

const clubScript = path.join(gameRoot, 'rooms/club/club.room.ts');

describe('speakers', () => {
  it('match scripts/lib/benneSpeakers.mjs on the game and on edge cases', () => {
    const characters = buildSpeakers.readCharacterSpeakers(gameRoot);
    expect(editorSpeakers.readCharacterSpeakers(gameRoot)).toEqual(characters);
    const extra = [...characters, { id: 'penny', name: 'Hank' }, { id: 'pl-ayer' }];
    for (const chars of [characters, extra]) {
      const a = buildSpeakers.buildSpeakerTable(chars);
      const b = editorSpeakers.buildSpeakerTable(chars);
      for (const label of ['Hank', 'hank', 'JENSEN', 'Player', 'BOTTi3', 'botti3disembodied', 'BOTT-i3 2027', 'Hnak', 'Nobody', 'Penny']) {
        const x = buildSpeakers.resolveSpeaker(label, a);
        const y = editorSpeakers.resolveSpeaker(label, b);
        expect('id' in y ? { id: y.id } : { error: y.error }).toEqual(x);
      }
    }
  });
});

describe('IdsIndex', () => {
  it('maps content IDs to the generated handle names', () => {
    expect(index.findBinding(clubScript, { kind: 'hotspot', roomId: 'club', id: 'club-hotspot-battery' })).toEqual({
      module: './club.ids', name: 'battery', expr: 'battery',
    });
    expect(index.findBinding(clubScript, { kind: 'region', roomId: 'club', id: 'club-region-leave' })?.expr).toBe('regions.leave');
    expect(index.findBinding(clubScript, { kind: 'room', id: 'club' })?.expr).toBe('room');
    expect(index.findBinding(clubScript, { kind: 'item', id: 'soda' })).toEqual({ module: '@game', name: 'items', expr: 'items.soda' });
    const dialogScript = path.join(gameRoot, 'dialogs/driver/driver.dialog.ts');
    expect(index.findBinding(dialogScript, { kind: 'dialogOption', dialogId: 'driver', id: 'fix battery' })?.expr).toBe('options.fixBattery');
    const guiScript = path.join(gameRoot, 'guis/game-menu/game-menu.gui.ts');
    expect(index.findBinding(guiScript, { kind: 'guiControl', guiId: 'game-menu', id: 'settings' })?.expr).toBe('settingsBtn');
    const charScript = path.join(gameRoot, 'characters/jensen/jensen.character.ts');
    // A character script's own character is flat; other characters, and `characters.x` in a room script, are in @game.
    expect(index.findBinding(charScript, { kind: 'character', roomId: null, id: 'jensen' })).toEqual({
      module: './jensen.ids', name: 'jensen', expr: 'jensen',
    });
    expect(index.findBinding(charScript, { kind: 'character', roomId: null, id: 'hank' })?.expr).toBe('characters.hank');
    expect(index.findBinding(clubScript, { kind: 'character', roomId: null, id: 'jensen' })?.expr).toBe('characters.jensen');
  });

  it('reads the verbs from verbSpecs', () => {
    expect(index.verbs().map((v) => [v.id, v.method, v.itemMethod])).toEqual([
      ['take', 'onTake', null], ['use', 'onUse', 'onUseItem'], ['look', 'onLook', null],
      ['clean', 'onClean', null], ['talkTo', 'onTalkTo', null], ['move', 'onMove', null],
    ]);
  });

  it('finds the content behind a declaration (go to definition)', () => {
    const at = (rel: string, needle: string): ContentRef | undefined => {
      const abs = path.join(gameRoot, rel);
      const text = readGenerated(abs)!;
      const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
      return index.refAtDeclaration(abs, sf, text.indexOf(needle));
    };
    expect(at('rooms/club/club.ids.ts', 'battery =')).toEqual({ kind: 'hotspot', roomId: 'club', id: 'club-hotspot-battery' });
    expect(at('rooms/club/club.ids.ts', 'standBack:')).toEqual({ kind: 'point', roomId: 'club', id: 'club-point-standBack' });
    expect(at('rooms/club/club.ids.ts', 'room =')).toEqual({ kind: 'room', id: 'club' });
    expect(at('game.ids.ts', 'greetingBarista:')).toEqual({ kind: 'dialogOption', dialogId: 'barista', id: 'greeting barista' });
    expect(at('game.ids.ts', 'settingsBtn:')).toEqual({ kind: 'guiControl', guiId: 'game-menu', id: 'settings' });
    expect(at('game.ids.ts', 'soda:')).toEqual({ kind: 'item', id: 'soda' });
    expect(at('game.ids.ts', 'bodyFall:')).toEqual({ kind: 'sfx', id: 'body-fall' });
    expect(at('guis/verbs/verbs.ids.ts', 'takeBtn =')).toEqual({ kind: 'guiControl', guiId: 'verbs', id: 'TakeBtn' });
  });
});

describe('ScriptModel on the ported game', () => {
  it('finds the club handlers the Inspector shows', () => {
    const m = model(clubScript);
    const battery = { kind: 'hotspot', roomId: 'club', id: 'club-hotspot-battery' } as const;
    const has = (spec: HandlerSpec) => findHandlers(m, index, spec).length;
    expect(has({ kind: 'verb', target: battery, verbId: 'look' })).toBe(1);
    expect(has({ kind: 'verb', target: battery, verbId: 'clean' })).toBe(1);
    expect(has({ kind: 'verb', target: battery, verbId: 'take' })).toBe(0);
    expect(has({ kind: 'anyItem', target: battery })).toBeGreaterThan(0);
    expect(has({ kind: 'room', roomId: 'club', hook: 'onEnterAfterFade' })).toBe(1);
    expect(has({ kind: 'room', roomId: 'club', hook: 'onEnter' })).toBe(0);
    expect(has({ kind: 'region', roomId: 'club', regionId: 'club-region-leave', hook: 'onEnter' })).toBe(1);
    expect(has({ kind: 'playFrom', name: 'fix battery' })).toBe(1);
    const reg = findHandlers(m, index, { kind: 'verb', target: battery, verbId: 'look' })[0]!;
    expect(m.text.slice(reg.start, reg.headEnd)).toBe('battery.onLook');
  });

  it('recognises multi-verb handlers and doNotActivate', () => {
    const cafe = model(path.join(gameRoot, 'rooms/cafe/cafe.room.ts'));
    const stuff = { kind: 'hotspot', roomId: 'cafe', id: 'cleaning-stuff' } as const;
    for (const verbId of ['use', 'take', 'clean']) {
      expect(findHandlers(cafe, index, { kind: 'verb', target: stuff, verbId }).length, verbId).toBe(1);
    }
    const m = parseScriptModel(ts, path.join(gameRoot, 'inventory/key/key.inventory.ts'),
      "import { items } from '@game';\nitems.mop.onUse.doNotActivate(() => {})\n");
    expect(m.registrations[0]).toMatchObject({ method: 'onUse', doNotActivate: true, receiverText: 'items.mop' });
  });

  it('finds every Play From entry the smoke tests find', () => {
    let count = 0;
    for (const file of scriptFiles().filter((f) => f.endsWith('.room.ts'))) {
      const text = readFileSync(file, 'utf8');
      const byRegex = [...text.matchAll(/\bplayFrom\(\s*(['"`])(.+?)\1/g)].map((m) => m[2]);
      expect(readRoomPlayFromNamesFromSource(text), file).toEqual([...new Set(byRegex)]);
      count += byRegex.length;
    }
    expect(count).toBe(10);
  });
});

describe('speech lines', () => {
  const speakers = buildSpeakers.buildSpeakerTable(buildSpeakers.readCharacterSpeakers(gameRoot));
  const editorTable = editorSpeakers.buildSpeakerTable(editorSpeakers.readCharacterSpeakers(gameRoot));

  it('finds every line the build transform turns into speech', () => {
    let total = 0;
    for (const file of scriptFiles()) {
      const text = readFileSync(file, 'utf8');
      const out = transformBenneScript(text, { filename: file, speakers });
      const labels = out ? (out.code.match(/__bs\.say\(/g) ?? []).length : 0;
      const m = parseScriptModel(ts, file, text);
      const resolvedLabels = m.speech.filter(
        (s) => s.form === 'label' && 'id' in editorSpeakers.resolveSpeaker(s.speakerLabel!, editorTable),
      );
      expect(resolvedLabels.length, file).toBe(labels);
      total += m.speech.length;
    }
    expect(total).toBeGreaterThan(400);
  });

  it('assigns a character to every literal line of the game', () => {
    const files = scriptFiles().map((f) => ({ path: path.relative(path.resolve('.'), f), text: readFileSync(f, 'utf8') }));
    const result = collectVoiceLines(ts, files, {
      gameRoot,
      index,
      speakers: editorSpeakers.buildSpeakerTable(editorSpeakers.readCharacterSpeakers(gameRoot)),
      startingPlayerCharacterId: 'hank',
    });
    // `Player: game.config.defaultFallbackLine ?? "…"` has no literal text to mark.
    expect(result.skipped.map((s) => `${s.path}:${s.line}: ${s.reason}`)).toEqual([
      'src/game/globalScript.ts:13: the text is not a string literal',
    ]);
    const byCharacter = new Map<string, number>();
    for (const line of result.lines) byCharacter.set(line.characterId, (byCharacter.get(line.characterId) ?? 0) + 1);
    expect([...byCharacter.keys()].sort()).toEqual(expect.arrayContaining(['hank', 'jensen', 'botti3']));
  });
});

describe('stubs', () => {
  it('adds a prop handler with its import', () => {
    const text = readFileSync(clubScript, 'utf8');
    const result = insertHandlerStub(ts, index, clubScript, text, {
      kind: 'verb', target: { kind: 'prop', roomId: 'club', id: 'bg' }, verbId: 'look',
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.text.slice(result.start, result.end)).toBe('bg.onLook(() => {\n  // TODO: Look at\n})');
    expect(result.text).toMatch(/import \{\n {2}room, antenna, battery, car, crash, driver, hank, outside, points, regions, regulator, toolChest, bg,\n\} from '\.\/club\.ids';/);
    const after = parseScriptModel(ts, clubScript, result.text);
    expect(findHandlers(after, index, { kind: 'verb', target: { kind: 'prop', roomId: 'club', id: 'bg' }, verbId: 'look' })).toHaveLength(1);
  });
});
