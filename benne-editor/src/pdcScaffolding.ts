import * as vscode from 'vscode';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultPdcIdFromName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'puzzle-chart';
}

/**
 * Create `src/game/pdcs/<id>/` and `<id>.pdc.json` (editor-only; not loaded by the shipped game).
 */
export async function runCreatePdcWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt:
            'Chart title (shown in the BENNE tree; stored as `name` in JSON — designer reference only)',
        placeHolder: 'Chapter 1 puzzle flow',
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

    const defaultId = defaultPdcIdFromName(name);

    const pdcId = await vscode.window.showInputBox({
        prompt: 'Chart id (folder name; must match `id` in JSON)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Chart id')
    });
    if (!pdcId) {
        return;
    }
    const id = pdcId.trim();

    const pdcDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'pdcs', id);
    const pdcJsonUri = vscode.Uri.joinPath(pdcDir, `${id}.pdc.json`);

    try {
        await vscode.workspace.fs.stat(pdcDir);
        void vscode.window.showErrorMessage(`Puzzle chart folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const pdcJson = {
        id,
        name,
        elements: [] as unknown[]
    };

    await vscode.workspace.fs.createDirectory(pdcDir);
    await vscode.workspace.fs.writeFile(pdcJsonUri, formatJson(pdcJson));

    void vscode.window.showInformationMessage(
        `Created puzzle dependency chart "${name}" (${id}). Select it in the BENNE tree to open the PDC Editor.`
    );
}
