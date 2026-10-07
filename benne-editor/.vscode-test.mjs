import { defineConfig } from '@vscode/test-cli';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const version = process.env.VSCODE_TEST_VERSION || '1.140.0';
let useInstallation;
if (process.platform === 'darwin') {
  let executable = await downloadAndUnzipVSCode(version);
  try { await access(executable); }
  catch {
    // Newer VS Code bundles renamed Electron to Code; test-electron 2.5 still
    // returns the historical path. Keep the old path for the minimum-version job.
    executable = path.join(path.dirname(executable), 'Code');
    await access(executable);
  }
  useInstallation = { fromPath: executable };
}

// Shared tests, plus the tests of the template in ../src/game (its game-config.json `name`); see
// tests/support/templates.ts.
const gameConfig = JSON.parse(await readFile(new URL('../src/game/game-config.json', import.meta.url), 'utf8'));

export default defineConfig({
  files: ['out/test/*.test.js', `out/test/${gameConfig.name}/**/*.test.js`],
  version,
  useInstallation,
  launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  mocha: { timeout: 20000 },
});
