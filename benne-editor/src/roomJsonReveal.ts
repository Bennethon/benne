import * as vscode from 'vscode';
import { BENNE_ROOM_SOURCES_VIEW_COLUMN } from './roomScriptNavigation';

export type RoomJsonElementKind = 'hotspot' | 'prop' | 'roomPoint' | 'region' | 'roomCharacter';

const ARRAY_KEY: Record<RoomJsonElementKind, string> = {
    hotspot: 'hotspots',
    prop: 'props',
    roomPoint: 'points',
    region: 'regions',
    roomCharacter: 'characters'
};

function escapeRegex(s: string): string {
    return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function findMatchingClose(text: string, openIdx: number, openCh: string, closeCh: string): number {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = openIdx; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (c === '\\') {
                escape = true;
            } else if (c === '"') {
                inString = false;
            }
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === openCh) {
            depth++;
        } else if (c === closeCh) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function skipJsonValue(text: string, i: number): number {
    while (i < text.length && /\s/.test(text[i])) {
        i++;
    }
    if (i >= text.length) {
        return i;
    }
    const c = text[i];
    if (c === '"') {
        i++;
        while (i < text.length) {
            if (text[i] === '\\') {
                i += 2;
            } else if (text[i] === '"') {
                return i + 1;
            } else {
                i++;
            }
        }
        return i;
    }
    if (c === '{') {
        const end = findMatchingClose(text, i, '{', '}');
        return end < 0 ? text.length : end + 1;
    }
    if (c === '[') {
        const end = findMatchingClose(text, i, '[', ']');
        return end < 0 ? text.length : end + 1;
    }
    if (text.startsWith('true', i)) {
        return i + 4;
    }
    if (text.startsWith('false', i)) {
        return i + 5;
    }
    if (text.startsWith('null', i)) {
        return i + 4;
    }
    while (i < text.length && /[-0-9.eE+]/.test(text[i])) {
        i++;
    }
    return i;
}

/** Index of `[` opening the root object's `key` array value, or -1. */
function findRootArrayOpenBracket(text: string, key: string): number {
    let i = 0;
    while (i < text.length && /\s/.test(text[i])) {
        i++;
    }
    if (i >= text.length || text[i] !== '{') {
        return -1;
    }
    i++;
    let braceDepth = 1;
    let inString = false;
    let escape = false;
    while (i < text.length) {
        const c = text[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (c === '\\') {
                escape = true;
            } else if (c === '"') {
                inString = false;
            }
            i++;
            continue;
        }
        if (c === '"') {
            const bodyStart = i + 1;
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2;
                } else if (text[j] === '"') {
                    break;
                } else {
                    j++;
                }
            }
            if (j >= text.length) {
                return -1;
            }
            const content = text.slice(bodyStart, j);
            let k = j + 1;
            while (k < text.length && /\s/.test(text[k])) {
                k++;
            }
            if (k < text.length && text[k] === ':') {
                k++;
                while (k < text.length && /\s/.test(text[k])) {
                    k++;
                }
                if (braceDepth === 1 && content === key && k < text.length && text[k] === '[') {
                    return k;
                }
                i = skipJsonValue(text, k);
                continue;
            }
            i = j + 1;
            continue;
        }
        if (c === '{') {
            braceDepth++;
        } else if (c === '}') {
            braceDepth--;
        }
        i++;
    }
    return -1;
}

export function findRoomJsonElementIdRange(
    text: string,
    kind: RoomJsonElementKind,
    elementId: string
): { start: number; end: number } | undefined {
    const key = ARRAY_KEY[kind];
    const openBracket = findRootArrayOpenBracket(text, key);
    const idKey = kind === 'roomCharacter' ? 'instanceId' : 'id';
    const idRe = new RegExp(`"${idKey}"\\s*:\\s*"${escapeRegex(elementId)}"`);
    if (openBracket >= 0) {
        const closeBracket = findMatchingClose(text, openBracket, '[', ']');
        if (closeBracket < 0) {
            return undefined;
        }
        const section = text.slice(openBracket, closeBracket + 1);
        const m = idRe.exec(section);
        if (m && m.index !== undefined) {
            const start = openBracket + m.index;
            return { start, end: start + m[0].length };
        }
    }
    const global = [...text.matchAll(new RegExp(idRe.source, 'g'))];
    if (global.length === 1 && global[0].index !== undefined) {
        const start = global[0].index;
        return { start, end: start + global[0][0].length };
    }
    return undefined;
}

export async function revealRoomJsonElement(
    roomJsonUri: vscode.Uri,
    kind: RoomJsonElementKind,
    elementId: string
): Promise<void> {
    let text: string;
    try {
        const raw = await vscode.workspace.fs.readFile(roomJsonUri);
        text = new TextDecoder('utf-8').decode(raw);
    } catch {
        return;
    }

    const range = findRoomJsonElementIdRange(text, kind, elementId);
    const doc = await vscode.workspace.openTextDocument(roomJsonUri);
    const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: BENNE_ROOM_SOURCES_VIEW_COLUMN
    });

    if (!range) {
        const start = doc.positionAt(0);
        editor.selection = new vscode.Selection(start, start);
        return;
    }

    const a = doc.positionAt(range.start);
    const b = doc.positionAt(range.end);
    editor.selection = new vscode.Selection(a, b);
    editor.revealRange(new vscode.Range(a, a), vscode.TextEditorRevealType.InCenter);
}
