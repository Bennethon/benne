import * as vscode from 'vscode';
import { isBenneScriptFile } from './bennescript/tsPluginFeatures';

/**
 * Opens the suggestion list after `(` or `= ` in a BenneScript file when the expected value is a
 * string union: `hank.face(` → `'U'`, `'D'`, …; `door.animation = ` → its tags
 * (docs/bennescript-ergonomics-refactor.md §9). VS Code only asks for completions there when the
 * user types a quote; the TS server plugin already puts the quoted values first.
 *
 * A completion that inserted `face()` with the cursor inside (the plugin's `addCallParentheses`)
 * also gets the parameter hints VS Code shows when `(` is typed.
 */
const QUOTED = /^(['"]).*\1$/;

function labelText(item: vscode.CompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

function triggerFor(
    doc: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent
): { position: vscode.Position; completed: boolean } | undefined {
    const start = change.range.start;
    if (/^[\w$]+\(\)$/.test(change.text)) {
        return { position: start.translate(0, change.text.length - 1), completed: true };
    }
    if (change.rangeLength !== 0) {
        return undefined;
    }
    if (change.text === '(' || change.text === '()') {
        return { position: start.translate(0, 1), completed: false };
    }
    if (change.text === ' ' && start.character > 0) {
        const before = doc.lineAt(start.line).text.slice(0, start.character);
        // `x = ` but not `==`, `!=`, `<=`, `=>`.
        if (/[^=!<>]=$/.test(before)) {
            return { position: start.translate(0, 1), completed: false };
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
            const trigger = triggerFor(doc, event.contentChanges[0]);
            const editor = vscode.window.activeTextEditor;
            if (!trigger || !editor || editor.document !== doc) {
                return;
            }
            const { position, completed } = trigger;
            const mine = ++generation;
            const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                doc.uri,
                position
            );
            if (mine !== generation || !editor.selection.active.isEqual(position)) {
                return;
            }
            if (completed) {
                await vscode.commands.executeCommand('editor.action.triggerParameterHints');
            }
            if (list?.items.some((item) => QUOTED.test(labelText(item)))) {
                await vscode.commands.executeCommand('editor.action.triggerSuggest');
            }
        })
    );
}
