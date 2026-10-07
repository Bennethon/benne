import { mkdtemp, cp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), 'benne-browser-'));
let server;
async function cleanup() { await server?.close(); await rm(root, { recursive: true, force: true }); }
try {
  for (const dir of ['src/engine', 'src/types', 'scripts']) await cp(path.join(repo, dir), path.join(root, dir), { recursive: true });
  await cp(path.join(repo, 'vite-plugin-bennescript.ts'), path.join(root, 'vite-plugin-bennescript.ts'));
  await cp(path.join(repo, 'tests/fixtures/game'), path.join(root, 'src/game'), { recursive: true });
  await cp(path.join(repo, 'src/game/boot'), path.join(root, 'src/game/boot'), { recursive: true });
  await cp(path.join(repo, 'src/style.css'), path.join(root, 'src/style.css'));
  await cp(path.join(repo, 'tests/support/browser-entry.ts'), path.join(root, 'src/main.ts'));
  await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  // The BenneScript handles (`@game`, `./a.ids`) for the fixture game, as `npm run dev` generates them.
  const generated = spawnSync(process.execPath, ['scripts/generate-game-ids.mjs', '--quiet'], { cwd: root, encoding: 'utf8' });
  if (generated.status !== 0) throw new Error(`generate-game-ids failed:\n${generated.stdout}${generated.stderr}`);
  const { benneScriptPlugin } = await import(pathToFileURL(path.join(root, 'vite-plugin-bennescript.ts')).href);
  await writeFile(path.join(root, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>BENNE regression</title><link rel="icon" href="data:,"></head><body><div id="game-container"></div><script type="module" src="/src/main.ts"></script></body></html>');
  server = await createServer({ configFile: false, root, plugins: [benneScriptPlugin()], resolve: { alias: { '@engine': path.join(root, 'src/engine'), '@benne/script': path.join(root, 'src/engine/bennescript/index.ts'), '@game': path.join(root, 'src/game/game.ids.ts'), phaser: path.join(repo, 'node_modules/phaser/dist/phaser.esm.js') } }, server: { host: '127.0.0.1', port: 4178, strictPort: true, hmr: false, fs: { allow: [root, repo] } } });
  await server.listen();
  console.log('BENNE fixture ready at http://127.0.0.1:4178');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void cleanup().then(() => process.exit(0)); });
} catch (error) { await cleanup(); throw error; }
