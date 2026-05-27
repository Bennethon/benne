import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import elk from 'cytoscape-elk';
import compoundDragAndDrop from 'cytoscape-compound-drag-and-drop';
import svg from 'cytoscape-svg';

cytoscape.use(elk);
cytoscape.use(compoundDragAndDrop);
cytoscape.use(svg);

declare function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void;
};

const vscode = acquireVsCodeApi();

let cy: Core | undefined;
let currentUri = '';
let fileId = '';
let fileName = '';
let saveTimer: ReturnType<typeof setTimeout> | undefined;

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

let isConnecting = false;
let connectSource: cytoscape.NodeSingular | undefined;
let hoveredForConnect: cytoscape.NodeSingular | undefined;
let connectLineStartX = 0;
let connectLineStartY = 0;
let connectHandleSource: cytoscape.NodeSingular | undefined;
let connectHandleHideTimer: ReturnType<typeof setTimeout> | undefined;
let mouseOverConnectHandle = false;

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
            if (data.isGroup) {
                return { data } as ElementDefinition;
            }
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
                'background-color': '#ffffff',
                color: '#000',
                width: 'data(width)',
                height: 'data(height)',
                shape: 'roundrectangle',
                'font-size': NODE_FONT_SIZE,
                'border-width': 1,
                'border-color': '#bbb'
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
                'source-arrow-color': '#8ab4d4',
                'target-arrow-shape': 'triangle',
                'source-arrow-shape': 'none',
                'curve-style': 'data(curveStyle)' as unknown as undefined,
                'line-style': 'data(lineStyle)' as unknown as undefined,
                'taxi-direction': 'auto' as unknown as undefined,
                'arrow-scale': 1.1
            }
        },
        {
            selector: 'edge[direction = "backward"]',
            style: {
                'target-arrow-shape': 'none',
                'source-arrow-shape': 'triangle'
            }
        },
        {
            selector: 'edge[direction = "both"]',
            style: {
                'source-arrow-shape': 'triangle'
            }
        },
        {
            selector: 'edge:selected',
            style: {
                'line-color': '#f9a825',
                'target-arrow-color': '#f9a825',
                'source-arrow-color': '#f9a825'
            }
        },
        {
            selector: 'node.pdc-connect-target',
            style: {
                'border-color': '#f9a825',
                'border-width': 3,
                'border-opacity': 0.85
            }
        },
        {
            selector: 'node[?isGroup]',
            style: {
                'background-color': '#1a1a2e',
                'background-opacity': 0.35,
                'border-width': 2,
                'border-color': '#666',
                'border-style': 'dashed' as unknown as undefined,
                shape: 'roundrectangle',
                'text-valign': 'top',
                'text-halign': 'center',
                'text-margin-y': -4,
                'font-size': NODE_FONT_SIZE,
                color: '#aaa',
                padding: '20px' as unknown as undefined,
                label: 'data(label)',
            } as unknown as cytoscape.Css.Node
        },
        {
            selector: 'node[?isGroup]:selected',
            style: {
                'border-width': 3,
                'border-color': '#f9a825'
            }
        },
        {
            selector: 'node.cdnd-drop-target',
            style: {
                'border-color': '#4fc3f7',
                'border-width': 3,
                'background-color': '#1a3a4e',
                'background-opacity': 0.5
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

function ensureEdgeDefaults(edge: cytoscape.EdgeSingular): void {
    if (edge.data('curveStyle') == null) {
        edge.data('curveStyle', 'bezier');
    }
    if (edge.data('lineStyle') == null) {
        edge.data('lineStyle', 'solid');
    }
    if (edge.data('direction') == null) {
        edge.data('direction', 'forward');
    }
}

function ensureNodeDimensions(node: cytoscape.NodeSingular): void {
    if (node.data('isGroup')) {
        return;
    }
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
    if (node.data('isGroup')) {
        return;
    }
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
        const node = sel.first() as cytoscape.NodeSingular;
        if (node.data('isGroup')) {
            hideResizeHandles();
        } else {
            showResizeHandlesForNode(node);
        }
    } else {
        hideResizeHandles();
    }
}

type ConnectSide = 'top' | 'right' | 'bottom' | 'left';
const CONNECT_SIDES: ConnectSide[] = ['top', 'right', 'bottom', 'left'];
const CONNECT_HANDLE_SIZE = 14;
const CONNECT_HANDLE_OFFSET = 12;

function getOrCreateConnectHandles(): Map<ConnectSide, HTMLElement> {
    const wrapper = document.getElementById('pdc-cy-wrapper');
    if (!wrapper) {
        return new Map();
    }
    const map = new Map<ConnectSide, HTMLElement>();
    for (const side of CONNECT_SIDES) {
        const elId = `pdc-connect-${side}`;
        let el = document.getElementById(elId);
        if (!el) {
            el = document.createElement('div');
            el.id = elId;
            el.className = 'pdc-connect-handle';
            el.dataset.connectSide = side;
            el.title = 'Drag to connect to another node';
            wrapper.appendChild(el);
        }
        map.set(side, el);
    }
    return map;
}

function showConnectHandleForNode(node: cytoscape.NodeSingular): void {
    if (connectHandleHideTimer !== undefined) {
        clearTimeout(connectHandleHideTimer);
        connectHandleHideTimer = undefined;
    }
    const handles = getOrCreateConnectHandles();
    const bb = node.renderedBoundingBox();
    const half = CONNECT_HANDLE_SIZE / 2;
    const cx = (bb.x1 + bb.x2) / 2;
    const cy_ = (bb.y1 + bb.y2) / 2;

    const positions: Record<ConnectSide, { x: number; y: number }> = {
        top:    { x: cx,                        y: bb.y1 - CONNECT_HANDLE_OFFSET },
        right:  { x: bb.x2 + CONNECT_HANDLE_OFFSET, y: cy_ },
        bottom: { x: cx,                        y: bb.y2 + CONNECT_HANDLE_OFFSET },
        left:   { x: bb.x1 - CONNECT_HANDLE_OFFSET, y: cy_ },
    };

    for (const side of CONNECT_SIDES) {
        const el = handles.get(side)!;
        const pos = positions[side];
        el.style.left = `${pos.x - half}px`;
        el.style.top = `${pos.y - half}px`;
        el.style.width = `${CONNECT_HANDLE_SIZE}px`;
        el.style.height = `${CONNECT_HANDLE_SIZE}px`;
        el.style.display = 'block';
        if (!el.dataset.hasListeners) {
            el.addEventListener('mouseenter', () => {
                mouseOverConnectHandle = true;
                if (connectHandleHideTimer !== undefined) {
                    clearTimeout(connectHandleHideTimer);
                    connectHandleHideTimer = undefined;
                }
            });
            el.addEventListener('mouseleave', () => {
                mouseOverConnectHandle = false;
                scheduleConnectHandleHide();
            });
            el.dataset.hasListeners = '1';
        }
    }
    connectHandleSource = node;
}

function hideConnectHandle(): void {
    if (connectHandleHideTimer !== undefined) {
        clearTimeout(connectHandleHideTimer);
        connectHandleHideTimer = undefined;
    }
    for (const side of CONNECT_SIDES) {
        const el = document.getElementById(`pdc-connect-${side}`);
        if (el) {
            el.style.display = 'none';
        }
    }
    mouseOverConnectHandle = false;
    connectHandleSource = undefined;
}

function scheduleConnectHandleHide(): void {
    if (connectHandleHideTimer !== undefined) {
        clearTimeout(connectHandleHideTimer);
    }
    connectHandleHideTimer = setTimeout(() => {
        connectHandleHideTimer = undefined;
        if (!mouseOverConnectHandle) {
            updateConnectHandle();
        }
    }, 200);
}

function updateConnectHandle(): void {
    if (!cy || isConnecting || editingNode || resizeTarget) {
        hideConnectHandle();
        return;
    }
    let targetNode: cytoscape.NodeSingular | undefined;
    if (hoveredForConnect) {
        try {
            if (hoveredForConnect.inside && hoveredForConnect.inside()) {
                targetNode = hoveredForConnect;
            }
        } catch {
            hoveredForConnect = undefined;
        }
    }
    if (!targetNode) {
        const sel = cy.$('node:selected');
        if (sel.length === 1) {
            targetNode = sel.first() as cytoscape.NodeSingular;
        }
    }
    if (targetNode) {
        showConnectHandleForNode(targetNode);
    } else {
        hideConnectHandle();
    }
}

function getNodeUnderClientPoint(clientX: number, clientY: number): cytoscape.NodeSingular | null {
    if (!cy) {
        return null;
    }
    const cyEl = document.getElementById('pdc-cy');
    if (!cyEl) {
        return null;
    }
    const crect = cyEl.getBoundingClientRect();
    const sx = clientX - crect.left;
    const sy = clientY - crect.top;
    const nodes = cy.nodes();
    let bestLeaf: cytoscape.NodeSingular | null = null;
    let bestGroup: cytoscape.NodeSingular | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const bb = n.renderedBoundingBox();
        if (sx >= bb.x1 && sx <= bb.x2 && sy >= bb.y1 && sy <= bb.y2) {
            if (n.data('isGroup')) {
                if (!bestGroup) {
                    bestGroup = n;
                }
            } else {
                bestLeaf = n;
                break;
            }
        }
    }
    return bestLeaf ?? bestGroup;
}

function showConnectPreview(x1: number, y1: number, x2: number, y2: number): void {
    const svg = document.getElementById('pdc-connect-svg') as SVGSVGElement | null;
    const line = document.getElementById('pdc-connect-line') as SVGLineElement | null;
    if (!svg || !line) {
        return;
    }
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    svg.style.display = 'block';
}

function hideConnectPreview(): void {
    const svg = document.getElementById('pdc-connect-svg') as SVGSVGElement | null;
    if (svg) {
        svg.style.display = 'none';
    }
}

function startConnectionDrag(source: cytoscape.NodeSingular, startClientX: number, startClientY: number, side: ConnectSide = 'right'): void {
    if (!cy) {
        return;
    }
    isConnecting = true;
    connectSource = source;
    document.body.style.cursor = 'crosshair';
    const wrapper = document.getElementById('pdc-cy-wrapper')!;
    const wrect = wrapper.getBoundingClientRect();
    const bb = source.renderedBoundingBox();
    const midX = (bb.x1 + bb.x2) / 2 - wrect.left;
    const midY = (bb.y1 + bb.y2) / 2 - wrect.top;
    switch (side) {
        case 'top':
            connectLineStartX = midX;
            connectLineStartY = bb.y1 - wrect.top;
            break;
        case 'bottom':
            connectLineStartX = midX;
            connectLineStartY = bb.y2 - wrect.top;
            break;
        case 'left':
            connectLineStartX = bb.x1 - wrect.left;
            connectLineStartY = midY;
            break;
        case 'right':
        default:
            connectLineStartX = bb.x2 - wrect.left;
            connectLineStartY = midY;
            break;
    }
    showConnectPreview(connectLineStartX, connectLineStartY, connectLineStartX + 24, connectLineStartY);
    const tgt = getNodeUnderClientPoint(startClientX, startClientY);
    if (tgt && tgt.id() !== source.id()) {
        cy.nodes().removeClass('pdc-connect-target');
        tgt.addClass('pdc-connect-target');
    }
}

function cleanupConnectionDrag(): void {
    isConnecting = false;
    connectSource = undefined;
    hoveredForConnect = undefined;
    document.body.style.cursor = '';
    hideConnectPreview();
    if (cy) {
        cy.nodes().removeClass('pdc-connect-target');
    }
    hideConnectHandle();
    updateResizeHandles();
    updateConnectHandle();
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
    editingNode.style('label', editingNode.data('label'));
    editingNode.unlock();
    const wasEditing = editingNode;
    editingNode = undefined;
    input.style.display = 'none';
    if (cy) {
        cy.style().update();
    }
    updateResizeHandles();
    updateConnectHandle();
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
    editingNode.style('label', editingNode.data('label'));
    editingNode.unlock();
    editingNode = undefined;
    input.style.display = 'none';
    if (cy) {
        cy.style().update();
    }
    updateConnectHandle();
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
    node.style('label', '');
    positionInlineInput(input, node);
    input.style.fontSize = `${NODE_FONT_SIZE * cy.zoom()}px`;
    const prev = (node.data('label') as string | undefined) ?? '';
    input.value = prev;
    input.style.display = 'block';
    autoResizeTextarea(input);
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function destroyGraph(): void {
    if (editingNode) {
        cancelInlineEdit();
    }
    hideResizeHandles();
    hideConnectHandle();
    cleanupConnectionDrag();
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
    graph.edges().forEach((edge) => {
        ensureEdgeDefaults(edge);
    });

    graph.on('dragfreeon', 'node', () => postSave());
    graph.on('position', 'node', () => {
        postSave();
        updateResizeHandles();
        updateConnectHandle();
    });

    graph.on('mouseover', 'node', (evt) => {
        if (isConnecting || editingNode || resizeTarget) {
            return;
        }
        hoveredForConnect = evt.target as cytoscape.NodeSingular;
        updateConnectHandle();
    });
    graph.on('mouseout', 'node', () => {
        hoveredForConnect = undefined;
        scheduleConnectHandleHide();
    });

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
            if (input && cy) {
                positionInlineInput(input, editingNode);
                input.style.fontSize = `${NODE_FONT_SIZE * cy.zoom()}px`;
                autoResizeTextarea(input);
            }
        }
        updateResizeHandles();
        updateConnectHandle();
    });

    graph.on('select unselect', 'node', () => {
        updateResizeHandles();
        updateConnectHandle();
    });

    (graph as unknown as { compoundDragAndDrop: (opts: unknown) => void }).compoundDragAndDrop({
        grabbedNode: (node: cytoscape.NodeSingular) => !node.data('isGroup'),
        dropTarget: (dropTarget: cytoscape.NodeSingular) => dropTarget.data('isGroup') === true,
        dropSibling: () => false,
        overThreshold: 12,
        outThreshold: 12,
    });
    graph.on('cdnddrop' as unknown as cytoscape.EventNames, () => postSave());

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
        if (e.button !== 0) {
            return;
        }
        if (target.classList.contains('pdc-connect-handle')) {
            e.preventDefault();
            e.stopPropagation();
            const sourceNode = connectHandleSource || hoveredForConnect;
            if (sourceNode) {
                const side = (target.dataset.connectSide as ConnectSide) || 'right';
                startConnectionDrag(sourceNode, e.clientX, e.clientY, side);
            }
            return;
        }
        if (!target.classList.contains('pdc-resize-handle')) {
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
        const node = sel.first() as cytoscape.NodeSingular;
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
        if (isConnecting && connectSource) {
            const wrapper = document.getElementById('pdc-cy-wrapper')!;
            const wrect = wrapper.getBoundingClientRect();
            const x2 = e.clientX - wrect.left;
            const y2 = e.clientY - wrect.top;
            // update preview line
            const svg = document.getElementById('pdc-connect-svg') as SVGSVGElement | null;
            const line = document.getElementById('pdc-connect-line') as SVGLineElement | null;
            if (svg && line) {
                line.setAttribute('x1', String(connectLineStartX));
                line.setAttribute('y1', String(connectLineStartY));
                line.setAttribute('x2', String(x2));
                line.setAttribute('y2', String(y2));
                if (svg.style.display !== 'block') {
                    svg.style.display = 'block';
                }
            }
            // live target highlight
            const tgt = getNodeUnderClientPoint(e.clientX, e.clientY);
            if (cy) {
                cy.nodes().removeClass('pdc-connect-target');
            }
            if (tgt && connectSource && tgt.id() !== connectSource.id()) {
                tgt.addClass('pdc-connect-target');
            }
            return;
        }
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
        if (isConnecting) {
            const tgt = getNodeUnderClientPoint(e.clientX, e.clientY);
            if (cy && connectSource && tgt && tgt.id() !== connectSource.id()) {
                const id = newEdgeId(connectSource.id(), tgt.id());
                cy.add({
                    group: 'edges',
                    data: { id, source: connectSource.id(), target: tgt.id(), curveStyle: 'bezier', lineStyle: 'solid', direction: 'forward' }
                });
                postSave();
            }
            cleanupConnectionDrag();
            return;
        }
        if (e.button === 0 && resizeTarget) {
            resizeTarget.unlock();
            resizeTarget = undefined;
            resizeHandle = undefined;
            updateResizeHandles();
            updateConnectHandle();
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
            cy?.edges().forEach((edge) => {
                const mp = edge.renderedMidpoint();
                if (mp.x >= x1 && mp.x <= x2 && mp.y >= y1 && mp.y <= y2) {
                    edge.select();
                }
            });
        }
    }, { signal });
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
    cleanupConnectionDrag();
    mountGraph(host, elements);
    setStatus('');
}

function applyClear(): void {
    currentUri = '';
    fileId = '';
    fileName = '';
    cleanupConnectionDrag();
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

document.getElementById('pdc-group-selected')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$('node:selected').filter((n) => !n.data('isGroup'));
    if (sel.length < 2) {
        setStatus('Select 2+ nodes to group.');
        return;
    }
    const groupId = newNodeId().replace('n_', 'g_');
    cy.add({
        group: 'nodes',
        data: { id: groupId, label: 'Group', isGroup: true }
    });
    sel.forEach((n) => { n.move({ parent: groupId }); });
    postSave();
    setStatus('');
});

document.getElementById('pdc-ungroup')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$('node:selected').filter((n) => n.data('isGroup') === true);
    if (sel.empty()) {
        setStatus('Select a group node to ungroup.');
        return;
    }
    sel.forEach((group) => {
        const children = group.children();
        children.forEach((child) => { child.move({ parent: null }); });
        group.remove();
    });
    postSave();
    setStatus('');
});

function runElkLayout(direction: 'DOWN' | 'RIGHT'): void {
    if (!cy) {
        return;
    }
    const layout = cy.layout({
        name: 'elk',
        fit: true,
        padding: 48,
        animate: true,
        animationDuration: 300,
        elk: {
            algorithm: 'layered',
            'elk.direction': direction,
            'elk.layered.spacing.nodeNodeBetweenLayers': '80',
            'elk.spacing.nodeNode': '40',
        },
        stop: () => postSave(),
    } as unknown as cytoscape.LayoutOptions);
    layout.run();
}

document.getElementById('pdc-layout-down')?.addEventListener('click', () => {
    runElkLayout('DOWN');
});

document.getElementById('pdc-layout-right')?.addEventListener('click', () => {
    runElkLayout('RIGHT');
});

document.getElementById('pdc-select-edges')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    cy.edges().select();
});

function setEdgeDataOnSelected(key: string, value: string): void {
    if (!cy) {
        return;
    }
    const sel = cy.$('edge:selected');
    if (sel.empty()) {
        setStatus('Select edge(s) first.');
        return;
    }
    sel.forEach((edge) => { edge.data(key, value); });
    postSave();
    setStatus('');
}

document.getElementById('pdc-edge-straight')?.addEventListener('click', () => {
    setEdgeDataOnSelected('curveStyle', 'straight');
});
document.getElementById('pdc-edge-curved')?.addEventListener('click', () => {
    setEdgeDataOnSelected('curveStyle', 'bezier');
});
document.getElementById('pdc-edge-ortho')?.addEventListener('click', () => {
    setEdgeDataOnSelected('curveStyle', 'taxi');
});

document.getElementById('pdc-edge-solid')?.addEventListener('click', () => {
    setEdgeDataOnSelected('lineStyle', 'solid');
});
document.getElementById('pdc-edge-dashed')?.addEventListener('click', () => {
    setEdgeDataOnSelected('lineStyle', 'dashed');
});
document.getElementById('pdc-edge-dotted')?.addEventListener('click', () => {
    setEdgeDataOnSelected('lineStyle', 'dotted');
});

document.getElementById('pdc-swap-edge')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$('edge:selected');
    if (sel.empty()) {
        setStatus('Select edge(s) first.');
        return;
    }
    sel.forEach((edge) => {
        const src = edge.data('source') as string;
        const tgt = edge.data('target') as string;
        edge.move({ source: tgt, target: src });
    });
    postSave();
    setStatus('');
});

document.getElementById('pdc-bidir-edge')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const sel = cy.$('edge:selected');
    if (sel.empty()) {
        setStatus('Select edge(s) first.');
        return;
    }
    sel.forEach((edge) => {
        const cur = edge.data('direction') as string | undefined;
        edge.data('direction', cur === 'both' ? 'forward' : 'both');
    });
    postSave();
    setStatus('');
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isConnecting) {
        cleanupConnectionDrag();
        e.preventDefault();
        return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !editingNode && !isConnecting && cy) {
        const sel = cy.$(':selected');
        if (!sel.empty()) {
            sel.remove();
            postSave();
            updateResizeHandles();
            updateConnectHandle();
            e.preventDefault();
        }
    }
});

document.getElementById('pdc-export-png')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const data = cy.png({ full: true, scale: 2, bg: '#1e1e1e', output: 'base64' });
    vscode.postMessage({ type: 'benne/pdcEditor/export', format: 'png', data });
});

document.getElementById('pdc-export-svg')?.addEventListener('click', () => {
    if (!cy) {
        return;
    }
    const data = cy.svg({ full: true, scale: 1, bg: '#1e1e1e' });
    vscode.postMessage({ type: 'benne/pdcEditor/export', format: 'svg', data });
});

vscode.postMessage({ type: 'benne/pdcEditor/ready' });
