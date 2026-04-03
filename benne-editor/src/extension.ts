import * as vscode from 'vscode';
import { EditorSelection } from './editorSelection';
import { MainTreeProvider } from './mainTreeProvider';
import { RoomTreeProvider } from './roomTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const selection = new EditorSelection();
    const mainProvider = new MainTreeProvider();
    const roomProvider = new RoomTreeProvider(selection);

    const mainTreeView = vscode.window.createTreeView('benne-editor.main', {
        treeDataProvider: mainProvider,
        showCollapseAll: true
    });

    const roomTreeView = vscode.window.createTreeView('benne-editor.room', {
        treeDataProvider: roomProvider,
        showCollapseAll: false
    });

    context.subscriptions.push(
        mainTreeView,
        roomTreeView,
        selection,
        mainTreeView.onDidChangeSelection((e) => {
            const node = e.selection[0];
            if (!node) {
                return;
            }
            if (node.kind === 'room') {
                selection.setRoom(node.uri, node.name);
            } else if (node.kind === 'character') {
                selection.setCharacter(node.uri, node.name);
            }
        })
    );

    const refreshTrees = (): void => {
        mainProvider.refresh();
        roomProvider.refresh();
    };

    const jsonWatcher = vscode.workspace.createFileSystemWatcher('**/src/game/**/*.json');
    context.subscriptions.push(
        jsonWatcher,
        jsonWatcher.onDidChange(refreshTrees),
        jsonWatcher.onDidCreate(refreshTrees),
        jsonWatcher.onDidDelete(refreshTrees)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('benne-editor.showSidebar', async () => {
            await vscode.commands.executeCommand('workbench.view.extension.benne-editor');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('benne-editor.openEditor', async () => {
            const panel = vscode.window.createWebviewPanel(
                'benneEditor',
                'BENNE Editor',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = getWebviewContent();

            panel.webview.onDidReceiveMessage(
                async (message: { command?: string }) => {
                    switch (message.command) {
                        case 'createRoom': {
                            const roomName = await vscode.window.showInputBox({
                                prompt: 'Enter the new room name (e.g. kitchen, hallway, bedroom)',
                                placeHolder: 'kitchen',
                                validateInput: (value) => {
                                    if (!value || !/^[a-z0-9_-]+$/i.test(value)) {
                                        return 'Room name must contain only letters, numbers, underscore or hyphen';
                                    }
                                    return null;
                                }
                            });

                            if (roomName) {
                                vscode.window.showInformationMessage(`Creating room: ${roomName}`);
                                panel.webview.postMessage({
                                    command: 'roomCreated',
                                    roomName
                                });
                            }
                            break;
                        }
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BENNE Editor</title>
            <style>
                body { 
                    font-family: system-ui, sans-serif; 
                    padding: 20px; 
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    cursor: pointer;
                    border-radius: 4px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h1>BENNE Editor</h1>
            <p>Use the <strong>BENNE</strong> activity bar for <em>Main</em> (rooms &amp; characters) and <em>Room</em> (props). This panel will host the visual canvas later.</p>
            
            <button id="create-room-btn">Create New Room</button>

            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('create-room-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'createRoom' });
                });
            </script>
        </body>
        </html>`;
}

export function deactivate(): void {}
