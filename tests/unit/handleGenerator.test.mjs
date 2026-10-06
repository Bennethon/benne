// BenneScript handle generator (docs/bennescript-ergonomics-refactor.md §7, §8) and the verb
// checks validate-content shares with it.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { camelCaseId, pascalCaseId, roomScopedName } from '../../scripts/lib/benneNames.mjs';
import { buildSpeakerTable, resolveSpeaker, speakerTableWarnings } from '../../scripts/lib/benneSpeakers.mjs';
import { effectiveVerbs, gameDefaultVerb, verbConfigProblems } from '../../scripts/lib/benneVerbs.mjs';
import { GENERATED_MARKER, generateGameHandles } from '../../scripts/lib/generateGameHandles.mjs';
import { validateGameContent } from '../../scripts/lib/validate-game-content.mjs';

const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(files = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'benne-handles-'));
  roots.push(root);
  const write = async (file, data) => {
    const p = path.join(root, file);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, typeof data === 'string' ? data : JSON.stringify(data));
  };
  const base = {
    'game-config.json': {
      resolution: { width: 320, height: 180 },
      startingPlayerCharacter: 'hank',
      startingRoomId: 'club',
      verbs: [{ id: 'look', label: 'Look at' }, { id: 'use', label: 'Use', preposition: 'with' }, { id: 'clean' }],
    },
    'rooms/rooms.manifest.json': { startRoomId: 'club', rooms: [{ id: 'club', definition: 'club/club.room.json' }] },
    'rooms/club/club.room.json': {
      id: 'club',
      props: [{ id: 'antenna' }],
      hotspots: [{ id: 'club-hotspot-toolChest' }, { id: 'club-hotspot-battery' }],
      points: [{ id: 'club-point-standBack', x: 0, y: 0 }, { id: 'club-point-1', x: 0, y: 0 }],
      regions: [{ id: 'club-region-leave' }],
      walkable: { polygons: [{ id: 'club-walk', points: [] }] },
      characters: [{ instanceId: 'h', definition: 'hank/hank.character.json', x: 0, y: 0 }],
    },
    'characters/hank/hank.character.json': { id: 'hank', name: 'Hank', display: { aseprite: true } },
    'inventory/soda/soda.inventory.json': { id: 'soda', name: 'Soda', display: { aseprite: 'shared' } },
    'dialogs/driver/driver.dialog.json': { id: 'driver', options: [{ id: 'fix battery', text: 'x' }, { id: 'what about AI', text: 'y' }] },
    'guis/game-menu/game-menu.gui.json': { id: 'game-menu', controls: [{ id: 'title-screen', type: 'button' }] },
    'assets/audio/sfx/body-fall.wav': '',
    'assets/audio/music/plaza.mp3': '',
    'assets/images/inventory/inventory.json': { frames: {}, meta: { frameTags: [{ name: 'soda' }, { name: 'soda-empty' }] } },
  };
  for (const [file, data] of Object.entries({ ...base, ...files })) {
    if (data !== undefined) await write(file, data);
  }
  return { root, write };
}

describe('naming (§7.2)', () => {
  it('camelCases IDs and strips room prefixes and kind words', () => {
    expect(camelCaseId('what about AI')).toBe('whatAboutAI');
    expect(camelCaseId('AI problem')).toBe('aiProblem');
    expect(camelCaseId('botti3-disembodied')).toBe('botti3Disembodied');
    expect(camelCaseId('TakeBtn')).toBe('takeBtn');
    expect(camelCaseId('body-fall')).toBe('bodyFall');
    expect(pascalCaseId('talkTo')).toBe('TalkTo');
    expect(pascalCaseId('pick-up')).toBe('PickUp');
    expect(roomScopedName('club', 'club-hotspot-toolChest', 'hotspot')).toBe('toolChest');
    expect(roomScopedName('plaza', 'plaza-point-first-visit-jensen', 'point')).toBe('firstVisitJensen');
    expect(roomScopedName('plaza', 'plaza-region-garage-exit', 'region')).toBe('garageExit');
    expect(roomScopedName('cafe', 'cafe-walk', 'walkable')).toBe('walk');
    expect(roomScopedName('cafe', 'cleaning-stuff', 'hotspot')).toBe('cleaningStuff');
    // Nothing usable left after stripping: keep the whole ID (the spec's `points.labPoint1`).
    expect(roomScopedName('lab', 'lab-point-1', 'point')).toBe('labPoint1');
  });
});

describe('verbs (§8)', () => {
  it('usesItem defaults to true for verbs with a preposition (decision 7)', () => {
    const verbs = effectiveVerbs({
      verbs: [{ id: 'use', preposition: 'with' }, { id: 'give', preposition: 'to', usesItem: false }, { id: 'throw', usesItem: true }, { id: 'talkTo' }],
    });
    expect(verbs.map((v) => [v.id, v.method, v.itemMethod])).toEqual([
      ['use', 'onUse', 'onUseItem'],
      ['give', 'onGive', null],
      ['throw', 'onThrow', 'onThrowItem'],
      ['talkTo', 'onTalkTo', null],
    ]);
    // No verbs configured: the engine's look + use.
    expect(effectiveVerbs({}).map((v) => v.itemMethod)).toEqual([null, 'onUseItem']);
  });

  it('game-level defaultVerb: configured, else look, else the first verb (decision 8)', () => {
    expect(gameDefaultVerb({ verbs: [{ id: 'use' }, { id: 'look' }], defaultVerb: 'use' })).toBe('use');
    expect(gameDefaultVerb({ verbs: [{ id: 'use' }, { id: 'look' }] })).toBe('look');
    expect(gameDefaultVerb({ verbs: [{ id: 'interact' }, { id: 'talk' }] })).toBe('interact');
  });

  it('reports reserved verb IDs, generated-name collisions and unknown verb references', () => {
    const problems = verbConfigProblems({
      verbs: [{ id: 'walkTo' }, { id: 'combine' }, { id: 'use', preposition: 'with' }, { id: 'useItem' }, { id: '3d' }],
      defaultVerb: 'smell',
      inputProfile: { primaryButtonVerb: 'walkTo', secondaryButtonVerb: 'lick' },
    });
    const messages = problems.map((p) => `${p.field}: ${p.message}`);
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringMatching(/^verbs\[0\]\.id: Verb ID "walkTo" is reserved/),
      expect.stringMatching(/^verbs\[1\]\.id: Verb ID "combine" is reserved.*onCombine/),
      'verbs[3].id: Verbs "use" and "useItem" both generate `onUseItem`. Rename one of them.',
      'verbs[4].id: Verb ID "3d" must start with a letter.',
      'defaultVerb: Unknown verb: smell',
      expect.stringMatching(/^inputProfile\.secondaryButtonVerb: Unknown verb: lick/),
    ]));
    expect(messages.some((m) => m.startsWith('inputProfile.primaryButtonVerb'))).toBe(false);
  });

  it('validate-content checks every verb ID in content JSON', async () => {
    const { root } = await fixture({
      'rooms/club/club.room.json': { id: 'club', props: [{ id: 'antenna', defaultVerb: 'take' }], hotspots: [{ id: 'h', defaultVerb: 'clean' }] },
      'characters/hank/hank.character.json': { id: 'hank', display: { aseprite: true }, defaultVerb: 'talkTo' },
      'inventory/soda/soda.inventory.json': { id: 'soda', display: { aseprite: 'shared' }, defaultVerb: 'use', onVerb: { look: true, drink: true } },
    });
    const unknown = (await validateGameContent(root)).filter((d) => d.message.startsWith('Unknown verb'));
    expect(unknown.map((d) => `${d.file} ${d.field}`)).toEqual([
      'characters/hank/hank.character.json defaultVerb',
      'inventory/soda/soda.inventory.json onVerb.drink',
      'rooms/club/club.room.json props[0].defaultVerb',
    ]);
  });
});

describe('generator', () => {
  it('generates @game and the room, dialog and GUI modules', async () => {
    const { root } = await fixture();
    const { files, errors, warnings } = generateGameHandles(root);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect([...files.keys()].sort()).toEqual([
      'dialogs/driver/driver.ids.ts',
      'game.ids.ts',
      'guis/game-menu/game-menu.ids.ts',
      'rooms/club/club.ids.ts',
    ]);
    for (const text of files.values()) expect(text.startsWith(GENERATED_MARKER)).toBe(true);

    const room = files.get('rooms/club/club.ids.ts');
    expect(room).toContain('export const room = rooms.club;');
    expect(room).toContain('export const antenna = __withVerbs(new PropHandle<VerbId, PropAnimation>("club", "antenna"));');
    expect(room).toContain('export const toolChest = __withVerbs(new HotspotHandle<VerbId>("club", "club-hotspot-toolChest"));');
    expect(room).toContain('export const hank = __withVerbs(new CharacterHandle<VerbId, string>("club", "hank"));');
    expect(room).toContain('standBack: new PointHandle("club", "club-point-standBack"),');
    expect(room).toContain('clubPoint1: new PointHandle("club", "club-point-1"),');
    expect(room).toContain('leave: new RegionHandle("club", "club-region-leave"),');
    expect(room).toContain('walk: new WalkableHandle("club", "club-walk"),');

    const game = files.get('game.ids.ts');
    expect(game).toContain('export type VerbId = "look" | "use" | "clean";');
    expect(game).toContain('export type ItemVerbId = "use";');
    expect(game).toContain('onUseItem(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions): void;');
    expect(game).toContain('export const sfx = withSfxControls(');
    expect(game).toContain('export const video = withVideoControls(');
    expect(game).not.toContain('onLookItem');
    expect(game).toContain('onUseItem(handler: (item: ItemRef, target: FallbackTarget) => void): void;');
    expect(game).toContain('type SharedItemAnimation = "soda" | "soda-empty";');
    expect(game).toContain('whatAboutAI: "what about AI",');
    expect(game).toContain('titleScreen: "title-screen",');
    expect(game).toContain('bodyFall: new SfxHandle("body-fall"),');
    expect(game).toContain('export const flags = defineFlags({});');

    expect(files.get('dialogs/driver/driver.ids.ts')).toContain('export const dialog = dialogs.driver;');
    expect(files.get('guis/game-menu/game-menu.ids.ts')).toContain('export const titleScreen = gui.controls.titleScreen;');
  });

  it('re-exports flags and vars from state.ts when the game has one', async () => {
    const { root } = await fixture({ 'state.ts': 'export const flags = {}; export const vars = {};' });
    expect(generateGameHandles(root).files.get('game.ids.ts')).toContain("export { flags, vars } from './state';");
  });

  it('a collision is an error that names both IDs and asks for a scriptName; scriptName fixes it', async () => {
    const collide = { id: 'club', props: [{ id: 'battery' }], hotspots: [{ id: 'club-hotspot-battery' }] };
    const { root, write } = await fixture({ 'rooms/club/club.room.json': collide });
    const { files, errors } = generateGameHandles(root);
    expect(files.size).toBe(0);
    expect(errors).toEqual([
      'rooms/club/club.ids.ts: prop "battery" (rooms/club/club.room.json props[0]) and hotspot "club-hotspot-battery" ' +
        '(rooms/club/club.room.json hotspots[0]) both become `battery`. Add a "scriptName" to one of them in rooms/club/club.room.json.',
    ]);

    await write('rooms/club/club.room.json', { ...collide, hotspots: [{ id: 'club-hotspot-battery', scriptName: 'batteryHotspot' }] });
    const fixed = generateGameHandles(root);
    expect(fixed.errors).toEqual([]);
    expect(fixed.files.get('rooms/club/club.ids.ts')).toContain('export const batteryHotspot = __withVerbs(new HotspotHandle<VerbId>("club", "club-hotspot-battery"));');
  });

  it('sound files that make the same name must be renamed', async () => {
    const { root } = await fixture({ 'assets/audio/sfx/bodyFall.ogg': '' });
    expect(generateGameHandles(root).errors).toEqual([
      expect.stringMatching(/^sfx: sound "body-fall" .* and sound "bodyFall" .* both become `bodyFall`\. Rename one of the files\.$/),
    ]);
  });

  it('sound and video files named like their namespace controls must be renamed', async () => {
    const { root } = await fixture({ 'assets/audio/sfx/stop-all.wav': '', 'assets/videos/pause.mp4': '' });
    const errors = generateGameHandles(root).errors.join('\n');
    expect(errors).toMatch(/sound "stop-all" .*`stopAll`/);
    expect(errors).toMatch(/video "pause" .*`pause`/);
  });

  it('reserved and BenneScript names get a trailing _ and a warning; browser globals warn', async () => {
    const { root } = await fixture({
      'rooms/club/club.room.json': { id: 'club', props: [{ id: 'default' }, { id: 'wait' }], hotspots: [{ id: 'club-hotspot-window' }] },
      'guis/game-menu/game-menu.gui.json': { id: 'game-menu', controls: [{ id: 'settings', type: 'button' }, { id: 'gui', type: 'text' }] },
    });
    const { files, errors, warnings } = generateGameHandles(root);
    expect(errors).toEqual([]);
    expect(files.get('rooms/club/club.ids.ts')).toContain('export const default_ =');
    expect(files.get('rooms/club/club.ids.ts')).toContain('export const wait_ =');
    expect(files.get('rooms/club/club.ids.ts')).toContain('export const window =');
    expect(files.get('guis/game-menu/game-menu.ids.ts')).toContain('export const settings_ = gui.controls.settings_;');
    expect(files.get('guis/game-menu/game-menu.ids.ts')).toContain('export const gui_ = gui.controls.gui_;');
    expect(warnings).toEqual([
      expect.stringContaining('`settings` is a BenneScript name, so it is `settings_`'),
      expect.stringContaining('`gui` is a BenneScript name, so it is `gui_`'),
      expect.stringContaining('`default` is a reserved word, so it is `default_`'),
      expect.stringContaining('`wait` is a BenneScript name, so it is `wait_`'),
      expect.stringContaining('`window` shadows the browser global'),
    ]);
  });

  it('rejects scriptNames that are not identifiers or are reserved', async () => {
    const { root } = await fixture({
      'rooms/club/club.room.json': { id: 'club', props: [{ id: 'a', scriptName: 'two words' }, { id: 'b', scriptName: 'room' }] },
    });
    expect(generateGameHandles(root).errors).toEqual([
      expect.stringContaining('"scriptName" must be a valid identifier (got "two words")'),
      expect.stringContaining('"scriptName" `room` is reserved in rooms/club/club.ids.ts'),
    ]);
  });

  it('reserved verb IDs stop generation', async () => {
    const { root } = await fixture({
      'game-config.json': { resolution: { width: 1, height: 1 }, startingPlayerCharacter: 'hank', verbs: [{ id: 'look' }, { id: 'anyItem' }] },
    });
    expect(generateGameHandles(root).errors).toEqual([expect.stringMatching(/^game-config\.json verbs\[1\]\.id: Verb ID "anyItem" is reserved/)]);
  });

  it('reports ambiguous speaker labels (decision 4)', async () => {
    const { root } = await fixture({
      'characters/botti3/botti3.character.json': { id: 'botti3', name: 'BOTT-i3', display: { aseprite: true } },
      'characters/bott-i3/bott-i3.character.json': { id: 'bott-i3', name: 'Copy', display: { aseprite: true } },
    });
    expect(generateGameHandles(root).warnings).toEqual([
      expect.stringContaining('Speaker label `botti3` matches more than one character (bott-i3, botti3)'),
    ]);
    const table = buildSpeakerTable([{ id: 'botti3', name: 'BOTT-i3' }, { id: 'bott-i3', name: 'Copy' }]);
    expect(resolveSpeaker('BOTTi3', table)).toEqual({ error: expect.stringContaining('matches more than one character: bott-i3, botti3') });
    expect(resolveSpeaker('Copy', table)).toEqual({ id: 'bott-i3' });
    expect(speakerTableWarnings(buildSpeakerTable([{ id: 'player', name: 'P' }]))).toEqual([expect.stringContaining('is named "player"')]);
  });
});
