import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { resolveBennePlayMediaRootUri, resolvePreviewScriptUri } from './previewBundlePaths';

/**
 * Full playable BENNE runtime in an editor webview. This is intentionally separate from
 * the room preview authoring canvas so geometry editing and runtime play can coexist.
 */
export class BennePlayPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private lastStartRoomId: string | undefined;
    private lastRoomName: string | undefined;
    private lastPlayFromName: string | undefined;
    private lastMuted = false;
    private lastGameRootUri: vscode.Uri | undefined;
    private panelDisposeSideEffect: (() => void) | undefined;

    constructor(private readonly extensionUri: vscode.Uri) {}

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
        this.clearLastSession();
    }

    /**
     * Runs when the Play webview is closed (e.g. stop Vite watch for this session).
     * Overwritten on each `playFromRoom` while the panel exists.
     */
    setPanelDisposeSideEffect(handler: (() => void) | undefined): void {
        this.panelDisposeSideEffect = handler;
    }

    /** Re-applies webview HTML so the embedded `benne-play.js` (and chunks) reload after a watch rebuild. */
    reloadWebview(): void {
        if (!this.panel || !this.lastStartRoomId) {
            return;
        }
        this.panel.title = `BENNE Play: ${this.lastRoomName ?? this.lastStartRoomId}`;
        void this.applyPlayHtml();
    }

    playFromRoom(
        roomId: string,
        roomName?: string,
        playFromName?: string,
        gameRoot?: vscode.Uri,
        muted = false,
    ): void {
        this.lastStartRoomId = roomId;
        this.lastRoomName = roomName;
        this.lastPlayFromName = playFromName;
        this.lastMuted = muted;
        if (gameRoot) {
            this.lastGameRootUri = gameRoot;
        }

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'bennePlay',
                'BENNE Play',
                { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
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
                this.panelDisposeSideEffect?.();
                this.panelDisposeSideEffect = undefined;
                this.panel = undefined;
                this.clearLastSession();
            });
        } else {
            this.panel.reveal(vscode.ViewColumn.Active, false);
        }

        this.panel.title = `BENNE Play: ${roomName ?? roomId}`;
        void this.applyPlayHtml();
    }

    private async applyPlayHtml(): Promise<void> {
        if (!this.panel || !this.lastStartRoomId) {
            return;
        }
        this.panel.webview.html = await buildBennePlayHtml(
            this.panel.webview,
            this.extensionUri,
            this.lastGameRootUri,
            this.lastStartRoomId,
            this.lastPlayFromName,
            this.lastMuted,
        );
    }

    private clearLastSession(): void {
        this.lastStartRoomId = undefined;
        this.lastRoomName = undefined;
        this.lastPlayFromName = undefined;
        this.lastMuted = false;
    }
}

function buildBennePlayHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
    startRoomId: string,
    playFromName?: string,
    muted = false,
): Promise<string> {
    return resolveBennePlayMediaRootUri(extensionUri, gameRoot).then(async (playRoot) => {
    const baseHrefRaw = webview.asWebviewUri(playRoot).toString();
    const baseHref = baseHrefRaw.endsWith('/') ? baseHrefRaw : `${baseHrefRaw}/`;
    const scriptUri = await resolvePreviewScriptUri(
        webview,
        extensionUri,
        gameRoot,
        'benne-play',
        'benne-play.js',
    );
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
    body { display: flex; flex-direction: column; }
    #benne-play-topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      padding: 6px 10px;
      border-bottom: 1px solid #2e2e44;
      background: #222230;
      font-family: system-ui, sans-serif;
    }
    #benne-play-topbar label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #c8d0e0;
      font-size: 12px;
      user-select: none;
    }
    #benne-play-inventory-select {
      min-width: 180px;
      max-width: min(420px, 50vw);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #5a5a70;
      background: #1a1a28;
      color: #e8ecff;
      font-size: 12px;
    }
    #benne-play-give-inventory {
      flex-shrink: 0;
      background: #3a3a52;
      color: #e8ecff;
      border: 1px solid #5a5a70;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    #benne-play-give-inventory:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    #game-container { flex: 1; min-height: 0; width: 100%; position: relative; }
    #game-container canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <div id="benne-play-topbar">
    <label for="benne-play-inventory-select">Inventory</label>
    <select id="benne-play-inventory-select" aria-label="Inventory item to give"></select>
    <button type="button" id="benne-play-give-inventory" title="Add the selected item to the player inventory">Give</button>
  </div>
  <div id="game-container"></div>
  <script nonce="${nonce}">
    globalThis.__BENNE_PLAY_MEDIA_BASE__ = ${JSON.stringify(baseHref)};
    globalThis.__BENNE_START_ROOM_ID = ${JSON.stringify(startRoomId)};
    globalThis.__BENNE_PLAY_FROM_NAME = ${JSON.stringify(playFromName ?? '')};
    globalThis.__BENNE_PLAY_MUTED = ${JSON.stringify(muted)};
  </script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    });
}
