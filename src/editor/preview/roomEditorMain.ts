import type { Game } from 'phaser';
import type { RoomData } from '../../types/room';
import { buildPreviewManifest } from './buildPreviewManifest';
import { createRoomPreviewPhaserGame } from './createRoomPreviewGame';
import { polygonEditBridge } from './polygonEditBridge';
import type { RoomPolygonPatch } from './polygonPatchTypes';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

const MIN_POLY_POINTS = 3;

let game: Game | null = null;
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let currentRoomJsonUri = '';

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
      <label>Mode
        <select id="benne-edit-mode" style="margin-left:4px;background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;">
          <option value="navigate">Navigate</option>
          <option value="walkable">Edit walkable</option>
          <option value="propCollider">Edit prop collider</option>
        </select>
      </label>
      <label id="benne-walkable-wrap" style="display:none;">Polygon
        <select id="benne-walkable-id" style="margin-left:4px;background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;"></select>
      </label>
      <label id="benne-prop-wrap" style="display:none;">Prop
        <select id="benne-prop-id" style="margin-left:4px;background:#2a2a3e;color:#eee;border:1px solid #4a4a60;padding:2px 6px;"></select>
      </label>
      <button type="button" id="benne-save-polygon" style="display:none;background:#3d5a80;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Save to JSON</button>
      <span id="benne-polygon-status" style="opacity:0.85;"></span>
    </div>
    <div style="font-size:11px;opacity:0.75;margin-top:4px;">Double-click an edge to add a vertex. Delete removes the selected vertex (min ${MIN_POLY_POINTS} points).</div>
  `;
}

function wireToolbar(room: RoomData): void {
    const bar = document.getElementById('benne-polygon-toolbar');
    if (!bar) {
        return;
    }
    bar.innerHTML = buildToolbarHtml();

    const modeSel = document.getElementById('benne-edit-mode') as HTMLSelectElement;
    const walkWrap = document.getElementById('benne-walkable-wrap')!;
    const propWrap = document.getElementById('benne-prop-wrap')!;
    const walkSel = document.getElementById('benne-walkable-id') as HTMLSelectElement;
    const propSel = document.getElementById('benne-prop-id') as HTMLSelectElement;
    const saveBtn = document.getElementById('benne-save-polygon') as HTMLButtonElement;

    walkSel.innerHTML = '';
    for (const p of room.walkable.polygons) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.id;
        walkSel.appendChild(opt);
    }
    if (walkSel.options.length > 0) {
        polygonEditBridge.setWalkablePolygonId(walkSel.value);
    } else {
        polygonEditBridge.setWalkablePolygonId('');
    }

    propSel.innerHTML = '';
    const propsWithCollider = (room.props ?? []).filter(
        (p) => p.collider?.points && p.collider.points.length >= MIN_POLY_POINTS,
    );
    for (const p of propsWithCollider) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.id;
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
        walkWrap.style.display = m === 'walkable' ? '' : 'none';
        propWrap.style.display = m === 'propCollider' ? '' : 'none';
        saveBtn.style.display = m === 'navigate' ? 'none' : '';
    };

    modeSel.value = 'navigate';
    polygonEditBridge.setMode('navigate');
    syncModeUI();

    modeSel.addEventListener('change', () => {
        setStatus('');
        syncModeUI();
    });
    walkSel.addEventListener('change', () => {
        polygonEditBridge.setWalkablePolygonId(walkSel.value);
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

function resetToPlaceholder(): void {
    clearToolbar();
    const root = document.getElementById('benne-preview-root');
    if (root) {
        root.innerHTML =
            '<p style="color:#8892a6;padding:12px;font-family:system-ui,sans-serif;font-size:12px;">Select a room or prop to preview</p>';
    }
    if (game) {
        game.destroy(true);
        game = null;
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
    };

    if (msg?.type === 'benne/preview/polygonPatchResult') {
        setStatus(msg.ok ? 'Saved.' : `Error: ${msg.message ?? ''}`);
        return;
    }

    if (msg?.type === 'benne/preview/clear') {
        resetToPlaceholder();
        return;
    }

    if (msg?.type === 'benne/preview/error') {
        const root = document.getElementById('benne-preview-root');
        if (root) {
            root.innerHTML = '';
        }
        if (game) {
            game.destroy(true);
            game = null;
        }
        clearToolbar();
        showError(msg.message ?? 'Preview error');
        return;
    }

    if (msg?.type !== 'benne/preview/loadRoom') {
        return;
    }

    const root = document.getElementById('benne-preview-root');
    if (!root) {
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

    root.innerHTML = '';
    if (game) {
        game.destroy(true);
        game = null;
    }

    const room = msg.room as RoomData;
    currentRoomJsonUri = msg.roomJsonUri;
    wireToolbar(room);

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
});

vscodeApi?.postMessage({ type: 'benne/preview/ready' });
