/**
 * The BenneScript build transform (docs/bennescript-ergonomics-refactor.md §6).
 *
 * Script files are TypeScript with two extra meanings:
 * - in a *step function* (a handler, a top-level helper), every statement waits for the previous
 *   one: statement-level calls become `await __$.step(() => call)`;
 * - `Hank: "Hello"` (a label followed by a string) is a speech line.
 *
 * Edits are in place (no lines are added or removed, the runtime import goes at the end of the
 * file), so line numbers in the output match the source even before the source map is applied.
 *
 * Pure: code in, code + source map out. The Vite plugin (`vite-plugin-bennescript.ts`) supplies
 * the speaker table and decides which files to transform.
 */
import MagicString from 'magic-string';
import { parseAst } from 'vite';

export const BENNESCRIPT_RUNTIME_MODULE = '@benne/script';

/** Callbacks passed directly to these are step functions (besides `x.on…(…)` methods). */
const STEP_BLOCK_APIS = new Set(['playFrom', 'cutscene', 'background', 'together', 'withInputDisabled']);
/** `on…` methods whose callbacks run every frame and must stay synchronous (§4.18). */
const NOT_STEP_ON_METHODS = new Set(['onUpdate']);

const SCRIPT_FILE = /(?:^|[/\\])(?:[^/\\]+\.(?:room|character|inventory|dialog|gui|script)\.ts|globalScript\.ts)$/;
/**
 * While both APIs coexist (until Phase 6), only files that use the new API are transformed:
 * old `register*Script` callbacks must keep running synchronously at click time.
 */
const NEW_API_IMPORT = /\bfrom\s+['"](?:@benne\/script|@game|\.{1,2}\/[^'"]*\.ids(?:\.ts)?)['"]/;

export function isBenneScriptFile(id) {
  return SCRIPT_FILE.test(id.replace(/[?#].*$/, ''));
}

export function usesNewBenneScriptApi(code) {
  return NEW_API_IMPORT.test(code);
}

// ─── Speakers ────────────────────────────────────────────────────────────────

/** Letters and digits only, lower case (§4.2). */
export function normalizeSpeakerLabel(label) {
  return String(label).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/**
 * Speaker table from character JSON: normalised ID and display name → character ids.
 * `Player` always means the active player.
 * @param {ReadonlyArray<{ id: string, name?: string }>} characters
 */
export function buildSpeakerTable(characters) {
  /** @type {Map<string, Set<string>>} */
  const byLabel = new Map();
  /** @type {Array<{ label: string, normalized: string }>} */
  const labels = [];
  const add = (label, id) => {
    const normalized = normalizeSpeakerLabel(label);
    if (!normalized) return;
    let ids = byLabel.get(normalized);
    if (!ids) {
      ids = new Set();
      byLabel.set(normalized, ids);
    }
    ids.add(id);
    labels.push({ label: String(label).replace(/[^A-Za-z0-9]/g, ''), normalized });
  };
  for (const c of characters) {
    // Names first, so "Did you mean" suggests the display name when both are equally close.
    if (c.name) add(c.name, c.id);
    add(c.id, c.id);
  }
  return { byLabel, labels };
}

const PLAYER_LABEL = 'player';
const PLAYER_SPEAKER = 'Player';

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** @returns {{ id: string } | { error: string }} */
function resolveSpeaker(label, table) {
  const normalized = normalizeSpeakerLabel(label);
  if (normalized === PLAYER_LABEL) {
    return { id: PLAYER_SPEAKER };
  }
  const ids = table.byLabel.get(normalized);
  if (ids && ids.size === 1) {
    return { id: [...ids][0] };
  }
  if (ids && ids.size > 1) {
    return {
      error:
        `Speaker \`${label}\` matches more than one character: ${[...ids].sort().join(', ')}. ` +
        'Use the other form of the name, or `characters.<id>.say(…)`.',
    };
  }
  let best = null;
  for (const candidate of [{ label: 'Player', normalized: PLAYER_LABEL }, ...table.labels]) {
    const d = levenshtein(normalized, candidate.normalized);
    if (d <= 2 && (best == null || d < best.d)) best = { d, label: candidate.label };
  }
  return { error: `Unknown speaker \`${label}\`.${best ? ` Did you mean \`${best.label}\`?` : ''}` };
}

// ─── AST helpers ─────────────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['type', 'start', 'end', 'parent', 'range', 'loc']);

function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const item of v) if (item && typeof item.type === 'string') out.push(item);
    } else if (v && typeof v === 'object' && typeof v.type === 'string') {
      out.push(v);
    }
  }
  return out;
}

function walk(node, visit) {
  if (visit(node) === false) return;
  for (const child of children(node)) walk(child, visit);
}

const isFunction = (n) =>
  n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration';

/** Strips parentheses / `!` / `as` wrappers that don't change what an expression is. */
function unwrap(n) {
  while (
    n &&
    (n.type === 'ParenthesizedExpression' ||
      n.type === 'TSNonNullExpression' ||
      n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'ChainExpression')
  ) {
    n = n.expression;
  }
  return n;
}

const isCallLike = (n) => {
  const u = unwrap(n);
  return u != null && (u.type === 'CallExpression' || u.type === 'TaggedTemplateExpression');
};

function propertyName(member) {
  if (member.type !== 'MemberExpression' || member.computed) return null;
  return member.property.type === 'Identifier' ? member.property.name : null;
}

/** `x.onLook(…)`, `x.on([…], …)`, `cutscene(…)`, `playFrom(…)`, … */
function isStepApiCall(call) {
  const callee = unwrap(call.callee);
  if (callee.type === 'Identifier') return STEP_BLOCK_APIS.has(callee.name);
  const name = propertyName(callee);
  if (name == null) return false;
  if (STEP_BLOCK_APIS.has(name)) return true;
  return /^on(?:[A-Z]|$)/.test(name) && !NOT_STEP_ON_METHODS.has(name);
}

const isStringBody = (n) => n.type === 'TemplateLiteral' || (n.type === 'Literal' && typeof n.value === 'string');

// ─── Transform ───────────────────────────────────────────────────────────────

export class BenneScriptTransformError extends Error {
  /** @param {string} message @param {number} pos UTF-16 offset in the source */
  constructor(message, pos) {
    super(message);
    this.name = 'BenneScriptTransformError';
    this.pos = pos;
  }
}

/**
 * @param {string} code
 * @param {{ filename: string, speakers: ReturnType<typeof buildSpeakerTable> }} options
 * @returns {{ code: string, map: import('magic-string').SourceMap } | null} `null` when nothing changed
 */
export function transformBenneScript(code, { filename, speakers }) {
  const ast = parseAst(code, { lang: 'ts' }, filename);
  const s = new MagicString(code);
  const fail = (message, node) => {
    throw new BenneScriptTransformError(message, node.start);
  };

  // 1. Step functions: top-level functions, imports from *.script.ts, and callbacks of step APIs.
  /** @type {Set<string>} names that call a step function when called */
  const stepNames = new Set();
  /** @type {Set<object>} */
  const stepFunctions = new Set();

  for (let stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') {
      if (/\.script(?:\.ts)?$/.test(stmt.source.value)) {
        for (const spec of stmt.specifiers) {
          if (spec.type !== 'ImportNamespaceSpecifier') stepNames.add(spec.local.name);
        }
      }
      continue;
    }
    if ((stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') && stmt.declaration) {
      stmt = stmt.declaration;
    }
    if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      stepNames.add(stmt.id.name);
      stepFunctions.add(stmt);
    } else if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) {
        const init = d.init && unwrap(d.init);
        if (init && isFunction(init) && d.id.type === 'Identifier') {
          stepNames.add(d.id.name);
          stepFunctions.add(init);
        }
      }
    }
  }

  walk(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    if (isStepApiCall(node)) {
      for (const arg of node.arguments) {
        const fn = unwrap(arg);
        if (isFunction(fn)) stepFunctions.add(fn);
      }
      return;
    }
    // Rule 6: a step function handed to something that will call it without waiting.
    for (const arg of node.arguments) {
      if (arg.type === 'Identifier' && stepNames.has(arg.name)) {
        fail(
          `\`${arg.name}\` is a step function (its lines wait for each other), so it can't be passed to ` +
            `\`${code.slice(node.callee.start, node.callee.end)}\`, which would not wait for it. ` +
            `Use a loop instead, e.g. \`for (const x of list) ${arg.name}(x)\`.`,
          arg,
        );
      }
    }
  });

  const handledLabels = new Set();
  // A speech label outside a step function would silently do nothing.
  const assertNoStraySpeechLabels = () =>
    walk(ast, (n) => {
      if (n.type !== 'LabeledStatement' || handledLabels.has(n)) return;
      if (n.body.type === 'ExpressionStatement' && isStringBody(unwrap(n.body.expression))) {
        fail(
          `Speech line \`${n.label.name}: …\` is outside a handler or helper function, so it would never be spoken. ` +
            'Speech lines belong in a handler body or a top-level function.',
          n.label,
        );
      }
    });

  if (stepFunctions.size === 0) {
    assertNoStraySpeechLabels();
    return null;
  }

  // 2. Rewrite each step function.
  /** `x.now(…)` or `background(…)`: starts an action without waiting, so it needs the context. */
  const startsAction = (call) => {
    const callee = unwrap(call.callee);
    if (callee.type === 'Identifier') return callee.name === 'background';
    return propertyName(callee) === 'now';
  };
  const isStepCall = (n) => {
    const u = unwrap(n);
    return u.type === 'CallExpression' && unwrap(u.callee).type === 'Identifier' && stepNames.has(unwrap(u.callee).name);
  };

  /** Errors if `node` contains a step-function call outside nested functions (it would sit inside a sync thunk). */
  const assertNoNestedStepCalls = (node, where) => {
    walk(node, (n) => {
      if (n !== node && isFunction(n)) return false;
      if (n !== node && n.type === 'CallExpression' && isStepCall(n)) {
        fail(
          `\`${code.slice(n.start, n.end)}\` calls a step function inside ${where}. ` +
            'Put it on its own line first, e.g. `const value = …`.',
          n,
        );
      }
      return undefined;
    });
  };

  /**
   * Inserts `prefix` before `node`, mapped to the node's source position. Done as an overwrite of
   * the node's first character so the source map points the original position at the inserted
   * `await` (a statement of the handler), not at the call inside the thunk: otherwise a DevTools
   * breakpoint on the line is set inside the thunk, and "step over" leaves the handler.
   */
  const insertMappedBefore = (node, prefix) => {
    s.overwrite(node.start, node.start + 1, prefix + code[node.start]);
  };

  const wrapStep = (expr) => {
    insertMappedBefore(expr, 'await __$.step(() => ');
    s.prependRight(expr.end, ')');
  };

  /**
   * Expression position: calls to known step functions need an `await`. Calls that start an action
   * (`x.now(…)`, `background(…)`) run inside `__$.run` so they get the ambient context, like a
   * statement would: `const walk = jensen.walkTo.now(…)` (§12).
   */
  const visitExpression = (expr) => {
    if (!expr) return;
    walk(expr, (n) => {
      if (isFunction(n)) return false;
      if (n.type === 'CallExpression' && isStepCall(n)) {
        assertNoNestedStepCalls(n, 'the arguments of another step-function call');
        insertMappedBefore(n, '(await __$.step(() => ');
        s.prependRight(n.end, '))');
        return false;
      }
      if (n.type === 'CallExpression' && startsAction(n)) {
        assertNoNestedStepCalls(n, 'a `.now(…)` call');
        insertMappedBefore(n, '__$.run(() => ');
        s.prependRight(n.end, ')');
        return false;
      }
      return undefined;
    });
  };

  const visitStatement = (stmt) => {
    if (!stmt) return;
    switch (stmt.type) {
      case 'BlockStatement':
        stmt.body.forEach(visitStatement);
        return;
      case 'ExpressionStatement':
        if (isCallLike(stmt.expression)) {
          assertNoNestedStepCalls(stmt.expression, 'another call on the same line');
          wrapStep(stmt.expression);
        } else {
          visitExpression(stmt.expression);
        }
        return;
      case 'LabeledStatement':
        visitLabeled(stmt);
        return;
      case 'IfStatement':
        visitExpression(stmt.test);
        visitStatement(stmt.consequent);
        visitStatement(stmt.alternate);
        return;
      case 'ForStatement':
        if (stmt.init?.type === 'VariableDeclaration') visitStatement(stmt.init);
        else visitExpression(stmt.init);
        visitExpression(stmt.test);
        visitExpression(stmt.update);
        visitStatement(stmt.body);
        return;
      case 'ForOfStatement':
      case 'ForInStatement':
        visitExpression(stmt.right);
        visitStatement(stmt.body);
        return;
      case 'WhileStatement':
      case 'DoWhileStatement':
        visitExpression(stmt.test);
        visitStatement(stmt.body);
        return;
      case 'SwitchStatement':
        visitExpression(stmt.discriminant);
        for (const c of stmt.cases) {
          visitExpression(c.test);
          c.consequent.forEach(visitStatement);
        }
        return;
      case 'TryStatement':
        visitStatement(stmt.block);
        if (stmt.handler) visitStatement(stmt.handler.body);
        visitStatement(stmt.finalizer);
        return;
      case 'ReturnStatement':
        if (stmt.argument && isCallLike(stmt.argument)) {
          assertNoNestedStepCalls(stmt.argument, 'another call on the same line');
          wrapStep(stmt.argument);
        } else {
          visitExpression(stmt.argument);
        }
        return;
      case 'ThrowStatement':
        visitExpression(stmt.argument);
        return;
      case 'VariableDeclaration':
        for (const d of stmt.declarations) visitExpression(d.init);
        return;
      default:
        // Nested function / class declarations, break, continue, … are left alone.
        return;
    }
  };

  const visitLabeled = (stmt) => {
    const body = stmt.body;
    if (body.type !== 'ExpressionStatement') {
      visitStatement(body);
      return;
    }
    const expr = unwrap(body.expression);
    const speaker = resolveSpeaker(stmt.label.name, speakers);
    if ('error' in speaker) {
      if (isStringBody(expr)) fail(speaker.error, stmt.label);
      visitStatement(body);
      return;
    }
    if (expr.type === 'SequenceExpression') {
      fail(`A speech line takes one string: \`${stmt.label.name}: "…"\`.`, expr);
    }
    assertNoNestedStepCalls(body.expression, 'a speech line');
    handledLabels.add(stmt);
    // `Hank: "Hi"` → `await __$.step(() => __bs.say("hank", "Hi"))`, keeping the text's position.
    s.overwrite(stmt.start, body.expression.start, `await __$.step(() => __bs.say(${JSON.stringify(speaker.id)}, `);
    s.prependRight(body.expression.end, '))');
  };

  for (const fn of stepFunctions) {
    if (fn.generator) fail('Step functions cannot be generators.', fn);
    if (!fn.async) s.appendLeft(fn.start, 'async ');
    if (fn.body.type === 'BlockStatement') {
      s.appendLeft(fn.body.start + 1, ' const __$ = __bs.ctx();');
      fn.body.body.forEach(visitStatement);
    } else {
      // Concise body: `() => expr`. Replace everything after `=>` so wrapping parens stay inside.
      const arrow = code.lastIndexOf('=>', fn.body.start);
      const bodyStart = arrow + 2;
      if (isCallLike(fn.body)) {
        assertNoNestedStepCalls(fn.body, 'another call on the same line');
        s.appendLeft(bodyStart, ' { const __$ = __bs.ctx(); return await __$.step(() => (');
        s.prependRight(fn.end, ')); }');
      } else {
        s.appendLeft(bodyStart, ' { const __$ = __bs.ctx(); return (');
        visitExpression(fn.body);
        s.prependRight(fn.end, '); }');
      }
    }
  }

  assertNoStraySpeechLabels();

  s.append(`\nimport { __runtime as __bs } from ${JSON.stringify(BENNESCRIPT_RUNTIME_MODULE)};\n`);
  return {
    code: s.toString(),
    map: s.generateMap({ source: filename, includeContent: true, hires: true }),
  };
}
