import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import {
    characterBenneHandlerSnippet,
    characterScriptRegistersVerb,
    readConfiguredVerbIdSet
} from './verbHandlerPresence';

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function characterScriptTemplate(characterId: string): string {
    return `import { registerCharacterScript } from '@engine/scripting';

/**
 * Character script for \`${characterId}\` — self-only Bennescript (\`B.whenLookAt(() => …)\`).
 * Room-scoped handlers in \`*.room.ts\` still run first for the same verb (see engine \`dispatchVerbInteraction\`).
 */
registerCharacterScript('${characterId}', ({ B }) => {
  // Example: B.whenLookAt(() => { B.player.say('…'); });
}, import.meta.url);
`;
}

/** Ensures the file uses side-effect \`registerCharacterScript('id', …)\`. */
export function ensureRegisterCharacterScriptShell(source: string, characterId: string): string {
    if (/registerCharacterScript\s*\(/.test(source)) {
        return source;
    }
    return characterScriptTemplate(characterId);
}

/**
 * Inserts a \`B.when*\` / \`B.whenVerb\` line before the closing \`}\` of the \`registerCharacterScript\` callback body.
 */
export function insertIntoRegisterCharacterScriptBody(
    source: string,
    characterId: string,
    insertBlock: string
): string | null {
    const idLit = escapeRegex(characterId);
    const head = new RegExp(`registerCharacterScript\\s*\\(\\s*['\`]${idLit}['\`]\\s*,`);
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

export async function addCharacterVerbEvent(
    characterJsonUri: vscode.Uri,
    characterId: string,
    verbId: string
): Promise<boolean> {
    const folder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return false;
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* new file branch below */
    }
    if (scriptText && characterScriptRegistersVerb(scriptText, characterId, verbId, configured)) {
        void vscode.window.showInformationMessage(
            `A ${verbId} handler for "${characterId}" is already registered in ${characterId}.character.ts.`
        );
        return false;
    }

    const snippet = characterBenneHandlerSnippet(verbId, configured);

    if (!scriptText) {
        const shell = characterScriptTemplate(characterId);
        const inserted = insertIntoRegisterCharacterScriptBody(shell, characterId, snippet);
        if (inserted === null) {
            void vscode.window.showErrorMessage('Could not insert handler into character script template.');
            return false;
        }
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted));
        void vscode.window.showInformationMessage(`Added ${verbId} handler for character "${characterId}".`);
        return true;
    }

    let nextScript = ensureRegisterCharacterScriptShell(scriptText, characterId);
    if (!characterScriptRegistersVerb(nextScript, characterId, verbId, configured)) {
        const inserted = insertIntoRegisterCharacterScriptBody(nextScript, characterId, snippet);
        if (inserted === null) {
            void vscode.window.showWarningMessage(
                `Could not find registerCharacterScript('${characterId}', …) in ${characterId}.character.ts — add the handler manually.`
            );
            return false;
        }
        nextScript = inserted;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(nextScript));

    void vscode.window.showInformationMessage(`Added ${verbId} handler for character "${characterId}".`);
    return true;
}
