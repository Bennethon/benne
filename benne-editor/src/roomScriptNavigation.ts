import * as path from 'node:path';
import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import { readRoomProps } from './gameDiscovery';
import {
    findCharacterScriptVerbRangeForEventId,
    findRoomScriptVerbRangeForEventId,
    readConfiguredVerbIdSet
} from './verbHandlerPresence';

/**
 * Bottom-row editor group for room/character JSON after {@link applyBenneTwoRowJsonScriptLayout}
 * (preview uses the primary/top group). The script is opened with {@link vscode.ViewColumn.Beside}
 * so JSON and `*.room.ts` / `*.character.ts` sit in two columns on the bottom row.
 */
export const BENNE_ROOM_SOURCES_VIEW_COLUMN = vscode.ViewColumn.Two;

/**
 * The usual column for the room/character script after JSON + Beside split
 * (top = preview = One, bottom-left JSON = Two, bottom-right script = Three).
 */
export const BENNE_SCRIPT_VIEW_COLUMN = vscode.ViewColumn.Three;

/** Open room JSON and optional `*.room.ts` pinned in the bottom row (JSON | script columns). */
export async function openRoomJsonAndScriptBottomGroup(
    roomJsonUri: vscode.Uri,
    roomId: string
): Promise<void> {
    await openDocumentPinned(roomJsonUri, BENNE_ROOM_SOURCES_VIEW_COLUMN);
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    const scriptDoc = await vscode.workspace.openTextDocument(scriptUri);
    await vscode.window.showTextDocument(scriptDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
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

/** Character preview row + JSON / `*.character.ts` in the bottom row (JSON | script columns). */
export async function openCharacterJsonAndScriptBottomGroup(
    characterJsonUri: vscode.Uri,
    characterId: string
): Promise<void> {
    await openDocumentPinned(characterJsonUri, BENNE_ROOM_SOURCES_VIEW_COLUMN);
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    const scriptDoc = await vscode.workspace.openTextDocument(scriptUri);
    await vscode.window.showTextDocument(scriptDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    await applyBenneTwoRowJsonScriptLayout();
}

/** GUI preview row + JSON / `*.gui.ts` in the bottom row (JSON | script columns). */
export async function openGuiJsonAndScriptBottomGroup(
    guiJsonUri: vscode.Uri,
    guiId: string
): Promise<void> {
    await openDocumentPinned(guiJsonUri, BENNE_ROOM_SOURCES_VIEW_COLUMN);
    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }
    const scriptDoc = await vscode.workspace.openTextDocument(scriptUri);
    await vscode.window.showTextDocument(scriptDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
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
            const br = findRoomScriptVerbRangeForEventId(text, eventId, configured, roomPropIds);
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
