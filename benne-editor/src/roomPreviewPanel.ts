import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { applyRoomPolygonPatch, parseRoomPolygonPatch } from './roomPolygonPatch';

/**
 * Phaser room preview in a {@link vscode.WebviewPanel} (editor area), driven by BENNE tree selection.
 */
export class RoomPreviewPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly selection: EditorSelection
    ) {
        this.disposables.push(
            this.selection.onDidChange(() => {
                void this.onSelectionChanged();
            })
        );
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
    }

    /** Close the Phaser preview webview before resetting the editor area for a new tree selection. */
    resetPreviewPanel(): void {
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        p.dispose();
    }

    private async onSelectionChanged(): Promise<void> {
        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;

        const wantRoomPreview =
            roomPanel.kind === 'prop' || focus.kind === 'room';

        if (!wantRoomPreview) {
            if (this.panel && this.webviewReady) {
                void this.panel.webview.postMessage({ type: 'benne/preview/clear' });
            }
            return;
        }

        const createdNew = this.ensurePanel();
        const roomOnly = focus.kind === 'room' && roomPanel.kind === 'none';
        if (this.panel && roomOnly) {
            this.panel.reveal(vscode.ViewColumn.One, true);
        }
        if (createdNew) {
            this.webviewReady = false;
        } else if (this.webviewReady) {
            await this.pushPreview();
        }
    }

    /** Creates the panel if needed. Returns true if the panel was just created. */
    private ensurePanel(): boolean {
        if (this.panel) {
            return false;
        }

        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;
        const roomOnly = focus.kind === 'room' && roomPanel.kind === 'none';
        const column = roomOnly
            ? vscode.ViewColumn.One
            : vscode.window.activeTextEditor
              ? vscode.ViewColumn.Beside
              : vscode.ViewColumn.One;

        this.panel = vscode.window.createWebviewPanel(
            'benneRoomPreview',
            'BENNE Room preview',
            { viewColumn: column, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    this.extensionUri,
                    ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
                ],
            }
        );

        this.panel.webview.html = buildRoomPreviewHtml(this.panel.webview, this.extensionUri);

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage((m: { type?: string; roomJsonUri?: string; patch?: unknown }) => {
                if (m?.type === 'benne/preview/ready') {
                    this.webviewReady = true;
                    void this.pushPreview();
                    return;
                }
                if (m?.type === 'benne/preview/polygonPatch') {
                    void this.handlePolygonPatchFromWebview(m.roomJsonUri, m.patch);
                }
            }),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
            })
        );

        return true;
    }

    private async handlePolygonPatchFromWebview(roomJsonUriStr: string | undefined, patchBody: unknown): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview || typeof roomJsonUriStr !== 'string') {
            return;
        }
        const patch = parseRoomPolygonPatch(patchBody);
        if (!patch) {
            webview.postMessage({
                type: 'benne/preview/polygonPatchResult',
                ok: false,
                message: 'Invalid polygon patch payload.',
            });
            return;
        }
        let uri: vscode.Uri;
        try {
            uri = vscode.Uri.parse(roomJsonUriStr);
        } catch {
            webview.postMessage({
                type: 'benne/preview/polygonPatchResult',
                ok: false,
                message: 'Invalid room JSON URI.',
            });
            return;
        }
        try {
            await applyRoomPolygonPatch(uri, patch);
        } catch (e) {
            webview.postMessage({
                type: 'benne/preview/polygonPatchResult',
                ok: false,
                message: e instanceof Error ? e.message : String(e),
            });
            return;
        }
        webview.postMessage({ type: 'benne/preview/polygonPatchResult', ok: true });
        await this.pushPreview();
    }

    private async pushPreview(): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }

        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;

        let roomJsonUri: vscode.Uri | undefined;
        if (roomPanel.kind === 'prop') {
            roomJsonUri = roomPanel.roomJsonUri;
        } else if (focus.kind === 'room') {
            roomJsonUri = focus.uri;
        } else {
            webview.postMessage({ type: 'benne/preview/clear' });
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
        if (!folder) {
            webview.postMessage({
                type: 'benne/preview/error',
                message: 'Room JSON is not inside a workspace folder.',
            });
            return;
        }

        const gameSrc = vscode.Uri.joinPath(folder.uri, 'src', 'game');
        try {
            await vscode.workspace.fs.stat(gameSrc);
        } catch {
            webview.postMessage({
                type: 'benne/preview/error',
                message: 'No src/game folder in this workspace.',
            });
            return;
        }

        try {
            const raw = await vscode.workspace.fs.readFile(roomJsonUri);
            const room = JSON.parse(Buffer.from(raw).toString('utf8')) as Record<string, unknown>;
            const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
            webview.postMessage({
                type: 'benne/preview/loadRoom',
                room,
                gameSrcWebviewUri,
                roomJsonUri: roomJsonUri.toString(),
            });
        } catch (e) {
            webview.postMessage({
                type: 'benne/preview/error',
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }
}

function buildRoomPreviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'room-preview', 'room-preview.js')
    );
    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `img-src ${webview.cspSource} https: data: blob:`,
        `connect-src ${webview.cspSource} https://*.vscode-cdn.net https://*.vscode-resource.vscode-cdn.net data: blob:`,
        `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#1a1a2e;height:100vh;display:flex;flex-direction:column;">
  <div id="benne-polygon-toolbar" style="flex-shrink:0;"></div>
  <div id="benne-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
