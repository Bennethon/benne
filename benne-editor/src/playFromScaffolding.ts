import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getRoomIdFromRoomJsonUri } from './gameDiscovery';
import type { MainTreeNode } from './mainTreeProvider';
import { insertIntoBenneRegisterRoomScript } from './propVerbScaffolding';
import { resolveRoomTarget } from './roomScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';

/**
 * Inserts `B.playFrom(name, () => { … })` into the room script's `registerRoomScript` body.
 */
export async function addRoomPlayFromStub(roomJsonUri: vscode.Uri, name: string): Promise<boolean> {
    const roomId = getRoomIdFromRoomJsonUri(roomJsonUri);
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri);
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(scriptUri);
    } catch {
        void vscode.window.showErrorMessage(`${roomId}.room.ts not found. Create the room script first.`);
        return false;
    }
    const scriptText = new TextDecoder('utf-8').decode(raw);
    const literal = JSON.stringify(name.trim());
    const snippet = `\n  B.playFrom(${literal}, () => {\n\n  });\n`;
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, snippet);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not find registerRoomScript((…) => { … }) in ${roomId}.room.ts — insert the stub manually.`,
        );
        return false;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    void vscode.window.showInformationMessage(`Added B.playFrom(${literal}, …) to ${roomId}.room.ts.`);
    const doc = await vscode.workspace.openTextDocument(scriptUri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    const pos = doc.positionAt(inserted.start + snippet.indexOf('\n\n') + 1);
    editor.selection = new vscode.Selection(pos, pos);
    return true;
}

export async function runAddRoomPlayFromWizard(
    selection: EditorSelection,
    node?: MainTreeNode,
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }
    await runAddRoomPlayFromWizardForRoom(target.roomJsonUri);
}

export async function runAddRoomPlayFromWizardForRoom(roomJsonUri: vscode.Uri): Promise<void> {
    const name = await vscode.window.showInputBox({
        title: 'Play From name',
        prompt: 'Identifier for this starting state (e.g. StartWithKeyAndLantern). Used in B.playFrom(…) and the Room preview dropdown.',
        validateInput: (v) => {
            const t = v?.trim() ?? '';
            if (!t) {
                return 'Name is required';
            }
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
                return 'Use letters, numbers, and underscores only (start with a letter or _).';
            }
            return null;
        },
    });
    if (!name) {
        return;
    }
    await addRoomPlayFromStub(roomJsonUri, name.trim());
}
