import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.benne/desktop-build');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const slug = String(pkg.name || 'benne-game').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'benne-game';
const displayName = typeof pkg.benne?.displayName === 'string' && pkg.benne.displayName.trim()
  ? pkg.benne.displayName.trim()
  : slug.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
const executableName = displayName.replace(/[<>:"/\\|?*]/g, '').trim() || slug;

await mkdir(output, { recursive: true });
await writeFile(path.join(output, '.itch.toml'), `[[actions]]\nname = "play"\npath = ${JSON.stringify(`${executableName}.exe`)}\n`);

const iconPath = path.join(root, 'src/game/assets/images/icon.png');
try {
  await access(iconPath);
} catch {
  await rm(path.join(output, 'icon.ico'), { force: true });
  console.log('No icon.png found; packaging with Electron’s default icon.');
  process.exit(0);
}

const [{ default: pngToIco }, { PNG }] = await Promise.all([import('png-to-ico'), import('pngjs')]);
const source = PNG.sync.read(await readFile(iconPath));
const size = Math.max(source.width, source.height);
const square = new PNG({ width: size, height: size });
square.data.fill(0);
PNG.bitblt(source, square, 0, 0, source.width, source.height,
  Math.floor((size - source.width) / 2), Math.floor((size - source.height) / 2));
const icon = await pngToIco(PNG.sync.write(square), { interpolation: 'nearestNeighbor' });
await writeFile(path.join(output, 'icon.ico'), icon);
console.log('Prepared Windows icon.');
