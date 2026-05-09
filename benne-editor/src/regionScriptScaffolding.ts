import * as vscode from 'vscode';
import {
    insertIntoBenneRegisterRoomScript,
    type AddRoomVerbHandlerResult
} from './propVerbScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import {
    benneRoomScriptQualifier,
    roomScriptRegistersRegionWhenEnter,
    roomScriptRegistersRegionWhenExit
} from './verbHandlerPresence';

const BENNE_ROOM_SCRIPT_HINT =
    'Use Bennescript: registerRoomScript(({ B }) => { ... }) or registerRoomScript((ctx) => { ... }) so the editor can insert stubs.';

function regionStubLine(regionId: string, kind: 'enter' | 'exit', qualifier: string): string {
    const hook = kind === 'enter' ? 'whenEnter' : 'whenExit';
    const idLit = JSON.stringify(regionId);
    return `${qualifier}region(${idLit}).${hook}(() => {\n    // TODO\n  });`;
}

/**
 * Inserts `B.region('…').whenEnter` / `whenExit` (or `ctx.` prefix) into the room script.
 */
export async function addRoomRegionHandler(
    roomJsonUri: vscode.Uri,
    roomId: string,
    regionId: string,
    kind: 'enter' | 'exit'
): Promise<AddRoomVerbHandlerResult> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { ok: false };
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        void vscode.window.showErrorMessage(
            `${roomId}.room.ts not found. Create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: false };
    }
    const has =
        kind === 'enter'
            ? roomScriptRegistersRegionWhenEnter(scriptText, roomId, regionId)
            : roomScriptRegistersRegionWhenExit(scriptText, roomId, regionId);
    if (has) {
        void vscode.window.showInformationMessage(
            `A ${kind === 'enter' ? 'whenEnter' : 'whenExit'} handler for region "${regionId}" is already registered in ${roomId}.room.ts.`
        );
        return { ok: false };
    }
    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = regionStubLine(regionId, kind, qualifier);
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add a handler to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: false };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    void vscode.window.showInformationMessage(
        `Added region ${kind === 'enter' ? 'whenEnter' : 'whenExit'} for "${regionId}" in ${roomId}.room.ts.`
    );
    return { ok: true, insertedStubRange: { start: inserted.start, end: inserted.end } };
}
