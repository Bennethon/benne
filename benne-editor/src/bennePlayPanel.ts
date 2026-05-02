import * as crypto from 'node:crypto';
import * as vscode from 'vscode';

/**
 * Full playable BENNE runtime in an editor webview. This is intentionally separate from
 * the room preview authoring canvas so geometry editing and runtime play can coexist.
 */
export class BennePlayPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;

    constructor(private readonly extensionUri: vscode.Uri) {}

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }

    playFromRoom(roomId: string, roomName?: string): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'bennePlay',
                'BENNE Play',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
                {
                    enableScripts: true,
                    retainContextWhenHidden: false,
                    localResourceRoots: [
                        this.extensionUri,
                        ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
                    ],
                }
            );
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside, false);
        }

        this.panel.title = `BENNE Play: ${roomName ?? roomId}`;
        this.panel.webview.html = buildBennePlayHtml(this.panel.webview, this.extensionUri, roomId);
    }
}

function buildBennePlayHtml(webview: vscode.Webview, extensionUri: vscode.Uri, startRoomId: string): string {
    const playRoot = vscode.Uri.joinPath(extensionUri, 'media', 'benne-play');
    const baseHrefRaw = webview.asWebviewUri(playRoot).toString();
    const baseHref = baseHrefRaw.endsWith('/') ? baseHrefRaw : `${baseHrefRaw}/`;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(playRoot, 'benne-play.js'));
    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `img-src ${webview.cspSource} https: data: blob:`,
        `connect-src ${webview.cspSource} https://*.vscode-cdn.net https://*.vscode-resource.vscode-cdn.net data: blob:`,
        `font-src ${webview.cspSource}`,
        `media-src ${webview.cspSource} blob:`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0f0f1a; }
    #game-container { width: 100%; height: 100%; }
    #game-container canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script nonce="${nonce}">
    globalThis.__BENNE_PLAY_MEDIA_BASE__ = ${JSON.stringify(baseHref)};
    globalThis.__BENNE_START_ROOM_ID = ${JSON.stringify(startRoomId)};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
