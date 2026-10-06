import * as vscode from 'vscode';
import { applyBenneSingleColumnEditorLayout } from './benneEditorLayout';
import { ensureAndRevealHandler } from './scriptHandlers';

/** The dialog's content ID (`"id"` in its JSON, else the folder name), as the handle generator uses it. */
async function readDialogContentId(dialogJsonUri: vscode.Uri, folderId: string): Promise<string> {
    try {
        const data = JSON.parse(new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(dialogJsonUri))) as {
            id?: unknown;
        };
        return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : folderId;
    } catch {
        return folderId;
    }
}

/**
 * Inspector "Script…" on a dialog option: reveals its `options.x.onChoose(…)` / `onChooseOnce(…)`
 * in the sibling `*.dialog.ts`, or adds an `onChoose` stub (§4.8).
 */
export async function ensureDialogChoiceHandlerAndReveal(
    dialogJsonUri: vscode.Uri,
    dialogId: string,
    optionId: string,
    optionText = ''
): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(dialogJsonUri, '..', `${dialogId}.dialog.ts`);
    const contentId = await readDialogContentId(dialogJsonUri, dialogId);
    const r = await ensureAndRevealHandler(
        scriptUri,
        { kind: 'choice', dialogId: contentId, optionId, optionText: optionText.trim() || undefined },
        vscode.ViewColumn.One
    );
    await applyBenneSingleColumnEditorLayout();
    if (r.status === 'inserted') {
        void vscode.window.showInformationMessage(`Added a choice handler for "${optionId}" in ${dialogId}.dialog.ts.`);
    }
}
