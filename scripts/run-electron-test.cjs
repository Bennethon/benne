// Own the profile outside Electron: Windows keeps Chromium files locked during app's quit event.
const { spawn, spawnSync } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'benne-electron-test-'));
  let timedOut = false;
  try {
    const child = spawn(require('electron'), process.argv.slice(2), {
      stdio: 'inherit', env: { ...process.env, BENNE_TEST_PROFILE: profile },
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      console.error('Electron test did not exit within 75 seconds.');
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else child.kill('SIGKILL');
    }, 75000);
    try {
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (exitCode) => resolve(exitCode));
      });
      process.exitCode = timedOut || code !== 0 ? 1 : 0;
    } finally { clearTimeout(timeout); }
  } finally {
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
