import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { makeCharacterClickable } from './characterVerbScaffolding';
import { insertIntoBenneRegisterRoomScript } from './propVerbScaffolding';
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
 * Ensures the character can receive the verb (`*.character.json` `onVerb`, clickable) and inserts a
 * Bennescript stub in `${roomId}.room.ts` only. Does not open or edit `*.character.ts`. The room
 * script must already use `registerRoomScript((…) => { … })` (see `roomScaffolding.ts`).
 */
export async function addRoomCharacterVerbEvent(
    gameRoot: vscode.Uri,
    roomJsonUri: vscode.Uri,
    roomId: string,
    characterId: string,
    verbId: string
): Promise<boolean> {
    const charUri = characterJsonUriForId(gameRoot, characterId);
    try {
        await vscode.workspace.fs.stat(charUri);
    } catch {
        void vscode.window.showErrorMessage(
            `Character "${characterId}" not found (expected ${charUri.fsPath}).`
        );
        return false;
    }

    let charRaw: Uint8Array;
    try {
        charRaw = await vscode.workspace.fs.readFile(charUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read character JSON.');
        return false;
    }
    let charData: Record<string, unknown>;
    try {
        charData = JSON.parse(new TextDecoder('utf-8').decode(charRaw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Character JSON is not valid.');
        return false;
    }

    if (charData.clickable !== true) {
        await makeCharacterClickable(charUri);
    }

    const rawAfterClickable = await vscode.workspace.fs.readFile(charUri);
    try {
        charData = JSON.parse(new TextDecoder('utf-8').decode(rawAfterClickable)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Character JSON is not valid after update.');
        return false;
    }

    const existingOnVerb =
        charData.onVerb && typeof charData.onVerb === 'object' && !Array.isArray(charData.onVerb)
            ? { ...(charData.onVerb as Record<string, unknown>) }
            : {};
    if (existingOnVerb[verbId] !== true) {
        existingOnVerb[verbId] = true;
        charData.onVerb = existingOnVerb;
        await vscode.workspace.fs.writeFile(charUri, formatJson(charData));
    }

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let scriptText: string;
    try {
        const scriptRaw = await vscode.workspace.fs.readFile(scriptUri);
        scriptText = new TextDecoder('utf-8').decode(scriptRaw);
    } catch {
        void vscode.window.showWarningMessage(
            `Character JSON was updated; ${roomId}.room.ts was not found — create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return true;
    }

    const folderForCfg = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folderForCfg
        ? await readConfiguredVerbIdSet(folderForCfg.uri)
        : new Set<string>();
    if (scriptAlreadyRegistersRoomCharacterVerb(scriptText, roomId, characterId, verbId, configured)) {
        void vscode.window.showInformationMessage(
            `Room script already has a handler for ${verbId} on "${characterId}" in this room.`
        );
        return false;
    }

    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = benneStubCallLine('character', characterId, verbId, configured, qualifier);
    const benneInserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (benneInserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add a handler to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return false;
    }

    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(benneInserted));

    void vscode.window.showInformationMessage(
        `Added room-scoped ${verbId} handler for "${characterId}" in ${roomId}.room.ts (character JSON updated if needed).`
    );
    return true;
}
