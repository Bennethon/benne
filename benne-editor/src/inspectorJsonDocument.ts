import * as path from 'node:path';
import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';

/** Compare URIs for the same on-disk JSON file (case-insensitive on Windows). */
export function uriSameResource(a: vscode.Uri, b: vscode.Uri): boolean {
    if (a.scheme !== b.scheme) {
        return false;
    }
    if (process.platform === 'win32') {
        return path.normalize(a.fsPath).toLowerCase() === path.normalize(b.fsPath).toLowerCase();
    }
    return a.fsPath === b.fsPath;
}

function findOpenJsonDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((d) => uriSameResource(d.uri, uri));
}

/**
 * Replace the full contents of an open JSON tab so it matches `text`.
 * No-op when the file is not open or the buffer already matches.
 */
export async function syncOpenJsonDocumentText(uri: vscode.Uri, text: string): Promise<boolean> {
    const open = findOpenJsonDocument(uri);
    if (!open) {
        return true;
    }
    const current = open.getText();
    if (current === text) {
        return true;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(open.positionAt(0), open.positionAt(current.length));
    edit.replace(uri, fullRange, text);
    return vscode.workspace.applyEdit(edit);
}

/** After `workspace.fs.writeFile`, keep any open editor tab aligned with the bytes on disk. */
export async function syncOpenJsonDocumentFromData(
    uri: vscode.Uri,
    data: Record<string, unknown>
): Promise<void> {
    const text = new TextDecoder().decode(formatJson(data));
    const ok = await syncOpenJsonDocumentText(uri, text);
    if (!ok) {
        void vscode.window.showWarningMessage(
            `Could not update the open editor for "${path.basename(uri.fsPath)}". Close the tab or reload it, then try again.`
        );
    }
}

/**
 * Read JSON for the Inspector and other editor tooling.
 *
 * - **Dirty buffer** — user is editing the JSON tab; use the buffer.
 * - **Clean buffer** — disk is authoritative (inspector `fs.writeFile`, wizards, external save);
 *   refresh the open tab when it lags behind disk so the next blur-save does not resurrect stale fields.
 */
export async function readInspectorJsonText(uri: vscode.Uri): Promise<string> {
    const open = findOpenJsonDocument(uri);
    if (open?.isDirty) {
        return open.getText();
    }

    const raw = await vscode.workspace.fs.readFile(uri);
    const diskText = new TextDecoder('utf-8').decode(raw);

    if (open && open.getText() !== diskText) {
        await syncOpenJsonDocumentText(uri, diskText);
    }

    return diskText;
}
