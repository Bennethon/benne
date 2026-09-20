import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getGuiIdFromGuiJsonUri } from './gameDiscovery';
import { resolvePreviewScriptUri } from './previewBundlePaths';
import { loadRoomData, updateGuiControlPatch, writeDataJson } from './inspectorMutations';

/**
 * Phaser GUI overlay preview (Aseprite sheet) in a {@link vscode.WebviewPanel}.
 */
export class GuiPreviewPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    private lastGameRootUri: vscode.Uri | undefined;
    private lastPushedGuiJsonUri: string | null = null;
    /** After a preview-originated position write, skip JSON-watcher Phaser rebuild. */
    private previewOriginatedGuiJsonUri: string | null = null;
    private previewOriginatedGuiJsonSkipUntil = 0;
    private readonly disposables: vscode.Disposable[] = [];
    /** Debounced reload when the active GUI JSON file changes on disk or in-buffer. */
    private guiJsonChangeTimer: ReturnType<typeof setTimeout> | undefined;

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
        if (this.guiJsonChangeTimer !== undefined) {
            clearTimeout(this.guiJsonChangeTimer);
            this.guiJsonChangeTimer = undefined;
        }
        this.panel?.dispose();
        this.panel = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
    }

    resetPreviewPanel(): void {
        if (this.guiJsonChangeTimer !== undefined) {
            clearTimeout(this.guiJsonChangeTimer);
            this.guiJsonChangeTimer = undefined;
        }
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        this.lastPushedGuiJsonUri = null;
        p.dispose();
    }

    /**
     * When a `*.gui.json` file changes (on disk, saved buffer, or via Inspector write),
     * reload the preview if that GUI is currently shown. Mirrors
     * {@link RoomPreviewPanelController.onWorkspaceRoomJsonChanged}.
     */
    onWorkspaceGuiJsonChanged(uri: vscode.Uri): void {
        if (!uri.fsPath.endsWith('.gui.json')) {
            return;
        }
        if (!this.panel || !this.webviewReady) {
            return;
        }
        const uriStr = uri.toString();
        if (
            this.previewOriginatedGuiJsonUri === uriStr &&
            Date.now() < this.previewOriginatedGuiJsonSkipUntil
        ) {
            return;
        }
        const focus = this.selection.focus;
        if (focus.kind !== 'gui') {
            return;
        }
        if (focus.uri.toString() !== uri.toString()) {
            return;
        }
        if (this.guiJsonChangeTimer !== undefined) {
            clearTimeout(this.guiJsonChangeTimer);
        }
        this.guiJsonChangeTimer = setTimeout(() => {
            this.guiJsonChangeTimer = undefined;
            if (
                this.previewOriginatedGuiJsonUri === uriStr &&
                Date.now() < this.previewOriginatedGuiJsonSkipUntil
            ) {
                return;
            }
            void this.pushGuiPreview(uri);
        }, 200);
    }

    isGuiPreviewActive(): boolean {
        return this.panel !== undefined && this.webviewReady;
    }

    reloadGuiPreviewBundle(): void {
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
        this.panel.webview.html = await buildGuiPreviewHtml(
            this.panel.webview,
            this.extensionUri,
            this.lastGameRootUri,
        );
    }

    private async onSelectionChanged(): Promise<void> {
        const focus = this.selection.focus;
        if (focus.kind !== 'gui') {
            if (this.panel && this.webviewReady) {
                void this.panel.webview.postMessage({ type: 'benne/guiPreview/clear' });
            }
            this.lastPushedGuiJsonUri = null;
            return;
        }

        this.ensurePanel();
        if (this.webviewReady) {
            const uriStr = focus.uri.toString();
            if (uriStr === this.lastPushedGuiJsonUri) {
                this.postSelectControl();
                return;
            }
            await this.pushGuiPreview(focus.uri);
        }
    }

    private ensurePanel(): void {
        if (this.panel) {
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'benneGuiPreview',
            'BENNE GUI preview',
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
            this.panel.webview.onDidReceiveMessage((m: { type?: string; guiJsonUri?: string; index?: unknown; patch?: unknown }) => {
                if (m?.type === 'benne/guiPreview/ready') {
                    this.webviewReady = true;
                    void this.pushGuiPreviewFromSelection();
                    return;
                }
                if (m?.type === 'benne/guiPreview/positionPatch') {
                    void this.handlePositionPatchFromWebview(m.guiJsonUri, m.index, m.patch);
                }
            }),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
                this.lastPushedGuiJsonUri = null;
            })
        );
    }

    private async pushGuiPreviewFromSelection(): Promise<void> {
        const focus = this.selection.focus;
        if (focus.kind !== 'gui') {
            return;
        }
        await this.pushGuiPreview(focus.uri);
    }

    private async pushGuiPreview(guiJsonUri?: vscode.Uri): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }

        const uri =
            guiJsonUri ??
            (this.selection.focus.kind === 'gui' ? this.selection.focus.uri : undefined);
        if (!uri) {
            webview.postMessage({ type: 'benne/guiPreview/clear' });
            this.lastPushedGuiJsonUri = null;
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
            const jsonText = await this.readGuiJsonAsUtf8(uri);
            const gui = JSON.parse(jsonText) as Record<string, unknown>;
            const guiId = getGuiIdFromGuiJsonUri(uri);
            const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
            const selectedControlKey = this.selectedControlKeyForUri(uri);
            webview.postMessage({
                type: 'benne/guiPreview/loadGui',
                gui,
                guiId,
                gameSrcWebviewUri,
                guiJsonUri: uri.toString(),
                selectedControlKey,
            });
            this.lastPushedGuiJsonUri = uri.toString();
        } catch (e) {
            void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    }

    private async readGuiJsonAsUtf8(uri: vscode.Uri): Promise<string> {
        const uriStr = uri.toString();
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
        if (open) {
            return open.getText();
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(raw).toString('utf8');
    }

    private selectedControlKeyForUri(uri: vscode.Uri): string {
        const gp = this.selection.guiPanel;
        if (gp.kind === 'control' && gp.guiJsonUri.toString() === uri.toString()) {
            return gp.controlKey;
        }
        return '';
    }

    private postSelectControl(): void {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }
        const uri = this.selection.focus.kind === 'gui' ? this.selection.focus.uri : undefined;
        webview.postMessage({
            type: 'benne/guiPreview/selectControl',
            controlKey: uri ? this.selectedControlKeyForUri(uri) : '',
        });
    }

    private async handlePositionPatchFromWebview(
        guiJsonUriStr: string | undefined,
        indexUnknown: unknown,
        patchUnknown: unknown
    ): Promise<void> {
        if (typeof guiJsonUriStr !== 'string' || guiJsonUriStr.length === 0) {
            return;
        }
        if (typeof indexUnknown !== 'number' || !Number.isInteger(indexUnknown) || indexUnknown < 0) {
            return;
        }
        if (!patchUnknown || typeof patchUnknown !== 'object' || Array.isArray(patchUnknown)) {
            return;
        }
        let uri: vscode.Uri;
        try {
            uri = vscode.Uri.parse(guiJsonUriStr);
        } catch {
            return;
        }
        const data = await loadRoomData(uri);
        if (!data) {
            return;
        }
        const result = updateGuiControlPatch(data, indexUnknown, patchUnknown as Record<string, unknown>);
        if (!result.ok) {
            return;
        }
        this.previewOriginatedGuiJsonUri = uri.toString();
        this.previewOriginatedGuiJsonSkipUntil = Date.now() + 1200;
        await writeDataJson(uri, data);
    }
}

function buildGuiPreviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
): Promise<string> {
    return resolvePreviewScriptUri(
        webview,
        extensionUri,
        gameRoot,
        'gui-preview',
        'gui-preview.js',
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
  <div id="benne-gui-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    });
}
