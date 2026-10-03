import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  version: process.env.VSCODE_TEST_VERSION || '1.140.0',
  launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  mocha: { timeout: 20000 },
});
