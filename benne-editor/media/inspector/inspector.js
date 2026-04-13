/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

/** BENNE Inspector webview (bundled for `media/inspector/inspector.js`). */
/// <reference lib="dom" />
Object.defineProperty(exports, "__esModule", ({ value: true }));
let vscodeApi = null;
try {
    vscodeApi = acquireVsCodeApi();
}
catch {
    /* */
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function post(action, payload) {
    vscodeApi?.postMessage({ action, ...payload });
}
function renderVerbChips(roomJsonUri, roomId, verbs, ctx) {
    void roomJsonUri;
    void roomId;
    return verbs
        .map((v) => {
        const def = v.defined;
        const icon = def ? '⚡' : '+';
        const cls = def ? 'verb-chip verb-defined' : 'verb-chip verb-add';
        const dataReveal = def ? `data-reveal="1" data-event="${esc(v.eventId)}"` : '';
        const dataAdd = !def && !v.isFallback ? `data-add="1" data-verb="${esc(v.verbId)}"` : '';
        return `<button type="button" class="${cls}" ${dataReveal} ${dataAdd} data-ctx="${esc(ctx)}" title="${esc(v.label)}">${icon} ${esc(v.verbId)}</button>`;
    })
        .join('');
}
function renderRoom(state) {
    const sz = state.size;
    const sb = state.scrollBounds;
    const exp = state.expanded;
    const walkRows = state.walkableRows
        .map((r) => {
        return `<tr>
        <td>${esc(r.kind)}</td>
        <td>${esc(r.id)}</td>
        <td><input type="checkbox" class="walk-active" data-polygon="${esc(r.polygonId)}" data-hole="${esc(r.holeId ?? '')}" data-kind="${esc(r.kind)}" data-row="${esc(r.id)}" ${r.active ? 'checked' : ''} /></td>
      </tr>`;
    })
        .join('');
    const polyOptions = state.walkableRows
        .filter((r) => r.kind === 'polygon')
        .map((r) => `<option value="${esc(r.polygonId)}">${esc(r.id)}</option>`)
        .join('');
    const propCards = state.props
        .map((p) => {
        const open = exp?.entity === 'prop' && exp.id === p.id;
        const verbHtml = p.clickable && p.verbs.length > 0
            ? `<div class="verb-row">${renderVerbChips(state.roomJsonUri, state.roomId, p.verbs, `prop:${p.id}`)}</div>`
            : '';
        return `<details class="card" ${open ? 'open' : ''} data-entity="prop" data-id="${esc(p.id)}">
      <summary><span class="tag">${esc(p.tag ?? p.id)}</span> <span class="muted">${esc(p.id)}</span></summary>
      <div class="card-body">
        <label class="row"><span>Visible</span><input type="checkbox" class="prop-visible" data-id="${esc(p.id)}" ${p.visible ? 'checked' : ''} /></label>
        <label class="row"><span>Clickable</span><input type="checkbox" class="prop-clickable" data-id="${esc(p.id)}" ${p.clickable ? 'checked' : ''} /></label>
        <label class="row">Description<textarea class="prop-desc" data-id="${esc(p.id)}" rows="2">${esc(p.description)}</textarea></label>
        <div class="row grid3">
          <label>zIndex <input type="number" class="prop-z" data-id="${esc(p.id)}" value="${p.zIndex}" /></label>
          <label>Parallax <input type="number" step="0.05" class="prop-par" data-id="${esc(p.id)}" value="${p.parallaxDepth}" /></label>
          <label>Alpha <input type="number" step="0.05" min="0" max="1" class="prop-alpha" data-id="${esc(p.id)}" value="${p.alpha}" /></label>
        </div>
        ${verbHtml}
        <div class="row actions">
          <button type="button" class="linkish" data-edit-preview="prop" data-id="${esc(p.id)}">Edit in Preview →</button>
          <button type="button" class="danger" data-delete="prop" data-id="${esc(p.id)}">Delete</button>
        </div>
      </div>
    </details>`;
    })
        .join('');
    const hotspotCards = state.hotspots
        .map((h) => {
        const open = exp?.entity === 'hotspot' && exp.id === h.id;
        const inactive = !h.active ? '<div class="banner">Inactive (not hit-tested)</div>' : '';
        const verbHtml = h.verbs.length > 0
            ? `<div class="verb-row">${renderVerbChips(state.roomJsonUri, state.roomId, h.verbs, `hotspot:${h.id}`)}</div>`
            : '';
        return `<details class="card" ${open ? 'open' : ''} data-entity="hotspot" data-id="${esc(h.id)}">
      <summary>${esc(h.description || h.id)} <span class="muted">${esc(h.id)}</span></summary>
      <div class="card-body">${inactive}
        <label class="row"><span>Active</span><input type="checkbox" class="hs-active" data-id="${esc(h.id)}" ${h.active ? 'checked' : ''} /></label>
        <label class="row">Description<textarea class="hs-desc" data-id="${esc(h.id)}" rows="2">${esc(h.description)}</textarea></label>
        <label class="row">zIndex <input type="number" class="hs-z" data-id="${esc(h.id)}" value="${h.zIndex}" /></label>
        ${verbHtml}
        <div class="row actions">
          <button type="button" class="linkish" data-edit-preview="hotspot" data-id="${esc(h.id)}">Edit in Preview →</button>
          <button type="button" class="danger" data-delete="hotspot" data-id="${esc(h.id)}">Delete</button>
        </div>
      </div>
    </details>`;
    })
        .join('');
    const charCards = state.characters
        .map((c) => {
        const open = exp?.entity === 'character' && exp.id === c.instanceId;
        const verbHtml = c.characterClickable && c.verbs.length > 0
            ? `<div class="verb-row">${renderVerbChips(state.roomJsonUri, state.roomId, c.verbs, `char:${c.instanceId}:${c.characterId}`)}</div>`
            : '';
        const clickHint = !c.characterClickable
            ? '<div class="banner">Character definition is not clickable — enable in character JSON first.</div>'
            : '';
        return `<details class="card" ${open ? 'open' : ''} data-entity="character" data-id="${esc(c.instanceId)}">
      <summary>${esc(c.characterId)} <span class="muted">${esc(c.instanceId)}</span></summary>
      <div class="card-body">${clickHint}
        <label class="row"><span>Visible</span><input type="checkbox" class="ch-visible" data-id="${esc(c.instanceId)}" ${c.visible ? 'checked' : ''} /></label>
        <div class="row grid2">
          <label>x <input type="number" class="ch-x" data-id="${esc(c.instanceId)}" value="${c.x}" /></label>
          <label>y <input type="number" class="ch-y" data-id="${esc(c.instanceId)}" value="${c.y}" /></label>
        </div>
        <label class="row">zIndex <input type="number" class="ch-z" data-id="${esc(c.instanceId)}" value="${c.zIndex}" /></label>
        <div class="row grid2">
          <label>initialFacing <input type="text" class="ch-face" data-id="${esc(c.instanceId)}" value="${esc(c.initialFacing ?? '')}" /></label>
          <label>initialAnimation <input type="text" class="ch-anim" data-id="${esc(c.instanceId)}" value="${esc(c.initialAnimation ?? '')}" /></label>
        </div>
        ${verbHtml}
        <div class="row actions">
          <button type="button" class="linkish" data-edit-preview="character" data-char-json="${esc(c.characterJsonUri)}" data-char-id="${esc(c.characterId)}">Edit in Preview →</button>
          <button type="button" class="danger" data-delete="character" data-id="${esc(c.instanceId)}">Delete</button>
        </div>
      </div>
    </details>`;
    })
        .join('');
    const pointCards = state.points
        .map((pt) => {
        const open = exp?.entity === 'point' && exp.id === pt.id;
        return `<details class="card" ${open ? 'open' : ''} data-entity="point" data-id="${esc(pt.id)}">
      <summary>${esc(pt.id)}</summary>
      <div class="card-body">
        <div class="row grid2">
          <label>x <input type="number" class="pt-x" data-id="${esc(pt.id)}" value="${pt.x}" /></label>
          <label>y <input type="number" class="pt-y" data-id="${esc(pt.id)}" value="${pt.y}" /></label>
        </div>
        <button type="button" class="danger" data-delete="point" data-id="${esc(pt.id)}">Delete</button>
      </div>
    </details>`;
    })
        .join('');
    const regionCards = state.regions
        .map((r) => {
        const open = exp?.entity === 'region' && exp.id === r.id;
        return `<details class="card" ${open ? 'open' : ''} data-entity="region" data-id="${esc(r.id)}">
      <summary>${esc(r.id)} <span class="muted">${r.pointCount} pts</span></summary>
      <div class="card-body">
        <label class="row"><span>Active</span><input type="checkbox" class="rg-active" data-id="${esc(r.id)}" ${r.active ? 'checked' : ''} /></label>
        <button type="button" class="danger" data-delete="region" data-id="${esc(r.id)}">Delete</button>
      </div>
    </details>`;
    })
        .join('');
    return `
<div class="inspector-root">
  <div class="scroll">
    <details class="section" open>
      <summary>Room metadata</summary>
      <div class="section-body">
        <label class="block">Display name <input type="text" id="fld-name" value="${esc(state.displayName)}" /></label>
        <div class="row">Room id <code class="badge">${esc(state.roomId)}</code></div>
        <div class="row grid2">
          <label>Width <input type="number" id="fld-w" value="${sz ? sz.width : ''}" placeholder="352" /></label>
          <label>Height <input type="number" id="fld-h" value="${sz ? sz.height : ''}" placeholder="198" /></label>
        </div>
        <button type="button" id="btn-fit-bg" ${state.canFitBackground ? '' : 'disabled'} title="Set room size from PNG background dimensions">Fit to background</button>
        <div class="muted small">Scroll bounds (leave blank to omit)</div>
        <div class="row grid4">
          <label>x <input type="number" id="sb-x" value="${sb ? sb.x : ''}" /></label>
          <label>y <input type="number" id="sb-y" value="${sb ? sb.y : ''}" /></label>
          <label>w <input type="number" id="sb-w" value="${sb ? sb.width : ''}" /></label>
          <label>h <input type="number" id="sb-h" value="${sb ? sb.height : ''}" /></label>
        </div>
        <button type="button" id="btn-clear-sb">Clear scroll bounds</button>
      </div>
    </details>

    <details class="section">
      <summary>Walkable areas</summary>
      <div class="section-body">
        <table class="grid">
          <thead><tr><th>Kind</th><th>Id</th><th>Active</th></tr></thead>
          <tbody>${walkRows || '<tr><td colspan="3" class="muted">None</td></tr>'}</tbody>
        </table>
        <div class="row wrap">
          <button type="button" id="btn-add-poly">Add walkable polygon</button>
          <button type="button" id="btn-add-hole">Add hole to</button>
          <select id="hole-parent">${polyOptions || '<option value="">(add polygon first)</option>'}</select>
        </div>
      </div>
    </details>

    <details class="section"><summary>Hotspots (${state.hotspots.length})</summary><div class="section-body cards">${hotspotCards || '<p class="muted">None</p>'}</div></details>
    <details class="section"><summary>Props (${state.props.length})</summary><div class="section-body cards">${propCards || '<p class="muted">None</p>'}</div></details>
    <details class="section"><summary>Spawned characters (${state.characters.length})</summary><div class="section-body cards">${charCards || '<p class="muted">None</p>'}</div></details>
    <details class="section"><summary>Points (${state.points.length})</summary><div class="section-body cards">${pointCards || '<p class="muted">None</p>'}</div></details>
    <details class="section"><summary>Regions (${state.regions.length})</summary><div class="section-body cards">${regionCards || '<p class="muted">None</p>'}</div></details>
  </div>
  <div class="footer">
    <button type="button" id="btn-save">Save</button>
    <button type="button" id="btn-open-json">Open raw JSON</button>
  </div>
</div>`;
}
function renderEmpty(msg) {
    return `<p class="empty">${esc(msg)}</p>`;
}
function collectRoomMeta() {
    const name = document.getElementById('fld-name')?.value ?? '';
    const wStr = document.getElementById('fld-w')?.value ?? '';
    const hStr = document.getElementById('fld-h')?.value ?? '';
    const w = wStr === '' ? null : Number(wStr);
    const h = hStr === '' ? null : Number(hStr);
    const sbx = document.getElementById('sb-x')?.value ?? '';
    const sby = document.getElementById('sb-y')?.value ?? '';
    const sbw = document.getElementById('sb-w')?.value ?? '';
    const sbh = document.getElementById('sb-h')?.value ?? '';
    return {
        type: 'roomMeta',
        displayName: name,
        size: w !== null && h !== null && Number.isFinite(w) && Number.isFinite(h) ? { width: w, height: h } : null,
        scrollBounds: sbx !== '' && sby !== '' && sbw !== '' && sbh !== ''
            ? {
                x: Number(sbx),
                y: Number(sby),
                width: Number(sbw),
                height: Number(sbh)
            }
            : null
    };
}
function mountHandlers(state) {
    const root = document.getElementById('benne-inspector-app');
    if (!root) {
        return;
    }
    const flushMeta = () => {
        post('applyPatches', { patches: [collectRoomMeta()] });
    };
    document.getElementById('btn-save')?.addEventListener('click', () => {
        flushMeta();
    });
    document.getElementById('btn-open-json')?.addEventListener('click', () => {
        post('openRawJson', { roomJsonUri: state.roomJsonUri });
    });
    document.getElementById('btn-fit-bg')?.addEventListener('click', () => {
        post('fitBackground', { roomJsonUri: state.roomJsonUri });
    });
    document.getElementById('btn-clear-sb')?.addEventListener('click', () => {
        post('applyPatches', { patches: [{ type: 'clearScrollBounds' }] });
    });
    document.getElementById('btn-add-poly')?.addEventListener('click', () => {
        post('applyPatches', { patches: [{ type: 'addWalkablePolygon' }] });
    });
    document.getElementById('btn-add-hole')?.addEventListener('click', () => {
        const sel = document.getElementById('hole-parent');
        const polygonId = sel?.value ?? '';
        if (!polygonId) {
            return;
        }
        post('applyPatches', { patches: [{ type: 'addWalkableHole', polygonId }] });
    });
    ['fld-name', 'fld-w', 'fld-h', 'sb-x', 'sb-y', 'sb-w', 'sb-h'].forEach((id) => {
        document.getElementById(id)?.addEventListener('blur', flushMeta);
    });
    root.querySelectorAll('.walk-active').forEach((el) => {
        el.addEventListener('change', (ev) => {
            const t = ev.target;
            post('applyPatches', {
                patches: [
                    {
                        type: 'walkableActive',
                        kind: t.dataset.kind,
                        polygonId: t.dataset.polygon,
                        holeId: t.dataset.hole,
                        rowId: t.dataset.row,
                        active: t.checked
                    }
                ]
            });
        });
    });
    const propPatch = (id, patch) => {
        post('applyPatches', { patches: [{ type: 'propField', id, ...patch }] });
    };
    root.querySelectorAll('.prop-desc').forEach((el) => {
        el.addEventListener('blur', () => {
            const ta = el;
            propPatch(ta.dataset.id ?? '', { description: ta.value });
        });
    });
    root.querySelectorAll('.prop-visible, .prop-clickable').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            const field = inp.classList.contains('prop-visible') ? 'visible' : 'clickable';
            propPatch(inp.dataset.id ?? '', { [field]: inp.checked });
        });
    });
    root.querySelectorAll('.prop-z, .prop-par, .prop-alpha').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            const id = inp.dataset.id ?? '';
            if (inp.classList.contains('prop-z')) {
                propPatch(id, { zIndex: Number(inp.value) });
            }
            else if (inp.classList.contains('prop-par')) {
                propPatch(id, { parallaxDepth: Number(inp.value) });
            }
            else {
                propPatch(id, { alpha: Number(inp.value) });
            }
        });
    });
    root.querySelectorAll('.hs-desc').forEach((el) => {
        el.addEventListener('blur', () => {
            const ta = el;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: ta.dataset.id, description: ta.value }] });
        });
    });
    root.querySelectorAll('.hs-active').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: inp.dataset.id, active: inp.checked }] });
        });
    });
    root.querySelectorAll('.hs-z').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: inp.dataset.id, zIndex: Number(inp.value) }] });
        });
    });
    root.querySelectorAll('.ch-visible').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            post('applyPatches', { patches: [{ type: 'characterField', instanceId: inp.dataset.id, visible: inp.checked }] });
        });
    });
    root.querySelectorAll('.ch-x, .ch-y, .ch-z, .ch-face, .ch-anim').forEach((el) => {
        el.addEventListener('blur', () => {
            const id = el.dataset.id;
            if (!id) {
                return;
            }
            const box = root.querySelector(`.ch-x[data-id="${id}"]`);
            const boy = root.querySelector(`.ch-y[data-id="${id}"]`);
            const bz = root.querySelector(`.ch-z[data-id="${id}"]`);
            const bf = root.querySelector(`.ch-face[data-id="${id}"]`);
            const ba = root.querySelector(`.ch-anim[data-id="${id}"]`);
            post('applyPatches', {
                patches: [
                    {
                        type: 'characterField',
                        instanceId: id,
                        x: Number(box?.value),
                        y: Number(boy?.value),
                        zIndex: Number(bz?.value),
                        initialFacing: bf?.value ?? '',
                        initialAnimation: ba?.value ?? ''
                    }
                ]
            });
        });
    });
    root.querySelectorAll('.pt-x, .pt-y').forEach((el) => {
        el.addEventListener('change', () => {
            const id = el.dataset.id;
            if (!id) {
                return;
            }
            const x = Number(root.querySelector(`.pt-x[data-id="${id}"]`)?.value);
            const y = Number(root.querySelector(`.pt-y[data-id="${id}"]`)?.value);
            post('applyPatches', { patches: [{ type: 'pointField', id, x, y }] });
        });
    });
    root.querySelectorAll('.rg-active').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el;
            post('applyPatches', { patches: [{ type: 'regionActive', id: inp.dataset.id, active: inp.checked }] });
        });
    });
    root.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.delete;
            const id = btn.dataset.id;
            if (!kind || !id || !confirm(`Delete ${kind} "${id}"?`)) {
                return;
            }
            post('applyPatches', { patches: [{ type: 'delete', entity: kind, id }] });
        });
    });
    root.querySelectorAll('[data-edit-preview]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.editPreview;
            if (kind === 'character') {
                const charJson = btn.dataset.charJson;
                const charId = btn.dataset.charId;
                post('editCharacterPreview', { characterJsonUri: charJson, characterId: charId });
            }
            else {
                const id = btn.dataset.id;
                post('editRoomPreview', { roomJsonUri: state.roomJsonUri, roomId: state.roomId, kind, id });
            }
        });
    });
    root.querySelectorAll('.verb-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const b = btn;
            const ctx = b.dataset.ctx ?? '';
            if (b.dataset.reveal) {
                post('verbReveal', {
                    roomJsonUri: state.roomJsonUri,
                    roomId: state.roomId,
                    eventId: b.dataset.event
                });
            }
            else if (b.dataset.add) {
                const verbId = b.dataset.verb ?? '';
                if (ctx.startsWith('prop:')) {
                    post('verbAdd', {
                        roomJsonUri: state.roomJsonUri,
                        roomId: state.roomId,
                        target: 'prop',
                        targetId: ctx.slice('prop:'.length),
                        verbId
                    });
                }
                else if (ctx.startsWith('hotspot:')) {
                    post('verbAdd', {
                        roomJsonUri: state.roomJsonUri,
                        roomId: state.roomId,
                        target: 'hotspot',
                        targetId: ctx.slice('hotspot:'.length),
                        verbId
                    });
                }
                else if (ctx.startsWith('char:')) {
                    const rest = ctx.slice('char:'.length);
                    const idx = rest.indexOf(':');
                    const characterId = idx >= 0 ? rest.slice(idx + 1) : '';
                    post('verbAdd', {
                        roomJsonUri: state.roomJsonUri,
                        roomId: state.roomId,
                        target: 'character',
                        characterId,
                        verbId
                    });
                }
            }
        });
    });
}
function render(state) {
    const root = document.getElementById('benne-inspector-app');
    if (!root) {
        return;
    }
    if (state.kind === 'empty') {
        root.innerHTML = renderEmpty(state.message);
        return;
    }
    root.innerHTML = renderRoom(state);
    mountHandlers(state);
}
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.type === 'benne/inspector/state' && msg.state) {
        render(msg.state);
    }
});
render({ kind: 'empty', message: 'Loading…' });

})();

/******/ })()
;