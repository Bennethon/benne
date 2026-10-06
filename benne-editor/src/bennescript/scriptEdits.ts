/**
 * Text edits for BenneScript files: add named imports and append top-level statements.
 * Pure (no `vscode`); offsets are UTF-16, like VS Code's.
 */
import type * as TS from 'typescript';
import { parseScriptModel, type ScriptModel } from './scriptModel';

export interface ImportNeed {
    module: string;
    name: string;
}

export interface InsertResult {
    text: string;
    /** Range of the inserted statement in `text`. */
    start: number;
    end: number;
}

/** `@benne/script`, then `@game`, then relative modules: the order the ported scripts use. */
function moduleRank(specifier: string): number {
    if (specifier === '@benne/script') {
        return 0;
    }
    if (specifier === '@game') {
        return 1;
    }
    return specifier.startsWith('.') ? 3 : 2;
}

/** Adds `name` to the script's `import { … } from 'module'`, or a new import declaration. */
export function addNamedImport(model: ScriptModel, need: ImportNeed): string {
    const text = model.text;
    const existing = model.imports.find((d) => d.module === need.module && !d.typeOnly && d.braces);
    if (existing) {
        if (existing.names.some((n) => n.local === need.name && !n.typeOnly)) {
            return text;
        }
        const braces = existing.braces!;
        const inner = text.slice(braces.start + 1, braces.end - 1);
        if (inner.trim().length === 0) {
            return `${text.slice(0, braces.start)}{ ${need.name} }${text.slice(braces.end)}`;
        }
        // After the last name, keeping the author's layout (one line or several, trailing comma).
        const lastNameEnd = braces.start + 1 + inner.replace(/[\s,]+$/, '').length;
        return `${text.slice(0, lastNameEnd)}, ${need.name}${text.slice(lastNameEnd)}`;
    }
    const line = `import { ${need.name} } from '${need.module}';\n`;
    const rank = moduleRank(need.module);
    const after = model.imports.filter((d) => moduleRank(d.module) <= rank).pop();
    if (after) {
        const at = lineEndAfter(text, after.end);
        return `${text.slice(0, at)}${line}${text.slice(at)}`;
    }
    const first = model.imports[0];
    if (first) {
        const at = lineStartOf(text, first.start);
        return `${text.slice(0, at)}${line}${text.slice(at)}`;
    }
    const at = leadingCommentEnd(text);
    const sep = text.slice(at).trim().length > 0 ? '\n' : '';
    return `${text.slice(0, at)}${line}${sep}${text.slice(at)}`;
}

/** Appends a top-level statement at the end of the file, one blank line after the code above. */
export function appendStatement(text: string, statement: string): InsertResult {
    const body = text.replace(/\s+$/, '');
    const prefix = body.length > 0 ? `${body}\n\n` : '';
    const start = prefix.length;
    const out = `${prefix}${statement}\n`;
    return { text: out, start, end: start + statement.length };
}

/** Adds the imports (in order), then appends `statement`. */
export function insertTopLevelStatement(
    ts: typeof TS,
    fileName: string,
    text: string,
    imports: readonly ImportNeed[],
    statement: string,
): InsertResult {
    let current = text;
    for (const need of imports) {
        current = addNamedImport(parseScriptModel(ts, fileName, current), need);
    }
    return appendStatement(current, statement);
}

function lineEndAfter(text: string, offset: number): number {
    const nl = text.indexOf('\n', offset);
    return nl < 0 ? text.length : nl + 1;
}

function lineStartOf(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

/** End of the comment block at the top of a file (file headers stay first). */
function leadingCommentEnd(text: string): number {
    const m = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/[^\n]*\n))*/.exec(text);
    return m ? m[0].length : 0;
}

/** `'it\'s'`: single-quoted TS string, the style the ported scripts use for IDs and names. */
export function singleQuoted(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')}'`;
}
