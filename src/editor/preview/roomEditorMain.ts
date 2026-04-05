import type { Game } from 'phaser';
import type { RoomData } from '../../types/room';
import { buildPreviewManifest } from './buildPreviewManifest';
import { createRoomPreviewPhaserGame } from './createRoomPreviewGame';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

const MIN_POLY_POINTS = 3;

type WalkableSelectTarget = { polygonId: string; holeId: string | null };

function encodeWalkableSelectValue(t: WalkableSelectTarget): string {
    return JSON.stringify({ p: t.polygonId, h: t.holeId });
}

function decodeWalkableSelectValue(s: string): WalkableSelectTarget | null {
    try {
        const o = JSON.parse(s) as { p?: unknown; h?: unknown };
        if (typeof o.p !== 'string') {
            return null;
        }
        const h =
            o.h === null || o.h === undefined ? null : typeof o.h === 'string' ? o.h : null;
        return { polygonId: o.p, holeId: h };
    } catch {
        return null;
    }
}

let game: Game | null = null;
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let currentRoomJsonUri = '';
/** Latest room from the host; used for `toolbarUi` updates without reloading Phaser. */
let lastLoadedRoom: RoomData | null = null;

type PreviewToolbarPayload =
    | { previewFocus: 'room' }
    | { previewFocus: 'prop'; propColliderId: string };

function parsePreviewToolbarPayload(msg: {
    previewFocus?: string;
    propColliderId?: string;
}): PreviewToolbarPayload {
    if (
        msg.previewFocus === 'prop' &&
        typeof msg.propColliderId === 'string' &&
        msg.propColliderId.length > 0
    ) {
        return { previewFocus: 'prop', propColliderId: msg.propColliderId };
    }
    return { previewFocus: 'room' };
}

function propColliderLabel(room: RoomData, propId: string): string {
    const p = room.props?.find((x) => x.id === propId);
    if (!p) {
        return propId;
    }
    return p.tag ? `${p.tag} (${propId})` : propId;
}

/** Collider authoring is only for interactive props (matches runtime expectations). */
function isPropColliderEditable(room: RoomData, propId: string): boolean {
    const p = room.props?.find((x) => x.id === propId);
    return p?.clickable === true;
}

/** Bumps on each `loadRoom` so stale `buildPreviewManifest` completions (e.g. double save) cannot create a game after a newer load cleared the DOM. */
let loadRoomGeneration = 0;

try {
    vscodeApi = acquireVsCodeApi();
} catch {
    /* not inside a VS Code webview */
}

function setStatus(text: string): void {
    const el = document.getElementById('benne-polygon-status');
    if (el) {
        el.textContent = text;
    }
}

/**
 * Phaser queues `destroy` for a later step. We must not mount a new `Phaser.Game` on the same parent
 * until teardown has had time to run. Listening for `game.events` "destroy" is unreliable in VS Code
 * webviews when `requestAnimationFrame` is throttled, so we use a short timer instead.
 */
async function destroyPreviewGameAsync(): Promise<void> {
    if (!game) {
        return;
    }
    const g = game;
    game = null;
    try {
        g.destroy(true);
    } catch {
        /* canvas may already be detached */
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 150);
    });
}

function clearToolbar(): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (bar) {
        bar.innerHTML = '';
    }
    polygonEditBridge.setMode('navigate');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setWalkableEditTarget('', '');
}

function buildRoomToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <div style="display:inline-flex;align-items:center;gap:6px;">
        <label for="benne-edit-mode">Mode</label>
        <select id="benne-edit-mode" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;">
          <option value="navigate">Navigate</option>
          <option value="walkable">Edit walkable</option>
        </select>
      </div>
      <div id="benne-walkable-row" hidden style="align-items:center;gap:6px;display:inline-flex;">
        <label for="benne-walkable-id">Walkable/Holes</label>
        <select id="benne-walkable-id" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;max-width:280px;"></select>
      </div>
      <button type="button" id="benne-save-polygon" hidden style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">New polygon: click ${MIN_POLY_POINTS} times to place vertices. Then double-click an edge to add more. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).</div>
  `;
}

function buildPropTreeToolbarHtml(propLabel: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Prop collider — <strong style="color:#e8ecff;">${escapeHtml(propLabel)}</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Editing collider for the prop selected in the BENNE tree. New polygon: click ${MIN_POLY_POINTS} times to place vertices, then double-click edges to add vertices.</div>
  `;
}

function buildPropTreeNonClickableToolbarHtml(propLabel: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;"><strong style="color:#e8ecff;">${escapeHtml(propLabel)}</strong> — not clickable</span>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Collider editing is only available when <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">"clickable": true</code> is set on this prop in the room JSON.</div>
  `;
}

/**
 * Ensure `walkable.polygons` and arrays exist so toolbar wiring and Phaser never throw on partial JSON
 * (e.g. unsaved edits) or odd structured-clone payloads from the host.
 */
function normalizeRoomForPreview(raw: unknown): RoomData {
    const r =
        raw && typeof raw === 'object' ? ({ ...(raw as Record<string, unknown>) } as Record<string, unknown>) : {};
    const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : 'room';
    const name = typeof r.name === 'string' && r.name.length > 0 ? r.name : id;
    let polygons: RoomData['walkable']['polygons'] = [];
    const w = r.walkable;
    if (w && typeof w === 'object') {
        const polys = (w as { polygons?: unknown }).polygons;
        if (Array.isArray(polys)) {
            polygons = polys as RoomData['walkable']['polygons'];
        }
    }
    r.id = id;
    r.name = name;
    r.walkable = { polygons };
    r.hotspots = Array.isArray(r.hotspots) ? r.hotspots : [];
    r.props = Array.isArray(r.props) ? r.props : [];
    r.characters = Array.isArray(r.characters) ? r.characters : [];
    return r as unknown as RoomData;
}

function wireRoomToolbar(room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomToolbarHtml();

    const modeSel = document.getElementById('benne-edit-mode') as HTMLSelectElement;
    const walkRow = document.getElementById('benne-walkable-row')!;
    const walkSel = document.getElementById('benne-walkable-id') as HTMLSelectElement;
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;

    polygonEditBridge.setPropId('');
    walkSel.innerHTML = '';
    const polygons = room.walkable?.polygons;
    const safePolygons = Array.isArray(polygons) ? polygons : [];
    for (const p of safePolygons) {
        const optOuter = document.createElement('option');
        optOuter.value = encodeWalkableSelectValue({ polygonId: p.id, holeId: null });
        optOuter.textContent = `${p.id} (walkable)`;
        walkSel.appendChild(optOuter);
        for (const h of p.holes ?? []) {
            const optHole = document.createElement('option');
            optHole.value = encodeWalkableSelectValue({ polygonId: p.id, holeId: h.id });
            optHole.textContent = `${p.id} › ${h.id} (hole)`;
            walkSel.appendChild(optHole);
        }
    }
    if (walkSel.options.length > 0) {
        const d = decodeWalkableSelectValue(walkSel.value);
        if (d) {
            polygonEditBridge.setWalkableEditTarget(d.polygonId, d.holeId ?? '');
        }
    } else {
        polygonEditBridge.setWalkableEditTarget('', '');
    }

    const syncModeUI = (): void => {
        const m = modeSel.value as 'navigate' | 'walkable';
        polygonEditBridge.setMode(m);
        walkRow.hidden = m !== 'walkable';
        saveBtn.hidden = m === 'navigate';
    };

    modeSel.value = 'navigate';
    polygonEditBridge.setMode('navigate');
    syncModeUI();

    modeSel.addEventListener('change', () => {
        setStatus('');
        syncModeUI();
    });
    walkSel.addEventListener('change', () => {
        const d = decodeWalkableSelectValue(walkSel.value);
        if (d) {
            polygonEditBridge.setWalkableEditTarget(d.polygonId, d.holeId ?? '');
        }
        setStatus('');
    });
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wirePropTreeToolbarNonClickable(room: RoomData, propColliderId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildPropTreeNonClickableToolbarHtml(propColliderLabel(room, propColliderId));
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setMode('navigate');
}

function wirePropTreeToolbar(room: RoomData, propColliderId: string): void {
    if (!isPropColliderEditable(room, propColliderId)) {
        wirePropTreeToolbarNonClickable(room, propColliderId);
        return;
    }
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildPropTreeToolbarHtml(propColliderLabel(room, propColliderId));

    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId(propColliderId);
    polygonEditBridge.setMode('propCollider');

    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireToolbarFromPreviewState(room: RoomData, preview: PreviewToolbarPayload): void {
    if (preview.previewFocus === 'prop') {
        wirePropTreeToolbar(room, preview.propColliderId);
    } else {
        wireRoomToolbar(room);
    }
}

/** Sync Phaser registry room after disk save (integer-rounded points); avoids full game rebuild. */
function applyAppliedPatchToPreviewRoom(patch: RoomPolygonPatch): void {
    if (!game) {
        return;
    }
    const room = game.registry.get('bennePreviewRoom') as RoomData | undefined;
    if (!room) {
        return;
    }
    const src = patch.points;
    if (patch.kind === 'walkable') {
        const poly = room.walkable.polygons.find((p) => p.id === patch.polygonId);
        if (!poly) {
            return;
        }
        if (patch.holeId) {
            let hole = poly.holes?.find((h) => h.id === patch.holeId);
            if (!hole) {
                if (!poly.holes) {
                    poly.holes = [];
                }
                hole = { id: patch.holeId, active: true, points: [] };
                poly.holes.push(hole);
            }
            if (!hole.points) {
                hole.points = [];
            }
            const dest = hole.points;
            if (dest.length === src.length) {
                for (let i = 0; i < src.length; i++) {
                    dest[i].x = src[i].x;
                    dest[i].y = src[i].y;
                }
            } else {
                hole.points = src.map((p) => ({ x: p.x, y: p.y }));
            }
            return;
        }
        if (poly.points.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                poly.points[i].x = src[i].x;
                poly.points[i].y = src[i].y;
            }
        } else {
            poly.points = src.map((p) => ({ x: p.x, y: p.y }));
        }
        return;
    }
    const prop = room.props?.find((p) => p.id === patch.propId);
    if (!prop?.collider) {
        return;
    }
    const dest = prop.collider.points;
    if (dest.length === src.length) {
        for (let i = 0; i < src.length; i++) {
            dest[i].x = src[i].x;
            dest[i].y = src[i].y;
        }
    } else {
        prop.collider.points = src.map((p) => ({ x: p.x, y: p.y }));
    }
}

function showError(text: string): void {
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML = `<p style="color:#f88;padding:12px;font-family:system-ui,sans-serif;font-size:13px;">${escapeHtml(
            text,
        )}</p>`;
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function resetToPlaceholder(): Promise<void> {
    lastLoadedRoom = null;
    clearToolbar();
    await destroyPreviewGameAsync();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML =
            '<p style="color:#8892a6;padding:12px;font-family:system-ui,sans-serif;font-size:12px;">Select a room or prop to preview</p>';
    }
    currentRoomJsonUri = '';
}

/**
 * Serialize `clear` / `error` / `loadRoom` so they never overlap. A fire-and-forget `clear` could
 * otherwise finish after a concurrent `loadRoom` and wipe the canvas (e.g. after Refresh).
 */
let previewLifecycleChain: Promise<void> = Promise.resolve();

function enqueuePreviewLifecycle(work: () => Promise<void>): void {
    previewLifecycleChain = previewLifecycleChain
        .then(() => work())
        .catch((e) => {
            console.error('[Benne preview] lifecycle', e);
        });
}

type HostPreviewMessage = {
    type?: string;
    room?: RoomData;
    gameSrcWebviewUri?: string;
    roomJsonUri?: string;
    message?: string;
    ok?: boolean;
    appliedPatch?: RoomPolygonPatch;
    previewFocus?: string;
    propColliderId?: string;
};

async function runPreviewError(msg: HostPreviewMessage): Promise<void> {
    lastLoadedRoom = null;
    await destroyPreviewGameAsync();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML = '';
    }
    clearToolbar();
    showError(msg.message ?? 'Preview error');
}

async function runLoadRoom(msg: HostPreviewMessage): Promise<void> {
    if (!document.getElementById('benne-preview-root')?.parentElement) {
        return;
    }

    if (!msg.room || !msg.gameSrcWebviewUri) {
        showError('Missing room data or game root URI.');
        return;
    }

    if (typeof msg.roomJsonUri !== 'string' || msg.roomJsonUri.length === 0) {
        showError('Missing roomJsonUri (save to disk requires it).');
        return;
    }

    const gen = ++loadRoomGeneration;
    await destroyPreviewGameAsync();
    if (gen !== loadRoomGeneration) {
        return;
    }

    const root = document.getElementById('benne-preview-root');
    if (!root) {
        showError('Preview container missing.');
        return;
    }
    root.innerHTML = '';

    let room: RoomData;
    try {
        room = normalizeRoomForPreview(msg.room);
    } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
        return;
    }
    currentRoomJsonUri = msg.roomJsonUri;
    lastLoadedRoom = room;

    try {
        wireToolbarFromPreviewState(room, parsePreviewToolbarPayload(msg));
    } catch (e) {
        showError(
            `Preview toolbar: ${e instanceof Error ? e.message : String(e)}`,
        );
        return;
    }

    try {
        const manifest = await buildPreviewManifest(room, msg.gameSrcWebviewUri);
        const onPolygonPatch = (patch: RoomPolygonPatch): void => {
            vscodeApi?.postMessage({
                type: 'benne/preview/polygonPatch',
                roomJsonUri: currentRoomJsonUri,
                patch,
            });
        };
        game = createRoomPreviewPhaserGame(root, manifest, {
            roomJsonUri: currentRoomJsonUri,
            onPolygonPatch,
        });
    } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as HostPreviewMessage;

    if (msg?.type === 'benne/preview/polygonPatchResult') {
        if (msg.ok && msg.appliedPatch) {
            applyAppliedPatchToPreviewRoom(msg.appliedPatch);
        }
        setStatus(msg.ok ? 'Saved.' : `Error: ${msg.message ?? ''}`);
        return;
    }

    if (msg?.type === 'benne/preview/toolbarUi') {
        if (!lastLoadedRoom) {
            return;
        }
        wireToolbarFromPreviewState(lastLoadedRoom, parsePreviewToolbarPayload(msg));
        return;
    }

    if (msg?.type === 'benne/preview/clear') {
        enqueuePreviewLifecycle(async () => {
            await resetToPlaceholder();
        });
        return;
    }

    if (msg?.type === 'benne/preview/error') {
        enqueuePreviewLifecycle(async () => {
            await runPreviewError(msg);
        });
        return;
    }

    if (msg?.type === 'benne/preview/loadRoom') {
        enqueuePreviewLifecycle(async () => {
            await runLoadRoom(msg);
        });
        return;
    }
});

function wireRefreshPreviewButton(): void {
    const btn = document.getElementById('benne-refresh-preview');
    if (!btn || btn.dataset.benneRefreshWired === '1') {
        return;
    }
    btn.dataset.benneRefreshWired = '1';
    btn.addEventListener('click', () => {
        vscodeApi?.postMessage({
            type: 'benne/preview/requestRefresh',
            roomJsonUri: currentRoomJsonUri,
        });
    });
}

wireRefreshPreviewButton();
vscodeApi?.postMessage({ type: 'benne/preview/ready' });
