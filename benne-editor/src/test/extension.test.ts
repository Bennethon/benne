import * as assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { enqueueJsonFileWork, readInspectorJsonText } from '../inspectorJsonDocument';
import { applyRoomPolygonPatch, parseRoomPolygonPatch } from '../roomPolygonPatch';
import { applyCharacterGeometryPatch } from '../characterGeometryPatch';
import { writeDataJson } from '../inspectorMutations';

suite('BENNE extension integration', () => {
    let root: string;
    let uri: vscode.Uri;
    setup(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-editor-test-'));
        uri = vscode.Uri.file(path.join(root, 'room with spaces.json'));
        await fs.writeFile(uri.fsPath, JSON.stringify({ id: 'room', custom: 'preserve', points: [{ id: 'entry', x: 0, y: 0 }] }));
    });
    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await fs.rm(root, { recursive: true, force: true });
    });
    test('activates and registers every contributed command', async () => {
        const extension = vscode.extensions.getExtension('bennethon.benne-editor');
        assert.ok(extension, 'Installed development extension is missing');
        await extension.activate();
        const commands = new Set(await vscode.commands.getCommands(true));
        for (const command of extension.packageJSON.contributes.commands as { command: string }[]) {
            assert.ok(commands.has(command.command), `Not registered: ${command.command}`);
        }
    });
    test('an external operation waits while a save holds the same file lock', async () => {
        let release!: () => void;
        let entered!: () => void;
        const started = new Promise<void>(r => { entered = r; });
        const gate = new Promise<void>(r => { release = r; });
        const order: number[] = [];
        const first = enqueueJsonFileWork(uri, async () => { order.push(1); entered(); await gate; order.push(2); });
        await started;
        const second = enqueueJsonFileWork(uri, async () => { order.push(3); });
        await Promise.resolve();
        assert.deepEqual(order, [1]);
        release(); await Promise.all([first, second]);
        assert.deepEqual(order, [1, 2, 3]);
    });
    test('nested writes do not deadlock and failed work releases the queue', async () => {
        await enqueueJsonFileWork(uri, () => writeDataJson(uri, { id: 'nested' }));
        await assert.rejects(enqueueJsonFileWork(uri, async () => { throw Error('expected'); }), /expected/);
        assert.equal(await enqueueJsonFileWork(uri, async () => 7), 7);
    });
    test('different files proceed while one file is blocked', async () => {
        let release!: () => void;
        const gate = new Promise<void>(r => { release = r; });
        const first = enqueueJsonFileWork(uri, () => gate);
        try { assert.equal(await enqueueJsonFileWork(vscode.Uri.file(path.join(root, 'other.json')), async () => 3), 3); }
        finally { release(); await first; }
    });
    test('geometry patch preserves dirty authored fields and synchronizes disk and editor', async () => {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        const content = JSON.stringify({ id: 'room', custom: 'dirty edit', points: [{ id: 'entry', x: 0, y: 0 }] });
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), content);
        assert.equal(await vscode.workspace.applyEdit(edit), true);
        assert.equal(JSON.parse(await readInspectorJsonText(uri)).custom, 'dirty edit');
        const applied = await applyRoomPolygonPatch(uri, { kind: 'roomPoint', pointId: 'entry', x: 4.6, y: 8.2 });
        assert.deepEqual(applied, { kind: 'roomPoint', pointId: 'entry', x: 5, y: 8 });
        const disk = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
        assert.equal(disk.custom, 'dirty edit');
        assert.deepEqual(JSON.parse(document.getText()), disk);
        assert.equal(document.isDirty, false, 'Tool saves must leave the editor clean');
        assert.equal(await document.save(), true);
        await applyRoomPolygonPatch(uri, { kind: 'roomPoint', pointId: 'entry', x: 9, y: 12 });
        assert.equal(document.isDirty, false);
        assert.deepEqual(JSON.parse(await fs.readFile(uri.fsPath, 'utf8')), JSON.parse(document.getText()));
    });
    test('missing geometry targets leave bytes untouched', async () => {
        const before = await fs.readFile(uri.fsPath, 'utf8');
        await assert.rejects(applyRoomPolygonPatch(uri, { kind: 'roomPoint', pointId: 'missing', x: 1, y: 2 }));
        assert.equal(await fs.readFile(uri.fsPath, 'utf8'), before);
    });
    test('character geometry rounds coordinates and preserves unrelated fields', async () => {
        await applyCharacterGeometryPatch(uri, { feet: { x: 2.8, y: 4.1 }, walkToPoint: { x: 0, y: 1 }, talkPoint: { x: 2, y: 3 }, collider: null });
        const data = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
        assert.deepEqual(data.feet, { x: 3, y: 4 });
        assert.equal(data.custom, 'preserve');
    });
    test('webview patches reject non-finite coordinates', () => {
        for (const value of [NaN, Infinity, -Infinity]) {
            assert.equal(parseRoomPolygonPatch({ kind: 'roomPoint', pointId: 'entry', x: value, y: 1 }), null);
            assert.equal(parseRoomPolygonPatch({ kind: 'roomSize', width: value, height: 10 }), null);
            assert.equal(parseRoomPolygonPatch({ kind: 'walkable', polygonId: 'p', points: [{ x: value, y: 1 }] }), null);
        }
    });
});
