const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, screen } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveGamePath } = require('./protocol-path.cjs');
const info = require('./game-info.cjs');

app.setName(info.displayName);
// Keep save data independent of the install location and subsequent updates.
app.setPath('userData', path.join(app.getPath('appData'), info.slug));
protocol.registerSchemesAsPrivileged([{
  scheme: 'benne',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: info.displayName,
    width: Math.min(info.width, width),
    height: Math.min(info.height, Math.max(360, height - 60)),
    useContentSize: true,
    backgroundColor: '#0f0f1a',
    show: false,
    ...(info.hasIcon ? { icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png') : info.iconPath } : {}),
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === 'Escape' && window.isFullScreen()) {
      event.preventDefault();
      window.setFullScreen(false);
    }
  });
  window.once('ready-to-show', () => window.show());
  await window.loadURL('benne://game/index.html');
}

app.whenReady().then(async () => {
  ipcMain.on('benne:quit', event => {
    // Only our game's top-level frame may close the desktop application.
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || event.senderFrame !== event.sender.mainFrame) return;
    if (event.senderFrame.url !== 'benne://game/index.html') return;
    app.quit();
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const dist = path.join(app.getAppPath(), 'dist');
  protocol.handle('benne', async request => {
    let file;
    try {
      file = resolveGamePath(dist, request.url);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(file).href);
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(showStartupError);
  });
}).catch(showStartupError);

function showStartupError(error) {
  dialog.showErrorBox(`${info.displayName} could not start`, String(error));
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
