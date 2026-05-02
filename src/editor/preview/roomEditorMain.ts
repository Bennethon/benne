import type { Game } from 'phaser';
import type { RoomScene } from '../../engine/scenes/RoomScene';
import type { RoomData } from '../../types/room';
import { SCENE_ROOM } from '../../game/constants';
import { buildPreviewManifest } from './buildPreviewManifest';
import { createRoomPreviewPhaserGame } from './createRoomPreviewGame';
import { guiVisibilityBridge } from './guiVisibilityBridge';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { registerInventoryDefinitionsFromGame } from '../../game/registerInventoryDefinitions';

// Mirror the GUI preview bundle: populate the engine's inventory registry so the room preview can
// queue `inventoryPanel` Aseprite sheets and honour `stackable` semantics for any Bennescript code
// that happens to run during preview.
registerInventoryDefinitionsFromGame();

declare function acquireVsCodeApi(): {
    postMessage(data: unknown): void;
    getState<T = unknown>(): T | undefined;
    setState<T = unknown>(state: T): void;
};

type PreviewWebviewState = {
    showGuis?: boolean;
};

const MIN_POLY_POINTS = 3;

let game: Game | null = null;
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let currentRoomJsonUri = '';
/** Latest room from the host; used for `toolbarUi` updates without reloading Phaser. */
let lastLoadedRoom: RoomData | null = null;

type PreviewToolbarPayload =
    | { previewFocus: 'room' }
    | { previewFocus: 'walkable'; walkablePolygonId: string; walkableHoleId: string }
    | { previewFocus: 'roomSize' }
    | { previewFocus: 'scrollBounds' }
    | { previewFocus: 'prop'; propColliderId: string }
    | { previewFocus: 'hotspot'; hotspotId: string }
    | { previewFocus: 'region'; regionId: string }
    | { previewFocus: 'roomPoint'; roomPointId: string };

function parsePreviewToolbarPayload(msg: {
    previewFocus?: string;
    propColliderId?: string;
    hotspotId?: string;
    regionId?: string;
    roomPointId?: string;
    walkablePolygonId?: string;
    walkableHoleId?: string;
}): PreviewToolbarPayload {
    if (
        msg.previewFocus === 'prop' &&
        typeof msg.propColliderId === 'string' &&
        msg.propColliderId.length > 0
    ) {
        return { previewFocus: 'prop', propColliderId: msg.propColliderId };
    }
    if (
        msg.previewFocus === 'hotspot' &&
        typeof msg.hotspotId === 'string' &&
        msg.hotspotId.length > 0
    ) {
        return { previewFocus: 'hotspot', hotspotId: msg.hotspotId };
    }
    if (
        msg.previewFocus === 'region' &&
        typeof msg.regionId === 'string' &&
        msg.regionId.length > 0
    ) {
        return { previewFocus: 'region', regionId: msg.regionId };
    }
    if (
        msg.previewFocus === 'roomPoint' &&
        typeof msg.roomPointId === 'string' &&
        msg.roomPointId.length > 0
    ) {
        return { previewFocus: 'roomPoint', roomPointId: msg.roomPointId };
    }
    if (
        msg.previewFocus === 'walkable' &&
        typeof msg.walkablePolygonId === 'string' &&
        msg.walkablePolygonId.length > 0
    ) {
        const hid = typeof msg.walkableHoleId === 'string' ? msg.walkableHoleId : '';
        return { previewFocus: 'walkable', walkablePolygonId: msg.walkablePolygonId, walkableHoleId: hid };
    }
    if (msg.previewFocus === 'roomSize') {
        return { previewFocus: 'roomSize' };
    }
    if (msg.previewFocus === 'scrollBounds') {
        return { previewFocus: 'scrollBounds' };
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

function hotspotToolbarLabel(room: RoomData, hotspotId: string): string {
    const h = room.hotspots?.find((x) => x.id === hotspotId);
    if (!h) {
        return hotspotId;
    }
    if (h.description && h.description.trim()) {
        return `${h.description.trim()} (${hotspotId})`;
    }
    return hotspotId;
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

/**
 * Rehydrate the "Show GUIs" toggle from webview state (`vscode.getState()`) on first load. Default
 * off: polygon / walkable authoring usually wants a clean view, and authors opt in per the confirmed
 * UX (`docs/architecture.md` room preview spec).
 */
(function loadPersistedGuiVisibility(): void {
    try {
        const s = vscodeApi?.getState<PreviewWebviewState>();
        if (s && typeof s.showGuis === 'boolean') {
            guiVisibilityBridge.setVisible(s.showGuis);
        }
    } catch {
        /* ignore — first ever load or unavailable state */
    }
})();

function persistWebviewState(): void {
    try {
        vscodeApi?.setState<PreviewWebviewState>({ showGuis: guiVisibilityBridge.visible });
    } catch {
        /* ignore */
    }
}

function wireShowGuisToggle(): void {
    const input = document.getElementById('benne-show-guis-toggle') as HTMLInputElement | null;
    if (!input || input.dataset.benneShowGuisWired === '1') {
        return;
    }
    input.dataset.benneShowGuisWired = '1';
    input.checked = guiVisibilityBridge.visible;
    input.addEventListener('change', () => {
        const next = !!input.checked;
        guiVisibilityBridge.setVisible(next);
        persistWebviewState();
        applyGuiVisibilityToRunningScene(next);
    });
    // Keep the checkbox in sync when other code flips the bridge (e.g. future programmatic toggles).
    guiVisibilityBridge.subscribe((visible) => {
        if (input.checked !== visible) {
            input.checked = visible;
        }
    });
}

function applyGuiVisibilityToRunningScene(visible: boolean): void {
    if (!game) {
        return;
    }
    const scene = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
    if (!scene || !scene.scene.isActive()) {
        return;
    }
    scene.setGenericGuisVisible(visible);
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
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setWalkableEditTarget('', '');
}

function buildRoomNavigateToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.55;margin-top:4px;"></div>
  `;
}

function walkableToolbarTitle(polygonId: string, holeId: string): string {
    if (holeId.length > 0) {
        return `Hole — ${polygonId} › ${holeId}`;
    }
    return `Walkable — ${polygonId}`;
}

function buildWalkableEditToolbarHtml(polygonId: string, holeId: string): string {
    const title = walkableToolbarTitle(polygonId, holeId);
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">${escapeHtml(title)}</span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">New polygon: click ${MIN_POLY_POINTS} times to place vertices. Then double-click an edge to add more. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).</div>
  `;
}

function buildRoomSizeToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;"><strong style="color:#e8ecff;">Room size</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Drag the cyan handles to resize the room art canvas. The origin (top-left) is always 0,0. Press F to fit view. Save writes to room JSON.</div>
  `;
}

function buildScrollBoundsToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;"><strong style="color:#e8ecff;">Scroll bounds</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Drag the orange handles to set the camera scroll bounds — the area within which the camera pans. Press F to fit view. Save writes to room JSON.</div>
  `;
}

function buildPropTreeToolbarHtml(propLabel: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Prop — <strong style="color:#e8ecff;">${escapeHtml(propLabel)}</strong> (collider, walk, look)</span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Collider (magenta), cyan <strong>Walk to</strong>, amber <strong>Look at</strong>. New collider: click ${MIN_POLY_POINTS} times, then double-click edges. Delete removes a selected collider vertex only.</div>
  `;
}

function buildHotspotToolbarHtml(label: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Hotspot — <strong style="color:#e8ecff;">${escapeHtml(label)}</strong> (polygon, walk, look)</span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Orange polygon, cyan <strong>Walk to</strong>, amber <strong>Look at</strong>. Place ${MIN_POLY_POINTS}+ vertices like prop colliders; double-click an edge to add a vertex.</div>
  `;
}

function buildRegionToolbarHtml(regionId: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Region — <strong style="color:#e8ecff;">${escapeHtml(regionId)}</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Green polygon. New shape: click ${MIN_POLY_POINTS} times, then double-click edges to add vertices. Delete removes a selected vertex (min ${MIN_POLY_POINTS}).</div>
  `;
}

function buildRoomPointToolbarHtml(pointId: string): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <span style="opacity:0.95;">Point — <strong style="color:#e8ecff;">${escapeHtml(pointId)}</strong></span>
      <button type="button" id="benne-save-polygon" style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div id="benne-toolbar-hint" style="font-size:11px;opacity:0.75;margin-top:4px;">Drag the handle to move this point. Save writes integer <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">x</code> / <code style="background:#2a2a3e;padding:1px 4px;border-radius:3px;">y</code> to JSON.</div>
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
    r.points = Array.isArray(r.points) ? r.points : [];
    r.regions = Array.isArray(r.regions) ? r.regions : [];
    r.props = Array.isArray(r.props) ? r.props : [];
    r.characters = Array.isArray(r.characters) ? r.characters : [];
    return r as unknown as RoomData;
}

function wireRoomNavigateToolbar(_room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomNavigateToolbarHtml();
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setMode('navigate');
}

function wireWalkableEditToolbar(room: RoomData, polygonId: string, holeId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildWalkableEditToolbarHtml(polygonId, holeId);
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    const poly = room.walkable?.polygons?.find((p) => p.id === polygonId);
    if (!poly) {
        polygonEditBridge.setWalkableEditTarget('', '');
        polygonEditBridge.setMode('navigate');
        setStatus(`Walkable polygon "${polygonId}" not found in room JSON.`);
        return;
    }
    if (holeId.length > 0) {
        const hole = poly.holes?.find((h) => h.id === holeId);
        if (!hole) {
            polygonEditBridge.setWalkableEditTarget('', '');
            polygonEditBridge.setMode('navigate');
            setStatus(`Hole "${holeId}" not found under polygon "${polygonId}".`);
            return;
        }
    }
    polygonEditBridge.setWalkableEditTarget(polygonId, holeId);
    polygonEditBridge.setMode('walkable');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireRoomSizeToolbar(_room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomSizeToolbarHtml();
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setMode('roomSize');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireScrollBoundsToolbar(_room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildScrollBoundsToolbarHtml();
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setMode('scrollBounds');
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
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setMode('navigate');
}

function wireHotspotToolbar(room: RoomData, hotspotId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildHotspotToolbarHtml(hotspotToolbarLabel(room, hotspotId));
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setHotspotId(hotspotId);
    polygonEditBridge.setMode('hotspotPolygon');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireRegionToolbar(_room: RoomData, regionId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRegionToolbarHtml(regionId);
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRoomPointId('');
    polygonEditBridge.setRegionId(regionId);
    polygonEditBridge.setMode('regionPolygon');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
}

function wireRoomPointToolbar(_room: RoomData, roomPointId: string): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildRoomPointToolbarHtml(roomPointId);
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;
    polygonEditBridge.setWalkableEditTarget('', '');
    polygonEditBridge.setPropId('');
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId(roomPointId);
    polygonEditBridge.setMode('roomPoint');
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
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
    polygonEditBridge.setHotspotId('');
    polygonEditBridge.setRegionId('');
    polygonEditBridge.setRoomPointId('');
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
    } else if (preview.previewFocus === 'hotspot') {
        wireHotspotToolbar(room, preview.hotspotId);
    } else if (preview.previewFocus === 'region') {
        wireRegionToolbar(room, preview.regionId);
    } else if (preview.previewFocus === 'roomPoint') {
        wireRoomPointToolbar(room, preview.roomPointId);
    } else if (preview.previewFocus === 'walkable') {
        wireWalkableEditToolbar(room, preview.walkablePolygonId, preview.walkableHoleId);
    } else if (preview.previewFocus === 'roomSize') {
        wireRoomSizeToolbar(room);
    } else if (preview.previewFocus === 'scrollBounds') {
        wireScrollBoundsToolbar(room);
    } else {
        wireRoomNavigateToolbar(room);
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
    if (patch.kind === 'roomPoint') {
        const p = room.points?.find((x) => x.id === patch.pointId);
        if (p) {
            p.x = patch.x;
            p.y = patch.y;
        }
        return;
    }
    if (patch.kind === 'roomSize') {
        room.size = { width: patch.width, height: patch.height };
        // Re-sync camera so the edit-mode zoom adjusts to the new room dimensions.
        polygonEditBridge.setMode(polygonEditBridge.mode);
        return;
    }
    if (patch.kind === 'scrollBounds') {
        room.scrollBounds = { x: patch.x, y: patch.y, width: patch.width, height: patch.height };
        // Re-sync camera so the scroll bounds update takes effect.
        polygonEditBridge.setMode(polygonEditBridge.mode);
        return;
    }
    if (patch.kind === 'walkable') {
        const src = patch.points;
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
                hole.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
            }
            return;
        }
        if (poly.points.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                poly.points[i].x = src[i].x;
                poly.points[i].y = src[i].y;
            }
        } else {
            poly.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        return;
    }
    if (patch.kind === 'regionPolygon') {
        const src = patch.points;
        const reg = room.regions?.find((r) => r.id === patch.regionId);
        if (!reg) {
            return;
        }
        if (reg.points.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                reg.points[i].x = src[i].x;
                reg.points[i].y = src[i].y;
            }
        } else {
            reg.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        return;
    }
    if (patch.kind === 'hotspotPolygon') {
        const src = patch.points;
        const hs = room.hotspots?.find((h) => h.id === patch.hotspotId);
        if (!hs) {
            return;
        }
        if (!hs.points) {
            hs.points = [];
        }
        const dest = hs.points;
        if (dest.length === src.length) {
            for (let i = 0; i < src.length; i++) {
                dest[i].x = src[i].x;
                dest[i].y = src[i].y;
            }
        } else {
            hs.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
        }
        hs.walkToPoint = { x: patch.walkToPoint.x, y: patch.walkToPoint.y };
        hs.lookAtPoint = { x: patch.lookAtPoint.x, y: patch.lookAtPoint.y };
        if (patch.baseline !== undefined && Number.isFinite(patch.baseline)) {
            (hs as { baseline?: number }).baseline = patch.baseline;
        }
        return;
    }
    const src = patch.points;
    const prop = room.props?.find((p) => p.id === patch.propId);
    if (!prop) {
        return;
    }
    if (!prop.collider) {
        prop.collider = { points: [] };
    }
    const dest = prop.collider.points;
    if (dest.length === src.length) {
        for (let i = 0; i < src.length; i++) {
            dest[i].x = src[i].x;
            dest[i].y = src[i].y;
        }
    } else {
        prop.collider.points = src.map((pt) => ({ x: pt.x, y: pt.y }));
    }
    prop.walkToPoint = { x: patch.walkToPoint.x, y: patch.walkToPoint.y };
    prop.lookAtPoint = { x: patch.lookAtPoint.x, y: patch.lookAtPoint.y };
    if (patch.baseline !== undefined && Number.isFinite(patch.baseline)) {
        (prop as { baseline?: number }).baseline = patch.baseline;
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
    hotspotId?: string;
    regionId?: string;
    roomPointId?: string;
    walkablePolygonId?: string;
    walkableHoleId?: string;
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
    const stack = document.createElement('div');
    stack.style.cssText = 'position:relative;width:100%;height:100%;min-height:0';
    const phaserMount = document.createElement('div');
    phaserMount.style.cssText = 'width:100%;height:100%';
    stack.appendChild(phaserMount);
    root.appendChild(stack);

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
        game = createRoomPreviewPhaserGame(phaserMount, manifest, {
            roomJsonUri: currentRoomJsonUri,
            onPolygonPatch,
            initialShowGuis: guiVisibilityBridge.visible,
        });
        vscodeApi?.postMessage({ type: 'benne/preview/roomLoadComplete', roomJsonUri: currentRoomJsonUri });
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

    if (msg?.type === 'benne/preview/inspectorFocus') {
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
wireShowGuisToggle();
vscodeApi?.postMessage({ type: 'benne/preview/ready' });
