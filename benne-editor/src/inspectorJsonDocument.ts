import { AsyncLocalStorage } from 'node:async_hooks';
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

function jsonFileLockKey(uri: vscode.Uri): string {
    if (process.platform === 'win32') {
        return path.normalize(uri.fsPath).toLowerCase();
    }
    return uri.fsPath;
}

const jsonFileWorkTails = new Map<string, Promise<void>>();
const jsonFileWorkContext = new AsyncLocalStorage<ReadonlyMap<string, symbol>>();
const jsonFileWorkHeld = new Map<string, symbol>();

/**
 * Serialize load/patch/write for one JSON file so preview saves and Inspector blur-saves
 * cannot interleave (the classic flash-then-revert when the JSON tab is open).
 */
export async function enqueueJsonFileWork<T>(uri: vscode.Uri, task: () => Promise<T>): Promise<T> {
    const key = jsonFileLockKey(uri);
    if (jsonFileWorkHeld.has(key) && jsonFileWorkContext.getStore()?.get(key) === jsonFileWorkHeld.get(key)) {
        return task();
    }
    const prev = jsonFileWorkTails.get(key) ?? Promise.resolve();
    let result!: T;
    const run = prev.then(async () => {
        const token = Symbol(key);
        jsonFileWorkHeld.set(key, token);
        const context = new Map(jsonFileWorkContext.getStore());
        context.set(key, token);
        try {
            result = await jsonFileWorkContext.run(context, task);
        } finally {
            jsonFileWorkHeld.delete(key);
        }
    });
    const tail = run.then(() => undefined, () => undefined);
    jsonFileWorkTails.set(key, tail);
    void tail.then(() => {
        if (jsonFileWorkTails.get(key) === tail) {
            jsonFileWorkTails.delete(key);
        }
    });
    await run;
    return result;
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
