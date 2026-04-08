import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    findBenneGameFolders,
    getCharacterIdFromCharacterJsonUri,
    listCharacterDefinitions,
    readCharacterUsesAsepriteDisplay,
    resolveCharacterAsepriteSheetForAnimations
} from './gameDiscovery';
import type { MainTreeNode } from './mainTreeProvider';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';
import { openCharacterJsonAndScriptBottomGroup } from './roomScriptNavigation';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultCharacterIdFromDisplayName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'character';
}

/** Property line for `BenneKnownCharacters` — quote the key when it is not a valid JS identifier. */
function formatKnownCharacterPropertyLine(characterId: string): string {
    const isBareId = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(characterId);
    const key = isBareId ? characterId : JSON.stringify(characterId);
    return `    ${key}: CharacterScriptHandle;`;
}

/** How authors reference this id in scripts (dot vs bracket). */
function characterIdToScriptAccessor(characterId: string): string {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(characterId)
        ? `C.${characterId}`
        : `C[${JSON.stringify(characterId)}]`;
}

/**
 * Append this character id to `src/game/scripting/known-characters.d.ts` (create file + dirs if needed).
 * Skips if the id is already listed.
 */
export async function appendKnownCharacterAugmentation(gameRoot: vscode.Uri, characterId: string): Promise<void> {
    const scriptingDir = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'scripting');
    const knownUri = vscode.Uri.joinPath(scriptingDir, 'known-characters.d.ts');
    const newLine = formatKnownCharacterPropertyLine(characterId);

    let text: string;
    try {
        const raw = await vscode.workspace.fs.readFile(knownUri);
        text = new TextDecoder('utf-8').decode(raw);
    } catch {
        text = '';
    }

    const needle = formatKnownCharacterPropertyLine(characterId).trim();
    if (text.split(/\r?\n/).some((line) => line.trim() === needle)) {
        return;
    }

    const blockRe = /(interface BenneKnownCharacters \{)([\s\S]*?)(\r?\n  \}\r?\n\}\r?\n?)/;
    if (text.trim().length === 0) {
        const initial = `import type { CharacterScriptHandle } from '@engine/scripting';

declare module '@engine/scripting' {
  interface BenneKnownCharacters {
${newLine}
  }
}
`;
        await vscode.workspace.fs.createDirectory(scriptingDir);
        await vscode.workspace.fs.writeFile(knownUri, new TextEncoder().encode(initial));
        return;
    }
    if (!blockRe.test(text)) {
        void vscode.window.showWarningMessage(
            'Could not parse src/game/scripting/known-characters.d.ts — add this character id to BenneKnownCharacters manually.'
        );
        return;
    }

    text = text.replace(blockRe, (_full, open: string, body: string, close: string) => {
        const inner = body.trimEnd();
        const nextInner = inner.length > 0 ? `${inner}\n${newLine}` : `\n${newLine}`;
        return `${open}${nextInner}${close}`;
    });
    await vscode.workspace.fs.writeFile(knownUri, new TextEncoder().encode(text));
}

/**
 * Create `src/game/characters/<id>/`, `<id>.character.json`, optional `<id>.character.ts`, and asset folder.
 */
export async function runCreateCharacterWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt: 'Character display name (shown in the BENNE tree and in `name` in JSON)',
        placeHolder: 'Shopkeeper',
        validateInput: (v) => {
            if (!v || !v.trim()) {
                return 'Name is required';
            }
            return null;
        }
    });
    if (!displayName) {
        return;
    }
    const name = displayName.trim();

    const defaultId = defaultCharacterIdFromDisplayName(name);

    const characterId = await vscode.window.showInputBox({
        prompt: 'Character id (folder name and file prefix)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Character id')
    });
    if (!characterId) {
        return;
    }
    const id = characterId.trim();

    const charDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'characters', id);
    const charJsonUri = vscode.Uri.joinPath(charDir, `${id}.character.json`);
    const charTsUri = vscode.Uri.joinPath(charDir, `${id}.character.ts`);
    const assetsDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', 'images', 'characters', id);

    try {
        await vscode.workspace.fs.stat(charDir);
        void vscode.window.showErrorMessage(`Character folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const characterJson = {
        id,
        name,
        description: '',
        walkSpeed: 88,
        clickable: false,
        display: {
            aseprite: true
        }
    };

    const cAccessor = characterIdToScriptAccessor(id);

    const charTs = `import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';
import { characterVerbEventId } from '@engine/events/verbInteractionEvents';
import { E, C, I, R } from '@engine/scripting';

/**
 * Character script for \`${id}\` — register verb handlers on the game EventBus.
 *
 * BenneScript (\`E\`, \`C\`, \`I\`, \`R\`) — \`${cAccessor}\` is registered in \`src/game/scripting/known-characters.d.ts\` for autocomplete.
 *
 * @example
 * _events.on(characterVerbEventId('${id}', 'look'), async (payload: CharacterVerbInteractPayload) => {
 *   if (E.firstOccurrence(\`${id}:looked\`)) {
 *     await E.wait(0.3);
 *     void C.Player.say(payload.description ?? '…');
 *   }
 * });
 */
export function registerCharacterScript(_events: EventBus): void {
  void [_events, E, C, I, R, characterVerbEventId];
  void (0 as unknown as CharacterVerbInteractPayload);
  // Example: _events.on(characterVerbEventId('${id}', 'look'), (payload: CharacterVerbInteractPayload) => { ... });
}
`;

    await vscode.workspace.fs.createDirectory(charDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(charJsonUri, formatJson(characterJson));
    await vscode.workspace.fs.writeFile(charTsUri, new TextEncoder().encode(charTs));
    await appendKnownCharacterAugmentation(folder.uri, id);

    void vscode.window.showInformationMessage(`Created character "${name}" (${id}). Export Aseprite to assets/images/characters/${id}/ when ready.`);
    await vscode.window.showTextDocument(charJsonUri, { preview: false });
    await vscode.window.showTextDocument(charTsUri, { preview: false });
}

type CharacterNodeRef = { folder: vscode.WorkspaceFolder; characterJsonUri: vscode.Uri; characterId: string };

async function resolveCharacterNodeForImport(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<CharacterNodeRef | undefined> {
    if (node?.kind === 'character') {
        return { folder: node.folder, characterJsonUri: node.uri, characterId: node.id };
    }
    if (selection.focus.kind === 'character') {
        const uri = selection.focus.uri;
        const folders = await findBenneGameFolders();
        const wf = folders.find((f) => uri.fsPath.startsWith(f.uri.fsPath));
        if (wf) {
            return {
                folder: wf,
                characterJsonUri: uri,
                characterId: getCharacterIdFromCharacterJsonUri(uri)
            };
        }
    }
    const folder = await pickWorkspaceFolder();
    if (!folder) {
        return undefined;
    }
    const chars = await listCharacterDefinitions(folder);
    if (chars.length === 0) {
        void vscode.window.showErrorMessage('No characters found.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        chars.map((c) => ({ label: c.name, description: c.id, char: c })),
        { placeHolder: 'Choose a character to import animations into' }
    );
    if (!picked) {
        return undefined;
    }
    return {
        folder,
        characterJsonUri: picked.char.uri,
        characterId: picked.char.id
    };
}

/** Default clip when importing — keys match Aseprite tag names (`CharacterAnimationClipConfig`). */
const DEFAULT_IMPORTED_ANIMATION_CLIP = { loop: true };

/**
 * Multi-select Aseprite frame tags and append matching entries under `animations` in character JSON.
 */
export async function runImportAnimationsFromAsepriteTags(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const charRef = await resolveCharacterNodeForImport(selection, node);
    if (!charRef) {
        return;
    }

    const usesAseprite = await readCharacterUsesAsepriteDisplay(charRef.characterJsonUri);
    if (!usesAseprite) {
        void vscode.window.showErrorMessage(
            'This character does not use Aseprite (`display.aseprite: true`). Enable it to import animation tags from the sheet.'
        );
        return;
    }

    const sheet = await resolveCharacterAsepriteSheetForAnimations(charRef.folder.uri, charRef.characterId);
    if (!sheet.jsonExists) {
        void vscode.window.showErrorMessage(
            `No Aseprite JSON for this character. Export to src/game/assets/images/characters/${charRef.characterId}/${charRef.characterId}.json`
        );
        return;
    }
    if (sheet.frameTags === null) {
        void vscode.window.showErrorMessage('Could not read the character Aseprite JSON file.');
        return;
    }
    if (sheet.frameTags.length === 0) {
        void vscode.window.showErrorMessage(
            'This sheet has no meta.frameTags. Tag animations in Aseprite and re-export JSON.'
        );
        return;
    }

    const raw = await vscode.workspace.fs.readFile(charRef.characterJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Character JSON is not valid; cannot import animations.');
        return;
    }

    const animUnknown = data.animations;
    if (
        animUnknown !== undefined &&
        animUnknown !== null &&
        (typeof animUnknown !== 'object' || Array.isArray(animUnknown))
    ) {
        void vscode.window.showErrorMessage('Character JSON `animations` must be an object.');
        return;
    }
    const animations: Record<string, unknown> =
        animUnknown && typeof animUnknown === 'object' && !Array.isArray(animUnknown)
            ? { ...(animUnknown as Record<string, unknown>) }
            : {};

    const usedKeys = new Set(Object.keys(animations));

    const items: vscode.QuickPickItem[] = sheet.frameTags.map((tag) => {
        const exists = usedKeys.has(tag);
        return {
            label: tag,
            description: exists ? 'Already in character JSON animations' : undefined,
            picked: !exists
        };
    });

    const chosen = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder:
            'Select Aseprite tags to add as animation keys (Space to toggle; Enter to confirm)',
        ignoreFocusOut: true
    });
    if (!chosen || chosen.length === 0) {
        return;
    }

    const selectedTags = chosen.map((c) => c.label);
    const toImport = selectedTags.filter((tag) => !usedKeys.has(tag));
    const skipped = selectedTags.length - toImport.length;
    if (toImport.length === 0) {
        void vscode.window.showInformationMessage(
            skipped > 0
                ? `No new animations to add (${skipped} tag(s) already in character JSON).`
                : 'No tags selected.'
        );
        return;
    }

    for (const tag of toImport) {
        animations[tag] = { ...DEFAULT_IMPORTED_ANIMATION_CLIP };
    }
    data.animations = animations;

    await vscode.workspace.fs.writeFile(charRef.characterJsonUri, formatJson(data));

    const parts = [`Imported ${toImport.length} animation(s) from Aseprite tags.`];
    if (skipped > 0) {
        parts.push(`Skipped ${skipped} already defined.`);
    }
    void vscode.window.showInformationMessage(parts.join(' '));
    await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
    await openCharacterJsonAndScriptBottomGroup(charRef.characterJsonUri, charRef.characterId);
}
