/**
 * Verbs from `game-config.json` (docs/bennescript-ergonomics-refactor.md §8). Shared by the handle
 * generator and validate-content, so both apply the same rules:
 * - `usesItem` defaults to `true` for verbs with a `preposition` (decision 7);
 * - the game-level `defaultVerb` defaults to `look` when the game has it, else the first verb
 *   (decision 8);
 * - reserved verb IDs and verbs whose generated method names collide are errors (§8.3).
 */
import { camelCaseId, pascalCaseId } from './benneNames.mjs';

/** Engine defaults when `verbs` is missing or empty (`DEFAULT_VERBS` in src/engine/verbs/verbConfig.ts). */
export const ENGINE_DEFAULT_VERBS = [
  { id: 'look', label: 'Look at' },
  { id: 'use', label: 'Use', preposition: 'with' },
];

/** Literals an `inputProfile` slot accepts besides a verb ID. */
export const INPUT_PROFILE_TOKENS = ['walkTo', 'defaultVerb'];

/** Verb IDs that can't be used, and why (§8.3). */
export const RESERVED_VERB_IDS = new Map([
  ['walkTo', 'it is the engine\'s built-in walk token for `inputProfile`'],
  ['defaultVerb', 'it is the `inputProfile` token for a target\'s default verb'],
  ['item', 'its method `onItem` is a built-in handle method (any item verb)'],
  ['anyItem', 'its method `onAnyItem` is a built-in handle method'],
  ['combine', 'its method `onCombine` is a built-in item handle method'],
  ['verbItem', 'its method `onVerbItem` is a built-in handle method'],
]);

/**
 * Built-in methods of the handles that get generated verb methods (props, hotspots, characters,
 * items and `fallbacks`). A verb whose `on<Verb>` or `on<Verb>Item` is one of these would replace
 * it, whatever the verb ID's spelling (`verb-item`, `AnyItem`, an item verb `any`).
 */
export const BUILT_IN_HANDLE_METHODS = new Set([
  'on',
  'onVerbItem',
  'onItem',
  'onAnyItem',
  'onCombine',
  'onWithoutArming',
  'onAnyVerb',
  'onItemUnhandled',
  'onUnhandled',
]);

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null);

/**
 * The configured verbs with everything generation needs. Invalid rows (no string `id`) are
 * skipped; {@link verbConfigProblems} reports them.
 * @param {unknown} config Parsed `game-config.json`.
 */
export function effectiveVerbs(config) {
  const rows = object(config) && Array.isArray(config.verbs) && config.verbs.length > 0 ? config.verbs : ENGINE_DEFAULT_VERBS;
  const out = [];
  for (const row of rows) {
    if (!object(row) || typeof row.id !== 'string' || row.id.length === 0) continue;
    const preposition = nonEmpty(row.preposition);
    const usesItem = typeof row.usesItem === 'boolean' ? row.usesItem : preposition !== null;
    const pascal = pascalCaseId(row.id);
    out.push({
      id: row.id,
      label: nonEmpty(row.label) ?? row.id,
      preposition,
      usesItem,
      /** Key in the `verbs` namespace. */
      name: camelCaseId(row.id),
      method: `on${pascal}`,
      itemMethod: usesItem ? `on${pascal}Item` : null,
    });
  }
  return out;
}

/**
 * Game-level default verb (decision 8): `config.defaultVerb` when it names a configured verb, else
 * `look` when configured, else the first verb.
 * @param {unknown} config
 * @param {ReturnType<typeof effectiveVerbs>} [verbs]
 */
export function gameDefaultVerb(config, verbs = effectiveVerbs(config)) {
  const ids = verbs.map((v) => v.id);
  const configured = object(config) ? nonEmpty(config.defaultVerb) : null;
  if (configured && ids.includes(configured)) return configured;
  if (ids.includes('look')) return 'look';
  return ids[0] ?? null;
}

/**
 * Problems with the verb configuration itself, as `{ field, message }` (field relative to
 * `game-config.json`). Empty when the config is usable.
 * @param {unknown} config
 */
export function verbConfigProblems(config) {
  const problems = [];
  if (!object(config)) return problems;
  const add = (field, message) => problems.push({ field, message });
  if (config.verbs !== undefined && !Array.isArray(config.verbs)) add('verbs', 'Expected an array of verbs');
  const rows = Array.isArray(config.verbs) ? config.verbs : [];
  /** @type {Map<string, string>} generated name → verb ID that produced it */
  const generated = new Map();
  const claim = (name, verbId, field) => {
    const other = generated.get(name);
    if (other !== undefined && other !== verbId) {
      add(field, `Verbs "${other}" and "${verbId}" both generate \`${name}\`. Rename one of them.`);
    } else {
      generated.set(name, verbId);
    }
  };
  const seen = new Set();
  rows.forEach((row, i) => {
    const at = `verbs[${i}]`;
    if (!object(row)) return;
    const id = row.id;
    if (typeof id !== 'string' || !id) return; // validate-content's ID check reports these.
    if (seen.has(id)) return; // and duplicates.
    seen.add(id);
    const reason = RESERVED_VERB_IDS.get(id);
    if (reason) add(`${at}.id`, `Verb ID "${id}" is reserved: ${reason}.`);
    if (!/^[A-Za-z]/.test(id) || pascalCaseId(id).length === 0) {
      add(`${at}.id`, `Verb ID "${id}" must start with a letter.`);
      return;
    }
    if (row.usesItem !== undefined && typeof row.usesItem !== 'boolean') add(`${at}.usesItem`, 'Expected true or false');
    const [verb] = effectiveVerbs({ verbs: [row] });
    if (!reason) {
      for (const method of [verb.method, verb.itemMethod]) {
        if (method && BUILT_IN_HANDLE_METHODS.has(method)) {
          add(`${at}.id`, `Verb "${id}" generates \`${method}\`, a built-in handle method. Rename the verb.`);
        }
      }
    }
    claim(verb.method, id, `${at}.id`);
    if (verb.itemMethod) claim(verb.itemMethod, id, `${at}.id`);
    claim(`verbs.${verb.name}`, id, `${at}.id`);
  });
  const ids = new Set(effectiveVerbs(config).map((v) => v.id));
  if (config.defaultVerb !== undefined && !ids.has(config.defaultVerb)) {
    add('defaultVerb', `Unknown verb: ${config.defaultVerb}`);
  }
  if (object(config.inputProfile)) {
    for (const slot of ['primaryButtonVerb', 'secondaryButtonVerb']) {
      const value = config.inputProfile[slot];
      if (value !== undefined && !ids.has(value) && !INPUT_PROFILE_TOKENS.includes(value)) {
        add(`inputProfile.${slot}`, `Unknown verb: ${value} (expected a verb ID, "walkTo" or "defaultVerb")`);
      }
    }
  }
  return problems;
}
