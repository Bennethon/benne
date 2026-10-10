/**
 * The game's `src/game/state.ts` (docs/bennescript-ergonomics-refactor.md §4.7): reads the
 * `defineFlags({…})` and `defineVars({…})` entries and edits them for the State view.
 * Pure (no `vscode`); offsets are UTF-16, like VS Code's. Every edit is a splice, so the
 * author's comments and layout survive.
 */
import type * as TS from 'typescript';
import { addNamedImport, singleQuoted, type InsertResult } from './scriptEdits';
import { parseScriptModel } from './scriptModel';
import { isIdentifierName, type StateSectionKind } from './stateNames';

export type { StateSectionKind } from './stateNames';

/** What a variable can hold (`VarValue` in the engine's `handles.ts`). */
export type StateValue = string | number | boolean | null | StateValue[] | { [key: string]: StateValue };

export interface StateEntry {
    name: string;
    /** The property's key. */
    nameStart: number;
    nameEnd: number;
    /** The whole property, without the comma after it. */
    start: number;
    end: number;
    /**
     * Whether the State view can show and change the value. False for spreads, computed keys and
     * values that aren't literals; those keep `value` undefined.
     */
    editable: boolean;
    value?: StateValue;
    /** The value's source range: the `true`/`false` inside `flag(…)`, the expression before `as …`. */
    valueStart: number;
    valueEnd: number;
    /** `flag(false, { saveKey: 'escaped closet' })` */
    saveKey?: string;
}

export interface StateSection {
    kind: StateSectionKind;
    /** Offsets of the object literal's `{` and `}`. */
    open: number;
    close: number;
    entries: StateEntry[];
}

export interface StateFile {
    flags: StateSection | null;
    vars: StateSection | null;
}

const DEFINE: Record<StateSectionKind, string> = { flags: 'defineFlags', vars: 'defineVars' };

export function parseStateFile(ts: typeof TS, fileName: string, text: string): StateFile {
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const out: StateFile = { flags: null, vars: null };
    for (const stmt of sf.statements) {
        if (!ts.isVariableStatement(stmt)) {
            continue;
        }
        for (const decl of stmt.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name) || (decl.name.text !== 'flags' && decl.name.text !== 'vars')) {
                continue;
            }
            const kind: StateSectionKind = decl.name.text;
            const init = decl.initializer;
            if (
                !init ||
                !ts.isCallExpression(init) ||
                !ts.isIdentifier(init.expression) ||
                init.expression.text !== DEFINE[kind]
            ) {
                continue;
            }
            const obj = init.arguments[0];
            if (!obj || !ts.isObjectLiteralExpression(obj) || out[kind]) {
                continue;
            }
            out[kind] = {
                kind,
                open: obj.getStart(sf),
                close: obj.getEnd() - 1,
                entries: obj.properties.map((p) => readEntry(ts, sf, kind, p)),
            };
        }
    }
    return out;
}

function readEntry(ts: typeof TS, sf: TS.SourceFile, kind: StateSectionKind, p: TS.ObjectLiteralElementLike): StateEntry {
    const start = p.getStart(sf);
    const end = p.getEnd();
    const fixed = { start, end, nameStart: start, nameEnd: end, editable: false, valueStart: start, valueEnd: end };
    if (ts.isShorthandPropertyAssignment(p)) {
        return { ...fixed, name: p.name.text, nameStart: p.name.getStart(sf), nameEnd: p.name.getEnd() };
    }
    if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
        return { ...fixed, name: p.getText(sf) };
    }
    const named = { ...fixed, name: p.name.text, nameStart: p.name.getStart(sf), nameEnd: p.name.getEnd() };
    // A quoted key isn't renamed or validated like a name, so the view leaves it alone.
    if (!ts.isIdentifier(p.name)) {
        return named;
    }
    if (kind === 'flags') {
        return { ...named, ...readFlagValue(ts, sf, p.initializer) };
    }
    const inner = stripTypeSuffix(ts, p.initializer);
    const value = literalValue(ts, inner);
    if (value === undefined) {
        return named;
    }
    return { ...named, editable: true, value, valueStart: inner.getStart(sf), valueEnd: inner.getEnd() };
}

function readFlagValue(
    ts: typeof TS,
    sf: TS.SourceFile,
    init: TS.Expression,
): Partial<StateEntry> {
    const bool = (e: TS.Expression | undefined): boolean | undefined =>
        e?.kind === ts.SyntaxKind.TrueKeyword ? true : e?.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
    const direct = bool(init);
    if (direct !== undefined) {
        return { editable: true, value: direct, valueStart: init.getStart(sf), valueEnd: init.getEnd() };
    }
    // flag(default, { saveKey })
    if (!ts.isCallExpression(init) || !ts.isIdentifier(init.expression) || init.expression.text !== 'flag') {
        return {};
    }
    const [first, options] = init.arguments;
    const value = bool(first);
    if (value === undefined) {
        return {};
    }
    let saveKey: string | undefined;
    if (options && ts.isObjectLiteralExpression(options)) {
        for (const o of options.properties) {
            if (
                ts.isPropertyAssignment(o) &&
                ts.isIdentifier(o.name) &&
                o.name.text === 'saveKey' &&
                ts.isStringLiteralLike(o.initializer)
            ) {
                saveKey = o.initializer.text;
            }
        }
    }
    return { editable: true, value, valueStart: first.getStart(sf), valueEnd: first.getEnd(), saveKey };
}

/** `[] as string[]` and `{} satisfies Inventory`: the value is the expression before the type. */
function stripTypeSuffix(ts: typeof TS, e: TS.Expression): TS.Expression {
    let cur = e;
    while (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur) || ts.isParenthesizedExpression(cur)) {
        cur = cur.expression;
    }
    return cur;
}

/** A JSON-compatible literal's value, or undefined when it isn't one. */
function literalValue(ts: typeof TS, e: TS.Expression): StateValue | undefined {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
        return e.text;
    }
    if (ts.isNumericLiteral(e)) {
        return Number(e.text);
    }
    if (
        ts.isPrefixUnaryExpression(e) &&
        e.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(e.operand)
    ) {
        return -Number(e.operand.text);
    }
    if (e.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }
    if (e.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }
    if (e.kind === ts.SyntaxKind.NullKeyword) {
        return null;
    }
    if (ts.isArrayLiteralExpression(e)) {
        const items: StateValue[] = [];
        for (const el of e.elements) {
            const v = literalValue(ts, el);
            if (v === undefined) {
                return undefined;
            }
            items.push(v);
        }
        return items;
    }
    if (ts.isObjectLiteralExpression(e)) {
        const obj: { [key: string]: StateValue } = {};
        for (const p of e.properties) {
            if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
                return undefined;
            }
            const v = literalValue(ts, p.initializer);
            if (v === undefined) {
                return undefined;
            }
            obj[p.name.text] = v;
        }
        return obj;
    }
    return undefined;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** A var's value as TypeScript source, in the scripts' style: `'text'`, `[1, 2]`, `{ a: 1 }`. */
export function formatVarLiteral(value: StateValue): string {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return singleQuoted(value);
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`${value} can't be saved; use a finite number.`);
        }
        return String(value);
    }
    if (typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(formatVarLiteral).join(', ')}]`;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) {
        return '{}';
    }
    const parts = keys.map((k) => `${isIdentifierName(k) ? k : singleQuoted(k)}: ${formatVarLiteral(value[k])}`);
    return `{ ${parts.join(', ')} }`;
}

// ─── Edits ───────────────────────────────────────────────────────────────────

function splice(text: string, start: number, end: number, replacement: string): InsertResult {
    return {
        text: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
        start,
        end: start + replacement.length,
    };
}

export function setFlagDefault(text: string, entry: StateEntry, value: boolean): InsertResult {
    return splice(text, entry.valueStart, entry.valueEnd, String(value));
}

export function setVarValue(text: string, entry: StateEntry, value: StateValue): InsertResult {
    return splice(text, entry.valueStart, entry.valueEnd, formatVarLiteral(value));
}

function lineStartOf(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

function lineEndOf(text: string, offset: number): number {
    const nl = text.indexOf('\n', offset);
    return nl < 0 ? text.length : nl;
}

function indentAt(text: string, offset: number): string {
    return /^[ \t]*/.exec(text.slice(lineStartOf(text, offset)))![0];
}

/** Whether only spaces and tabs come before `offset` on its line. */
function startsLine(text: string, offset: number): boolean {
    return /^[ \t]*$/.test(text.slice(lineStartOf(text, offset), offset));
}

/** The offset just after the comma that follows `end` (skipping spaces and comments), or -1. */
function commaAfter(text: string, end: number): number {
    const m = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*,/.exec(text.slice(end));
    return m ? end + m[0].length : -1;
}

/** The indent step the file uses inside `defineFlags` / `defineVars` (two spaces when there is nothing to go by). */
function indentUnit(text: string, file: StateFile): string {
    for (const s of [file.flags, file.vars]) {
        const e = s?.entries.find((x) => startsLine(text, x.start));
        if (s && e) {
            const outer = indentAt(text, s.close);
            const inner = indentAt(text, e.start);
            if (inner.startsWith(outer) && inner.length > outer.length) {
                return inner.slice(outer.length);
            }
        }
    }
    return '  ';
}

/** Adds `name: <source>` as the section's last entry, after any comments at the end of the list. */
export function addStateEntry(
    text: string,
    file: StateFile,
    section: StateSection,
    name: string,
    valueSource: string,
): InsertResult {
    const entry = `${name}: ${valueSource}`;
    const last = section.entries[section.entries.length - 1];
    const inner = text.slice(section.open + 1, section.close);
    if (!last && inner.trim().length === 0) {
        // `{}` becomes one entry per line.
        const outer = indentAt(text, section.open);
        const replacement = `{\n${outer}${indentUnit(text, file)}${entry},\n${outer}}`;
        const r = splice(text, section.open, section.close + 1, replacement);
        const start = section.open + replacement.indexOf(entry);
        return { text: r.text, start, end: start + entry.length };
    }
    if (startsLine(text, section.close)) {
        let current = text;
        let shift = 0;
        let trailingComma = true;
        if (last) {
            trailingComma = commaAfter(text, last.end) >= 0;
            if (!trailingComma) {
                current = splice(current, last.end, last.end, ',').text;
                shift = 1;
            }
        }
        const indent = last ? indentAt(text, last.start) : indentAt(text, section.close) + indentUnit(text, file);
        const at = lineStartOf(text, section.close) + shift;
        const line = `${indent}${entry}${trailingComma ? ',' : ''}\n`;
        const r = splice(current, at, at, line);
        return { text: r.text, start: at + indent.length, end: at + indent.length + entry.length };
    }
    // `{ a: false, b: true }` on one line: stay on that line.
    if (!last) {
        return splice(text, section.close, section.close, `${entry} `);
    }
    const comma = commaAfter(text, last.end);
    if (comma >= 0) {
        const r = splice(text, comma, comma, ` ${entry},`);
        return { text: r.text, start: comma + 1, end: comma + 1 + entry.length };
    }
    const r = splice(text, last.end, last.end, `, ${entry}`);
    return { text: r.text, start: last.end + 2, end: last.end + 2 + entry.length };
}

/** Removes the entry and its comma; a line that held only the entry goes too. */
export function removeStateEntry(text: string, section: StateSection, entry: StateEntry): InsertResult {
    const comma = commaAfter(text, entry.end);
    const afterEntry = comma >= 0 ? comma : entry.end;
    const rest = text.slice(afterEntry, lineEndOf(text, afterEntry));
    let start: number;
    let end: number;
    if (startsLine(text, entry.start) && /^[ \t]*(?:\/\/.*)?$/.test(rest)) {
        start = lineStartOf(text, entry.start);
        end = Math.min(lineEndOf(text, afterEntry) + 1, text.length);
    } else if (comma >= 0) {
        start = entry.start;
        end = comma + /^[ \t]*/.exec(text.slice(comma))![0].length;
    } else {
        // The last entry on a line with others: take the comma before it.
        const index = section.entries.indexOf(entry);
        const prev = section.entries[index - 1];
        start = prev ? commaAfter(text, prev.end) - 1 : entry.start;
        end = entry.end;
    }
    let out = splice(text, start, end, '');
    // An emptied list goes back to `{}`.
    const close = section.close - (end - start);
    if (out.text.slice(section.open + 1, close).trim().length === 0) {
        out = splice(out.text, section.open, close + 1, '{}');
        return { text: out.text, start: section.open, end: section.open };
    }
    return { text: out.text, start, end: start };
}

/** The file written when a game has no `state.ts` yet (the same layout as the templates'). */
export function createStateFileText(): string {
    return [
        '/**',
        " * The game's flags and variables, with their defaults. `@game` re-exports `flags` and `vars`, so",
        ' * scripts write `flags.unlockedDoor = true` and read `if (flags.unlockedDoor)`. Both are saved.',
        ' */',
        "import { defineFlags, defineVars } from '@benne/script';",
        '',
        'export const flags = defineFlags({});',
        '',
        'export const vars = defineVars({});',
        '',
    ].join('\n');
}

/** Appends `export const flags = defineFlags({});` (or `vars`) and its import when the file lacks it. */
export function ensureStateSection(
    ts: typeof TS,
    fileName: string,
    text: string,
    kind: StateSectionKind,
): string {
    if (parseStateFile(ts, fileName, text)[kind]) {
        return text;
    }
    const withImport = addNamedImport(parseScriptModel(ts, fileName, text), {
        module: '@benne/script',
        name: DEFINE[kind],
    });
    const body = withImport.replace(/\s+$/, '');
    return `${body}\n\nexport const ${kind} = ${DEFINE[kind]}({});\n`;
}
