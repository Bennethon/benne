import * as path from 'node:path';
import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import { readRoomProps } from './gameDiscovery';
import { ensureRoomVerbHandlerStubForReveal } from './propVerbScaffolding';
import {
    findCharacterScriptVerbRangeForEventId,
    findRoomScriptVerbRangeForEventIdRobust,
    readConfiguredVerbIdSet
} from './verbHandlerPresence';

/** Bottom-row editor group for source files after {@link applyBenneTwoRowJsonScriptLayout}. */
export const BENNE_ROOM_SOURCES_VIEW_COLUMN = vscode.ViewColumn.Two;

/** The usual column for room/character/gui script beneath the preview row. */
export const BENNE_SCRIPT_VIEW_COLUMN = vscode.ViewColumn.Two;

/** Open `*.room.ts` pinned in the bottom row. */
export async function openRoomJsonAndScriptBottomGroup(
    roomJsonUri: vscode.Uri,
    roomId: string
): Promise<void> {
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

/** Pinned character JSON + optional `*.character.ts` beside it in the primary row. */
export async function openCharacterJsonAndScriptPinned(
    characterJsonUri: vscode.Uri,
    characterId: string
): Promise<void> {
    await openDocumentPinned(characterJsonUri, vscode.ViewColumn.One);
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        return;
    }
    const scriptDoc = await vscode.workspace.openTextDocument(scriptUri);
    await vscode.window.showTextDocument(scriptDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}

/** Character preview row + `*.character.ts` in the bottom row. */
export async function openCharacterJsonAndScriptBottomGroup(
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

/** GUI preview row + `*.gui.ts` in the bottom row. */
export async function openGuiJsonAndScriptBottomGroup(
    guiJsonUri: vscode.Uri,
    guiId: string
): Promise<void> {
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

/** Inventory JSON + `*.inventory.ts` in the bottom row (no preview bundle yet). */
export async function openInventoryJsonAndScriptBottomGroup(
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

export async function revealEventInDocument(
    scriptUri: vscode.Uri,
    eventId: string,
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

    const text = doc.getText();
    let selStart = text.indexOf(eventId);
    let selEnd = selStart >= 0 ? selStart + eventId.length : -1;

    if (selStart < 0) {
        const helper = findCanonicalHelperRange(text, eventId);
        if (helper) {
            selStart = helper.start;
            selEnd = helper.end;
        }
    }

    if (selStart < 0) {
        const folder = vscode.workspace.getWorkspaceFolder(scriptUri);
        const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
        const baseName = path.basename(scriptUri.fsPath);
        if (baseName.endsWith('.room.ts')) {
            const roomId = path.basename(scriptUri.fsPath, '.room.ts');
            const roomJsonUri = vscode.Uri.joinPath(scriptUri, '..', `${roomId}.room.json`);
            let roomPropIds = new Set<string>();
            try {
                const props = await readRoomProps(roomJsonUri);
                roomPropIds = new Set(props.map((p) => p.id));
            } catch {
                /* room JSON missing — still try Bennescript patterns that do not need prop ids */
            }
            const br = findRoomScriptVerbRangeForEventIdRobust(text, eventId, configured, roomPropIds);
            if (br) {
                selStart = br.start;
                selEnd = br.end;
            }
        } else if (baseName.endsWith('.character.ts')) {
            const cr = findCharacterScriptVerbRangeForEventId(text, eventId, configured);
            if (cr) {
                selStart = cr.start;
                selEnd = cr.end;
            }
        }
    }

    if (selStart < 0 || selEnd < 0) {
        const baseName = path.basename(scriptUri.fsPath);
        if (baseName.endsWith('.room.ts')) {
            const roomId = path.basename(scriptUri.fsPath, '.room.ts');
            const roomJsonUri = vscode.Uri.joinPath(scriptUri, '..', `${roomId}.room.json`);
            const stubResult = await ensureRoomVerbHandlerStubForReveal(roomJsonUri, roomId, eventId);
            if (stubResult.stubInserted && stubResult.insertedStubRange) {
                const { start: rs, end: re } = stubResult.insertedStubRange;
                await revealSourceRangeInDocument(scriptUri, rs, re, viewColumn);
                void vscode.window.showInformationMessage(
                    `Added a stub handler for this verb in ${baseName}.`
                );
                return true;
            }
        }
        void vscode.window.showInformationMessage(`Could not find "${eventId}" in ${scriptUri.path.split('/').pop()}`);
        const start = doc.positionAt(0);
        editor.selection = new vscode.Selection(start, start);
        editor.revealRange(new vscode.Range(start, start));
        return false;
    }

    const pos = doc.positionAt(selStart);
    const endPos = doc.positionAt(selEnd);
    editor.selection = new vscode.Selection(pos, endPos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    return true;
}

function canonicalRoomVerbRegex(
    roomId: string,
    targetType: 'prop' | 'hotspot' | 'character',
    targetId: string,
    verbId: string
): RegExp {
    const fn =
        targetType === 'prop'
            ? 'roomPropVerbEventId'
            : targetType === 'hotspot'
              ? 'roomHotspotVerbEventId'
              : 'roomCharacterVerbEventId';
    return new RegExp(
        `${fn}\\s*\\(\\s*['"\`]${escapeRegex(roomId)}['"\`]\\s*,\\s*['"\`]${escapeRegex(targetId)}['"\`]\\s*,\\s*['"\`]${escapeRegex(verbId)}['"\`]\\s*\\)`,
        'm'
    );
}

function canonicalRoomFallbackRegex(
    roomId: string,
    targetType: 'prop' | 'hotspot' | 'character',
    targetId: string
): RegExp {
    const fn =
        targetType === 'prop'
            ? 'roomPropVerbFallbackEventId'
            : targetType === 'hotspot'
              ? 'roomHotspotVerbFallbackEventId'
              : 'roomCharacterVerbFallbackEventId';
    return new RegExp(
        `${fn}\\s*\\(\\s*['"\`]${escapeRegex(roomId)}['"\`]\\s*,\\s*['"\`]${escapeRegex(targetId)}['"\`]\\s*\\)`,
        'm'
    );
}

function canonicalCharacterVerbRegex(characterId: string, verbId: string): RegExp {
    return new RegExp(
        `characterVerbEventId\\s*\\(\\s*['"\`]${escapeRegex(characterId)}['"\`]\\s*,\\s*['"\`]${escapeRegex(verbId)}['"\`]\\s*\\)`,
        'm'
    );
}

function canonicalCharacterFallbackRegex(characterId: string): RegExp {
    return new RegExp(
        `characterVerbFallbackEventId\\s*\\(\\s*['"\`]${escapeRegex(characterId)}['"\`]\\s*\\)`,
        'm'
    );
}

function findCanonicalHelperRange(source: string, eventId: string): { start: number; end: number } | null {
    const roomVerb = eventId.match(/^verb:room:([^:]+):(prop|hotspot|character):([^:]+):([^:]+)$/);
    if (roomVerb) {
        const rx = canonicalRoomVerbRegex(
            roomVerb[1],
            roomVerb[2] as 'prop' | 'hotspot' | 'character',
            roomVerb[3],
            roomVerb[4]
        );
        const m = rx.exec(source);
        if (m?.index !== undefined) {
            return { start: m.index, end: m.index + m[0].length };
        }
        return null;
    }
    const roomFallback = eventId.match(/^verb:room:([^:]+):(prop|hotspot|character):([^:]+):fallback$/);
    if (roomFallback) {
        const rx = canonicalRoomFallbackRegex(
            roomFallback[1],
            roomFallback[2] as 'prop' | 'hotspot' | 'character',
            roomFallback[3]
        );
        const m = rx.exec(source);
        if (m?.index !== undefined) {
            return { start: m.index, end: m.index + m[0].length };
        }
        return null;
    }
    const charVerb = eventId.match(/^verb:character:([^:]+):([^:]+)$/);
    if (charVerb) {
        const rx = canonicalCharacterVerbRegex(charVerb[1], charVerb[2]);
        const m = rx.exec(source);
        if (m?.index !== undefined) {
            return { start: m.index, end: m.index + m[0].length };
        }
        return null;
    }
    const charFallback = eventId.match(/^verb:character:([^:]+):fallback$/);
    if (charFallback) {
        const rx = canonicalCharacterFallbackRegex(charFallback[1]);
        const m = rx.exec(source);
        if (m?.index !== undefined) {
            return { start: m.index, end: m.index + m[0].length };
        }
        return null;
    }
    return null;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
