import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getPdcIdFromPdcJsonUri } from './gameDiscovery';

/**
 * Puzzle Dependency Chart editor (Cytoscape.js) in a {@link vscode.WebviewPanel}. Tooling only — not part of the shipped game.
 */
export class PdcEditorPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    private readonly disposables: vscode.Disposable[] = [];
    private pdcJsonChangeTimer: ReturnType<typeof setTimeout> | undefined;

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
        if (this.pdcJsonChangeTimer !== undefined) {
            clearTimeout(this.pdcJsonChangeTimer);
            this.pdcJsonChangeTimer = undefined;
        }
        this.panel?.dispose();
        this.panel = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
    }

    resetPreviewPanel(): void {
        if (this.pdcJsonChangeTimer !== undefined) {
            clearTimeout(this.pdcJsonChangeTimer);
            this.pdcJsonChangeTimer = undefined;
        }
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        p.dispose();
    }

    onWorkspacePdcJsonChanged(uri: vscode.Uri): void {
        if (!uri.fsPath.endsWith('.pdc.json')) {
            return;
        }
        if (!this.panel || !this.webviewReady) {
            return;
        }
        const focus = this.selection.focus;
        if (focus.kind !== 'pdc') {
            return;
        }
        if (focus.uri.toString() !== uri.toString()) {
            return;
        }
        if (this.pdcJsonChangeTimer !== undefined) {
            clearTimeout(this.pdcJsonChangeTimer);
        }
        this.pdcJsonChangeTimer = setTimeout(() => {
            this.pdcJsonChangeTimer = undefined;
            void this.pushPdcDocument(uri);
        }, 200);
    }

    isPdcEditorActive(): boolean {
        return this.panel !== undefined && this.webviewReady;
    }

    private async onSelectionChanged(): Promise<void> {
        const focus = this.selection.focus;
        if (focus.kind !== 'pdc') {
            if (this.panel && this.webviewReady) {
                void this.panel.webview.postMessage({ type: 'benne/pdcEditor/clear' });
            }
            return;
        }

        this.ensurePanel();
        if (this.webviewReady) {
            await this.pushPdcDocument(focus.uri);
        }
    }

    private ensurePanel(): void {
        if (this.panel) {
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'bennePdcEditor',
            'BENNE — Puzzle chart',
            { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = buildPdcEditorHtml(this.panel.webview, this.extensionUri);

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage(
                (m: { type?: string; documentUri?: string; json?: string }) => {
                    void this.onWebviewMessage(m);
                }
            ),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
            })
        );
    }

    private async onWebviewMessage(m: { type?: string; documentUri?: string; json?: string }): Promise<void> {
        if (m?.type === 'benne/pdcEditor/ready') {
            this.webviewReady = true;
            const focus = this.selection.focus;
            if (focus.kind === 'pdc') {
                await this.pushPdcDocument(focus.uri);
            }
            return;
        }

        if (m?.type !== 'benne/pdcEditor/save' || typeof m.documentUri !== 'string' || typeof m.json !== 'string') {
            return;
        }

        const uri = vscode.Uri.parse(m.documentUri);
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            return;
        }

        try {
            const enc = new TextEncoder().encode(m.json.endsWith('\n') ? m.json : `${m.json}\n`);
            await vscode.workspace.fs.writeFile(uri, enc);
        } catch (e) {
            void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    }

    private async readPdcJson(uri: vscode.Uri): Promise<string> {
        const uriStr = uri.toString();
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
        if (open) {
            return open.getText();
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(raw).toString('utf8');
    }

    private async pushPdcDocument(pdcJsonUri?: vscode.Uri): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }

        const uri =
            pdcJsonUri ?? (this.selection.focus.kind === 'pdc' ? this.selection.focus.uri : undefined);
        if (!uri) {
            webview.postMessage({ type: 'benne/pdcEditor/clear' });
            return;
        }

        const id = getPdcIdFromPdcJsonUri(uri);
        try {
            const text = await this.readPdcJson(uri);
            let data: Record<string, unknown>;
            try {
                data = JSON.parse(text) as Record<string, unknown>;
            } catch {
                data = { id, name: id, elements: [] };
            }
            if (typeof data.id !== 'string' || !data.id.trim()) {
                data.id = id;
            }
            if (typeof data.name !== 'string' || !data.name.trim()) {
                data.name = id;
            }
            if (!('elements' in data)) {
                data.elements = [];
            }

            if (this.panel) {
                const titleName = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : id;
                this.panel.title = `Puzzle chart — ${titleName}`;
            }

            webview.postMessage({
                type: 'benne/pdcEditor/load',
                documentUri: uri.toString(),
                payload: data
            });
        } catch (e) {
            void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    }
}

function buildPdcEditorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'pdc-editor', 'pdc-editor.js'));
    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `font-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: 12px;
    }
    body { margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    #pdc-toolbar {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    #pdc-toolbar button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    #pdc-toolbar button:hover { background: var(--vscode-button-hoverBackground); }
    #pdc-toolbar button.active {
      outline: 1px solid var(--vscode-focusBorder);
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
    }
    #pdc-status { flex: 1; min-width: 120px; opacity: 0.85; padding-left: 8px; }
    #pdc-cy-wrapper { position: relative; flex: 1; min-height: 0; overflow: hidden; }
    #pdc-cy { position: absolute; inset: 0; background: var(--vscode-sideBar-background); }
    #pdc-selection-box {
      position: absolute;
      border: 1px dashed var(--vscode-focusBorder);
      background: rgba(100, 150, 255, 0.12);
      pointer-events: none;
      display: none;
      z-index: 10;
    }
    #pdc-inline-input {
      position: absolute;
      z-index: 20;
      box-sizing: border-box;
      text-align: center;
      padding: 4px 6px;
      border: 1px solid var(--vscode-focusBorder);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 28px;
      font-family: inherit;
      outline: none;
      display: none;
      resize: none;
      overflow: hidden;
      line-height: 1.3;
    }
    .pdc-resize-handle {
      position: absolute;
      z-index: 15;
      background: var(--vscode-focusBorder);
      border: 1px solid var(--vscode-editor-background);
      border-radius: 1px;
      display: none;
    }
  </style>
</head>
<body>
  <div id="pdc-toolbar">
    <button type="button" id="pdc-add-node">Add node</button>
    <button type="button" id="pdc-link">Link nodes</button>
    <button type="button" id="pdc-edit-label">Edit label</button>
    <button type="button" id="pdc-delete">Delete selected</button>
    <button type="button" id="pdc-fit">Fit</button>
    <span id="pdc-status"></span>
  </div>
  <div id="pdc-cy-wrapper">
    <div id="pdc-cy"></div>
    <div id="pdc-selection-box"></div>
    <textarea id="pdc-inline-input" autocomplete="off" spellcheck="false" rows="1"></textarea>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
