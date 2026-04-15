import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    findBenneGameFolders,
    readAsepriteFrameTagNamesFromJsonText,
    sharedInventoryJsonUri,
    sharedInventorySheetFilesComplete
} from './gameDiscovery';
import type { MainTreeNode } from './mainTreeProvider';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultInventoryIdFromDisplayName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'item';
}

/**
 * Create `src/game/inventory/<id>/`, `<id>.inventory.json`, `<id>.inventory.ts` (shared sheet by default).
 */
export async function runCreateInventoryItemWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt: 'Item display name (shown in the BENNE tree and in `name` in JSON)',
        placeHolder: 'Rusty bucket',
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

    const defaultId = defaultInventoryIdFromDisplayName(name);

    const itemId = await vscode.window.showInputBox({
        prompt: 'Item id (folder name and file prefix)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Item id')
    });
    if (!itemId) {
        return;
    }
    const id = itemId.trim();

    const invDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'inventory', id);
    const invJsonUri = vscode.Uri.joinPath(invDir, `${id}.inventory.json`);
    const invTsUri = vscode.Uri.joinPath(invDir, `${id}.inventory.ts`);

    try {
        await vscode.workspace.fs.stat(invDir);
        void vscode.window.showErrorMessage(`Inventory folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const inventoryJson = {
        id,
        name,
        description: '',
        stackable: false,
        display: {
            aseprite: 'shared' as const
        }
    };

    const invTs = `import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('${id}', ({ B }) => {
  B.whenLookAt(() => {
    B.player.say('…');
  });

  B.whenUse(() => {
    B.player.say('…');
  });
});
`;

    await vscode.workspace.fs.createDirectory(invDir);
    await vscode.workspace.fs.writeFile(invJsonUri, formatJson(inventoryJson));
    await vscode.workspace.fs.writeFile(invTsUri, new TextEncoder().encode(invTs));

    void vscode.window.showInformationMessage(
        `Created inventory item "${name}" (${id}). Frame tags live in assets/images/inventory/inventory.json (tag name = item id unless display.tag is set).`
    );
    await vscode.window.showTextDocument(invJsonUri, { preview: false });
    await vscode.window.showTextDocument(invTsUri, { preview: false });
}

async function resolveFolderForInventoryImport(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<vscode.WorkspaceFolder | undefined> {
    if (node?.kind === 'inventoryGroup' || node?.kind === 'inventoryItem') {
        return node.folder;
    }
    if (selection.focus.kind === 'inventory') {
        const uri = selection.focus.uri;
        const folders = await findBenneGameFolders();
        return folders.find((f) => uri.fsPath.startsWith(f.uri.fsPath));
    }
    return pickWorkspaceFolder();
}

/**
 * Reads `inventory.json` tags; creates or updates one `.inventory.json` per selected tag (and optionally `.inventory.ts`).
 */
export async function runImportInventoryItemsFromAsepriteTags(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const folder = await resolveFolderForInventoryImport(selection, node);
    if (!folder) {
        return;
    }

    const jsonUri = sharedInventoryJsonUri(folder.uri);
    let jsonText: string;
    try {
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        jsonText = new TextDecoder('utf-8').decode(raw);
    } catch {
        void vscode.window.showErrorMessage(
            'Could not read src/game/assets/images/inventory/inventory.json — export the shared Aseprite sheet first.'
        );
        return;
    }

    const tags = readAsepriteFrameTagNamesFromJsonText(jsonText);
    if (tags.length === 0) {
        void vscode.window.showErrorMessage('No meta.frameTags found in inventory.json.');
        return;
    }

    const picked = await vscode.window.showQuickPick(
        tags.map((t) => ({ label: t, picked: false })),
        {
            placeHolder: 'Select one or more tags (each becomes an inventory item id)',
            canPickMany: true
        }
    );
    if (!picked || picked.length === 0) {
        return;
    }

    const writeScripts =
        (await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Create or overwrite <id>.inventory.ts stubs for selected tags?'
        })) === 'Yes';

    for (const item of picked) {
        const tag = item.label;
        const id = tag;
        const invDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'inventory', id);
        const invJsonUri = vscode.Uri.joinPath(invDir, `${id}.inventory.json`);
        const invTsUri = vscode.Uri.joinPath(invDir, `${id}.inventory.ts`);

        const inventoryJson = {
            id,
            name: id,
            description: '',
            stackable: false,
            display: {
                aseprite: 'shared' as const
            }
        };

        await vscode.workspace.fs.createDirectory(invDir);
        await vscode.workspace.fs.writeFile(invJsonUri, formatJson(inventoryJson));

        if (writeScripts) {
            const invTs = `import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('${id}', ({ B }) => {
  B.whenLookAt(() => {
    B.player.say('…');
  });

  B.whenUse(() => {
    B.player.say('…');
  });
});
`;
            await vscode.workspace.fs.writeFile(invTsUri, new TextEncoder().encode(invTs));
        }
    }

    const sheetOk = await sharedInventorySheetFilesComplete(folder.uri);
    if (!sheetOk) {
        void vscode.window.showWarningMessage(
            'Some items reference the shared sheet; ensure inventory.png + inventory.json exist under assets/images/inventory/.'
        );
    }

    void vscode.window.showInformationMessage(
        `Imported ${picked.length} inventory definition(s) from Aseprite tags.`
    );
}
