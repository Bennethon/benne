import * as vscode from 'vscode';
import { makeCharacterClickable } from './characterVerbScaffolding';
import type { AddRoomVerbHandlerResult } from './propVerbScaffolding';
import { addHandler } from './scriptHandlers';

function characterJsonUriForId(gameRoot: vscode.Uri, characterId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'characters', characterId, `${characterId}.character.json`);
}

/**
 * Ensures the character is clickable and adds `jensen.on<Verb>(() => { … })` to `${roomId}.room.ts`
 * (room-scoped: it applies in this room only, §4.9). Does not edit `*.character.ts`.
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
    return addHandler(
        scriptUri,
        { kind: 'verb', target: { kind: 'character', roomId, id: characterId }, verbId },
        `${verbId} handler for "${characterId}" in this room`
    );
}
