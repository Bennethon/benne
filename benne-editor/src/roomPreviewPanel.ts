import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    applyRoomPolygonPatch,
    parseRoomPolygonPatch,
    type RoomPolygonPatch,
} from './roomPolygonPatch';

/**
 * Phaser room preview in a {@link vscode.WebviewPanel} (editor area), driven by BENNE tree selection.
 */
export class RoomPreviewPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    /** Last room JSON URI successfully sent with `loadRoom`; used to skip redundant reloads when only the prop selection changes. */
    private lastPushedRoomJsonUri: string | null = null;
    /** Dedupes `toolbarUi` posts when focus is already reflected in the webview. */
    private lastToolbarUiKey: string | null = null;
    private readonly disposables: vscode.Disposable[] = [];
    /** Serializes preview loads so rapid saves do not post overlapping `loadRoom` messages. */
    private previewPushTail: Promise<void> = Promise.resolve();
    /** Serializes `onSelectionChanged` so overlapping runs cannot post `clear` after a refresh `loadRoom`. */
    private selectionReactionChain: Promise<void> = Promise.resolve();
    /** Delayed `clear` when leaving room preview — avoids wiping the canvas on transient selection glitches. */
    private clearPreviewDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly selection: EditorSelection
    ) {
        this.disposables.push(
            this.selection.onDidChange(() => {
                this.selectionReactionChain = this.selectionReactionChain
                    .then(() => this.onSelectionChanged())
                    .catch(() => undefined);
            })
        );
    }

    dispose(): void {
        if (this.clearPreviewDebounceTimer !== undefined) {
            clearTimeout(this.clearPreviewDebounceTimer);
            this.clearPreviewDebounceTimer = undefined;
        }
        this.panel?.dispose();
        this.panel = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
    }

    /** Close the Phaser preview webview before resetting the editor area for a new tree selection. */
    resetPreviewPanel(): void {
        if (this.clearPreviewDebounceTimer !== undefined) {
            clearTimeout(this.clearPreviewDebounceTimer);
            this.clearPreviewDebounceTimer = undefined;
        }
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        this.lastPushedRoomJsonUri = null;
        this.lastToolbarUiKey = null;
        p.dispose();
    }

    /** True when the room preview webview exists and has completed its initial `ready` handshake. */
    isRoomPreviewActive(): boolean {
        return this.panel !== undefined && this.webviewReady;
    }

    private readonly clearPreviewDebounceMs = 180;

    private async onSelectionChanged(): Promise<void> {
        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;

        const wantRoomPreview =
            roomPanel.kind === 'prop' || focus.kind === 'room';

        if (!wantRoomPreview) {
            if (this.clearPreviewDebounceTimer !== undefined) {
                clearTimeout(this.clearPreviewDebounceTimer);
            }
            this.clearPreviewDebounceTimer = setTimeout(() => {
                this.clearPreviewDebounceTimer = undefined;
                const f = this.selection.focus;
                const rp = this.selection.roomPanel;
                if (rp.kind === 'prop' || f.kind === 'room') {
                    return;
                }
                if (this.panel && this.webviewReady) {
                    void this.panel.webview.postMessage({ type: 'benne/preview/clear' });
                }
                this.lastPushedRoomJsonUri = null;
                this.lastToolbarUiKey = null;
            }, this.clearPreviewDebounceMs);
            return;
        }

        if (this.clearPreviewDebounceTimer !== undefined) {
            clearTimeout(this.clearPreviewDebounceTimer);
            this.clearPreviewDebounceTimer = undefined;
        }

        const createdNew = this.ensurePanel();
        const roomOnly = focus.kind === 'room' && roomPanel.kind === 'none';
        if (this.panel && roomOnly) {
            this.panel.reveal(vscode.ViewColumn.One, true);
        }
        if (createdNew) {
            this.webviewReady = false;
        } else if (this.webviewReady) {
            const nextUri = this.previewRoomJsonUriForSelection();
            const nextStr = nextUri?.toString() ?? '';
            if (nextStr && nextStr === this.lastPushedRoomJsonUri) {
                this.postToolbarUiIfNeeded();
                return;
            }
            await this.pushPreview();
        }
    }

    private getPreviewToolbarState(): { focus: 'room' | 'prop'; propId: string } {
        const roomPanel = this.selection.roomPanel;
        if (roomPanel.kind === 'prop') {
            return { focus: 'prop', propId: roomPanel.prop.id };
        }
        return { focus: 'room', propId: '' };
    }

    private postToolbarUiIfNeeded(): void {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }
        const ui = this.getPreviewToolbarState();
        const key = `${ui.focus}:${ui.propId}`;
        if (this.lastToolbarUiKey === key) {
            return;
        }
        this.lastToolbarUiKey = key;
        webview.postMessage({
            type: 'benne/preview/toolbarUi',
            previewFocus: ui.focus,
            ...(ui.focus === 'prop' ? { propColliderId: ui.propId } : {}),
        });
    }

    private previewRoomJsonUriForSelection(): vscode.Uri | undefined {
        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;
        if (roomPanel.kind === 'prop') {
            return roomPanel.roomJsonUri;
        }
        if (focus.kind === 'room') {
            return focus.uri;
        }
        return undefined;
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
            this.panel.webview.onDidReceiveMessage(
                (m: { type?: string; roomJsonUri?: string; patch?: unknown }) => {
                if (m?.type === 'benne/preview/ready') {
                    this.webviewReady = true;
                    void this.pushPreview();
                    return;
                }
                if (m?.type === 'benne/preview/requestRefresh') {
                    const explicit =
                        typeof m.roomJsonUri === 'string' && m.roomJsonUri.length > 0
                            ? m.roomJsonUri
                            : undefined;
                    void this.pushPreview({ fromRefreshRequest: true, explicitRoomJsonUri: explicit });
                    return;
                }
                if (m?.type === 'benne/preview/polygonPatch') {
                    void this.handlePolygonPatchFromWebview(m.roomJsonUri, m.patch);
                }
            }),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
                this.lastPushedRoomJsonUri = null;
                this.lastToolbarUiKey = null;
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
        let appliedPatch: RoomPolygonPatch;
        try {
            appliedPatch = await applyRoomPolygonPatch(uri, patch);
        } catch (e) {
            webview.postMessage({
                type: 'benne/preview/polygonPatchResult',
                ok: false,
                message: e instanceof Error ? e.message : String(e),
            });
            return;
        }
        // Do not pushPreview here: full destroy/recreate is brittle in the webview and unnecessary —
        // the preview already mutates live RoomData; appliedPatch syncs integer-rounded coordinates.
        webview.postMessage({
            type: 'benne/preview/polygonPatchResult',
            ok: true,
            appliedPatch,
        });
    }

    private pushPreview(opts?: { fromRefreshRequest?: boolean; explicitRoomJsonUri?: string }): Promise<void> {
        const started = this.previewPushTail.then(() => this.doPushPreview(opts));
        this.previewPushTail = started.catch(() => undefined);
        return started;
    }

    private async doPushPreview(opts?: { fromRefreshRequest?: boolean; explicitRoomJsonUri?: string }): Promise<void> {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }

        let roomJsonUri: vscode.Uri | undefined;
        if (opts?.explicitRoomJsonUri) {
            try {
                roomJsonUri = vscode.Uri.parse(opts.explicitRoomJsonUri);
            } catch {
                roomJsonUri = undefined;
            }
        }
        if (!roomJsonUri) {
            roomJsonUri = this.previewRoomJsonUriForSelection();
        }
        if (!roomJsonUri) {
            if (opts?.fromRefreshRequest) {
                webview.postMessage({
                    type: 'benne/preview/error',
                    message: 'No room context for preview — select a room or prop in the BENNE tree.',
                });
            } else {
                webview.postMessage({ type: 'benne/preview/clear' });
            }
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
            const jsonText = await this.readRoomJsonAsUtf8(roomJsonUri);
            const room = JSON.parse(jsonText) as Record<string, unknown>;
            const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
            const uriStr = roomJsonUri.toString();
            const tb = this.getPreviewToolbarState();
            this.lastToolbarUiKey = `${tb.focus}:${tb.propId}`;
            webview.postMessage({
                type: 'benne/preview/loadRoom',
                room,
                gameSrcWebviewUri,
                roomJsonUri: uriStr,
                previewFocus: tb.focus,
                ...(tb.focus === 'prop' ? { propColliderId: tb.propId } : {}),
            });
            this.lastPushedRoomJsonUri = uriStr;
        } catch (e) {
            webview.postMessage({
                type: 'benne/preview/error',
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }

    /** Prefer in-memory buffer when the room JSON is open in an editor (matches unsaved edits on Refresh). */
    private async readRoomJsonAsUtf8(uri: vscode.Uri): Promise<string> {
        const uriStr = uri.toString();
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
        if (open) {
            return open.getText();
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(raw).toString('utf8');
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
  <div id="benne-preview-topbar" style="display:flex;align-items:flex-start;gap:10px;flex-shrink:0;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
    <div id="benne-polygon-toolbar" style="flex:1;min-width:0;"></div>
    <button type="button" id="benne-refresh-preview" title="Reload room JSON from disk" style="flex-shrink:0;margin-top:1px;background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Refresh</button>
  </div>
  <div id="benne-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
