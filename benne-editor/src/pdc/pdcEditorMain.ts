import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';

declare function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void;
};

const vscode = acquireVsCodeApi();

let cy: Core | undefined;
let currentUri = '';
let fileId = '';
let fileName = '';
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** First node id chosen in “link” mode; tap another node to add an edge. */
let linkPickFrom: string | undefined;

let isPanning = false;
let panLastX = 0;
let panLastY = 0;

let isBoxSelecting = false;
let boxStartX = 0;
let boxStartY = 0;

let editingNode: cytoscape.NodeSingular | undefined;

let mountAbort: AbortController | undefined;

const NODE_DEFAULT_WIDTH = 88;
const NODE_DEFAULT_HEIGHT = 44;
const NODE_MIN_WIDTH = 50;
const NODE_MIN_HEIGHT = 30;
const NODE_FONT_SIZE = 11;
const NODE_PADDING = 12;

let resizeTarget: cytoscape.NodeSingular | undefined;
let resizeHandle: string | undefined;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartPosX = 0;
let resizeStartPosY = 0;

function normalizeElements(raw: Record<string, unknown>): ElementDefinition[] {
    const el = raw.elements;
    if (Array.isArray(el)) {
        return el.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as ElementDefinition[];
    }
    if (el && typeof el === 'object' && !Array.isArray(el)) {
        const o = el as { nodes?: unknown; edges?: unknown };
        const nodes = Array.isArray(o.nodes) ? o.nodes : [];
        const edges = Array.isArray(o.edges) ? o.edges : [];
        const out: ElementDefinition[] = [];
        for (const n of nodes) {
            if (n && typeof n === 'object' && !Array.isArray(n)) {
                out.push(n as ElementDefinition);
            }
        }
        for (const e of edges) {
            if (e && typeof e === 'object' && !Array.isArray(e)) {
                out.push(e as ElementDefinition);
            }
        }
        return out;
    }
    return [];
}

function newNodeId(): string {
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function newEdgeId(source: string, target: string): string {
    return `e_${source}_${target}_${Math.random().toString(36).slice(2, 9)}`;
}

function postSave(): void {
    if (!cy || !currentUri) {
        return;
    }
    const elements: ElementDefinition[] = cy.elements().map((ele) => {
        const data = { ...ele.data() };
        if (ele.isNode()) {
            const p = ele.position();
            return {
                data,
                position: { x: p.x, y: p.y }
            } as ElementDefinition;
        }
        return { data } as ElementDefinition;
    });

    const payload = {
        id: fileId,
        name: fileName,
        elements
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;

    if (saveTimer !== undefined) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        vscode.postMessage({
            type: 'benne/pdcEditor/save',
            documentUri: currentUri,
            json
        });
    }, 450);
}

function baseStylesheet(): import('cytoscape').StylesheetStyle[] {
    return [
        {
            selector: 'node',
            style: {
                label: 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'text-max-width': 'data(textMaxWidth)',
                'background-color': '#3c7eb5',
                color: '#fff',
                width: 'data(width)',
                height: 'data(height)',
                shape: 'roundrectangle',
                'font-size': NODE_FONT_SIZE,
                'border-width': 1,
                'border-color': '#1a4971'
            } as unknown as cytoscape.Css.Node
        },
        {
            selector: 'node:selected',
            style: {
                'border-width': 3,
                'border-color': '#f9a825'
            }
        },
        {
            selector: 'edge',
            style: {
                width: 2,
                'line-color': '#8ab4d4',
                'target-arrow-color': '#8ab4d4',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.1
            }
        },
        {
            selector: 'edge:selected',
            style: {
                'line-color': '#f9a825',
                'target-arrow-color': '#f9a825'
            }
        }
    ];
}

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

function measureTextForNode(label: string, maxWidth: number): { width: number; height: number } {
    measureCtx.font = `${NODE_FONT_SIZE}px sans-serif`;
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (measureCtx.measureText(test).width > maxWidth) {
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = word;
        } else {
            currentLine = test;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    if (lines.length === 0) {
        lines.push('');
    }

    const lineHeight = NODE_FONT_SIZE * 1.3;
    let widest = 0;
    for (const line of lines) {
        widest = Math.max(widest, measureCtx.measureText(line).width);
    }
    return {
        width: widest,
        height: lines.length * lineHeight
    };
}

function ensureNodeDimensions(node: cytoscape.NodeSingular): void {
    if (node.data('width') == null) {
        node.data('width', NODE_DEFAULT_WIDTH);
    }
    if (node.data('height') == null) {
        node.data('height', NODE_DEFAULT_HEIGHT);
    }
    if (node.data('textMaxWidth') == null) {
        node.data('textMaxWidth', (node.data('width') as number) - NODE_PADDING);
    }
}

function autoSizeNode(node: cytoscape.NodeSingular): void {
    const label = (node.data('label') as string | undefined) ?? '';
    const currentW = (node.data('width') as number) || NODE_DEFAULT_WIDTH;
    const currentH = (node.data('height') as number) || NODE_DEFAULT_HEIGHT;
    const textMaxW = currentW - NODE_PADDING;

    const measured = measureTextForNode(label, textMaxW);
    const neededH = measured.height + NODE_PADDING * 2;

    let newW = currentW;
    let newH = currentH;

    if (neededH > currentH) {
        newH = Math.ceil(neededH);
    }

    if (measured.width + NODE_PADDING > currentW) {
        newW = Math.ceil(measured.width + NODE_PADDING * 2);
        const remeasured = measureTextForNode(label, newW - NODE_PADDING);
        newH = Math.max(newH, Math.ceil(remeasured.height + NODE_PADDING * 2));
    }

    newW = Math.max(newW, NODE_MIN_WIDTH);
    newH = Math.max(newH, NODE_MIN_HEIGHT);

    if (newW !== currentW || newH !== currentH) {
        node.data('width', newW);
        node.data('height', newH);
        node.data('textMaxWidth', newW - NODE_PADDING);
    }
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLE_IDS: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_SIZE = 8;

function getOrCreateHandleElements(): Map<HandleId, HTMLElement> {
    const wrapper = document.getElementById('pdc-cy-wrapper');
    if (!wrapper) {
        return new Map();
    }
    const map = new Map<HandleId, HTMLElement>();
    for (const hid of HANDLE_IDS) {
        const elId = `pdc-resize-${hid}`;
        let el = document.getElementById(elId);
        if (!el) {
            el = document.createElement('div');
            el.id = elId;
            el.className = 'pdc-resize-handle';
            el.dataset.handle = hid;
            wrapper.appendChild(el);
        }
        map.set(hid, el);
    }
    return map;
}

function cursorForHandle(hid: HandleId): string {
    switch (hid) {
        case 'nw': return 'nwse-resize';
        case 'se': return 'nwse-resize';
        case 'ne': return 'nesw-resize';
        case 'sw': return 'nesw-resize';
        case 'n': return 'ns-resize';
        case 's': return 'ns-resize';
        case 'e': return 'ew-resize';
        case 'w': return 'ew-resize';
    }
}

function showResizeHandlesForNode(node: cytoscape.NodeSingular): void {
    const handles = getOrCreateHandleElements();
    const bb = node.renderedBoundingBox();
    const cx = (bb.x1 + bb.x2) / 2;
    const cy_ = (bb.y1 + bb.y2) / 2;
    const half = HANDLE_SIZE / 2;

    const positions: Record<HandleId, { x: number; y: number }> = {
        nw: { x: bb.x1, y: bb.y1 },
        n: { x: cx, y: bb.y1 },
        ne: { x: bb.x2, y: bb.y1 },
        e: { x: bb.x2, y: cy_ },
        se: { x: bb.x2, y: bb.y2 },
        s: { x: cx, y: bb.y2 },
        sw: { x: bb.x1, y: bb.y2 },
        w: { x: bb.x1, y: cy_ }
    };

    for (const hid of HANDLE_IDS) {
        const el = handles.get(hid)!;
        const pos = positions[hid];
        el.style.left = `${pos.x - half}px`;
        el.style.top = `${pos.y - half}px`;
        el.style.width = `${HANDLE_SIZE}px`;
        el.style.height = `${HANDLE_SIZE}px`;
        el.style.cursor = cursorForHandle(hid);
        el.style.display = 'block';
    }
}

function hideResizeHandles(): void {
    for (const hid of HANDLE_IDS) {
        const el = document.getElementById(`pdc-resize-${hid}`);
        if (el) {
            el.style.display = 'none';
        }
    }
}

function updateResizeHandles(): void {
    if (!cy) {
        hideResizeHandles();
        return;
    }
    const sel = cy.$('node:selected');
    if (sel.length === 1 && !editingNode && !resizeTarget) {
        showResizeHandlesForNode(sel.first());
    } else {
        hideResizeHandles();
    }
}

function positionInlineInput(input: HTMLElement, node: cytoscape.NodeSingular): void {
    const bb = node.renderedBoundingBox();
    const nodeW = bb.x2 - bb.x1;
    const nodeH = bb.y2 - bb.y1;
    const minW = Math.max(nodeW, 200);
    const offsetX = (minW - nodeW) / 2;
    input.style.left = `${bb.x1 - offsetX}px`;
    input.style.top = `${bb.y1}px`;
    input.style.width = `${minW}px`;
    input.style.minHeight = `${nodeH}px`;
}

function autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function commitInlineEdit(): void {
    const input = document.getElementById('pdc-inline-input') as HTMLTextAreaElement | null;
    if (!input || !editingNode) {
        return;
    }
    const val = input.value.trim();
    editingNode.data('label', val.length > 0 ? val : ' ');
    autoSizeNode(editingNode);
    editingNode.unlock();
    const wasEditing = editingNode;
    editingNode = undefined;
    input.style.display = 'none';
    updateResizeHandles();
    if (wasEditing.selected()) {
        showResizeHandlesForNode(wasEditing);
    }
    postSave();
    setStatus('');
}

function cancelInlineEdit(): void {
    const input = document.getElementById('pdc-inline-input') as HTMLTextAreaElement | null;
    if (!input || !editingNode) {
        return;
    }
    editingNode.unlock();
    editingNode = undefined;
    input.style.display = 'none';
    setStatus('');
}

function beginEditNodeLabel(node: cytoscape.NodeSingular): void {
    if (editingNode) {
        commitInlineEdit();
    }
    const input = document.getElementById('pdc-inline-input') as HTMLTextAreaElement | null;
    if (!input || !cy) {
        return;
    }
    hideResizeHandles();
    editingNode = node;
    node.lock();
    positionInlineInput(input, node);
    const prev = (node.data('label') as string | undefined) ?? '';
    input.value = prev;
    input.style.display = 'block';
    autoResizeTextarea(input);
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function bindLinkTapHandler(): void {
    if (!cy) {
        return;
    }
    cy.on('tap', 'node', (evt) => {
        if (!linkPickFrom) {
            return;
        }
        const nid = String(evt.target.id());
        if (nid === linkPickFrom) {
            return;
        }
        const id = newEdgeId(linkPickFrom, nid);
        cy?.add({
            group: 'edges',
            data: { id, source: linkPickFrom, target: nid }
        });
        linkPickFrom = undefined;
        syncLinkButton();
        setStatus('');
        postSave();
    });
}

function destroyGraph(): void {
    if (editingNode) {
        cancelInlineEdit();
    }
    hideResizeHandles();
    resizeTarget = undefined;
    resizeHandle = undefined;
    mountAbort?.abort();
    mountAbort = undefined;
    isPanning = false;
    isBoxSelecting = false;
    const selBox = document.getElementById('pdc-selection-box');
    if (selBox) {
        selBox.style.display = 'none';
    }
    if (cy) {
        cy.destroy();
        cy = undefined;
    }
}

function mountGraph(container: HTMLElement, elements: ElementDefinition[]): void {
    destroyGraph();
    cy = cytoscape({
        container,
        elements,
        style: baseStylesheet(),
        layout:
            elements.length > 0
                ? { name: 'preset', fit: true, padding: 40 }
                : { name: 'grid', rows: 1, cols: 1, fit: true, padding: 40 },
        minZoom: 0.15,
        maxZoom: 4,
        userPanningEnabled: false,
        userZoomingEnabled: false,
        boxSelectionEnabled: false
    });

    const graph = cy;

    graph.nodes().forEach((node) => {
        ensureNodeDimensions(node);
        autoSizeNode(node);
    });

    graph.on('dragfreeon', 'node', () => postSave());
    graph.on('position', 'node', () => {
        postSave();
        updateResizeHandles();
    });
    bindLinkTapHandler();

    graph.on('dbltap', 'node', (evt) => {
        beginEditNodeLabel(evt.target);
    });

    graph.on('dbltap', (evt) => {
        if (evt.target !== graph) {
            return;
        }
        const pos = evt.position;
        const id = newNodeId();
        graph.add({
            group: 'nodes',
            data: { id, label: 'Step', width: NODE_DEFAULT_WIDTH, height: NODE_DEFAULT_HEIGHT, textMaxWidth: NODE_DEFAULT_WIDTH - NODE_PADDING },
            position: { x: pos.x, y: pos.y }
        });
        postSave();
    });

    graph.on('viewport', () => {
        if (editingNode) {
            const input = document.getElementById('pdc-inline-input') as HTMLTextAreaElement | null;
            if (input) {
                positionInlineInput(input, editingNode);
                autoResizeTextarea(input);
            }
        }
        updateResizeHandles();
    });

    graph.on('select unselect', 'node', () => {
        updateResizeHandles();
    });

    graph.on('mousedown', (evt) => {
        if (evt.target !== graph) {
            return;
        }
        const oe = evt.originalEvent as MouseEvent;
        if (oe.button !== 0) {
            return;
        }
        if (editingNode) {
            commitInlineEdit();
        }
        const rect = container.getBoundingClientRect();
        isBoxSelecting = true;
        boxStartX = oe.clientX - rect.left;
        boxStartY = oe.clientY - rect.top;
    });

    mountAbort = new AbortController();
    const { signal } = mountAbort;

    container.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!cy) {
            return;
        }
        const currentZoom = cy.zoom();
        const diff = (e.deltaY / -250) * currentZoom * 0.35;
        const newZoom = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), currentZoom + diff));
        const rect = container.getBoundingClientRect();
        cy.zoom({
            level: newZoom,
            renderedPosition: {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            }
        });
    }, { signal, passive: false });

    container.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            isPanning = true;
            panLastX = e.clientX;
            panLastY = e.clientY;
        }
    }, { signal });

    const wrapper = document.getElementById('pdc-cy-wrapper')!;
    wrapper.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('pdc-resize-handle') || e.button !== 0) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const hid = target.dataset.handle as HandleId | undefined;
        if (!hid || !cy) {
            return;
        }
        const sel = cy.$('node:selected');
        if (sel.empty()) {
            return;
        }
        const node = sel.first();
        resizeTarget = node;
        resizeHandle = hid;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = (node.data('width') as number) || NODE_DEFAULT_WIDTH;
        resizeStartH = (node.data('height') as number) || NODE_DEFAULT_HEIGHT;
        const pos = node.position();
        resizeStartPosX = pos.x;
        resizeStartPosY = pos.y;
        node.lock();
        hideResizeHandles();
    }, { signal });

    window.addEventListener('mousemove', (e) => {
        if (resizeTarget && resizeHandle && cy) {
            const zoom = cy.zoom();
            const dx = (e.clientX - resizeStartX) / zoom;
            const dy = (e.clientY - resizeStartY) / zoom;
            let newW = resizeStartW;
            let newH = resizeStartH;
            let newPosX = resizeStartPosX;
            let newPosY = resizeStartPosY;

            if (resizeHandle.includes('e')) {
                newW = Math.max(NODE_MIN_WIDTH, resizeStartW + dx);
                newPosX = resizeStartPosX + (newW - resizeStartW) / 2;
            }
            if (resizeHandle.includes('w')) {
                newW = Math.max(NODE_MIN_WIDTH, resizeStartW - dx);
                newPosX = resizeStartPosX - (newW - resizeStartW) / 2;
            }
            if (resizeHandle.includes('s')) {
                newH = Math.max(NODE_MIN_HEIGHT, resizeStartH + dy);
                newPosY = resizeStartPosY + (newH - resizeStartH) / 2;
            }
            if (resizeHandle.includes('n')) {
                newH = Math.max(NODE_MIN_HEIGHT, resizeStartH - dy);
                newPosY = resizeStartPosY - (newH - resizeStartH) / 2;
            }

            resizeTarget.data('width', Math.round(newW));
            resizeTarget.data('height', Math.round(newH));
            resizeTarget.data('textMaxWidth', Math.round(newW) - NODE_PADDING);
            resizeTarget.position({ x: newPosX, y: newPosY });
            return;
        }

        if (isPanning && cy) {
            const dx = e.clientX - panLastX;
            const dy = e.clientY - panLastY;
            panLastX = e.clientX;
            panLastY = e.clientY;
            cy.panBy({ x: dx, y: dy });
        }
        if (isBoxSelecting) {
            const rect = container.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;
            const selBox = document.getElementById('pdc-selection-box');
            if (selBox) {
                selBox.style.display = 'block';
                selBox.style.left = `${Math.min(boxStartX, curX)}px`;
                selBox.style.top = `${Math.min(boxStartY, curY)}px`;
                selBox.style.width = `${Math.abs(curX - boxStartX)}px`;
                selBox.style.height = `${Math.abs(curY - boxStartY)}px`;
            }
        }
    }, { signal });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && resizeTarget) {
            resizeTarget.unlock();
            resizeTarget = undefined;
            resizeHandle = undefined;
            updateResizeHandles();
            postSave();
            return;
        }
        if (e.button === 2) {
            isPanning = false;
        }
        if (e.button === 0 && isBoxSelecting) {
            isBoxSelecting = false;
            const selBox = document.getElementById('pdc-selection-box');
            if (selBox) {
                selBox.style.display = 'none';
            }
            const rect = container.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            const x1 = Math.min(boxStartX, endX);
            const y1 = Math.min(boxStartY, endY);
            const x2 = Math.max(boxStartX, endX);
            const y2 = Math.max(boxStartY, endY);
            if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) {
                return;
            }
            if (!e.shiftKey) {
                cy?.elements().unselect();
            }
            cy?.nodes().forEach((node) => {
                const bb = node.renderedBoundingBox();
                if (bb.x1 < x2 && bb.x2 > x1 && bb.y1 < y2 && bb.y2 > y1) {
                    node.select();
                }
            });
        }
    }, { signal });
}

const linkBtn = document.getElementById('pdc-link') as HTMLButtonElement | null;

function syncLinkButton(): void {
    if (!linkBtn) {
        return;
    }
    if (linkPickFrom) {
        linkBtn.textContent = 'Cancel link';
        linkBtn.classList.add('active');
    } else {
        linkBtn.textContent = 'Link nodes';
        linkBtn.classList.remove('active');
    }
}

function setStatus(msg: string): void {
    const el = document.getElementById('pdc-status');
    if (el) {
        el.textContent = msg;
    }
}

function applyLoad(msg: { documentUri?: string; payload?: Record<string, unknown> }): void {
    const uri = typeof msg.documentUri === 'string' ? msg.documentUri : '';
    const payload = msg.payload;
    if (!uri || !payload || typeof payload !== 'object') {
        return;
    }
    currentUri = uri;
    const o = payload as Record<string, unknown>;
    fileId = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : 'chart';
    fileName = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : fileId;

    const elements = normalizeElements(o);
    const host = document.getElementById('pdc-cy');
    if (!(host instanceof HTMLElement)) {
        return;
    }
    linkPickFrom = undefined;
    syncLinkButton();
    mountGraph(host, elements);
    setStatus('');
}

function applyClear(): void {
    currentUri = '';
    fileId = '';
    fileName = '';
    linkPickFrom = undefined;
    syncLinkButton();
    const host = document.getElementById('pdc-cy');
    if (host instanceof HTMLElement) {
        mountGraph(host, []);
    }
    setStatus('');
}

window.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as { type?: string; documentUri?: string; payload?: Record<string, unknown> };
    switch (msg?.type) {
        case 'benne/pdcEditor/load':
            applyLoad(msg);
            return;
        case 'benne/pdcEditor/clear':
            applyClear();
            return;
        default:
            return;
    }
});

document.getElementById('pdc-add-node')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const id = newNodeId();
    const w = cy.width();
    const h = cy.height();
    const pan = cy.pan();
    const z = cy.zoom();
    const cx = (w / 2 - pan.x) / z;
    const cyC = (h / 2 - pan.y) / z;
    cy.add({
        group: 'nodes',
        data: { id, label: 'Step', width: NODE_DEFAULT_WIDTH, height: NODE_DEFAULT_HEIGHT, textMaxWidth: NODE_DEFAULT_WIDTH - NODE_PADDING },
        position: { x: cx, y: cyC }
    });
    postSave();
});

linkBtn?.addEventListener('click', () => {
    if (linkPickFrom) {
        linkPickFrom = undefined;
        syncLinkButton();
        setStatus('');
        return;
    }
    const sel = cy?.$('node:selected');
    const first = sel && !sel.empty() ? String(sel.first().id()) : undefined;
    if (!first) {
        setStatus('Select a source node, then press “Link nodes”.');
        return;
    }
    linkPickFrom = first;
    syncLinkButton();
    setStatus('Tap a target node.');
});

document.getElementById('pdc-edit-label')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$('node:selected');
    if (sel.empty()) {
        setStatus('Select a node first.');
        return;
    }
    const node = sel.first();
    if (!node.isNode()) {
        return;
    }
    beginEditNodeLabel(node);
});

document.getElementById('pdc-delete')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$(':selected');
    if (sel.empty()) {
        setStatus('Select node(s) or edge(s) first.');
        return;
    }
    sel.remove();
    postSave();
    setStatus('');
});

document.getElementById('pdc-fit')?.addEventListener('click', () => {
    cy?.fit(undefined, 48);
});

const inlineInput = document.getElementById('pdc-inline-input') as HTMLTextAreaElement | null;
inlineInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitInlineEdit();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelInlineEdit();
    }
});
inlineInput?.addEventListener('input', () => {
    if (inlineInput) {
        autoResizeTextarea(inlineInput);
    }
});
inlineInput?.addEventListener('blur', () => {
    if (editingNode) {
        commitInlineEdit();
    }
});

vscode.postMessage({ type: 'benne/pdcEditor/ready' });
