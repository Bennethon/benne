/**
 * Template-specific tests follow the template in `src/game` (whatever `set-template` last swapped
 * in). Each suite keeps them in a folder per template:
 * - unit tests, `tests/unit/<template>/`: `npm test` runs the shared tests plus the active
 *   template's (`vitest.config.ts`);
 * - extension tests, `benne-editor/src/test/<template>/`: likewise (`benne-editor/.vscode-test.mjs`);
 * - playthroughs, `tests/playthrough/<template>/`: `npm run test:playthrough` plays the active
 *   template on a dev server over `src/game`, and `npm run test:templates` plays every template
 *   that has tests, each in its own workspace (`scripts/template-workspace.mjs`).
 *
 * Paths are relative to the repo root, where the runners start.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** A template's playthrough tests. */
export const testsDir = (template: string): string => path.join('tests/playthrough', template);

/** The template in `src/game`: `name` in its `game-config.json`. */
export function activeTemplate(): string {
  const config = JSON.parse(readFileSync('src/game/game-config.json', 'utf8')) as { name?: unknown };
  if (typeof config.name !== 'string' || !config.name) {
    throw new Error('src/game/game-config.json has no "name"; it must name the active game template.');
  }
  return config.name;
}

/** Templates in `game-templates/` that have a `tests/playthrough/<template>/` folder, sorted. */
export function testedTemplates(): string[] {
  return readdirSync('game-templates', { withFileTypes: true })
    .filter((e) => e.isDirectory() && !/^[._]/.test(e.name) && existsSync(testsDir(e.name)))
    .map((e) => e.name)
    .sort();
}

/**
 * The game folder being played, for specs that read its content (e.g. room scripts). Set by
 * `playwright.playthrough.config.ts` to `src/game`; under `test:templates` it is the template
 * folder, which the template's workspace copies.
 */
export const gameDir = (template: string): string =>
  path.resolve(process.env.BENNE_PLAYTHROUGH_GAME_DIR ?? path.join('game-templates', template));
