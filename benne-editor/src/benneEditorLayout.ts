import * as vscode from 'vscode';

/**
 * Two editor rows: full-width top (preview webview), full-width bottom (TypeScript source).
 * Closes the bottom Panel too when `benneEditor.layout.closePanelOnOpen` is on.
 */
export async function applyBenneTwoRowJsonScriptLayout(): Promise<void> {
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 1,
        groups: [{}, {}]
    });
    if (vscode.workspace.getConfiguration('benneEditor').get<boolean>('layout.closePanelOnOpen', false)) {
        await vscode.commands.executeCommand('workbench.action.closePanel');
    }
}

/** Single editor column (e.g. dialog scripts — no preview row). */
export async function applyBenneSingleColumnEditorLayout(): Promise<void> {
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 1,
        groups: [{}]
    });
}
