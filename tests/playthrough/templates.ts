/**
 * Which game the playthrough tests play. Each game template's tests live in
 * `tests/playthrough/<template>/`:
 * - `npm run test:playthrough` plays the template in `src/game` (whatever `set-template` last
 *   swapped in), on a dev server over `src/game`;
 * - `npm run test:templates` plays every template that has tests, each in its own workspace
 *   (`scripts/template-workspace.mjs`), so `src/game` is never touched.
 *
 * Paths are relative to the repo root, where Playwright runs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

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
