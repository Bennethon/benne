#!/usr/bin/env node
// @ts-check
/**
 * Starts and stops the VS Code that the website guides' screenshots are taken in
 * (docs/doc-screenshots.md): the BENNE Editor VSIX in VS Code 1.140, on a fresh copy of the 9-verb
 * template, in a 1600×1000 window at 2× on its own display so it never covers the desktop.
 *
 *   node scripts/doc-screenshots/rig.mjs start [--vsix <path>] [--template <name>]
 *   node scripts/doc-screenshots/rig.mjs stop
 *
 * Everything lives in $TMPDIR/benne-doc-shots/: the game (`my-adventure`, the name in the title
 * bar), the VS Code profile and extensions, `rig.json` with the process ids, and `shots/`.
 * `start` rebuilds all of it except `shots/`, so every session begins from the same state.
 *
 * Linux only. Under Wayland it opens a rootful Xwayland on :97 (on Hyprland, sent to workspace 9
 * so it stays out of view); otherwise it uses Xvfb.
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, MAIN_PORT, RENDERER_PORT, resizeAndMute, STATE_DIR } from './cdp.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const VSCODE_VERSION = '1.140.0';
const DISPLAY = ':97';
const STATE_FILE = path.join(STATE_DIR, 'rig.json');
const workspace = path.join(STATE_DIR, 'my-adventure');
const profile = path.join(STATE_DIR, 'profile');
const extensions = path.join(STATE_DIR, 'extensions');

// The settings the screenshots were taken with: VS Code's default theme and layout, without the
// welcome page, minimap, sticky scroll, AI features or update prompts.
const SETTINGS = {
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.welcomePage.walkthroughs.openOnInstall': false,
  'workbench.view.alwaysShowHeaderActions': true,
  'workbench.layoutControl.enabled': false,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.ignoreRecommendations': true,
  'security.workspace.trust.enabled': false,
  'window.restoreWindows': 'none',
  'window.titleBarStyle': 'custom',
  'chat.disableAIFeatures': true,
  'chat.commandCenter.enabled': false,
  'editor.minimap.enabled': false,
  'editor.stickyScroll.enabled': false,
  'git.enabled': false,
  'typescript.tsdk': 'node_modules/typescript/lib',
};

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const has = (/** @type {string} */ cmd) => {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function alive(/** @type {number} */ pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stop() {
  const state = readState();
  for (const name of ['vscode', 'display']) {
    const pid = state[name];
    if (pid && alive(pid)) {
      // Each was started in its own process group; end the group so VS Code's helpers go too.
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        process.kill(pid, 'SIGTERM');
      }
      for (let i = 0; i < 20 && alive(pid); i++) await sleep(250);
      console.log(`Stopped ${name} (${pid}).`);
    }
  }
  rmSync(STATE_FILE, { force: true });
}

/** The newest benne-editor VSIX, with a warning when the extension's source is newer. */
function newestVsix() {
  const dir = path.join(repo, 'benne-editor');
  const vsixes = readdirSync(dir)
    .filter((f) => f.endsWith('.vsix'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!vsixes.length) throw new Error('No benne-editor/*.vsix. Build one with `npm run package:extension:no-bump`.');
  const built = statSync(vsixes[0]).mtimeMs;
  const newer = (/** @type {string} */ d) =>
    readdirSync(d, { withFileTypes: true }).some((e) =>
      e.isDirectory() ? newer(path.join(d, e.name)) : statSync(path.join(d, e.name)).mtimeMs > built,
    );
  if (newer(path.join(dir, 'src')) || newer(path.join(dir, 'media'))) {
    console.warn(`Warning: benne-editor has changed since ${path.basename(vsixes[0])} was built. Run \`npm run package:extension:no-bump\` to screenshot the current editor.`);
  }
  return vsixes[0];
}

/** A game folder like a new player's: the engine, the template as src/game, outlines off. */
function makeWorkspace(/** @type {string} */ template) {
  const source = path.join(repo, 'game-templates', template);
  if (!existsSync(source)) throw new Error(`No template "${template}" in game-templates/.`);
  mkdirSync(workspace, { recursive: true });
  cpSync(path.join(repo, 'src'), path.join(workspace, 'src'), {
    recursive: true,
    filter: (from) => !from.startsWith(path.join(repo, 'src', 'game')),
  });
  cpSync(path.join(repo, 'scripts'), path.join(workspace, 'scripts'), { recursive: true });
  for (const entry of readdirSync(repo)) {
    if (/^(package.*\.json|tsconfig\.json|vite.*\.(ts|mjs)|.*\.html)$/.test(entry)) {
      cpSync(path.join(repo, entry), path.join(workspace, entry));
    }
  }
  cpSync(source, path.join(workspace, 'src', 'game'), { recursive: true });
  symlinkSync(path.join(repo, 'node_modules'), path.join(workspace, 'node_modules'), 'dir');
  execFileSync(process.execPath, ['scripts/generate-game-ids.mjs', '--quiet'], { cwd: workspace, stdio: 'inherit' });

  // The screenshots show the game as players see it, even if a template is saved with debug outlines on.
  const configFile = path.join(workspace, 'src', 'game', 'game-config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8'));
  for (const k of Object.keys(config.debug ?? {})) config.debug[k] = false;
  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
}

function startDisplay() {
  const wayland = process.env.WAYLAND_DISPLAY && has('Xwayland');
  if (!wayland && !has('Xvfb')) throw new Error('Needs Xwayland (under Wayland) or Xvfb.');
  if (wayland && process.env.HYPRLAND_INSTANCE_SIGNATURE && has('hyprctl')) {
    // Lua config (Hyprland 0.5x), then the older keyword syntax; whichever this Hyprland takes.
    const rule = 'hl.window_rule({ match = { title = "^Xwayland on :97$" }, workspace = "9 silent" })';
    try {
      execFileSync('hyprctl', ['eval', rule], { stdio: 'ignore' });
    } catch {
      execFileSync('hyprctl', ['keyword', 'windowrulev2', 'workspace 9 silent,title:^(Xwayland on :97)$'], { stdio: 'ignore' });
    }
  }
  const [cmd, args] = wayland
    ? ['Xwayland', [DISPLAY, '-geometry', '3200x2000', '-noreset']]
    : ['Xvfb', [DISPLAY, '-screen', '0', '3200x2000x24', '-noreset']];
  const proc = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  proc.unref();
  return proc.pid;
}

async function start(/** @type {string[]} */ args) {
  const opt = (/** @type {string} */ name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  await stop();
  for (const dir of [workspace, profile, extensions]) rmSync(dir, { recursive: true, force: true });
  mkdirSync(STATE_DIR, { recursive: true });

  makeWorkspace(opt('--template') ?? '9-verb');
  mkdirSync(path.join(profile, 'User'), { recursive: true });
  writeFileSync(path.join(profile, 'User', 'settings.json'), JSON.stringify(SETTINGS, null, 2) + '\n');

  // VS Code 1.140, from the same cache as the extension tests.
  const require = createRequire(path.join(repo, 'benne-editor', 'package.json'));
  const { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } = require('@vscode/test-electron');
  const code = await downloadAndUnzipVSCode({ version: VSCODE_VERSION, cachePath: path.join(repo, 'benne-editor', '.vscode-test') });
  // VS Code's own terminals set these, and they would make Electron act as Node or talk to that VS Code.
  const env = { ...process.env };
  for (const k of ['ELECTRON_RUN_AS_NODE', 'VSCODE_IPC_HOOK_CLI', 'ELECTRON_OZONE_PLATFORM_HINT']) delete env[k];

  const vsix = opt('--vsix') ?? newestVsix();
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(code);
  execFileSync(cli, [...cliArgs, `--user-data-dir=${profile}`, `--extensions-dir=${extensions}`, '--install-extension', vsix], { env, stdio: 'ignore' });
  console.log(`Installed ${path.relative(repo, vsix)}.`);

  const display = startDisplay();
  await sleep(1500);
  delete env.WAYLAND_DISPLAY;
  env.DISPLAY = DISPLAY;
  const vscode = spawn(
    code,
    [
      '--ozone-platform=x11',
      '--force-device-scale-factor=2',
      `--remote-debugging-port=${RENDERER_PORT}`,
      `--inspect=${MAIN_PORT}`,
      `--user-data-dir=${profile}`,
      `--extensions-dir=${extensions}`,
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--new-window',
      workspace,
    ],
    { env, detached: true, stdio: 'ignore' },
  );
  vscode.unref();
  writeFileSync(STATE_FILE, JSON.stringify({ display, vscode: vscode.pid }, null, 2));

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://localhost:${RENDERER_PORT}/json/list`)).json();
      if (list.some((/** @type {any} */ t) => t.url?.includes('workbench.html'))) break;
    } catch {
      // Not listening yet.
    }
  }
  await sleep(3000);
  const title = await resizeAndMute();
  await sleep(1000);
  const c = await connect();
  try {
    await c.setup();
  } finally {
    c.close();
  }
  console.log(`Ready: ${title}. Shots go to ${path.join(STATE_DIR, 'shots')}.`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'start') await start(rest);
else if (command === 'stop') await stop();
else {
  console.error('Usage: node scripts/doc-screenshots/rig.mjs start [--vsix <path>] [--template <name>] | stop');
  process.exit(2);
}
