import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('BENNE Editor is now active!');

    const disposable = vscode.commands.registerCommand('benne-editor.openEditor', async () => {
        // Create the webview panel
        const panel = vscode.window.createWebviewPanel(
            'benneEditor',           // Internal ID
            'BENNE Editor',         // Title shown in tab
            vscode.ViewColumn.One,       // Where to show the panel
            {
                enableScripts: true,     // Allow JavaScript in the webview
                retainContextWhenHidden: true
            }
        );

        // Simple initial HTML with "Create Room" button
        panel.webview.html = getWebviewContent();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'createRoom':
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
                            // TODO: Later we will create the folder + .room.json here
                            panel.webview.postMessage({ 
                                command: 'roomCreated', 
                                roomName 
                            });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent() {
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
            <p>This is the starting point for the visual point-and-click editor.</p>
            
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

export function deactivate() {}