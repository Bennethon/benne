#!/usr/bin/env node
// @ts-check
/**
 * Builds a throwaway game workspace that plays one of `game-templates/` on this repo's engine,
 * without touching `src/game`: the engine, scripts and root configs are copied as
 * `test:artifacts` copies them, the template becomes `src/game`, and `node_modules` is a symlink.
 *
 *   node scripts/template-workspace.mjs <template>               create or refresh, print its path
 *   node scripts/template-workspace.mjs <template> --serve <port> …then run the Vite dev server there
 *
 * Refreshing replaces the copied sources, so edits to the template or the engine show up on the
 * next run. `npm run test:templates` uses `--serve`.
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const [template, flag, port] = process.argv.slice(2);
if (!template || (flag && (flag !== '--serve' || !port))) {
  console.error('Usage: node scripts/template-workspace.mjs <template> [--serve <port>]');
  process.exit(2);
}
const source = path.join(repo, 'game-templates', template);
const root = path.join(tmpdir(), `benne-template-${template}`);

await readdir(source).catch(() => {
  console.error(`No template "${template}" in game-templates/.`);
  process.exit(2);
});

for (const dir of ['src', 'scripts']) {
  await rm(path.join(root, dir), { recursive: true, force: true });
}
await mkdir(root, { recursive: true });
await cp(path.join(repo, 'src'), path.join(root, 'src'), {
  recursive: true,
  filter: (from) => !from.startsWith(path.join(repo, 'src', 'game')),
});
await cp(path.join(repo, 'scripts'), path.join(root, 'scripts'), { recursive: true });
for (const entry of await readdir(repo)) {
  if (/^(package.*\.json|tsconfig\.json|vite.*\.(ts|mjs)|.*\.html)$/.test(entry)) {
    await cp(path.join(repo, entry), path.join(root, entry));
  }
}
await cp(source, path.join(root, 'src', 'game'), { recursive: true });
await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  .catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });

if (flag !== '--serve') {
  console.log(root);
  process.exit(0);
}

const run = (command, args) =>
  spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
const generate = run('node', ['scripts/generate-game-ids.mjs']);
generate.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const vite = run('npx', ['vite', '--host', '127.0.0.1', '--port', port, '--strictPort']);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => vite.kill(signal));
  vite.on('exit', (c) => process.exit(c ?? 0));
});
