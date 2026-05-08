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
                'background-color': '#3c7eb5',
                color: '#fff',
                width: 88,
                height: 44,
                shape: 'roundrectangle',
                'font-size': 11,
                'border-width': 1,
                'border-color': '#1a4971'
            }
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

/**
 * VS Code webviews do not reliably support `window.prompt`; use an in-webview dialog instead.
 */
function openNodeLabelPrompt(initial: string, onDone: (value: string | null) => void): void {
    const overlay = document.getElementById('pdc-label-overlay');
    const input = document.getElementById('pdc-label-input') as HTMLInputElement | null;
    const btnOk = document.getElementById('pdc-label-ok');
    const btnCancel = document.getElementById('pdc-label-cancel');
    if (!overlay || !input || !btnOk || !btnCancel) {
        onDone(null);
        setStatus('Label editor unavailable.');
        return;
    }

    input.value = initial;
    overlay.dataset.open = 'true';
    overlay.setAttribute('aria-hidden', 'false');

    const finish = (value: string | null) => {
        overlay.dataset.open = 'false';
        overlay.setAttribute('aria-hidden', 'true');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
        document.removeEventListener('keydown', onDocKey, true);
        input.removeEventListener('keydown', onInputKey);
        onDone(value);
    };

    const onOk = () => finish(input.value);

    const onCancel = () => finish(null);

    const onOverlayClick = (e: MouseEvent) => {
        if (e.target === overlay) {
            finish(null);
        }
    };

    const onDocKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            finish(null);
        }
    };

    const onInputKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(input.value);
        }
    };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onDocKey, true);
    input.addEventListener('keydown', onInputKey);

    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function beginEditNodeLabel(node: cytoscape.NodeSingular): void {
    const prev = (node.data('label') as string | undefined) ?? '';
    openNodeLabelPrompt(prev, (next) => {
        if (next === null) {
            return;
        }
        node.data('label', next.trim().length > 0 ? next.trim() : ' ');
        postSave();
        setStatus('');
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
        wheelSensitivity: 0.35,
        minZoom: 0.15,
        maxZoom: 4
    });

    const graph = cy;

    graph.on('dragfreeon', 'node', () => postSave());
    graph.on('position', 'node', () => postSave());
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
            data: { id, label: 'Step' },
            position: { x: pos.x, y: pos.y }
        });
        postSave();
    });
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
        data: { id, label: 'Step' },
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

vscode.postMessage({ type: 'benne/pdcEditor/ready' });
