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

type InspectorPropAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

type InspectorPropCard = {
    id: string;
    tag?: string;
    defaultAnimation: string;
    animations: InspectorPropAnimationCard[];
    description: string;
    visible: boolean;
    clickable: boolean;
    zIndex: number;
    parallaxDepth: number;
    alpha: number;
    verbs: InspectorVerbChip[];
    defaultVerb: string;
    availableVerbs: { id: string; label?: string; preposition?: string }[];
};

type InspectorHotspotCard = {
    id: string;
    description: string;
    active: boolean;
    zIndex: number;
    verbs: InspectorVerbChip[];
    defaultVerb: string;
    availableVerbs: { id: string; label?: string; preposition?: string }[];
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
    defaultVerb: string;
    availableVerbs: { id: string; label?: string; preposition?: string }[];
};

type InspectorPointCard = { id: string; x: number; y: number };
type InspectorRegionCard = { id: string; active: boolean; pointCount: number };

type InspectorRoomState = {
    kind: 'room';
    rev: number;
    roomJsonUri: string;
    roomId: string;
    /** Inventory ids (workspace); stub text is built when Inv is clicked. */
    inventoryItemIds: string[];
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
    inventoryItemIds: string[];
    name: string;
    walkSpeed: number;
    clickable: boolean;
    description: string;
    walkToPoint: { x: number; y: number } | null;
    talkPoint: { x: number; y: number } | null;
    feet: { x: number; y: number } | null;
    animations: InspectorCharacterAnimationCard[];
    verbs: InspectorVerbChip[];
    defaultVerb: string;
    availableVerbs: { id: string; label?: string; preposition?: string }[];
};

type InspectorGuiSpriteAnchor = '' | 'top-left' | 'center' | 'screen';

type InspectorGuiControlCard =
    | {
          controlKind: 'text';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          text: string;
          font: string;
          fontSize: number;
          color: string;
          align: 'left' | 'center' | 'right' | '';
          wordWrapWidth: number | null;
      }
    | {
          controlKind: 'verbLine';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          font: string;
          fontSize: number;
          color: string;
          align: 'left' | 'center' | 'right' | '';
          wordWrapWidth: number | null;
      }
    | {
          controlKind: 'inventoryPanel';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          rows: number;
          cols: number;
          slotWidth: number;
          slotHeight: number;
          spacingX: number | null;
          spacingY: number | null;
          itemScale: number | null;
          showEmptySlots: boolean;
          scrollDirection: 'horizontal' | 'vertical' | '';
          backButton: string;
          forwardButton: string;
          backgroundTag: string;
          backgroundAnchor: InspectorGuiSpriteAnchor;
          slotBackgroundTag: string;
          slotBackgroundAnchor: InspectorGuiSpriteAnchor;
          highlightTag: string;
          highlightAnchor: InspectorGuiSpriteAnchor;
      }
    | {
          controlKind: 'image';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          tag: string;
          backgroundAnchor: InspectorGuiSpriteAnchor;
      }
    | {
          controlKind: 'button';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          width: number;
          height: number;
          backgroundAnchor: InspectorGuiSpriteAnchor;
          text: string;
          font: string;
          fontSize: number;
          textColor: string;
          textAlign: 'left' | 'center' | 'right' | '';
          textOffsetX: number | null;
          textOffsetY: number | null;
          backgroundTag: string;
          statesHover: string;
          statesPressed: string;
          statesDisabled: string;
          enabled: boolean;
      }
    | {
          controlKind: 'trigger';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          name: string;
          x: number;
          y: number;
          width: number;
          height: number;
          visibleMode: '' | 'true' | 'false';
          active: boolean;
      }
    | {
          controlKind: 'unknown';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          typeLabel: string;
          payload: string;
      };

type InspectorGuiState = {
    kind: 'gui';
    rev: number;
    guiJsonUri: string;
    guiId: string;
    name: string;
    description: string;
    /** Matches required root `visible` in `*.gui.json`. */
    rootVisibleAtLoad: boolean;
    usesAseprite: boolean;
    guiSheetTags: string[];
    fontIds: string[];
    controls: InspectorGuiControlCard[];
    expanded: { entity: string; id: string } | null;
};

type InspectorInventoryAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

type InspectorInventoryState = {
    kind: 'inventory';
    rev: number;
    inventoryJsonUri: string;
    inventoryId: string;
    name: string;
    description: string;
    stackable: boolean;
    asepriteMode: true | 'shared';
    defaultAnimation: string;
    cursorAnimation: string;
    verbs: InspectorVerbChip[];
    availableVerbs: { id: string; label?: string; preposition?: string }[];
    animations: InspectorInventoryAnimationCard[];
    defaultVerb: string;
};

type InspectorStatePayload =
    | InspectorRoomState
    | InspectorCharacterState
    | InspectorGuiState
    | InspectorInventoryState
    | InspectorEmptyState;

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
try {
    vscodeApi = acquireVsCodeApi();
} catch {
    /* */
}

/** Avoid re-scrolling when the same tree item stays selected but room state `rev` bumps. */
let lastInspectorScrollRoomUri: string | null = null;
let lastInspectorScrollExpandedKey: string | null = null;

/** Same as room scroll de-dupe, for GUI Inspector control cards. */
let lastInspectorScrollGuiUri: string | null = null;
let lastInspectorScrollGuiExpandedKey: string | null = null;

/** Last room URI we preserved accordion state for (same file, new `rev`). */
let lastInspectorPreserveRoomUri: string | null = null;

function inspectorStateKey(
    state: InspectorRoomState | InspectorCharacterState | InspectorGuiState | InspectorInventoryState
): string {
    if (state.kind === 'room') {
        return `room:${state.roomJsonUri}`;
    }
    if (state.kind === 'character') {
        return `character:${state.characterJsonUri}`;
    }
    if (state.kind === 'gui') {
        return `gui:${state.guiJsonUri}`;
    }
    return `inventory:${state.inventoryJsonUri}`;
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

function scrollExpandedGuiCardIntoView(state: InspectorGuiState): void {
    if (state.guiJsonUri !== lastInspectorScrollGuiUri) {
        lastInspectorScrollGuiUri = state.guiJsonUri;
        lastInspectorScrollGuiExpandedKey = null;
    }
    const ex = state.expanded;
    if (!ex) {
        return;
    }
    const key = `${ex.entity}\0${ex.id}`;
    if (key === lastInspectorScrollGuiExpandedKey) {
        return;
    }
    lastInspectorScrollGuiExpandedKey = key;

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

function renderInventoryUsedOnInvRoomButton(target: 'prop' | 'hotspot' | 'character', targetId: string): string {
    return `<div class="benne-inv-usedon-wrap" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <button type="button" class="btn-secondary btn-inv-usedon" data-inv-target="${esc(target)}" data-inv-target-id="${esc(targetId)}" title="Insert B.whenInventoryUsedOn stub in the room script">Inv</button>
    <span class="muted small"><code>B.whenInventoryUsedOn</code> (room script)</span>
  </div>`;
}

function renderInventoryUsedOnInvCharacterDefButton(): string {
    return `<div class="benne-inv-usedon-wrap" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <button type="button" class="btn-secondary btn-inv-usedon-char" title="Insert B.whenInventoryUsedOn stub in the character script">Inv</button>
    <span class="muted small"><code>B.whenInventoryUsedOn</code> (character script)</span>
  </div>`;
}

/**
 * Renders the per-clickable "Default verb" dropdown. The selected value is the currently-authored
 * verb (falling back to `"look"` when JSON omits `defaultVerb`). Classes below drive the change
 * handlers installed in each panel's mount function.
 */
function renderDefaultVerbSelect(
    cls: string,
    dataAttr: string,
    current: string,
    available: { id: string; label?: string; preposition?: string }[],
    extra = ''
): string {
    const ids = new Set(available.map((v) => v.id));
    // If the authored value is unknown (e.g. verb was removed from game-config), include it as a
    // selected option so the Inspector doesn't silently rewrite the value on the next save.
    const rows: string[] = [];
    if (current && !ids.has(current)) {
        rows.push(`<option value="${esc(current)}" selected>${esc(current)} (missing)</option>`);
    }
    for (const v of available) {
        const label = (v.label && v.label.trim().length > 0 ? v.label : v.id).trim();
        const sel = v.id === current ? ' selected' : '';
        rows.push(`<option value="${esc(v.id)}"${sel}>${esc(label)}</option>`);
    }
    return `<select class="${cls}" ${dataAttr} ${extra}>${rows.join('')}</select>`;
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
            const tagTrim = typeof p.tag === 'string' ? p.tag.trim() : '';
            const tagSelectOptions =
                p.animations.length > 0
                    ? (() => {
                          let inner = p.animations
                              .map((a) => {
                                  const sel = a.id === tagTrim ? ' selected' : '';
                                  return `<option value="${esc(a.id)}"${sel}>${esc(a.id)}</option>`;
                              })
                              .join('');
                          if (tagTrim.length > 0 && !p.animations.some((a) => a.id === tagTrim)) {
                              inner = `<option value="${esc(tagTrim)}" selected>${esc(tagTrim)}</option>${inner}`;
                          }
                          return inner;
                      })()
                    : `<option value="${esc(tagTrim || p.id)}" selected>${esc(tagTrim || p.id)}</option>`;
            const animRows = p.animations
                .map((anim) => {
                    const rowKey = `${esc(p.id)}::${esc(anim.id)}`;
                    const summary = `<div class="benne-card-titles">
        <div class="benne-card-title">${esc(anim.id)}</div>
        <div class="benne-card-sub muted">Aseprite clip</div>
      </div>`;
                    const body = `<div class="benne-prop-grid benne-prop-grid--tight prop-anim-row" data-prop-id="${esc(p.id)}" data-anim-tag="${esc(anim.id)}">
        <span class="benne-pg-lbl">loop</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="prop-anim-loop" ${anim.loop ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">frameDuration</span>
        <input type="number" class="prop-anim-dur" value="${anim.frameDuration ?? ''}" min="1" step="1" placeholder="(Aseprite)" title="Leave blank to use per-frame durations from the Aseprite export" />
      </div>`;
                    return renderInspectorItem(state, 'propAnimation', rowKey, ' benne-card--character', summary, body);
                })
                .join('');
            const animSubbody =
                p.animations.length > 0
                    ? `<div class="benne-card-subsection-body"><div class="benne-card-list">${animRows}</div></div>`
                    : `<div class="benne-card-subsection-body">
        <p class="muted small">No animation clips listed — add <code>animations</code> in JSON or ensure the room sheet has matching frame tags.</p>
      </div>`;
            const animSection = `<details class="benne-card-subsection">
      <summary>Animations (${p.animations.length})</summary>
      ${animSubbody}
    </details>`;
            const propClickableCls = p.clickable ? ' benne-card--prop-clickable' : '';
            const propActions = p.clickable
                ? `<div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="prop" data-id="${esc(p.id)}">Edit in Preview →</button>
        </div>
      </div>`
                : '';
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
        <span class="benne-pg-lbl">Displayed tag</span>
        <select class="prop-tag-select" data-id="${esc(p.id)}" title="Aseprite frame tag shown for this prop">${tagSelectOptions}</select>
        <span class="benne-pg-lbl">Family root</span>
        <input type="text" class="prop-default-animation" data-id="${esc(p.id)}" value="${esc(p.defaultAnimation)}" placeholder="(optional) e.g. door when id differs" title="Optional second root for &lt;root&gt;-* tag grouping alongside prop id" />
      </div>
      <label class="benne-field-label muted small">Description</label>
      <textarea class="benne-card-desc prop-desc" data-id="${esc(p.id)}" rows="2" title="${esc(p.description)}">${esc(p.description)}</textarea>
      <label class="benne-field-label muted small">Default verb</label>
      ${p.clickable
          ? renderDefaultVerbSelect('prop-default-verb', `data-id="${esc(p.id)}"`, p.defaultVerb, p.availableVerbs, 'title="Verb invoked when inputProfile resolves to \'defaultVerb\' on this prop"')
          : '<span class="muted small">(not clickable)</span>'}
      <label class="benne-field-label muted small">Verbs</label>
      ${verbHtml}
      ${p.clickable ? renderInventoryUsedOnInvRoomButton('prop', p.id) : ''}
      ${animSection}
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
      <label class="benne-field-label muted small">Default verb</label>
      ${renderDefaultVerbSelect('hs-default-verb', `data-id="${esc(h.id)}"`, h.defaultVerb, h.availableVerbs, 'title="Verb invoked when inputProfile resolves to \'defaultVerb\' on this hotspot"')}
      <label class="benne-field-label muted small">Verbs</label>
      ${verbHtml}
      ${h.active ? renderInventoryUsedOnInvRoomButton('hotspot', h.id) : ''}
      <div class="benne-card-actions">
        <div class="benne-card-actions-inner">
          <button type="button" class="btn-link" data-edit-preview="hotspot" data-id="${esc(h.id)}">Edit in Preview →</button>
        </div>
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
      <label class="benne-field-label muted small">Default verb</label>
      <div class="benne-prop-grid benne-prop-grid--tight" title="Edit from the character Inspector; stored in the character's own JSON.">
        <span class="benne-pg-lbl">${esc(c.defaultVerb)}</span>
        <span class="muted small">(from character JSON)</span>
      </div>
      <label class="benne-field-label muted small">Verbs</label>
      ${verbHtml}
      ${c.characterClickable ? renderInventoryUsedOnInvRoomButton('character', c.characterId) : ''}`;
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

function guiDimInputsForControl(
    index: number,
    x: number,
    y: number,
    size?: { width: number; height: number }
): string {
    const prefix = `gui-c${index}-pos`;
    const whRow =
        size != null
            ? `
  <span class="benne-dim-lbl">W</span>
  <input type="number" class="gui-field" data-index="${index}" data-field="width" id="${esc(prefix)}-w" value="${size.width}" />
  <span class="benne-dim-lbl">H</span>
  <input type="number" class="gui-field" data-index="${index}" data-field="height" id="${esc(prefix)}-h" value="${size.height}" />`
            : '';
    const aria = size != null ? 'Position and size' : 'Position';
    return `<div class="benne-dim-grid" role="group" aria-label="${aria}">
  <span class="benne-dim-lbl">X</span>
  <input type="number" class="gui-field" data-index="${index}" data-field="x" id="${esc(prefix)}-x" value="${x}" />
  <span class="benne-dim-lbl">Y</span>
  <input type="number" class="gui-field" data-index="${index}" data-field="y" id="${esc(prefix)}-y" value="${y}" />${whRow}
</div>`;
}

function guiAnchorSelectOptions(val: InspectorGuiSpriteAnchor): string {
    const opts: [InspectorGuiSpriteAnchor, string][] = [
        ['', '(default)'],
        ['top-left', 'top-left'],
        ['center', 'center'],
        ['screen', 'screen']
    ];
    return opts
        .map(([v, lab]) => `<option value="${esc(v)}"${val === v ? ' selected' : ''}>${esc(lab)}</option>`)
        .join('');
}

function guiSheetTagSelectHtml(
    tags: readonly string[],
    current: string,
    dataIndex: number,
    dataField: string
): string {
    const cur = current.trim();
    let inner = `<option value="">(none)</option>`;
    const tagSet = new Set(tags);
    if (cur.length > 0 && !tagSet.has(cur)) {
        inner += `<option value="${esc(cur)}" selected>${esc(cur)} (missing from sheet)</option>`;
    }
    for (const t of tags) {
        const sel = t === cur ? ' selected' : '';
        inner += `<option value="${esc(t)}"${sel}>${esc(t)}</option>`;
    }
    return `<select class="gui-field" data-index="${dataIndex}" data-field="${esc(dataField)}">${inner}</select>`;
}

function guiFontSelectHtml(fontIds: readonly string[], current: string, dataIndex: number): string {
    const set = new Set(fontIds);
    let inner = '';
    if (current.length > 0 && !set.has(current)) {
        inner += `<option value="${esc(current)}" selected>${esc(current)} (not in fonts.json)</option>`;
    }
    for (const f of fontIds) {
        const sel = f === current ? ' selected' : '';
        inner += `<option value="${esc(f)}"${sel}>${esc(f)}</option>`;
    }
    return `<select class="gui-field" data-index="${dataIndex}" data-field="font">${inner}</select>`;
}

function guiButtonIdSelectHtml(
    buttonIds: readonly string[],
    current: string,
    dataIndex: number,
    dataField: string
): string {
    const cur = current.trim();
    let inner = `<option value=""${cur === '' ? ' selected' : ''}>—</option>`;
    const idSet = new Set(buttonIds);
    if (cur.length > 0 && !idSet.has(cur)) {
        inner += `<option value="${esc(cur)}" selected>${esc(cur)} (no button control)</option>`;
    }
    for (const id of buttonIds) {
        const sel = id === cur ? ' selected' : '';
        inner += `<option value="${esc(id)}"${sel}>${esc(id)}</option>`;
    }
    return `<select class="gui-field" data-index="${dataIndex}" data-field="${esc(dataField)}">${inner}</select>`;
}

function renderGuiControlCardBody(state: InspectorGuiState, c: InspectorGuiControlCard): string {
    if (c.controlKind === 'unknown') {
        return `<label class="benne-field-label muted small">Control JSON</label>
      <textarea class="gui-control-payload" data-index="${c.index}" rows="8">${esc(c.payload)}</textarea>`;
    }

    const idx = c.index;
    const tags = state.guiSheetTags;
    const fontIds = state.fontIds;

    const visibleSelect = `<span class="benne-pg-lbl">visible</span>
      <select class="gui-field" data-index="${idx}" data-field="visible">
        <option value=""${c.visibleMode === '' ? ' selected' : ''}>Inherit overlay</option>
        <option value="true"${c.visibleMode === 'true' ? ' selected' : ''}>Shown</option>
        <option value="false"${c.visibleMode === 'false' ? ' selected' : ''}>Hidden</option>
      </select>`;

    /** `trigger` controls do not author a zIndex (they always sit above other controls in this overlay). */
    const renderZRow = (z: number | null): string =>
        `<span class="benne-pg-lbl">zIndex</span>
      <input type="number" class="gui-field" data-index="${idx}" data-field="zIndex" value="${z ?? ''}" placeholder="—" />`;
    const zRow = c.controlKind === 'trigger' ? '' : renderZRow(c.zIndex);

    if (c.controlKind === 'text') {
        const alignLeftSel = c.align === '' || c.align === 'left';
        const alignSel = `<select class="gui-field" data-index="${idx}" data-field="align">
        <option value="left"${alignLeftSel ? ' selected' : ''}>left</option>
        <option value="center"${c.align === 'center' ? ' selected' : ''}>center</option>
        <option value="right"${c.align === 'right' ? ' selected' : ''}>right</option>
      </select>`;
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        ${zRow}
        ${visibleSelect}
        <span class="benne-pg-lbl">text</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="text" value="${esc(c.text)}" />
        <span class="benne-pg-lbl">font</span>
        ${guiFontSelectHtml(fontIds, c.font, idx)}
        <span class="benne-pg-lbl">fontSize</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="fontSize" value="${c.fontSize}" />
        <span class="benne-pg-lbl">color</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="color" value="${esc(c.color)}" />
        <span class="benne-pg-lbl">align</span>
        ${alignSel}
        <span class="benne-pg-lbl">wordWrapWidth</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="wordWrapWidth" value="${c.wordWrapWidth ?? ''}" placeholder="—" />
      </div>
      <div class="benne-scroll-bounds-label muted small">Position</div>
      ${guiDimInputsForControl(idx, c.x, c.y)}
      <p class="muted small" style="margin:8px 0 0;">Sheet animations are not used for <code>text</code> controls.</p>`;
    }

    if (c.controlKind === 'verbLine') {
        const alignLeftSel = c.align === '' || c.align === 'left';
        const alignSel = `<select class="gui-field" data-index="${idx}" data-field="align">
        <option value="left"${alignLeftSel ? ' selected' : ''}>left</option>
        <option value="center"${c.align === 'center' ? ' selected' : ''}>center</option>
        <option value="right"${c.align === 'right' ? ' selected' : ''}>right</option>
      </select>`;
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        ${zRow}
        ${visibleSelect}
        <span class="benne-pg-lbl">font</span>
        ${guiFontSelectHtml(fontIds, c.font, idx)}
        <span class="benne-pg-lbl">fontSize</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="fontSize" value="${c.fontSize}" />
        <span class="benne-pg-lbl">color</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="color" value="${esc(c.color)}" />
        <span class="benne-pg-lbl">align</span>
        ${alignSel}
        <span class="benne-pg-lbl">wordWrapWidth</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="wordWrapWidth" value="${c.wordWrapWidth ?? ''}" placeholder="—" />
      </div>
      <div class="benne-scroll-bounds-label muted small">Position</div>
      ${guiDimInputsForControl(idx, c.x, c.y)}
      <p class="muted small" style="margin:8px 0 0;">Runtime text comes from <code>game-config.json</code> verbs and the active verb (defaults to <strong>Walk to</strong>).</p>`;
    }

    if (c.controlKind === 'inventoryPanel') {
        const buttonIds = state.controls
            .filter((bc) => bc.controlKind === 'button' && bc.controlId.trim().length > 0)
            .map((bc) => (bc.controlKind === 'button' ? bc.controlId.trim() : ''));
        const scrollDirSel = `<select class="gui-field" data-index="${idx}" data-field="scrollDirection">
        <option value=""${c.scrollDirection === '' ? ' selected' : ''}>—</option>
        <option value="horizontal"${c.scrollDirection === 'horizontal' ? ' selected' : ''}>horizontal</option>
        <option value="vertical"${c.scrollDirection === 'vertical' ? ' selected' : ''}>vertical</option>
      </select>`;
        const animBlock =
            state.usesAseprite && tags.length > 0
                ? `<div class="benne-scroll-bounds-label muted small" style="margin-top:10px;">Animations</div>
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">Backdrop tag</span>
          ${guiSheetTagSelectHtml(tags, c.backgroundTag, idx, 'backgroundTag')}
          <span class="benne-pg-lbl">Backdrop anchor</span>
          <select class="gui-field" data-index="${idx}" data-field="backgroundAnchor">${guiAnchorSelectOptions(c.backgroundAnchor)}</select>
          <span class="benne-pg-lbl">Slot bg tag</span>
          ${guiSheetTagSelectHtml(tags, c.slotBackgroundTag, idx, 'slotBackgroundTag')}
          <span class="benne-pg-lbl">Slot bg anchor</span>
          <select class="gui-field" data-index="${idx}" data-field="slotBackgroundAnchor">${guiAnchorSelectOptions(c.slotBackgroundAnchor)}</select>
          <span class="benne-pg-lbl">Highlight tag</span>
          ${guiSheetTagSelectHtml(tags, c.highlightTag, idx, 'highlightTag')}
          <span class="benne-pg-lbl">Highlight anchor</span>
          <select class="gui-field" data-index="${idx}" data-field="highlightAnchor">${guiAnchorSelectOptions(c.highlightAnchor)}</select>
        </div>`
                : state.usesAseprite
                  ? `<p class="muted small" style="margin-top:8px;">No frame tags found on this GUI’s Aseprite JSON — add tags in Aseprite and re-export.</p>`
                  : `<p class="muted small" style="margin-top:8px;">Enable <code>display.aseprite</code> to bind sheet tags here.</p>`;
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        ${zRow}
        ${visibleSelect}
        <span class="benne-pg-lbl">rows</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="rows" value="${c.rows}" />
        <span class="benne-pg-lbl">cols</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="cols" value="${c.cols}" />
        <span class="benne-pg-lbl">slotWidth</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="slotWidth" value="${c.slotWidth}" />
        <span class="benne-pg-lbl">slotHeight</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="slotHeight" value="${c.slotHeight}" />
        <span class="benne-pg-lbl">spacingX</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="spacingX" value="${c.spacingX ?? ''}" placeholder="0" />
        <span class="benne-pg-lbl">spacingY</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="spacingY" value="${c.spacingY ?? ''}" placeholder="0" />
        <span class="benne-pg-lbl">itemScale</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="itemScale" value="${c.itemScale ?? ''}" placeholder="1" step="0.05" />
        <span class="benne-pg-lbl">showEmptySlots</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="gui-field-cb" data-index="${idx}" data-field="showEmptySlots" ${c.showEmptySlots ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">scrollDirection</span>
        ${scrollDirSel}
        <span class="benne-pg-lbl">backButton</span>
        ${guiButtonIdSelectHtml(buttonIds, c.backButton, idx, 'backButton')}
        <span class="benne-pg-lbl">forwardButton</span>
        ${guiButtonIdSelectHtml(buttonIds, c.forwardButton, idx, 'forwardButton')}
      </div>
      <div class="benne-scroll-bounds-label muted small">Position</div>
      ${guiDimInputsForControl(idx, c.x, c.y)}
      ${animBlock}`;
    }

    if (c.controlKind === 'button') {
        const textAlignSel = `<select class="gui-field" data-index="${idx}" data-field="textAlign">
        <option value="left"${c.textAlign === 'left' ? ' selected' : ''}>left</option>
        <option value="center"${c.textAlign === '' || c.textAlign === 'center' ? ' selected' : ''}>center</option>
        <option value="right"${c.textAlign === 'right' ? ' selected' : ''}>right</option>
      </select>`;
        const sheetBlock =
            state.usesAseprite && tags.length > 0
                ? `<div class="benne-scroll-bounds-label muted small" style="margin-top:10px;">Sheet</div>
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">background anchor</span>
          <select class="gui-field" data-index="${idx}" data-field="backgroundAnchor">${guiAnchorSelectOptions(c.backgroundAnchor)}</select>
          <span class="benne-pg-lbl">backgroundTag</span>
          ${guiSheetTagSelectHtml(tags, c.backgroundTag, idx, 'backgroundTag')}
          <span class="benne-pg-lbl">state hover</span>
          ${guiSheetTagSelectHtml(tags, c.statesHover, idx, 'statesHover')}
          <span class="benne-pg-lbl">state pressed</span>
          ${guiSheetTagSelectHtml(tags, c.statesPressed, idx, 'statesPressed')}
          <span class="benne-pg-lbl">state disabled</span>
          ${guiSheetTagSelectHtml(tags, c.statesDisabled, idx, 'statesDisabled')}
        </div>`
                : state.usesAseprite
                  ? `<p class="muted small" style="margin-top:8px;">No frame tags on sheet JSON.</p>`
                  : `<p class="muted small" style="margin-top:8px;">Set <code>display.aseprite: true</code> to pick sheet tags.</p>`;
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        ${zRow}
        ${visibleSelect}
        <span class="benne-pg-lbl">enabled</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="gui-field-cb" data-index="${idx}" data-field="enabled" ${c.enabled ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">text</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="text" value="${esc(c.text)}" />
        <span class="benne-pg-lbl">font</span>
        ${guiFontSelectHtml(fontIds, c.font, idx)}
        <span class="benne-pg-lbl">fontSize</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="fontSize" value="${c.fontSize}" />
        <span class="benne-pg-lbl">textColor</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="textColor" value="${esc(c.textColor)}" />
        <span class="benne-pg-lbl">textAlign</span>
        ${textAlignSel}
        <span class="benne-pg-lbl">textOffsetX</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="textOffsetX" value="${c.textOffsetX ?? ''}" placeholder="0" />
        <span class="benne-pg-lbl">textOffsetY</span>
        <input type="number" class="gui-field" data-index="${idx}" data-field="textOffsetY" value="${c.textOffsetY ?? ''}" placeholder="0" />
      </div>
      <div class="benne-scroll-bounds-label muted small">Position &amp; size</div>
      ${guiDimInputsForControl(idx, c.x, c.y, { width: c.width, height: c.height })}
      ${sheetBlock}
      ${
          c.controlId
              ? `<div style="margin:8px 0 0;">
        <button type="button" class="btn-secondary gui-on-click-btn" data-button-id="${esc(c.controlId)}">On Click</button>
      </div>`
              : `<p class="muted small" style="margin:8px 0 0;">Add a unique <code>id</code> in raw JSON for <code>B.whenButtonClick</code>.</p>`
      }`;
    }

    if (c.controlKind === 'image') {
        const animImg =
            state.usesAseprite && tags.length > 0
                ? `<div class="benne-scroll-bounds-label muted small" style="margin-top:10px;">Animations</div>
      <div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">tag</span>
        ${guiSheetTagSelectHtml(tags, c.tag, idx, 'tag')}
        <span class="benne-pg-lbl">background anchor</span>
        <select class="gui-field" data-index="${idx}" data-field="backgroundAnchor">${guiAnchorSelectOptions(c.backgroundAnchor)}</select>
      </div>`
                : state.usesAseprite
                  ? `<p class="muted small" style="margin-top:8px;">No frame tags on sheet JSON.</p>`
                  : `<p class="muted small" style="margin-top:8px;">Set <code>display.aseprite: true</code> to use sheet tags.</p>`;
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        ${zRow}
        ${visibleSelect}
      </div>
      <div class="benne-scroll-bounds-label muted small">Position</div>
      ${guiDimInputsForControl(idx, c.x, c.y)}
      ${animImg}`;
    }

    if (c.controlKind === 'trigger') {
        return `<div class="benne-prop-grid benne-prop-grid--tight">
        <span class="benne-pg-lbl">id</span>
        <div class="benne-pg-val"><code class="badge">${esc(c.controlId || '—')}</code></div>
        <span class="benne-pg-lbl">name</span>
        <input type="text" class="gui-field" data-index="${idx}" data-field="name" value="${esc(c.name)}" placeholder="optional label" />
        ${visibleSelect}
        <span class="benne-pg-lbl">active</span>
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="gui-field-cb" data-index="${idx}" data-field="active" ${c.active ? 'checked' : ''} /></label>
      </div>
      <div class="benne-scroll-bounds-label muted small">Position &amp; size</div>
      ${guiDimInputsForControl(idx, c.x, c.y, { width: c.width, height: c.height })}
      <p class="muted small" style="margin:8px 0 0;">Invisible hit zone. Wire <code>B.whenMouseEnter('${esc(c.controlId || 'id')}', …)</code> and <code>B.whenMouseLeave</code> in <code>*.gui.ts</code>.</p>`;
    }

    return `<p class="muted">Unsupported control kind.</p>`;
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
        <label class="benne-field-label muted small">Default verb</label>
        ${renderDefaultVerbSelect('char-default-verb', '', state.defaultVerb, state.availableVerbs, 'title="Verb invoked when inputProfile resolves to \'defaultVerb\' on this character"')}
        <label class="benne-field-label muted small" style="margin-top:10px;">Configured verbs</label>
        ${verbHtml}
        ${state.clickable ? renderInventoryUsedOnInvCharacterDefButton() : ''}
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
        .map((control) => {
            const typeLabel =
                control.controlKind === 'unknown' ? control.typeLabel : control.controlKind;
            const summary = `<div class="benne-card-titles">
        <div class="benne-card-title">${esc(control.summary)}</div>
        <div class="benne-card-sub muted">${esc(typeLabel)}</div>
      </div>`;
            const body = renderGuiControlCardBody(state, control);
            return renderInspectorItem(state, 'guiControl', control.key, ' benne-card--region', summary, body);
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
          <span class="benne-pg-lbl">visible</span>
          <label class="benne-pg-check benne-inline-check"><input type="checkbox" id="gui-visible" ${state.rootVisibleAtLoad ? 'checked' : ''} /></label>
        </div>
        <label class="benne-field-label muted small">Description</label>
        <textarea id="gui-description" rows="3">${esc(state.description)}</textarea>
      </div>
    </details>
    <details class="section" open>
      <summary>Controls (${state.controls.length})</summary>
      <div class="section-body">
        <div class="benne-section-add-row">
          <button type="button" class="btn-secondary" id="btn-add-gui-control">Add Control</button>
        </div>
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

function renderInventoryVerbChips(state: InspectorInventoryState): string {
    if (state.verbs.length === 0) {
        return '<div class="benne-verb-chips benne-verb-chips--empty"><span class="muted small">No verbs</span></div>';
    }
    const chips = state.verbs
        .map((v) => {
            const icon = v.defined ? '⚡' : '+';
            const cls = v.defined ? 'verb-chip verb-defined inv-verb-chip' : 'verb-chip verb-add inv-verb-chip';
            const dataReveal = v.defined ? `data-reveal="1" data-event="${esc(v.eventId)}"` : '';
            const dataAdd = !v.defined && !v.isFallback ? `data-add="1" data-verb="${esc(v.verbId)}"` : '';
            return `<button type="button" class="${cls}" ${dataReveal} ${dataAdd} data-ctx="inventoryDef:${esc(state.inventoryId)}" title="${esc(v.label)}"><span class="verb-chip-glyph" aria-hidden="true">${icon}</span><span class="verb-chip-txt">${esc(v.verbId)}</span></button>`;
        })
        .join('');
    return `<div class="benne-verb-chips">${chips}</div>`;
}

function renderInventory(state: InspectorInventoryState): string {
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
        <label class="benne-pg-check benne-inline-check"><input type="checkbox" class="inv-anim-loop" data-id="${esc(anim.id)}" ${anim.loop ? 'checked' : ''} /></label>
        <span class="benne-pg-lbl">frameDuration</span>
        <input type="number" class="inv-anim-dur" data-id="${esc(anim.id)}" value="${anim.frameDuration ?? ''}" />
      </div>`;
            return renderInspectorItem({}, 'inventoryAnimation', anim.id, ' benne-card--character', summary, body);
        })
        .join('');
    const verbChips = renderInventoryVerbChips(state);
    return `<div class="inspector-root">
  <div class="scroll">
    <details class="section" open>
      <summary>Inventory metadata</summary>
      <div class="section-body">
        <div class="benne-prop-grid benne-prop-grid--tight">
          <span class="benne-pg-lbl">id</span>
          <div class="benne-pg-val"><code class="badge">${esc(state.inventoryId)}</code></div>
          <span class="benne-pg-lbl">name</span>
          <input type="text" id="inv-name" value="${esc(state.name)}" />
          <span class="benne-pg-lbl">stackable</span>
          <label class="benne-pg-check benne-inline-check"><input type="checkbox" id="inv-stackable" ${state.stackable ? 'checked' : ''} /></label>
          <span class="benne-pg-lbl">aseprite</span>
          <select id="inv-aseprite">
            <option value="shared" ${state.asepriteMode === 'shared' ? 'selected' : ''}>shared</option>
            <option value="true" ${state.asepriteMode === true ? 'selected' : ''}>per-item</option>
          </select>
          <span class="benne-pg-lbl">default frame tag</span>
          <input type="text" id="inv-default-animation" value="${esc(state.defaultAnimation)}" title="JSON key: defaultAnimation. Empty = use item id." />
          <span class="benne-pg-lbl">cursor clip (active item)</span>
          <input type="text" id="inv-cursor-animation" value="${esc(state.cursorAnimation)}" title="JSON key: cursorAnimation — Aseprite tag on this item’s sheet for the custom game cursor when this item is armed for use-on-target. Leave empty for default cursor." placeholder="(optional) e.g. useCursor" />
        </div>
        <label class="benne-field-label muted small">Description</label>
        <textarea id="inv-description" rows="3">${esc(state.description)}</textarea>
      </div>
    </details>
    <details class="section" open>
      <summary>Verbs</summary>
      <div class="section-body">
        <label class="benne-field-label muted small">Default verb</label>
        ${renderDefaultVerbSelect('inv-default-verb', '', state.defaultVerb, state.availableVerbs, 'title="Verb invoked when inputProfile resolves to \'defaultVerb\' on this inventory item"')}
        <label class="benne-field-label muted small" style="margin-top:10px;">Configured verbs</label>
        ${verbChips}
      </div>
    </details>
    <details class="section" open>
      <summary>Animations (${state.animations.length})</summary>
      <div class="section-body">
        <div class="benne-card-list">${animationCards || '<p class="muted">None</p>'}</div>
      </div>
    </details>
  </div>
  <div class="footer">
    <button type="button" class="btn-primary" id="btn-save-inv">Save</button>
    <button type="button" class="btn-secondary" id="btn-open-json-inv">Open raw JSON</button>
  </div>
</div>`;
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

    root.querySelectorAll('.prop-tag-select').forEach((el) => {
        el.addEventListener('change', () => {
            const sel = el as HTMLSelectElement;
            propPatch(sel.dataset.id ?? '', { tag: sel.value });
        });
    });
    root.querySelectorAll('.prop-default-animation').forEach((el) => {
        el.addEventListener('blur', () => {
            const inp = el as HTMLInputElement;
            propPatch(inp.dataset.id ?? '', { defaultAnimation: inp.value });
        });
    });
    root.querySelectorAll('.prop-default-verb').forEach((el) => {
        el.addEventListener('change', () => {
            const sel = el as HTMLSelectElement;
            propPatch(sel.dataset.id ?? '', { defaultVerb: sel.value });
        });
    });
    root.querySelectorAll('.prop-anim-row').forEach((row) => {
        const flushPropAnim = (): void => {
            if (!(row instanceof HTMLElement)) {
                return;
            }
            const propId = row.dataset.propId ?? '';
            const animationTag = row.dataset.animTag ?? '';
            if (!propId || !animationTag) {
                return;
            }
            const loopEl = row.querySelector('.prop-anim-loop') as HTMLInputElement | null;
            const durEl = row.querySelector('.prop-anim-dur') as HTMLInputElement | null;
            if (!loopEl) {
                return;
            }
            const loop = loopEl.checked;
            const durRaw = durEl?.value ?? '';
            const frameDuration = durRaw === '' ? null : Number(durRaw);
            post('applyPatches', {
                patches: [{ type: 'propAnimation', propId, animationTag, loop, frameDuration }]
            });
        };
        row.querySelectorAll('.prop-anim-loop, .prop-anim-dur').forEach((inp) => {
            inp.addEventListener('change', flushPropAnim);
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
    root.querySelectorAll('.hs-default-verb').forEach((el) => {
        el.addEventListener('change', () => {
            const sel = el as HTMLSelectElement;
            post('applyPatches', { patches: [{ type: 'hotspotField', id: sel.dataset.id, defaultVerb: sel.value }] });
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

    root.querySelectorAll('.btn-inv-usedon').forEach((btn) => {
        btn.addEventListener('click', () => {
            const el = btn as HTMLElement;
            const target = el.dataset.invTarget;
            const targetId = el.dataset.invTargetId ?? '';
            if (target !== 'prop' && target !== 'hotspot' && target !== 'character') {
                return;
            }
            if (!targetId) {
                return;
            }
            post('inventoryUsedOnAdd', {
                roomJsonUri: state.roomJsonUri,
                roomId: state.roomId,
                target,
                targetId
            });
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
        feet: readPointFields('char-feet'),
        defaultVerb: (document.querySelector('.char-default-verb') as HTMLSelectElement | null)?.value ?? ''
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
    document.querySelectorAll('.char-default-verb').forEach((el) => {
        el.addEventListener('change', flush);
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
    document.querySelectorAll('.btn-inv-usedon-char').forEach((btn) => {
        btn.addEventListener('click', () => {
            post('inventoryUsedOnAdd', { characterJsonUri: state.characterJsonUri });
        });
    });
}

function collectGuiMeta(): Record<string, unknown> {
    return {
        type: 'guiMeta',
        name: (document.getElementById('gui-name') as HTMLInputElement | null)?.value ?? '',
        description: (document.getElementById('gui-description') as HTMLTextAreaElement | null)?.value ?? '',
        rootVisibleAtLoad: (document.getElementById('gui-visible') as HTMLInputElement | null)?.checked ?? true
    };
}

function buildGuiControlFieldPatch(
    field: string,
    el: HTMLInputElement | HTMLSelectElement
): Record<string, unknown> | null {
    if (field === 'tag') {
        const raw = el.value.trim();
        return { tag: raw.length === 0 ? null : el.value };
    }
    if (field === 'statesHover' || field === 'statesPressed' || field === 'statesDisabled') {
        const sub = field === 'statesHover' ? 'hover' : field === 'statesPressed' ? 'pressed' : 'disabled';
        const raw = el.value.trim();
        return { states: { [sub]: raw.length === 0 ? null : el.value } };
    }
    if (field === 'enabled') {
        return { enabled: (el as HTMLInputElement).checked ? null : false };
    }
    if (field === 'active') {
        return { active: (el as HTMLInputElement).checked ? null : false };
    }
    if (field === 'name') {
        const raw = (el as HTMLInputElement).value.trim();
        return { name: raw.length === 0 ? null : (el as HTMLInputElement).value };
    }
    if (field === 'visible') {
        const raw = el.value;
        if (raw === '') {
            return { visible: null };
        }
        return { visible: raw === 'true' };
    }
    if (field === 'align') {
        const raw = el.value;
        if (raw === 'left') {
            return { align: null };
        }
        return { align: raw };
    }
    if (field === 'textAlign') {
        const raw = el.value;
        if (raw === '' || raw === 'center') {
            return { textAlign: null };
        }
        return { textAlign: raw };
    }
    if (field === 'scrollDirection') {
        const raw = (el as HTMLSelectElement).value.trim();
        if (raw === '') {
            return { scrollDirection: null };
        }
        if (raw === 'horizontal' || raw === 'vertical') {
            return { scrollDirection: raw };
        }
        return null;
    }
    if (field === 'backButton' || field === 'forwardButton') {
        const raw = (el as HTMLSelectElement).value.trim();
        if (raw === '') {
            return { [field]: null };
        }
        return { [field]: raw };
    }
    const anchorTop = new Set(['backgroundAnchor', 'slotBackgroundAnchor', 'highlightAnchor']);
    if (anchorTop.has(field)) {
        const raw = el.value.trim();
        if (raw === '' || raw === 'top-left') {
            return { [field]: null };
        }
        return { [field]: raw };
    }
    const intRequired = new Set([
        'x',
        'y',
        'rows',
        'cols',
        'slotWidth',
        'slotHeight',
        'fontSize',
        'width',
        'height'
    ]);
    if (intRequired.has(field)) {
        const n = Number((el as HTMLInputElement).value);
        if (!Number.isFinite(n)) {
            return null;
        }
        return { [field]: Math.trunc(n) };
    }
    const optNum = new Set([
        'zIndex',
        'wordWrapWidth',
        'spacingX',
        'spacingY',
        'itemScale',
        'textOffsetX',
        'textOffsetY'
    ]);
    if (optNum.has(field)) {
        const raw = (el as HTMLInputElement).value.trim();
        if (raw === '') {
            return { [field]: null };
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            return null;
        }
        return { [field]: n };
    }
    if (field === 'showEmptySlots') {
        return { showEmptySlots: (el as HTMLInputElement).checked };
    }
    const tagStr = new Set([
        'text',
        'font',
        'color',
        'textColor',
        'backgroundTag',
        'slotBackgroundTag',
        'highlightTag'
    ]);
    if (tagStr.has(field)) {
        return { [field]: el.value };
    }
    return null;
}

function mountGuiHandlers(state: InspectorGuiState): void {
    const flushMeta = (): void => {
        post('applyPatches', { patches: [collectGuiMeta()] });
    };
    const postGuiPatch = (index: number, patch: Record<string, unknown>): void => {
        post('applyPatches', { patches: [{ type: 'guiControlUpdate', index, patch }] });
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
    document.getElementById('gui-visible')?.addEventListener('change', flushMeta);
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

    const bindGuiField = (el: Element): void => {
        if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) {
            return;
        }
        const he = el as HTMLInputElement | HTMLSelectElement;
        const idx = Number(he.dataset.index ?? '-1');
        const field = he.dataset.field ?? '';
        if (!Number.isInteger(idx) || idx < 0 || !field) {
            return;
        }
        const flush = (): void => {
            const patch = buildGuiControlFieldPatch(field, he);
            if (patch) {
                postGuiPatch(idx, patch);
            }
        };
        if (he instanceof HTMLSelectElement) {
            he.addEventListener('change', flush);
        } else {
            he.addEventListener('blur', flush);
        }
    };
    document.getElementById('btn-add-gui-control')?.addEventListener('click', () => {
        post('addGuiControl', {});
    });
    document.querySelectorAll('.gui-field').forEach(bindGuiField);
    document.querySelectorAll('.gui-field-cb').forEach((el) => {
        if (!(el instanceof HTMLInputElement)) {
            return;
        }
        const he = el;
        const idx = Number(he.dataset.index ?? '-1');
        const field = he.dataset.field ?? '';
        if (!Number.isInteger(idx) || idx < 0 || !field) {
            return;
        }
        he.addEventListener('change', () => {
            const patch = buildGuiControlFieldPatch(field, he);
            if (patch) {
                postGuiPatch(idx, patch);
            }
        });
    });
    document.querySelectorAll('.gui-on-click-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const b = btn as HTMLButtonElement;
            const buttonId = b.dataset.buttonId ?? '';
            if (!buttonId) {
                return;
            }
            post('guiEnsureButtonClickHandler', { guiJsonUri: state.guiJsonUri, buttonId });
        });
    });
}

function collectInventoryMeta(): Record<string, unknown> {
    return {
        type: 'inventoryMeta',
        name: (document.getElementById('inv-name') as HTMLInputElement | null)?.value ?? '',
        description: (document.getElementById('inv-description') as HTMLTextAreaElement | null)?.value ?? '',
        stackable: (document.getElementById('inv-stackable') as HTMLInputElement | null)?.checked ?? false,
        defaultAnimation:
            (document.getElementById('inv-default-animation') as HTMLInputElement | null)?.value ?? '',
        cursorAnimation:
            (document.getElementById('inv-cursor-animation') as HTMLInputElement | null)?.value ?? '',
        asepriteMode:
            ((document.getElementById('inv-aseprite') as HTMLSelectElement | null)?.value ?? 'shared') ===
            'true'
                ? true
                : 'shared',
        defaultVerb: (document.querySelector('.inv-default-verb') as HTMLSelectElement | null)?.value ?? ''
    };
}

function mountInventoryHandlers(state: InspectorInventoryState): void {
    const flushMeta = (): void => {
        post('applyPatches', { patches: [collectInventoryMeta()] });
    };
    document.getElementById('btn-save-inv')?.addEventListener('click', () => {
        post('applyPatches', {
            patches: [collectInventoryMeta()]
        });
    });
    document.getElementById('btn-open-json-inv')?.addEventListener('click', () => {
        post('openRawJson', { inventoryJsonUri: state.inventoryJsonUri });
    });
    ['inv-name', 'inv-description', 'inv-stackable', 'inv-default-animation', 'inv-cursor-animation', 'inv-aseprite'].forEach((id) => {
        document.getElementById(id)?.addEventListener('blur', flushMeta);
        document.getElementById(id)?.addEventListener('change', flushMeta);
    });
    document.querySelectorAll('.inv-default-verb').forEach((el) => {
        el.addEventListener('change', flushMeta);
    });
    document.querySelectorAll('.inv-verb-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const b = btn as HTMLButtonElement;
            if (b.dataset.reveal) {
                post('verbReveal', {
                    inventoryJsonUri: state.inventoryJsonUri,
                    itemId: state.inventoryId,
                    eventId: b.dataset.event
                });
                return;
            }
            if (!b.dataset.add) {
                return;
            }
            const verbId = b.dataset.verb ?? '';
            post('verbAdd', {
                inventoryJsonUri: state.inventoryJsonUri,
                target: 'inventoryDef',
                itemId: state.inventoryId,
                verbId
            });
        });
    });
    document.querySelectorAll('.inv-anim-loop, .inv-anim-dur').forEach((el) => {
        el.addEventListener('change', () => {
            const id = (el as HTMLElement).dataset.id ?? '';
            if (!id) {
                return;
            }
            const loop = (document.querySelector(`.inv-anim-loop[data-id="${id}"]`) as HTMLInputElement | null)?.checked ?? false;
            const durRaw = (document.querySelector(`.inv-anim-dur[data-id="${id}"]`) as HTMLInputElement | null)?.value ?? '';
            const frameDuration = durRaw === '' ? null : Number(durRaw);
            post('applyPatches', { patches: [{ type: 'inventoryAnimation', id, loop, frameDuration }] });
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
    } else if (state.kind === 'inventory') {
        root.innerHTML = renderInventory(state);
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
    } else if (state.kind === 'inventory') {
        mountInventoryHandlers(state);
    } else {
        mountGuiHandlers(state);
        scrollExpandedGuiCardIntoView(state);
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type?: string; state?: InspectorStatePayload };
    if (msg?.type === 'benne/inspector/state' && msg.state) {
        render(msg.state);
    }
});

render({ kind: 'empty', message: 'Loading…' });
