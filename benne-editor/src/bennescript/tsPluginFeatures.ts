/**
 * BenneScript features of the TS server plugin (docs/bennescript-ergonomics-refactor.md §9):
 *
 * - speaker diagnostics: unknown or ambiguous `Hank:` labels and `` say`…` `` speakers, and speech
 *   lines outside a handler, with the build transform's messages;
 * - speaker completions: `Hank: "|"` at the start of a statement;
 * - string-union completions: TypeScript already offers `'U'`, `'D'`, … at `face(` or
 *   `animation =`; they are moved to the top and match without the quote;
 * - go to definition from a generated handle (`battery`, `items.soda`, `options.bye`) to its JSON;
 * - another room's handle whose name the script already uses (`door`) as `outside.door`, adding
 *   `import * as outside from '../outside/outside.ids'`. TypeScript doesn't offer it at all.
 *
 * Pure functions over the `typescript` module tsserver passes in; no `vscode` import.
 */
import * as path from 'node:path';
import type * as TS from 'typescript';
import { locateContent } from './contentLocate';
import { GENERATED_IDS_MARKER, IdsIndex, siblingIdsModulePath } from './idsIndex';
import { parseScriptModel } from './scriptModel';
import { resolveSpeaker, speakerLabelSuggestions, type SpeakerTable } from './speakers';

/** Diagnostic codes, so tests and users can tell them apart from TypeScript's own. */
export const BENNESCRIPT_DIAGNOSTIC = {
    unknownSpeaker: 90001,
    ambiguousSpeaker: 90002,
    strayLabel: 90003,
    blockLine: 90004,
} as const;

const SCRIPT_FILE = /(?:^|[/\\])(?:[^/\\]+\.(?:room|character|inventory|dialog|gui|script)\.ts|globalScript\.ts)$/;
const STEP_BLOCK_APIS = new Set(['playFrom', 'cutscene', 'background', 'together', 'withInputDisabled']);

export function isBenneScriptFile(fileName: string): boolean {
    return SCRIPT_FILE.test(fileName);
}

function unwrap(ts: typeof TS, e: TS.Expression): TS.Expression {
    while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
        e = e.expression;
    }
    return e;
}

/** `x.onLook(…)`, `cutscene(…)`, … (the transform's step-API test, §6.2 rule 1). */
function isStepApiCall(ts: typeof TS, call: TS.CallExpression): boolean {
    const callee = unwrap(ts, call.expression);
    if (ts.isIdentifier(callee)) {
        return STEP_BLOCK_APIS.has(callee.text);
    }
    if (!ts.isPropertyAccessExpression(callee)) {
        return false;
    }
    const name = callee.name.text;
    if (STEP_BLOCK_APIS.has(name)) {
        return true;
    }
    if (name === 'doNotActivate' || name === 'once') {
        return true;
    }
    return /^on(?:[A-Z]|$)/.test(name) && name !== 'onUpdate';
}

/** Whether `node` runs inside a step function, where speech lines are spoken. */
function inStepFunction(ts: typeof TS, node: TS.Node): boolean {
    for (let n: TS.Node | undefined = node.parent; n; n = n.parent) {
        if (ts.isFunctionDeclaration(n)) {
            return ts.isSourceFile(n.parent);
        }
        if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
            const parent = n.parent;
            if (ts.isCallExpression(parent) && parent.arguments.includes(n as TS.Expression)) {
                return isStepApiCall(ts, parent);
            }
            // `const f = () => { … }` at the top level of the file.
            return ts.isVariableDeclaration(parent) && ts.isSourceFile(parent.parent.parent.parent);
        }
        if (ts.isMethodDeclaration(n) || ts.isClassDeclaration(n)) {
            return false;
        }
    }
    return false;
}

function isStringBody(ts: typeof TS, e: TS.Expression): boolean {
    return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e);
}

/** Errors the build transform would report about speech lines, as diagnostics. */
export function speakerDiagnostics(ts: typeof TS, sf: TS.SourceFile, table: SpeakerTable): TS.Diagnostic[] {
    const out: TS.Diagnostic[] = [];
    const add = (start: number, end: number, message: string, code: number): void => {
        out.push({
            file: sf,
            start,
            length: Math.max(1, end - start),
            messageText: message,
            category: ts.DiagnosticCategory.Error,
            code,
            source: 'bennescript',
        });
    };
    const model = parseScriptModel(ts, sf.fileName, sf.text);
    for (const line of model.speech) {
        if (line.form === 'method') {
            continue;
        }
        if (line.speakerLabel === undefined) {
            if (line.form === 'block' && !line.text.includes('${')) {
                add(
                    line.textStart,
                    line.textEnd,
                    `Each line of a \`say\` block is \`Speaker: text\`; this one has no ":": ${JSON.stringify(line.text)}.`,
                    BENNESCRIPT_DIAGNOSTIC.blockLine,
                );
            }
            continue;
        }
        if (line.speakerLabel.includes('${')) {
            continue;
        }
        if (line.form === 'label' && !line.literal) {
            // `outer: for …` stays a label; `Jensen: pick(insults)` is speech only if `Jensen` resolves.
            continue;
        }
        const resolved = resolveSpeaker(line.speakerLabel, table);
        if ('error' in resolved) {
            const message = line.form === 'block' ? `In a \`say\` block: ${resolved.error}` : resolved.error;
            add(
                line.speakerStart ?? line.textStart,
                line.speakerEnd ?? line.textEnd,
                message,
                resolved.ambiguous ? BENNESCRIPT_DIAGNOSTIC.ambiguousSpeaker : BENNESCRIPT_DIAGNOSTIC.unknownSpeaker,
            );
        }
    }
    // A speech line outside a step function would never be spoken (§6.2 rule 4).
    const visit = (node: TS.Node): void => {
        if (ts.isLabeledStatement(node) && ts.isExpressionStatement(node.statement)) {
            const expr = unwrap(ts, node.statement.expression);
            const resolved = resolveSpeaker(node.label.text, table);
            if ('id' in resolved && isStringBody(ts, expr) && !inStepFunction(ts, node)) {
                add(
                    node.label.getStart(sf),
                    node.label.getEnd(),
                    `Speech line \`${node.label.text}: …\` is outside a handler or helper function, so it would never be spoken. ` +
                        'Speech lines belong in a handler body or a top-level function.',
                    BENNESCRIPT_DIAGNOSTIC.strayLabel,
                );
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
}

/**
 * `() => Hank: "Hi"` doesn't parse (a label needs statement position); TypeScript reports "',' expected"
 * at the colon. When the colon at `pos` follows `=> Label`, returns the label. Mirrors
 * `arrowSpeechLabelAt` in scripts/lib/bennescriptTransform.mjs (the bundle can't import it); a unit
 * test keeps the two in step.
 */
export function arrowSpeechLabelAt(text: string, pos: number): string | undefined {
    if (text[pos] !== ':') {
        return undefined;
    }
    return /=>\s*([A-Za-z_$][\w$]*)\s*$/.exec(text.slice(0, pos))?.[1];
}

/** Mirrors `arrowSpeechMessage` in scripts/lib/bennescriptTransform.mjs. */
export function arrowSpeechMessage(label: string): string {
    return (
        `A speech line can't be the whole body of an arrow function: () => ${label}: \`…\` doesn't parse. ` +
        `Put it in braces: () => { ${label}: \`…\` }.`
    );
}

/** Rewrites the parse error of `() => Hank: "Hi"` to say to add braces, as the build does. */
export function explainArrowSpeechErrors(
    sf: TS.SourceFile,
    diagnostics: readonly TS.DiagnosticWithLocation[],
): TS.DiagnosticWithLocation[] {
    return diagnostics.map((d) => {
        const label = arrowSpeechLabelAt(sf.text, d.start);
        return label ? { ...d, messageText: arrowSpeechMessage(label) } : d;
    });
}

/** The word being typed at `position` when it starts a statement inside a function body. */
function statementStartWord(ts: typeof TS, sf: TS.SourceFile, position: number): { start: number; word: string } | undefined {
    const lineStart = sf.text.lastIndexOf('\n', position - 1) + 1;
    const before = sf.text.slice(lineStart, position);
    const m = /^(\s*)([A-Za-z][A-Za-z0-9]*)?$/.exec(before);
    if (!m) {
        return undefined;
    }
    const start = lineStart + m[1].length;
    // Inside a block of a function (not at the top level, not in an object literal or a class).
    let node: TS.Node | undefined = findNodeAt(ts, sf, Math.max(0, start - 1));
    while (node && !ts.isBlock(node) && !ts.isSourceFile(node)) {
        if (ts.isObjectLiteralExpression(node) || ts.isClassLike(node) || ts.isTypeLiteralNode(node)) {
            return undefined;
        }
        node = node.parent;
    }
    if (!node || !ts.isBlock(node) || !isInFunction(ts, node)) {
        return undefined;
    }
    return { start, word: m[2] ?? '' };
}

function isInFunction(ts: typeof TS, node: TS.Node): boolean {
    for (let n: TS.Node | undefined = node; n; n = n.parent) {
        if (ts.isFunctionLike(n)) {
            return true;
        }
    }
    return false;
}

function findNodeAt(ts: typeof TS, sf: TS.SourceFile, position: number): TS.Node | undefined {
    let found: TS.Node | undefined;
    const visit = (node: TS.Node): void => {
        if (position >= node.getFullStart() && position < node.getEnd()) {
            found = node;
            ts.forEachChild(node, visit);
        }
    };
    ts.forEachChild(sf, visit);
    return found ?? sf;
}

/**
 * The label when the `:` at `colonCharacter` ends `Label:` on an otherwise empty line, the moment
 * the editor auto-inserts `` `…` `` (dialogueAutoQuote.ts). Whether it is a speaker in statement
 * position is then checked with {@link speakerCompletionEntries} at the label.
 */
export function typedSpeakerLabel(lineText: string, colonCharacter: number): string | undefined {
    if (lineText[colonCharacter] !== ':' || lineText.slice(colonCharacter + 1).trim() !== '') {
        return undefined;
    }
    return /^\s*([A-Za-z_]\w*)$/.exec(lineText.slice(0, colonCharacter))?.[1];
}

/**
 * `` Hank: `…` `` entries when the cursor starts a statement in a handler and the word typed so far
 * starts with a capital letter (or completion was invoked on an empty line).
 */
export function speakerCompletionEntries(
    ts: typeof TS,
    sf: TS.SourceFile,
    position: number,
    table: SpeakerTable,
    invoked: boolean,
): TS.CompletionEntry[] {
    const at = statementStartWord(ts, sf, position);
    if (!at) {
        return [];
    }
    if (at.word.length === 0 ? !invoked : !/^[A-Z]/.test(at.word)) {
        return [];
    }
    return speakerLabelSuggestions(table).map((s, i) => ({
        name: `${s.label}:`,
        kind: ts.ScriptElementKind.label,
        kindModifiers: '',
        sortText: `0${String(i).padStart(3, '0')}`,
        insertText: `${s.label}: \`$1\``,
        isSnippet: true,
        filterText: s.label,
        replacementSpan: { start: at.start, length: position - at.start },
        labelDetails: { description: s.id === 'Player' ? 'the active player' : `says (${s.id})` },
    }));
}

/**
 * Moves TypeScript's quoted string-literal entries (`'U'`, `'coffee-full'`) to the top and lets
 * them match without typing the quote. TypeScript only offers them where the expected type is a
 * union of string literals, so this is exactly `face(`, `animation =`, `play(`, `on([`, ….
 */
export function promoteStringLiteralEntries(ts: typeof TS, info: TS.CompletionInfo): TS.CompletionInfo {
    let changed = false;
    const entries = info.entries.map((entry) => {
        if (entry.kind !== ts.ScriptElementKind.string || entry.replacementSpan) {
            return entry;
        }
        const m = /^(['"])(.*)\1$/.exec(entry.name);
        if (!m) {
            return entry;
        }
        changed = true;
        return { ...entry, sortText: `0${entry.sortText}`, filterText: m[2], isRecommended: undefined };
    });
    return changed ? { ...info, entries } : info;
}

/** Whether `position` is inside a string or template literal (TypeScript handles those itself). */
export function inStringLiteral(ts: typeof TS, sf: TS.SourceFile, position: number): boolean {
    const node = findNodeAt(ts, sf, position);
    return (
        node !== undefined &&
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)) &&
        position > node.getStart(sf)
    );
}

/** `source` of the entries from {@link otherRoomCompletionEntries}: `benne-other-room/<roomId>/<namespace>`. */
const OTHER_ROOM_SOURCE = 'benne-other-room/';

type RoomModule = ReturnType<IdsIndex['roomModules']>[number];

interface RoomNamespace {
    name: string;
    specifier: string;
    /** The import to add when the script doesn't import the module as a namespace yet. */
    insert?: TS.TextChange;
}

/** `../outside/outside.ids` from `rooms/apartment/apartment.room.ts`. */
function relativeSpecifier(fromFile: string, modulePath: string): string {
    const rel = path.relative(path.dirname(fromFile), modulePath).split(path.sep).join('/').replace(/\.ts$/, '');
    return rel.startsWith('.') ? rel : `./${rel}`;
}

function importsModule(index: IdsIndex, sf: TS.SourceFile, decl: TS.ImportDeclaration, modulePath: string): boolean {
    const spec = (decl.moduleSpecifier as TS.StringLiteral).text;
    const resolved = index.resolveSpecifier(sf.fileName, spec);
    return resolved !== undefined && path.resolve(resolved) === path.resolve(modulePath);
}

/** How the script refers to a room's module as a whole: its `import * as x` of it, or one to add as `preferred`. */
function roomNamespace(ts: typeof TS, sf: TS.SourceFile, index: IdsIndex, room: RoomModule, preferred: string): RoomNamespace {
    const specifier = relativeSpecifier(sf.fileName, room.modulePath);
    let lastImport: TS.ImportDeclaration | undefined;
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) {
            continue;
        }
        lastImport = stmt;
        const bindings = stmt.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings) && !stmt.importClause!.isTypeOnly && importsModule(index, sf, stmt, room.modulePath)) {
            return { name: bindings.name.text, specifier };
        }
    }
    const newLine = sf.text.includes('\r\n') ? '\r\n' : '\n';
    const line = `import * as ${preferred} from '${specifier}';`;
    const insert = lastImport
        ? { span: { start: lastImport.getEnd(), length: 0 }, newText: `${newLine}${line}` }
        : { span: { start: 0, length: 0 }, newText: `${line}${newLine}` };
    return { name: preferred, specifier, insert };
}

/** Exports of a room module the script imports by name (`import { rock } from '../outside/outside.ids'`). */
function namedImportsFrom(ts: typeof TS, sf: TS.SourceFile, index: IdsIndex, modulePath: string): Set<string> {
    const out = new Set<string>();
    for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier) || !importsModule(index, sf, stmt, modulePath)) {
            continue;
        }
        const bindings = stmt.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            for (const el of bindings.elements) {
                out.add((el.propertyName ?? el.name).text);
            }
        }
    }
    return out;
}

/**
 * Handles of other rooms that TypeScript leaves out because their name is already taken in the
 * script (the room's own `door`, say): `door` inserts `outside.door`, and accepting it adds the
 * namespace import through {@link otherRoomEntryDetails}. `info` is TypeScript's result here;
 * its entries without a `source` are the names in scope.
 */
export function otherRoomCompletionEntries(
    ts: typeof TS,
    sf: TS.SourceFile,
    position: number,
    info: TS.CompletionInfo,
    index: IdsIndex,
): TS.CompletionEntry[] {
    if (info.isMemberCompletion) {
        return [];
    }
    for (let n: TS.Node | undefined = findNodeAt(ts, sf, Math.max(0, position - 1)); n; n = n.parent) {
        if (ts.isImportDeclaration(n)) {
            return [];
        }
    }
    const inScope = new Set(info.entries.filter((e) => !e.source).map((e) => e.name));
    const own = siblingIdsModulePath(sf.fileName);
    let start = position;
    while (start > 0 && /[\w$]/.test(sf.text[start - 1])) {
        start--;
    }
    const out: TS.CompletionEntry[] = [];
    for (const room of index.roomModules()) {
        if (own && path.resolve(own) === path.resolve(room.modulePath)) {
            continue;
        }
        const imported = namedImportsFrom(ts, sf, index, room.modulePath);
        // `room` is `rooms.<key>`, which every script already has.
        const names = [...index.exportsOf(room.modulePath).keys()].filter((n) => n !== 'room' && inScope.has(n) && !imported.has(n));
        if (names.length === 0) {
            continue;
        }
        const ns = roomNamespace(ts, sf, index, room, inScope.has(room.key) ? `${room.key}Room` : room.key);
        for (const name of names) {
            out.push({
                name,
                kind: ts.ScriptElementKind.constElement,
                kindModifiers: 'export',
                sortText: '16',
                insertText: `${ns.name}.${name}`,
                filterText: name,
                replacementSpan: { start, length: position - start },
                source: `${OTHER_ROOM_SOURCE}${room.roomId}/${ns.name}`,
                labelDetails: { description: `${room.roomId} room` },
                hasAction: ns.insert ? true : undefined,
            });
        }
    }
    return out;
}

/** Details of an entry from {@link otherRoomCompletionEntries}, with the import to add; undefined for others. */
export function otherRoomEntryDetails(
    ts: typeof TS,
    languageService: TS.LanguageService,
    sf: TS.SourceFile,
    name: string,
    source: string | undefined,
    index: IdsIndex,
): TS.CompletionEntryDetails | undefined {
    if (!source?.startsWith(OTHER_ROOM_SOURCE)) {
        return undefined;
    }
    const [roomId, preferred] = source.slice(OTHER_ROOM_SOURCE.length).split('/');
    const room = index.roomModules().find((r) => r.roomId === roomId);
    if (!room || !preferred) {
        return undefined;
    }
    const ns = roomNamespace(ts, sf, index, room, preferred);
    // The handle's own hover text: `const door: PropHandle<…>` and its doc comment.
    const moduleSf = languageService.getProgram()?.getSourceFile(room.modulePath);
    let quick: TS.QuickInfo | undefined;
    for (const stmt of moduleSf?.statements ?? []) {
        const decl = ts.isVariableStatement(stmt)
            ? stmt.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name)
            : undefined;
        if (decl) {
            quick = languageService.getQuickInfoAtPosition(room.modulePath, decl.name.getStart(moduleSf));
            break;
        }
    }
    return {
        name,
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: 'export',
        displayParts: quick?.displayParts ?? [{ text: `${ns.name}.${name}`, kind: 'text' }],
        documentation: quick?.documentation ?? [],
        tags: quick?.tags ?? [],
        codeActions: ns.insert
            ? [
                  {
                      description: `Add import * as ${ns.name} from '${ns.specifier}'`,
                      changes: [{ fileName: sf.fileName, textChanges: [ns.insert] }],
                  },
              ]
            : undefined,
        source: [{ text: ns.specifier, kind: 'text' }],
    };
}

/**
 * Definitions that land in a generated `.ids.ts` module, redirected to the content they stand for.
 * Others are returned unchanged.
 */
export function redirectDefinitionsToContent(
    ts: typeof TS,
    program: TS.Program | undefined,
    definitions: readonly TS.DefinitionInfo[],
    makeIndex: (gameRoot: string) => IdsIndex,
    gameRootOf: (fileName: string) => string | undefined,
): TS.DefinitionInfo[] | undefined {
    let redirected = false;
    const out: TS.DefinitionInfo[] = [];
    for (const def of definitions) {
        const sf = program?.getSourceFile(def.fileName);
        const gameRoot = gameRootOf(def.fileName);
        if (!sf || !gameRoot || !/\.ids\.ts$/.test(def.fileName) || !sf.text.startsWith(GENERATED_IDS_MARKER)) {
            out.push(def);
            continue;
        }
        const index = makeIndex(gameRoot);
        const ref = index.refAtDeclaration(def.fileName, sf, def.textSpan.start);
        const location = ref ? locateContent(ts, gameRoot, ref) : undefined;
        if (!location) {
            out.push(def);
            continue;
        }
        redirected = true;
        out.push({
            ...def,
            fileName: location.fileName,
            textSpan: { start: location.start, length: location.length },
            contextSpan: undefined,
            originalFileName: undefined,
            originalTextSpan: undefined,
            originalContextSpan: undefined,
        });
    }
    return redirected ? out : undefined;
}
