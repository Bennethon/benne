import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { characterScriptRegistersVerb, readConfiguredVerbIdSet } from './verbHandlerPresence';

function characterVerbEventId(characterId: string, verbId: string): string {
    return `verb:character:${characterId}:${verbId}`;
}

export function parseRegisterCharacterScriptBusParam(source: string): string {
    const m = source.match(/export\s+function\s+registerCharacterScript\s*\(\s*(\w+)\s*:/);
    return m?.[1] ?? '_events';
}

function characterScriptTemplate(characterId: string): string {
    return `import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';

/**
 * Character script for \`${characterId}\` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example global: _events.on(characterVerbEventId('${characterId}', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
`;
}

/** Ensures the file exports registerCharacterScript; replaces legacy \`export {}\` stubs. */
export function ensureRegisterCharacterScriptShell(source: string, characterId: string): string {
    if (/export\s+function\s+registerCharacterScript/.test(source)) {
        return source;
    }
    return characterScriptTemplate(characterId);
}

function hasCharacterVerbPayloadTypeImport(source: string): boolean {
    return /import\s+type\s+\{[^}]*\bCharacterVerbInteractPayload\b[^}]*\}\s+from\s+['"]@engine\/events\/propInteractionEvents['"]/.test(
        source,
    );
}

function ensureCharacterVerbPayloadImport(source: string): string {
    if (hasCharacterVerbPayloadTypeImport(source)) {
        return source;
    }
    const existing = source.match(
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
        return source.replace(
            existing[0],
            `import type { ${inner.join(', ')} } from '@engine/events/propInteractionEvents';`
        );
    }
    const newImport = `import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';\n`;
    const eventBusImport =
        /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
    if (eventBusImport.test(source)) {
        return source.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
    }
    return newImport + source;
}

function ensureCharacterVerbEventHelperImport(source: string): string {
    if (/\bcharacterVerbEventId\b/.test(source)) {
        return source;
    }
    const existing = source.match(
        /^import \{([^}]+)\} from ['"]@engine\/events\/verbInteractionEvents['"];\s*$/m
    );
    if (existing) {
        const inner = existing[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!inner.includes('characterVerbEventId')) {
            inner.push('characterVerbEventId');
        }
        return source.replace(
            existing[0],
            `import { ${inner.join(', ')} } from '@engine/events/verbInteractionEvents';`
        );
    }
    const newImport = `import { characterVerbEventId } from '@engine/events/verbInteractionEvents';\n`;
    const eventBusImport =
        /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
    if (eventBusImport.test(source)) {
        return source.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
    }
    return newImport + source;
}

function insertHandlerBeforeRegisterCharacterScriptClose(
    source: string,
    eventExpr: string,
    eventsVar: string
): string | null {
    const marker = 'export function registerCharacterScript';
    const fnIdx = source.indexOf(marker);
    if (fnIdx < 0) {
        return null;
    }
    const openBrace = source.indexOf('{', fnIdx);
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
                const snippet = `\n  ${eventsVar}.on(${eventExpr}, (payload: CharacterVerbInteractPayload) => {\n    // TODO\n  });\n`;
                return source.slice(0, i) + snippet + source.slice(i);
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
        'Character is now clickable. Optional: add a collider (3+ points) in the BENNE Character preview so only part of the sprite is clickable.',
    );
    return true;
}

export async function addCharacterVerbEvent(
    characterJsonUri: vscode.Uri,
    characterId: string,
    verbId: string
): Promise<boolean> {
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

    const eventId = characterVerbEventId(characterId, verbId);
    const folder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

    const existingOnVerb =
        data.onVerb && typeof data.onVerb === 'object' && !Array.isArray(data.onVerb)
            ? { ...(data.onVerb as Record<string, unknown>) }
            : {};
    const jsonAlready = existingOnVerb[verbId] === true;

    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* new file branch below */
    }
    if (scriptText && characterScriptRegistersVerb(scriptText, characterId, verbId, configured)) {
        if (jsonAlready) {
            void vscode.window.showInformationMessage(
                `A ${verbId} handler for "${characterId}" is already registered in ${characterId}.character.ts.`
            );
            return false;
        }
        existingOnVerb[verbId] = true;
        data.onVerb = existingOnVerb;
        await vscode.workspace.fs.writeFile(characterJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in character JSON (handler was already present in ${characterId}.character.ts).`
        );
        return true;
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        data.onVerb = existingOnVerb;
        await vscode.workspace.fs.writeFile(characterJsonUri, formatJson(data));
    }

    if (!scriptText) {
        const shell = characterScriptTemplate(characterId);
        let next = shell;
        if (!characterScriptRegistersVerb(next, characterId, verbId, configured)) {
            next = ensureCharacterVerbPayloadImport(next);
            next = ensureCharacterVerbEventHelperImport(next);
            const eventsVar = parseRegisterCharacterScriptBusParam(next);
            const inserted = insertHandlerBeforeRegisterCharacterScriptClose(
                next,
                `characterVerbEventId('${characterId}', '${verbId}')`,
                eventsVar
            );
            if (inserted !== null) {
                next = inserted;
            }
        }
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(next));
        void vscode.window.showInformationMessage(`Added ${verbId} handler for character "${characterId}".`);
        return true;
    }

    let nextScript = ensureRegisterCharacterScriptShell(scriptText, characterId);
    if (!characterScriptRegistersVerb(nextScript, characterId, verbId, configured)) {
        nextScript = ensureCharacterVerbPayloadImport(nextScript);
        nextScript = ensureCharacterVerbEventHelperImport(nextScript);
        const eventsVar = parseRegisterCharacterScriptBusParam(nextScript);
        const inserted = insertHandlerBeforeRegisterCharacterScriptClose(
            nextScript,
            `characterVerbEventId('${characterId}', '${verbId}')`,
            eventsVar
        );
        if (inserted === null) {
            void vscode.window.showWarningMessage(
                `Character JSON was updated; could not find registerCharacterScript in ${characterId}.character.ts — add the handler manually.`
            );
            return true;
        }
        nextScript = inserted;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(nextScript));

    void vscode.window.showInformationMessage(`Added ${verbId} handler for character "${characterId}".`);
    return true;
}
