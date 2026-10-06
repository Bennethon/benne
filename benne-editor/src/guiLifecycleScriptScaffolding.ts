import * as vscode from 'vscode';
import type { GuiHook } from './bennescript/handlerSpecs';
import { ensureHandler } from './scriptHandlers';

/** GUI lifecycle hooks (`gui.onBuilt`, `gui.onShow`, `gui.onHide`). */
export type GuiLifecycleHookKind = GuiHook;

export type EnsureGuiLifecycleHookResult =
    | { outcome: 'reveal'; range: { start: number; end: number } }
    | { outcome: 'inserted'; insertedStubRange: { start: number; end: number } }
    | { outcome: 'error' };

/** The GUI's content ID (`"id"` in its JSON, else the folder name), as the handle generator uses it. */
export async function readGuiContentId(guiJsonUri: vscode.Uri, folderId: string): Promise<string> {
    try {
        const data = JSON.parse(new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(guiJsonUri))) as {
            id?: unknown;
        };
        return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : folderId;
    } catch {
        return folderId;
    }
}

/** Reveals the GUI's handler for `hook`, or adds a stub (`gui.onShow(() => { … })`) to the GUI script. */
export async function ensureGuiLifecycleHookInGuiScript(
    guiJsonUri: vscode.Uri,
    guiId: string,
    hook: GuiLifecycleHookKind
): Promise<EnsureGuiLifecycleHookResult> {
    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    const contentId = await readGuiContentId(guiJsonUri, guiId);
    const r = await ensureHandler(scriptUri, { kind: 'gui', guiId: contentId, hook });
    if (r.status === 'failed') {
        return { outcome: 'error' };
    }
    if (r.status === 'exists') {
        return { outcome: 'reveal', range: r.range };
    }
    void vscode.window.showInformationMessage(`Added gui.${hook} in ${guiId}.gui.ts.`);
    return { outcome: 'inserted', insertedStubRange: r.range };
}
