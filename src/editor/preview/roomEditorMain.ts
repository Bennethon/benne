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
}

function buildToolbarHtml(): string {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:#c8d0e0;font-size:12px;font-family:system-ui,sans-serif;">
      <div style="display:inline-flex;align-items:center;gap:6px;">
        <label for="benne-edit-mode">Mode</label>
        <select id="benne-edit-mode" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;">
          <option value="navigate">Navigate</option>
          <option value="walkable">Edit walkable</option>
          <option value="propCollider">Edit prop collider</option>
        </select>
      </div>
      <div id="benne-walkable-row" hidden style="align-items:center;gap:6px;display:inline-flex;">
        <label for="benne-walkable-id">Walkable/Holes</label>
        <select id="benne-walkable-id" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;max-width:280px;"></select>
      </div>
      <div id="benne-prop-row" hidden style="align-items:center;gap:6px;display:inline-flex;">
        <label for="benne-prop-id">Prop</label>
        <select id="benne-prop-id" style="background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;"></select>
      </div>
      <button type="button" id="benne-save-polygon" hidden style="background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div style="font-size:11px;opacity:0.75;margin-top:4px;">New polygon: click ${MIN_POLY_POINTS} times to place vertices. Then double-click an edge to add more. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).</div>
  `;
}

function wireToolbar(room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildToolbarHtml();

    const modeSel = document.getElementById('benne-edit-mode') as HTMLSelectElement;
    const walkRow = document.getElementById('benne-walkable-row')!;
    const propRow = document.getElementById('benne-prop-row')!;
    const walkSel = document.getElementById('benne-walkable-id') as HTMLSelectElement;
    const propSel = document.getElementById('benne-prop-id') as HTMLSelectElement;
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;

    walkSel.innerHTML = '';
    for (const p of room.walkable.polygons) {
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

    propSel.innerHTML = '';
    const propsWithCollider = (room.props ?? []).filter(
        (p) => p.collider?.points && p.collider.points.length >= MIN_POLY_POINTS,
    );
    for (const p of propsWithCollider) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.tag ? `${p.tag} (${p.id})` : p.id;
        propSel.appendChild(opt);
    }
    if (propSel.options.length > 0) {
        polygonEditBridge.setPropId(propSel.value);
    } else {
        polygonEditBridge.setPropId('');
    }

    const syncModeUI = (): void => {
        const m = modeSel.value as 'navigate' | 'walkable' | 'propCollider';
        polygonEditBridge.setMode(m);
        walkRow.hidden = m !== 'walkable';
        propRow.hidden = m !== 'propCollider';
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
    propSel.addEventListener('change', () => {
        polygonEditBridge.setPropId(propSel.value);
        setStatus('');
    });
    saveBtn.addEventListener('click', () => {
        setStatus('Saving…');
        window.dispatchEvent(new Event('benne-save-polygon'));
    });
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
    clearToolbar();
    await destroyPreviewGameAsync();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML =
            '<p style="color:#8892a6;padding:12px;font-family:system-ui,sans-serif;font-size:12px;">Select a room or prop to preview</p>';
    }
    currentRoomJsonUri = '';
}

window.addEventListener('message', async (event: MessageEvent) => {
    const msg = event.data as {
        type?: string;
        room?: RoomData;
        gameSrcWebviewUri?: string;
        roomJsonUri?: string;
        message?: string;
        ok?: boolean;
        appliedPatch?: RoomPolygonPatch;
    };

    if (msg?.type === 'benne/preview/polygonPatchResult') {
        if (msg.ok && msg.appliedPatch) {
            applyAppliedPatchToPreviewRoom(msg.appliedPatch);
        }
        setStatus(msg.ok ? 'Saved.' : `Error: ${msg.message ?? ''}`);
        return;
    }

    if (msg?.type === 'benne/preview/clear') {
        void resetToPlaceholder();
        return;
    }

    if (msg?.type === 'benne/preview/error') {
        await destroyPreviewGameAsync();
        const root = document.getElementById('benne-preview-root');
        if (root) {
            root.innerHTML = '';
        }
        clearToolbar();
        showError(msg.message ?? 'Preview error');
        return;
    }

    if (msg?.type !== 'benne/preview/loadRoom') {
        return;
    }

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

    const room = msg.room as RoomData;
    currentRoomJsonUri = msg.roomJsonUri;
    wireToolbar(room);

    try {
        const manifest = await buildPreviewManifest(room, msg.gameSrcWebviewUri);
        if (gen !== loadRoomGeneration) {
            return;
        }
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
        if (gen !== loadRoomGeneration) {
            return;
        }
        showError(e instanceof Error ? e.message : String(e));
    }
});

vscodeApi?.postMessage({ type: 'benne/preview/ready' });
