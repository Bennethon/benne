/** BENNE Inspector webview (bundled for `media/inspector/inspector.js`). */
/// <reference lib="dom" />

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

type InspectorVerbChip = {
    verbId: string;
    label: string;
    defined: boolean;
    eventId: string;
    isFallback?: boolean;
};

type InspectorWalkableRow = {
    kind: 'polygon' | 'hole';
    polygonId: string;
    holeId?: string;
    id: string;
    active: boolean;
};

type InspectorPropCard = {
    id: string;
    tag?: string;
    description: string;
    visible: boolean;
    clickable: boolean;
    zIndex: number;
    parallaxDepth: number;
    alpha: number;
    verbs: InspectorVerbChip[];
};

type InspectorHotspotCard = {
    id: string;
    description: string;
    active: boolean;
    zIndex: number;
    verbs: InspectorVerbChip[];
};

type InspectorCharacterCard = {
    instanceId: string;
    characterId: string;
    definition: string;
    x: number;
    y: number;
    visible: boolean;
    zIndex: number;
    initialFacing?: string;
    initialAnimation?: string;
    characterClickable: boolean;
    characterJsonUri: string;
    verbs: InspectorVerbChip[];
};

type InspectorPointCard = { id: string; x: number; y: number };
type InspectorRegionCard = { id: string; active: boolean; pointCount: number };

type InspectorRoomState = {
    kind: 'room';
    rev: number;
    roomJsonUri: string;
    roomId: string;
    displayName: string;
    size: { width: number; height: number } | null;
    scrollBounds: { x: number; y: number; width: number; height: number } | null;
    backgroundImageRelative: string | null;
    canFitBackground: boolean;
    walkableRows: InspectorWalkableRow[];
    props: InspectorPropCard[];
    hotspots: InspectorHotspotCard[];
    characters: InspectorCharacterCard[];
    points: InspectorPointCard[];
    regions: InspectorRegionCard[];
    expanded: { entity: string; id: string } | null;
};

type InspectorEmptyState = { kind: 'empty'; message: string };

type InspectorCharacterAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

type InspectorCharacterState = {
    kind: 'character';
    rev: number;
    characterJsonUri: string;
    characterId: string;
    name: string;
    walkSpeed: number;
    clickable: boolean;
    description: string;
    walkToPoint: { x: number; y: number } | null;
    talkPoint: { x: number; y: number } | null;
    feet: { x: number; y: number } | null;
    animations: InspectorCharacterAnimationCard[];
    verbs: InspectorVerbChip[];
};

type InspectorGuiControlCard = {
    key: string;
    type: string;
    id: string;
    summary: string;
    payload: string;
};

type InspectorGuiState = {
    kind: 'gui';
    rev: number;
    guiJsonUri: string;
    guiId: string;
    name: string;
    description: string;
    controls: InspectorGuiControlCard[];
};

type InspectorStatePayload = InspectorRoomState | InspectorCharacterState | InspectorGuiState | InspectorEmptyState;

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
try {
    vscodeApi = acquireVsCodeApi();
} catch {
    /* */
}

/** Avoid re-scrolling when the same tree item stays selected but room state `rev` bumps. */
let lastInspectorScrollRoomUri: string | null = null;
let lastInspectorScrollExpandedKey: string | null = null;

/** Last room URI we preserved accordion state for (same file, new `rev`). */
let lastInspectorPreserveRoomUri: string | null = null;

function inspectorStateKey(state: InspectorRoomState | InspectorCharacterState | InspectorGuiState): string {
    if (state.kind === 'room') {
        return `room:${state.roomJsonUri}`;
    }
    if (state.kind === 'character') {
        return `character:${state.characterJsonUri}`;
    }
    return `gui:${state.guiJsonUri}`;
}

type InspectorOpenPreserve = {
    sections: boolean[];
    items: Record<string, boolean>;
};

function captureInspectorOpenState(root: HTMLElement): InspectorOpenPreserve | null {
    const scroll = root.querySelector('.scroll');
    if (!scroll) {
        return null;
    }
    const sections: boolean[] = [];
    scroll.querySelectorAll(':scope > details.section').forEach((el) => {
        if (el instanceof HTMLDetailsElement) {
            sections.push(el.open);
        }
    });
    const items: Record<string, boolean> = {};
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

function restoreInspectorOpenState(root: HTMLElement, captured: InspectorOpenPreserve): void {
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

function scrollExpandedCardIntoView(state: InspectorRoomState): void {
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

    const run = (): void => {
        let item: HTMLElement | null = null;
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

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function post(action: string, payload?: Record<string, unknown>): void {
    vscodeApi?.postMessage({ action, ...payload });
}

function inspectorItemExpanded(
    state: { expanded?: { entity: string; id: string } | null },
    entity: string,
    id: string
): boolean {
    const ex = state.expanded;
    return !!(ex && ex.entity === entity && ex.id === id);
}

function renderInspectorItem(
    state: { expanded?: { entity: string; id: string } | null },
    entity: string,
    id: string,
    cardModifierClasses: string,
    summaryInnerHtml: string,
    bodyInnerHtml: string
): string {
    const open = inspectorItemExpanded(state, entity, id) ? ' open' : '';
    return `<details class="benne-inspector-item benne-card${cardModifierClasses}" data-entity="${esc(entity)}" data-id="${esc(id)}"${open}>
  <summary class="benne-inspector-item-summary">${summaryInnerHtml}</summary>
  <div class="benne-inspector-item-body">${bodyInnerHtml}</div>
</details>`;
}

function renderVerbChipRow(roomJsonUri: string, roomId: string, verbs: InspectorVerbChip[], ctx: string): string {
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

function renderRoom(state: InspectorRoomState): string {
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

function pointInputs(prefix: string, value: { x: number; y: number } | null): string {
    return `<div class="benne-dim-grid" role="group" aria-label="${esc(prefix)}">
  <span class="benne-dim-lbl">X</span>
  <input type="number" id="${esc(prefix)}-x" value="${value ? value.x : ''}" />
  <span class="benne-dim-lbl">Y</span>
  <input type="number" id="${esc(prefix)}-y" value="${value ? value.y : ''}" />
</div>`;
}

function renderCharacter(state: InspectorCharacterState): string {
    const verbHtml = renderVerbChipRow(state.characterJsonUri, state.characterId, state.verbs, `characterDef:${state.characterId}`);
    const animationCards = state.animations
        .map((anim) => {
            const summary = `<div class="benne-card-titles">
        <div class="benne-card-title">${esc(anim.id)}</div>
        <div class="benne-card-sub muted">Animation clip</div>
      </div>`;
            const body = `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">name</span>
        <div class="benne-pg-val"><code class="badge">${esc(anim.id)}</code></div>
        <span class="benne-pg-lbl">loop</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="char-anim-loop" data-id="${esc(anim.id)}" ${anim.loop ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">frameDuration</span>
        <input type="number" class="char-anim-dur" data-id="${esc(anim.id)}" value="${anim.frameDuration ?? ''}" />
      </div>`;
            return renderInspectorItem({}, 'animation', anim.id, ' benne-card--character', summary, body);
        })
        .join('');

    return `<div class="inspector-root">
  <div class="scroll">
    <details class="section" open>
      <summary>Character metadata</summary>
      <div class="section-body">
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">id</span>
          <div class="benne-pg-val"><code class="badge">${esc(state.characterId)}</code></div>
          <span class="benne-pg-lbl">name</span>
          <input type="text" id="char-name" value="${esc(state.name)}" />
          <span class="benne-pg-lbl">walkSpeed</span>
          <input type="number" id="char-walk-speed" value="${state.walkSpeed}" />
          <span class="benne-pg-lbl">clickable</span>
          <label class="benne-pg-check benne-inline-check"><input type="checkbox" id="char-clickable" ${state.clickable ? 'checked' : ''} /></label>
        </div>
        <label class="benne-field-label muted small">Description</label>
        <textarea id="char-description" rows="3">${esc(state.description)}</textarea>
        <div class="benne-scroll-bounds-label muted small">walkToPoint</div>
        ${pointInputs('char-walk', state.walkToPoint)}
        <div class="benne-scroll-bounds-label muted small">talkPoint</div>
        ${pointInputs('char-talk', state.talkPoint)}
        <div class="benne-scroll-bounds-label muted small">feet</div>
        ${pointInputs('char-feet', state.feet)}
      </div>
    </details>

    <details class="section" open>
      <summary>Verbs</summary>
      <div class="section-body">
        ${verbHtml}
      </div>
    </details>

    <details class="section" open>
      <summary>Animations (${state.animations.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" id="btn-import-char-anims">Import Animations from Aseprite Tags</button>
        </div>
        <div class="benne-card-list">${animationCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
  </div>
  <div class="footer">
    <button type="button" class="btn-primary" id="btn-save-char">Save</button>
    <button type="button" class="btn-secondary" id="btn-open-json-char">Open raw JSON</button>
  </div>
</div>`;
}

function renderGui(state: InspectorGuiState): string {
    const cards = state.controls
        .map((control, index) => {
            const summary = `<div class="benne-card-titles">
        <div class="benne-card-title">${esc(control.summary)}</div>
        <div class="benne-card-sub muted">${esc(control.type)}</div>
      </div>`;
            const body = `<label class="benne-field-label muted small">Control JSON</label>
      <textarea class="gui-control-payload" data-index="${index}" rows="6">${esc(control.payload)}</textarea>`;
            return renderInspectorItem({}, 'guiControl', control.key, ' benne-card--region', summary, body);
        })
        .join('');

    return `<div class="inspector-root">
  <div class="scroll">
    <details class="section" open>
      <summary>GUI metadata</summary>
      <div class="section-body">
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">id</span>
          <div class="benne-pg-val"><code class="badge">${esc(state.guiId)}</code></div>
          <span class="benne-pg-lbl">name</span>
          <input type="text" id="gui-name" value="${esc(state.name)}" />
        </div>
        <label class="benne-field-label muted small">Description</label>
        <textarea id="gui-description" rows="3">${esc(state.description)}</textarea>
      </div>
    </details>
    <details class="section" open>
      <summary>Controls (${state.controls.length})</summary>
      <div class="section-body">
        <div class="benne-card-list">${cards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
  </div>
  <div class="footer">
    <button type="button" class="btn-primary" id="btn-save-gui">Save</button>
    <button type="button" class="btn-secondary" id="btn-open-json-gui">Open raw JSON</button>
  </div>
</div>`;
}

function renderEmpty(msg: string): string {
    return `<p class="empty">${esc(msg)}</p>`;
}

function collectRoomMeta(): Record<string, unknown> {
    const name = (document.getElementById('fld-name') as HTMLInputElement)?.value ?? '';
    const wStr = (document.getElementById('fld-w') as HTMLInputElement)?.value ?? '';
    const hStr = (document.getElementById('fld-h') as HTMLInputElement)?.value ?? '';
    const w = wStr === '' ? null : Number(wStr);
    const h = hStr === '' ? null : Number(hStr);
    const sbx = (document.getElementById('sb-x') as HTMLInputElement)?.value ?? '';
    const sby = (document.getElementById('sb-y') as HTMLInputElement)?.value ?? '';
    const sbw = (document.getElementById('sb-w') as HTMLInputElement)?.value ?? '';
    const sbh = (document.getElementById('sb-h') as HTMLInputElement)?.value ?? '';
    return {
        type: 'roomMeta',
        displayName: name,
        size: w !== null && h !== null && Number.isFinite(w) && Number.isFinite(h) ? { width: w, height: h } : null,
        scrollBounds:
            sbx !== '' && sby !== '' && sbw !== '' && sbh !== ''
                ? {
                      x: Number(sbx),
                      y: Number(sby),
                      width: Number(sbw),
                      height: Number(sbh)
                  }
                : null
    };
}

function mountHandlers(state: InspectorRoomState): void {
    const root = document.getElementById('benne-inspector-app');
    if (!root) {
        return;
    }

    const flushMeta = (): void => {
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
        const sel = document.getElementById('hole-parent') as HTMLSelectElement;
        const polygonId = sel?.value ?? '';
        if (!polygonId) {
            return;
        }
        post('applyPatches', { patches: [{ type: 'addWalkableHole', polygonId }] });
    });

    root.querySelectorAll('[data-add-room-item]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = (btn as HTMLElement).dataset.addRoomItem ?? '';
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
            const t = ev.target as HTMLInputElement;
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

    const propPatch = (id: string, patch: Record<string, unknown>): void => {
        post('applyPatches', { patches: [{ type: 'propField', id, ...patch }] });
    };

    root.querySelectorAll('.prop-desc').forEach((el) => {
        el.addEventListener('blur', () => {
            const ta = el as HTMLTextAreaElement;
            propPatch(ta.dataset.id ?? '', { description: ta.value });
        });
    });
    root.querySelectorAll('.prop-visible, .prop-clickable').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            const field = inp.classList.contains('prop-visible') ? 'visible' : 'clickable';
            propPatch(inp.dataset.id ?? '', { [field]: inp.checked });
        });
    });
    root.querySelectorAll('.prop-z, .prop-par, .prop-alpha').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            const id = inp.dataset.id ?? '';
            if (inp.classList.contains('prop-z')) {
                propPatch(id, { zIndex: Number(inp.value) });
            } else if (inp.classList.contains('prop-par')) {
                propPatch(id, { parallaxDepth: Number(inp.value) });
            } else {
                propPatch(id, { alpha: Number(inp.value) });
            }
        });
    });

    root.querySelectorAll('.hs-desc').forEach((el) => {
        el.addEventListener('blur', () => {
            const ta = el as HTMLTextAreaElement;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: ta.dataset.id, description: ta.value }] });
        });
    });
    root.querySelectorAll('.hs-active').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: inp.dataset.id, active: inp.checked }] });
        });
    });
    root.querySelectorAll('.hs-z').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: inp.dataset.id, zIndex: Number(inp.value) }] });
        });
    });

    root.querySelectorAll('.ch-visible').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            post('applyPatches', { patches: [{ type: 'characterField', instanceId: inp.dataset.id, visible: inp.checked }] });
        });
    });
    root.querySelectorAll('.ch-x, .ch-y, .ch-z, .ch-face, .ch-anim').forEach((el) => {
        el.addEventListener('blur', () => {
            const id = (el as HTMLElement).dataset.id;
            if (!id) {
                return;
            }
            const box = root.querySelector(`.ch-x[data-id="${id}"]`) as HTMLInputElement;
            const boy = root.querySelector(`.ch-y[data-id="${id}"]`) as HTMLInputElement;
            const bz = root.querySelector(`.ch-z[data-id="${id}"]`) as HTMLInputElement;
            const bf = root.querySelector(`.ch-face[data-id="${id}"]`) as HTMLInputElement;
            const ba = root.querySelector(`.ch-anim[data-id="${id}"]`) as HTMLInputElement;
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
            const id = (el as HTMLElement).dataset.id;
            if (!id) {
                return;
            }
            const x = Number((root.querySelector(`.pt-x[data-id="${id}"]`) as HTMLInputElement)?.value);
            const y = Number((root.querySelector(`.pt-y[data-id="${id}"]`) as HTMLInputElement)?.value);
            post('applyPatches', { patches: [{ type: 'pointField', id, x, y }] });
        });
    });

    root.querySelectorAll('.rg-active').forEach((el) => {
        el.addEventListener('change', () => {
            const inp = el as HTMLInputElement;
            post('applyPatches', { patches: [{ type: 'regionActive', id: inp.dataset.id, active: inp.checked }] });
        });
    });

    root.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = (btn as HTMLElement).dataset.delete;
            const id = (btn as HTMLElement).dataset.id;
            if (!kind || !id || !confirm(`Delete ${kind} "${id}"?`)) {
                return;
            }
            post('applyPatches', { patches: [{ type: 'delete', entity: kind, id }] });
        });
    });

    root.querySelectorAll('[data-edit-preview]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const kind = (btn as HTMLElement).dataset.editPreview;
            const id = (btn as HTMLElement).dataset.id;
            if (!kind || !id) {
                return;
            }
            post('editRoomPreview', { roomJsonUri: state.roomJsonUri, roomId: state.roomId, kind, id });
        });
    });

    root.querySelectorAll('.verb-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const b = btn as HTMLButtonElement;
            const ctx = b.dataset.ctx ?? '';
            if (b.dataset.reveal) {
                post('verbReveal', {
                    roomJsonUri: state.roomJsonUri,
                    roomId: state.roomId,
                    eventId: b.dataset.event
                });
            } else if (b.dataset.add) {
                const verbId = b.dataset.verb ?? '';
                if (ctx.startsWith('prop:')) {
                    post('verbAdd', {
                        roomJsonUri: state.roomJsonUri,
                        roomId: state.roomId,
                        target: 'prop',
                        targetId: ctx.slice('prop:'.length),
                        verbId
                    });
                } else if (ctx.startsWith('hotspot:')) {
                    post('verbAdd', {
                        roomJsonUri: state.roomJsonUri,
                        roomId: state.roomId,
                        target: 'hotspot',
                        targetId: ctx.slice('hotspot:'.length),
                        verbId
                    });
                } else if (ctx.startsWith('char:')) {
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

function readPointFields(prefix: string): { x: number; y: number } | null {
    const xStr = (document.getElementById(`${prefix}-x`) as HTMLInputElement | null)?.value ?? '';
    const yStr = (document.getElementById(`${prefix}-y`) as HTMLInputElement | null)?.value ?? '';
    if (xStr === '' || yStr === '') {
        return null;
    }
    const x = Number(xStr);
    const y = Number(yStr);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function collectCharacterMeta(): Record<string, unknown> {
    return {
        type: 'characterMeta',
        name: (document.getElementById('char-name') as HTMLInputElement | null)?.value ?? '',
        walkSpeed: Number((document.getElementById('char-walk-speed') as HTMLInputElement | null)?.value ?? '0'),
        clickable: (document.getElementById('char-clickable') as HTMLInputElement | null)?.checked ?? false,
        description: (document.getElementById('char-description') as HTMLTextAreaElement | null)?.value ?? '',
        walkToPoint: readPointFields('char-walk'),
        talkPoint: readPointFields('char-talk'),
        feet: readPointFields('char-feet')
    };
}

function mountCharacterHandlers(state: InspectorCharacterState): void {
    const flush = (): void => {
        post('applyPatches', { patches: [collectCharacterMeta()] });
    };
    document.getElementById('btn-save-char')?.addEventListener('click', flush);
    document.getElementById('btn-open-json-char')?.addEventListener('click', () => {
        post('openRawJson', { characterJsonUri: state.characterJsonUri });
    });
    ['char-name', 'char-walk-speed', 'char-clickable', 'char-description', 'char-walk-x', 'char-walk-y', 'char-talk-x', 'char-talk-y', 'char-feet-x', 'char-feet-y'].forEach((id) => {
        document.getElementById(id)?.addEventListener('blur', flush);
        document.getElementById(id)?.addEventListener('change', flush);
    });
    document.querySelectorAll('.char-anim-loop, .char-anim-dur').forEach((el) => {
        el.addEventListener('change', () => {
            const id = (el as HTMLElement).dataset.id ?? '';
            if (!id) {
                return;
            }
            const loop = (document.querySelector(`.char-anim-loop[data-id="${id}"]`) as HTMLInputElement | null)?.checked ?? false;
            const durRaw = (document.querySelector(`.char-anim-dur[data-id="${id}"]`) as HTMLInputElement | null)?.value ?? '';
            const frameDuration = durRaw === '' ? null : Number(durRaw);
            post('applyPatches', { patches: [{ type: 'characterAnimation', id, loop, frameDuration }] });
        });
    });
    document.getElementById('btn-import-char-anims')?.addEventListener('click', () => {
        post('importCharacterAnimations');
    });
    document.querySelectorAll('.verb-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const b = btn as HTMLButtonElement;
            const ctx = b.dataset.ctx ?? '';
            if (b.dataset.reveal) {
                post('verbReveal', {
                    characterJsonUri: state.characterJsonUri,
                    characterId: state.characterId,
                    eventId: b.dataset.event
                });
                return;
            }
            if (!b.dataset.add || !ctx.startsWith('characterDef:')) {
                return;
            }
            const verbId = b.dataset.verb ?? '';
            post('verbAdd', {
                characterJsonUri: state.characterJsonUri,
                target: 'characterDef',
                characterId: state.characterId,
                verbId
            });
        });
    });
}

function collectGuiMeta(): Record<string, unknown> {
    return {
        type: 'guiMeta',
        name: (document.getElementById('gui-name') as HTMLInputElement | null)?.value ?? '',
        description: (document.getElementById('gui-description') as HTMLTextAreaElement | null)?.value ?? ''
    };
}

function mountGuiHandlers(state: InspectorGuiState): void {
    const flushMeta = (): void => {
        post('applyPatches', { patches: [collectGuiMeta()] });
    };
    document.getElementById('btn-save-gui')?.addEventListener('click', () => {
        const payloadPatches: Record<string, unknown>[] = [];
        document.querySelectorAll('.gui-control-payload').forEach((el) => {
            const ta = el as HTMLTextAreaElement;
            const idx = Number(ta.dataset.index ?? '-1');
            if (Number.isInteger(idx) && idx >= 0) {
                payloadPatches.push({ type: 'guiControlPayload', index: idx, payload: ta.value });
            }
        });
        post('applyPatches', { patches: [collectGuiMeta(), ...payloadPatches] });
    });
    document.getElementById('btn-open-json-gui')?.addEventListener('click', () => {
        post('openRawJson', { guiJsonUri: state.guiJsonUri });
    });
    document.getElementById('gui-name')?.addEventListener('blur', flushMeta);
    document.getElementById('gui-description')?.addEventListener('blur', flushMeta);
    document.querySelectorAll('.gui-control-payload').forEach((el) => {
        el.addEventListener('blur', () => {
            const ta = el as HTMLTextAreaElement;
            const idx = Number(ta.dataset.index ?? '-1');
            if (!Number.isInteger(idx) || idx < 0) {
                return;
            }
            post('applyPatches', { patches: [{ type: 'guiControlPayload', index: idx, payload: ta.value }] });
        });
    });
}

function render(state: InspectorStatePayload): void {
    const root = document.getElementById('benne-inspector-app');
    if (!root) {
        return;
    }
    if (state.kind === 'empty') {
        lastInspectorPreserveRoomUri = null;
        root.innerHTML = renderEmpty(state.message);
        return;
    }

    let preserved: InspectorOpenPreserve | null = null;
    const hadRoomShell = root.querySelector('.inspector-root') !== null;
    const stateKey = inspectorStateKey(state);
    if (hadRoomShell && lastInspectorPreserveRoomUri === stateKey) {
        preserved = captureInspectorOpenState(root);
    }

    if (state.kind === 'room') {
        root.innerHTML = renderRoom(state);
    } else if (state.kind === 'character') {
        root.innerHTML = renderCharacter(state);
    } else {
        root.innerHTML = renderGui(state);
    }
    lastInspectorPreserveRoomUri = stateKey;

    if (preserved) {
        restoreInspectorOpenState(root, preserved);
    }

    if (state.kind === 'room') {
        mountHandlers(state);
        scrollExpandedCardIntoView(state);
    } else if (state.kind === 'character') {
        mountCharacterHandlers(state);
    } else {
        mountGuiHandlers(state);
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type?: string; state?: InspectorStatePayload };
    if (msg?.type === 'benne/inspector/state' && msg.state) {
        render(msg.state);
    }
});

render({ kind: 'empty', message: 'Loading…' });
