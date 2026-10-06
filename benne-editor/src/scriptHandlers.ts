/**
 * Editor access to BenneScript files through the TypeScript-AST ScriptModel
 * (`./bennescript/*`, docs/bennescript-ergonomics-refactor.md §9): handler presence for the
 * Inspector chips, "add handler" (stub + imports) and "reveal handler".
 *
 * Scripts still on the old `register*Script` API are left alone: the editor only writes the new
 * syntax (§11.1), and new-style code in an old-style file would change how that file is built
 * (decision 14). Those files report no handlers until they are ported.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import { IdsIndex } from './bennescript/idsIndex';
import {
    describeHandlerSpec,
    findHandlers,
    insertHandlerStub,
    type HandlerSpec
} from './bennescript/handlerSpecs';
import { parseScriptModel, type Registration, type ScriptModel } from './bennescript/scriptModel';
import { runGenerateGameIds } from './gameIdsGenerator';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';

export type { HandlerSpec } from './bennescript/handlerSpecs';

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

/** Message for scripts on the old API. */
export function oldApiScriptMessage(scriptUri: vscode.Uri): string {
    return (
        `${path.basename(scriptUri.fsPath)} still uses the old register*Script API. The editor only adds and finds ` +
        'BenneScript handlers (`x.onLook(() => { … })`); port the file first (docs/bennescript-ergonomics-refactor.md §11.2).'
    );
}

/** `…/src/game` for a file inside a BENNE game. */
export function gameRootOf(uri: vscode.Uri): string | undefined {
    const normalized = uri.fsPath.replace(/\\/g, '/');
    const i = normalized.lastIndexOf('/src/game/');
    return i < 0 ? undefined : uri.fsPath.slice(0, i + '/src/game'.length);
}

const indexes = new Map<string, IdsIndex>();

/** Generated modules change only when the generator runs; re-check a file at most this often. */
const RECHECK_MS = 500;
const fileCache = new Map<string, { text: string | undefined; mtimeMs: number; checkedAt: number }>();

function readGeneratedModule(file: string): string | undefined {
    const now = Date.now();
    const cached = fileCache.get(file);
    if (cached && now - cached.checkedAt < RECHECK_MS) {
        return cached.text;
    }
    let mtimeMs = -1;
    try {
        mtimeMs = fs.statSync(file).mtimeMs;
    } catch {
        fileCache.set(file, { text: undefined, mtimeMs, checkedAt: now });
        return undefined;
    }
    if (cached && cached.mtimeMs === mtimeMs) {
        cached.checkedAt = now;
        return cached.text;
    }
    let text: string | undefined;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        text = undefined;
    }
    fileCache.set(file, { text, mtimeMs, checkedAt: now });
    return text;
}

/** Forget cached generated modules (after running the generator). */
export function invalidateGeneratedModules(): void {
    fileCache.clear();
}

/** The generated-handle index of a game (picks up regenerated modules). */
export function idsIndexForGameRoot(gameRoot: string): IdsIndex {
    let index = indexes.get(gameRoot);
    if (!index) {
        index = new IdsIndex(ts, gameRoot, readGeneratedModule);
        indexes.set(gameRoot, index);
    }
    return index;
}

export function idsIndexFor(uri: vscode.Uri): IdsIndex | undefined {
    const root = gameRootOf(uri);
    return root ? idsIndexForGameRoot(root) : undefined;
}

/** Current text of a script: the open editor's buffer, else the file; `''` when missing. */
export async function readScriptText(scriptUri: vscode.Uri): Promise<string> {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === scriptUri.toString());
    if (open) {
        return open.getText();
    }
    try {
        return decoder.decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        return '';
    }
}

export function scriptModelOf(scriptUri: vscode.Uri, text: string): ScriptModel {
    return parseScriptModel(ts, scriptUri.fsPath, text);
}

/** Handlers for `spec` in a script's text (none for old-API scripts). */
export function handlersInText(scriptUri: vscode.Uri, text: string, spec: HandlerSpec): Registration[] {
    const index = idsIndexFor(scriptUri);
    if (!index || !text) {
        return [];
    }
    const model = scriptModelOf(scriptUri, text);
    return model.usesOldApi ? [] : findHandlers(model, index, spec);
}

export function scriptHasHandler(scriptUri: vscode.Uri, text: string, spec: HandlerSpec): boolean {
    return handlersInText(scriptUri, text, spec).length > 0;
}

/** Parses a script once and answers "is `spec` handled here?" for many specs (Inspector chips). */
export function handlerQuery(scriptUri: vscode.Uri, text: string): (spec: HandlerSpec) => boolean {
    const index = idsIndexFor(scriptUri);
    if (!index || !text) {
        return () => false;
    }
    const model = scriptModelOf(scriptUri, text);
    if (model.usesOldApi) {
        return () => false;
    }
    return (spec) => findHandlers(model, index, spec).length > 0;
}

export type EnsureHandlerResult =
    | { status: 'exists'; range: { start: number; end: number } }
    | { status: 'inserted'; range: { start: number; end: number } }
    | { status: 'failed' };

/**
 * Finds the handler for `spec` in `scriptUri`, or adds a stub (and its imports) at the end of the
 * file, creating the file when it doesn't exist. When the target has no generated handle yet (new
 * content), regenerates the handles once and retries.
 */
export async function ensureHandler(scriptUri: vscode.Uri, spec: HandlerSpec): Promise<EnsureHandlerResult> {
    const gameRoot = gameRootOf(scriptUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage(`${path.basename(scriptUri.fsPath)} is not inside a BENNE game (src/game).`);
        return { status: 'failed' };
    }
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { status: 'failed' };
    }
    const index = idsIndexForGameRoot(gameRoot);
    const text = await readScriptText(scriptUri);
    const model = scriptModelOf(scriptUri, text);
    if (model.usesOldApi) {
        void vscode.window.showErrorMessage(oldApiScriptMessage(scriptUri));
        return { status: 'failed' };
    }
    const existing = findHandlers(model, index, spec)[0];
    if (existing) {
        return { status: 'exists', range: { start: existing.start, end: existing.headEnd } };
    }
    let result = insertHandlerStub(ts, index, scriptUri.fsPath, text, spec);
    if ('error' in result) {
        const folder = vscode.workspace.getWorkspaceFolder(scriptUri);
        if (folder && (await runGenerateGameIds(folder, { quiet: true }))) {
            invalidateGeneratedModules();
            result = insertHandlerStub(ts, index, scriptUri.fsPath, text, spec);
        }
    }
    if ('error' in result) {
        void vscode.window.showErrorMessage(`Could not add ${describeHandlerSpec(spec, index)}: ${result.error}`);
        return { status: 'failed' };
    }
    await vscode.workspace.fs.writeFile(scriptUri, encoder.encode(result.text));
    return { status: 'inserted', range: { start: result.start, end: result.end } };
}

/** Selects `range` in the script and scrolls it into view. */
export async function revealRange(
    scriptUri: vscode.Uri,
    range: { start: number; end: number },
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(scriptUri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn });
    const len = doc.getText().length;
    const s = Math.max(0, Math.min(range.start, len));
    const e = Math.max(s, Math.min(range.end, len));
    editor.selection = new vscode.Selection(doc.positionAt(s), doc.positionAt(e));
    editor.revealRange(new vscode.Range(doc.positionAt(s), doc.positionAt(e)), vscode.TextEditorRevealType.InCenter);
}

/** Reveals the first handler for `spec`; shows a message (and the file) when there is none. */
export async function revealHandler(
    scriptUri: vscode.Uri,
    spec: HandlerSpec,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<boolean> {
    const text = await readScriptText(scriptUri);
    if (!text) {
        void vscode.window.showWarningMessage(`Script not found: ${scriptUri.fsPath}`);
        return false;
    }
    const model = scriptModelOf(scriptUri, text);
    const index = idsIndexFor(scriptUri);
    const found = index && !model.usesOldApi ? findHandlers(model, index, spec)[0] : undefined;
    if (found) {
        await revealRange(scriptUri, { start: found.start, end: found.headEnd }, viewColumn);
        return true;
    }
    void vscode.window.showInformationMessage(
        model.usesOldApi
            ? oldApiScriptMessage(scriptUri)
            : `No ${describeHandlerSpec(spec, index)} handler in ${path.basename(scriptUri.fsPath)}.`
    );
    await revealRange(scriptUri, { start: 0, end: 0 }, viewColumn);
    return false;
}

/**
 * Add-or-reveal in one step (Inspector chips): reveals an existing handler, or inserts a stub and
 * reveals that. Returns whether a stub was written.
 */
export async function ensureAndRevealHandler(
    scriptUri: vscode.Uri,
    spec: HandlerSpec,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active
): Promise<EnsureHandlerResult> {
    const result = await ensureHandler(scriptUri, spec);
    if (result.status !== 'failed') {
        await revealRange(scriptUri, result.range, viewColumn);
    }
    return result;
}

/** Result of an "add handler" command: the new stub's range, or the existing handler's. */
export type AddHandlerResult = {
    ok: boolean;
    insertedStubRange?: { start: number; end: number };
    existingRange?: { start: number; end: number };
};

/** {@link ensureHandler} with the usual messages; `what` reads like `look handler for prop "antenna"`. */
export async function addHandler(scriptUri: vscode.Uri, spec: HandlerSpec, what: string): Promise<AddHandlerResult> {
    const r = await ensureHandler(scriptUri, spec);
    const file = path.basename(scriptUri.fsPath);
    if (r.status === 'failed') {
        return { ok: false };
    }
    if (r.status === 'exists') {
        void vscode.window.showInformationMessage(`${file} already has a ${what}.`);
        return { ok: true, existingRange: r.range };
    }
    void vscode.window.showInformationMessage(`Added a ${what} in ${file}.`);
    return { ok: true, insertedStubRange: r.range };
}
