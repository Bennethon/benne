import * as vscode from 'vscode';
import { applyBenneSingleColumnEditorLayout } from './benneEditorLayout';
import { openBenneDialogTypeScript } from './roomScriptNavigation';
import { promptForNameAndId } from './nameAndIdPrompt';
import { pickWorkspaceFolder } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Create `src/game/dialogs/<id>/`, `<id>.dialog.json`, and `<id>.dialog.ts`.
 */
export async function runCreateDialogWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const named = await promptForNameAndId({
        namePrompt: 'Dialog display name (shown in the BENNE tree; stored as `displayName` in JSON)',
        namePlaceHolder: 'Clerk — small talk',
        idPrompt: 'Dialog id (folder name and file prefix; must match `id` in JSON)',
        idLabel: 'Dialog id',
        fallbackId: 'dialog'
    });
    if (!named) {
        return;
    }
    const { name, id } = named;

    const dialogDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'dialogs', id);
    const dialogJsonUri = vscode.Uri.joinPath(dialogDir, `${id}.dialog.json`);
    const dialogTsUri = vscode.Uri.joinPath(dialogDir, `${id}.dialog.ts`);

    try {
        await vscode.workspace.fs.stat(dialogDir);
        void vscode.window.showErrorMessage(`Dialog folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const dialogJson = {
        id,
        displayName: name,
        options: [
            {
                id: 'greeting',
                text: 'Hello.',
                enabled: true
            }
        ]
    };

    const dialogTs = `// Dialog script for \`${id}\` (docs/bennescript-ergonomics-refactor.md §4.8): what happens when the
// player picks an option, \`options.greeting.onChoose(() => { … })\`. The Inspector's option "Script…"
// buttons add them, with imports from \`./${id}.ids\`.
`;

    await vscode.workspace.fs.createDirectory(dialogDir);
    await vscode.workspace.fs.writeFile(dialogJsonUri, formatJson(dialogJson));
    await vscode.workspace.fs.writeFile(dialogTsUri, new TextEncoder().encode(dialogTs));

    void vscode.window.showInformationMessage(
        `Created dialog "${name}" (${id}). Open it from the BENNE tree → Dialogs to edit options in the Inspector.`
    );
}

/** Single-column layout, then open the dialog TypeScript companion (Inspector edits JSON). */
export async function openDialogScriptEditorOnly(dialogJsonUri: vscode.Uri, dialogId: string): Promise<void> {
    await applyBenneSingleColumnEditorLayout();
    await openBenneDialogTypeScript(dialogJsonUri, dialogId);
}
