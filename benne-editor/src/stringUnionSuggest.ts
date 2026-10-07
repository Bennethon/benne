import * as vscode from 'vscode';
import { isBenneScriptFile } from './bennescript/tsPluginFeatures';

/**
 * Opens the suggestion list after `(` or `= ` in a BenneScript file when the expected value is a
 * string union: `hank.face(` → `'U'`, `'D'`, …; `door.animation = ` → its tags
 * (docs/bennescript-ergonomics-refactor.md §9). VS Code only asks for completions there when the
 * user types a quote; the TS server plugin already puts the quoted values first.
 */
const QUOTED = /^(['"]).*\1$/;

function labelText(item: vscode.CompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

function triggerFor(doc: vscode.TextDocument, change: vscode.TextDocumentContentChangeEvent): vscode.Position | undefined {
    if (change.rangeLength !== 0) {
        return undefined;
    }
    const start = change.range.start;
    if (change.text === '(' || change.text === '()') {
        return start.translate(0, 1);
    }
    if (change.text === ' ' && start.character > 0) {
        const before = doc.lineAt(start.line).text.slice(0, start.character);
        // `x = ` but not `==`, `!=`, `<=`, `=>`.
        if (/[^=!<>]=$/.test(before)) {
            return start.translate(0, 1);
        }
    }
    return undefined;
}

export function registerStringUnionSuggest(context: vscode.ExtensionContext): void {
    let generation = 0;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const doc = event.document;
            if (doc.languageId !== 'typescript' || event.contentChanges.length !== 1 || !isBenneScriptFile(doc.uri.fsPath)) {
                return;
            }
            const position = triggerFor(doc, event.contentChanges[0]);
            const editor = vscode.window.activeTextEditor;
            if (!position || !editor || editor.document !== doc) {
                return;
            }
            const mine = ++generation;
            const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                doc.uri,
                position
            );
            if (mine !== generation || !editor.selection.active.isEqual(position)) {
                return;
            }
            if (list?.items.some((item) => QUOTED.test(labelText(item)))) {
                await vscode.commands.executeCommand('editor.action.triggerSuggest');
            }
        })
    );
}
