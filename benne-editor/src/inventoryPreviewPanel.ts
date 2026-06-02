import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getInventoryIdFromInventoryJsonUri } from './gameDiscovery';
import { resolvePreviewScriptUri } from './previewBundlePaths';

/**
 * Phaser inventory preview (single item animation clip) in a {@link vscode.WebviewPanel}.
 */
export class InventoryPreviewPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    private lastGameRootUri: vscode.Uri | undefined;
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

    resetPreviewPanel(): void {
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        p.dispose();
    }

    reloadInventoryPreviewBundle(): void {
        if (!this.panel) {
            return;
        }
        this.webviewReady = false;
        void this.applyPreviewHtml();
    }

    private async applyPreviewHtml(): Promise<void> {
        if (!this.panel) {
            return;
        }
        this.panel.webview.html = await buildInventoryPreviewHtml(
            this.panel.webview,
            this.extensionUri,
            this.lastGameRootUri,
        );
    }

    private async onSelectionChanged(): Promise<void> {
        const focus = this.selection.focus;
        if (focus.kind !== 'inventory') {
            if (this.panel && this.webviewReady) {
                void this.panel.webview.postMessage({ type: 'benne/inventoryPreview/clear' });
            }
            return;
        }

        this.ensurePanel();
        if (this.webviewReady) {
            await this.pushInventoryPreview(focus.uri);
        }
    }

    private ensurePanel(): void {
        if (this.panel) {
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'benneInventoryPreview',
            'BENNE Inventory preview',
            { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    this.extensionUri,
                    ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? [])
                ]
            }
        );

        void this.applyPreviewHtml();

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage((m: { type?: string }) => {
                if (m?.type === 'benne/inventoryPreview/ready') {
                    this.webviewReady = true;
                    void this.pushInventoryPreviewFromSelection();
                }
            }),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
            })
        );
    }

    private async pushInventoryPreviewFromSelection(): Promise<void> {
        const focus = this.selection.focus;
        if (focus.kind !== 'inventory') {
            return;
        }
        await this.pushInventoryPreview(focus.uri);
    }

    private async pushInventoryPreview(inventoryJsonUri?: vscode.Uri): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }

        const uri =
            inventoryJsonUri ??
            (this.selection.focus.kind === 'inventory' ? this.selection.focus.uri : undefined);
        if (!uri) {
            webview.postMessage({ type: 'benne/inventoryPreview/clear' });
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            return;
        }
        this.lastGameRootUri = folder.uri;

        const gameSrc = vscode.Uri.joinPath(folder.uri, 'src', 'game');
        try {
            await vscode.workspace.fs.stat(gameSrc);
        } catch {
            return;
        }

        try {
            const jsonText = await this.readInventoryJsonAsUtf8(uri);
            const inventory = JSON.parse(jsonText) as Record<string, unknown>;
            const inventoryId = getInventoryIdFromInventoryJsonUri(uri);
            const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
            webview.postMessage({
                type: 'benne/inventoryPreview/loadInventory',
                inventory,
                inventoryId,
                gameSrcWebviewUri,
                inventoryJsonUri: uri.toString()
            });
        } catch (e) {
            void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    }

    private async readInventoryJsonAsUtf8(uri: vscode.Uri): Promise<string> {
        const uriStr = uri.toString();
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
        if (open) {
            return open.getText();
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(raw).toString('utf8');
    }
}

function buildInventoryPreviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
): Promise<string> {
    return resolvePreviewScriptUri(
        webview,
        extensionUri,
        gameRoot,
        'inventory-preview',
        'inventory-preview.js',
    ).then((scriptUri) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `img-src ${webview.cspSource} https: data: blob:`,
        `connect-src ${webview.cspSource} https://*.vscode-cdn.net https://*.vscode-resource.vscode-cdn.net data: blob:`,
        `font-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#1a1a2e;height:100vh;display:flex;flex-direction:column;">
  <div id="benne-inventory-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    });
}
