import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getCharacterIdFromCharacterJsonUri } from './gameDiscovery';
import { applyCharacterFeetPatch, type CharacterFeetPayload } from './characterFeetPatch';

/**
 * Phaser character preview (feet placement) in a {@link vscode.WebviewPanel}.
 */
export class CharacterPreviewPanelController implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private webviewReady = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly selection: EditorSelection,
  ) {
    this.disposables.push(
      this.selection.onDidChange(() => {
        void this.onSelectionChanged();
      }),
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

  isCharacterPreviewActive(): boolean {
    return this.panel !== undefined && this.webviewReady;
  }

  reloadCharacterPreviewBundle(): void {
    if (!this.panel) {
      return;
    }
    this.webviewReady = false;
    this.panel.webview.html = buildCharacterPreviewHtml(this.panel.webview, this.extensionUri);
  }

  private async onSelectionChanged(): Promise<void> {
    const focus = this.selection.focus;
    if (focus.kind !== 'character') {
      if (this.panel && this.webviewReady) {
        void this.panel.webview.postMessage({ type: 'benne/charPreview/clear' });
      }
      return;
    }

    this.ensurePanel();
    if (this.webviewReady) {
      await this.pushCharacterPreview(focus.uri);
    }
  }

  private ensurePanel(): void {
    if (this.panel) {
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'benneCharacterPreview',
      'BENNE Character preview',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          this.extensionUri,
          ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
        ],
      },
    );

    this.panel.webview.html = buildCharacterPreviewHtml(this.panel.webview, this.extensionUri);

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(
        (m: {
          type?: string;
          characterJsonUri?: string;
          feet?: CharacterFeetPayload;
        }) => {
          if (m?.type === 'benne/charPreview/ready') {
            this.webviewReady = true;
            void this.pushCharacterPreviewFromSelection();
            return;
          }
          if (m?.type === 'benne/charPreview/requestRefresh') {
            const u =
              typeof m.characterJsonUri === 'string' && m.characterJsonUri.length > 0
                ? vscode.Uri.parse(m.characterJsonUri)
                : undefined;
            void this.pushCharacterPreview(u);
            return;
          }
          if (m?.type === 'benne/charPreview/saveFeet') {
            void this.handleSaveFeet(m.characterJsonUri, m.feet);
          }
        },
      ),
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.webviewReady = false;
      }),
    );
  }

  private async pushCharacterPreviewFromSelection(): Promise<void> {
    const focus = this.selection.focus;
    if (focus.kind !== 'character') {
      return;
    }
    await this.pushCharacterPreview(focus.uri);
  }

  private async pushCharacterPreview(characterJsonUri?: vscode.Uri): Promise<void> {
    const webview = this.panel?.webview;
    if (!webview) {
      return;
    }

    const uri = characterJsonUri ?? (this.selection.focus.kind === 'character' ? this.selection.focus.uri : undefined);
    if (!uri) {
      webview.postMessage({ type: 'benne/charPreview/clear' });
      return;
    }

    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return;
    }

    const gameSrc = vscode.Uri.joinPath(folder.uri, 'src', 'game');
    try {
      await vscode.workspace.fs.stat(gameSrc);
    } catch {
      return;
    }

    try {
      const jsonText = await this.readCharacterJsonAsUtf8(uri);
      const character = JSON.parse(jsonText) as Record<string, unknown>;
      const characterId = getCharacterIdFromCharacterJsonUri(uri);
      const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
      webview.postMessage({
        type: 'benne/charPreview/loadCharacter',
        character,
        characterId,
        gameSrcWebviewUri,
        characterJsonUri: uri.toString(),
      });
    } catch (e) {
      void vscode.window.showErrorMessage(
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  private async handleSaveFeet(
    characterJsonUriStr: string | undefined,
    feet: CharacterFeetPayload | undefined,
  ): Promise<void> {
    const webview = this.panel?.webview;
    if (!webview || typeof characterJsonUriStr !== 'string' || !feet) {
      return;
    }
    if (
      typeof feet.x !== 'number' ||
      typeof feet.y !== 'number' ||
      !Number.isFinite(feet.x) ||
      !Number.isFinite(feet.y)
    ) {
      webview.postMessage({
        type: 'benne/charPreview/feetSaveResult',
        ok: false,
        message: 'Invalid feet coordinates.',
      });
      return;
    }
    let uri: vscode.Uri;
    try {
      uri = vscode.Uri.parse(characterJsonUriStr);
    } catch {
      webview.postMessage({
        type: 'benne/charPreview/feetSaveResult',
        ok: false,
        message: 'Invalid character JSON URI.',
      });
      return;
    }
    try {
      const applied = await applyCharacterFeetPatch(uri, feet);
      void vscode.window.showInformationMessage(
        `Saved character feet to JSON (${applied.x}, ${applied.y}).`,
      );
      webview.postMessage({
        type: 'benne/charPreview/feetSaveResult',
        ok: true,
        appliedFeet: applied,
      });
    } catch (e) {
      webview.postMessage({
        type: 'benne/charPreview/feetSaveResult',
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async readCharacterJsonAsUtf8(uri: vscode.Uri): Promise<string> {
    const uriStr = uri.toString();
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
    if (open) {
      return open.getText();
    }
    const raw = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(raw).toString('utf8');
  }
}

function buildCharacterPreviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'character-preview', 'character-preview.js'),
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
  <div id="benne-char-preview-topbar" style="flex-shrink:0;"></div>
  <div id="benne-char-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
