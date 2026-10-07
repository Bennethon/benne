/**
 * ESLint rules for BenneScript (docs/bennescript-ergonomics-refactor.md §6.3, §9): the mistakes
 * that build and type-check but don't run in order.
 *
 * - `bennescript/no-unwaited-timed-call`: a timed action (`walkTo`, `say`, `wait`, `face`, …) or a
 *   step function called where nothing waits for it: inside `onUpdate`, in a callback or nested
 *   function that isn't a handler, at the top level, in a plain `.ts` file, or inside an expression
 *   (only a call on its own line waits).
 * - `bennescript/no-await-in-step`: `await` in a handler or helper. Lines already wait; on a timed
 *   action, `await` stops the line from waiting.
 *
 * Timed actions are recognised by type (a callable with a `.now()` that returns a `Task`), so the
 * rules need typed linting (`parserOptions.projectService`). Without type information they still
 * check step-function calls and `await`.
 */
import {
  isBenneScriptFile,
  isFunction,
  isStepApiCall,
  isUpdateCall,
  topLevelStepFunctions,
  unwrap,
} from './bennescriptSteps.mjs';

const TRANSPARENT = new Set(['ChainExpression', 'TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression']);

/** Step-function bookkeeping for one file: top-level functions plus callbacks of step APIs. */
function stepTracker(context) {
  const isScript = isBenneScriptFile(context.filename);
  let stepNames = new Set();
  let stepFunctions = new Set();
  return {
    isScript,
    stepNames: () => stepNames,
    isStepFunction: (fn) => stepFunctions.has(fn),
    visitors: {
      Program(node) {
        if (isScript) ({ stepNames, stepFunctions } = topLevelStepFunctions(node));
      },
      // Runs on entry, so a handler's callback is known before the calls inside it are checked.
      CallExpression(node) {
        if (!isScript || !isStepApiCall(node)) return;
        for (const arg of node.arguments) {
          const fn = unwrap(arg);
          if (isFunction(fn)) stepFunctions.add(fn);
        }
      },
    },
  };
}

function enclosingFunction(node) {
  for (let n = node.parent; n; n = n.parent) if (isFunction(n)) return n;
  return null;
}

/** Inside an `onUpdate` callback, and not inside a step function (a `background` block) within it. */
function inUpdate(node, isStepFunction) {
  for (let n = node.parent; n; n = n.parent) {
    if (!isFunction(n)) continue;
    if (isStepFunction(n)) return false;
    if (n.parent?.type === 'CallExpression' && n.parent.arguments.includes(n) && isUpdateCall(n.parent)) return true;
  }
  return false;
}

/**
 * The call is a statement of its own (`walkTo(p)`, `return walkTo(p)`, `() => walkTo(p)`), which the
 * transform waits on. `await walkTo(p)` counts too: `no-await-in-step` reports that one.
 */
function isStatementLevel(node) {
  let n = node;
  while (n.parent && (TRANSPARENT.has(n.parent.type) || n.parent.type === 'ParenthesizedExpression')) n = n.parent;
  const p = n.parent;
  if (!p) return false;
  if (p.type === 'AwaitExpression') return true;
  if (p.type === 'ExpressionStatement') return true;
  if (p.type === 'ReturnStatement' && p.argument === n) return true;
  return p.type === 'ArrowFunctionExpression' && p.body === n;
}

/** Type helpers over the TypeScript checker, or null without type information. */
function typeTools(context) {
  const services = context.sourceCode.parserServices;
  const checker = services?.program?.getTypeChecker();
  if (!checker || !services.esTreeNodeToTSNodeMap) return null;
  const typeOf = (node) => checker.getNonNullableType(checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node)));
  const isTask = (type) => type.getSymbol()?.getName() === 'Task' && !!type.getProperty('wait') && !!type.getProperty('cancel');
  /** A timed action: callable, with a `.now(…)` that returns a `Task`. */
  const isTimed = (type) => {
    const now = type.getProperty('now');
    if (!now || type.getCallSignatures().length === 0) return false;
    return checker
      .getTypeOfSymbol(now)
      .getCallSignatures()
      .some((sig) => isTask(sig.getReturnType()));
  };
  return { typeOf, isTask, isTimed };
}

/** `'blocking'` (waits), `'now'` (starts without waiting), `'step'` (a step function) or null. */
function callKind(node, tracker, types) {
  const callee = unwrap(node.type === 'TaggedTemplateExpression' ? node.tag : node.callee);
  if (tracker.isScript && callee.type === 'Identifier' && tracker.stepNames().has(callee.name)) return 'step';
  if (!types) return null;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    const name = callee.property.name;
    if (name === 'now' && types.isTimed(types.typeOf(callee.object))) return 'now';
    if (name === 'wait' && node.type === 'CallExpression' && types.isTask(types.typeOf(callee.object))) return 'blocking';
  }
  return types.isTimed(types.typeOf(callee)) ? 'blocking' : null;
}

const noUnwaitedTimedCall = {
  meta: {
    type: 'problem',
    docs: { description: 'Timed actions and step functions must be called where a handler waits for them.' },
    schema: [],
    messages: {
      inUpdate:
        '`{{name}}` is a timed action, and onUpdate runs every frame without waiting, so it would throw at runtime. ' +
        'Start a sequence with `background(() => { … })` from a check that runs once.',
      stepInUpdate:
        '`{{name}}` is a step function (its lines wait for each other), and onUpdate runs every frame without waiting. ' +
        'Call it from `background(() => { … })` from a check that runs once.',
      notInHandler:
        "`{{name}}` waits, but this function isn't a handler or a top-level helper, so nothing waits for it: it starts and the code carries on. " +
        'Call it from a handler, or use `.now(…)` to start it without waiting.',
      stepNotInHandler:
        "`{{name}}` is a step function (its lines wait for each other), but this function isn't a handler or a top-level helper, so nothing waits for it. " +
        'Call it from a handler, or use a `for…of` loop instead of a callback.',
      notOwnLine:
        "`{{name}}` only waits when it is a line of its own; inside an expression it starts and the line carries on. " +
        'Put it on its own line (`if (…) { … }` instead of `&&` or `?:`), or use `.now(…)` to start it without waiting.',
    },
  },
  create(context) {
    const tracker = stepTracker(context);
    const types = typeTools(context);
    const check = (node) => {
      const kind = callKind(node, tracker, types);
      if (!kind) return;
      const callee = node.type === 'TaggedTemplateExpression' ? node.tag : node.callee;
      const data = { name: context.sourceCode.getText(callee) };
      if (inUpdate(node, tracker.isStepFunction)) {
        context.report({ node, messageId: kind === 'step' ? 'stepInUpdate' : 'inUpdate', data });
        return;
      }
      const fn = enclosingFunction(node);
      if (!fn || !tracker.isStepFunction(fn)) {
        if (kind !== 'now') context.report({ node, messageId: kind === 'step' ? 'stepNotInHandler' : 'notInHandler', data });
        return;
      }
      if (kind === 'blocking' && !isStatementLevel(node)) context.report({ node, messageId: 'notOwnLine', data });
    };
    return {
      ...tracker.visitors,
      CallExpression(node) {
        tracker.visitors.CallExpression(node);
        check(node);
      },
      TaggedTemplateExpression: check,
    };
  },
};

const noAwaitInStep = {
  meta: {
    type: 'problem',
    docs: { description: "Handlers and helpers don't use `await`: every line already waits." },
    schema: [],
    messages: {
      await:
        "BenneScript lines already wait for each other, so `await` isn't needed here, and on a timed action it stops the line from waiting " +
        '(`await walkTo(p)` returns at once). Remove the `await`.',
    },
  },
  create(context) {
    const tracker = stepTracker(context);
    if (!tracker.isScript) return {};
    return {
      ...tracker.visitors,
      AwaitExpression(node) {
        const fn = enclosingFunction(node);
        if (fn && tracker.isStepFunction(fn)) context.report({ node, messageId: 'await' });
      },
    };
  },
};

const plugin = {
  meta: { name: 'bennescript' },
  rules: {
    'no-unwaited-timed-call': noUnwaitedTimedCall,
    'no-await-in-step': noAwaitInStep,
  },
};

/**
 * The flat-config block for a game: every `.ts` file under `src/game/` except the generated handle
 * modules, parsed with type information.
 * @param {{ parser: unknown, tsconfigRootDir: string }} options typescript-eslint's parser, and the
 *   folder of the game's `tsconfig.json`
 */
export function gameScriptsConfig({ parser, tsconfigRootDir }) {
  return {
    files: ['src/game/**/*.ts'],
    ignores: ['src/game/**/*.ids.ts'],
    languageOptions: { parser, parserOptions: { projectService: true, tsconfigRootDir } },
    plugins: { bennescript: plugin },
    rules: {
      'bennescript/no-unwaited-timed-call': 'error',
      'bennescript/no-await-in-step': 'error',
    },
  };
}

export default plugin;
