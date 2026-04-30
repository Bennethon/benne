import * as path from 'node:path';
import * as vscode from 'vscode';

function uriSameResource(a: vscode.Uri, b: vscode.Uri): boolean {
    if (a.scheme !== b.scheme) {
        return false;
    }
    if (process.platform === 'win32') {
        return path.normalize(a.fsPath).toLowerCase() === path.normalize(b.fsPath).toLowerCase();
    }
    return a.fsPath === b.fsPath;
}

/**
 * Scaffolding uses `vscode.workspace.fs.readFile` / `writeFile`, which bypass open editor buffers.
 * If the companion script is open with unsaved edits, persist it first so disk IO matches the editor.
 */
export async function saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri: vscode.Uri): Promise<boolean> {
    const open = vscode.workspace.textDocuments.find((d) => uriSameResource(d.uri, scriptUri));
    if (!open?.isDirty) {
        return true;
    }
    const savedUri = await vscode.workspace.save(scriptUri);
    if (savedUri !== undefined) {
        return true;
    }
    void vscode.window.showErrorMessage(
        `Could not save "${path.basename(scriptUri.fsPath)}". Save the file manually, then try again.`
    );
    return false;
}
