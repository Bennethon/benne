// Authoring contracts that edit a room of the AI Apocalypse template (`src/game`). Runs when that template is
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

/** The real AI Apocalypse game in this repository (`src/game`), with its generated handles. */
const repoRoot = path.resolve(__dirname, '../../../..');
const realGame = path.join(repoRoot, 'src', 'game');

/** Copies the club room, its generated handles and `@game` into a temporary `src/game`. */
async function clubGameCopy(): Promise<{ root: string; game: string }> {
    if (!existsSync(path.join(realGame, 'rooms', 'club', 'club.ids.ts'))) {
        // In the extension host, process.execPath is VS Code's Electron binary: run it as Node.
        execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], {
            cwd: repoRoot,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
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

suite('Authoring contracts on the AI Apocalypse template', () => {
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
            assert.equal(scriptHasHandler(uri, `${text}\nconst example = 'battery.onTake(() => {})'\n`, { kind: 'verb', target: battery, verbId: 'take' }), false);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
    test('Inspector "add handler" on an AI Apocalypse prop inserts a BenneScript handler', async () => {
        const { root, game } = await clubGameCopy();
        try {
            const roomJson = vscode.Uri.file(path.join(game, 'rooms', 'club', 'club.room.json'));
            const script = path.join(game, 'rooms', 'club', 'club.room.ts');
            const before = await fs.readFile(script, 'utf8');
            const r = await addPropVerbEvent(roomJson, 'club', 'bg', 'look');
            assert.equal(r.ok, true);
            const after = await fs.readFile(script, 'utf8');
            assert.equal(after.slice(r.insertedStubRange!.start, r.insertedStubRange!.end), 'bg.onLook(() => {\n  // TODO: Look at\n})');
            // The template may be checked out with CRLF line endings (Windows), which the import edit keeps.
            assert.match(after, /toolChest, bg,\r?\n\} from '\.\/club\.ids';/);
            assert.equal(after.endsWith('bg.onLook(() => {\n  // TODO: Look at\n})\n'), true);
            assert.equal(after.replace(/toolChest, bg,(\r?\n)\}/, 'toolChest,$1}').startsWith(before.trimEnd()), true);
            // A second "add" finds the handler instead of adding another.
            const again = await addPropVerbEvent(roomJson, 'club', 'bg', 'look');
            assert.equal(again.insertedStubRange, undefined);
            assert.deepEqual(again.existingRange, { start: r.insertedStubRange!.start, end: r.insertedStubRange!.start + 'bg.onLook'.length });
            assert.equal(await fs.readFile(script, 'utf8'), after);
            // Other stubs use the same import and statement style.
            await addHotspotVerbEvent(roomJson, 'club', 'outside', 'take');
            await addRoomInventoryUsedOnStub(roomJson, 'club', 'prop', 'car');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'club', 'onEnter');
            await ensureRoomLifecycleHookInRoomScript(roomJson, 'club', 'onUpdate');
            const final = await fs.readFile(script, 'utf8');
            assert.ok(final.includes('outside.onTake(() => {\n  // TODO: Take\n})'));
            assert.ok(final.includes('car.onAnyItem(() => {'));
            assert.ok(final.includes('room.onEnter(() => {\n  // TODO\n})'));
            assert.ok(final.includes('onUpdate(() => {\n  if (game.currentRoom !== room) return'));
            assert.match(final, /^import \{ [^}]*\bgame\b[^}]*\bonUpdate\b[^}]*\} from '@benne\/script';/);
        } finally { await fs.rm(root, { recursive: true, force: true }); }
    });
});
