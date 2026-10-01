const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const gameConfig = require(path.join(root, 'src/game/game-config.json'));
const slug = String(pkg.name || 'benne-game').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'benne-game';
const displayName = typeof pkg.benne?.displayName === 'string' && pkg.benne.displayName.trim()
  ? pkg.benne.displayName.trim()
  : slug.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
const executableName = displayName.replace(/[<>:"/\\|?*]/g, '').trim() || slug;
const iconPath = path.join(root, 'src/game/assets/images/icon.png');
const hasIcon = fs.existsSync(iconPath) || fs.existsSync(path.join(process.resourcesPath || '', 'icon.png'));
const scale = Number.isFinite(pkg.benne?.desktopWindowScale) && pkg.benne.desktopWindowScale > 0
  ? pkg.benne.desktopWindowScale : 3;
const width = Math.max(640, Math.round((gameConfig.resolution?.width || 320) * scale));
const height = Math.max(360, Math.round((gameConfig.resolution?.height || 180) * scale));

module.exports = { root, slug, displayName, executableName, iconPath, hasIcon, width, height };
