/**
 * The game's flags and variables, with their defaults. `@game` re-exports `flags` and `vars`, so
 * scripts write `flags.unlockedDoor = true` and read `if (flags.unlockedDoor)`. Both are saved.
 */
import { defineFlags, defineVars } from '@benne/script';

export const flags = defineFlags({});

export const vars = defineVars({});
