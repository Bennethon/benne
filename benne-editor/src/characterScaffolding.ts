import * as vscode from 'vscode';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';

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

    const charTs = `/**
 * Optional script for \`${id}\` — the runtime does not auto-load *.character.ts yet; keep hooks here for tooling.
 */
export {};
`;

    await vscode.workspace.fs.createDirectory(charDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(charJsonUri, formatJson(characterJson));
    await vscode.workspace.fs.writeFile(charTsUri, new TextEncoder().encode(charTs));

    void vscode.window.showInformationMessage(`Created character "${name}" (${id}). Export Aseprite to assets/images/characters/${id}/ when ready.`);
    await vscode.window.showTextDocument(charJsonUri, { preview: false });
    await vscode.window.showTextDocument(charTsUri, { preview: false });
}
