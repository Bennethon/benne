/**
 * The State view: the game's flags and vars from `src/game/state.ts` as two tables
 * (docs/bennescript-ergonomics-refactor.md §4.7). Changes in the view are edits to `state.ts`;
 * renames go through TypeScript's rename, so every `flags.x` in the scripts follows.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import {
    addStateEntry,
    createStateFileText,
    ensureStateSection,
    formatVarLiteral,
    parseStateFile,
    removeStateEntry,
    setFlagDefault,
    setVarValue,
    type StateEntry,
    type StateFile,
    type StateSection,
    type StateValue
} from './bennescript/stateFile';
import { validateStateName, type StateSectionKind } from './bennescript/stateNames';
import { findBenneGameFolders } from './gameDiscovery';
import { runGenerateGameIds } from './gameIdsGenerator';
import { enqueueJsonFileWork, uriSameResource } from './inspectorJsonDocument';
import { invalidateGeneratedModules, revealRange } from './scriptHandlers';
import type {
    StateHostMessage,
    StateViewPayload,
    StateViewSection,
    StateWebviewMessage
} from './state/stateViewProtocol';

const NOUN: Record<StateSectionKind, string> = { flags: 'flag', vars: 'var' };

/** The game whose `state.ts` the view shows. */
export interface StateTarget {
    folder: vscode.WorkspaceFolder;
    uri: vscode.Uri;
}

/** Replaceable parts, for tests. */
export interface StateViewOptions {
    /** Defaults to the first BENNE game in the workspace. */
    locate?: () => Promise<StateTarget | undefined>;
    /** Defaults to a modal warning with a Delete button. */
    confirmDelete?: (message: string, detail: string) => Promise<boolean>;
}

/** TypeScript's rename and references come from the built-in extension; it may not have started yet. */
async function ensureTypeScriptFeatures(): Promise<void> {
    await vscode.extensions.getExtension('vscode.typescript-language-features')?.activate();
}

/**
 * How many times the game's scripts write `flags.name` (or `vars.name`), found by text. While
 * TypeScript is still loading the project it answers rename and references from its syntax
 * server, with only some of the files, so this is what the full answer should reach.
 */
async function countTextualUses(gameRoot: string, kind: StateSectionKind, name: string): Promise<number> {
    const pattern = new RegExp(`(?<![\\w$])${kind}\\s*\\??\\.\\s*${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
    let files: string[];
    try {
        files = (await fs.readdir(gameRoot, { recursive: true })).map(String);
    } catch {
        return 0;
    }
    let count = 0;
    for (const rel of files) {
        if (!rel.endsWith('.ts') || rel.endsWith('.ids.ts') || rel === 'state.ts') {
            continue;
        }
        const file = path.join(gameRoot, rel);
        const open = vscode.workspace.textDocuments.find((d) => uriSameResource(d.uri, vscode.Uri.file(file)));
        let text: string;
        try {
            text = open ? open.getText() : await fs.readFile(file, 'utf8');
        } catch {
            continue;
        }
        count += text.match(pattern)?.length ?? 0;
    }
    return count;
}

/** Asks again, for up to ten seconds, until TypeScript's answer has at least `expected` uses. */
async function settled<T>(request: () => Thenable<T>, uses: (result: T) => number, expected: number): Promise<T> {
    const deadline = Date.now() + 10000;
    let result = await request();
    while (uses(result) < expected && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        result = await request();
    }
    return result;
}

function buildStateHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'state', 'state.js'));
    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `font-src ${webview.cspSource}`
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-sideBar-background);
      font-size: 12px;
      --benne-state-border: color-mix(in srgb, var(--vscode-panel-border) 72%, var(--vscode-widget-border, var(--vscode-panel-border)));
      --benne-state-surface: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-sideBar-background));
    }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 6px 10px 12px; font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background); }

    input[type="text"], input[type="number"], select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-input-border) 55%, var(--benne-state-border));
      border-radius: 2px;
      padding: 2px 5px;
      font-family: inherit;
      font-size: inherit;
      min-width: 0;
    }
    select {
      background-color: var(--vscode-dropdown-background, var(--vscode-input-background));
      color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground));
      padding: 2px 2px;
    }
    input::placeholder { color: var(--vscode-input-placeholderForeground); }
    input:focus, select:focus, button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    input.invalid, input.invalid:focus {
      outline: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground));
      outline-offset: -1px;
    }
    input[type="checkbox"] { margin: 0; cursor: pointer; }

    .section {
      border: 1px solid var(--benne-state-border);
      border-radius: 6px;
      margin-bottom: 10px;
      background: var(--benne-state-surface);
      overflow: hidden;
    }
    .section > summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-weight: 600;
      list-style: none;
      user-select: none;
      background: var(--vscode-sideBarSectionHeader-background, color-mix(in srgb, var(--vscode-sideBar-background) 55%, var(--vscode-editor-background)));
    }
    .section[open] > summary { border-bottom: 1px solid var(--benne-state-border); }
    .section > summary::-webkit-details-marker { display: none; }
    .section > summary::before {
      content: '';
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 6px solid var(--vscode-foreground);
      transition: transform 0.14s ease;
    }
    .section[open] > summary::before { transform: rotate(90deg); }
    .count { color: var(--vscode-descriptionForeground); font-weight: 400; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    col.name { width: 45%; }
    th, td { padding: 3px 6px; text-align: left; vertical-align: middle; border-bottom: 1px solid color-mix(in srgb, var(--benne-state-border) 60%, transparent); }
    th { font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    tr.readonly td { color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground)); }

    .name-btn {
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
      background: none;
      border: none;
      padding: 2px 0;
      color: inherit;
      font: inherit;
      font-family: var(--vscode-editor-font-family, monospace);
      cursor: text;
    }
    .name-btn:disabled { cursor: default; }
    td input[type="text"].rename { width: 100%; font-family: var(--vscode-editor-font-family, monospace); }

    .value { display: flex; align-items: center; gap: 4px; min-height: 22px; }
    .value input[type="text"], .value input[type="number"] { flex: 1 1 auto; width: 100%; }
    .value select { flex: 0 0 auto; width: 4.4em; }
    .value .grow { flex: 1 1 auto; }
    .tag {
      font-size: 10px;
      padding: 0 5px;
      border-radius: 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 9em;
    }
    .code { font-family: var(--vscode-editor-font-family, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    td.value-cell { position: relative; }
    /* Over the end of the value, so showing them doesn't squeeze the field. */
    .row-actions {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      gap: 2px;
      border-radius: 3px;
      background: var(--vscode-list-hoverBackground, var(--vscode-sideBar-background));
      box-shadow: 0 0 4px 2px var(--vscode-list-hoverBackground, var(--vscode-sideBar-background));
    }
    tr:hover .row-actions, tr:focus-within .row-actions { display: flex; }
    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-icon-foreground, var(--vscode-foreground));
      cursor: pointer;
      padding: 1px 4px;
      border-radius: 3px;
      font: inherit;
      line-height: 1.2;
    }
    .icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }

    tr.add-row td { background: color-mix(in srgb, var(--vscode-editor-background) 50%, transparent); }
    tr.add-row input[type="text"].add-name { width: 100%; font-family: var(--vscode-editor-font-family, monospace); }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: 1px solid transparent;
      border-radius: 2px;
      padding: 2px 8px;
      cursor: pointer;
      font: inherit;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .error { color: var(--vscode-errorForeground); font-size: 11px; padding: 2px 8px 6px; }
    .hint { color: var(--vscode-descriptionForeground); padding: 6px 2px; }
    .footer { display: flex; align-items: center; gap: 6px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .link { background: none; border: none; padding: 0; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; }
    .link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div id="benne-state-app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function viewSection(section: StateSection | null): StateViewSection {
    return {
        present: section !== null,
        entries: (section?.entries ?? []).map((e) => ({
            name: e.name,
            editable: e.editable,
            value: e.value,
            saveKey: e.saveKey
        }))
    };
}

/** Text with one replaced range, for an edit that keeps the cursor and undo history tidy. */
function changedRange(before: string, after: string): { start: number; end: number; text: string } {
    let start = 0;
    const max = Math.min(before.length, after.length);
    while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) {
        start++;
    }
    let tail = 0;
    while (
        tail < max - start &&
        before.charCodeAt(before.length - 1 - tail) === after.charCodeAt(after.length - 1 - tail)
    ) {
        tail++;
    }
    return { start, end: before.length - tail, text: after.slice(start, after.length - tail) };
}

export class StateWebviewViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    private viewDisposable: vscode.Disposable | undefined;
    private readonly disposables: vscode.Disposable[] = [];
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly options: StateViewOptions = {}
    ) {
        const watcher = vscode.workspace.createFileSystemWatcher('**/src/game/state.ts');
        this.disposables.push(
            watcher,
            watcher.onDidCreate(() => this.scheduleRefresh()),
            watcher.onDidChange(() => this.scheduleRefresh()),
            watcher.onDidDelete(() => this.scheduleRefresh()),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (path.basename(e.document.uri.fsPath) === 'state.ts') {
                    this.scheduleRefresh();
                }
            }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.scheduleRefresh())
        );
    }

    dispose(): void {
        clearTimeout(this.refreshTimer);
        this.viewDisposable?.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.viewDisposable?.dispose();
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
        webviewView.webview.html = buildStateHtml(webviewView.webview, this.extensionUri);
        this.viewDisposable = vscode.Disposable.from(
            webviewView.webview.onDidReceiveMessage((msg: StateWebviewMessage) => {
                void this.handleMessage(msg).catch((err: unknown) => {
                    void vscode.window.showErrorMessage(`BENNE State: ${err instanceof Error ? err.message : String(err)}`);
                    void this.refresh();
                });
            }),
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible) {
                    void this.refresh();
                }
            }),
            webviewView.onDidDispose(() => {
                this.view = undefined;
            })
        );
    }

    private scheduleRefresh(): void {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => void this.refresh(), 150);
    }

    /** The game folder and its `src/game/state.ts` (the first BENNE game in the workspace). */
    private async target(): Promise<StateTarget | undefined> {
        if (this.options.locate) {
            return this.options.locate();
        }
        const [folder] = await findBenneGameFolders();
        return folder ? { folder, uri: vscode.Uri.joinPath(folder.uri, 'src', 'game', 'state.ts') } : undefined;
    }

    /** The open buffer when there is one (it may have unsaved edits), else the file on disk. */
    private async readState(uri: vscode.Uri): Promise<string | undefined> {
        const open = vscode.workspace.textDocuments.find((d) => uriSameResource(d.uri, uri));
        if (open) {
            return open.getText();
        }
        try {
            return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
        } catch {
            return undefined;
        }
    }

    async refresh(): Promise<void> {
        if (!this.view) {
            return;
        }
        this.post({ type: 'benne/state/state', state: await this.payload() });
    }

    /** Public for tests: what the view shows. */
    async payload(): Promise<StateViewPayload> {
        const target = await this.target();
        if (!target) {
            return { status: 'noGame' };
        }
        const text = await this.readState(target.uri);
        const file = text === undefined ? { flags: null, vars: null } : parseStateFile(ts, target.uri.fsPath, text);
        return {
            status: 'ready',
            fileLabel: path.relative(target.folder.uri.fsPath, target.uri.fsPath).split(path.sep).join('/'),
            fileExists: text !== undefined,
            flags: viewSection(file.flags),
            vars: viewSection(file.vars)
        };
    }

    private post(msg: StateHostMessage): void {
        void this.view?.webview.postMessage(msg);
    }

    /** Public for tests: handles one message from the webview. */
    async handleMessage(msg: StateWebviewMessage): Promise<void> {
        switch (msg.action) {
            case 'ready':
                break;
            case 'setValue':
                await this.editEntry(msg.kind, msg.name, (text, entry) =>
                    msg.kind === 'flags'
                        ? setFlagDefault(text, entry, msg.value === true).text
                        : setVarValue(text, entry, msg.value).text
                );
                break;
            case 'add':
                await this.addEntry(msg.kind, msg.name, msg.value);
                break;
            case 'rename':
                await this.renameEntry(msg.kind, msg.name, msg.newName);
                break;
            case 'delete':
                await this.deleteEntry(msg.kind, msg.name);
                break;
            case 'reveal':
                await this.reveal(msg.kind, msg.name);
                break;
        }
        await this.refresh();
    }

    /**
     * Applies `compute` to `state.ts` as a document edit, one at a time per file. Creates the file
     * (and regenerates `@game`, which re-exports it) when it doesn't exist yet. A document that had
     * unsaved changes is left unsaved, so the author's own edits aren't saved behind their back.
     */
    private async editState(compute: (text: string, file: StateFile) => string | undefined): Promise<void> {
        const target = await this.target();
        if (!target) {
            throw new Error('Open a folder with a BENNE game (src/game/rooms) first.');
        }
        const { folder, uri } = target;
        let created = false;
        await enqueueJsonFileWork(uri, async () => {
            if ((await this.readState(uri)) === undefined) {
                await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(createStateFileText()));
                created = true;
            }
            const doc = await vscode.workspace.openTextDocument(uri);
            const wasDirty = doc.isDirty;
            const before = doc.getText();
            const after = compute(before, parseStateFile(ts, uri.fsPath, before));
            if (after === undefined || after === before) {
                return;
            }
            const change = changedRange(before, after);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, new vscode.Range(doc.positionAt(change.start), doc.positionAt(change.end)), change.text);
            if (!(await vscode.workspace.applyEdit(edit))) {
                throw new Error(`Could not edit ${path.basename(uri.fsPath)}.`);
            }
            if (!wasDirty && !(await doc.save())) {
                throw new Error(`Could not save ${path.basename(uri.fsPath)}. Resolve the editor's save conflict and retry.`);
            }
        });
        if (created && (await runGenerateGameIds(folder, { quiet: true }))) {
            invalidateGeneratedModules();
        }
    }

    private async editEntry(
        kind: StateSectionKind,
        name: string,
        compute: (text: string, entry: StateEntry, section: StateSection) => string
    ): Promise<void> {
        await this.editState((text, file) => {
            const section = file[kind];
            const entry = section?.entries.find((e) => e.name === name);
            if (!section || !entry?.editable) {
                throw new Error(`state.ts has no editable ${NOUN[kind]} called "${name}".`);
            }
            return compute(text, entry, section);
        });
    }

    private async addEntry(kind: StateSectionKind, name: string, value: StateValue): Promise<void> {
        const source = kind === 'flags' ? String(value === true) : formatVarLiteral(value);
        await this.editState((text, file) => {
            const withSection = file[kind] ? text : ensureStateSection(ts, 'state.ts', text, kind);
            const parsed = withSection === text ? file : parseStateFile(ts, 'state.ts', withSection);
            const section = parsed[kind]!;
            const problem = validateStateName(name, kind, section.entries.map((e) => e.name));
            if (problem) {
                throw new Error(problem);
            }
            return addStateEntry(withSection, parsed, section, name, source).text;
        });
    }

    /** Where `name` is declared in `state.ts`, for TypeScript's rename and references. */
    private async declaration(
        kind: StateSectionKind,
        name: string
    ): Promise<{ uri: vscode.Uri; doc: vscode.TextDocument; entry: StateEntry; section: StateSection }> {
        const target = await this.target();
        if (!target) {
            throw new Error('Open a folder with a BENNE game (src/game/rooms) first.');
        }
        const doc = await vscode.workspace.openTextDocument(target.uri);
        const section = parseStateFile(ts, target.uri.fsPath, doc.getText())[kind];
        const entry = section?.entries.find((e) => e.name === name);
        if (!section || !entry) {
            throw new Error(`state.ts has no ${NOUN[kind]} called "${name}".`);
        }
        return { uri: target.uri, doc, entry, section };
    }

    private async renameEntry(kind: StateSectionKind, name: string, newName: string): Promise<void> {
        if (newName === name) {
            return;
        }
        const { uri, doc, entry, section } = await this.declaration(kind, name);
        const problem = validateStateName(newName, kind, section.entries.map((e) => e.name), name);
        if (problem) {
            throw new Error(problem);
        }
        await ensureTypeScriptFeatures();
        const expected = await countTextualUses(path.dirname(uri.fsPath), kind, name);
        const edit = await settled(
            () =>
                vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
                    'vscode.executeDocumentRenameProvider',
                    uri,
                    doc.positionAt(entry.nameStart),
                    newName
                ),
            (e) =>
                (e?.entries() ?? [])
                    .filter(([u]) => !uriSameResource(u, uri))
                    .reduce((n, [, edits]) => n + edits.length, 0),
            expected
        );
        if (!edit || edit.size === 0) {
            // No TypeScript rename (the TypeScript extension is off): rename the declaration only.
            await this.editEntry(kind, name, (text, e) => `${text.slice(0, e.nameStart)}${newName}${text.slice(e.nameEnd)}`);
            void vscode.window.showWarningMessage(
                `Renamed ${name} to ${newName} in state.ts only: TypeScript's rename wasn't available, so update the scripts that use it.`
            );
            return;
        }
        const dirtyBefore = new Set(vscode.workspace.textDocuments.filter((d) => d.isDirty).map((d) => d.uri.toString()));
        if (!(await vscode.workspace.applyEdit(edit))) {
            throw new Error(`Could not rename ${name}.`);
        }
        for (const [changed] of edit.entries()) {
            const open = vscode.workspace.textDocuments.find((d) => uriSameResource(d.uri, changed));
            if (open?.isDirty && !dirtyBefore.has(open.uri.toString())) {
                await open.save();
            }
        }
    }

    private async deleteEntry(kind: StateSectionKind, name: string): Promise<void> {
        const { uri, doc, entry } = await this.declaration(kind, name);
        await ensureTypeScriptFeatures();
        const isDeclaration = (r: vscode.Location): boolean =>
            uriSameResource(r.uri, uri) && doc.offsetAt(r.range.start) === entry.nameStart;
        const refs =
            (await settled(
                () =>
                    vscode.commands.executeCommand<vscode.Location[] | undefined>(
                        'vscode.executeReferenceProvider',
                        uri,
                        doc.positionAt(entry.nameStart)
                    ),
                (r) => (r ?? []).filter((l) => !isDeclaration(l)).length,
                await countTextualUses(path.dirname(uri.fsPath), kind, name)
            )) ?? [];
        const uses = refs.filter((r) => !isDeclaration(r));
        if (uses.length > 0) {
            const files = [...new Set(uses.map((u) => vscode.workspace.asRelativePath(u.uri)))];
            const message = `"${name}" is used in ${uses.length} ${uses.length === 1 ? 'place' : 'places'}. Delete it anyway?`;
            const detail = `Those scripts won't type-check until they stop using it:\n${files.join('\n')}`;
            const confirmed = this.options.confirmDelete
                ? await this.options.confirmDelete(message, detail)
                : (await vscode.window.showWarningMessage(message, { modal: true, detail }, 'Delete')) === 'Delete';
            if (!confirmed) {
                return;
            }
        }
        await this.editState((text, file) => {
            const section = file[kind];
            const current = section?.entries.find((e) => e.name === name);
            return section && current ? removeStateEntry(text, section, current).text : undefined;
        });
    }

    private async reveal(kind: StateSectionKind | undefined, name: string | undefined): Promise<void> {
        const target = await this.target();
        if (!target) {
            return;
        }
        if ((await this.readState(target.uri)) === undefined) {
            await this.editState(() => undefined);
        }
        const text = (await this.readState(target.uri)) ?? '';
        const entry = kind && name ? parseStateFile(ts, target.uri.fsPath, text)[kind]?.entries.find((e) => e.name === name) : undefined;
        await revealRange(target.uri, entry ? { start: entry.nameStart, end: entry.nameEnd } : { start: 0, end: 0 });
    }
}
