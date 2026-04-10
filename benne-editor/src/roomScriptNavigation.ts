import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';

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
    let idx = text.indexOf(eventId);
    if (idx < 0) {
        idx = findCanonicalHelperCallIndex(text, eventId);
    }
    if (idx < 0) {
        void vscode.window.showInformationMessage(`Could not find "${eventId}" in ${scriptUri.path.split('/').pop()}`);
        const start = doc.positionAt(0);
        editor.selection = new vscode.Selection(start, start);
        editor.revealRange(new vscode.Range(start, start));
        return false;
    }

    const pos = doc.positionAt(idx);
    const end = doc.positionAt(idx + eventId.length);
    editor.selection = new vscode.Selection(pos, end);
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

function findCanonicalHelperCallIndex(source: string, eventId: string): number {
    const roomVerb = eventId.match(/^verb:room:([^:]+):(prop|hotspot|character):([^:]+):([^:]+)$/);
    if (roomVerb) {
        const rx = canonicalRoomVerbRegex(
            roomVerb[1],
            roomVerb[2] as 'prop' | 'hotspot' | 'character',
            roomVerb[3],
            roomVerb[4]
        );
        const m = rx.exec(source);
        return m?.index ?? -1;
    }
    const roomFallback = eventId.match(/^verb:room:([^:]+):(prop|hotspot|character):([^:]+):fallback$/);
    if (roomFallback) {
        const rx = canonicalRoomFallbackRegex(
            roomFallback[1],
            roomFallback[2] as 'prop' | 'hotspot' | 'character',
            roomFallback[3]
        );
        const m = rx.exec(source);
        return m?.index ?? -1;
    }
    const charVerb = eventId.match(/^verb:character:([^:]+):([^:]+)$/);
    if (charVerb) {
        const rx = canonicalCharacterVerbRegex(charVerb[1], charVerb[2]);
        const m = rx.exec(source);
        return m?.index ?? -1;
    }
    const charFallback = eventId.match(/^verb:character:([^:]+):fallback$/);
    if (charFallback) {
        const rx = canonicalCharacterFallbackRegex(charFallback[1]);
        const m = rx.exec(source);
        return m?.index ?? -1;
    }
    return -1;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
