import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function runGenerateGameIds(): void {
  execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

/** Regenerates `src/types/generated/benne-game-ids.d.ts` during dev/build when game content changes. */
export function benneGenerateGameIdsPlugin(): Plugin {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRegenerate = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      runGenerateGameIds();
    }, 300);
  };

  return {
    name: 'benne-generate-game-ids',
    buildStart() {
      runGenerateGameIds();
    },
    configureServer(server) {
      const gameContentPattern = /[/\\]src[/\\]game[/\\]/;
      const relevantExt = /\.(json|ts)$/;

      const onGameContentChange = (file: string): void => {
        if (gameContentPattern.test(file) && relevantExt.test(file)) {
          scheduleRegenerate();
        }
      };

      server.watcher.on('change', onGameContentChange);
      server.watcher.on('add', onGameContentChange);
      server.watcher.on('unlink', onGameContentChange);
    },
  };
}
