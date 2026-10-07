import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { addHandler } from './scriptHandlers';

/**
 * Adds `items.<id>.on<Verb>(() => { … })` to the item's script (`<id>.inventory.ts`, §4.6) and marks
 * the verb in the item JSON. Creates the script when it doesn't exist.
 */
export async function addInventoryVerbEvent(
    inventoryJsonUri: vscode.Uri,
    itemId: string,
    verbId: string
): Promise<boolean> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(inventoryJsonUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read inventory JSON.');
        return false;
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Inventory JSON is not valid.');
        return false;
    }

    const scriptUri = vscode.Uri.joinPath(inventoryJsonUri, '..', `${itemId}.inventory.ts`);
    const r = await addHandler(
        scriptUri,
        { kind: 'verb', target: { kind: 'item', id: itemId }, verbId },
        `${verbId} handler for item "${itemId}"`
    );
    if (!r.ok) {
        return false;
    }
    // `onVerb` in the item JSON is editor metadata: the Inspector shows the verb as handled.
    const onVerb =
        data.onVerb && typeof data.onVerb === 'object' && !Array.isArray(data.onVerb)
            ? { ...(data.onVerb as Record<string, unknown>) }
            : {};
    if (onVerb[verbId] !== true) {
        onVerb[verbId] = true;
        data.onVerb = onVerb;
        await vscode.workspace.fs.writeFile(inventoryJsonUri, formatJson(data));
    }
    return true;
}
