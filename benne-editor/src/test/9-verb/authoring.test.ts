// Authoring contracts that edit a room of the 9-verb template (`src/game`). Runs when that template is
// active (`benne-editor/.vscode-test.mjs`); the contracts for any game are in ../authoring.test.ts.
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { addRoomInventoryUsedOnStub } from '../../inventoryUsedOnScaffolding';
import { addPropVerbEvent, addHotspotVerbEvent } from '../../propVerbScaffolding';
import { ensureRoomLifecycleHookInRoomScript } from '../../roomLifecycleScriptScaffolding';
import { scriptHasHandler } from '../../scriptHandlers';

/** The game in this repository (`src/game`, the 9-verb template), with its generated handles. */
const repoRoot = path.resolve(__dirname, '../../../..');
const realGame = path.join(repoRoot, 'src', 'game');

/** Copies the apartment room, its generated handles and `@game` into a temporary `src/game`. */
async function apartmentGameCopy(): Promise<{ root: string; game: string }> {
    if (!existsSync(path.join(realGame, 'rooms', 'apartment', 'apartment.ids.ts'))) {
        // In the extension host, process.execPath is VS Code's Electron binary: run it as Node.
        execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], {
            cwd: repoRoot,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
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

suite('Authoring contracts on the 9-verb template', () => {
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
});
