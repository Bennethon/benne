const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const info = require('./electron/game-info.cjs');

const iconIco = path.join(info.root, '.benne/desktop-build/icon.ico');
const itchManifest = path.join(info.root, '.benne/desktop-build/.itch.toml');
const electronVersion = require('electron/package.json').version;
const archiveName = `electron-v${electronVersion}-win32-x64.zip`;
const cacheRoot = process.env.ELECTRON_CACHE || path.join(os.homedir(), '.cache/electron');
function findCachedArchive() {
  try {
    const directories = [cacheRoot, ...fs.readdirSync(cacheRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => path.join(cacheRoot, entry.name))];
    return directories.map(dir => path.join(dir, archiveName)).find(file => fs.existsSync(file));
  } catch {
    return undefined;
  }
}
const cachedArchive = findCachedArchive();

module.exports = {
  appId: `games.benne.${info.slug.replace(/-/g, '.')}`,
  productName: info.displayName,
  directories: { output: 'releases/windows', buildResources: '.benne/desktop-build' },
  files: ['dist/**/*', 'electron/main.cjs', 'electron/preload.cjs', 'electron/protocol-path.cjs',
    'electron/game-info.cjs', 'src/game/game-config.json', 'package.json', '!node_modules/**/*'],
  extraFiles: [{ from: itchManifest, to: '.itch.toml' }],
  ...(info.hasIcon ? { extraResources: [{ from: info.iconPath, to: 'icon.png' }] } : {}),
  asar: true,
  npmRebuild: false,
  ...(process.env.BENNE_ELECTRON_DIST || cachedArchive
    ? { electronDist: process.env.BENNE_ELECTRON_DIST || cachedArchive } : {}),
  win: {
    target: ['zip'],
    ...(info.hasIcon && fs.existsSync(iconIco) ? { icon: iconIco } : {}),
    executableName: info.executableName,
    signExecutable: false,
    artifactName: `${info.slug}-\${version}-windows-\${arch}.\${ext}`,
  },
};
