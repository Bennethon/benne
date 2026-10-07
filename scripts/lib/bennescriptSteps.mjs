/**
 * Which functions in a BenneScript file are *step functions* (their lines wait for each other,
 * docs/bennescript-ergonomics-refactor.md §5): shared by the build transform
 * (`bennescriptTransform.mjs`) and the ESLint rules (`eslint-plugin-bennescript.mjs`).
 *
 * Works on ESTree, as both Vite's `parseAst` and typescript-eslint produce it.
 */

/** Callbacks passed directly to these are step functions (besides `x.on…(…)` methods). */
export const STEP_BLOCK_APIS = new Set(['playFrom', 'cutscene', 'background', 'together', 'withInputDisabled']);
/** Methods besides `on…` whose callbacks are handlers (`events.once(name, fn)`). */
export const STEP_METHODS = new Set(['once']);
/** `on…` methods whose callbacks run every frame and must stay synchronous (§4.18). */
export const NOT_STEP_ON_METHODS = new Set(['onUpdate']);

export const SCRIPT_FILE = /(?:^|[/\\])(?:[^/\\]+\.(?:room|character|inventory|dialog|gui|script)\.ts|globalScript\.ts)$/;

export function isBenneScriptFile(id) {
  return SCRIPT_FILE.test(id.replace(/[?#].*$/, ''));
}

export const isFunction = (n) =>
  n != null && (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration');

/** Strips parentheses / `!` / `as` wrappers that don't change what an expression is. */
export function unwrap(n) {
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

export function propertyName(member) {
  if (member.type !== 'MemberExpression' || member.computed) return null;
  return member.property.type === 'Identifier' ? member.property.name : null;
}

export const isOnMethod = (name) => name != null && /^on(?:[A-Z]|$)/.test(name) && !NOT_STEP_ON_METHODS.has(name);

/** `x.onLook(…)`, `x.on([…], …)`, `items.x.onUse.doNotActivate(…)`, `cutscene(…)`, `playFrom(…)`, … */
export function isStepApiCall(call) {
  const callee = unwrap(call.callee);
  if (callee.type === 'Identifier') return STEP_BLOCK_APIS.has(callee.name);
  const name = propertyName(callee);
  if (name == null) return false;
  if (STEP_BLOCK_APIS.has(name) || STEP_METHODS.has(name)) return true;
  if (name === 'doNotActivate') return isOnMethod(propertyName(unwrap(callee.object)));
  return isOnMethod(name);
}

/** `onUpdate(fn)` / `x.onUpdate(fn)`: `fn` runs every frame, unsequenced (§4.18). */
export function isUpdateCall(call) {
  const callee = unwrap(call.callee);
  if (callee.type === 'Identifier') return NOT_STEP_ON_METHODS.has(callee.name);
  return NOT_STEP_ON_METHODS.has(propertyName(callee));
}

/**
 * The file's top-level step functions: top-level functions and imports from `*.script.ts`.
 * @returns {{ stepNames: Set<string>, stepFunctions: Set<object> }} `stepNames` call a step
 *   function when called; `stepFunctions` are the function nodes (callbacks of step APIs are
 *   found separately, with {@link isStepApiCall}).
 */
export function topLevelStepFunctions(program) {
  const stepNames = new Set();
  const stepFunctions = new Set();
  for (let stmt of program.body) {
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
  return { stepNames, stepFunctions };
}
