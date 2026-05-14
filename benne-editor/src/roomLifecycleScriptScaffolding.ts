import * as vscode from 'vscode';
import { insertIntoBenneRegisterRoomScript } from './propVerbScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import {
    benneRoomScriptQualifier,
    roomScriptRegistersRoomLifecycleHook,
    type RoomLifecycleHookKind
} from './verbHandlerPresence';

const BENNE_ROOM_SCRIPT_HINT =
    'Use Bennescript: registerRoomScript(({ B }) => { ... }) or registerRoomScript((ctx) => { ... }) so the editor can insert stubs.';

export type EnsureRoomLifecycleHookResult =
    | { outcome: 'reveal' }
    | { outcome: 'inserted'; insertedStubRange: { start: number; end: number } }
    | { outcome: 'error' };

function lifecycleStubLine(hook: RoomLifecycleHookKind, qualifier: string): string {
    if (hook === 'onUpdate') {
        return `${qualifier}onUpdate((ctx) => {\n    // TODO\n  });`;
    }
    return `${qualifier}${hook}(() => {\n    // TODO\n  });`;
}

/**
 * If `hook` is already registered in the room script, returns {@link EnsureRoomLifecycleHookResult.outcome}
 * `'reveal'`. Otherwise inserts a stub inside `registerRoomScript` and returns `'inserted'` with the
 * new UTF-16 range.
 */
export async function ensureRoomLifecycleHookInRoomScript(
    roomJsonUri: vscode.Uri,
    roomId: string,
    hook: RoomLifecycleHookKind
): Promise<EnsureRoomLifecycleHookResult> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { outcome: 'error' };
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        void vscode.window.showErrorMessage(
            `${roomId}.room.ts not found. Create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { outcome: 'error' };
    }
    if (roomScriptRegistersRoomLifecycleHook(scriptText, hook)) {
        return { outcome: 'reveal' };
    }
    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = lifecycleStubLine(hook, qualifier);
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add ${hook} to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { outcome: 'error' };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    void vscode.window.showInformationMessage(`Added ${hook} in ${roomId}.room.ts.`);
    return {
        outcome: 'inserted',
        insertedStubRange: { start: inserted.start, end: inserted.end }
    };
}
