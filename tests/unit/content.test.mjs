import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { validateGameContent } from '../../scripts/lib/validate-game-content.mjs';
import { scanGameContentIds } from '../../scripts/lib/scanGameContentIds.mjs';
const roots = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'benne-content-')); roots.push(root);
  const write = async (file, data) => { const p = path.join(root, file); await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(data)); };
  await write('game-config.json', { resolution: { width: 320, height: 180 }, startingPlayerCharacter: 'hero', startingRoomId: 'hall' });
  await write('rooms/rooms.manifest.json', { startRoomId: 'hall', rooms: [{ id: 'hall', definition: 'hall/hall.room.json' }] });
  await write('rooms/hall/hall.room.json', { id: 'hall', points: [{ id: 'entry', x: 0, y: 0 }] });
  await write('characters/hero/hero.character.json', { id: 'hero', display: { aseprite: true } });
  return { root, write };
}
it('accepts room points without confusing them with polygons', async () => {
  const { root } = await fixture(); expect(await validateGameContent(root)).toEqual([]);
});
it('reports malformed JSON, duplicate controls and broken grid references with locations', async () => {
  const { root, write } = await fixture();
  await write('guis/hud/hud.gui.json', { id: 'hud', controls: [{ id: 'b', type: 'button', gridPlacement: { gridControlId: 'absent' } }, { id: 'b', type: 'imaginary' }] });
  await writeFile(path.join(root, 'bad.json'), '{');
  const diagnostics = await validateGameContent(root);
  expect(diagnostics.some(d => d.file === 'bad.json' && d.field === '$')).toBe(true);
  expect(diagnostics.some(d => d.message === 'Duplicate ID: b')).toBe(true);
  expect(diagnostics.some(d => d.message === 'Unknown grid control')).toBe(true);
  expect(diagnostics.some(d => d.message === 'Unknown control: imaginary')).toBe(true);
});
it('rejects missing manifest entries and path traversal assets', async () => {
  const { root, write } = await fixture();
  await write('rooms/hall/hall.room.json', { id: 'hall', background: { image: '../secret.png' } });
  await write('rooms/rooms.manifest.json', { rooms: [{ id: 'bad', definition: 'bad.room.json' }] });
  const diagnostics = await validateGameContent(root);
  expect(diagnostics.some(d => d.message.includes('escapes'))).toBe(true);
  expect(diagnostics.some(d => d.message.includes('Missing room definition'))).toBe(true);
});
it('scanner sorts IDs, tolerates unfinished JSON and updates on deletion', async () => {
  const { root, write } = await fixture();
  await write('rooms/z/z.room.json', { id: 'z' });
  const first = await scanGameContentIds(root);
  expect(first.ids.roomIds).toEqual(['hall', 'z']);
  expect(await scanGameContentIds(root)).toEqual(first);
  await rm(path.join(root, 'rooms/z'), { recursive: true });
  expect((await scanGameContentIds(root)).ids.roomIds).toEqual(['hall']);
});
it('reports malformed collection shapes without crashing validation', async () => {
  const { root, write } = await fixture();
  await write('rooms/rooms.manifest.json', { startRoomId: 'hall', rooms: [null] });
  await write('rooms/hall/hall.room.json', { id: 'hall', characters: {}, walkable: { polygons: 'bad' } });
  await write('guis/hud/hud.gui.json', { id: 'hud', controls: [null] });
  const diagnostics = await validateGameContent(root);
  expect(diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: 'rooms[0]', message: 'Expected an object' }),
    expect.objectContaining({ field: 'characters', message: 'Expected an array' }),
    expect.objectContaining({ field: 'walkable.polygons', message: 'Expected an array' }),
    expect.objectContaining({ field: 'controls[0]', message: 'Expected an object' }),
  ]));
});
