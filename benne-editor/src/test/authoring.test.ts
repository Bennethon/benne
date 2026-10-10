import * as assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
import { readRoomPlayFromNamesFromSource } from '../playFromDiscovery';

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
        } finally { await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
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
        } finally { await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
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
            await write('src/game/boot/constants.ts');
            const listed = [
                'src/engine/scripting/index.ts',
                'src/engine/scripting/types.ts',
                'src/engine/scripting/missing.ts',
                'src/types/generated/benne-game-ids.d.ts',
                'src/game/rooms/x/x.room.ts',
                'src/game/boot/constants.ts',
                '../outside.ts',
            ];
            const found = await findObsoleteEngineFiles(vscode.Uri.file(root), listed);
            assert.deepEqual(found, [
                'src/engine/scripting/index.ts',
                'src/engine/scripting/types.ts',
                'src/game/boot/constants.ts',
                'src/types/generated/benne-game-ids.d.ts',
            ]);
            await removeObsoleteEngineFiles(vscode.Uri.file(root), found);
            assert.equal(existsSync(path.join(root, 'src/engine/scripting')), false, 'emptied folder removed');
            assert.equal(existsSync(path.join(root, 'src/engine')), false, 'emptied parent removed');
            assert.equal(existsSync(path.join(root, 'src/types/generated/mine.d.ts')), true, "the game's own file stays");
            assert.equal(existsSync(path.join(root, 'src/game/rooms/x/x.room.ts')), true);
            assert.equal(existsSync(path.join(root, 'src/game/boot')), false, 'the old boot layer is removed');
            assert.equal(isRemovableEngineFile('src/game/boot/main.ts'), true);
            assert.equal(isRemovableEngineFile('src/game/rooms/x/x.room.ts'), false);
            assert.equal(isRemovableEngineFile('src/game/boot/../rooms/x/x.room.ts'), false);
            assert.equal(isRemovableEngineFile('src/engine/../game/a.ts'), false);
        } finally { await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
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
        } finally { await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    });
    test('Play From discovery excludes comments and deduplicates names', () => {
        const names = readRoomPlayFromNamesFromSource("import { playFrom } from '@benne/script';\n// playFrom('ignored', () => {})\nplayFrom('start', () => {})\nplayFrom('start', () => {})\nplayFrom('fix battery', () => {})");
        assert.deepEqual(names, ['start', 'fix battery']);
    });
});
