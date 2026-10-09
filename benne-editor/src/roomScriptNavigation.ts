import * as path from 'node:path';
import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import { handlerSpecFromEventId, isFallbackEventId } from './bennescript/handlerEvents';
import type { HandlerSpec, VerbTarget } from './bennescript/handlerSpecs';
import { ensureRoomVerbHandlerStubForReveal } from './propVerbScaffolding';
import { gameRootOf, handlersInText, readScriptText, revealHandler, revealRange } from './scriptHandlers';

/**
 * Helpers for the Benne editor two-row layout: they open the **companion `*.ts`** next to a definition
 * JSON file and re-apply {@link applyBenneTwoRowJsonScriptLayout}. They do **not** open the `*.json` itself
 * (callers open JSON separately when needed, e.g. tree selection or wizards).
 */
/** Bottom-row editor group for source files after {@link applyBenneTwoRowJsonScriptLayout}. */
export const BENNE_ROOM_SOURCES_VIEW_COLUMN = vscode.ViewColumn.Two;

/** The usual column for companion TypeScript beneath the preview row. */
export const BENNE_SCRIPT_VIEW_COLUMN = vscode.ViewColumn.Two;

/** Opens sibling `*.room.ts` in the script column; reapplies the two-row layout. Does not open `*.room.json`. */
export async function openBenneRoomTypeScript(roomJsonUri: vscode.Uri, roomId: string): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    await openDocumentPinned(scriptUri, BENNE_SCRIPT_VIEW_COLUMN);
    await applyBenneTwoRowJsonScriptLayout();
}

/** Opens sibling `*.character.ts` in the script column; reapplies the two-row layout. Does not open `*.character.json`. */
export async function openBenneCharacterTypeScript(
    characterJsonUri: vscode.Uri,
    characterId: string
): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    await openDocumentPinned(scriptUri, BENNE_SCRIPT_VIEW_COLUMN);
    await applyBenneTwoRowJsonScriptLayout();
}

/** Opens sibling `*.gui.ts` in the script column; reapplies the two-row layout. Does not open `*.gui.json`. */
export async function openBenneGuiTypeScript(guiJsonUri: vscode.Uri, guiId: string): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    await openDocumentPinned(scriptUri, BENNE_SCRIPT_VIEW_COLUMN);
    await applyBenneTwoRowJsonScriptLayout();
}

/** Opens sibling `*.inventory.ts` in the script column; reapplies the two-row layout. Does not open `*.inventory.json`. */
export async function openBenneInventoryTypeScript(
    inventoryJsonUri: vscode.Uri,
    itemId: string
): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(inventoryJsonUri, '..', `${itemId}.inventory.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    await openDocumentPinned(scriptUri, BENNE_SCRIPT_VIEW_COLUMN);
    await applyBenneTwoRowJsonScriptLayout();
}

/** Opens sibling `*.dialog.ts` in column one (no preview row — Inspector holds JSON). */
export async function openBenneDialogTypeScript(dialogJsonUri: vscode.Uri, dialogId: string): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(dialogJsonUri, '..', `${dialogId}.dialog.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        return;
    }
    await openDocumentPinned(scriptUri, vscode.ViewColumn.One);
}

/** Open a normal (pinned) editor tab; multiple documents can stay open in the same group. */
export async function openDocumentPinned(
    uri: vscode.Uri,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument(uri);
    return vscode.window.showTextDocument(doc, { preview: false, viewColumn });
}

export async function openDocumentUri(uri: vscode.Uri, preview: boolean, viewColumn?: vscode.ViewColumn): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
        preview,
        viewColumn: viewColumn ?? vscode.ViewColumn.Active
    });
}

/** Reveals `regions.x.onEnter` / `onExit` in `*.room.ts`. */
export async function revealRoomRegionHandlerInDocument(
    scriptUri: vscode.Uri,
    roomId: string,
    regionId: string,
    kind: 'enter' | 'exit',
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<boolean> {
    return revealHandler(
        scriptUri,
        { kind: 'region', roomId, regionId, hook: kind === 'enter' ? 'onEnter' : 'onExit' },
        viewColumn
    );
}

/** Select `[start, end)` UTF-16 offsets in `scriptUri` and scroll the range into view. */
export async function revealSourceRangeInDocument(
    scriptUri: vscode.Uri,
    start: number,
    end: number,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        void vscode.window.showWarningMessage(`Script not found: ${scriptUri.fsPath}`);
        return false;
    }
    const doc = await vscode.workspace.openTextDocument(scriptUri);
    const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn
    });
    const len = doc.getText().length;
    const s = Math.max(0, Math.min(start, len));
    const e = Math.max(s, Math.min(end, len));
    const pos = doc.positionAt(s);
    const endPos = doc.positionAt(e);
    editor.selection = new vscode.Selection(pos, endPos);
    editor.revealRange(new vscode.Range(pos, endPos), vscode.TextEditorRevealType.InCenter);
    return true;
}

/**
 * Reveals the handler behind an Inspector / Actions event ID (`verb:room:club:prop:antenna:look`) in
 * `scriptUri`. A room verb with no handler gets a stub, as clicking an empty chip always did.
 */
export async function revealEventInDocument(
    scriptUri: vscode.Uri,
    eventId: string,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<boolean> {
    if (isFallbackEventId(eventId)) {
        void vscode.window.showInformationMessage(
            'Per-object verb fallbacks (`onVerbFallback` in JSON) have no BenneScript handler. Use `x.on([...verbs], …)` on the object, or `fallbacks.on<Verb>` in globalScript.ts.'
        );
        return false;
    }
    const spec = handlerSpecFromEventId(eventId);
    if (!spec) {
        await openDocumentPinned(scriptUri, viewColumn);
        return false;
    }
    const text = await readScriptText(scriptUri);
    if (text && handlersInText(scriptUri, text, spec).length > 0) {
        return revealHandler(scriptUri, spec, viewColumn);
    }
    const baseName = path.basename(scriptUri.fsPath);
    // A character's verb in a room can be handled by the character's own script (§4.9).
    if (spec.kind === 'verb' && spec.target.kind === 'character' && spec.target.roomId !== null) {
        const gameRoot = gameRootOf(scriptUri);
        if (gameRoot) {
            const id = spec.target.id;
            const characterScript = vscode.Uri.file(path.join(gameRoot, 'characters', id, `${id}.character.ts`));
            const characterSpec: HandlerSpec = { ...spec, target: { kind: 'character', roomId: null, id } };
            const characterText = await readScriptText(characterScript);
            if (characterText && handlersInText(characterScript, characterText, characterSpec).length > 0) {
                return revealHandler(characterScript, characterSpec, viewColumn);
            }
        }
    }
    if (baseName.endsWith('.room.ts')) {
        const roomId = path.basename(scriptUri.fsPath, '.room.ts');
        const roomJsonUri = vscode.Uri.joinPath(scriptUri, '..', `${roomId}.room.json`);
        const stubResult = await ensureRoomVerbHandlerStubForReveal(roomJsonUri, roomId, eventId);
        if (stubResult.stubInserted && stubResult.insertedStubRange) {
            await revealRange(scriptUri, stubResult.insertedStubRange, viewColumn);
            void vscode.window.showInformationMessage(`Added a stub handler for this verb in ${baseName}.`);
            return true;
        }
    }
    return revealHandler(scriptUri, spec, viewColumn);
}

/**
 * Reveals the first item handler (`onUseItem`, `onItem`, `onAnyItem`, …) on `targetId` in a room,
 * character or inventory script.
 */
export async function revealInventoryUsedOnHandlerInDocument(
    scriptUri: vscode.Uri,
    targetId: string,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<boolean> {
    const base = path.basename(scriptUri.fsPath);
    const roomId = base.endsWith('.room.ts') ? path.basename(base, '.room.ts') : undefined;
    const targets: VerbTarget[] = roomId
        ? [
              { kind: 'prop', roomId, id: targetId },
              { kind: 'hotspot', roomId, id: targetId },
              { kind: 'character', roomId, id: targetId }
          ]
        : base.endsWith('.inventory.ts')
          ? [{ kind: 'item', id: targetId }]
          : [{ kind: 'character', roomId: null, id: targetId }];
    const text = await readScriptText(scriptUri);
    const specs: HandlerSpec[] = targets.map((target) => ({ kind: 'anyItem', target }));
    const found = specs.find((spec) => handlersInText(scriptUri, text, spec).length > 0);
    return revealHandler(scriptUri, found ?? specs[0], viewColumn);
}
