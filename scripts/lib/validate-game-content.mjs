import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { effectiveVerbs, verbConfigProblems } from './benneVerbs.mjs';

const kinds = ['room', 'character', 'gui', 'inventory', 'dialog'];
const controls = new Set(['text', 'inventoryPanel', 'grid', 'nineSliceImage', 'image', 'button', 'checkbox', 'slider', 'textInput', 'listBox', 'trigger']);
const rows = value => Array.isArray(value) ? value.filter(object) : [];
const entries = value => Array.isArray(value) ? [...value.entries()].filter(([, row]) => object(row)) : [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export async function validateGameContent(root) {
  const diagnostics = [];
  const files = new Map();
  const add = (file, field, message, severity = 'error') => diagnostics.push({ file, field, severity, message });
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.name.endsWith('.json')) {
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        try { files.set(relative, JSON.parse(await readFile(absolute, 'utf8'))); }
        catch (error) { add(relative, '$', `Invalid JSON: ${error.message.split('\n')[0]}`); }
      }
    }
  }
  await walk(root);
  const entities = Object.fromEntries(kinds.map(k => [k, new Map()]));
  for (const [file, value] of files) {
    const kind = kinds.find(k => file.endsWith(`.${k}.json`));
    if (!kind) continue;
    if (!object(value) || typeof value.id !== 'string' || !value.id.trim()) { add(file, 'id', 'Expected a nonempty entity ID'); continue; }
    if (entities[kind].has(value.id)) add(file, 'id', `Duplicate ${kind} ID: ${value.id}`);
    entities[kind].set(value.id, { file, value });
  }
  async function asset(file, field, relative) {
    if (typeof relative !== 'string' || !relative) { add(file, field, 'Expected an asset path'); return; }
    const base = path.resolve(root, 'assets');
    const target = path.resolve(base, relative.replaceAll('\\', '/'));
    if (!target.startsWith(base + path.sep)) { add(file, field, 'Asset path escapes assets directory'); return; }
    try { await access(target); } catch { add(file, field, `Missing asset: ${relative}`); }
  }
  function ids(file, field, rows, key = 'id') {
    if (rows === undefined) return;
    if (!Array.isArray(rows)) { add(file, field, 'Expected an array'); return; }
    const seen = new Set();
    rows.forEach((row, i) => {
      if (!object(row)) { add(file, `${field}[${i}]`, 'Expected an object'); return; }
      const id = row[key];
      if (id === undefined && field === 'controls') return;
      if (typeof id !== 'string' || !id) add(file, `${field}[${i}].${key}`, 'Expected a nonempty ID');
      else if (seen.has(id)) add(file, `${field}[${i}].${key}`, `Duplicate ID: ${id}`);
      seen.add(id);
    });
  }
  function geometry(file, value, field = '$') {
    if (!object(value) && !Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const at = `${field}.${key}`;
      if (['x', 'y', 'width', 'height', 'baseline', 'zIndex'].includes(key) && typeof child === 'number' && !Number.isFinite(child)) add(file, at, 'Expected a finite number');
      if (['width', 'height'].includes(key) && typeof child === 'number' && child <= 0) add(file, at, 'Expected a positive dimension');
      if (key === 'points' && field !== '$' && Array.isArray(child) && child.length && object(child[0]) && 'x' in child[0]) {
        // Empty/uncompleted geometry is valid while authoring, but unusable at runtime.
        if (child.length < 3 && value.active !== false) add(file, at, 'Polygon has fewer than three vertices', 'warning');
        child.forEach((p, i) => { if (!object(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) add(file, `${at}[${i}]`, 'Expected finite x/y coordinates'); });
      }
      geometry(file, child, at);
    }
  }
  const config = files.get('game-config.json');
  if (!object(config)) add('game-config.json', '$', 'Missing or invalid game configuration');
  else {
    if (!object(config.resolution) || !Number.isFinite(config.resolution.width) || !Number.isFinite(config.resolution.height) || config.resolution.width <= 0 || config.resolution.height <= 0) add('game-config.json', 'resolution', 'Expected positive finite width/height');
    if (!entities.character.has(config.startingPlayerCharacter)) add('game-config.json', 'startingPlayerCharacter', `Unknown character: ${config.startingPlayerCharacter}`);
    if (config.startingRoomId && !entities.room.has(config.startingRoomId)) add('game-config.json', 'startingRoomId', `Unknown room: ${config.startingRoomId}`);
    ids('game-config.json', 'verbs', config.verbs);
    for (const p of verbConfigProblems(config)) add('game-config.json', p.field, p.message);
    const inventory = config.initialGameState?.inventory;
    for (const id of Array.isArray(inventory) ? inventory : Object.keys(inventory ?? {})) if (!entities.inventory.has(id)) add('game-config.json', 'initialGameState.inventory', `Unknown inventory item: ${id}`);
  }
  const manifest = files.get('rooms/rooms.manifest.json');
  if (!Array.isArray(manifest?.rooms)) add('rooms/rooms.manifest.json', 'rooms', 'Missing room manifest');
  else {
    ids('rooms/rooms.manifest.json', 'rooms', manifest.rooms);
    for (const [i, row] of manifest.rooms.entries()) {
      if (!object(row)) continue;
      const target = `rooms/${row.definition}`;
      if (!files.has(target)) add('rooms/rooms.manifest.json', `rooms[${i}].definition`, `Missing room definition: ${row.definition}`);
      else if (files.get(target)?.id !== row.id) add('rooms/rooms.manifest.json', `rooms[${i}].id`, 'Manifest and room IDs differ');
    }
    if (!entities.room.has(config?.startingRoomId ?? manifest.startRoomId)) add('rooms/rooms.manifest.json', 'startRoomId', 'Starting room does not exist');
  }
  // Every verb ID in content JSON must be a configured verb (§8.4).
  const verbIds = new Set(effectiveVerbs(object(config) ? config : {}).map(v => v.id));
  const verb = (file, field, id) => {
    if (id === undefined) return;
    if (typeof id !== 'string' || !verbIds.has(id)) add(file, field, `Unknown verb: ${id} (game-config.json verbs: ${[...verbIds].join(', ')})`);
  };
  for (const kind of kinds) for (const { file, value } of entities[kind].values()) {
    geometry(file, value);
    if (kind === 'room') for (const field of ['props', 'hotspots']) for (const [i, row] of entries(value[field])) verb(file, `${field}[${i}].defaultVerb`, row.defaultVerb);
    if (kind === 'character' || kind === 'inventory') verb(file, 'defaultVerb', value.defaultVerb);
    if (kind === 'inventory' && object(value.onVerb)) for (const id of Object.keys(value.onVerb)) verb(file, `onVerb.${id}`, id);
    if (kind === 'room') {
      for (const field of ['props', 'hotspots', 'points', 'regions']) ids(file, field, value[field]);
      ids(file, 'characters', value.characters, 'instanceId');
      ids(file, 'walkable.polygons', value.walkable?.polygons);
      for (const [i, polygon] of entries(value.walkable?.polygons)) ids(file, `walkable.polygons[${i}].holes`, polygon.holes);
      for (const [i, spawn] of entries(value.characters)) if (!files.has(`characters/${spawn.definition}`)) add(file, `characters[${i}].definition`, `Missing character definition: ${spawn.definition}`);
    }
    if (kind === 'character' && value.display?.aseprite !== true) await asset(file, 'display.defaultImage', value.display?.defaultImage);
    if (kind === 'gui') {
      ids(file, 'controls', value.controls);
      const grids = new Set(rows(value.controls).filter(c => c.type === 'grid').map(c => c.id));
      for (const [i, control] of entries(value.controls)) {
        if (!controls.has(control.type)) add(file, `controls[${i}].type`, `Unknown control: ${control.type}`);
        if (control.gridPlacement && !grids.has(control.gridPlacement.gridControlId)) add(file, `controls[${i}].gridPlacement`, 'Unknown grid control');
        if (control.font && !files.get('assets/fonts/fonts.json')?.[control.font]) add(file, `controls[${i}].font`, `Unknown font: ${control.font}`);
      }
    }
    if (kind === 'dialog') ids(file, 'options', value.options);
  }
  for (const [id, font] of Object.entries(files.get('assets/fonts/fonts.json') ?? {})) {
    await asset('assets/fonts/fonts.json', `${id}.textureFile`, `fonts/${font?.textureFile}`);
    await asset('assets/fonts/fonts.json', `${id}.dataFile`, `fonts/${font?.dataFile}`);
  }
  for (const [file, atlas] of files) if (file.startsWith('assets/') && atlas?.meta?.frameTags) {
    ids(file, 'meta.frameTags', atlas.meta.frameTags, 'name');
    const count = Object.keys(atlas.frames ?? {}).length;
    for (const [i, tag] of entries(atlas.meta.frameTags)) if (!Number.isInteger(tag.from) || !Number.isInteger(tag.to) || tag.from < 0 || tag.to < tag.from || tag.to >= count) add(file, `meta.frameTags[${i}]`, 'Invalid frame range');
    // BENNE resolves paired sheets by convention, not Aseprite's potentially stale meta.image.
    await asset(file, 'frames', file.slice(7).replace(/\.json$/, '.png'));
  }
  return diagnostics.sort((a, b) => `${a.file}:${a.field}:${a.message}`.localeCompare(`${b.file}:${b.field}:${b.message}`));
}
