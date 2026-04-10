import * as vscode from 'vscode';

/** Bottom-row split: room/character JSON (narrow) | `*.room.ts` / `*.character.ts` (wide). Sizes must sum to 1. */
const JSON_PANE_RATIO = 0.3;
const SCRIPT_PANE_RATIO = 0.7;

/**
 * Two editor rows: full-width top (preview webview), bottom row JSON | TypeScript with a 30/70 horizontal split.
 * Replaces `workbench.action.editorLayoutTwoRows` so the bottom row is not 50/50.
 */
export async function applyBenneTwoRowJsonScriptLayout(): Promise<void> {
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
        orientation: 1,
        groups: [{}, { groups: [{ size: JSON_PANE_RATIO }, { size: SCRIPT_PANE_RATIO }] }]
    });
}
