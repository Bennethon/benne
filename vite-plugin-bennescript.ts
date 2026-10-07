import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import {
  BenneScriptTransformError,
  buildSpeakerTable,
  isBenneScriptFile,
  transformBenneScript,
} from './scripts/lib/bennescriptTransform.mjs';
import { readCharacterSpeakers } from './scripts/lib/benneSpeakers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const gameRoot = path.join(repoRoot, 'src', 'game');
const charactersDir = path.join(gameRoot, 'characters');

/**
 * BenneScript sequencing transform (docs/bennescript-ergonomics-refactor.md §6). Runs before
 * TypeScript is stripped. Every Vite config that bundles game scripts must include it; the
 * previews and BENNE Play merge `vite.config.ts`, so registering it there covers them.
 */
export function benneScriptPlugin(): Plugin {
  let speakers: ReturnType<typeof buildSpeakerTable> | null = null;
  const speakerTable = () => (speakers ??= buildSpeakerTable(readCharacterSpeakers(gameRoot)));

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
      if (id.includes('/node_modules/') || !isBenneScriptFile(id)) {
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
