import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { compareSemver, mergeGamePackageJson, copyTreeNonDestructive, buildPackageJson } from '../scaffoldPayload';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readRoomPlayFromNamesFromSource } from '../playFromDiscovery';
import { addPropVerbEvent, addHotspotVerbEvent } from '../propVerbScaffolding';
import { addRoomInventoryUsedOnStub } from '../inventoryUsedOnScaffolding';
import { ensureRoomLifecycleHookInRoomScript } from '../roomLifecycleScriptScaffolding';
import { scriptHasHandler } from '../scriptHandlers';

/** The real AI Apocalypse game in this repository (`src/game`), with its generated handles. */
const repoRoot = path.resolve(__dirname, '../../..');
const realGame = path.join(repoRoot, 'src', 'game');

/** Copies the club room, its generated handles and `@game` into a temporary `src/game`. */
async function clubGameCopy(): Promise<{ root: string; game: string }> {
    if (!existsSync(path.join(realGame, 'rooms', 'club', 'club.ids.ts'))) {
        execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], { cwd: repoRoot });
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-club-'));
    const game = path.join(root, 'src', 'game');
    await fs.mkdir(path.join(game, 'rooms', 'club'), { recursive: true });
    for (const file of ['club.room.ts', 'club.room.json', 'club.ids.ts']) {
        await fs.copyFile(path.join(realGame, 'rooms', 'club', file), path.join(game, 'rooms', 'club', file));
    }
    await fs.copyFile(path.join(realGame, 'game.ids.ts'), path.join(game, 'game.ids.ts'));
    return { root, game };
}

suite('Authoring and update contracts', () => {
    test('semver compares numeric components', () => {
        assert.equal(Math.sign(compareSemver('0.10.0', '0.9.9')), 1);
        assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
        assert.equal(Math.sign(compareSemver('1.0.0', '2.0.0')), -1);
    });
    test('engine update preserves custom package metadata, dependencies and scripts', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-update-'));
        try {
            const before = { name: 'custom-game', version: '3.2.1', benne: { displayName: 'My Game' }, scripts: { custom: 'echo hello', build: 'old build' }, dependencies: { phaser: 'old', custom: '1.0.0' }, devDependencies: { helper: '2.0.0' } };
            await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(before));
            await mergeGamePackageJson(vscode.Uri.file(root));
            const actual = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
            const expected = JSON.parse(buildPackageJson('custom-game'));
            assert.deepEqual(actual.benne, before.benne);
            assert.equal(actual.version, before.version);
            assert.equal(actual.scripts.custom, before.scripts.custom);
            assert.equal(actual.scripts.build, expected.scripts.build);
            assert.equal(actual.dependencies.custom, '1.0.0');
            assert.equal(actual.dependencies.phaser, expected.dependencies.phaser);
            assert.equal(actual.devDependencies.helper, '2.0.0');
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('non-destructive scaffolding preserves existing authored bytes', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-copy-'));
        try {
            const source = path.join(root, 'source'), target = path.join(root, 'target');
            await fs.mkdir(source); await fs.mkdir(target);
            await fs.writeFile(path.join(source, 'existing.txt'), 'template');
            await fs.writeFile(path.join(source, 'new.txt'), 'new');
            await fs.writeFile(path.join(target, 'existing.txt'), 'authored');
            await copyTreeNonDestructive(source, target);
            assert.equal(await fs.readFile(path.join(target, 'existing.txt'), 'utf8'), 'authored');
            assert.equal(await fs.readFile(path.join(target, 'new.txt'), 'utf8'), 'new');
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('handler detection reads BenneScript registrations, not comments', async () => {
        const { root, game } = await clubGameCopy();
        try {
            const uri = vscode.Uri.file(path.join(game, 'rooms', 'club', 'club.room.ts'));
            const text = await fs.readFile(uri.fsPath, 'utf8');
            const battery = { kind: 'hotspot', roomId: 'club', id: 'club-hotspot-battery' } as const;
            assert.equal(scriptHasHandler(uri, text, { kind: 'verb', target: battery, verbId: 'look' }), true);
            assert.equal(scriptHasHandler(uri, text, { kind: 'verb', target: battery, verbId: 'take' }), false);
            assert.equal(scriptHasHandler(uri, `${text}\n// battery.onTake(() => {})\n`, { kind: 'verb', target: battery, verbId: 'take' }), false);
            assert.equal(scriptHasHandler(uri, text, { kind: 'anyItem', target: battery }), true);
            assert.equal(scriptHasHandler(uri, text, { kind: 'region', roomId: 'club', regionId: 'club-region-leave', hook: 'onEnter' }), true);
            // Old-API scripts are not read (the editor only understands the new syntax).
            assert.equal(scriptHasHandler(uri, "registerRoomScript(({ B }) => { B.whenLookAt('club-hotspot-battery', () => {}); });", { kind: 'verb', target: battery, verbId: 'look' }), false);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('Inspector "add handler" on an AI Apocalypse prop inserts a new-style handler', async () => {
        const { root, game } = await clubGameCopy();
        try {
            const roomJson = vscode.Uri.file(path.join(game, 'rooms', 'club', 'club.room.json'));
            const script = path.join(game, 'rooms', 'club', 'club.room.ts');
            const before = await fs.readFile(script, 'utf8');
            const r = await addPropVerbEvent(roomJson, 'club', 'bg', 'look');
            assert.equal(r.ok, true);
            const after = await fs.readFile(script, 'utf8');
            assert.equal(after.slice(r.insertedStubRange!.start, r.insertedStubRange!.end), 'bg.onLook(() => {\n  // TODO: Look at\n})');
            assert.match(after, /toolChest, bg,\n\} from '\.\/club\.ids';/);
            assert.equal(after.endsWith('bg.onLook(() => {\n  // TODO: Look at\n})\n'), true);
            assert.equal(after.replace('toolChest, bg,\n}', 'toolChest,\n}').startsWith(before.trimEnd()), true);
            // A second "add" finds the handler instead of adding another.
            const again = await addPropVerbEvent(roomJson, 'club', 'bg', 'look');
            assert.equal(again.insertedStubRange, undefined);
            assert.deepEqual(again.existingRange, { start: r.insertedStubRange!.start, end: r.insertedStubRange!.start + 'bg.onLook'.length });
            assert.equal(await fs.readFile(script, 'utf8'), after);
            // Other stubs use the same import and statement style.
            await addHotspotVerbEvent(roomJson, 'club', 'outside', 'take');
            await addRoomInventoryUsedOnStub(roomJson, 'club', 'prop', 'car');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'club', 'whenEnterRoom');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'club', 'onUpdate');
            const final = await fs.readFile(script, 'utf8');
            assert.ok(final.includes('outside.onTake(() => {\n  // TODO: Take\n})'));
            assert.ok(final.includes('car.onAnyItem(() => {'));
            assert.ok(final.includes('room.onEnter(() => {\n  // TODO\n})'));
            assert.ok(final.includes('onUpdate(() => {\n  if (game.currentRoom !== room) return'));
            assert.match(final, /^import \{ [^}]*\bgame\b[^}]*\bonUpdate\b[^}]*\} from '@benne\/script';/);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('Play From discovery excludes comments and deduplicates names', () => {
        const names = readRoomPlayFromNamesFromSource("import { playFrom } from '@benne/script';\n// playFrom('ignored', () => {})\nplayFrom('start', () => {})\nplayFrom('start', () => {})\nplayFrom('fix battery', () => {})");
        assert.deepEqual(names, ['start', 'fix battery']);
    });
});
