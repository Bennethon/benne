import * as vscode from 'vscode';
import { insertIntoBenneRegisterGuiScript } from './guiButtonClickScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import {
    benneGuiScriptQualifier,
    guiScriptRegistersGuiLifecycleHook,
    type GuiLifecycleHookKind
} from './verbHandlerPresence';

const GUI_SCRIPT_HINT =
    'Use Bennescript: registerGuiScript("guiId", ({ B }) => { … }) so the editor can insert stubs.';

export type EnsureGuiLifecycleHookResult =
    | { outcome: 'reveal' }
    | { outcome: 'inserted'; insertedStubRange: { start: number; end: number } }
    | { outcome: 'error' };

async function readGuiJsonStringId(guiJsonUri: vscode.Uri): Promise<string | null> {
    try {
        const raw = await vscode.workspace.fs.readFile(guiJsonUri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as { id?: unknown };
        return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : null;
    } catch {
        return null;
    }
}

function lifecycleStubLine(hook: GuiLifecycleHookKind, qualifier: string): string {
    return `${qualifier}${hook}(() => {\n    // TODO\n  });`;
}

/**
 * If `hook` is already registered in the GUI script, returns {@link EnsureGuiLifecycleHookResult.outcome}
 * `'reveal'`. Otherwise inserts a stub inside `registerGuiScript` and returns `'inserted'` with the
 * new UTF-16 range.
 */
export async function ensureGuiLifecycleHookInGuiScript(
    guiJsonUri: vscode.Uri,
    guiId: string,
    hook: GuiLifecycleHookKind
): Promise<EnsureGuiLifecycleHookResult> {
    const jsonStringId = await readGuiJsonStringId(guiJsonUri);
    const preferredScriptIds = [...new Set([jsonStringId, guiId].filter((s): s is string => Boolean(s?.trim())))];

    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { outcome: 'error' };
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        void vscode.window.showErrorMessage(
            `${guiId}.gui.ts not found. Create the GUI script, then ${GUI_SCRIPT_HINT}`
        );
        return { outcome: 'error' };
    }
    if (guiScriptRegistersGuiLifecycleHook(scriptText, hook)) {
        return { outcome: 'reveal' };
    }
    const qualifier = benneGuiScriptQualifier(scriptText);
    const stub = lifecycleStubLine(hook, qualifier);
    const inserted = insertIntoBenneRegisterGuiScript(scriptText, preferredScriptIds, `\n  ${stub}\n`);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add ${hook} to ${guiId}.gui.ts. ${GUI_SCRIPT_HINT}`
        );
        return { outcome: 'error' };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    void vscode.window.showInformationMessage(`Added ${hook} in ${guiId}.gui.ts.`);
    return {
        outcome: 'inserted',
        insertedStubRange: { start: inserted.start, end: inserted.end }
    };
}
