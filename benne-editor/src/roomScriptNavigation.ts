import * as vscode from 'vscode';

/** Close preview (italic) tabs for this URI so tree navigation never leaves duplicate previews of the same file. */
export async function closePreviewTabsForUri(uri: vscode.Uri): Promise<void> {
    const uriStr = uri.toString();
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (!(tab.input instanceof vscode.TabInputText)) {
                continue;
            }
            if (tab.input.uri.toString() !== uriStr) {
                continue;
            }
            if (tab.isPreview) {
                await vscode.window.tabGroups.close(tab);
            }
        }
    }
}

/**
 * Open a document as preview after removing any existing preview tabs for the same URI.
 * Pinned / saved editors for that URI are left alone; `showTextDocument` will reveal them.
 */
export async function openSinglePreview(
    uri: vscode.Uri,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<vscode.TextEditor> {
    await closePreviewTabsForUri(uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    return vscode.window.showTextDocument(doc, { preview: true, viewColumn });
}

export async function openDocumentUri(uri: vscode.Uri, preview: boolean, viewColumn?: vscode.ViewColumn): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
        preview,
        viewColumn: viewColumn ?? vscode.ViewColumn.Active
    });
}

export async function revealEventInDocument(scriptUri: vscode.Uri, eventId: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(scriptUri);
    } catch {
        void vscode.window.showWarningMessage(`Script not found: ${scriptUri.fsPath}`);
        return false;
    }

    const doc = await vscode.workspace.openTextDocument(scriptUri);
    const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside
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
