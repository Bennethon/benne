#!/usr/bin/env node
/**
 * Generates the reference part of docs/bennescript-api.md from the `@benne/script` source
 * (`src/engine/bennescript/index.ts` and the modules it re-exports): every exported function,
 * object, handle class and type, with its signature and the first paragraph of its JSDoc.
 *
 * Only the text between the BEGIN / END GENERATED markers in the doc is replaced; the rest of the
 * page is hand-written.
 *
 * `--check` writes nothing: it fails when the doc is out of date, when an export isn't placed in
 * `SECTIONS` (or listed in `INTERNAL`), or when a public member has no JSDoc.
 */
import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(repoRoot, 'src', 'engine', 'bennescript');
const indexFile = path.join(apiDir, 'index.ts');
const docFile = path.join(repoRoot, 'docs', 'bennescript-api.md');
const check = process.argv.includes('--check');

const BEGIN = '<!-- BEGIN GENERATED: npm run docs:api -->';
const END = '<!-- END GENERATED -->';

/**
 * Page layout: every value export of `@benne/script` appears in exactly one section (or in
 * `INTERNAL`). `name` is the export; `title` overrides the heading; `intro` is a hand-written line
 * under it; `extra` adds interface tables (controls that the generated `music` / `sfx` / `video`
 * objects carry).
 */
const SECTIONS = [
  {
    heading: 'Actions',
    blurb: 'Free functions from `@benne/script`. Each one runs at the line where it is written.',
    entries: [
      { functions: ['say', 'display', 'wait', 'waitForClick', 'walkToClicked', 'faceClicked', 'fadeOut', 'fadeIn', 'unhandled'] },
    ],
  },
  {
    heading: 'Blocks',
    blurb: 'Their callbacks are step functions: lines inside them are sequenced too.',
    entries: [{ functions: ['cutscene', 'together', 'background', 'withInputDisabled'] }, { name: 'input' }],
  },
  {
    heading: 'Script-level registrations',
    blurb: 'Written at the top level of a script file.',
    entries: [{ functions: ['playFrom', 'onUpdate', 'defineFlags', 'defineVars', 'flag'] }],
  },
  {
    heading: 'Game-wide objects',
    blurb: 'Objects from `@benne/script`.',
    entries: [
      { name: 'player' },
      { name: 'inventory', intro: 'The active player\'s bag. `jensen.inventory` is another character\'s, with the same members.' },
      { name: 'camera' },
      { name: 'game' },
      { name: 'settings' },
      { name: 'pointer' },
      { name: 'saves' },
      { name: 'events' },
    ],
  },
  {
    heading: 'Handles',
    blurb:
      'Generated handles are instances of these classes. Verb handlers (`onLook`, `onUseItem`, …) are added by the generator from `game-config.json`; see [Generated verb methods](#generated-verb-methods).',
    entries: [
      { name: 'RoomHandle', title: 'Rooms: `room`, `rooms.x`' },
      { name: 'ClickableHandle', title: 'Clickables: shared by props, hotspots and characters' },
      { name: 'PropHandle', title: 'Props: `door`' },
      { name: 'HotspotHandle', title: 'Hotspots: `battery`' },
      { name: 'CharacterHandle', title: 'Characters: `jensen`, `characters.jensen`' },
      { name: 'PointHandle', title: 'Points: `points.x`' },
      { name: 'RegionHandle', title: 'Regions: `regions.x`' },
      { name: 'WalkableHandle', title: 'Walkable areas: `walkables.x`' },
      { name: 'ItemHandle', title: 'Inventory items: `items.x`' },
      { name: 'DialogHandle', title: 'Dialogs: `dialog`, `dialogs.x`' },
      { name: 'DialogOptionHandle', title: 'Dialog options: `options.x`, `dialogs.x.options.y`' },
      { name: 'GuiHandle', title: 'GUIs: `gui`, `guis.x`' },
      { name: 'GuiControlHandle', title: 'GUI controls: `saveBtn`, `guis.x.controls.y`' },
      { name: 'VerbHandle', title: 'Verbs: `verbs.x`' },
      { name: 'FallbacksHandle', title: 'Fallbacks: `fallbacks`' },
      { name: 'SfxHandle', title: 'Sounds: `sfx.x`', extra: ['SfxControls'] },
      { name: 'MusicHandle', title: 'Music: `music.x`', extra: ['MusicControls'] },
      { name: 'VideoHandle', title: 'Videos: `video.x`', extra: ['VideoControls'] },
      { name: 'Task', title: 'Tasks: what `.now(…)` and `background(…)` return' },
    ],
  },
  {
    heading: 'Types',
    blurb: 'Types you may write in your own helpers.',
    entries: [
      {
        types: [
          'WalkTarget', 'ItemRef', 'ItemHandlerOptions', 'FallbackTarget', 'FacingOptions', 'SaveRef', 'SaveInfo',
          'PointerHover', 'FlagSpec', 'VarValue', 'StepHandler', 'EventName',
        ],
      },
    ],
  },
];

/** Exports that are plumbing for the generated modules or the transform, not authoring API. */
const INTERNAL = new Set([
  '__runtime', 'withVerbMethods', 'withMusicControls', 'withSfxControls', 'withVideoControls',
  'VerbSpec', 'Timed', 'Inventory', 'EngineEventName', 'SfxControls', 'MusicControls', 'VideoControls',
]);

/** Members that exist for the engine, not for scripts. */
const HIDDEN_MEMBERS = new Set([
  'roomId', 'kind', 'guiId', 'dialogId', 'onWithoutArming', 'promise', 'isPlayerWalk', 'waitsForPlayer', 'resolved',
]);

/** Signatures the AST can't show well. */
const SIGNATURE_OVERRIDES = {
  say: 'say`Speaker: line …`',
};

/** Blocks wait for their body, but return `void` like instant calls. */
const KIND_OVERRIDES = {
  cutscene: 'waits',
  together: 'waits',
  withInputDisabled: 'waits',
  background: "doesn't wait",
  wait: 'waits', // `task.wait()`
};

// ─── Reading the source ──────────────────────────────────────────────────────

/** @type {Map<string, ts.SourceFile>} */
const sources = new Map();

async function sourceFile(file) {
  let sf = sources.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    sources.set(file, sf);
  }
  return sf;
}

/** `export { a, type B } from './x.js'` in index.ts → name → { file, typeOnly }. */
async function readExports() {
  const sf = await sourceFile(indexFile);
  /** @type {Map<string, { file: string; typeOnly: boolean }>} */
  const out = new Map();
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      const file = path.join(apiDir, stmt.moduleSpecifier.text.replace(/\.js$/, '.ts'));
      for (const el of stmt.exportClause.elements) {
        out.set(el.name.text, { file, typeOnly: stmt.isTypeOnly || el.isTypeOnly });
      }
    } else if (ts.isVariableStatement(stmt) && stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of stmt.declarationList.declarations) out.set(d.name.getText(sf), { file: indexFile, typeOnly: false });
    }
  }
  return out;
}

/** The top-level declaration of `name` in `file` (following `export type { X }` re-exports). */
async function findDeclaration(file, name) {
  const sf = await sourceFile(file);
  for (const stmt of sf.statements) {
    if ((ts.isClassDeclaration(stmt) || ts.isFunctionDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) && stmt.name?.text === name) {
      return stmt;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) if (d.name.getText(sf) === name) return d;
    }
  }
  // `export type { FallbackTarget } from …` / `import { type X } from './y.js'` → look there.
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
      if (stmt.importClause.namedBindings.elements.some((el) => el.name.text === name) && stmt.moduleSpecifier.text.startsWith('./')) {
        return findDeclaration(path.join(path.dirname(file), stmt.moduleSpecifier.text.replace(/\.js$/, '.ts')), name);
      }
    }
  }
  return null;
}

/** The first paragraph of a node's JSDoc, on one line, with `{@link x}` as code. */
function docOf(node) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const doc = docs[docs.length - 1];
  if (!doc) return '';
  const text = typeof doc.comment === 'string' ? doc.comment : ts.getTextOfJSDocComment(doc.comment) ?? '';
  return text
    .split(/\n\s*\n/)[0]
    .replace(/\{@link\s+([^}\s|]+)\s*\}/g, '`$1`')
    .replace(/\s*\n\s*/g, ' ')
    // Design-doc references (`(§4.2)`, `(decision 9)`) mean nothing on the reference page.
    .replace(/\s*\((?:§[\d.]+|decision \d+)(?:,\s*(?:§[\d.]+|decision \d+))*\)/g, '')
    .trim();
}

function isInternal(node) {
  return ts.getJSDocTags(node).some((t) => t.tagName.text === 'internal');
}

// ─── Rendering signatures ────────────────────────────────────────────────────

/** Type text as written, with the handle generics given readable names. */
function typeText(node) {
  if (!node) return '';
  return node
    .getText()
    .replace(/\s+/g, ' ')
    .replace(/\bV\b/g, 'VerbId')
    .replace(/\bAnim\b/g, 'AnimTag')
    .replace(/\{ readonly \[K in keyof \w+\]: (\w+) \}/g, '{ [name]: $1 }');
}

function paramsText(params) {
  return params
    .map((p) => {
      const name = p.name.getText();
      const rest = p.dotDotDotToken ? '...' : '';
      if (p.initializer) {
        const init = p.initializer.getText().replace(/\s+/g, ' ');
        return init === '{}' ? `${rest}${name}?: ${typeText(p.type)}` : `${rest}${name} = ${init}`;
      }
      return `${rest}${name}${p.questionToken ? '?' : ''}${p.type ? `: ${typeText(p.type)}` : ''}`;
    })
    .join(', ');
}

/** `timed((a: A): Task => …)` → the arrow function inside, else null. */
function timedArrow(expr) {
  if (expr && ts.isCallExpression(expr) && expr.expression.getText() === 'timed') {
    const fn = expr.arguments[0];
    if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return fn;
  }
  return null;
}

/**
 * @typedef {{ sig: string; kind: string; doc: string; missingDoc: boolean }} Row
 */

const KIND = {
  timed: 'waits · `.now`',
  ends: 'ends the handler',
  handler: 'handler',
  get: 'read-only',
  getSet: 'settable',
  instant: 'instant',
  value: 'value',
};

/** Registers a handler: named `on`, `on…` or `once` (or `playFrom`), and takes a function. */
function isRegistration(name, params) {
  const takesFunction = params.some((p) => p.type && /StepHandler|=>/.test(p.type.getText()));
  return takesFunction && (name === 'on' || name === 'once' || name === 'playFrom' || /^on[A-Z]/.test(name));
}

function functionKind(name, fn) {
  if (KIND_OVERRIDES[name]) return KIND_OVERRIDES[name];
  if (fn.type?.getText() === 'never') return KIND.ends;
  if (isRegistration(name, fn.parameters)) return KIND.handler;
  return KIND.instant;
}

/** One row for a function-like member: `name(params)`. */
function callRow(prefix, name, fn, docNode) {
  const sig = SIGNATURE_OVERRIDES[name] ?? `${prefix}${name}(${paramsText(fn.parameters)})`;
  const doc = docOf(docNode);
  return { sig, kind: functionKind(name, fn), doc, missingDoc: !doc };
}

/**
 * Rows for the members of a class, an object literal or an interface. `resolveObject` turns a
 * property whose value is another object (`speech: speechSettings`) into nested rows.
 * @returns {Promise<Row[]>}
 */
async function memberRows(members, prefix, file) {
  /** @type {Row[]} */
  const rows = [];
  /** @type {Map<string, { get?: ts.Node; set?: ts.Node }>} */
  const accessors = new Map();
  for (const m of members) {
    const name = m.name?.getText();
    if (!name || HIDDEN_MEMBERS.has(name) || isInternal(m)) continue;
    if (m.modifiers?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword || x.kind === ts.SyntaxKind.ProtectedKeyword || x.kind === ts.SyntaxKind.StaticKeyword)) continue;
    if (ts.isConstructorDeclaration(m)) continue;
    if (ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) {
      const entry = accessors.get(name) ?? {};
      if (ts.isGetAccessorDeclaration(m)) entry.get = m;
      else entry.set = m;
      if (!accessors.has(name)) {
        accessors.set(name, entry);
        rows.push({ accessor: name });
      }
      continue;
    }
    if (ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) {
      rows.push(callRow(prefix, name, m, m));
      continue;
    }
    if (ts.isPropertyDeclaration(m) || ts.isPropertyAssignment(m) || ts.isPropertySignature(m)) {
      const init = m.initializer;
      const arrow = timedArrow(init);
      if (arrow) {
        const doc = docOf(m);
        rows.push({ sig: `${prefix}${name}(${paramsText(arrow.parameters)})`, kind: KIND.timed, doc, missingDoc: !doc });
        continue;
      }
      if (init && ts.isIdentifier(init)) {
        // `speech: speechSettings`: a nested settings object.
        const decl = await findDeclaration(file, init.text);
        if (decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          rows.push(...(await memberRows(decl.initializer.properties, `${prefix}${name}.`, file)));
          continue;
        }
      }
      if (m.type && (ts.isFunctionTypeNode(m.type))) {
        rows.push(callRow(prefix, name, m.type, m));
        continue;
      }
      const readonly = ts.isPropertySignature(m) || m.modifiers?.some((x) => x.kind === ts.SyntaxKind.ReadonlyKeyword);
      const doc = docOf(m);
      const type = typeText(m.type);
      rows.push({ sig: `${prefix}${name}${type ? `: ${type}` : ''}`, kind: readonly ? KIND.get : KIND.getSet, doc, missingDoc: !doc });
    }
  }
  // Fill in accessor rows (the doc is on whichever half has it, usually the getter).
  return rows.map((row) => {
    if (!('accessor' in row)) return row;
    const { get, set } = accessors.get(row.accessor);
    const type = typeText(get?.type ?? set?.parameters[0]?.type);
    const doc = docOf(get ?? set) || (set ? docOf(set) : '');
    return {
      sig: `${prefix}${row.accessor}${type ? `: ${type}` : ''}`,
      kind: get && set ? KIND.getSet : get ? KIND.get : 'write-only',
      doc,
      missingDoc: !doc,
    };
  });
}

function escapeCell(text) {
  return text.replace(/\|/g, '\\|');
}

/** A code span; one containing a backtick (`` say`…` ``) needs double backticks. */
function code(text) {
  return text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
}

function table(rows) {
  if (rows.length === 0) return '';
  const lines = ['| Member | | Description |', '|---|---|---|'];
  for (const r of rows) lines.push(`| ${code(escapeCell(r.sig))} | ${r.kind} | ${escapeCell(r.doc)} |`);
  return `${lines.join('\n')}\n`;
}

// ─── Sections ────────────────────────────────────────────────────────────────

/** @type {string[]} */
const missingDocs = [];

function noteMissing(owner, rows) {
  for (const r of rows) if (r.missingDoc) missingDocs.push(`${owner}: ${r.sig}`);
}

async function renderFunctions(names, exportsMap) {
  /** @type {Row[]} */
  const rows = [];
  for (const name of names) {
    const exp = exportsMap.get(name);
    const decl = await findDeclaration(exp.file, name);
    if (decl && ts.isFunctionDeclaration(decl)) {
      rows.push(callRow('', name, decl, decl));
    } else if (decl && ts.isVariableDeclaration(decl)) {
      const arrow = timedArrow(decl.initializer);
      const docNode = decl.parent.parent;
      const doc = docOf(docNode);
      if (SIGNATURE_OVERRIDES[name]) {
        rows.push({ sig: SIGNATURE_OVERRIDES[name], kind: KIND.timed, doc, missingDoc: !doc });
      } else if (arrow) {
        rows.push({ sig: `${name}(${paramsText(arrow.parameters)})`, kind: KIND.timed, doc, missingDoc: !doc });
      } else {
        throw new Error(`${name}: not a function or a timed action`);
      }
    } else {
      throw new Error(`${name}: declaration not found in ${path.relative(repoRoot, exp.file)}`);
    }
  }
  noteMissing('functions', rows);
  return table(rows);
}

async function renderNamed(entry, exportsMap) {
  const exp = exportsMap.get(entry.name);
  const decl = await findDeclaration(exp.file, entry.name);
  if (!decl) throw new Error(`${entry.name}: declaration not found`);
  const out = [];
  const where = path.relative(repoRoot, exp.file);
  if (ts.isClassDeclaration(decl)) {
    out.push(`### ${entry.title ?? `\`${entry.name}\``}\n`);
    const parts = [`\`${entry.name}\` in \`${where}\`.`];
    const ext = decl.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText();
    if (ext) parts.push(`Also has everything on \`${ext}\`.`);
    const doc = docOf(decl);
    if (doc) parts.unshift(doc);
    out.push(`${parts.join(' ')}\n`);
    if (entry.intro) out.push(`${entry.intro}\n`);
    const rows = await memberRows(decl.members, '', exp.file);
    noteMissing(entry.name, rows);
    out.push(table(rows));
  } else if (ts.isVariableDeclaration(decl)) {
    out.push(`### ${entry.title ?? `\`${entry.name}\``}\n`);
    const doc = docOf(decl.parent.parent);
    if (!doc) missingDocs.push(`objects: ${entry.name}`);
    out.push(`${doc ? `${doc} ` : ''}In \`${where}\`.\n`);
    if (entry.intro) out.push(`${entry.intro}\n`);
    let members;
    if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
      members = decl.initializer.properties;
    } else if (decl.type && ts.isTypeReferenceNode(decl.type)) {
      const iface = await findDeclaration(exp.file, decl.type.typeName.getText());
      members = iface?.members;
    }
    if (!members) throw new Error(`${entry.name}: can't read its members`);
    const rows = await memberRows(members, `${entry.name}.`, exp.file);
    noteMissing(entry.name, rows);
    out.push(table(rows));
  } else {
    throw new Error(`${entry.name}: unsupported declaration`);
  }
  for (const extraName of entry.extra ?? []) {
    const iface = await findDeclaration(exp.file, extraName);
    const ns = extraName.replace(/Controls$/, '').toLowerCase();
    const label = ns === 'sfx' || ns === 'music' || ns === 'video' ? ns : extraName;
    out.push(`\`${label}\` itself also has these (\`${extraName}\`); the generator reserves their names:\n`);
    // `current: T | null` → the handle type.
    const rows = (await memberRows(iface.members, `${label}.`, exp.file)).map((r) => ({ ...r, sig: r.sig.replace(/\bT\b/g, entry.name) }));
    noteMissing(extraName, rows);
    out.push(table(rows));
  }
  return out.join('\n');
}

async function renderTypes(names, exportsMap) {
  const out = [];
  for (const name of names) {
    const exp = exportsMap.get(name);
    const decl = await findDeclaration(exp.file, name);
    if (!decl) throw new Error(`${name}: declaration not found`);
    const doc = docOf(decl);
    if (!doc) missingDocs.push(`types: ${name}`);
    out.push(`**\`${name}\`**${doc ? `: ${doc}` : ''}\n`);
    let code;
    if (ts.isInterfaceDeclaration(decl)) {
      const body = decl.members
        .map((m) => {
          const d = docOf(m);
          const line = m.getText().replace(/\/\*\*[\s\S]*?\*\/\s*/g, '').replace(/\s+/g, ' ').replace(/;$/, '');
          return `  ${line}${d ? `  // ${d}` : ''}`;
        })
        .join('\n');
      code = `interface ${name} {\n${body}\n}`;
    } else if (ts.isTypeAliasDeclaration(decl)) {
      code = `type ${name} = ${decl.type.getText().replace(/\s+/g, ' ')}`;
    } else {
      throw new Error(`${name}: not a type`);
    }
    out.push(`\`\`\`ts\n${code}\n\`\`\`\n`);
  }
  return out.join('\n');
}

async function render() {
  const exportsMap = await readExports();
  const placed = new Set();
  const out = [];
  for (const section of SECTIONS) {
    out.push(`## ${section.heading}\n`);
    if (section.blurb) out.push(`${section.blurb}\n`);
    for (const entry of section.entries) {
      for (const name of entry.functions ?? entry.types ?? [entry.name]) {
        if (!exportsMap.has(name)) throw new Error(`SECTIONS names "${name}", which @benne/script doesn't export`);
        placed.add(name);
      }
      if (entry.functions) out.push(await renderFunctions(entry.functions, exportsMap));
      else if (entry.types) out.push(await renderTypes(entry.types, exportsMap));
      else out.push(await renderNamed(entry, exportsMap));
    }
  }
  const unplaced = [...exportsMap.keys()].filter((n) => !placed.has(n) && !INTERNAL.has(n));
  if (unplaced.length > 0) {
    throw new Error(`@benne/script exports not in the API doc layout (add them to SECTIONS or INTERNAL): ${unplaced.join(', ')}`);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

const generated = await render();
if (missingDocs.length > 0) {
  console.error(`[docs:api] Public members without JSDoc (add a /** … */ comment):\n  ${missingDocs.join('\n  ')}`);
  process.exit(1);
}

const doc = await readFile(docFile, 'utf8');
const start = doc.indexOf(BEGIN);
const end = doc.indexOf(END);
if (start < 0 || end < start) {
  console.error(`[docs:api] ${path.relative(repoRoot, docFile)} needs the markers\n  ${BEGIN}\n  ${END}`);
  process.exit(1);
}
const next = `${doc.slice(0, start + BEGIN.length)}\n\n${generated}\n\n${doc.slice(end)}`;

if (check) {
  if (next !== doc) {
    console.error(`[docs:api] ${path.relative(repoRoot, docFile)} is out of date with src/engine/bennescript/. Run: npm run docs:api`);
    process.exit(1);
  }
} else if (next !== doc) {
  await writeFile(docFile, next, 'utf8');
  console.log(`[docs:api] Updated ${path.relative(repoRoot, docFile)}`);
} else {
  console.log(`[docs:api] ${path.relative(repoRoot, docFile)} is up to date`);
}
