import * as assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { StateWebviewViewProvider, type StateViewOptions } from '../stateWebviewViewProvider';

/** A tiny game with its own `defineFlags` (the same mapped type as the engine's), so TypeScript can rename through it. */
async function makeGame(withState = true): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'benne-state-'));
    const write = async (rel: string, text: string): Promise<void> => {
        await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
        await fs.writeFile(path.join(root, rel), text);
    };
    await write(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', noEmit: true }, include: ['src'] })
    );
    await write(
        'src/benne.ts',
        [
            'export function defineFlags<T extends Record<string, boolean>>(d: T): { -readonly [K in keyof T]: boolean } {',
            '  return { ...d };',
            '}',
            'export function defineVars<T extends Record<string, unknown>>(d: T): { -readonly [K in keyof T]: T[K] } {',
            '  return { ...d };',
            '}',
            ''
        ].join('\n')
    );
    if (withState) {
        await write(
            'src/game/state.ts',
            [
                "import { defineFlags, defineVars } from '../benne';",
                '',
                'export const flags = defineFlags({',
                '  // Hall',
                '  gotKey: false,',
                '  doorOpen: false,',
                '});',
                '',
                'export const vars = defineVars({',
                '  coins: 0,',
                '});',
                ''
            ].join('\n')
        );
    }
    await write(
        'src/game/rooms/hall/hall.room.ts',
        ["import { flags } from '../../state';", '', 'export function onUse(): boolean {', '  return flags.gotKey;', '}', ''].join('\n')
    );
    return root;
}

function provider(root: string, options: Omit<StateViewOptions, 'locate'> = {}): StateWebviewViewProvider {
    const folder: vscode.WorkspaceFolder = { uri: vscode.Uri.file(root), name: 'game', index: 0 };
    const extensionUri = vscode.Uri.file(path.resolve(__dirname, '../..'));
    return new StateWebviewViewProvider(extensionUri, {
        ...options,
        locate: async () => ({ folder, uri: vscode.Uri.joinPath(folder.uri, 'src', 'game', 'state.ts') })
    });
}

const read = (root: string, rel: string): Promise<string> => fs.readFile(path.join(root, rel), 'utf8');

suite('State view', () => {
    const roots: string[] = [];
    const disposables: vscode.Disposable[] = [];

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        for (const d of disposables.splice(0)) {
            d.dispose();
        }
        for (const root of roots.splice(0)) {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    async function setup(withState = true, options: Omit<StateViewOptions, 'locate'> = {}) {
        const root = await makeGame(withState);
        roots.push(root);
        const view = provider(root, options);
        disposables.push(view);
        return { root, view };
    }

    test('shows the flags and vars of state.ts', async () => {
        const { view } = await setup();
        const payload = await view.payload();
        assert.equal(payload.status, 'ready');
        if (payload.status !== 'ready') {
            return;
        }
        assert.equal(payload.fileLabel, 'src/game/state.ts');
        assert.deepEqual(payload.flags.entries.map((e) => [e.name, e.value]), [['gotKey', false], ['doorOpen', false]]);
        assert.deepEqual(payload.vars.entries.map((e) => [e.name, e.value]), [['coins', 0]]);
    });

    test('adds and changes flags and vars in state.ts', async () => {
        const { root, view } = await setup();
        await view.handleMessage({ action: 'add', kind: 'flags', name: 'litLamp', value: true });
        await view.handleMessage({ action: 'setValue', kind: 'flags', name: 'gotKey', value: true });
        await view.handleMessage({ action: 'add', kind: 'vars', name: 'bag', value: ['apple'] });
        await view.handleMessage({ action: 'setValue', kind: 'vars', name: 'coins', value: 5 });
        const text = await read(root, 'src/game/state.ts');
        assert.match(text, /  \/\/ Hall\n  gotKey: true,\n  doorOpen: false,\n  litLamp: true,\n\}\);/);
        assert.match(text, /  coins: 5,\n  bag: \['apple'\],\n\}\);/);
    });

    test('rejects a name that is taken', async () => {
        const { root, view } = await setup();
        const before = await read(root, 'src/game/state.ts');
        await assert.rejects(view.handleMessage({ action: 'add', kind: 'flags', name: 'gotKey', value: false }), /already a flag/);
        assert.equal(await read(root, 'src/game/state.ts'), before);
    });

    test('creates state.ts when the game has none', async () => {
        const { root, view } = await setup(false);
        const payload = await view.payload();
        assert.equal(payload.status === 'ready' && payload.fileExists, false);
        await view.handleMessage({ action: 'add', kind: 'vars', name: 'coins', value: 3 });
        assert.ok(existsSync(path.join(root, 'src/game/state.ts')));
        assert.match(await read(root, 'src/game/state.ts'), /export const vars = defineVars\(\{\n  coins: 3,\n\}\);/);
    });

    test('renames a flag in state.ts and in the scripts that use it', async function () {
        this.timeout(90000);
        const { root, view } = await setup();
        await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, 'src/game/rooms/hall/hall.room.ts')));
        await view.handleMessage({ action: 'rename', kind: 'flags', name: 'gotKey', newName: 'hasKey' });
        assert.match(await read(root, 'src/game/state.ts'), /  hasKey: false,\n/);
        assert.match(await read(root, 'src/game/rooms/hall/hall.room.ts'), /return flags\.hasKey;/);
    });

    test('asks before deleting a flag that scripts use', async function () {
        this.timeout(90000);
        const asked: string[] = [];
        let answer = false;
        const { root, view } = await setup(true, {
            confirmDelete: async (message) => {
                asked.push(message);
                return answer;
            }
        });
        await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, 'src/game/rooms/hall/hall.room.ts')));
        await view.handleMessage({ action: 'delete', kind: 'flags', name: 'gotKey' });
        assert.deepEqual(asked, ['"gotKey" is used in 1 place. Delete it anyway?']);
        assert.match(await read(root, 'src/game/state.ts'), /gotKey/);
        answer = true;
        await view.handleMessage({ action: 'delete', kind: 'flags', name: 'gotKey' });
        assert.doesNotMatch(await read(root, 'src/game/state.ts'), /gotKey/);

        // Nothing uses doorOpen, so it goes without asking.
        await view.handleMessage({ action: 'delete', kind: 'flags', name: 'doorOpen' });
        assert.equal(asked.length, 2);
        assert.match(await read(root, 'src/game/state.ts'), /export const flags = defineFlags\(\{\n  \/\/ Hall\n\}\);/);
    });
});
