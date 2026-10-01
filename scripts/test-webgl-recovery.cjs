// Uses Chromium with no desktop bridge to exercise the shipped browser entry point.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const startupFailure = process.argv.includes('--startup-failure');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'benne-webgl-test-'));
app.setPath('userData', profile);
let watchdog = setTimeout(() => { console.error('WebGL test timed out'); app.exit(1); }, 45000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1056, height: 594, webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true, webgl: !startupFailure,
  } });
  const errors = [];
  window.webContents.on('console-message', details => {
    if (details.level === 'error') {
      console.error(details.message);
      if (/Uncaught|Graphics failure/.test(details.message)) errors.push(details.message);
    }
  });
  const evaluate = code => window.webContents.executeJavaScript(code);
  const notice = () => evaluate(`(() => {
    const el = document.querySelector('.graphics-notice');
    return { visible: !!el && !el.hidden, text: el?.textContent };
  })()`);
  try {
    await window.loadFile(path.resolve(__dirname, '../dist/index.html'));
    await sleep(3000);
    if (startupFailure) {
      const state = await notice();
      assert.ok(state.visible);
      assert.match(state.text, /Graphics unavailable/);
      assert.match(state.text, /WebGL/);
      assert.equal(await evaluate(`document.activeElement.textContent`), 'Restart game');
      console.log('PASS: unavailable WebGL produces a readable startup message.');
    } else {
      assert.equal((await notice()).visible, false);
      await evaluate(`window.__testPageIdentity = 'same-session';
        window.__testGL = document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl');
        window.__testLose = window.__testGL.getExtension('WEBGL_lose_context');
        if (!window.__testLose) throw new Error('Context loss test extension unavailable');`);
      for (let cycle = 0; cycle < 2; cycle++) {
        await evaluate('window.__testLose.loseContext()');
        await sleep(cycle === 0 ? 16000 : 500);
        const state = await notice();
        assert.ok(state.visible);
        assert.match(state.text, cycle === 0 ? /haven’t recovered/ : /Graphics interrupted/);
        assert.match(state.text, /Unsaved progress will be lost/);
        await evaluate('window.__testLose.restoreContext()');
        await sleep(1500);
        assert.equal((await notice()).visible, false);
        assert.equal(await evaluate('window.__testPageIdentity'), 'same-session');
        const pixels = (await window.webContents.capturePage()).toBitmap();
        const colors = new Set();
        for (let i = 0; i + 4 <= pixels.length; i += 4 * 31) colors.add(pixels.readUInt32LE(i));
        assert.ok(colors.size > 16, 'Restored game must render more than a blank frame');
      }
      assert.deepEqual(errors, []);
      console.log('PASS: timeout message and two real WebGL loss/restore cycles; game renders without reloading.');
    }
    clearTimeout(watchdog);
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
app.on('quit', () => fs.rmSync(profile, { recursive: true, force: true }));
