import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { buildInspectorState, type InspectorStatePayload } from './inspectorStateBuilder';
import {
    addWalkableHole,
    addWalkablePolygon,
    applyFitBackground,
    updateCharacterAnimationFields,
    updateCharacterFields,
    updateGuiControlPayload,
    updateGuiFields,
    updateInventoryAnimationFields,
    updateInventoryFields,
    applyRoomDisplayName,
    applyRoomSize,
    applyScrollBounds,
    clearRoomSize,
    clearScrollBounds,
    deleteHotspot,
    deletePoint,
    deleteProp,
    deleteRegion,
    deleteRoomCharacter,
    deleteWalkableHole,
    deleteWalkablePolygon,
    loadRoomData,
    setWalkableRowActive,
    updateHotspotFields,
    updatePointFields,
    updatePropAnimationFields,
    updatePropFields,
    updateRegionActive,
    updateRoomCharacterFields,
    writeDataJson,
    writeRoomJson
} from './inspectorMutations';
import { getRoomIdFromRoomJsonUri } from './gameDiscovery';
import type { RoomPreviewPanelController } from './roomPreviewPanel';
import {
    mainTreeRoomNodeFromRoomJson,
    runAddRoomHotspotWizard,
    runAddRoomPointWizard,
    runAddRoomPropWizard,
    runAddRoomRegionWizard,
    runAddRoomSpawnedCharacterWizard
} from './roomScaffolding';

function resolveInspectorJsonUri(selection: EditorSelection): vscode.Uri | undefined {
    const focus = selection.focus;
    const rp = selection.roomPanel;
    if (focus.kind === 'room') {
        return focus.uri;
    }
    if (focus.kind === 'character' || focus.kind === 'gui' || focus.kind === 'inventory') {
        return focus.uri;
    }
    if (
        rp.kind === 'prop' ||
        rp.kind === 'hotspot' ||
        rp.kind === 'roomCharacter' ||
        rp.kind === 'roomPoint' ||
        rp.kind === 'region'
    ) {
        return rp.roomJsonUri;
    }
    return undefined;
}

function buildInspectorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'inspector', 'inspector.js'));
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
      background: var(--vscode-sideBar-background);
      font-size: 12px;
      --benne-inspector-border: color-mix(in srgb, var(--vscode-panel-border) 72%, var(--vscode-widget-border, var(--vscode-panel-border)));
      --benne-inspector-surface: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-sideBar-background));
      --benne-inspector-well: color-mix(in srgb, var(--vscode-sideBar-background) 40%, var(--vscode-editor-background));
    }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: var(--vscode-font-family); }
    #benne-inspector-app { min-height: 100vh; display: flex; flex-direction: column; }
    .inspector-root { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .scroll { flex: 1; overflow: auto; padding: 8px 10px 72px; background: var(--vscode-sideBar-background); }

    input[type="text"],
    input[type="number"],
    textarea,
    select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-input-border) 55%, var(--benne-inspector-border));
      border-radius: 2px;
      padding: 4px 6px;
      font-family: inherit;
      font-size: inherit;
    }
    input::placeholder,
    textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    input[type="text"]:focus,
    input[type="number"]:focus,
    textarea:focus,
    select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: 1px solid transparent;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: inherit;
      font-family: inherit;
    }
    .btn-primary:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      padding: 5px 10px;
      border-radius: 2px;
      cursor: pointer;
      font-size: inherit;
      font-family: inherit;
    }
    .btn-secondary:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .btn-secondary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .btn-link {
      background: transparent;
      color: var(--vscode-textLink-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: inherit;
      font-family: inherit;
      text-decoration: none;
    }
    .btn-link:hover { text-decoration: underline; }
    .btn-danger {
      background: transparent;
      color: var(--vscode-errorForeground);
      border: 1px solid var(--vscode-input-border);
      padding: 5px 10px;
      border-radius: 2px;
      cursor: pointer;
      font-size: inherit;
      font-family: inherit;
    }
    .btn-danger:hover {
      border-color: var(--vscode-errorForeground);
      background: color-mix(in srgb, var(--vscode-errorForeground) 12%, transparent);
    }
    .btn-danger:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .footer {
      position: sticky;
      bottom: 0;
      display: flex;
      gap: 8px;
      padding: 8px 10px;
      border-top: 1px solid var(--benne-inspector-border);
      background: color-mix(in srgb, var(--vscode-sideBar-background) 94%, var(--vscode-editor-background));
      box-shadow: 0 -4px 12px color-mix(in srgb, var(--vscode-widget-shadow) 55%, transparent);
    }

    .section {
      border: 1px solid var(--benne-inspector-border);
      border-radius: 6px;
      margin-bottom: 10px;
      background: var(--benne-inspector-surface);
      box-shadow: 0 1px 0 color-mix(in srgb, var(--vscode-widget-shadow) 35%, transparent), 0 2px 8px color-mix(in srgb, var(--vscode-widget-shadow) 25%, transparent);
    }
    .section > summary {
      padding: 8px 10px;
      cursor: pointer;
      font-weight: 600;
      list-style: none;
      background: var(--vscode-sideBarSectionHeader-background, color-mix(in srgb, var(--vscode-sideBar-background) 55%, var(--vscode-editor-background)));
      border-radius: 6px 6px 0 0;
      border-bottom: 1px solid var(--benne-inspector-border);
    }
    .section:not([open]) > summary {
      border-bottom: none;
      border-radius: 6px;
    }
    .section > summary::-webkit-details-marker { display: none; }
    .section-body {
      padding: 10px 12px 12px;
      border-top: 1px solid var(--benne-inspector-border);
      background: var(--benne-inspector-well);
    }

    .block { display: block; margin-bottom: 8px; }
    .block input, .block textarea { width: 100%; margin-top: 4px; }
    .row { margin: 6px 0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    /* Property grid: label column (right-aligned) + control column */
    .benne-prop-grid {
      display: grid;
      grid-template-columns: minmax(6.75rem, 34%) 1fr;
      column-gap: 10px;
      row-gap: 8px;
      align-items: center;
      margin-bottom: 10px;
    }
    .benne-prop-grid--tight { margin-bottom: 8px; }
    .benne-pg-lbl {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      padding-right: 2px;
      line-height: 1.3;
    }
    .benne-pg-val {
      min-width: 0;
      display: flex;
      align-items: center;
      min-height: 22px;
    }
    .benne-pg-val input,
    .benne-pg-val select,
    .benne-pg-val textarea {
      width: 100%;
    }
    .benne-prop-grid > input[type="text"],
    .benne-prop-grid > input[type="number"] {
      width: 100%;
      min-width: 0;
    }
    .benne-pg-check {
      justify-self: start;
      display: flex;
      align-items: center;
    }
    .benne-pg-check input { cursor: pointer; }

    /* Grouped dimension grid: X | x | Y | y / W | w | H | h */
    .benne-dim-grid {
      display: grid;
      grid-template-columns: auto 1fr auto 1fr;
      column-gap: 8px;
      row-gap: 6px;
      align-items: center;
      margin-bottom: 8px;
    }
    .benne-dim-lbl {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      min-width: 1.1rem;
      padding-right: 2px;
    }
    .benne-dim-grid input { width: 100%; min-width: 0; }

    .benne-scroll-bounds-label { margin-top: 12px; margin-bottom: 6px; }
    .benne-room-size-hint {
      font-size: 11px;
      margin-bottom: 4px;
      margin-top: 2px;
    }
    .wrap { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .muted { color: var(--vscode-descriptionForeground); }
    .small { font-size: 11px; }
    .badge {
      padding: 2px 6px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
    }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th, table.grid td {
      border: 1px solid var(--benne-inspector-border);
      padding: 4px 6px;
      text-align: left;
    }
    table.grid thead th {
      background: color-mix(in srgb, var(--vscode-sideBarSectionHeader-background, var(--vscode-sideBar-background)) 65%, var(--vscode-editor-background));
      font-weight: 600;
    }

    .benne-section-add-row {
      margin-bottom: 10px;
    }
    .benne-section-add-row .btn-secondary {
      width: 100%;
    }

    .benne-card-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 2px 0;
    }

    .benne-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--benne-inspector-border);
      border-radius: 5px;
      padding: 0;
      box-shadow: 0 1px 0 color-mix(in srgb, var(--vscode-widget-shadow) 40%, transparent);
      transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }
    .benne-card:hover {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 55%, var(--benne-inspector-border));
      box-shadow: 0 2px 10px color-mix(in srgb, var(--vscode-widget-shadow) 45%, transparent);
    }

    /* Collapsible entity rows (Hotspots, Props, …) */
    details.benne-inspector-item.benne-card { overflow: hidden; }
    .benne-inspector-item > .benne-inspector-item-summary {
      list-style: none;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px 10px 10px;
      margin: 0;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid transparent;
    }
    .benne-inspector-item > .benne-inspector-item-summary::-webkit-details-marker { display: none; }
    .benne-inspector-item > .benne-inspector-item-summary::before {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 6px solid color-mix(in srgb, var(--vscode-foreground) 72%, var(--vscode-descriptionForeground));
      margin-top: 5px;
      flex-shrink: 0;
      transform: rotate(0deg);
      transition: transform 0.14s ease;
    }
    .benne-inspector-item[open] > .benne-inspector-item-summary::before {
      transform: rotate(90deg);
    }
    .benne-inspector-item[open] > .benne-inspector-item-summary {
      border-bottom-color: var(--benne-inspector-border);
      background: color-mix(in srgb, var(--vscode-sideBarSectionHeader-background, var(--vscode-sideBar-background)) 35%, var(--vscode-editor-background));
    }
    .benne-inspector-item > .benne-inspector-item-summary:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .benne-inspector-item-body {
      padding: 12px 14px 14px;
    }

    .benne-card.benne-card--prop-clickable {
      border-left: 3px solid var(--vscode-textLink-foreground);
      background: color-mix(
        in srgb,
        var(--vscode-textLink-foreground) 16%,
        var(--vscode-editor-background)
      );
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent);
    }
    .benne-card.benne-card--prop-clickable:hover {
      background: color-mix(
        in srgb,
        var(--vscode-textLink-foreground) 22%,
        var(--vscode-editor-background)
      );
      border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 35%, var(--benne-inspector-border));
    }
    .benne-card.benne-card--prop-clickable > .benne-inspector-item-summary {
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 8%, var(--vscode-editor-background));
    }
    .benne-card.benne-card--prop-clickable[open] > .benne-inspector-item-summary {
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 12%, var(--vscode-editor-background));
    }

    .benne-card-titles { flex: 1 1 120px; min-width: 0; }
    .benne-card-title { font-weight: 600; line-height: 1.25; word-break: break-word; }
    .benne-card-sub { font-size: 11px; margin-top: 2px; }
    .benne-inline-check {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    .benne-inline-check input { cursor: pointer; }

    .benne-field-label { display: block; margin-bottom: 4px; }

    .benne-verb-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .verb-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 12px;
      padding: 6px 12px 6px 10px;
      font-size: 12px;
      line-height: 1.45;
      cursor: pointer;
      font-family: inherit;
      border: 1px solid var(--benne-inspector-border);
      transition: border-color 0.1s ease, background 0.1s ease, color 0.1s ease;
    }
    .verb-chip:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .verb-chip-glyph { margin-right: 0; font-size: 14px; line-height: 1; }
    .verb-chip-txt { font-weight: 600; letter-spacing: 0.01em; }
    .verb-defined {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-border, var(--vscode-contrastBorder, var(--vscode-panel-border)));
    }
    .verb-defined:hover {
      border-color: var(--vscode-focusBorder);
    }
    .verb-add {
      background: var(--vscode-input-background);
      color: var(--vscode-editor-foreground);
      border-style: dashed;
      opacity: 0.92;
    }
    .verb-add:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-editor-foreground);
      opacity: 1;
    }

    .benne-card-desc {
      width: 100%;
      resize: vertical;
      min-height: 2.6em;
      max-height: 4.8em;
      margin-bottom: 10px;
      line-height: 1.35;
      overflow: auto;
    }

    .benne-card-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--benne-inspector-border);
    }
    .benne-card-actions-inner { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .benne-card-actions--end { justify-content: flex-end; }

    .banner {
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
      padding: 6px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 11px;
      border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
    }

    .empty { padding: 12px; color: var(--vscode-descriptionForeground); }
    .tag { font-weight: 600; }

    /* Nested expander inside prop / hotspot cards */
    .benne-card-subsection {
      margin-top: 10px;
      border: 1px solid var(--benne-inspector-border);
      border-radius: 4px;
      background: color-mix(in srgb, var(--vscode-editor-background) 35%, var(--benne-inspector-well));
    }
    .benne-card-subsection > summary {
      padding: 6px 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      list-style: none;
      color: var(--vscode-descriptionForeground);
    }
    .benne-card-subsection > summary::-webkit-details-marker { display: none; }
    .benne-card-subsection-body {
      padding: 0 8px 8px;
      border-top: 1px solid color-mix(in srgb, var(--benne-inspector-border) 70%, transparent);
    }
  </style>
</head>
<body>
  <div id="benne-inspector-app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

type WebviewPatch =
    | {
          type: 'roomMeta';
          displayName: string;
          size: { width: number; height: number } | null;
          scrollBounds: { x: number; y: number; width: number; height: number } | null;
      }
    | { type: 'clearScrollBounds' }
    | {
          type: 'walkableActive';
          kind?: string;
          polygonId?: string;
          holeId?: string;
          rowId?: string;
          active?: boolean;
      }
    | { type: 'addWalkablePolygon' }
    | { type: 'addWalkableHole'; polygonId: string }
    | {
          type: 'propField';
          id?: string;
          description?: string;
          visible?: boolean;
          clickable?: boolean;
          zIndex?: number;
          parallaxDepth?: number;
          alpha?: number;
          tag?: string;
          defaultAnimation?: string;
      }
    | {
          type: 'propAnimation';
          propId?: string;
          animationTag?: string;
          /** @deprecated use propId + animationTag */
          id?: string;
          loop?: boolean;
          frameDuration?: number | null;
      }
    | { type: 'hotspotField'; id?: string; description?: string; active?: boolean; zIndex?: number }
    | {
          type: 'characterField';
          instanceId?: string;
          x?: number;
          y?: number;
          visible?: boolean;
          zIndex?: number;
          initialFacing?: string;
          initialAnimation?: string;
      }
    | { type: 'pointField'; id?: string; x?: number; y?: number }
    | { type: 'regionActive'; id?: string; active?: boolean }
    | {
          type: 'characterMeta';
          name?: string;
          walkSpeed?: number;
          clickable?: boolean;
          description?: string;
          walkToPoint?: { x: number; y: number } | null;
          talkPoint?: { x: number; y: number } | null;
          feet?: { x: number; y: number } | null;
      }
    | { type: 'characterAnimation'; id?: string; loop?: boolean; frameDuration?: number | null }
    | { type: 'guiMeta'; name?: string; description?: string }
    | { type: 'guiControlPayload'; index?: number; payload?: string }
    | {
          type: 'inventoryMeta';
          name?: string;
          description?: string;
          stackable?: boolean;
          defaultAnimation?: string;
          asepriteMode?: true | 'shared';
      }
    | { type: 'inventoryAnimation'; id?: string; loop?: boolean; frameDuration?: number | null }
    | { type: 'delete'; entity?: string; id?: string };

export class InspectorWebviewViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    private rev = 0;
    private resolveDisposable: vscode.Disposable | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly selection: EditorSelection,
        private readonly roomPreview: RoomPreviewPanelController,
        private readonly refreshMainAndActions: () => void
    ) {}

    dispose(): void {
        this.resolveDisposable?.dispose();
        this.resolveDisposable = undefined;
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.resolveDisposable?.dispose();
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri, ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? [])]
        };
        webviewView.webview.html = buildInspectorHtml(webviewView.webview, this.extensionUri);

        this.resolveDisposable = vscode.Disposable.from(
            webviewView.webview.onDidReceiveMessage((msg: { action?: string } & Record<string, unknown>) => {
                void this.handleWebviewMessage(msg);
            }),
            this.selection.onDidChange(() => {
                void this.pushState();
            }),
            vscode.workspace.onDidChangeTextDocument((e) => {
                const uri = resolveInspectorJsonUri(this.selection);
                if (uri && e.document.uri.toString() === uri.toString()) {
                    void this.pushState();
                }
            }),
            vscode.workspace.onDidSaveTextDocument((doc) => {
                const uri = resolveInspectorJsonUri(this.selection);
                if (uri && doc.uri.toString() === uri.toString()) {
                    if (this.selection.focus.kind === 'room') {
                        this.roomPreview.onWorkspaceRoomJsonChanged(doc.uri);
                    }
                    void this.pushState();
                }
            }),
            webviewView.onDidDispose(() => {
                this.view = undefined;
            })
        );

        void this.pushState();
    }

    private postState(state: InspectorStatePayload): void {
        void this.view?.webview.postMessage({ type: 'benne/inspector/state', state });
    }

    /** Public so `extension.ts` can refresh the Inspector after tree/workspace updates. */
    async pushState(): Promise<void> {
        const uri = resolveInspectorJsonUri(this.selection);
        if (!uri) {
            this.postState({
                kind: 'empty',
                message: 'Select a room, character, GUI, or inventory item in the BENNE tree to edit data.'
            });
            return;
        }
        const state = await buildInspectorState(uri, this.selection.focus, this.selection.roomPanel, ++this.rev);
        this.postState(state);
    }

    private async handleWebviewMessage(msg: { action?: string } & Record<string, unknown>): Promise<void> {
        const uri = resolveInspectorJsonUri(this.selection);
        if (!uri || msg.action === undefined) {
            return;
        }
        const focusKind = this.selection.focus.kind;
        const roomId = getRoomIdFromRoomJsonUri(uri);

        if (msg.action === 'openRawJson') {
            await vscode.window.showTextDocument(uri, { preview: false });
            return;
        }

        if (msg.action === 'addRoomItem') {
            if (focusKind !== 'room') {
                return;
            }
            const kind = typeof msg.kind === 'string' ? msg.kind : '';
            const node = await mainTreeRoomNodeFromRoomJson(uri, roomId);
            if (!node) {
                void vscode.window.showErrorMessage('Could not resolve this room for adding content.');
                return;
            }
            switch (kind) {
                case 'hotspot':
                    await runAddRoomHotspotWizard(this.selection, node);
                    break;
                case 'prop':
                    await runAddRoomPropWizard(this.selection, node);
                    break;
                case 'point':
                    await runAddRoomPointWizard(this.selection, node);
                    break;
                case 'region':
                    await runAddRoomRegionWizard(this.selection, node);
                    break;
                case 'character':
                    await runAddRoomSpawnedCharacterWizard(this.selection, node);
                    break;
                default:
                    return;
            }
            this.roomPreview.onWorkspaceRoomJsonChanged(uri);
            this.refreshMainAndActions();
            await this.pushState();
            return;
        }

        if (msg.action === 'fitBackground') {
            if (focusKind !== 'room') {
                return;
            }
            const data = await loadRoomData(uri);
            if (!data) {
                return;
            }
            const r = await applyFitBackground(data, uri);
            if (!r.ok) {
                void vscode.window.showWarningMessage(r.message);
                return;
            }
            await writeRoomJson(uri, data);
            this.roomPreview.onWorkspaceRoomJsonChanged(uri);
            this.refreshMainAndActions();
            await this.pushState();
            return;
        }

        if (msg.action === 'verbReveal') {
            const eventId = typeof msg.eventId === 'string' ? msg.eventId : '';
            if (eventId && focusKind === 'room') {
                await vscode.commands.executeCommand(
                    'benne-editor.revealRoomScriptEvent',
                    uri.toString(),
                    roomId,
                    eventId
                );
            } else if (eventId && focusKind === 'character') {
                const characterId = typeof msg.characterId === 'string' ? msg.characterId : '';
                if (characterId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.revealCharacterScriptEvent',
                        uri.toString(),
                        characterId,
                        eventId
                    );
                }
            } else if (eventId && focusKind === 'inventory') {
                const itemId = typeof msg.itemId === 'string' ? msg.itemId : '';
                if (itemId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.revealInventoryScriptEvent',
                        uri.toString(),
                        itemId,
                        eventId
                    );
                }
            }
            return;
        }

        if (msg.action === 'verbAdd') {
            const target = msg.target;
            const verbId = typeof msg.verbId === 'string' ? msg.verbId : '';
            if (focusKind === 'room' && target === 'prop') {
                const propId = typeof msg.targetId === 'string' ? msg.targetId : '';
                if (propId && verbId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.addPropVerbEvent',
                        uri.toString(),
                        roomId,
                        propId,
                        verbId
                    );
                }
            } else if (focusKind === 'room' && target === 'hotspot') {
                const hotspotId = typeof msg.targetId === 'string' ? msg.targetId : '';
                if (hotspotId && verbId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.addHotspotVerbEvent',
                        uri.toString(),
                        roomId,
                        hotspotId,
                        verbId
                    );
                }
            } else if (focusKind === 'room' && target === 'character') {
                const characterId = typeof msg.characterId === 'string' ? msg.characterId : '';
                if (characterId && verbId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.addRoomCharacterVerbEvent',
                        uri.toString(),
                        roomId,
                        characterId,
                        verbId
                    );
                }
            } else if (focusKind === 'character' && target === 'characterDef') {
                const characterId = typeof msg.characterId === 'string' ? msg.characterId : '';
                if (characterId && verbId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.addCharacterVerbEvent',
                        uri.toString(),
                        characterId,
                        verbId
                    );
                }
            } else if (focusKind === 'inventory' && target === 'inventoryDef') {
                const itemId = typeof msg.itemId === 'string' ? msg.itemId : '';
                if (itemId && verbId) {
                    await vscode.commands.executeCommand(
                        'benne-editor.addInventoryVerbEvent',
                        uri.toString(),
                        itemId,
                        verbId
                    );
                }
            }
            this.refreshMainAndActions();
            await this.pushState();
            return;
        }

        if (msg.action === 'importCharacterAnimations') {
            if (focusKind === 'character') {
                await vscode.commands.executeCommand('benne-editor.importAnimationsFromAsepriteTags');
                this.refreshMainAndActions();
                await this.pushState();
            }
            return;
        }

        if (msg.action === 'editRoomPreview') {
            if (focusKind !== 'room') {
                return;
            }
            const kind = msg.kind;
            const id = typeof msg.id === 'string' ? msg.id : '';
            if (kind === 'prop' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'prop', id });
            } else if (kind === 'hotspot' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'hotspot', id });
            } else if (kind === 'point' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'roomPoint', id });
            } else if (kind === 'region' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'region', id });
            }
            return;
        }

        if (msg.action === 'applyPatches') {
            const patchesUnknown = msg.patches;
            if (!Array.isArray(patchesUnknown)) {
                return;
            }
            const data = await loadRoomData(uri);
            if (!data) {
                void vscode.window.showErrorMessage('Could not load JSON.');
                return;
            }
            for (const p of patchesUnknown as WebviewPatch[]) {
                this.applyOnePatch(data, uri, p, focusKind);
            }
            if (focusKind === 'room') {
                await writeRoomJson(uri, data);
                this.roomPreview.onWorkspaceRoomJsonChanged(uri);
            } else {
                await writeDataJson(uri, data);
            }
            this.refreshMainAndActions();
            await this.pushState();
        }
    }

    private applyOnePatch(
        data: Record<string, unknown>,
        uri: vscode.Uri,
        p: WebviewPatch,
        focusKind: 'none' | 'room' | 'character' | 'gui' | 'inventory'
    ): void {
        void uri;
        if (p.type === 'roomMeta') {
            if (focusKind !== 'room') {
                return;
            }
            applyRoomDisplayName(data, p.displayName);
            if (p.size && Number.isFinite(p.size.width) && Number.isFinite(p.size.height)) {
                applyRoomSize(data, p.size.width, p.size.height);
            } else {
                clearRoomSize(data);
            }
            if (
                p.scrollBounds &&
                Number.isFinite(p.scrollBounds.x) &&
                Number.isFinite(p.scrollBounds.y) &&
                Number.isFinite(p.scrollBounds.width) &&
                Number.isFinite(p.scrollBounds.height)
            ) {
                applyScrollBounds(
                    data,
                    p.scrollBounds.x,
                    p.scrollBounds.y,
                    p.scrollBounds.width,
                    p.scrollBounds.height
                );
            } else {
                clearScrollBounds(data);
            }
            return;
        }
        if (p.type === 'clearScrollBounds') {
            if (focusKind !== 'room') {
                return;
            }
            clearScrollBounds(data);
            return;
        }
        if (p.type === 'walkableActive') {
            if (focusKind !== 'room') {
                return;
            }
            const kind = p.kind === 'hole' ? 'hole' : 'polygon';
            const polygonId = typeof p.polygonId === 'string' ? p.polygonId : '';
            const rowId = typeof p.rowId === 'string' ? p.rowId : '';
            if (polygonId && rowId && typeof p.active === 'boolean') {
                setWalkableRowActive(data, kind, polygonId, rowId, p.active);
            }
            return;
        }
        if (p.type === 'addWalkablePolygon') {
            if (focusKind !== 'room') {
                return;
            }
            addWalkablePolygon(data);
            return;
        }
        if (p.type === 'addWalkableHole') {
            if (focusKind !== 'room') {
                return;
            }
            if (typeof p.polygonId === 'string') {
                addWalkableHole(data, p.polygonId);
            }
            return;
        }
        if (p.type === 'propField' && typeof p.id === 'string') {
            if (focusKind !== 'room') {
                return;
            }
            updatePropFields(data, p.id, {
                description: p.description,
                visible: p.visible,
                clickable: p.clickable,
                zIndex: p.zIndex,
                parallaxDepth: p.parallaxDepth,
                alpha: p.alpha,
                tag: p.tag,
                defaultAnimation: p.defaultAnimation
            });
            return;
        }
        if (p.type === 'propAnimation') {
            if (focusKind !== 'room') {
                return;
            }
            const propId = typeof p.propId === 'string' ? p.propId : typeof p.id === 'string' ? p.id : '';
            let animationTag = typeof p.animationTag === 'string' ? p.animationTag : '';
            if (!propId) {
                return;
            }
            if (!animationTag && typeof p.id === 'string') {
                const props = (data.props as Record<string, unknown>[] | undefined) ?? [];
                const prop = props.find((x) => x && typeof x.id === 'string' && (x.id as string) === propId);
                const t = prop && typeof prop.tag === 'string' ? prop.tag.trim() : '';
                animationTag = t;
            }
            if (!animationTag) {
                return;
            }
            updatePropAnimationFields(data, propId, animationTag, { loop: p.loop, frameDuration: p.frameDuration });
            return;
        }
        if (p.type === 'hotspotField' && typeof p.id === 'string') {
            if (focusKind !== 'room') {
                return;
            }
            updateHotspotFields(data, p.id, {
                description: p.description,
                active: p.active,
                zIndex: p.zIndex
            });
            return;
        }
        if (p.type === 'characterField' && typeof p.instanceId === 'string') {
            if (focusKind !== 'room') {
                return;
            }
            updateRoomCharacterFields(data, p.instanceId, {
                x: p.x,
                y: p.y,
                visible: p.visible,
                zIndex: p.zIndex,
                initialFacing: p.initialFacing,
                initialAnimation: p.initialAnimation
            });
            return;
        }
        if (p.type === 'pointField' && typeof p.id === 'string' && typeof p.x === 'number' && typeof p.y === 'number') {
            if (focusKind !== 'room') {
                return;
            }
            updatePointFields(data, p.id, p.x, p.y);
            return;
        }
        if (p.type === 'regionActive' && typeof p.id === 'string' && typeof p.active === 'boolean') {
            if (focusKind !== 'room') {
                return;
            }
            updateRegionActive(data, p.id, p.active);
            return;
        }
        if (p.type === 'characterMeta') {
            if (focusKind !== 'character') {
                return;
            }
            updateCharacterFields(data, {
                name: p.name,
                walkSpeed: p.walkSpeed,
                clickable: p.clickable,
                description: p.description,
                walkToPoint: p.walkToPoint,
                talkPoint: p.talkPoint,
                feet: p.feet
            });
            return;
        }
        if (p.type === 'characterAnimation' && typeof p.id === 'string') {
            if (focusKind !== 'character') {
                return;
            }
            updateCharacterAnimationFields(data, p.id, { loop: p.loop, frameDuration: p.frameDuration });
            return;
        }
        if (p.type === 'guiMeta') {
            if (focusKind !== 'gui') {
                return;
            }
            updateGuiFields(data, { name: p.name, description: p.description });
            return;
        }
        if (p.type === 'guiControlPayload' && typeof p.index === 'number' && typeof p.payload === 'string') {
            if (focusKind !== 'gui') {
                return;
            }
            updateGuiControlPayload(data, p.index, p.payload);
            return;
        }
        if (p.type === 'inventoryMeta') {
            if (focusKind !== 'inventory') {
                return;
            }
            updateInventoryFields(data, {
                name: p.name,
                description: p.description,
                stackable: p.stackable,
                defaultAnimation: p.defaultAnimation,
                asepriteMode: p.asepriteMode
            });
            return;
        }
        if (p.type === 'inventoryAnimation' && typeof p.id === 'string') {
            if (focusKind !== 'inventory') {
                return;
            }
            updateInventoryAnimationFields(data, p.id, { loop: p.loop, frameDuration: p.frameDuration });
            return;
        }
        if (p.type === 'delete' && typeof p.entity === 'string' && typeof p.id === 'string') {
            if (focusKind !== 'room') {
                return;
            }
            if (p.entity === 'prop') {
                deleteProp(data, p.id);
            } else if (p.entity === 'hotspot') {
                deleteHotspot(data, p.id);
            } else if (p.entity === 'character') {
                deleteRoomCharacter(data, p.id);
            } else if (p.entity === 'point') {
                deletePoint(data, p.id);
            } else if (p.entity === 'region') {
                deleteRegion(data, p.id);
            } else if (p.entity === 'polygon') {
                deleteWalkablePolygon(data, p.id);
            } else if (p.entity === 'hole') {
                const holeParent =
                    typeof (p as unknown as { parentPolygonId?: string }).parentPolygonId === 'string'
                        ? (p as unknown as { parentPolygonId: string }).parentPolygonId
                        : '';
                if (holeParent) {
                    deleteWalkableHole(data, holeParent, p.id);
                }
            }
        }
    }
}
