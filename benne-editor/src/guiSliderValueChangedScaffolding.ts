import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import { BENNE_SCRIPT_VIEW_COLUMN, revealSourceRangeInDocument } from './roomScriptNavigation';

const GUI_SCRIPT_HINT =
    'Expected registerGuiScript with an arrow callback like registerGuiScript("id", ({ B }) => { … }).';

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

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locates `B.gui(…).control('sliderId').whenValueChanged(…)` and returns a UTF-16 range covering the full call.
 */
function findWhenValueChangedCallRange(text: string, sliderId: string): { start: number; end: number } | null {
    const needle = '.whenValueChanged';
    let from = 0;
    while (true) {
        const wvcIdx = text.indexOf(needle, from);
        if (wvcIdx < 0) {
            return null;
        }
        const lookbackStart = Math.max(0, wvcIdx - 160);
        const before = text.slice(lookbackStart, wvcIdx);
        const controlRe = new RegExp(
            `\\.control\\(\\s*(['"\`])${escapeRegex(sliderId)}\\1\\s*\\)\\s*$`
        );
        if (!controlRe.test(before)) {
            from = wvcIdx + 1;
            continue;
        }
        const openParen = text.indexOf('(', wvcIdx + needle.length);
        if (openParen < 0) {
            from = wvcIdx + 1;
            continue;
        }
        const closeParen = findMatchingCloseParenFromOpen(text, openParen);
        if (closeParen < 0) {
            return null;
        }
        let start = wvcIdx;
        let s = wvcIdx - 1;
        while (s >= 0 && /[\w$.)]/.test(text[s])) {
            s--;
        }
        start = s + 1;
        return { start, end: closeParen + 1 };
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

function minimalNewGuiScript(guiId: string, sliderId: string): string {
    return `import { registerGuiScript } from '@engine/scripting';

registerGuiScript(${JSON.stringify(guiId)}, ({ B }) => {
  B.gui(${JSON.stringify(guiId)}).control(${JSON.stringify(sliderId)}).whenValueChanged((newVal) => {
  });
});
`;
}

/**
 * Opens the sibling \`*.gui.ts\`, adds \`whenValueChanged\` for \`sliderId\` when missing, or reveals the existing call.
 */
export async function ensureGuiSliderValueChangedHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    sliderId: string
): Promise<void> {
    const jsonStringId = await readGuiJsonStringId(guiJsonUri);
    const preferredScriptIds = [...new Set([jsonStringId, guiId].filter((s): s is string => Boolean(s?.trim())))];
    const registrationIdForNewFile = jsonStringId ?? guiId;
    const overlayGuiId = jsonStringId ?? guiId;

    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    let text = '';
    try {
        text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        const body = minimalNewGuiScript(registrationIdForNewFile, sliderId);
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(body));
        const range = findWhenValueChangedCallRange(body, sliderId);
        if (range) {
            await revealSourceRangeInDocument(scriptUri, range.start, range.end, BENNE_SCRIPT_VIEW_COLUMN);
        }
        await applyBenneTwoRowJsonScriptLayout();
        void vscode.window.showInformationMessage(`Created ${guiId}.gui.ts with a slider value-changed handler stub.`);
        return;
    }

    const existing = findWhenValueChangedCallRange(text, sliderId);
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

    const stub = `\n  ${binding}.gui(${JSON.stringify(overlayGuiId)}).control(${JSON.stringify(sliderId)}).whenValueChanged((newVal) => {\n  });\n`;
    const inserted = insertIntoBenneRegisterGuiScriptAtCall(text, callIdx, stub);
    if (!inserted) {
        void vscode.window.showErrorMessage(`Could not insert into ${guiId}.gui.ts. ${GUI_SCRIPT_HINT}`);
        return;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    const after = findWhenValueChangedCallRange(inserted.text, sliderId);
    if (after) {
        await revealSourceRangeInDocument(scriptUri, after.start, after.end, BENNE_SCRIPT_VIEW_COLUMN);
    } else {
        await revealSourceRangeInDocument(scriptUri, inserted.start, inserted.end, BENNE_SCRIPT_VIEW_COLUMN);
    }
    await applyBenneTwoRowJsonScriptLayout();
    void vscode.window.showInformationMessage(`Added whenValueChanged handler for slider "${sliderId}".`);
}
