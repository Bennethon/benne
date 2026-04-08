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

    const charTs = `import type { EventBus } from '@engine/events/EventBus';
import type { CharacterVerbInteractPayload } from '@engine/events/propInteractionEvents';

/**
 * Character script for \`${id}\` — register verb handlers on the game EventBus.
 */
export function registerCharacterScript(_events: EventBus): void {
  // Example: _events.on('verbName:characterId', (payload: CharacterVerbInteractPayload) => { ... });
}
`;

    await vscode.workspace.fs.createDirectory(charDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(charJsonUri, formatJson(characterJson));
    await vscode.workspace.fs.writeFile(charTsUri, new TextEncoder().encode(charTs));

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
