import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { compareSemver, mergeGamePackageJson, copyTreeNonDestructive, buildPackageJson } from '../scaffoldPayload';
import { readRoomPlayFromNamesFromSource } from '../playFromDiscovery';
import { roomScriptRegistersPropVerb, scriptRegistersWhenInventoryUsedOn } from '../verbHandlerPresence';

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
    test('handler detection ignores commented handlers and recognizes literal calls', () => {
        const verbs = new Set(['look', 'use']);
        assert.equal(roomScriptRegistersPropVerb("// B.whenLookAt('door', () => {});", 'a', 'door', 'look', verbs), false);
        assert.equal(roomScriptRegistersPropVerb("B.whenLookAt('door', () => { const nested = () => {}; });", 'a', 'door', 'look', verbs), true);
        assert.equal(scriptRegistersWhenInventoryUsedOn("B.whenInventoryUsedOn('door', () => {});", 'door'), true);
    });
    test('Play From discovery excludes comments and deduplicates names', () => {
        const names = readRoomPlayFromNamesFromSource("// B.playFrom('ignored', () => {});\nB.playFrom('start', () => {});\nB.playFrom('start', () => {});");
        assert.deepEqual(names, ['start']);
    });
});
