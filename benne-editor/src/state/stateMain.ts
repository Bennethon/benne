/** BENNE State webview (bundled for `media/state/state.js`): the flags and vars tables. */
/// <reference lib="dom" />

import { validateStateName } from '../bennescript/stateNames';
import type {
    StateHostMessage,
    StateSectionKind,
    StateValue,
    StateViewEntry,
    StateViewPayload,
    StateWebviewMessage
} from './stateViewProtocol';

declare function acquireVsCodeApi(): {
    postMessage(data: StateWebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
};

type VarType = 'string' | 'number' | 'boolean' | 'json';

const VAR_TYPES: { id: VarType; label: string; title: string }[] = [
    { id: 'string', label: 'text', title: 'Text' },
    { id: 'number', label: 'num', title: 'Number' },
    { id: 'boolean', label: 'bool', title: 'True or false' },
    { id: 'json', label: 'json', title: 'List or object, written as JSON' }
];

interface Draft {
    name: string;
    type: VarType;
    value: string;
    checked: boolean;
}

const vscodeApi = acquireVsCodeApi();
const saved = (vscodeApi.getState() ?? {}) as { closed?: StateSectionKind[] };
const closed = new Set<StateSectionKind>(saved.closed ?? []);

let state: StateViewPayload = { status: 'loading' };
let renaming: { kind: StateSectionKind; name: string } | null = null;
const drafts: Record<StateSectionKind, Draft> = {
    flags: { name: '', type: 'string', value: '', checked: false },
    vars: { name: '', type: 'number', value: '', checked: false }
};
const errors: Partial<Record<StateSectionKind, string>> = {};
/** True while the DOM is replaced, so a field losing focus to the re-render doesn't commit. */
let rendering = false;

const app = document.getElementById('benne-state-app')!;

function post(msg: StateWebviewMessage): void {
    vscodeApi.postMessage(msg);
}

type Attrs = Record<string, string | boolean | number | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Attrs = {},
    ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === false) {
            continue;
        }
        if (k === 'class') {
            el.className = String(v);
        } else if (k === 'value') {
            (el as HTMLInputElement).value = String(v);
        } else if (k === 'checked') {
            (el as HTMLInputElement).checked = Boolean(v);
        } else {
            el.setAttribute(k, v === true ? '' : String(v));
        }
    }
    for (const c of children) {
        if (c !== null && c !== undefined && c !== false) {
            el.append(c);
        }
    }
    return el;
}

function varType(value: StateValue | undefined): VarType {
    if (typeof value === 'string') {
        return 'string';
    }
    if (typeof value === 'number') {
        return 'number';
    }
    if (typeof value === 'boolean') {
        return 'boolean';
    }
    return 'json';
}

/** The value a var gets when its type changes, keeping what still makes sense. */
function convert(value: StateValue | undefined, to: VarType): StateValue {
    switch (to) {
        case 'string':
            return value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        case 'number': {
            const n = Number(value);
            return typeof value !== 'object' && Number.isFinite(n) ? n : 0;
        }
        case 'boolean':
            return value === true || value === 'true';
        case 'json':
            return value !== null && typeof value === 'object' ? value : [];
    }
}

/** Reads a typed value from an editor's text, or an error message. */
function parseTyped(type: VarType, text: string): { value: StateValue } | { error: string } {
    switch (type) {
        case 'string':
            return { value: text };
        case 'boolean':
            return { value: text === 'true' };
        case 'number': {
            const n = Number(text);
            return text.trim() !== '' && Number.isFinite(n) ? { value: n } : { error: 'Enter a number.' };
        }
        case 'json':
            try {
                return { value: JSON.parse(text) as StateValue };
            } catch {
                return { error: 'Enter JSON, e.g. [] or { "apples": 2 }.' };
            }
    }
}

function names(kind: StateSectionKind): string[] {
    return state.status === 'ready' ? state[kind].entries.map((e) => e.name) : [];
}

function markInvalid(input: HTMLInputElement, error: string | undefined): void {
    input.classList.toggle('invalid', error !== undefined);
    input.title = error ?? '';
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function nameCell(kind: StateSectionKind, entry: StateViewEntry): HTMLTableCellElement {
    if (renaming?.kind === kind && renaming.name === entry.name) {
        const input = h('input', {
            type: 'text',
            class: 'rename',
            value: entry.name,
            'data-focus': `rename:${kind}:${entry.name}`,
            spellcheck: 'false',
            'aria-label': `Rename ${entry.name}`
        });
        let done = false;
        const finish = (commit: boolean): void => {
            if (done) {
                return;
            }
            const newName = input.value.trim();
            if (commit && newName !== entry.name) {
                const problem = validateStateName(newName, kind, names(kind), entry.name);
                if (problem) {
                    markInvalid(input, problem);
                    return;
                }
                post({ action: 'rename', kind, name: entry.name, newName });
            }
            done = true;
            renaming = null;
            render();
        };
        input.addEventListener('input', () =>
            markInvalid(input, validateStateName(input.value.trim(), kind, names(kind), entry.name))
        );
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finish(true);
            } else if (e.key === 'Escape') {
                finish(false);
            }
        });
        input.addEventListener('blur', () => {
            if (rendering) {
                return;
            }
            const problem = validateStateName(input.value.trim(), kind, names(kind), entry.name);
            finish(problem === undefined);
        });
        queueMicrotask(() => {
            if (document.activeElement !== input) {
                input.focus();
                input.select();
            }
        });
        return h('td', {}, input);
    }
    const saveKeyNote =
        kind === 'flags' && !entry.saveKey
            ? ' Renaming also changes the key it is saved under; give it flag(…, { saveKey }) to keep released saves.'
            : '';
    const btn = h(
        'button',
        {
            class: 'name-btn',
            title: entry.editable ? `${entry.name}: click to rename everywhere it's used.${saveKeyNote}` : entry.name,
            disabled: !entry.editable
        },
        entry.name
    );
    btn.addEventListener('click', () => {
        renaming = { kind, name: entry.name };
        render();
    });
    return h('td', {}, btn);
}

function rowActions(kind: StateSectionKind, entry: StateViewEntry): HTMLElement {
    const reveal = h('button', { class: 'icon-btn', title: 'Show in state.ts', 'aria-label': `Show ${entry.name} in state.ts` }, '↗');
    reveal.addEventListener('click', () => post({ action: 'reveal', kind, name: entry.name }));
    const remove = h('button', { class: 'icon-btn', title: `Delete ${entry.name}`, 'aria-label': `Delete ${entry.name}` }, '✕');
    remove.addEventListener('click', () => post({ action: 'delete', kind, name: entry.name }));
    return h('span', { class: 'row-actions' }, reveal, entry.editable && remove);
}

function flagValue(entry: StateViewEntry): HTMLElement {
    const box = h('input', {
        type: 'checkbox',
        checked: entry.value === true,
        title: 'Default value',
        'aria-label': `${entry.name} starts true`
    });
    box.addEventListener('change', () => post({ action: 'setValue', kind: 'flags', name: entry.name, value: box.checked }));
    return h(
        'div',
        { class: 'value' },
        box,
        entry.saveKey !== undefined &&
            h('span', { class: 'tag', title: `Saved under "${entry.saveKey}"` }, entry.saveKey),
        rowActions('flags', entry)
    );
}

function typeSelect(current: VarType, focusKey: string, onChange: (t: VarType) => void): HTMLSelectElement {
    const select = h('select', { title: 'Type', 'data-focus': focusKey, 'aria-label': 'Type' });
    for (const t of VAR_TYPES) {
        select.append(h('option', { value: t.id, title: t.title }, t.label));
    }
    select.value = current;
    select.addEventListener('change', () => onChange(select.value as VarType));
    return select;
}

/** The editor for a var value of `type`: a checkbox for booleans, a text field for the rest. */
function typedEditor(
    type: VarType,
    text: string,
    focusKey: string,
    label: string,
    onCommit: (value: StateValue) => void,
    onDraft?: (text: string) => void
): HTMLInputElement {
    if (type === 'boolean') {
        const box = h('input', { type: 'checkbox', checked: text === 'true', 'data-focus': focusKey, 'aria-label': label });
        box.addEventListener('change', () => {
            onDraft?.(String(box.checked));
            onCommit(box.checked);
        });
        return box;
    }
    const input = h('input', {
        type: type === 'number' ? 'number' : 'text',
        value: text,
        class: type === 'json' ? 'code' : undefined,
        'data-focus': focusKey,
        spellcheck: 'false',
        'aria-label': label
    });
    input.addEventListener('input', () => {
        onDraft?.(input.value);
        const parsed = parseTyped(type, input.value);
        markInvalid(input, 'error' in parsed && !(onDraft && input.value === '') ? parsed.error : undefined);
    });
    input.addEventListener('change', () => {
        const parsed = parseTyped(type, input.value);
        if ('value' in parsed) {
            onCommit(parsed.value);
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = text;
            markInvalid(input, undefined);
            input.blur();
        }
    });
    return input;
}

function textOf(type: VarType, value: StateValue | undefined): string {
    if (type === 'json') {
        return JSON.stringify(value ?? null);
    }
    return value === undefined || value === null ? '' : String(value);
}

function varValue(entry: StateViewEntry): HTMLElement {
    const type = varType(entry.value);
    const commit = (value: StateValue): void => post({ action: 'setValue', kind: 'vars', name: entry.name, value });
    return h(
        'div',
        { class: 'value' },
        typeSelect(type, `type:vars:${entry.name}`, (to) => commit(convert(entry.value, to))),
        typedEditor(type, textOf(type, entry.value), `value:vars:${entry.name}`, `${entry.name} default`, commit),
        rowActions('vars', entry)
    );
}

function readonlyValue(kind: StateSectionKind, entry: StateViewEntry): HTMLElement {
    return h(
        'div',
        { class: 'value' },
        h('span', { class: 'grow', title: 'Not a plain value, so edit it in state.ts' }, 'set in state.ts'),
        rowActions(kind, entry)
    );
}

function entryRow(kind: StateSectionKind, entry: StateViewEntry): HTMLTableRowElement {
    const value = !entry.editable ? readonlyValue(kind, entry) : kind === 'flags' ? flagValue(entry) : varValue(entry);
    return h('tr', { class: entry.editable ? undefined : 'readonly' }, nameCell(kind, entry), h('td', { class: 'value-cell' }, value));
}

function addRow(kind: StateSectionKind): HTMLTableRowElement {
    const draft = drafts[kind];
    const nameInput = h('input', {
        type: 'text',
        class: 'add-name',
        value: draft.name,
        placeholder: kind === 'flags' ? 'new flag' : 'new var',
        'data-focus': `add-name:${kind}`,
        spellcheck: 'false',
        'aria-label': kind === 'flags' ? 'New flag name' : 'New var name'
    });
    const submit = (): void => {
        const name = nameInput.value.trim();
        const problem = validateStateName(name, kind, names(kind));
        let value: StateValue;
        if (kind === 'flags') {
            value = draft.checked;
        } else {
            const parsed = draft.value === '' ? { value: convert(undefined, draft.type) } : parseTyped(draft.type, draft.value);
            if ('error' in parsed) {
                errors[kind] = parsed.error;
                render();
                return;
            }
            value = parsed.value;
        }
        if (problem) {
            errors[kind] = problem;
            render();
            return;
        }
        errors[kind] = undefined;
        drafts[kind] = { ...draft, name: '', value: '', checked: false };
        post({ action: 'add', kind, name, value });
        render();
        (app.querySelector(`[data-focus="add-name:${kind}"]`) as HTMLInputElement | null)?.focus();
    };
    nameInput.addEventListener('input', () => {
        draft.name = nameInput.value;
        const problem = nameInput.value.trim() === '' ? undefined : validateStateName(nameInput.value.trim(), kind, names(kind));
        markInvalid(nameInput, problem);
    });
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submit();
        } else if (e.key === 'Escape') {
            drafts[kind].name = '';
            errors[kind] = undefined;
            render();
        }
    });
    const addBtn = h('button', { class: 'icon-btn', title: kind === 'flags' ? 'Add flag' : 'Add var', 'aria-label': kind === 'flags' ? 'Add flag' : 'Add var' }, '+');
    addBtn.addEventListener('click', submit);

    let value: HTMLElement;
    if (kind === 'flags') {
        const box = h('input', { type: 'checkbox', checked: draft.checked, 'data-focus': 'add-value:flags', 'aria-label': 'New flag starts true' });
        box.addEventListener('change', () => {
            draft.checked = box.checked;
        });
        value = h('div', { class: 'value' }, box, h('span', { class: 'grow' }), addBtn);
    } else {
        const editor = typedEditor(
            draft.type,
            draft.type === 'boolean' ? String(draft.checked) : draft.value,
            'add-value:vars',
            'New var default',
            () => undefined,
            (text) => {
                if (draft.type === 'boolean') {
                    draft.checked = text === 'true';
                    draft.value = text;
                } else {
                    draft.value = text;
                }
            }
        );
        if (editor.type !== 'checkbox') {
            editor.placeholder = textOf(draft.type, convert(undefined, draft.type)) || '""';
            editor.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    submit();
                }
            });
        }
        value = h(
            'div',
            { class: 'value' },
            typeSelect(draft.type, 'add-type:vars', (to) => {
                draft.type = to;
                draft.value = '';
                draft.checked = false;
                render();
            }),
            editor,
            addBtn
        );
    }
    return h('tr', { class: 'add-row' }, h('td', {}, nameInput), h('td', {}, value));
}

function section(kind: StateSectionKind, entries: StateViewEntry[]): HTMLElement {
    const title = kind === 'flags' ? 'Flags' : 'Vars';
    const details = h(
        'details',
        { class: 'section', open: !closed.has(kind) },
        h(
            'summary',
            { title: kind === 'flags' ? 'flags.x in scripts: true/false, saved' : 'vars.x in scripts: numbers, text, lists, saved' },
            title,
            h('span', { class: 'count' }, `(${entries.length})`)
        ),
        h(
            'table',
            {},
            h('colgroup', {}, h('col', { class: 'name' }), h('col', {})),
            h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Default'))),
            h('tbody', {}, ...entries.map((e) => entryRow(kind, e)), addRow(kind))
        ),
        errors[kind] && h('div', { class: 'error', role: 'alert' }, errors[kind])
    );
    details.addEventListener('toggle', () => {
        if (details.open) {
            closed.delete(kind);
        } else {
            closed.add(kind);
        }
        vscodeApi.setState({ closed: [...closed] });
    });
    return details;
}

// ─── Render ──────────────────────────────────────────────────────────────────

/** Re-renders, keeping focus, the typed text and the caret in whichever field had them. */
function render(): void {
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active?.getAttribute('data-focus') ?? null;
    const typed = active && 'value' in active && active.type !== 'checkbox' ? active.value : null;
    const caret = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;

    rendering = true;
    try {
        app.replaceChildren(...body());
    } finally {
        rendering = false;
    }

    if (!focusKey) {
        return;
    }
    const next = app.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`) as HTMLInputElement | null;
    if (!next) {
        return;
    }
    if (typed !== null && next.tagName === 'INPUT') {
        next.value = typed;
    }
    next.focus();
    if (caret && next.tagName === 'INPUT' && next.type !== 'number') {
        try {
            next.setSelectionRange(caret[0], caret[1]);
        } catch {
            // Not a text field.
        }
    }
}

function body(): Node[] {
    if (state.status === 'loading') {
        return [];
    }
    if (state.status === 'noGame') {
        return [h('div', { class: 'hint' }, 'Open a folder with a BENNE game to see its flags and vars.')];
    }
    const open = h('button', { class: 'link', title: 'Open state.ts' }, state.fileLabel);
    open.addEventListener('click', () => post({ action: 'reveal' }));
    return [
        section('flags', state.flags.entries),
        section('vars', state.vars.entries),
        h(
            'div',
            { class: 'footer' },
            state.fileExists ? open : h('span', {}, `No ${state.fileLabel} yet: adding a flag or var creates it.`)
        )
    ];
}

window.addEventListener('message', (event: MessageEvent<StateHostMessage>) => {
    if (event.data?.type === 'benne/state/state') {
        state = event.data.state;
        if (renaming && !names(renaming.kind).includes(renaming.name)) {
            renaming = null;
        }
        render();
    }
});

post({ action: 'ready' });
