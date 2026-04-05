import * as vscode from 'vscode';

/**
 * Editor group for room JSON + `*.room.ts` after `workbench.action.editorLayoutTwoRows`
 * (preview / first row uses the primary group).
 */
export const BENNE_ROOM_SOURCES_VIEW_COLUMN = vscode.ViewColumn.Two;

/** Open room JSON and optional `*.room.ts` pinned in the bottom row editor group. */
export async function openRoomJsonAndScriptBottomGroup(
    roomJsonUri: vscode.Uri,
    roomId: string
): Promise<void> {
    await openDocumentPinned(roomJsonUri, BENNE_ROOM_SOURCES_VIEW_COLUMN);
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
        await openDocumentPinned(scriptUri, BENNE_ROOM_SOURCES_VIEW_COLUMN);
    } catch {
        /* optional *.room.ts */
    }
}

/** Pinned character JSON + optional `*.character.ts` in the primary column (character editing layout). */
export async function openCharacterJsonAndScriptPinned(
    characterJsonUri: vscode.Uri,
    characterId: string
): Promise<void> {
    await openDocumentPinned(characterJsonUri, vscode.ViewColumn.One);
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
        await openDocumentPinned(scriptUri, vscode.ViewColumn.One);
    } catch {
        /* optional *.character.ts */
    }
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
    const idx = text.indexOf(eventId);
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
