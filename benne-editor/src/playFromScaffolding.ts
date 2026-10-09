import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getRoomIdFromRoomJsonUri } from './gameDiscovery';
import type { MainTreeNode } from './mainTreeProvider';
import { resolveRoomTarget } from './roomScaffolding';
import { ensureAndRevealHandler } from './scriptHandlers';

/** Adds `playFrom('name', () => { … })` to the room script (§4.19) and reveals it. */
export async function addRoomPlayFromStub(
    roomJsonUri: vscode.Uri,
    name: string,
    viewColumn?: vscode.ViewColumn,
): Promise<boolean> {
    const roomId = getRoomIdFromRoomJsonUri(roomJsonUri);
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    const r = await ensureAndRevealHandler(scriptUri, { kind: 'playFrom', name: name.trim() }, viewColumn);
    if (r.status === 'exists') {
        void vscode.window.showInformationMessage(`${roomId}.room.ts already has playFrom('${name.trim()}', …).`);
    } else if (r.status === 'inserted') {
        void vscode.window.showInformationMessage(`Added playFrom('${name.trim()}', …) to ${roomId}.room.ts.`);
    }
    return r.status !== 'failed';
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

export async function runAddRoomPlayFromWizardForRoom(
    roomJsonUri: vscode.Uri,
    viewColumn?: vscode.ViewColumn,
): Promise<void> {
    const name = await vscode.window.showInputBox({
        title: 'Play From name',
        prompt: 'Name of this starting state (e.g. "fix battery"). Used in playFrom(…) and the Play From dropdown.',
        validateInput: (v) => {
            const t = v?.trim() ?? '';
            if (!t) {
                return 'Name is required';
            }
            if (/[\r\n]/.test(t)) {
                return 'Use a single line.';
            }
            return null;
        },
    });
    if (!name) {
        return;
    }
    await addRoomPlayFromStub(roomJsonUri, name.trim(), viewColumn);
}
