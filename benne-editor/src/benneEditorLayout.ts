import * as vscode from 'vscode';

let inspectorRevealer: (() => Promise<void>) | undefined;

/** `extension.ts` passes the Inspector's reveal, so the layouts below can show it. */
export function setBenneInspectorRevealer(reveal: (() => Promise<void>) | undefined): void {
    inspectorRevealer = reveal;
}

/**
 * Opens the Secondary Side Bar on the BENNE Inspector, without taking focus, when
 * `benneEditor.layout.revealInspector` is on (the default).
 */
async function revealBenneInspector(): Promise<void> {
    if (vscode.workspace.getConfiguration('benneEditor').get<boolean>('layout.revealInspector', true)) {
        await inspectorRevealer?.();
    }
}

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
    await revealBenneInspector();
}

/** Single editor column (e.g. dialog scripts — no preview row). */
export async function applyBenneSingleColumnEditorLayout(): Promise<void> {
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 1,
        groups: [{}]
    });
    await revealBenneInspector();
}
