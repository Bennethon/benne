import * as vscode from 'vscode';
import { ActionsTreeProvider } from './actionsTreeProvider';
import { EditorSelection } from './editorSelection';
import { MainTreeProvider, type MainTreeNode } from './mainTreeProvider';
import { RoomPreviewPanelController } from './roomPreviewPanel';
import { openDocumentPinned, openDocumentUri, revealEventInDocument } from './roomScriptNavigation';

export function activate(context: vscode.ExtensionContext): void {
    const selection = new EditorSelection();
    const mainProvider = new MainTreeProvider();
    const actionsProvider = new ActionsTreeProvider(selection);

    const mainTreeView = vscode.window.createTreeView('benne-editor.main', {
        treeDataProvider: mainProvider,
        showCollapseAll: true
    });

    const actionsTreeView = vscode.window.createTreeView('benne-editor.actions', {
        treeDataProvider: actionsProvider,
        showCollapseAll: false
    });

    const roomPreview = new RoomPreviewPanelController(context.extensionUri, selection);

    context.subscriptions.push(
        roomPreview,
        mainTreeView,
        actionsTreeView,
        selection,
        mainTreeView.onDidChangeSelection((e) => {
            void onMainTreeSelection(e.selection[0] as MainTreeNode | undefined);
        })
    );

    async function resetBenneEditorSurface(): Promise<void> {
        roomPreview.resetPreviewPanel();
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    async function onMainTreeSelection(node: MainTreeNode | undefined): Promise<void> {
        if (!node) {
            return;
        }
        if (node.kind === 'room') {
            await resetBenneEditorSurface();
            await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
            selection.setRoom(node.uri, node.name);
            await openRoomJsonAndScript(node.uri, node.id);
        } else if (node.kind === 'prop') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
            } else if (!roomPreview.isRoomPreviewActive()) {
                await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
            }

            selection.setRoomWithProp(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.prop
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'character') {
            await resetBenneEditorSurface();
            await vscode.commands.executeCommand('workbench.action.editorLayoutSingle');
            selection.setCharacter(node.uri, node.name);
            await openCharacterJsonAndScript(node.uri, node.id);
        }
    }

    const refreshTrees = (): void => {
        mainProvider.refresh();
        actionsProvider.refresh();
    };

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'benne-editor.openUriPreview',
            async (uriStr?: string, preview?: boolean) => {
                if (typeof uriStr !== 'string') {
                    return;
                }
                await openDocumentUri(vscode.Uri.parse(uriStr), preview === true);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.openRoomScriptPreview',
            async (roomJsonUriStr?: string, roomId?: string) => {
                if (typeof roomJsonUriStr !== 'string' || typeof roomId !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await openDocumentPinned(scriptUri, vscode.ViewColumn.Active);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealRegisterRoomScript',
            async (roomJsonUriStr?: string, roomId?: string) => {
                if (typeof roomJsonUriStr !== 'string' || typeof roomId !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await revealEventInDocument(scriptUri, 'registerRoomScript');
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealRoomScriptEvent',
            async (roomJsonUriStr?: string, roomId?: string, eventId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof eventId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await revealEventInDocument(scriptUri, eventId);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealCharacterScriptEvent',
            async (characterJsonUriStr?: string, characterId?: string, eventId?: string) => {
                if (
                    typeof characterJsonUriStr !== 'string' ||
                    typeof characterId !== 'string' ||
                    typeof eventId !== 'string'
                ) {
                    return;
                }
                const charJsonUri = vscode.Uri.parse(characterJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(
                    charJsonUri,
                    '..',
                    `${characterId}.character.ts`
                );
                await revealEventInDocument(scriptUri, eventId);
            }
        )
    );

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
            <p>Use the <strong>BENNE</strong> activity bar for the <em>BENNE</em> tree and <em>Actions</em>. Each tree choice resets the editor area, then opens the right layout: rooms and props — two rows with <em>BENNE Room preview</em> on top and pinned room JSON + <code>*.room.ts</code> below; characters — single group with pinned character JSON + <code>*.character.ts</code>.</p>
            
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

/** Bottom editor group after `workbench.action.editorLayoutTwoRows` (JSON + *.room.ts as tabs). */
const ROOM_SOURCES_VIEW_COLUMN = vscode.ViewColumn.Two;

async function openRoomJsonAndScript(roomJsonUri: vscode.Uri, roomId: string): Promise<void> {
    await openDocumentPinned(roomJsonUri, ROOM_SOURCES_VIEW_COLUMN);
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
        await openDocumentPinned(scriptUri, ROOM_SOURCES_VIEW_COLUMN);
    } catch {
        /* optional *.room.ts */
    }
}

async function openCharacterJsonAndScript(characterJsonUri: vscode.Uri, characterId: string): Promise<void> {
    await openDocumentPinned(characterJsonUri, vscode.ViewColumn.One);
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        await vscode.workspace.fs.stat(scriptUri);
        await openDocumentPinned(scriptUri, vscode.ViewColumn.One);
    } catch {
        /* optional *.character.ts */
    }
}
