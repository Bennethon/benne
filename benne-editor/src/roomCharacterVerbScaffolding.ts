import * as vscode from 'vscode';
import { makeCharacterClickable } from './characterVerbScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import { insertIntoBenneRegisterRoomScript, type AddRoomVerbHandlerResult } from './propVerbScaffolding';
import {
    benneRoomScriptQualifier,
    benneStubCallLine,
    readConfiguredVerbIdSet,
    roomScriptRegistersRoomCharacterVerb
} from './verbHandlerPresence';

const BENNE_ROOM_SCRIPT_HINT =
    'Use Bennescript: registerRoomScript(({ B }) => { ... }) or registerRoomScript((ctx) => { ... }) so the editor can insert verb stubs.';

function scriptAlreadyRegistersRoomCharacterVerb(
    source: string,
    roomId: string,
    characterId: string,
    verbId: string,
    configured: ReadonlySet<string>
): boolean {
    return roomScriptRegistersRoomCharacterVerb(source, roomId, characterId, verbId, configured);
}

function characterJsonUriForId(gameRoot: vscode.Uri, characterId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'characters', characterId, `${characterId}.character.json`);
}

/**
 * Ensures the character is clickable and inserts a Bennescript stub in `${roomId}.room.ts` only.
 * Does not open or edit `*.character.ts`. The room script must already use
 * `registerRoomScript((…) => { … })` (see `roomScaffolding.ts`).
 */
export async function addRoomCharacterVerbEvent(
    gameRoot: vscode.Uri,
    roomJsonUri: vscode.Uri,
    roomId: string,
    characterId: string,
    verbId: string
): Promise<AddRoomVerbHandlerResult> {
    const charUri = characterJsonUriForId(gameRoot, characterId);
    try {
        await vscode.workspace.fs.stat(charUri);
    } catch {
        void vscode.window.showErrorMessage(
            `Character "${characterId}" not found (expected ${charUri.fsPath}).`
        );
        return { ok: false };
    }

    let charRaw: Uint8Array;
    try {
        charRaw = await vscode.workspace.fs.readFile(charUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read character JSON.');
        return { ok: false };
    }
    let charData: Record<string, unknown>;
    try {
        charData = JSON.parse(new TextDecoder('utf-8').decode(charRaw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Character JSON is not valid.');
        return { ok: false };
    }

    if (charData.clickable !== true) {
        await makeCharacterClickable(charUri);
    }

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { ok: false };
    }
    let scriptText: string;
    try {
        const scriptRaw = await vscode.workspace.fs.readFile(scriptUri);
        scriptText = new TextDecoder('utf-8').decode(scriptRaw);
    } catch {
        void vscode.window.showWarningMessage(
            `${roomId}.room.ts was not found — create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: true };
    }

    const folderForCfg = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folderForCfg
        ? await readConfiguredVerbIdSet(folderForCfg.uri)
        : new Set<string>();
    if (scriptAlreadyRegistersRoomCharacterVerb(scriptText, roomId, characterId, verbId, configured)) {
        void vscode.window.showInformationMessage(
            `Room script already has a handler for ${verbId} on "${characterId}" in this room.`
        );
        return { ok: false };
    }

    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = benneStubCallLine('character', characterId, verbId, configured, qualifier);
    const benneInserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (benneInserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add a handler to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: false };
    }

    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(benneInserted.text));

    void vscode.window.showInformationMessage(
        `Added room-scoped ${verbId} handler for "${characterId}" in ${roomId}.room.ts.`
    );
    return {
        ok: true,
        insertedStubRange: { start: benneInserted.start, end: benneInserted.end }
    };
}
