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
import { buildSpeakerTable, normalizeSpeakerLabel, resolveSpeaker } from './benneSpeakers.mjs';

export const BENNESCRIPT_RUNTIME_MODULE = '@benne/script';

/** Callbacks passed directly to these are step functions (besides `x.on…(…)` methods). */
const STEP_BLOCK_APIS = new Set(['playFrom', 'cutscene', 'background', 'together', 'withInputDisabled']);
/** Methods besides `on…` whose callbacks are handlers (`events.once(name, fn)`). */
const STEP_METHODS = new Set(['once']);
/** `on…` methods whose callbacks run every frame and must stay synchronous (§4.18). */
const NOT_STEP_ON_METHODS = new Set(['onUpdate']);

const SCRIPT_FILE = /(?:^|[/\\])(?:[^/\\]+\.(?:room|character|inventory|dialog|gui|script)\.ts|globalScript\.ts)$/;
export function isBenneScriptFile(id) {
  return SCRIPT_FILE.test(id.replace(/[?#].*$/, ''));
}

// ─── Speakers ────────────────────────────────────────────────────────────────

// Speaker resolution is shared with the handle generator (scripts/lib/benneSpeakers.mjs).
export { buildSpeakerTable, normalizeSpeakerLabel, resolveSpeaker };

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

const isOnMethod = (name) => name != null && /^on(?:[A-Z]|$)/.test(name) && !NOT_STEP_ON_METHODS.has(name);

/** `x.onLook(…)`, `x.on([…], …)`, `items.x.onUse.doNotActivate(…)`, `cutscene(…)`, `playFrom(…)`, … */
function isStepApiCall(call) {
  const callee = unwrap(call.callee);
  if (callee.type === 'Identifier') return STEP_BLOCK_APIS.has(callee.name);
  const name = propertyName(callee);
  if (name == null) return false;
  if (STEP_BLOCK_APIS.has(name) || STEP_METHODS.has(name)) return true;
  if (name === 'doNotActivate') return isOnMethod(propertyName(unwrap(callee.object)));
  return isOnMethod(name);
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
    resolveSayBlock(expr);
    insertMappedBefore(expr, 'await __$.step(() => ');
    s.prependRight(expr.end, ')');
  };

  /**
   * `` say`Hank: …` `` blocks: speakers are checked here, like labels, and passed to the runtime:
   * `` say.__withSpeakers({ "Hank": "hank" })`…` ``. Labels built from `${…}` are left to the runtime.
   */
  const resolveSayBlock = (expr) => {
    const u = unwrap(expr);
    if (u.type !== 'TaggedTemplateExpression') return;
    const tag = unwrap(u.tag);
    if (tag.type !== 'Identifier' || tag.name !== 'say') return;
    const HOLE = '\u0000';
    const body = u.quasi.quasis.map((q) => q.value.cooked ?? q.value.raw).join(HOLE);
    /** @type {Record<string, string>} */
    const resolved = {};
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const colon = line.indexOf(':');
      if (colon < 0) {
        if (line.includes(HOLE)) continue;
        fail(`Each line of a \`say\` block is \`Speaker: text\`; this one has no ":": ${JSON.stringify(line)}.`, u.quasi);
      }
      const label = line.slice(0, colon).trim();
      if (label.includes(HOLE) || label in resolved) continue;
      const speaker = resolveSpeaker(label, speakers);
      if ('error' in speaker) fail(`In a \`say\` block: ${speaker.error}`, u.quasi);
      resolved[label] = speaker.id;
    }
    s.appendLeft(u.tag.end, `.__withSpeakers(${JSON.stringify(resolved)})`);
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
        resolveSayBlock(fn.body);
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
