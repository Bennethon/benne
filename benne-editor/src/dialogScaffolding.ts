import * as vscode from 'vscode';
import { applyBenneSingleColumnEditorLayout } from './benneEditorLayout';
import { camelCaseId } from './bennescript/idsIndex';
import type { MainTreeNode } from './mainTreeProvider';
import { openBenneDialogTypeScript } from './roomScriptNavigation';
import { promptForNameAndId } from './nameAndIdPrompt';
import { pickWorkspaceFolder } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Create `src/game/dialogs/<id>/`, `<id>.dialog.json`, and `<id>.dialog.ts`.
 */
export async function runCreateDialogWizard(
    preferredFolder?: vscode.WorkspaceFolder
): Promise<Extract<MainTreeNode, { kind: 'dialog' }> | undefined> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return undefined;
    }

    const named = await promptForNameAndId({
        namePrompt: 'Dialog display name (shown in the BENNE tree; stored as `displayName` in JSON)',
        namePlaceHolder: 'Clerk — small talk',
        idPrompt: 'Dialog id (folder name and file prefix; must match `id` in JSON)',
        idLabel: 'Dialog id',
        fallbackId: 'dialog'
    });
    if (!named) {
        return undefined;
    }
    const { name, id } = named;

    const dialogDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'dialogs', id);
    const dialogJsonUri = vscode.Uri.joinPath(dialogDir, `${id}.dialog.json`);
    const dialogTsUri = vscode.Uri.joinPath(dialogDir, `${id}.dialog.ts`);

    try {
        await vscode.workspace.fs.stat(dialogDir);
        void vscode.window.showErrorMessage(`Dialog folder already exists: ${id}`);
        return undefined;
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

    const dialogTs = `// ${name}: what happens when the player picks each option. The options themselves (their
// text, and whether they start switched on) are edited in the Inspector; its Script… button
// next to an option adds a handler here. The player says the option's text, then the handler runs:
//
//   options.greeting.onChoose(() => {
//     Player: \`Nice to meet you.\`
//     options.askAboutKey.on()   // show another option
//     dialog.end()               // close the conversation (nothing after this runs)
//   })
//
// onChooseOnce(…) works the same way but removes the option once it's been picked.
// \`dialog\` and \`options\` are imported from './${id}.ids'. Start the conversation from another
// script with dialogs.${camelCaseId(id)}.start().
`;

    await vscode.workspace.fs.createDirectory(dialogDir);
    await vscode.workspace.fs.writeFile(dialogJsonUri, formatJson(dialogJson));
    await vscode.workspace.fs.writeFile(dialogTsUri, new TextEncoder().encode(dialogTs));

    void vscode.window.showInformationMessage(
        `Created dialog "${name}" (${id}). Edit its options in the Inspector.`
    );
    return { kind: 'dialog', folder, id, name, uri: dialogJsonUri };
}

/** Single-column layout, then open the dialog TypeScript companion (Inspector edits JSON). */
export async function openDialogScriptEditorOnly(dialogJsonUri: vscode.Uri, dialogId: string): Promise<void> {
    await applyBenneSingleColumnEditorLayout();
    await openBenneDialogTypeScript(dialogJsonUri, dialogId);
}
