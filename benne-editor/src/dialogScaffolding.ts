import * as vscode from 'vscode';
import { applyBenneSingleColumnEditorLayout } from './benneEditorLayout';
import { openBenneDialogTypeScript } from './roomScriptNavigation';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultDialogIdFromDisplayName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'dialog';
}

/**
 * Create `src/game/dialogs/<id>/`, `<id>.dialog.json`, and `<id>.dialog.ts`.
 */
export async function runCreateDialogWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt: 'Dialog display name (shown in the BENNE tree; stored as `displayName` in JSON)',
        placeHolder: 'Clerk — small talk',
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

    const defaultId = defaultDialogIdFromDisplayName(name);

    const dialogId = await vscode.window.showInputBox({
        prompt: 'Dialog id (folder name and file prefix; must match `id` in JSON)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Dialog id')
    });
    if (!dialogId) {
        return;
    }
    const id = dialogId.trim();

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

    const dialogTs = `import { registerDialogScript } from '@engine/scripting';

registerDialogScript('${id}', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;
}, import.meta.url);
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
