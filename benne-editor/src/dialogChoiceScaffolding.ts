import * as vscode from 'vscode';
import { applyBenneSingleColumnEditorLayout } from './benneEditorLayout';
import { BENNE_SCRIPT_VIEW_COLUMN, revealSourceRangeInDocument } from './roomScriptNavigation';

const DIALOG_SCRIPT_HINT =
    'Expected registerDialogScript with an arrow callback like registerDialogScript("id", ({ B }) => { … }).';

async function readDialogJsonStringId(dialogJsonUri: vscode.Uri): Promise<string | null> {
    try {
        const raw = await vscode.workspace.fs.readFile(dialogJsonUri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as { id?: unknown };
        return typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : null;
    } catch {
        return null;
    }
}

/** First string-literal argument after `openParen` (which points at `(`). */
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

/**
 * Locates `receiver.whenChoice('optionId', …)` (or `"id"`, `` `id` ``) and returns a UTF-16 range covering the full call.
 */
function findWhenChoiceCallRange(text: string, optionId: string): { start: number; end: number } | null {
    const needle = '.whenChoice';
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
        if (!arg || arg.value !== optionId) {
            from = dotIdx + 1;
            continue;
        }
        const closeParen = findMatchingCloseParenFromOpen(text, openParen);
        if (closeParen < 0) {
            return null;
        }
        let start = dotIdx + 1;
        let s = dotIdx - 1;
        while (s >= 0 && /[\w$]/.test(text[s])) {
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

function findRegisterDialogScriptCallIndex(source: string, dialogId: string): number {
    const needle = 'registerDialogScript(';
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
        if (!arg || arg.value !== dialogId) {
            searchFrom = i + needle.length;
            continue;
        }
        return i;
    }
}

function findFirstRegisterDialogScriptCallIndex(source: string): number {
    const needle = 'registerDialogScript(';
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

function resolveRegisterDialogScriptCallIndex(source: string, preferredFirstArgs: readonly string[]): number {
    const seen = new Set<string>();
    for (const raw of preferredFirstArgs) {
        const id = raw?.trim();
        if (!id || seen.has(id)) {
            continue;
        }
        seen.add(id);
        const idx = findRegisterDialogScriptCallIndex(source, id);
        if (idx >= 0) {
            return idx;
        }
    }
    return findFirstRegisterDialogScriptCallIndex(source);
}

function insertIntoBenneRegisterDialogScriptAtCall(
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

function extractBindingFromRegisterDialogScriptCall(source: string, callIdx: number): string | null {
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

/** `//` comment lines for the option’s spoken text (empty when the line is blank). */
function formatOptionTextCommentLines(optionText: string): string[] {
    const normalized = optionText.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
        return [];
    }
    return normalized.split('\n').map((line) => `// ${line.trimEnd()}`);
}

function whenChoiceHandlerStub(binding: string, optionId: string, optionText: string): string {
    const comments = formatOptionTextCommentLines(optionText);
    const commentBlock = comments.length > 0 ? `${comments.map((line) => `  ${line}`).join('\n')}\n` : '';
    return `\n${commentBlock}  ${binding}.whenChoice(${JSON.stringify(optionId)}, () => {\n  });\n`;
}

function minimalNewDialogScript(dialogId: string, optionId: string, optionText: string): string {
    const comments = formatOptionTextCommentLines(optionText);
    const commentBlock = comments.length > 0 ? `${comments.map((line) => `  ${line}`).join('\n')}\n` : '';
    return `import { registerDialogScript } from '@engine/scripting';

registerDialogScript(${JSON.stringify(dialogId)}, ({ B }) => {
${commentBlock}  B.whenChoice(${JSON.stringify(optionId)}, () => {
  });
});
`;
}

/**
 * Opens the sibling `*.dialog.ts`, adds `B.whenChoice` for `optionId` when missing, or reveals the existing call.
 */
export async function ensureDialogWhenChoiceHandlerAndReveal(
    dialogJsonUri: vscode.Uri,
    dialogId: string,
    optionId: string,
    optionText = ''
): Promise<void> {
    const jsonStringId = await readDialogJsonStringId(dialogJsonUri);
    const preferredScriptIds = [...new Set([jsonStringId, dialogId].filter((s): s is string => Boolean(s?.trim())))];
    const registrationIdForNewFile = jsonStringId ?? dialogId;

    const scriptUri = vscode.Uri.joinPath(dialogJsonUri, '..', `${dialogId}.dialog.ts`);
    let text = '';
    try {
        text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        const body = minimalNewDialogScript(registrationIdForNewFile, optionId, optionText);
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(body));
        const range = findWhenChoiceCallRange(body, optionId);
        if (range) {
            await revealSourceRangeInDocument(scriptUri, range.start, range.end, vscode.ViewColumn.One);
        }
        await applyBenneSingleColumnEditorLayout();
        void vscode.window.showInformationMessage(`Created ${dialogId}.dialog.ts with a choice handler stub.`);
        return;
    }

    const existing = findWhenChoiceCallRange(text, optionId);
    if (existing) {
        await revealSourceRangeInDocument(scriptUri, existing.start, existing.end, vscode.ViewColumn.One);
        await applyBenneSingleColumnEditorLayout();
        return;
    }

    const callIdx = resolveRegisterDialogScriptCallIndex(text, preferredScriptIds);
    if (callIdx < 0) {
        void vscode.window.showErrorMessage(`Could not find registerDialogScript in ${dialogId}.dialog.ts.`);
        return;
    }
    const binding = extractBindingFromRegisterDialogScriptCall(text, callIdx);
    if (!binding) {
        void vscode.window.showErrorMessage(`Could not parse ${dialogId}.dialog.ts. ${DIALOG_SCRIPT_HINT}`);
        return;
    }

    const stub = whenChoiceHandlerStub(binding, optionId, optionText);
    const inserted = insertIntoBenneRegisterDialogScriptAtCall(text, callIdx, stub);
    if (!inserted) {
        void vscode.window.showErrorMessage(`Could not insert into ${dialogId}.dialog.ts. ${DIALOG_SCRIPT_HINT}`);
        return;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    const after = findWhenChoiceCallRange(inserted.text, optionId);
    if (after) {
        await revealSourceRangeInDocument(scriptUri, after.start, after.end, vscode.ViewColumn.One);
    } else {
        await revealSourceRangeInDocument(scriptUri, inserted.start, inserted.end, vscode.ViewColumn.One);
    }
    await applyBenneSingleColumnEditorLayout();
    void vscode.window.showInformationMessage(`Added B.whenChoice handler for "${optionId}".`);
}
