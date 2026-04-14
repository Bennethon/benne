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
/** Avoid re-scrolling when the same tree item stays selected but room state `rev` bumps. */
let lastInspectorScrollRoomUri = null;
let lastInspectorScrollExpandedKey = null;
/** Last room URI we preserved accordion state for (same file, new `rev`). */
let lastInspectorPreserveRoomUri = null;
function captureInspectorOpenState(root) {
    const scroll = root.querySelector('.scroll');
    if (!scroll) {
        return null;
    }
    const sections = [];
    scroll.querySelectorAll(':scope > details.section').forEach((el) => {
        if (el instanceof HTMLDetailsElement) {
            sections.push(el.open);
        }
    });
    const items = {};
    scroll.querySelectorAll('details.benne-inspector-item').forEach((node) => {
        if (!(node instanceof HTMLDetailsElement)) {
            return;
        }
        const entity = node.dataset.entity;
        const id = node.dataset.id;
        if (entity && id) {
            items[`${entity}\0${id}`] = node.open;
        }
    });
    return { sections, items };
}
function restoreInspectorOpenState(root, captured) {
    const scroll = root.querySelector('.scroll');
    if (!scroll) {
        return;
    }
    const sectionEls = scroll.querySelectorAll(':scope > details.section');
    for (let i = 0; i < captured.sections.length && i < sectionEls.length; i++) {
        const el = sectionEls.item(i);
        if (el instanceof HTMLDetailsElement) {
            el.open = captured.sections[i];
        }
    }
    scroll.querySelectorAll('details.benne-inspector-item').forEach((node) => {
        if (!(node instanceof HTMLDetailsElement)) {
            return;
        }
        const entity = node.dataset.entity;
        const id = node.dataset.id;
        if (!entity || !id) {
            return;
        }
        const key = `${entity}\0${id}`;
        if (Object.prototype.hasOwnProperty.call(captured.items, key)) {
            node.open = captured.items[key];
        }
    });
}
function scrollExpandedCardIntoView(state) {
    if (state.roomJsonUri !== lastInspectorScrollRoomUri) {
        lastInspectorScrollRoomUri = state.roomJsonUri;
        lastInspectorScrollExpandedKey = null;
    }
    const ex = state.expanded;
    if (!ex) {
        return;
    }
    const key = `${ex.entity}\0${ex.id}`;
    if (key === lastInspectorScrollExpandedKey) {
        return;
    }
    lastInspectorScrollExpandedKey = key;
    const run = () => {
        let item = null;
        const nodes = document.querySelectorAll('.benne-inspector-item');
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes.item(i);
            if (el instanceof HTMLElement && el.dataset.entity === ex.entity && el.dataset.id === ex.id) {
                item = el;
                break;
            }
        }
        if (!item) {
            return;
        }
        const section = item.closest('details.section');
        if (section && !section.hasAttribute('open')) {
            section.setAttribute('open', '');
        }
        if (!item.hasAttribute('open')) {
            item.setAttribute('open', '');
        }
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    requestAnimationFrame(run);
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function post(action, payload) {
    vscodeApi?.postMessage({ action, ...payload });
}
function inspectorItemExpanded(state, entity, id) {
    const ex = state.expanded;
    return !!(ex && ex.entity === entity && ex.id === id);
}
function renderInspectorItem(state, entity, id, cardModifierClasses, summaryInnerHtml, bodyInnerHtml) {
    const open = inspectorItemExpanded(state, entity, id) ? ' open' : '';
    return `<details class="benne-inspector-item benne-card${cardModifierClasses}" data-entity="${esc(entity)}" data-id="${esc(id)}"${open}>
  <summary class="benne-inspector-item-summary">${summaryInnerHtml}</summary>
  <div class="benne-inspector-item-body">${bodyInnerHtml}</div>
</details>`;
}
function renderVerbChipRow(roomJsonUri, roomId, verbs, ctx) {
    void roomJsonUri;
    void roomId;
    if (verbs.length === 0) {
        return '<div class="benne-verb-chips benne-verb-chips--empty"><span class="muted small">No verbs</span></div>';
    }
    const inner = verbs
        .map((v) => {
        const def = v.defined;
        const icon = def ? '⚡' : '+';
        const cls = def ? 'verb-chip verb-defined' : 'verb-chip verb-add';
        const dataReveal = def ? `data-reveal="1" data-event="${esc(v.eventId)}"` : '';
        const dataAdd = !def && !v.isFallback ? `data-add="1" data-verb="${esc(v.verbId)}"` : '';
        return `<button type="button" class="${cls}" ${dataReveal} ${dataAdd} data-ctx="${esc(ctx)}" title="${esc(v.label)}"><span class="verb-chip-glyph" aria-hidden="true">${icon}</span><span class="verb-chip-txt">${esc(v.verbId)}</span></button>`;
    })
        .join('');
    return `<div class="benne-verb-chips">${inner}</div>`;
}
function renderRoom(state) {
    const sz = state.size;
    const sb = state.scrollBounds;
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
        const title = esc(p.tag ?? p.id);
        const verbHtml = renderVerbChipRow(state.roomJsonUri, state.roomId, p.verbs, `prop:${p.id}`);
        const propClickableCls = p.clickable ? ' benne-card--prop-clickable' : '';
        const propActions = p.clickable
            ? `<div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="prop" data-id="${esc(p.id)}">Edit in Preview →</button>
        </div>
        <button type="button" class="btn-danger" data-delete="prop" data-id="${esc(p.id)}">Delete</button>
      </div>`
            : `<div class="benne-card-actions benne-card-actions--end">
        <button type="button" class="btn-danger" data-delete="prop" data-id="${esc(p.id)}">Delete</button>
      </div>`;
        const summary = `<div class="benne-card-titles">
          <div class="benne-card-title tag">${title}</div>
          <div class="benne-card-sub muted">${esc(p.id)}</div>
        </div>`;
        const body = `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">Visible</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="prop-visible" data-id="${esc(p.id)}" ${p.visible ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">zIndex</span>
        <input type="number" class="prop-z" data-id="${esc(p.id)}" value="${p.zIndex}" />
        <span class="benne-pg-lbl">Parallax</span>
        <input type="number" step="0.05" class="prop-par" data-id="${esc(p.id)}" value="${p.parallaxDepth}" />
        <span class="benne-pg-lbl">Alpha</span>
        <input type="number" step="0.05" min="0" max="1" class="prop-alpha" data-id="${esc(p.id)}" value="${p.alpha}" />
        <span class="benne-pg-lbl">Clickable</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="prop-clickable" data-id="${esc(p.id)}" ${p.clickable ? 'checked' : ''} /></label>
      </div>
      <label class="benne-field-label muted small">Description</label>
      <textarea class="benne-card-desc prop-desc" data-id="${esc(p.id)}" rows="2" title="${esc(p.description)}">${esc(p.description)}</textarea>
      <label class="benne-field-label muted small">Verbs</label>
      ${verbHtml}
      ${propActions}`;
        return renderInspectorItem(state, 'prop', p.id, ` benne-card--prop${propClickableCls}`, summary, body);
    })
        .join('');
    const hotspotCards = state.hotspots
        .map((h) => {
        const inactive = !h.active ? '<div class="banner">Inactive (not hit-tested)</div>' : '';
        const verbHtml = renderVerbChipRow(state.roomJsonUri, state.roomId, h.verbs, `hotspot:${h.id}`);
        const headTitle = esc(h.description.trim() ? h.description.trim() : h.id);
        const summary = `<div class="benne-card-titles">
          <div class="benne-card-title">${headTitle}</div>
          <div class="benne-card-sub muted">${esc(h.id)}</div>
        </div>`;
        const body = `${inactive}
      <div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">Active</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="hs-active" data-id="${esc(h.id)}" ${h.active ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">zIndex</span>
        <input type="number" class="hs-z" data-id="${esc(h.id)}" value="${h.zIndex}" />
      </div>
      <label class="benne-field-label muted small">Description</label>
      <textarea class="benne-card-desc hs-desc" data-id="${esc(h.id)}" rows="2" title="${esc(h.description)}">${esc(h.description)}</textarea>
      <label class="benne-field-label muted small">Verbs</label>
      ${verbHtml}
      <div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="hotspot" data-id="${esc(h.id)}">Edit in Preview →</button>
        </div>
        <button type="button" class="btn-danger" data-delete="hotspot" data-id="${esc(h.id)}">Delete</button>
      </div>`;
        return renderInspectorItem(state, 'hotspot', h.id, ' benne-card--hotspot', summary, body);
    })
        .join('');
    const charCards = state.characters
        .map((c) => {
        const verbHtml = renderVerbChipRow(state.roomJsonUri, state.roomId, c.verbs, `char:${c.instanceId}:${c.characterId}`);
        const clickHint = !c.characterClickable
            ? '<div class="banner">Character definition is not clickable — enable in character JSON first.</div>'
            : '';
        const summary = `<div class="benne-card-titles">
          <div class="benne-card-title">${esc(c.characterId)}</div>
          <div class="benne-card-sub muted">${esc(c.instanceId)}</div>
        </div>`;
        const body = `${clickHint}
      <div class="benne-dim-grid" role="group" aria-label="Position">
        <span class="benne-dim-lbl">X</span>
        <input type="number" class="ch-x" data-id="${esc(c.instanceId)}" value="${c.x}" />
        <span class="benne-dim-lbl">Y</span>
        <input type="number" class="ch-y" data-id="${esc(c.instanceId)}" value="${c.y}" />
      </div>
      <div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">Visible</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="ch-visible" data-id="${esc(c.instanceId)}" ${c.visible ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">Clickable</span>
        <label class="benne-pg-check benne-inline-check" title="Defined in character JSON"><input type="checkbox" ${c.characterClickable ? 'checked' : ''} disabled /></label>
        <span class="benne-pg-lbl">zIndex</span>
        <input type="number" class="ch-z" data-id="${esc(c.instanceId)}" value="${c.zIndex}" />
        <span class="benne-pg-lbl">Facing</span>
        <input type="text" class="ch-face" data-id="${esc(c.instanceId)}" value="${esc(c.initialFacing ?? '')}" />
        <span class="benne-pg-lbl">Animation</span>
        <input type="text" class="ch-anim" data-id="${esc(c.instanceId)}" value="${esc(c.initialAnimation ?? '')}" />
      </div>
      ${verbHtml}
      <div class="benne-card-actions benne-card-actions--end">
        <button type="button" class="btn-danger" data-delete="character" data-id="${esc(c.instanceId)}">Delete</button>
      </div>`;
        return renderInspectorItem(state, 'character', c.instanceId, ' benne-card--character', summary, body);
    })
        .join('');
    const pointCards = state.points
        .map((pt) => {
        const summary = `<div class="benne-card-titles">
          <div class="benne-card-title">${esc(pt.id)}</div>
          <div class="benne-card-sub muted">Room point</div>
        </div>`;
        const body = `<div class="benne-dim-grid" role="group" aria-label="Position">
        <span class="benne-dim-lbl">X</span>
        <input type="number" class="pt-x" data-id="${esc(pt.id)}" value="${pt.x}" />
        <span class="benne-dim-lbl">Y</span>
        <input type="number" class="pt-y" data-id="${esc(pt.id)}" value="${pt.y}" />
      </div>
      <div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="point" data-id="${esc(pt.id)}">Edit in Preview →</button>
        </div>
        <button type="button" class="btn-danger" data-delete="point" data-id="${esc(pt.id)}">Delete</button>
      </div>`;
        return renderInspectorItem(state, 'point', pt.id, ' benne-card--point', summary, body);
    })
        .join('');
    const regionCards = state.regions
        .map((r) => {
        const summary = `<div class="benne-card-titles">
          <div class="benne-card-title">${esc(r.id)}</div>
          <div class="benne-card-sub muted">${r.pointCount} points</div>
        </div>`;
        const body = `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">Active</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="rg-active" data-id="${esc(r.id)}" ${r.active ? 'checked' : ''} /></label>
      </div>
      <div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="region" data-id="${esc(r.id)}">Edit in Preview →</button>
        </div>
        <button type="button" class="btn-danger" data-delete="region" data-id="${esc(r.id)}">Delete</button>
      </div>`;
        return renderInspectorItem(state, 'region', r.id, ' benne-card--region', summary, body);
    })
        .join('');
    return `
<div class="inspector-root">
  <div class="scroll">
    <details class="section" open>
      <summary>Room metadata</summary>
      <div class="section-body">
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">Display name</span>
          <input type="text" id="fld-name" value="${esc(state.displayName)}" />
          <span class="benne-pg-lbl">Room ID</span>
          <div class="benne-pg-val"><code class="badge">${esc(state.roomId)}</code></div>
        </div>
        <div class="benne-room-size-hint muted small">Room size</div>
        <div class="benne-dim-grid" role="group" aria-label="Room size">
          <span class="benne-dim-lbl">W</span>
          <input type="number" id="fld-w" value="${sz ? sz.width : ''}" placeholder="352" />
          <span class="benne-dim-lbl">H</span>
          <input type="number" id="fld-h" value="${sz ? sz.height : ''}" placeholder="198" />
        </div>
        <button type="button" class="btn-secondary" id="btn-fit-bg" ${state.canFitBackground ? '' : 'disabled'} title="Set room size from PNG background dimensions">Fit to background</button>
        <div class="benne-scroll-bounds-label muted small">Scroll bounds (leave blank to omit)</div>
        <div class="benne-dim-grid" role="group" aria-label="Scroll bounds">
          <span class="benne-dim-lbl">X</span>
          <input type="number" id="sb-x" value="${sb ? sb.x : ''}" />
          <span class="benne-dim-lbl">Y</span>
          <input type="number" id="sb-y" value="${sb ? sb.y : ''}" />
          <span class="benne-dim-lbl">W</span>
          <input type="number" id="sb-w" value="${sb ? sb.width : ''}" />
          <span class="benne-dim-lbl">H</span>
          <input type="number" id="sb-h" value="${sb ? sb.height : ''}" />
        </div>
        <button type="button" class="btn-secondary" id="btn-clear-sb">Clear scroll bounds</button>
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
          <button type="button" class="btn-secondary" id="btn-add-poly">Add walkable polygon</button>
          <button type="button" class="btn-secondary" id="btn-add-hole">Add hole to</button>
          <select id="hole-parent">${polyOptions || '<option value="">(add polygon first)</option>'}</select>
        </div>
      </div>
    </details>

    <details class="section">
      <summary>Hotspots (${state.hotspots.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" data-add-room-item="hotspot">Add Hotspot</button>
        </div>
        <div class="benne-card-list">${hotspotCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
    <details class="section">
      <summary>Props (${state.props.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" data-add-room-item="prop">Add Prop</button>
        </div>
        <div class="benne-card-list">${propCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
    <details class="section">
      <summary>Spawned characters (${state.characters.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" data-add-room-item="character">Add Character</button>
        </div>
        <div class="benne-card-list">${charCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
    <details class="section">
      <summary>Points (${state.points.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" data-add-room-item="point">Add Point</button>
        </div>
        <div class="benne-card-list">${pointCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
    <details class="section">
      <summary>Regions (${state.regions.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" data-add-room-item="region">Add Region</button>
        </div>
        <div class="benne-card-list">${regionCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
  </div>
  <div class="footer">
    <button type="button" class="btn-primary" id="btn-save">Save</button>
    <button type="button" class="btn-secondary" id="btn-open-json">Open raw JSON</button>
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
    root.querySelectorAll('[data-add-room-item]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.addRoomItem ?? '';
            if (!kind) {
                return;
            }
            post('addRoomItem', { kind });
        });
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
            const id = btn.dataset.id;
            if (!kind || !id) {
                return;
            }
            post('editRoomPreview', { roomJsonUri: state.roomJsonUri, roomId: state.roomId, kind, id });
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
        lastInspectorPreserveRoomUri = null;
        root.innerHTML = renderEmpty(state.message);
        return;
    }
    let preserved = null;
    const hadRoomShell = root.querySelector('.inspector-root') !== null;
    if (hadRoomShell && lastInspectorPreserveRoomUri === state.roomJsonUri) {
        preserved = captureInspectorOpenState(root);
    }
    root.innerHTML = renderRoom(state);
    lastInspectorPreserveRoomUri = state.roomJsonUri;
    if (preserved) {
        restoreInspectorOpenState(root, preserved);
    }
    mountHandlers(state);
    scrollExpandedCardIntoView(state);
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