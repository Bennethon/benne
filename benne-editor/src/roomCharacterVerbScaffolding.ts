import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { makeCharacterClickable } from './characterVerbScaffolding';
import { insertIntoBenneRegisterRoomScript, parseRegisterRoomScriptBusParam } from './propVerbScaffolding';
import {
    benneRoomScriptQualifier,
    benneStubCallLine,
    readConfiguredVerbIdSet,
    roomScriptRegistersRoomCharacterVerb
} from './verbHandlerPresence';

function scriptAlreadyRegistersRoomCharacterVerb(
    source: string,
    roomId: string,
    characterId: string,
    verbId: string,
    configured: ReadonlySet<string>
): boolean {
    return roomScriptRegistersRoomCharacterVerb(source, roomId, characterId, verbId, configured);
}

function ensureRoomCharacterVerbImports(source: string): string {
    let next = source;
    if (!/\bCharacterVerbInteractPayload\b/.test(next)) {
        const existing = next.match(
            /^import type \{([^}]+)\} from ['"]@engine\/events\/propInteractionEvents['"];\s*$/m
        );
        if (existing) {
            const inner = existing[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (!inner.includes('CharacterVerbInteractPayload')) {
                inner.push('CharacterVerbInteractPayload');
            }
            next = next.replace(
                existing[0],
                `import type { ${inner.join(', ')} } from '@engine/events/propInteractionEvents';`
            );
        } else {
            const newImport = `import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';\n`;
            const eventBusImport =
                /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
            if (eventBusImport.test(next)) {
                next = next.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
            } else {
                next = newImport + next;
            }
        }
    }
    if (!/\broomCharacterVerbEventId\b/.test(next)) {
        const existingV = next.match(
            /^import \{([^}]+)\} from ['"]@engine\/events\/verbInteractionEvents['"];\s*$/m
        );
        if (existingV) {
            const inner = existingV[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            if (!inner.includes('roomCharacterVerbEventId')) {
                inner.push('roomCharacterVerbEventId');
            }
            next = next.replace(
                existingV[0],
                `import { ${inner.join(', ')} } from '@engine/events/verbInteractionEvents';`
            );
        } else {
            const newImport = `import { roomCharacterVerbEventId } from '@engine/events/verbInteractionEvents';\n`;
            const eventBusImport =
                /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
            if (eventBusImport.test(next)) {
                next = next.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
            } else {
                next = newImport + next;
            }
        }
    }
    return next;
}

function insertRoomCharacterHandler(
    source: string,
    roomId: string,
    characterId: string,
    verbId: string,
    eventsVar: string
): string | null {
    const marker = 'export function registerRoomScript';
    const fnIdx = source.indexOf(marker);
    if (fnIdx < 0) {
        return null;
    }
    const openBrace = source.indexOf('{', fnIdx);
    if (openBrace < 0) {
        return null;
    }
    const expr = `roomCharacterVerbEventId('${roomId}', '${characterId}', '${verbId}')`;
    let depth = 0;
    for (let i = openBrace; i < source.length; i++) {
        const c = source[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                const snippet = `\n  ${eventsVar}.on(${expr}, (payload: CharacterVerbInteractPayload) => {\n    // TODO\n  });\n`;
                return source.slice(0, i) + snippet + source.slice(i);
            }
        }
    }
    return null;
}

function characterJsonUriForId(gameRoot: vscode.Uri, characterId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'characters', characterId, `${characterId}.character.json`);
}

/**
 * Ensures the character can receive the verb, then appends a room-scoped handler stub in `*.room.ts`.
 * Does not modify room JSON (spawn data only).
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
            `Character JSON was updated; add a handler in ${roomId}.room.ts (script file missing).`
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

    let next = ensureRoomCharacterVerbImports(scriptText);
    const qualifier = benneRoomScriptQualifier(next);
    const stub = benneStubCallLine('character', characterId, verbId, configured, qualifier);
    const benneInserted = insertIntoBenneRegisterRoomScript(next, `\n  ${stub}\n`);
    if (benneInserted !== null) {
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(benneInserted));
    } else {
        const eventsVar = parseRegisterRoomScriptBusParam(next);
        const inserted = insertRoomCharacterHandler(next, roomId, characterId, verbId, eventsVar);
        if (inserted === null) {
            void vscode.window.showWarningMessage(
                `Could not find registerRoomScript in ${roomId}.room.ts — add the handler manually.`
            );
            return true;
        }
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted));
    }

    void vscode.window.showInformationMessage(
        `Added room-scoped ${verbId} handler for "${characterId}" in ${roomId}.room.ts (character JSON updated if needed).`
    );
    return true;
}
