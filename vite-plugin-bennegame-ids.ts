import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

/** Runs the generator; throws with its error output when it fails (name collisions etc.). */
function runGenerateGameIds(): void {
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-game-ids.mjs')], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'pipe'],
    encoding: 'utf8',
  });
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const errors = result.stderr
      .split('\n')
      .filter((line) => line.includes('error'))
      .join('\n');
    throw new Error(errors || `generate-game-ids exited with ${result.status}`);
  }
}

/**
 * Regenerates `src/types/generated/benne-game-ids.d.ts` and the BenneScript handle modules
 * (`src/game/game.ids.ts`, `src/game/<kind>/<id>/<id>.ids.ts`) during dev/build when game content
 * changes. A failed build start fails the build; in dev, a failure shows in the error overlay and
 * the previous modules stay in place.
 */
export function benneGenerateGameIdsPlugin(): Plugin {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRegenerate = (server: ViteDevServer): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      try {
        runGenerateGameIds();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        server.config.logger.error(message);
        server.ws.send({ type: 'error', err: { message, stack: '', plugin: 'benne-generate-game-ids' } });
      }
    }, 300);
  };

  return {
    name: 'benne-generate-game-ids',
    buildStart() {
      runGenerateGameIds();
    },
    configureServer(server) {
      const gameContentPattern = /[/\\]src[/\\]game[/\\]/;
      const relevantExt = /\.(json|ts|mp3|ogg|wav|m4a|mp4|webm)$/i;
      // The generator's own output: reacting to it would only regenerate the same thing.
      const generatedOutput = /\.ids\.ts$/;

      const onGameContentChange = (file: string): void => {
        if (gameContentPattern.test(file) && relevantExt.test(file) && !generatedOutput.test(file)) {
          scheduleRegenerate(server);
        }
      };

      server.watcher.on('change', onGameContentChange);
      server.watcher.on('add', onGameContentChange);
      server.watcher.on('unlink', onGameContentChange);
    },
  };
}
