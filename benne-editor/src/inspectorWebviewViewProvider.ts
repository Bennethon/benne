import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { buildInspectorState, type InspectorStatePayload } from './inspectorStateBuilder';
import {
    addWalkableHole,
    addWalkablePolygon,
    applyFitBackground,
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
    updatePropFields,
    updateRegionActive,
    updateRoomCharacterFields,
    writeRoomJson
} from './inspectorMutations';
import { getRoomIdFromRoomJsonUri } from './gameDiscovery';
import type { RoomPreviewPanelController } from './roomPreviewPanel';
import { openCharacterJsonAndScriptBottomGroup } from './roomScriptNavigation';

function resolveRoomJsonUri(selection: EditorSelection): vscode.Uri | undefined {
    const focus = selection.focus;
    const rp = selection.roomPanel;
    if (focus.kind === 'room') {
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
    :root { color: var(--vscode-editor-foreground); background: var(--vscode-sideBar-background); font-size: 12px; }
    body { margin: 0; padding: 0; font-family: var(--vscode-font-family); }
    #benne-inspector-app { box-sizing: border-box; min-height: 100vh; display: flex; flex-direction: column; }
    .inspector-root { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .scroll { flex: 1; overflow: auto; padding: 8px 10px 72px; }
    .footer { position: sticky; bottom: 0; display: flex; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--vscode-widget-border); background: var(--vscode-sideBar-background); }
    .footer button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; cursor: pointer; border-radius: 2px; }
    .section { border: 1px solid var(--vscode-widget-border); border-radius: 4px; margin-bottom: 8px; background: var(--vscode-editor-background); }
    .section > summary { padding: 6px 8px; cursor: pointer; font-weight: 600; }
    .section-body { padding: 8px; border-top: 1px solid var(--vscode-widget-border); }
    .block { display: block; margin-bottom: 8px; }
    .block input, .block textarea { width: 100%; box-sizing: border-box; margin-top: 4px; }
    .row { margin: 6px 0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .wrap { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .muted { color: var(--vscode-descriptionForeground); }
    .small { font-size: 11px; }
    .badge { padding: 2px 6px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 4px; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th, table.grid td { border: 1px solid var(--vscode-widget-border); padding: 4px 6px; text-align: left; }
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .card { border: 1px solid var(--vscode-widget-border); border-radius: 4px; padding: 4px 6px; background: var(--vscode-editor-background); }
    .card > summary { cursor: pointer; font-weight: 500; }
    .card-body { padding: 6px 4px 8px; }
    .banner { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); padding: 4px 6px; border-radius: 2px; margin-bottom: 6px; font-size: 11px; }
    .verb-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .verb-chip { border: 1px solid var(--vscode-button-border); border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .verb-defined { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-border); }
    .verb-add { opacity: 0.75; }
    .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .linkish { background: transparent; color: var(--vscode-textLink-foreground); border: none; cursor: pointer; padding: 4px 0; }
    .danger { background: var(--vscode-errorForeground); color: var(--vscode-editor-background); border: none; padding: 4px 8px; border-radius: 2px; cursor: pointer; }
    .empty { padding: 12px; color: var(--vscode-descriptionForeground); }
    .tag { font-weight: 600; }
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
    | { type: 'propField'; id?: string; description?: string; visible?: boolean; clickable?: boolean; zIndex?: number; parallaxDepth?: number; alpha?: number }
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
                const uri = resolveRoomJsonUri(this.selection);
                if (uri && e.document.uri.toString() === uri.toString()) {
                    void this.pushState();
                }
            }),
            vscode.workspace.onDidSaveTextDocument((doc) => {
                const uri = resolveRoomJsonUri(this.selection);
                if (uri && doc.uri.toString() === uri.toString()) {
                    this.roomPreview.onWorkspaceRoomJsonChanged(doc.uri);
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
        const uri = resolveRoomJsonUri(this.selection);
        if (!uri) {
            this.postState({
                kind: 'empty',
                message: 'Select a room or an item under a room in the BENNE tree to edit room data.'
            });
            return;
        }
        const state = await buildInspectorState(uri, this.selection.roomPanel, ++this.rev);
        this.postState(state);
    }

    private async handleWebviewMessage(msg: { action?: string } & Record<string, unknown>): Promise<void> {
        const uri = resolveRoomJsonUri(this.selection);
        if (!uri || msg.action === undefined) {
            return;
        }
        const roomId = getRoomIdFromRoomJsonUri(uri);

        if (msg.action === 'openRawJson') {
            await vscode.window.showTextDocument(uri, { preview: false });
            return;
        }

        if (msg.action === 'fitBackground') {
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
            if (eventId) {
                await vscode.commands.executeCommand(
                    'benne-editor.revealRoomScriptEvent',
                    uri.toString(),
                    roomId,
                    eventId
                );
            }
            return;
        }

        if (msg.action === 'verbAdd') {
            const target = msg.target;
            const verbId = typeof msg.verbId === 'string' ? msg.verbId : '';
            if (target === 'prop') {
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
            } else if (target === 'hotspot') {
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
            } else if (target === 'character') {
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
            }
            this.refreshMainAndActions();
            await this.pushState();
            return;
        }

        if (msg.action === 'editRoomPreview') {
            const kind = msg.kind;
            const id = typeof msg.id === 'string' ? msg.id : '';
            if (kind === 'prop' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'prop', id });
            } else if (kind === 'hotspot' && id) {
                await this.roomPreview.focusInspectorGeometry(uri, { kind: 'hotspot', id });
            }
            return;
        }

        if (msg.action === 'editCharacterPreview') {
            const characterJsonUriStr = typeof msg.characterJsonUri === 'string' ? msg.characterJsonUri : '';
            const characterId = typeof msg.characterId === 'string' ? msg.characterId : '';
            if (characterJsonUriStr && characterId) {
                await openCharacterJsonAndScriptBottomGroup(vscode.Uri.parse(characterJsonUriStr), characterId);
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
                void vscode.window.showErrorMessage('Could not load room JSON.');
                return;
            }
            for (const p of patchesUnknown as WebviewPatch[]) {
                this.applyOnePatch(data, uri, p);
            }
            await writeRoomJson(uri, data);
            this.roomPreview.onWorkspaceRoomJsonChanged(uri);
            this.refreshMainAndActions();
            await this.pushState();
        }
    }

    private applyOnePatch(data: Record<string, unknown>, uri: vscode.Uri, p: WebviewPatch): void {
        if (p.type === 'roomMeta') {
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
            clearScrollBounds(data);
            return;
        }
        if (p.type === 'walkableActive') {
            const kind = p.kind === 'hole' ? 'hole' : 'polygon';
            const polygonId = typeof p.polygonId === 'string' ? p.polygonId : '';
            const rowId = typeof p.rowId === 'string' ? p.rowId : '';
            if (polygonId && rowId && typeof p.active === 'boolean') {
                setWalkableRowActive(data, kind, polygonId, rowId, p.active);
            }
            return;
        }
        if (p.type === 'addWalkablePolygon') {
            addWalkablePolygon(data);
            return;
        }
        if (p.type === 'addWalkableHole') {
            if (typeof p.polygonId === 'string') {
                addWalkableHole(data, p.polygonId);
            }
            return;
        }
        if (p.type === 'propField' && typeof p.id === 'string') {
            updatePropFields(data, p.id, {
                description: p.description,
                visible: p.visible,
                clickable: p.clickable,
                zIndex: p.zIndex,
                parallaxDepth: p.parallaxDepth,
                alpha: p.alpha
            });
            return;
        }
        if (p.type === 'hotspotField' && typeof p.id === 'string') {
            updateHotspotFields(data, p.id, {
                description: p.description,
                active: p.active,
                zIndex: p.zIndex
            });
            return;
        }
        if (p.type === 'characterField' && typeof p.instanceId === 'string') {
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
            updatePointFields(data, p.id, p.x, p.y);
            return;
        }
        if (p.type === 'regionActive' && typeof p.id === 'string' && typeof p.active === 'boolean') {
            updateRegionActive(data, p.id, p.active);
            return;
        }
        if (p.type === 'delete' && typeof p.entity === 'string' && typeof p.id === 'string') {
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
