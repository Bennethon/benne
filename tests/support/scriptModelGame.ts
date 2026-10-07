/**
 * The game in `src/game` as the editor's BenneScript model sees it, for the ScriptModel tests
 * (`tests/unit/editorScriptModel.test.ts` and each template's own). Handles are generated in
 * memory, so the tests don't depend on gitignored `.ids.ts` files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { IdsIndex } from '../../benne-editor/src/bennescript/idsIndex';
import { parseScriptModel } from '../../benne-editor/src/bennescript/scriptModel';
import { generateGameHandles } from '../../scripts/lib/generateGameHandles.mjs';

export const gameRoot = path.resolve('src/game');

const generated = generateGameHandles(gameRoot);
export const readGenerated = (abs: string): string | undefined => {
  const rel = path.relative(gameRoot, abs).split(path.sep).join('/');
  return generated.files.get(rel);
};
export const index = new IdsIndex(ts, gameRoot, readGenerated);

/** Every BenneScript file in the game, sorted. */
export function scriptFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(room|character|inventory|dialog|gui|script)\.ts$|^globalScript\.ts$/.test(e.name)) out.push(p);
    }
  };
  walk(gameRoot);
  return out.sort();
}

export const model = (file: string) => parseScriptModel(ts, file, readFileSync(file, 'utf8'));
