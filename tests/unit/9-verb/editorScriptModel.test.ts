// The editor's BenneScript ScriptModel (docs/bennescript-ergonomics-refactor.md §9), checked
// against the 9-verb template's scripts and against the build transform's own rules. The checks
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

const apartmentScript = path.join(gameRoot, 'rooms/apartment/apartment.room.ts');

describe('speakers', () => {
  it('match scripts/lib/benneSpeakers.mjs on the game and on edge cases', () => {
    const characters = buildSpeakers.readCharacterSpeakers(gameRoot);
    expect(editorSpeakers.readCharacterSpeakers(gameRoot)).toEqual(characters);
    const extra = [...characters, { id: 'penny', name: 'Hank' }, { id: 'pl-ayer' }];
    for (const chars of [characters, extra]) {
      const a = buildSpeakers.buildSpeakerTable(chars);
      const b = editorSpeakers.buildSpeakerTable(chars);
      for (const label of ['Hank', 'hank', 'HENRY', 'Player', 'Penny', 'penny', 'Hnak', 'Nobody', 'Pen-ny']) {
        const x = buildSpeakers.resolveSpeaker(label, a);
        const y = editorSpeakers.resolveSpeaker(label, b);
        expect('id' in y ? { id: y.id } : { error: y.error }).toEqual(x);
      }
    }
  });
});

describe('IdsIndex', () => {
  it('maps content IDs to the generated handle names', () => {
    expect(index.findBinding(apartmentScript, { kind: 'hotspot', roomId: 'apartment', id: 'window' })).toEqual({
      module: './apartment.ids', name: 'windowHotspot', expr: 'windowHotspot',
    });
    expect(index.findBinding(apartmentScript, { kind: 'prop', roomId: 'apartment', id: 'PeanutButter' })?.expr).toBe('peanutButter');
    expect(index.findBinding(apartmentScript, { kind: 'region', roomId: 'apartment', id: 'darkness' })?.expr).toBe('regions.darkness');
    expect(index.findBinding(apartmentScript, { kind: 'room', id: 'apartment' })?.expr).toBe('room');
    expect(index.findBinding(apartmentScript, { kind: 'item', id: 'PB' })).toEqual({ module: '@game', name: 'items', expr: 'items.pb' });
    const dialogScript = path.join(gameRoot, 'dialogs/chatwithpenny/chatwithpenny.dialog.ts');
    expect(index.findBinding(dialogScript, { kind: 'dialogOption', dialogId: 'chatwithpenny', id: 'greeting' })?.expr).toBe('options.greeting');
    const guiScript = path.join(gameRoot, 'guis/game-menu/game-menu.gui.ts');
    expect(index.findBinding(guiScript, { kind: 'guiControl', guiId: 'game-menu', id: 'settings' })?.expr).toBe('settingsBtn');
    const charScript = path.join(gameRoot, 'characters/henry/henry.character.ts');
    // A character script's own character is flat; other characters, and `characters.x` in a room script, are in @game.
    expect(index.findBinding(charScript, { kind: 'character', roomId: null, id: 'henry' })).toEqual({
      module: './henry.ids', name: 'henry', expr: 'henry',
    });
    expect(index.findBinding(charScript, { kind: 'character', roomId: null, id: 'hank' })?.expr).toBe('characters.hank');
    expect(index.findBinding(apartmentScript, { kind: 'character', roomId: null, id: 'henry' })?.expr).toBe('characters.henry');
  });

  it('reads the verbs from verbSpecs', () => {
    expect(index.verbs().map((v) => [v.id, v.method, v.itemMethod])).toEqual([
      ['give', 'onGive', 'onGiveItem'], ['pickUp', 'onPickUp', null], ['use', 'onUse', 'onUseItem'],
      ['open', 'onOpen', null], ['look', 'onLook', null], ['push', 'onPush', null],
      ['close', 'onClose', null], ['talkTo', 'onTalkTo', null], ['pull', 'onPull', null],
    ]);
  });

  it('finds the content behind a declaration (go to definition)', () => {
    const at = (rel: string, needle: string): ContentRef | undefined => {
      const abs = path.join(gameRoot, rel);
      const text = readGenerated(abs)!;
      const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
      return index.refAtDeclaration(abs, sf, text.indexOf(needle));
    };
    expect(at('rooms/apartment/apartment.ids.ts', 'windowHotspot =')).toEqual({ kind: 'hotspot', roomId: 'apartment', id: 'window' });
    expect(at('rooms/outside/outside.ids.ts', 'henryFountain:')).toEqual({ kind: 'point', roomId: 'outside', id: 'henry-fountain' });
    expect(at('rooms/apartment/apartment.ids.ts', 'room =')).toEqual({ kind: 'room', id: 'apartment' });
    expect(at('game.ids.ts', 'greeting:')).toEqual({ kind: 'dialogOption', dialogId: 'chatwithpenny', id: 'greeting' });
    expect(at('game.ids.ts', 'settingsBtn:')).toEqual({ kind: 'guiControl', guiId: 'game-menu', id: 'settings' });
    expect(at('game.ids.ts', 'pb:')).toEqual({ kind: 'item', id: 'PB' });
    expect(at('game.ids.ts', 'doorClose:')).toEqual({ kind: 'sfx', id: 'doorClose' });
    expect(at('guis/verbs/verbs.ids.ts', 'giveBtn =')).toEqual({ kind: 'guiControl', guiId: 'verbs', id: 'GiveBtn' });
  });
});

describe('ScriptModel on the ported game', () => {

  it('finds the apartment handlers the Inspector shows', () => {
    const m = model(apartmentScript);
    const couch = { kind: 'prop', roomId: 'apartment', id: 'Couch' } as const;
    const has = (spec: HandlerSpec) => findHandlers(m, index, spec).length;
    expect(has({ kind: 'verb', target: couch, verbId: 'look' })).toBe(1);
    expect(has({ kind: 'verb', target: couch, verbId: 'push' })).toBe(1);
    expect(has({ kind: 'verb', target: couch, verbId: 'pickUp' })).toBe(0);
    expect(has({ kind: 'anyItem', target: couch })).toBeGreaterThan(0);
    expect(has({ kind: 'room', roomId: 'apartment', hook: 'onEnterAfterFade' })).toBe(1);
    expect(has({ kind: 'room', roomId: 'apartment', hook: 'onLeave' })).toBe(0);
    expect(has({ kind: 'region', roomId: 'apartment', regionId: 'darkness', hook: 'onEnter' })).toBe(1);
    expect(has({ kind: 'playFrom', name: 'gotKey' })).toBe(1);
    const reg = findHandlers(m, index, { kind: 'verb', target: couch, verbId: 'look' })[0]!;
    expect(m.text.slice(reg.start, reg.headEnd)).toBe('couch.onLook');
  });

  it('recognises multi-verb handlers and doNotActivate', () => {
    const outside = model(path.join(gameRoot, 'rooms/outside/outside.room.ts'));
    const lever = { kind: 'prop', roomId: 'outside', id: 'RockMoved' } as const;
    for (const verbId of ['pull', 'push']) {
      expect(findHandlers(outside, index, { kind: 'verb', target: lever, verbId }).length, verbId).toBe(1);
    }
    const lantern = model(path.join(gameRoot, 'inventory/Lantern/Lantern.inventory.ts'));
    expect(lantern.registrations[0]).toMatchObject({ method: 'onUse', doNotActivate: true, receiverText: 'items.lantern' });
  });

  it('finds every Play From entry the smoke tests find', () => {
    let count = 0;
    for (const file of scriptFiles().filter((f) => f.endsWith('.room.ts'))) {
      const text = readFileSync(file, 'utf8');
      const byRegex = [...text.matchAll(/\bplayFrom\(\s*(['"`])(.+?)\1/g)].map((m) => m[2]);
      expect(readRoomPlayFromNamesFromSource(text), file).toEqual([...new Set(byRegex)]);
      count += byRegex.length;
    }
    expect(count).toBe(2);
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
    expect(total).toBeGreaterThan(50);
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
      'src/game/globalScript.ts:17: the text is not a string literal',
    ]);
    const byCharacter = new Map<string, number>();
    for (const line of result.lines) byCharacter.set(line.characterId, (byCharacter.get(line.characterId) ?? 0) + 1);
    expect([...byCharacter.keys()].sort()).toEqual(expect.arrayContaining(['hank', 'henry', 'penny']));
  });
});

describe('stubs', () => {
  it('adds a prop handler with its import', () => {
    const text = readFileSync(apartmentScript, 'utf8');
    const fan = { kind: 'prop', roomId: 'apartment', id: 'Fan' } as const;
    const result = insertHandlerStub(ts, index, apartmentScript, text, { kind: 'verb', target: fan, verbId: 'look' });
    if ('error' in result) throw new Error(result.error);
    expect(result.text.slice(result.start, result.end)).toBe('fan.onLook(() => {\n  // TODO: Look at\n})');
    expect(result.text).toMatch(/import \{[^}]*\bwindowHotspot, fan,?\s*\} from '\.\/apartment\.ids';/);
    const after = parseScriptModel(ts, apartmentScript, result.text);
    expect(findHandlers(after, index, { kind: 'verb', target: fan, verbId: 'look' })).toHaveLength(1);
  });
});
