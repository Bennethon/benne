import * as vscode from 'vscode';

/**
 * Two editor rows: full-width top (preview webview), full-width bottom (TypeScript source).
 */
export async function applyBenneTwoRowJsonScriptLayout(): Promise<void> {
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 1,
        groups: [{}, {}]
    });
}
