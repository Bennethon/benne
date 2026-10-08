/**
 * ScriptModel: what a BenneScript file registers and says, read from the TypeScript AST
 * (docs/bennescript-ergonomics-refactor.md §9).
 *
 * - **Registrations**: `battery.onUseItem(items.soda, …)`, `x.on(['use', 'take'], …)`,
 *   `items.key.onUse.doNotActivate(…)`, `regions.leave.onEnter(…)`, `options.bye.onChoose(…)`,
 *   `room.onEnter(…)`, `playFrom('name', …)`, `onUpdate(…)`. Any call of an `on…` method counts,
 *   the same test the build transform uses for step functions (§6.2 rule 1).
 * - **Speech**: `Hank: "…"` labels, `` say`…` `` blocks and `x.say("…")` calls, with the exact
 *   source range of each line's text (for voice IDs and localisation export).
 * - **References**: every use of a name imported from `@game` or a `.ids` module (delete impact).
 *
 * Receivers stay syntactic (`{ root: 'items', path: ['soda'] }`); {@link resolveScriptPath} turns
 * them into content IDs with an {@link IdsIndex}. Pure: takes the `typescript` module as a
 * parameter so the extension (bundled TypeScript) and the TS server plugin (tsserver's own) share it.
 */
import type * as TS from 'typescript';
import { expressionPath, sameContent, type ContentRef, type IdsIndex, type IdsNode } from './idsIndex';

export interface ScriptPath {
    root: string;
    path: string[];
}

export interface ScriptImportDecl {
    module: string;
    start: number;
    end: number;
    names: Array<{ local: string; imported: string; typeOnly: boolean }>;
    /** Range of `{ … }` when the import has named bindings. */
    braces?: { start: number; end: number };
    typeOnly: boolean;
}

export type RegistrationArg =
    | { kind: 'path'; path: ScriptPath; text: string }
    | { kind: 'string'; value: string }
    | { kind: 'strings'; values: string[] }
    | { kind: 'other'; text: string };

export interface Registration {
    /** `null` for top-level APIs (`playFrom`, `onUpdate`). */
    receiver: ScriptPath | null;
    receiverText: string;
    /** `onUseItem`, `onChoose`, `on`, `playFrom`, `onUpdate`, … */
    method: string;
    doNotActivate: boolean;
    /** Arguments before the handler. */
    args: RegistrationArg[];
    /** The whole call. */
    start: number;
    end: number;
    /** `receiver.method` (what reveal selects). */
    headEnd: number;
    topLevel: boolean;
}

export type SpeechForm = 'label' | 'block' | 'method';

export interface SpeechLine {
    form: SpeechForm;
    /** As written: `Hank`, `BOTT-i3 Disembodied` (blocks), or `undefined` for method calls. */
    speakerLabel?: string;
    /** Source range of the speaker as written (labels and block lines). */
    speakerStart?: number;
    speakerEnd?: number;
    /** Method calls: the receiver (`jensen`, `player`, `characters.botti3`). */
    receiver?: ScriptPath | null;
    /** Source range of the spoken text (inside the quotes; a line of a block). */
    textStart: number;
    textEnd: number;
    /** Source text of the line, escapes and `${…}` as written. */
    text: string;
    /** `false` for `Jensen: pick(insults)`: no literal text to export or mark. */
    literal: boolean;
}

export interface ScriptReference {
    path: ScriptPath;
    start: number;
    end: number;
}

export interface ScriptModel {
    fileName: string;
    text: string;
    imports: ScriptImportDecl[];
    /** Local binding → module + imported name; `*` for a namespace import (`import * as club from …`). */
    bindings: Map<string, { module: string; imported: string }>;
    /** Top-level `const x = a.b` aliases (`const penny = characters.penny`). */
    aliases: Map<string, ScriptPath>;
    registrations: Registration[];
    speech: SpeechLine[];
    references: ScriptReference[];
    /** End of the last import declaration (where new imports go). */
    importsEnd: number;
}

/** {@link ScriptModel.bindings} `imported` of a namespace import. */
const NAMESPACE = '*';

const TOP_LEVEL_APIS = new Set(['playFrom', 'onUpdate']);
const ON_METHOD = /^on(?:[A-Z]|$)/;

function unwrap(ts: typeof TS, expr: TS.Expression): TS.Expression {
    let e = expr;
    while (
        ts.isParenthesizedExpression(e) ||
        ts.isNonNullExpression(e) ||
        ts.isAsExpression(e) ||
        ts.isSatisfiesExpression(e)
    ) {
        e = e.expression;
    }
    return e;
}

function isFunctionLike(ts: typeof TS, e: TS.Expression): boolean {
    return ts.isArrowFunction(e) || ts.isFunctionExpression(e);
}

/** Text between the quotes / backticks of a string or template literal. */
function literalContent(
    ts: typeof TS,
    sf: TS.SourceFile,
    e: TS.Expression,
): { start: number; end: number; text: string } | undefined {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) {
        const start = e.getStart(sf) + 1;
        const end = e.getEnd() - 1;
        return { start, end, text: sf.text.slice(start, end) };
    }
    return undefined;
}

export function parseScriptModel(ts: typeof TS, fileName: string, text: string): ScriptModel {
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const model: ScriptModel = {
        fileName,
        text,
        imports: [],
        bindings: new Map(),
        aliases: new Map(),
        registrations: [],
        speech: [],
        references: [],
        importsEnd: 0,
    };

    for (const stmt of sf.statements) {
        if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
            const decl: ScriptImportDecl = {
                module: stmt.moduleSpecifier.text,
                start: stmt.getStart(sf),
                end: stmt.getEnd(),
                names: [],
                typeOnly: stmt.importClause?.isTypeOnly === true,
            };
            const bindings = stmt.importClause?.namedBindings;
            if (bindings && ts.isNamedImports(bindings)) {
                decl.braces = { start: bindings.getStart(sf), end: bindings.getEnd() };
                for (const el of bindings.elements) {
                    const local = el.name.text;
                    const imported = (el.propertyName ?? el.name).text;
                    decl.names.push({ local, imported, typeOnly: el.isTypeOnly || decl.typeOnly });
                    if (!el.isTypeOnly && !decl.typeOnly) {
                        model.bindings.set(local, { module: decl.module, imported });
                    }
                }
            } else if (bindings && ts.isNamespaceImport(bindings) && !decl.typeOnly) {
                // Other-room completion writes these (`import * as outside from '../outside/outside.ids'`).
                model.bindings.set(bindings.name.text, { module: decl.module, imported: NAMESPACE });
            }
            model.imports.push(decl);
            model.importsEnd = Math.max(model.importsEnd, decl.end);
        } else if (ts.isVariableStatement(stmt)) {
            for (const d of stmt.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && d.initializer) {
                    const p = expressionPath(ts, d.initializer);
                    if (p && (p.path.length > 0 || p.root !== d.name.text)) {
                        model.aliases.set(d.name.text, p);
                    }
                }
            }
        }
    }

    const registrationOf = (call: TS.CallExpression, topLevel: boolean): Registration | undefined => {
        const callee = unwrap(ts, call.expression);
        let method: string;
        let receiverExpr: TS.Expression | null = null;
        let doNotActivate = false;
        if (ts.isIdentifier(callee)) {
            if (!TOP_LEVEL_APIS.has(callee.text)) {
                return undefined;
            }
            method = callee.text;
        } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
            const name = callee.name.text;
            const inner = unwrap(ts, callee.expression);
            if (
                name === 'doNotActivate' &&
                ts.isPropertyAccessExpression(inner) &&
                ts.isIdentifier(inner.name) &&
                ON_METHOD.test(inner.name.text)
            ) {
                method = inner.name.text;
                receiverExpr = inner.expression;
                doNotActivate = true;
            } else if (ON_METHOD.test(name)) {
                method = name;
                receiverExpr = callee.expression;
            } else {
                return undefined;
            }
        } else {
            return undefined;
        }
        const args: RegistrationArg[] = [];
        const all = [...call.arguments];
        const last = all.length > 0 ? unwrap(ts, all[all.length - 1]) : undefined;
        const before = last && (isFunctionLike(ts, last) || ts.isIdentifier(last)) ? all.slice(0, -1) : all;
        for (const raw of before) {
            const a = unwrap(ts, raw);
            if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
                args.push({ kind: 'string', value: a.text });
            } else if (ts.isArrayLiteralExpression(a)) {
                const values = a.elements
                    .map((el) => unwrap(ts, el))
                    .filter((el): el is TS.StringLiteral => ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el))
                    .map((el) => el.text);
                args.push({ kind: 'strings', values });
            } else {
                const p = expressionPath(ts, a);
                args.push(p ? { kind: 'path', path: p, text: a.getText(sf) } : { kind: 'other', text: a.getText(sf) });
            }
        }
        const receiver = receiverExpr ? (expressionPath(ts, receiverExpr) ?? null) : null;
        const calleeEnd = callee.getEnd();
        return {
            receiver,
            receiverText: receiverExpr ? receiverExpr.getText(sf) : '',
            method,
            doNotActivate,
            args,
            start: call.getStart(sf),
            end: call.getEnd(),
            headEnd: calleeEnd,
            topLevel,
        };
    };

    const speechFromLabel = (stmt: TS.LabeledStatement): void => {
        if (!ts.isExpressionStatement(stmt.statement)) {
            return;
        }
        const expr = unwrap(ts, stmt.statement.expression);
        const lit = literalContent(ts, sf, expr);
        model.speech.push({
            form: 'label',
            speakerLabel: stmt.label.text,
            speakerStart: stmt.label.getStart(sf),
            speakerEnd: stmt.label.getEnd(),
            textStart: lit ? lit.start : expr.getStart(sf),
            textEnd: lit ? lit.end : expr.getEnd(),
            text: lit ? lit.text : expr.getText(sf),
            literal: lit !== undefined,
        });
    };

    const speechFromBlock = (tagged: TS.TaggedTemplateExpression): void => {
        const lit = literalContent(ts, sf, tagged.template);
        if (!lit) {
            return;
        }
        let lineStart = lit.start;
        while (lineStart <= lit.end) {
            const nl = text.indexOf('\n', lineStart);
            const lineEnd = nl < 0 || nl > lit.end ? lit.end : nl;
            const raw = text.slice(lineStart, lineEnd);
            const trimmed = raw.trim();
            if (trimmed.length > 0 && !trimmed.startsWith('//')) {
                const colon = trimmed.indexOf(':');
                const lead = raw.length - raw.trimStart().length;
                if (colon > 0) {
                    const speaker = trimmed.slice(0, colon).trim();
                    const after = trimmed.slice(colon + 1);
                    const gap = after.length - after.trimStart().length;
                    const spoken = after.trimStart().trimEnd();
                    const textStart = lineStart + lead + colon + 1 + gap;
                    const speakerStart = lineStart + lead;
                    model.speech.push({
                        form: 'block',
                        speakerLabel: speaker,
                        speakerStart,
                        speakerEnd: speakerStart + trimmed.slice(0, colon).trimEnd().length,
                        textStart,
                        textEnd: textStart + spoken.length,
                        text: spoken,
                        literal: !speaker.includes('${') && spoken.length > 0,
                    });
                } else {
                    model.speech.push({
                        form: 'block',
                        textStart: lineStart + lead,
                        textEnd: lineStart + lead + trimmed.length,
                        text: trimmed,
                        literal: false,
                    });
                }
            }
            if (nl < 0 || nl >= lit.end) {
                break;
            }
            lineStart = nl + 1;
        }
    };

    const speechFromMethod = (call: TS.CallExpression): void => {
        const outer = unwrap(ts, call.expression);
        if (!ts.isPropertyAccessExpression(outer)) {
            return;
        }
        const inner = unwrap(ts, outer.expression);
        const callee: TS.PropertyAccessExpression =
            outer.name.text === 'now' && ts.isPropertyAccessExpression(inner) ? inner : outer;
        if (callee.name.text !== 'say' || call.arguments.length === 0) {
            return;
        }
        const receiver = expressionPath(ts, callee.expression) ?? null;
        const first = unwrap(ts, call.arguments[0]);
        const lit = literalContent(ts, sf, first);
        model.speech.push({
            form: 'method',
            receiver,
            textStart: lit ? lit.start : first.getStart(sf),
            textEnd: lit ? lit.end : first.getEnd(),
            text: lit ? lit.text : first.getText(sf),
            literal: lit !== undefined,
        });
    };

    const isImportedRoot = (name: string): boolean => {
        const b = model.bindings.get(name);
        return b !== undefined && (b.module === '@game' || /\.ids(?:\.ts)?$/.test(b.module));
    };

    const visit = (node: TS.Node, topLevel: boolean): void => {
        if (ts.isImportDeclaration(node)) {
            return;
        }
        if (ts.isLabeledStatement(node)) {
            speechFromLabel(node);
        } else if (ts.isTaggedTemplateExpression(node)) {
            const tag = unwrap(ts, node.tag);
            if (ts.isIdentifier(tag) && tag.text === 'say') {
                speechFromBlock(node);
            }
        } else if (ts.isCallExpression(node)) {
            const reg = registrationOf(node, topLevel);
            if (reg) {
                model.registrations.push(reg);
            }
            speechFromMethod(node);
        } else if (ts.isIdentifier(node) && isImportedRoot(node.text)) {
            const parent = node.parent;
            const isNameOfAccess = ts.isPropertyAccessExpression(parent) && parent.name === node;
            const isDeclaration =
                ts.isImportSpecifier(parent) || (ts.isVariableDeclaration(parent) && parent.name === node);
            if (!isNameOfAccess && !isDeclaration) {
                let top: TS.Expression = node;
                while (ts.isPropertyAccessExpression(top.parent) && top.parent.expression === top) {
                    top = top.parent;
                }
                const p = expressionPath(ts, top);
                if (p) {
                    model.references.push({ path: p, start: node.getStart(sf), end: top.getEnd() });
                }
            }
        }
        const childTopLevel =
            topLevel && (ts.isExpressionStatement(node) || ts.isCallExpression(node) || ts.isSourceFile(node));
        ts.forEachChild(node, (child) => visit(child, childTopLevel && !ts.isFunctionLike(child)));
    };
    visit(sf, true);
    return model;
}

// ─── Resolution ─────────────────────────────────────────────────────────────

/** Follows the script's imports and top-level aliases into the generated modules. */
export function resolveScriptPath(model: ScriptModel, index: IdsIndex, p: ScriptPath): IdsNode | undefined {
    let root = p.root;
    let memberPath = p.path;
    for (let hops = 0; hops < 8; hops++) {
        const alias = model.aliases.get(root);
        if (!alias || model.bindings.has(root)) {
            break;
        }
        root = alias.root;
        memberPath = [...alias.path, ...memberPath];
    }
    const binding = model.bindings.get(root);
    if (!binding) {
        return undefined;
    }
    if (binding.imported === NAMESPACE) {
        // `club.battery.x`: the first member is the module's export.
        const [name, ...rest] = memberPath;
        return name === undefined ? undefined : index.resolveImport(model.fileName, binding.module, name, rest);
    }
    return index.resolveImport(model.fileName, binding.module, binding.imported, memberPath);
}

export function resolveScriptRef(model: ScriptModel, index: IdsIndex, p: ScriptPath | null | undefined): ContentRef | undefined {
    return p ? resolveScriptPath(model, index, p)?.ref : undefined;
}

/** The content of the longest resolvable prefix: `options.bye.off` → the `bye` option. */
export function resolveReference(model: ScriptModel, index: IdsIndex, p: ScriptPath): ContentRef | undefined {
    for (let n = p.path.length; n >= 0; n--) {
        const ref = resolveScriptPath(model, index, { root: p.root, path: p.path.slice(0, n) })?.ref;
        if (ref) {
            return ref;
        }
    }
    return undefined;
}

export function isPlayerPath(model: ScriptModel, p: ScriptPath | null | undefined): boolean {
    if (!p || p.path.length > 0) {
        return false;
    }
    const b = model.bindings.get(p.root);
    return b !== undefined && b.module === '@benne/script' && b.imported === 'player';
}

/** Registrations whose receiver is `ref` (any room for characters when `anyCharacterRoom`). */
export function registrationsOn(
    model: ScriptModel,
    index: IdsIndex,
    ref: ContentRef,
    opts?: { anyCharacterRoom?: boolean },
): Registration[] {
    return model.registrations.filter((r) => {
        const target = receiverRef(model, index, r);
        return target !== undefined && sameContent(target, ref, opts);
    });
}

/** Receivers resolved once per model and index (the Inspector asks about many handlers at once). */
const receiverCache = new WeakMap<ScriptModel, { index: IdsIndex; refs: Map<Registration, ContentRef | undefined> }>();

function receiverRef(model: ScriptModel, index: IdsIndex, r: Registration): ContentRef | undefined {
    let cache = receiverCache.get(model);
    if (!cache || cache.index !== index) {
        cache = { index, refs: new Map() };
        receiverCache.set(model, cache);
    }
    if (!cache.refs.has(r)) {
        cache.refs.set(r, resolveScriptRef(model, index, r.receiver));
    }
    return cache.refs.get(r);
}

/** Play From names in source order, without duplicates. */
export function playFromNames(model: ScriptModel): string[] {
    const out: string[] = [];
    for (const r of model.registrations) {
        if (r.method !== 'playFrom' || r.receiver !== null) {
            continue;
        }
        const first = r.args[0];
        if (first?.kind === 'string') {
            const name = first.value.trim();
            if (name.length > 0 && !out.includes(name)) {
                out.push(name);
            }
        }
    }
    return out;
}
