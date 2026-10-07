import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    findBenneGameFolders,
    getRoomIdFromRoomJsonUri,
} from './gameDiscovery';
import { readInspectorJsonText } from './inspectorJsonDocument';
import { readRoomPlayFromNamesFromSource } from './playFromDiscovery';
import { resolvePreviewScriptUri } from './previewBundlePaths';
import {
    applyRoomPolygonPatch,
    parseRoomPolygonPatch,
    type RoomPolygonPatch,
} from './roomPolygonPatch';

type PreviewToolbarFocus =
    | 'room'
    | 'walkable'
    | 'roomSize'
    | 'scrollBounds'
    | 'prop'
    | 'hotspot'
    | 'region'
    | 'roomPoint'
    | 'roomCharacter';

type PreviewToolbarState = {
    focus: PreviewToolbarFocus;
    propId: string;
    hotspotId: string;
    regionId: string;
    roomPointId: string;
    characterInstanceId: string;
    walkablePolygonId: string;
    walkableHoleId: string;
};

function emptyPreviewToolbarIds(): Omit<PreviewToolbarState, 'focus'> {
    return {
        propId: '',
        hotspotId: '',
        regionId: '',
        roomPointId: '',
        characterInstanceId: '',
        walkablePolygonId: '',
        walkableHoleId: '',
    };
}

/**
 * Phaser room preview in a {@link vscode.WebviewPanel} (editor area), driven by BENNE tree selection.
 */
export class RoomPreviewPanelController implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private webviewReady = false;
    /** Last room JSON URI successfully sent with `loadRoom`. */
    private lastPushedRoomJsonUri: string | null = null;
    /**
     * URI + preview toolbar identity from the last successful `loadRoom`.
     * Reload when the URI is unchanged but the focused prop/hotspot/region/point changes — otherwise the webview keeps stale room JSON.
     */
    private lastPushedPreviewLoadKey: string | null = null;
    /** Debounced reload when the active room JSON file changes on disk (e.g. add-hotspot wizard uses `writeFile`). */
    private roomJsonDiskChangeTimer: ReturnType<typeof setTimeout> | undefined;
    /** Game root used to resolve locally rebuilt preview bundles (`.benne/` or monorepo sibling). */
    private lastGameRootUri: vscode.Uri | undefined;
    /** Dedupes `toolbarUi` posts when focus is already reflected in the webview. */
    private lastToolbarUiKey: string | null = null;
    /**
     * One-shot edit target from the Inspector "Edit in Preview" (merged into the next `loadRoom` when URI matches).
     */
    private pendingInspectorFocus:
        | { roomJsonUriStr: string; kind: 'prop'; id: string }
        | { roomJsonUriStr: string; kind: 'hotspot'; id: string }
        | { roomJsonUriStr: string; kind: 'roomPoint'; id: string }
        | { roomJsonUriStr: string; kind: 'roomCharacter'; id: string }
        | { roomJsonUriStr: string; kind: 'region'; id: string }
        | { roomJsonUriStr: string; kind: 'walkable'; polygonId: string; holeId: string | null }
        | { roomJsonUriStr: string; kind: 'roomSize' }
        | { roomJsonUriStr: string; kind: 'scrollBounds' }
        | undefined;
    /**
     * After a preview-originated `polygonPatch` write, ignore the JSON watcher's `pushPreview` so Save
     * does not destroy the live Phaser session.
     */
    private previewOriginatedRoomJsonUri: string | null = null;
    private previewOriginatedRoomJsonSkipUntil = 0;
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
        if (this.roomJsonDiskChangeTimer !== undefined) {
            clearTimeout(this.roomJsonDiskChangeTimer);
            this.roomJsonDiskChangeTimer = undefined;
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
        if (this.roomJsonDiskChangeTimer !== undefined) {
            clearTimeout(this.roomJsonDiskChangeTimer);
            this.roomJsonDiskChangeTimer = undefined;
        }
        if (!this.panel) {
            return;
        }
        const p = this.panel;
        this.panel = undefined;
        this.webviewReady = false;
        this.lastPushedRoomJsonUri = null;
        this.lastPushedPreviewLoadKey = null;
        this.lastToolbarUiKey = null;
        this.pendingInspectorFocus = undefined;
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
            roomPanel.kind === 'prop' ||
            roomPanel.kind === 'hotspot' ||
            roomPanel.kind === 'roomCharacter' ||
            roomPanel.kind === 'roomPoint' ||
            roomPanel.kind === 'region' ||
            roomPanel.kind === 'walkable' ||
            focus.kind === 'room';

        if (!wantRoomPreview) {
            if (this.clearPreviewDebounceTimer !== undefined) {
                clearTimeout(this.clearPreviewDebounceTimer);
            }
            this.clearPreviewDebounceTimer = setTimeout(() => {
                this.clearPreviewDebounceTimer = undefined;
                const f = this.selection.focus;
                const rp = this.selection.roomPanel;
                if (
                    rp.kind === 'prop' ||
                    rp.kind === 'hotspot' ||
                    rp.kind === 'roomCharacter' ||
                    rp.kind === 'roomPoint' ||
                    rp.kind === 'region' ||
                    rp.kind === 'walkable' ||
                    f.kind === 'room'
                ) {
                    return;
                }
                if (this.panel && this.webviewReady) {
                    void this.panel.webview.postMessage({ type: 'benne/preview/clear' });
                }
                this.lastPushedRoomJsonUri = null;
                this.lastPushedPreviewLoadKey = null;
                this.lastToolbarUiKey = null;
            }, this.clearPreviewDebounceMs);
            return;
        }

        if (this.clearPreviewDebounceTimer !== undefined) {
            clearTimeout(this.clearPreviewDebounceTimer);
            this.clearPreviewDebounceTimer = undefined;
        }

        // BENNE tree navigation supersedes a pending Inspector "Edit in Preview" one-shot.
        this.pendingInspectorFocus = undefined;

        const createdNew = this.ensurePanel();
        const roomOnly = focus.kind === 'room' && roomPanel.kind === 'none';
        if (this.panel && roomOnly) {
            this.panel.reveal(vscode.ViewColumn.One, true);
        }
        if (createdNew) {
            this.webviewReady = false;
            this.lastPushedPreviewLoadKey = null;
        } else if (this.webviewReady) {
            const nextUri = this.previewRoomJsonUriForSelection();
            const nextStr = nextUri?.toString() ?? '';
            const tb = this.getPreviewToolbarState();
            const loadKey = nextStr.length > 0 ? this.previewLoadKey(nextStr, tb) : '';
            if (nextStr && loadKey === this.lastPushedPreviewLoadKey) {
                this.postToolbarUiIfNeeded();
                return;
            }
            await this.pushPreview();
        }
    }

    private getPreviewToolbarState(): PreviewToolbarState {
        const roomPanel = this.selection.roomPanel;
        const empty = emptyPreviewToolbarIds();
        if (roomPanel.kind === 'prop') {
            return {
                focus: 'prop',
                ...empty,
                propId: roomPanel.prop.id,
            };
        }
        if (roomPanel.kind === 'hotspot') {
            return {
                focus: 'hotspot',
                ...empty,
                hotspotId: roomPanel.hotspotId,
            };
        }
        if (roomPanel.kind === 'region') {
            return {
                focus: 'region',
                ...empty,
                regionId: roomPanel.regionId,
            };
        }
        if (roomPanel.kind === 'roomPoint') {
            return {
                focus: 'roomPoint',
                ...empty,
                roomPointId: roomPanel.pointId,
            };
        }
        if (roomPanel.kind === 'roomCharacter') {
            return {
                focus: 'roomCharacter',
                ...empty,
                characterInstanceId: roomPanel.instanceId,
            };
        }
        if (roomPanel.kind === 'walkable') {
            return {
                focus: 'walkable',
                ...empty,
                walkablePolygonId: roomPanel.polygonId,
                walkableHoleId: roomPanel.holeId ?? '',
            };
        }
        return {
            focus: 'room',
            ...empty,
        };
    }

    private previewLoadKey(roomJsonUriStr: string, tb: PreviewToolbarState): string {
        return `${roomJsonUriStr}\0${tb.focus}\0${tb.propId}\0${tb.hotspotId}\0${tb.regionId}\0${tb.roomPointId}\0${tb.characterInstanceId}\0${tb.walkablePolygonId}\0${tb.walkableHoleId}`;
    }

    /**
     * When a `*.room.json` file changes on disk, reload the preview if that room is currently shown.
     * (Wizards use `fs.writeFile`, which does not always change tree selection.)
     */
    /**
     * Reload preview when the sibling `*.room.ts` is saved (Play From names for the toolbar dropdown).
     */
    onWorkspaceRoomScriptChanged(scriptUri: vscode.Uri): void {
        if (!scriptUri.fsPath.endsWith('.room.ts')) {
            return;
        }
        if (!this.panel || !this.webviewReady) {
            return;
        }
        const curJsonStr = this.previewRoomJsonUriForSelection()?.toString() ?? this.lastPushedRoomJsonUri;
        if (!curJsonStr) {
            return;
        }
        let jsonUri: vscode.Uri;
        try {
            jsonUri = vscode.Uri.parse(curJsonStr);
        } catch {
            return;
        }
        const roomId = getRoomIdFromRoomJsonUri(jsonUri);
        const expectedTs = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`).toString();
        if (scriptUri.toString() !== expectedTs) {
            return;
        }
        void this.pushPreview();
    }

    onWorkspaceRoomJsonChanged(uri: vscode.Uri): void {
        if (!uri.fsPath.endsWith('.room.json')) {
            return;
        }
        if (!this.panel || !this.webviewReady) {
            return;
        }
        const uriStr = uri.toString();
        if (
            this.previewOriginatedRoomJsonUri === uriStr &&
            Date.now() < this.previewOriginatedRoomJsonSkipUntil
        ) {
            return;
        }
        const cur = this.previewRoomJsonUriForSelection()?.toString();
        if (uriStr !== cur && uriStr !== this.lastPushedRoomJsonUri) {
            return;
        }
        if (this.roomJsonDiskChangeTimer !== undefined) {
            clearTimeout(this.roomJsonDiskChangeTimer);
        }
        this.roomJsonDiskChangeTimer = setTimeout(() => {
            this.roomJsonDiskChangeTimer = undefined;
            if (
                this.previewOriginatedRoomJsonUri === uriStr &&
                Date.now() < this.previewOriginatedRoomJsonSkipUntil
            ) {
                return;
            }
            void this.pushPreview();
        }, 250);
    }

    private postToolbarUiIfNeeded(): void {
        const webview = this.panel?.webview;
        if (!webview) {
            return;
        }
        const ui = this.getPreviewToolbarState();
        const key = `${ui.focus}:${ui.propId}:${ui.hotspotId}:${ui.regionId}:${ui.roomPointId}:${ui.characterInstanceId}:${ui.walkablePolygonId}:${ui.walkableHoleId}`;
        if (this.lastToolbarUiKey === key) {
            return;
        }
        this.lastToolbarUiKey = key;
        webview.postMessage({
            type: 'benne/preview/toolbarUi',
            previewFocus: ui.focus,
            ...(ui.focus === 'prop' ? { propColliderId: ui.propId } : {}),
            ...(ui.focus === 'hotspot' ? { hotspotId: ui.hotspotId } : {}),
            ...(ui.focus === 'region' ? { regionId: ui.regionId } : {}),
            ...(ui.focus === 'roomPoint' ? { roomPointId: ui.roomPointId } : {}),
            ...(ui.focus === 'roomCharacter' ? { characterInstanceId: ui.characterInstanceId } : {}),
            ...(ui.focus === 'walkable'
                ? { walkablePolygonId: ui.walkablePolygonId, walkableHoleId: ui.walkableHoleId }
                : {}),
        });
    }

    private previewRoomJsonUriForSelection(): vscode.Uri | undefined {
        const focus = this.selection.focus;
        const roomPanel = this.selection.roomPanel;
        if (roomPanel.kind === 'prop') {
            return roomPanel.roomJsonUri;
        }
        if (roomPanel.kind === 'hotspot') {
            return roomPanel.roomJsonUri;
        }
        if (roomPanel.kind === 'roomPoint') {
            return roomPanel.roomJsonUri;
        }
        if (roomPanel.kind === 'region') {
            return roomPanel.roomJsonUri;
        }
        if (roomPanel.kind === 'walkable') {
            return roomPanel.roomJsonUri;
        }
        if (roomPanel.kind === 'roomCharacter') {
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

        void this.applyPreviewHtml();

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage(
                (m: {
                    type?: string;
                    roomJsonUri?: string;
                    roomId?: string;
                    roomName?: string;
                    playFromName?: string;
                    patch?: unknown;
                }) => {
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
                    return;
                }
                if (m?.type === 'benne/preview/roomLoadComplete') {
                    this.flushPendingInspectorFocusIfReady();
                    return;
                }
                if (m?.type === 'benne/preview/playFromHere') {
                    const uriStr = typeof m.roomJsonUri === 'string' ? m.roomJsonUri : '';
                    const roomId = typeof m.roomId === 'string' ? m.roomId : '';
                    if (uriStr.length > 0 && roomId.length > 0) {
                        const roomName = typeof m.roomName === 'string' ? m.roomName : undefined;
                        const playFromName =
                            typeof m.playFromName === 'string' && m.playFromName.trim().length > 0
                                ? m.playFromName.trim()
                                : undefined;
                        void vscode.commands.executeCommand(
                            'benne-editor.playFromRoom',
                            uriStr,
                            roomId,
                            roomName,
                            playFromName
                        );
                    }
                    return;
                }
            }),
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.webviewReady = false;
                this.lastPushedRoomJsonUri = null;
                this.lastPushedPreviewLoadKey = null;
                this.lastToolbarUiKey = null;
                this.pendingInspectorFocus = undefined;
            })
        );

        return true;
    }

    /**
     * Opens the room preview (if needed) and loads it in the same edit mode as selecting that entity in the BENNE tree.
     * Used by the Inspector “Edit in Preview” action.
     */
    async focusInspectorGeometry(
        roomJsonUri: vscode.Uri,
        target:
            | { kind: 'prop'; id: string }
            | { kind: 'hotspot'; id: string }
            | { kind: 'roomPoint'; id: string }
            | { kind: 'roomCharacter'; id: string }
            | { kind: 'region'; id: string }
            | { kind: 'walkable'; polygonId: string; holeId: string | null }
            | { kind: 'roomSize' }
            | { kind: 'scrollBounds' }
    ): Promise<void> {
        const u = roomJsonUri.toString();
        switch (target.kind) {
            case 'prop':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'prop', id: target.id };
                break;
            case 'hotspot':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'hotspot', id: target.id };
                break;
            case 'roomPoint':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'roomPoint', id: target.id };
                break;
            case 'roomCharacter':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'roomCharacter', id: target.id };
                break;
            case 'region':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'region', id: target.id };
                break;
            case 'walkable':
                this.pendingInspectorFocus = {
                    roomJsonUriStr: u,
                    kind: 'walkable',
                    polygonId: target.polygonId,
                    holeId: target.holeId
                };
                break;
            case 'roomSize':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'roomSize' };
                break;
            case 'scrollBounds':
                this.pendingInspectorFocus = { roomJsonUriStr: u, kind: 'scrollBounds' };
                break;
        }
        this.ensurePanel();
        this.panel?.reveal(vscode.ViewColumn.Beside, false);
        await this.pushPreview();
        this.flushPendingInspectorFocusIfReady();
    }

    private toolbarStateFromInspectorPending(
        pending: NonNullable<RoomPreviewPanelController['pendingInspectorFocus']>
    ): PreviewToolbarState {
        const empty = emptyPreviewToolbarIds();
        switch (pending.kind) {
            case 'prop':
                return { focus: 'prop', ...empty, propId: pending.id };
            case 'hotspot':
                return { focus: 'hotspot', ...empty, hotspotId: pending.id };
            case 'roomPoint':
                return { focus: 'roomPoint', ...empty, roomPointId: pending.id };
            case 'roomCharacter':
                return { focus: 'roomCharacter', ...empty, characterInstanceId: pending.id };
            case 'region':
                return { focus: 'region', ...empty, regionId: pending.id };
            case 'walkable':
                return {
                    focus: 'walkable',
                    ...empty,
                    walkablePolygonId: pending.polygonId,
                    walkableHoleId: pending.holeId ?? '',
                };
            case 'roomSize':
                return { focus: 'roomSize', ...empty };
            case 'scrollBounds':
                return { focus: 'scrollBounds', ...empty };
        }
    }

    private flushPendingInspectorFocusIfReady(): void {
        const webview = this.panel?.webview;
        const pending = this.pendingInspectorFocus;
        if (!webview || !this.webviewReady || !pending) {
            return;
        }
        if (this.lastPushedRoomJsonUri !== pending.roomJsonUriStr) {
            return;
        }
        if (pending.kind === 'prop') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'prop',
                propColliderId: pending.id
            });
        } else if (pending.kind === 'hotspot') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'hotspot',
                hotspotId: pending.id
            });
        } else if (pending.kind === 'roomPoint') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'roomPoint',
                roomPointId: pending.id
            });
        } else if (pending.kind === 'roomCharacter') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'roomCharacter',
                characterInstanceId: pending.id
            });
        } else if (pending.kind === 'walkable') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'walkable',
                walkablePolygonId: pending.polygonId,
                walkableHoleId: pending.holeId ?? ''
            });
        } else if (pending.kind === 'roomSize') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'roomSize'
            });
        } else if (pending.kind === 'scrollBounds') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'scrollBounds'
            });
        } else if (pending.kind === 'region') {
            webview.postMessage({
                type: 'benne/preview/inspectorFocus',
                previewFocus: 'region',
                regionId: pending.id
            });
        }
        this.pendingInspectorFocus = undefined;
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
        this.previewOriginatedRoomJsonUri = uri.toString();
        this.previewOriginatedRoomJsonSkipUntil = Date.now() + 1200;
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
        this.lastGameRootUri = folder.uri;

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
            const rid = typeof room.id === 'string' && room.id.length > 0 ? room.id : getRoomIdFromRoomJsonUri(roomJsonUri);
            const playFromNames = await this.readRoomScriptPlayFromNames(roomJsonUri, rid);
            const gameSrcWebviewUri = webview.asWebviewUri(gameSrc).toString();
            const uriStr = roomJsonUri.toString();
            const pend = this.pendingInspectorFocus;
            const usePending = !!(pend && pend.roomJsonUriStr === uriStr);
            const tb = usePending ? this.toolbarStateFromInspectorPending(pend) : this.getPreviewToolbarState();
            this.lastToolbarUiKey = `${tb.focus}:${tb.propId}:${tb.hotspotId}:${tb.regionId}:${tb.roomPointId}:${tb.characterInstanceId}:${tb.walkablePolygonId}:${tb.walkableHoleId}`;
            webview.postMessage({
                type: 'benne/preview/loadRoom',
                room,
                gameSrcWebviewUri,
                roomJsonUri: uriStr,
                playFromNames,
                previewFocus: tb.focus,
                ...(tb.focus === 'prop' ? { propColliderId: tb.propId } : {}),
                ...(tb.focus === 'hotspot' ? { hotspotId: tb.hotspotId } : {}),
                ...(tb.focus === 'region' ? { regionId: tb.regionId } : {}),
                ...(tb.focus === 'roomPoint' ? { roomPointId: tb.roomPointId } : {}),
                ...(tb.focus === 'roomCharacter' ? { characterInstanceId: tb.characterInstanceId } : {}),
                ...(tb.focus === 'walkable'
                    ? { walkablePolygonId: tb.walkablePolygonId, walkableHoleId: tb.walkableHoleId }
                    : {}),
            });
            this.lastPushedRoomJsonUri = uriStr;
            this.lastPushedPreviewLoadKey = this.previewLoadKey(uriStr, tb);
            if (usePending) {
                this.pendingInspectorFocus = undefined;
            }
        } catch (e) {
            webview.postMessage({
                type: 'benne/preview/error',
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }

    /**
     * Reassign webview HTML so `room-preview.js` is fetched again from disk (new CSP nonce).
     * Call after `npm run build:room-preview` updates the extension media bundle.
     */
    reloadRoomPreviewBundle(): void {
        if (!this.panel) {
            return;
        }
        this.webviewReady = false;
        this.lastPushedRoomJsonUri = null;
        this.lastPushedPreviewLoadKey = null;
        this.lastToolbarUiKey = null;
        void this.applyPreviewHtml();
    }

    private async applyPreviewHtml(): Promise<void> {
        if (!this.panel) {
            return;
        }
        if (!this.lastGameRootUri) {
            const games = await findBenneGameFolders();
            if (games.length > 0) {
                this.lastGameRootUri = games[0].uri;
            }
        }
        this.panel.webview.html = await buildRoomPreviewHtml(
            this.panel.webview,
            this.extensionUri,
            this.lastGameRootUri,
        );
    }

    /** Dirty JSON tab vs disk, with clean-but-stale tab repair — same reader as Inspector / character preview. */
    private async readRoomJsonAsUtf8(uri: vscode.Uri): Promise<string> {
        return readInspectorJsonText(uri);
    }

    private async readRoomScriptAsUtf8(uri: vscode.Uri): Promise<string> {
        const uriStr = uri.toString();
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriStr);
        if (open) {
            return open.getText();
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(raw).toString('utf8');
    }

    private async readRoomScriptPlayFromNames(roomJsonUri: vscode.Uri, roomId: string): Promise<string[]> {
        const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
        try {
            const src = await this.readRoomScriptAsUtf8(scriptUri);
            return readRoomPlayFromNamesFromSource(src);
        } catch {
            return [];
        }
    }
}

function buildRoomPreviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
): Promise<string> {
    return resolvePreviewScriptUri(
        webview,
        extensionUri,
        gameRoot,
        'room-preview',
        'room-preview.js',
    ).then((scriptUri) => {
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
    <div id="benne-preview-play-toolbar" style="display:none;flex-shrink:0;flex-direction:column;align-items:flex-start;gap:6px;margin-top:1px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <label for="benne-preview-play-from" style="color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;white-space:nowrap;">Play from</label>
        <select id="benne-preview-play-from" title="Optional playFrom(…) starting state for BENNE Play" aria-label="Play from starting state" style="font-size:12px;min-width:120px;max-width:200px;padding:3px 6px;border-radius:4px;border:1px solid #5a5a70;background:#1a1a28;color:#e8ecff;"></select>
        <button type="button" id="benne-preview-play" title="Open BENNE Play in this room (runs the selected Play From setup, then room.onEnter)" style="flex-shrink:0;background:#2d6a4f;color:#e8ffef;border:1px solid #40916c;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Play</button>
      </div>
    </div>
    <div id="benne-polygon-toolbar" style="flex:1;min-width:0;"></div>
    <label id="benne-preview-options" title="Show generic GUIs with visible: true in *.gui.json (excludes speaking-text, display-text, and choice-dialog GUIs)" style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;margin-top:3px;cursor:pointer;user-select:none;">
      <input type="checkbox" id="benne-show-guis-toggle" style="margin:0;cursor:pointer;" />
      <span>Show GUIs</span>
    </label>
    <button type="button" id="benne-refresh-preview" title="Reload room JSON from disk" style="flex-shrink:0;margin-top:1px;background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Refresh</button>
  </div>
  <div id="benne-preview-root" style="flex:1;min-height:0;width:100%;"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    });
}
