import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { RELEASE_TEMPLATES } from './lib/releaseTemplates.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), 'benne-artifacts-'));
const logs = path.join(repo, 'test-results', 'artifacts');
await mkdir(logs, { recursive: true });
let step = 0;
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024, timeout: 300000 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const log = path.join(logs, `${++step}.log`);
  // Synchronous subprocesses are intentionally sequential: builds share output directories.
  return writeFile(log, output).then(() => {
    if (result.error || result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed. ${result.error ?? ''}\n${output.slice(-8000)}\nLog: ${log}`);
    console.log(`PASS ${cmd} ${args.join(' ')}`);
    return output;
  });
}
async function exists(file) { await readFile(file); }
try {
  for (const dir of ['src', 'electron', 'scripts', 'game-templates']) await cp(path.join(repo, dir), path.join(root, dir), { recursive: true });
  for (const entry of await readdir(repo)) if (/^(package.*\.json|tsconfig\.json|vite.*\.(ts|mjs)|.*\.html|electron-builder\.config\.cjs)$/.test(entry)) await cp(path.join(repo, entry), path.join(root, entry));
  await mkdir(path.join(root, 'benne-editor'), { recursive: true });
  for (const entry of ['src', 'ts-plugin', 'media', 'package.json', 'package-lock.json', '.npmrc', 'webpack.config.js', 'tsconfig.json', '.vscodeignore', 'README.md', 'LICENSE']) {
    await cp(path.join(repo, 'benne-editor', entry), path.join(root, 'benne-editor', entry), { recursive: true }).catch(error => { if (entry !== 'LICENSE') throw error; });
  }
  await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // npm/vsce must inspect a real installation rooted in this temporary extension.
  // A directory symlink makes npm resolve dependencies against the source checkout.
  await cp(path.join(repo, 'benne-editor/node_modules'), path.join(root, 'benne-editor/node_modules'), { recursive: true, verbatimSymlinks: true });
  await run('npm', ['run', 'build'], root);
  await run('npm', ['run', 'bundle:scaffold'], root);
  await run('npm', ['run', 'build:previews'], path.join(root, 'benne-editor'));
  await run('npm', ['run', 'package'], path.join(root, 'benne-editor'));
  for (const name of ['room-preview', 'character-preview', 'gui-preview', 'inventory-preview', 'benne-play']) await exists(path.join(root, 'benne-editor/media', name, `${name}.js`));
  for (const file of ['dist/extension.js', 'dist/room-script-id-ts-plugin.js', 'media/inspector/inspector.js', 'media/pdc-editor/pdc-editor.js', 'scaffold/shared/src/engine/Game.ts', 'scaffold/shared/src/engine/content/registerGameContent.ts']) await exists(path.join(root, 'benne-editor', file));
  const scaffold = path.join(root, 'benne-editor/scaffold');
  // Execute the actual package factory, without importing VS Code into the artifact process.
  const source = await readFile(path.join(repo, 'benne-editor/src/scaffoldPayload.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', compiled)(id => id === 'vscode' ? {} : require(id), module, module.exports);
  // Development-only templates (e.g. ai-apocalypse) must never reach the VSIX.
  assert.deepEqual((await readdir(path.join(scaffold, 'templates'))).sort(), Object.keys(RELEASE_TEMPLATES).sort(), 'Scaffold must bundle exactly the release templates');
  // Content loading is engine code (src/engine/content/); a game's src/game/ holds only its own content.
  for (const template of Object.keys(RELEASE_TEMPLATES)) assert.ok(!(await readdir(path.join(scaffold, 'templates', template))).includes('boot'), `Template ${template} must not ship a boot/ folder`);
  for (const template of Object.keys(RELEASE_TEMPLATES)) {
    const game = path.join(root, `standalone-${template}`);
    await cp(path.join(scaffold, 'shared'), game, { recursive: true });
    await cp(path.join(scaffold, 'templates', template), path.join(game, 'src/game'), { recursive: true });
    await writeFile(path.join(game, 'package.json'), module.exports.buildPackageJson(`fixture-${template}`));
    await symlink(path.join(repo, 'node_modules'), path.join(game, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await run('npm', ['run', 'build'], game);
    await run('npm', ['run', 'build:benne-play'], game);
    await exists(path.join(game, '.benne/preview-bundles/benne-play/benne-play.js'));
    await run('npm', ['run', 'test:desktop'], game);
    if (process.platform !== 'win32') {
      await run('node', ['scripts/package-itch.mjs'], game);
      const archive = path.join(game, 'releases', `fixture-${template}-itch.zip`);
      const entries = await run('unzip', ['-Z1', archive], game);
      assert.ok(entries.split('\n').includes('index.html'), 'ZIP entry must be index.html at root');
      assert.ok(!entries.includes('node_modules/'));
    }
  }
  if (process.argv.includes('--vsix')) {
    await run('npm', ['exec', '--', 'vsce', 'package', '--follow-symlinks', '--out', path.join(logs, 'benne-editor.vsix')], path.join(root, 'benne-editor'));
    const list = await run('unzip', ['-Z1', path.join(logs, 'benne-editor.vsix')], root);
    for (const required of ['extension/dist/extension.js', 'extension/dist/room-script-id-ts-plugin.js', 'extension/node_modules/benne-room-id-completions/index.js', 'extension/scaffold/shared/src/engine/Game.ts', 'extension/media/benne-play/benne-play.js']) assert.ok(list.split('\n').includes(required), `VSIX missing ${required}`);
    const installed = path.join(root, 'installed');
    await run('unzip', ['-q', path.join(logs, 'benne-editor.vsix'), '-d', installed], root);
    const installedRequire = createRequire(path.join(installed, 'extension/package.json'));
    assert.equal(typeof installedRequire('benne-room-id-completions'), 'function', 'Installed TypeScript plugin must resolve without development dependencies');
  }
  console.log('Isolated artifact and release-template builds passed.');
} finally { await rm(root, { recursive: true, force: true }); }
