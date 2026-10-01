const { contextBridge, ipcRenderer } = require('electron');

// Expose specific capabilities, never the raw IPC or Node APIs.
contextBridge.exposeInMainWorld('benneDesktop', {
  environment: 'electron',
  quit: () => ipcRenderer.send('benne:quit'),
});
