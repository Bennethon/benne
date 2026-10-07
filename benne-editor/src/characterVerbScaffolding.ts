import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { addHandler } from './scriptHandlers';

export async function makeCharacterClickable(characterJsonUri: vscode.Uri): Promise<boolean> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(characterJsonUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read character JSON.');
        return false;
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Character JSON is not valid.');
        return false;
    }
    if (data.clickable === true) {
        void vscode.window.showInformationMessage('This character is already clickable.');
        return false;
    }
    data.clickable = true;
    await vscode.workspace.fs.writeFile(characterJsonUri, formatJson(data));
    void vscode.window.showInformationMessage(
        'Character is now clickable. Optional: add a collider (3+ points) in the BENNE Character preview so only part of the sprite is clickable.'
    );
    return true;
}

/**
 * Adds `<name>.on<Verb>(() => { … })` (imported from `./<id>.ids`) to the character script (`<id>.character.ts`), which
 * applies wherever the character is spawned (§4.9). Creates the script when it doesn't exist.
 */
export async function addCharacterVerbEvent(
    characterJsonUri: vscode.Uri,
    characterId: string,
    verbId: string
): Promise<boolean> {
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    const r = await addHandler(
        scriptUri,
        { kind: 'verb', target: { kind: 'character', roomId: null, id: characterId }, verbId },
        `${verbId} handler for character "${characterId}"`
    );
    return r.ok;
}
