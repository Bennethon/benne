// Run after npm run build. Uses the real wrapper and an isolated, temporary save profile.
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const info = require('../electron/game-info.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'benne-desktop-smoke-'));
app.setAppPath(path.resolve(__dirname, '..'));
const failures = [];
const timeout = setTimeout(() => {
  console.error('Electron smoke test timed out');
  app.exit(1);
}, 30000);

app.on('browser-window-created', (_event, window) => {
  window.webContents.on('console-message', details => {
    if (details.level === 'error') {
      console.error('Game console:', details.message);
      if (details.message.includes('Uncaught')) failures.push(details.message);
    }
  });
  window.webContents.session.webRequest.onErrorOccurred(details => failures.push(details.error + ' ' + details.url));
  window.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const state = await window.webContents.executeJavaScript(`(async () => {
        const canvas = document.querySelector('canvas');
        localStorage.setItem('desktop-smoke', 'ok');
        const saved = localStorage.getItem('desktop-smoke');
        localStorage.removeItem('desktop-smoke');
        return {
          title: document.title,
          width: canvas?.width, height: canvas?.height, saved,
          nodeAvailable: typeof window.require !== 'undefined',
          environment: window.benneDesktop?.environment,
          canQuit: typeof window.benneDesktop?.quit === 'function',
          missing: (await fetch('benne://game/not-a-real-file')).status,
        };
      })()`);
      assert.equal(state.title, info.displayName);
      assert.ok(state.width > 0 && state.height > 0, 'Game canvas must be present');
      assert.equal(state.saved, 'ok');
      assert.equal(state.nodeAvailable, false);
      assert.equal(state.environment, 'electron');
      assert.equal(state.canQuit, true);
      assert.equal(state.missing, 404);
      const frame = await window.webContents.capturePage();
      const pixels = frame.toBitmap();
      const colors = new Set();
      for (let offset = 0; offset + 4 <= pixels.length; offset += 4 * 31) {
        colors.add(pixels.readUInt32LE(offset));
      }
      assert.ok(colors.size > 16, 'Game should render more than a blank canvas');
      // Expected negative requests above may produce Chromium console errors.
      assert.deepEqual(failures.filter(f => !f.includes('404') && !f.includes('not-a-real-file') && !f.includes('benne://other')), []);
      console.log('Electron smoke test passed:', { ...state, renderedColors: colors.size });
      // Exercise the actual preload → main-process quit path, not app.exit().
      await new Promise((resolve, reject) => {
        const quitTimeout = setTimeout(() => reject(new Error('Desktop quit IPC did not reach app.quit')), 3000);
        app.once('before-quit', () => {
          clearTimeout(quitTimeout);
          resolve();
        });
        window.webContents.executeJavaScript('window.benneDesktop.quit()').catch(reject);
      });
    } catch (error) {
      console.error(error, failures);
      app.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  });
});

require('../electron/main.cjs');
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
app.on('quit', () => fs.rmSync(temporary, { recursive: true, force: true }));
