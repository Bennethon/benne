import * as vscode from 'vscode';
import type { MainTreeNode } from './mainTreeProvider';
import { promptForNameAndId } from './nameAndIdPrompt';
import { pickWorkspaceFolder } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Create `src/game/pdcs/<id>/` and `<id>.pdc.json` (editor-only; not loaded by the shipped game).
 */
export async function runCreatePdcWizard(
    preferredFolder?: vscode.WorkspaceFolder
): Promise<Extract<MainTreeNode, { kind: 'pdc' }> | undefined> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return undefined;
    }

    const named = await promptForNameAndId({
        namePrompt:
            'Chart title (shown in the BENNE tree; stored as `name` in JSON — designer reference only)',
        namePlaceHolder: 'Chapter 1 puzzle flow',
        idPrompt: 'Chart id (folder name; must match `id` in JSON)',
        idLabel: 'Chart id',
        fallbackId: 'puzzle-chart'
    });
    if (!named) {
        return undefined;
    }
    const { name, id } = named;

    const pdcDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'pdcs', id);
    const pdcJsonUri = vscode.Uri.joinPath(pdcDir, `${id}.pdc.json`);

    try {
        await vscode.workspace.fs.stat(pdcDir);
        void vscode.window.showErrorMessage(`Puzzle chart folder already exists: ${id}`);
        return undefined;
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

    void vscode.window.showInformationMessage(`Created puzzle dependency chart "${name}" (${id}).`);
    return { kind: 'pdc', folder, id, name, uri: pdcJsonUri };
}
