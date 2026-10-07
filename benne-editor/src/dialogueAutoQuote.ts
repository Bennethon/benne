import * as vscode from 'vscode';
import { isBenneScriptFile, typedSpeakerLabel } from './bennescript/tsPluginFeatures';

/**
 * Typing `Hank:` at the start of a statement in a BenneScript file inserts `` `…` `` with the cursor
 * inside, so dialogue is written as `` Hank: `The door is locked.` ``. Whether the name is a speaker
 * in statement position is left to the TS server plugin: it offers its `Hank:` snippet entry only
 * there (speakerCompletionEntries), so object keys, type members and `case X:` are not touched.
 */
const SETTING = 'dialogue.autoInsertBackticks';

function labelText(item: vscode.CompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

export function registerDialogueAutoQuote(context: vscode.ExtensionContext): void {
    let generation = 0;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const doc = event.document;
            if (doc.languageId !== 'typescript' || event.contentChanges.length !== 1 || !isBenneScriptFile(doc.uri.fsPath)) {
                return;
            }
            const change = event.contentChanges[0];
            if (change.text !== ':' || change.rangeLength !== 0) {
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== doc || editor.selections.length !== 1) {
                return;
            }
            if (!vscode.workspace.getConfiguration('benneEditor', doc.uri).get<boolean>(SETTING, true)) {
                return;
            }
            const colon = change.range.start;
            const label = typedSpeakerLabel(doc.lineAt(colon.line).text, colon.character);
            if (!label) {
                return;
            }
            const after = colon.translate(0, 1);
            const mine = ++generation;
            const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                doc.uri,
                colon
            );
            if (mine !== generation || !editor.selection.isEmpty || !editor.selection.active.isEqual(after)) {
                return;
            }
            if (!list?.items.some((item) => labelText(item) === `${label}:`)) {
                return;
            }
            await editor.insertSnippet(new vscode.SnippetString(' `$0`'), after);
        })
    );
}
