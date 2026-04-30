import * as vscode from 'vscode';

/**
 * After `B.dialog('…')`, typing `.` offers `start` / `start.now` stubs for room, character, and global scripts.
 */
export function registerDialogBenneScriptCompletion(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = [
        { scheme: 'file', language: 'typescript', pattern: '**/src/game/rooms/**/*.room.ts' },
        { scheme: 'file', language: 'typescript', pattern: '**/src/game/characters/**/*.character.ts' },
        { scheme: 'file', language: 'typescript', pattern: '**/src/game/globalScript.ts' }
    ];

    const provider = vscode.languages.registerCompletionItemProvider(
        selector,
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const line = document.lineAt(position).text;
                const before = line.slice(0, position.character);
                const re = /B\.dialog\s*\(\s*(['"])([\w-]+)\1\s*\)\s*$/;
                if (!re.test(before)) {
                    return undefined;
                }
                const start = new vscode.CompletionItem('start — open dialog (queued)', vscode.CompletionItemKind.Method);
                start.insertText = new vscode.SnippetString('.start(() => {\n\t$0\n});');
                start.sortText = '\u0000start';
                start.documentation = new vscode.MarkdownString(
                    'Queues `B.dialog(…).start` on the Bennescript interaction tail (same as other blocking calls).'
                );

                const startNow = new vscode.CompletionItem(
                    'start.now — open dialog immediately',
                    vscode.CompletionItemKind.Method
                );
                startNow.insertText = new vscode.SnippetString('.start.now(() => {\n\t$0\n});');
                startNow.sortText = '\u0000startNow';
                startNow.documentation = new vscode.MarkdownString(
                    'Runs the dialog session open step immediately (skips the interaction queue).'
                );

                return [start, startNow];
            }
        },
        '.'
    );

    context.subscriptions.push(provider);
}
