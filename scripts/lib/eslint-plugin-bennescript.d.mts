/** Types for `eslint-plugin-bennescript.mjs` (the BenneScript ESLint rules, design doc §6.3). */
import type { ESLint, Linter } from 'eslint';

declare const plugin: ESLint.Plugin;
export default plugin;

/** The flat-config block for a game's `src/game/**\/*.ts` (minus `*.ids.ts`), with typed linting. */
export declare function gameScriptsConfig(options: { parser: unknown; tsconfigRootDir: string }): Linter.Config;
