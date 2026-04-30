import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import {
    inventoryBenneHandlerSnippet,
    inventoryScriptRegistersVerb,
    readConfiguredVerbIdSet
} from './verbHandlerPresence';

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inventoryScriptTemplate(itemId: string): string {
    return `import { registerInventoryScript } from '@engine/scripting';

/**
 * Inventory script for \`${itemId}\` — item-scoped Bennescript (\`B.whenLookAt(() => …)\`).
 * "Use" / "Give" on this row automatically arms the item for combining with world targets; add \`B.whenUse\` / \`B.whenGive\` only for extra behavior.
 * Room-scoped handlers in \`*.room.ts\` still run first for the same verb (see engine \`dispatchInventoryVerbInteraction\`).
 */
registerInventoryScript('${itemId}', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });
  void B;
});
`;
}

function ensureRegisterInventoryScriptShell(source: string, itemId: string): string {
    if (/registerInventoryScript\s*\(/.test(source)) {
        return source;
    }
    return inventoryScriptTemplate(itemId);
}

export function insertIntoRegisterInventoryScriptBody(
    source: string,
    itemId: string,
    insertBlock: string
): string | null {
    const idLit = escapeRegex(itemId);
    const head = new RegExp(`registerInventoryScript\\s*\\(\\s*['\`]${idLit}['\`]\\s*,`);
    const mh = source.match(head);
    if (!mh || mh.index === undefined) {
        return null;
    }
    const pos = mh.index + mh[0].length;
    const arrow = source.indexOf('=>', pos);
    if (arrow < 0) {
        return null;
    }
    const openBrace = source.indexOf('{', arrow);
    if (openBrace < 0) {
        return null;
    }
    let depth = 0;
    for (let i = openBrace; i < source.length; i++) {
        const c = source[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                return `${source.slice(0, i)}\n${insertBlock}\n${source.slice(i)}`;
            }
        }
    }
    return null;
}

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

    const folder = vscode.workspace.getWorkspaceFolder(inventoryJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

    const existingOnVerb =
        data.onVerb && typeof data.onVerb === 'object' && !Array.isArray(data.onVerb)
            ? { ...(data.onVerb as Record<string, unknown>) }
            : {};
    const jsonAlready = existingOnVerb[verbId] === true;

    const scriptUri = vscode.Uri.joinPath(inventoryJsonUri, '..', `${itemId}.inventory.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return false;
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* new file branch below */
    }
    if (scriptText && inventoryScriptRegistersVerb(scriptText, itemId, verbId, configured)) {
        if (jsonAlready) {
            void vscode.window.showInformationMessage(
                `A ${verbId} handler for "${itemId}" is already registered in ${itemId}.inventory.ts.`
            );
            return false;
        }
        existingOnVerb[verbId] = true;
        data.onVerb = existingOnVerb;
        await vscode.workspace.fs.writeFile(inventoryJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in inventory JSON (handler was already present in ${itemId}.inventory.ts).`
        );
        return true;
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        data.onVerb = existingOnVerb;
        await vscode.workspace.fs.writeFile(inventoryJsonUri, formatJson(data));
    }

    const snippet = inventoryBenneHandlerSnippet(verbId, configured);

    if (!scriptText) {
        const shell = inventoryScriptTemplate(itemId);
        const inserted = insertIntoRegisterInventoryScriptBody(shell, itemId, snippet);
        if (inserted === null) {
            void vscode.window.showErrorMessage('Could not insert handler into inventory script template.');
            return true;
        }
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted));
        void vscode.window.showInformationMessage(`Added ${verbId} handler for inventory item "${itemId}".`);
        return true;
    }

    let nextScript = ensureRegisterInventoryScriptShell(scriptText, itemId);
    if (!inventoryScriptRegistersVerb(nextScript, itemId, verbId, configured)) {
        const inserted = insertIntoRegisterInventoryScriptBody(nextScript, itemId, snippet);
        if (inserted === null) {
            void vscode.window.showWarningMessage(
                `Inventory JSON was updated; could not find registerInventoryScript('${itemId}', …) in ${itemId}.inventory.ts — add the handler manually.`
            );
            return true;
        }
        nextScript = inserted;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(nextScript));

    void vscode.window.showInformationMessage(`Added ${verbId} handler for inventory item "${itemId}".`);
    return true;
}
