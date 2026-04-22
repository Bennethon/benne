import * as vscode from 'vscode';
import { listInventoryDefinitions } from './gameDiscovery';
import { insertIntoBenneRegisterRoomScript } from './propVerbScaffolding';
import { insertIntoRegisterCharacterScriptBody } from './characterVerbScaffolding';

export type AddInventoryUsedOnResult = {
    ok: boolean;
    insertedStubRange?: { start: number; end: number };
};

function buildWhenInventoryUsedOnStub(targetId: string, itemIds: readonly string[]): string {
    if (itemIds.length === 0) {
        return `  B.whenInventoryUsedOn('${escapeTsString(targetId)}', (payload) => {\n    // TODO\n  });\n`;
    }
    let inner = '';
    for (let i = 0; i < itemIds.length; i++) {
        const idLit = escapeTsString(itemIds[i]!);
        const head = i === 0 ? 'if' : '} else if';
        inner += `    ${head} (payload.itemId === '${idLit}') {\n      // TODO\n`;
    }
    inner += '    }\n';
    return `  B.whenInventoryUsedOn('${escapeTsString(targetId)}', (payload) => {\n${inner}  });\n`;
}

function escapeTsString(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Inserts `B.whenInventoryUsedOn` into `*.room.ts` (no room JSON mutation).
 */
export async function addRoomInventoryUsedOnStub(
    roomJsonUri: vscode.Uri,
    roomId: string,
    kind: 'prop' | 'hotspot' | 'character',
    targetId: string,
): Promise<AddInventoryUsedOnResult> {
    void kind;
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        void vscode.window.showErrorMessage(`${roomId}.room.ts not found. Create the room script first.`);
        return { ok: false };
    }

    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const itemIds = folder ? (await listInventoryDefinitions(folder)).map((x) => x.id) : [];
    const snippet = buildWhenInventoryUsedOnStub(targetId, itemIds);
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, snippet);
    if (!inserted) {
        void vscode.window.showErrorMessage(
            `Could not find registerRoomScript((…) => { … }) in ${roomId}.room.ts — insert the stub manually.`,
        );
        return { ok: false };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    void vscode.window.showInformationMessage(
        `Added B.whenInventoryUsedOn('${targetId}', …) to ${roomId}.room.ts for inventory-on-target.`,
    );
    return { ok: true, insertedStubRange: { start: inserted.start, end: inserted.end } };
}

/**
 * Inserts `B.whenInventoryUsedOn` into `*.character.ts` (target id must match the character definition id).
 */
export async function addCharacterInventoryUsedOnStub(
    characterJsonUri: vscode.Uri,
    characterId: string,
): Promise<AddInventoryUsedOnResult> {
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        void vscode.window.showErrorMessage(`${characterId}.character.ts not found.`);
        return { ok: false };
    }

    const folder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
    const itemIds = folder ? (await listInventoryDefinitions(folder)).map((x) => x.id) : [];
    const snippet = buildWhenInventoryUsedOnStub(characterId, itemIds);
    const next = insertIntoRegisterCharacterScriptBody(scriptText, characterId, snippet);
    if (!next) {
        void vscode.window.showErrorMessage(
            `Could not find registerCharacterScript('${characterId}', …) in ${characterId}.character.ts.`,
        );
        return { ok: false };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(next));
    void vscode.window.showInformationMessage(
        `Added B.whenInventoryUsedOn('${characterId}', …) to ${characterId}.character.ts.`,
    );
    return { ok: true };
}
