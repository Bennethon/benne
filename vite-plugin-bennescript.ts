import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import {
  BenneScriptTransformError,
  buildSpeakerTable,
  isBenneScriptFile,
  transformBenneScript,
  usesNewBenneScriptApi,
} from './scripts/lib/bennescriptTransform.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const charactersDir = path.join(repoRoot, 'src', 'game', 'characters');

function readCharacters(): Array<{ id: string; name?: string }> {
  if (!fs.existsSync(charactersDir)) {
    return [];
  }
  const out: Array<{ id: string; name?: string }> = [];
  for (const dir of fs.readdirSync(charactersDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(charactersDir, dir.name))) {
      if (!file.endsWith('.character.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(charactersDir, dir.name, file), 'utf8')) as {
          id?: unknown;
          name?: unknown;
        };
        if (typeof data.id === 'string') {
          out.push({ id: data.id, name: typeof data.name === 'string' ? data.name : undefined });
        }
      } catch {
        // validate-content reports broken JSON; speaker labels just won't resolve to it.
      }
    }
  }
  return out;
}

/**
 * BenneScript sequencing transform (docs/bennescript-ergonomics-refactor.md §6). Runs before
 * TypeScript is stripped. Every Vite config that bundles game scripts must include it; the
 * previews and BENNE Play merge `vite.config.ts`, so registering it there covers them.
 */
export function benneScriptPlugin(): Plugin {
  let speakers: ReturnType<typeof buildSpeakerTable> | null = null;
  const speakerTable = () => (speakers ??= buildSpeakerTable(readCharacters()));

  return {
    name: 'benne-bennescript',
    enforce: 'pre',
    configureServer(server) {
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(charactersDir)) {
          speakers = null;
        }
      });
    },
    transform(code, id) {
      if (id.includes('/node_modules/') || !isBenneScriptFile(id) || !usesNewBenneScriptApi(code)) {
        return null;
      }
      const filename = id.replace(/[?#].*$/, '');
      try {
        return transformBenneScript(code, { filename, speakers: speakerTable() });
      } catch (err) {
        if (err instanceof BenneScriptTransformError) {
          this.error({ message: `[BenneScript] ${err.message}`, id: filename, pos: err.pos });
        }
        throw err;
      }
    },
  };
}
