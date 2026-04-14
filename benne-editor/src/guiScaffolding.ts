import * as vscode from 'vscode';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';
import { openGuiJsonAndScriptBottomGroup } from './roomScriptNavigation';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultGuiIdFromDisplayName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'gui';
}

/**
 * Create `src/game/guis/<id>/`, `<id>.gui.json`, `<id>.gui.ts`, and asset folder under `images/guis/<id>/`.
 */
export async function runCreateGuiWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt: 'GUI display name (shown in the BENNE tree and in `name` in JSON)',
        placeHolder: 'Inventory bar',
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

    const defaultId = defaultGuiIdFromDisplayName(name);

    const guiId = await vscode.window.showInputBox({
        prompt: 'GUI id (folder name and file prefix)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'GUI id')
    });
    if (!guiId) {
        return;
    }
    const id = guiId.trim();

    const guiDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'guis', id);
    const guiJsonUri = vscode.Uri.joinPath(guiDir, `${id}.gui.json`);
    const guiTsUri = vscode.Uri.joinPath(guiDir, `${id}.gui.ts`);
    const assetsDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', 'images', 'guis', id);

    try {
        await vscode.workspace.fs.stat(guiDir);
        void vscode.window.showErrorMessage(`GUI folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const guiJson = {
        id,
        name,
        description: '',
        display: {
            aseprite: true
        }
    };

    const guiTs = `import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for \`${id}\` — Bennescript entry (\`B.raw\`, future onShow/onHide/control hooks on \`B\`).
 */
registerGuiScript('${id}', ({ B: _B }) => {
});
`;

    await vscode.workspace.fs.createDirectory(guiDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(guiJsonUri, formatJson(guiJson));
    await vscode.workspace.fs.writeFile(guiTsUri, new TextEncoder().encode(guiTs));

    void vscode.window.showInformationMessage(
        `Created GUI "${name}" (${id}). Export Aseprite to assets/images/guis/${id}/ when ready.`
    );
    await openGuiJsonAndScriptBottomGroup(guiJsonUri, id);
}
