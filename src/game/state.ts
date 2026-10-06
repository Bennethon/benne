/**
 * The game's flags and variables, with defaults (docs/bennescript-ergonomics-refactor.md §4.7).
 * `@game` re-exports `flags` and `vars` from here.
 *
 * Only the café's flags are declared so far; the old scripts still seed the rest in
 * globalScript.ts until they are ported (refactor Phase 4). Keys match the old flag names.
 */
import { defineFlags, defineVars } from '@benne/script';

export const flags = defineFlags({
  canWork: false,
  tookOrder: false,
  deliveredOrder: false,
});

export const vars = defineVars({});
