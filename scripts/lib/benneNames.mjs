/**
 * Naming rules for generated BenneScript handles (docs/bennescript-ergonomics-refactor.md §7.2,
 * §8.3). Pure functions; the handle generator and validate-content both use them.
 */

/** `club-hotspot-toolChest` → `clubHotspotToolChest`, `what about AI` → `whatAboutAI`, `AI problem` → `aiProblem`. */
export function camelCaseId(id) {
  const parts = String(id).split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return '';
  const [first, ...rest] = parts;
  const head = /^[A-Z0-9]+$/.test(first) ? first.toLowerCase() : first[0].toLowerCase() + first.slice(1);
  return head + rest.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

/** `talkTo` → `TalkTo`, `pick-up` → `PickUp` (verb method names, §8.3). */
export function pascalCaseId(id) {
  return String(id)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

export function isIdentifier(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/** JavaScript / TypeScript words that can't be a binding name in a module. */
export const RESERVED_WORDS = new Set([
  'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'eval', 'export', 'extends', 'false', 'finally', 'for', 'function',
  'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package',
  'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield', 'NaN', 'Infinity',
]);

/**
 * Names a script file already imports from `@benne/script` or `@game`, or that a generated module
 * defines itself (`room`, `points`, `gui`, …). A flat handle with one of these names would shadow
 * it, so it gets a trailing `_` and a warning (§7.2).
 */
export const BENNESCRIPT_NAMES = new Set([
  // @benne/script (§4.1 and the Phase 2 runtime)
  'walkToClicked', 'faceClicked', 'wait', 'waitForClick', 'say', 'display', 'inventory', 'player',
  'camera', 'fadeOut', 'fadeIn', 'cutscene', 'background', 'together', 'withInputDisabled', 'input',
  'unhandled', 'saves', 'settings', 'game', 'pointer', 'playFrom', 'onUpdate', 'defineFlags',
  'defineVars', 'flag', 'Task',
  // @game
  'rooms', 'characters', 'items', 'dialogs', 'guis', 'sfx', 'music', 'video', 'flags', 'vars',
  'verbs', 'fallbacks',
  // generated module names
  'room', 'points', 'regions', 'walkables', 'gui', 'dialog', 'options',
]);

/**
 * Browser globals that a flat handle name shadows inside its module. Legal, but confusing in the
 * debugger (§12), so the generator warns.
 */
export const BROWSER_GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'self', 'top', 'parent',
  'frames', 'name', 'status', 'origin', 'length', 'event', 'open', 'close', 'print', 'alert',
  'confirm', 'prompt', 'fetch', 'console', 'performance', 'localStorage', 'sessionStorage',
]);

/** Kind words stripped after a room prefix (§7.2): `plaza-point-first-visit` → `firstVisit`. */
const ROOM_KIND_WORDS = {
  prop: ['prop'],
  hotspot: ['hotspot'],
  point: ['point'],
  region: ['region'],
  walkable: ['walkable', 'walk'],
};

/**
 * Handle name for an ID inside a room module: a leading `<roomId>-` and kind word are stripped
 * (`club-hotspot-toolChest` → `toolChest`). When what's left doesn't start with a letter
 * (`lab-point-1`), the whole ID is used (`labPoint1`).
 * @param {string} roomId
 * @param {string} id
 * @param {keyof typeof ROOM_KIND_WORDS} kind
 */
export function roomScopedName(roomId, id, kind) {
  const full = camelCaseId(id);
  const prefix = `${roomId}-`;
  if (!id.startsWith(prefix)) return full;
  let rest = id.slice(prefix.length);
  for (const word of ROOM_KIND_WORDS[kind] ?? []) {
    if (rest.startsWith(`${word}-`)) {
      rest = rest.slice(word.length + 1);
      break;
    }
  }
  const stripped = camelCaseId(rest);
  return /^[A-Za-z]/.test(stripped) ? stripped : full;
}
