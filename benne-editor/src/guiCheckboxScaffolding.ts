import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import { BENNE_SCRIPT_VIEW_COLUMN, revealSourceRangeInDocument } from './roomScriptNavigation';

const GUI_SCRIPT_HINT =
    'Expected registerGuiScript with an arrow callback like registerGuiScript("id", ({ B }) => { … }).';

type WhenCheckboxMethod = 'whenCheckboxCheck' | 'whenCheckboxUncheck';

async function readGuiJsonStringId(guiJsonUri: vscode.Uri): Promise<string | null> {
    try {
        const raw = await vscode.workspace.fs.readFile(guiJsonUri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as { id?: unknown };
        return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : null;
    } catch {
        return null;
    }
}

function parseFirstStringLiteralArgAfterParen(
    text: string,
    openParen: number
): { value: string; closeQuoteIdx: number } | null {
    let i = openParen + 1;
    while (i < text.length && /\s/.test(text[i])) {
        i++;
    }
    const q = text[i];
    if (q !== "'" && q !== '"' && q !== '`') {
        return null;
    }
    const start = i + 1;
    let j = start;
    let value = '';
    while (j < text.length) {
        const c = text[j];
        if (c === '\\') {
            j++;
            if (j >= text.length) {
                return null;
            }
            value += text[j];
            j++;
            continue;
        }
        if (c === q) {
            return { value, closeQuoteIdx: j };
        }
        if (q === '`' && c === '$' && text[j + 1] === '{') {
            return null;
        }
        value += c;
        j++;
    }
    return null;
}

function findMatchingCloseParenFromOpen(text: string, openIdx: number): number {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        const c = text[i];
        if (c === '(') {
            depth++;
        } else if (c === ')') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function findWhenCheckboxMethodCallRange(
    text: string,
    method: WhenCheckboxMethod,
    checkboxId: string
): { start: number; end: number } | null {
    const needle = `.${method}`;
    let from = 0;
    while (true) {
        const dotIdx = text.indexOf(needle, from);
        if (dotIdx < 0) {
            return null;
        }
        const openParen = text.indexOf('(', dotIdx + needle.length);
        if (openParen < 0) {
            from = dotIdx + 1;
            continue;
        }
        const arg = parseFirstStringLiteralArgAfterParen(text, openParen);
        if (!arg || arg.value !== checkboxId) {
            from = dotIdx + 1;
            continue;
        }
        const closeParen = findMatchingCloseParenFromOpen(text, openParen);
        if (closeParen < 0) {
            return null;
        }
        let s = dotIdx - 1;
        while (s >= 0 && /[\w$]/.test(text[s])) {
            s--;
        }
        return { start: s + 1, end: closeParen + 1 };
    }
}

function extractBenneBindingFromParamInner(inner: string): string | null {
    const trimmed = inner.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return null;
    }
    const body = trimmed.slice(1, -1).trim();
    if (!body) {
        return null;
    }
    const alias = /^B\s*:\s*([A-Za-z_$][\w$]*)$/.exec(body.replace(/\s+/g, ' ').trim());
    if (alias) {
        return alias[1];
    }
    if (/(^|,)\s*B\s*(,|$)/.test(body)) {
        return 'B';
    }
    return null;
}

function findRegisterGuiScriptCallIndex(source: string, guiId: string): number {
    const needle = 'registerGuiScript(';
    let searchFrom = 0;
    while (true) {
        const i = source.indexOf(needle, searchFrom);
        if (i < 0) {
            return -1;
        }
        const lineStart = source.lastIndexOf('\n', i) + 1;
        const lineEnd = source.indexOf('\n', i);
        const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
        if (/^\s*import\s/.test(line)) {
            searchFrom = i + needle.length;
            continue;
        }
        const open = i + needle.length - 1;
        const arg = parseFirstStringLiteralArgAfterParen(source, open);
        if (!arg || arg.value !== guiId) {
            searchFrom = i + needle.length;
            continue;
        }
        return i;
    }
}

function findFirstRegisterGuiScriptCallIndex(source: string): number {
    const needle = 'registerGuiScript(';
    let searchFrom = 0;
    while (true) {
        const i = source.indexOf(needle, searchFrom);
        if (i < 0) {
            return -1;
        }
        const lineStart = source.lastIndexOf('\n', i) + 1;
        const lineEnd = source.indexOf('\n', i);
        const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
        if (/^\s*import\s/.test(line)) {
            searchFrom = i + needle.length;
            continue;
        }
        return i;
    }
}

function resolveRegisterGuiScriptCallIndex(source: string, preferredFirstArgs: readonly string[]): number {
    const seen = new Set<string>();
    for (const raw of preferredFirstArgs) {
        const id = raw?.trim();
        if (!id || seen.has(id)) {
            continue;
        }
        seen.add(id);
        const idx = findRegisterGuiScriptCallIndex(source, id);
        if (idx >= 0) {
            return idx;
        }
    }
    return findFirstRegisterGuiScriptCallIndex(source);
}

function insertIntoBenneRegisterGuiScriptAtCall(
    source: string,
    callIdx: number,
    indentedSnippet: string
): { text: string; start: number; end: number } | null {
    const regOpen = source.indexOf('(', callIdx);
    if (regOpen < 0) {
        return null;
    }
    const firstArgClose = parseFirstStringLiteralArgAfterParen(source, regOpen);
    if (!firstArgClose) {
        return null;
    }
    let i = firstArgClose.closeQuoteIdx + 1;
    while (i < source.length && /\s/.test(source[i])) {
        i++;
    }
    if (source[i] !== ',') {
        return null;
    }
    i++;
    while (i < source.length && /\s/.test(source[i])) {
        i++;
    }
    if (source[i] !== '(') {
        return null;
    }
    const paramOpen = i;
    const paramClose = findMatchingCloseParenFromOpen(source, paramOpen);
    if (paramClose < 0) {
        return null;
    }
    const paramInner = source.slice(paramOpen + 1, paramClose);
    if (extractBenneBindingFromParamInner(paramInner) === null) {
        return null;
    }
    i = paramClose + 1;
    while (i < source.length && /\s/.test(source[i])) {
        i++;
    }
    if (source[i] !== '=' || source[i + 1] !== '>') {
        return null;
    }
    const arrowIdx = i;
    const bodyOpen = source.indexOf('{', arrowIdx);
    if (bodyOpen < 0) {
        return null;
    }
    let depth = 0;
    for (let j = bodyOpen; j < source.length; j++) {
        const c = source[j];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                const insertAt = j;
                const text = source.slice(0, insertAt) + indentedSnippet + source.slice(insertAt);
                return {
                    text,
                    start: insertAt,
                    end: insertAt + indentedSnippet.length
                };
            }
        }
    }
    return null;
}

function extractBindingFromRegisterGuiScriptCall(source: string, callIdx: number): string | null {
    if (callIdx < 0) {
        return null;
    }
    const regOpen = source.indexOf('(', callIdx);
    if (regOpen < 0) {
        return null;
    }
    const firstArgClose = parseFirstStringLiteralArgAfterParen(source, regOpen);
    if (!firstArgClose) {
        return null;
    }
    let i = firstArgClose.closeQuoteIdx + 1;
    while (i < source.length && /\s/.test(source[i])) {
        i++;
    }
    if (source[i] !== ',') {
        return null;
    }
    i++;
    while (i < source.length && /\s/.test(source[i])) {
        i++;
    }
    if (source[i] !== '(') {
        return null;
    }
    const paramOpen = i;
    const paramClose = findMatchingCloseParenFromOpen(source, paramOpen);
    if (paramClose < 0) {
        return null;
    }
    const paramInner = source.slice(paramOpen + 1, paramClose);
    return extractBenneBindingFromParamInner(paramInner);
}

async function ensureGuiCheckboxHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    checkboxId: string,
    method: WhenCheckboxMethod,
    label: string
): Promise<void> {
    const jsonStringId = await readGuiJsonStringId(guiJsonUri);
    const preferredScriptIds = [...new Set([jsonStringId, guiId].filter((s): s is string => Boolean(s?.trim())))];
    const registrationIdForNewFile = jsonStringId ?? guiId;

    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    let text = '';
    try {
        text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        const body = `import { registerGuiScript } from '@engine/scripting';

registerGuiScript(${JSON.stringify(registrationIdForNewFile)}, ({ B }) => {
  B.${method}(${JSON.stringify(checkboxId)}, () => {
  });
});
`;
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(body));
        const range = findWhenCheckboxMethodCallRange(body, method, checkboxId);
        if (range) {
            await revealSourceRangeInDocument(scriptUri, range.start, range.end, BENNE_SCRIPT_VIEW_COLUMN);
        }
        await applyBenneTwoRowJsonScriptLayout();
        void vscode.window.showInformationMessage(`Created ${guiId}.gui.ts with a ${label} handler stub.`);
        return;
    }

    const existing = findWhenCheckboxMethodCallRange(text, method, checkboxId);
    if (existing) {
        await revealSourceRangeInDocument(scriptUri, existing.start, existing.end, BENNE_SCRIPT_VIEW_COLUMN);
        await applyBenneTwoRowJsonScriptLayout();
        return;
    }

    const callIdx = resolveRegisterGuiScriptCallIndex(text, preferredScriptIds);
    if (callIdx < 0) {
        void vscode.window.showErrorMessage(`Could not find registerGuiScript in ${guiId}.gui.ts.`);
        return;
    }
    const binding = extractBindingFromRegisterGuiScriptCall(text, callIdx);
    if (!binding) {
        void vscode.window.showErrorMessage(`Could not parse ${guiId}.gui.ts. ${GUI_SCRIPT_HINT}`);
        return;
    }

    const stub = `\n  ${binding}.${method}(${JSON.stringify(checkboxId)}, () => {\n  });\n`;
    const inserted = insertIntoBenneRegisterGuiScriptAtCall(text, callIdx, stub);
    if (!inserted) {
        void vscode.window.showErrorMessage(`Could not insert into ${guiId}.gui.ts. ${GUI_SCRIPT_HINT}`);
        return;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    const after = findWhenCheckboxMethodCallRange(inserted.text, method, checkboxId);
    if (after) {
        await revealSourceRangeInDocument(scriptUri, after.start, after.end, BENNE_SCRIPT_VIEW_COLUMN);
    } else {
        await revealSourceRangeInDocument(scriptUri, inserted.start, inserted.end, BENNE_SCRIPT_VIEW_COLUMN);
    }
    await applyBenneTwoRowJsonScriptLayout();
    void vscode.window.showInformationMessage(`Added B.${method} handler for "${checkboxId}".`);
}

export async function ensureGuiCheckboxCheckHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    checkboxId: string
): Promise<void> {
    await ensureGuiCheckboxHandlerAndReveal(
        guiJsonUri,
        guiId,
        checkboxId,
        'whenCheckboxCheck',
        'checkbox check'
    );
}

export async function ensureGuiCheckboxUncheckHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    checkboxId: string
): Promise<void> {
    await ensureGuiCheckboxHandlerAndReveal(
        guiJsonUri,
        guiId,
        checkboxId,
        'whenCheckboxUncheck',
        'checkbox uncheck'
    );
}
