import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    buildPackageJson,
    compareSemver,
    copyTreeNonDestructive,
    findObsoleteEngineFiles,
    isRemovableEngineFile,
    mergeGamePackageJson,
    readScaffoldManifest,
    removeObsoleteEngineFiles,
} from '../scaffoldPayload';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readRoomPlayFromNamesFromSource } from '../playFromDiscovery';
import { addPropVerbEvent, addHotspotVerbEvent } from '../propVerbScaffolding';
import { addRoomInventoryUsedOnStub } from '../inventoryUsedOnScaffolding';
import { ensureRoomLifecycleHookInRoomScript } from '../roomLifecycleScriptScaffolding';
import { scriptHasHandler } from '../scriptHandlers';

/** The game in this repository (`src/game`, the 9-verb template), with its generated handles. */
const repoRoot = path.resolve(__dirname, '../../..');
const realGame = path.join(repoRoot, 'src', 'game');

/** Copies the apartment room, its generated handles and `@game` into a temporary `src/game`. */
async function apartmentGameCopy(): Promise<{ root: string; game: string }> {
    if (!existsSync(path.join(realGame, 'rooms', 'apartment', 'apartment.ids.ts'))) {
        execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], { cwd: repoRoot });
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-apartment-'));
    const game = path.join(root, 'src', 'game');
    await fs.mkdir(path.join(game, 'rooms', 'apartment'), { recursive: true });
    for (const file of ['apartment.room.ts', 'apartment.room.json', 'apartment.ids.ts']) {
        await fs.copyFile(path.join(realGame, 'rooms', 'apartment', file), path.join(game, 'rooms', 'apartment', file));
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
    test('engine update keeps a game\'s own lint script and adds the template one when missing', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-update-'));
        try {
            const pkg = path.join(root, 'package.json');
            await fs.writeFile(pkg, JSON.stringify({ name: 'g', scripts: { lint: 'eslint . && prettier --check .' } }));
            await mergeGamePackageJson(vscode.Uri.file(root));
            assert.equal(JSON.parse(await fs.readFile(pkg, 'utf8')).scripts.lint, 'eslint . && prettier --check .');
            await fs.writeFile(pkg, JSON.stringify({ name: 'g', scripts: {} }));
            await mergeGamePackageJson(vscode.Uri.file(root));
            assert.equal(JSON.parse(await fs.readFile(pkg, 'utf8')).scripts.lint, JSON.parse(buildPackageJson('g')).scripts.lint);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('engine update removes files the engine no longer ships, and only those', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-obsolete-'));
        try {
            const write = async (rel: string) => {
                await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
                await fs.writeFile(path.join(root, rel), 'x');
            };
            await write('src/engine/scripting/index.ts');
            await write('src/engine/scripting/types.ts');
            await write('src/types/generated/benne-game-ids.d.ts');
            await write('src/types/generated/mine.d.ts');
            await write('src/game/rooms/x/x.room.ts');
            const listed = [
                'src/engine/scripting/index.ts',
                'src/engine/scripting/types.ts',
                'src/engine/scripting/missing.ts',
                'src/types/generated/benne-game-ids.d.ts',
                'src/game/rooms/x/x.room.ts',
                '../outside.ts',
            ];
            const found = await findObsoleteEngineFiles(vscode.Uri.file(root), listed);
            assert.deepEqual(found, [
                'src/engine/scripting/index.ts',
                'src/engine/scripting/types.ts',
                'src/types/generated/benne-game-ids.d.ts',
            ]);
            await removeObsoleteEngineFiles(vscode.Uri.file(root), found);
            assert.equal(existsSync(path.join(root, 'src/engine/scripting')), false, 'emptied folder removed');
            assert.equal(existsSync(path.join(root, 'src/engine')), false, 'emptied parent removed');
            assert.equal(existsSync(path.join(root, 'src/types/generated/mine.d.ts')), true, "the game's own file stays");
            assert.equal(existsSync(path.join(root, 'src/game/rooms/x/x.room.ts')), true);
            assert.equal(isRemovableEngineFile('src/game/boot/main.ts'), false);
            assert.equal(isRemovableEngineFile('src/engine/../game/a.ts'), false);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('the bundled scaffold lists the old scripting API as removed', async () => {
        const extensionPath = path.resolve(__dirname, '../..');
        const manifest = await readScaffoldManifest(extensionPath);
        assert.ok(manifest.removedFiles?.includes('src/engine/scripting/registerRoomScript.ts'));
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
        const { root, game } = await apartmentGameCopy();
        try {
            const uri = vscode.Uri.file(path.join(game, 'rooms', 'apartment', 'apartment.room.ts'));
            const text = await fs.readFile(uri.fsPath, 'utf8');
            const couch = { kind: 'prop', roomId: 'apartment', id: 'Couch' } as const;
            assert.equal(scriptHasHandler(uri, text, { kind: 'verb', target: couch, verbId: 'look' }), true);
            assert.equal(scriptHasHandler(uri, text, { kind: 'verb', target: couch, verbId: 'pickUp' }), false);
            assert.equal(scriptHasHandler(uri, `${text}\n// couch.onPickUp(() => {})\n`, { kind: 'verb', target: couch, verbId: 'pickUp' }), false);
            assert.equal(scriptHasHandler(uri, text, { kind: 'anyItem', target: couch }), true);
            assert.equal(scriptHasHandler(uri, text, { kind: 'region', roomId: 'apartment', regionId: 'darkness', hook: 'onEnter' }), true);
            assert.equal(scriptHasHandler(uri, `${text}\nconst example = 'couch.onPickUp(() => {})'\n`, { kind: 'verb', target: couch, verbId: 'pickUp' }), false);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('Inspector "add handler" on a prop inserts a BenneScript handler', async () => {
        const { root, game } = await apartmentGameCopy();
        try {
            const roomJson = vscode.Uri.file(path.join(game, 'rooms', 'apartment', 'apartment.room.json'));
            const script = path.join(game, 'rooms', 'apartment', 'apartment.room.ts');
            const before = await fs.readFile(script, 'utf8');
            const r = await addPropVerbEvent(roomJson, 'apartment', 'Fan', 'look');
            assert.equal(r.ok, true);
            const after = await fs.readFile(script, 'utf8');
            assert.equal(after.slice(r.insertedStubRange!.start, r.insertedStubRange!.end), 'fan.onLook(() => {\n  // TODO: Look at\n})');
            assert.match(after, /import \{[^}]*\bwindowHotspot, fan,?\s*\} from '\.\/apartment\.ids';/);
            assert.equal(after.endsWith('fan.onLook(() => {\n  // TODO: Look at\n})\n'), true);
            // Only the import line changed above the new handler.
            const importLine = /^import \{[^}]*\} from '\.\/apartment\.ids';$/m;
            assert.equal(after.replace(importLine, '').startsWith(before.replace(importLine, '').trimEnd()), true);
            // A second "add" finds the handler instead of adding another.
            const again = await addPropVerbEvent(roomJson, 'apartment', 'Fan', 'look');
            assert.equal(again.insertedStubRange, undefined);
            assert.deepEqual(again.existingRange, { start: r.insertedStubRange!.start, end: r.insertedStubRange!.start + 'fan.onLook'.length });
            assert.equal(await fs.readFile(script, 'utf8'), after);
            // Other stubs use the same import and statement style.
            await addHotspotVerbEvent(roomJson, 'apartment', 'window', 'pickUp');
            await addRoomInventoryUsedOnStub(roomJson, 'apartment', 'prop', 'Fan');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'apartment', 'onLoaded');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'apartment', 'onUpdate');
            const final = await fs.readFile(script, 'utf8');
            assert.ok(final.includes('windowHotspot.onPickUp(() => {\n  // TODO: Pick up\n})'));
            assert.ok(final.includes('fan.onAnyItem(() => {'));
            assert.ok(final.includes('room.onLoaded(() => {\n  // TODO\n})'));
            assert.ok(final.includes('onUpdate(() => {\n  if (game.currentRoom !== room) return'));
            assert.match(final, /^import \{ [^}]*\bgame\b[^}]*\bonUpdate\b[^}]*\} from '@benne\/script';/);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('Play From discovery excludes comments and deduplicates names', () => {
        const names = readRoomPlayFromNamesFromSource("import { playFrom } from '@benne/script';\n// playFrom('ignored', () => {})\nplayFrom('start', () => {})\nplayFrom('start', () => {})\nplayFrom('fix battery', () => {})");
        assert.deepEqual(names, ['start', 'fix battery']);
    });
});
