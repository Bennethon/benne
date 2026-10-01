import { readdir, stat, mkdir, rm, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const slug = String(pkg.name || 'benne-game').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'benne-game';
const archive = path.join(root, 'releases', `${slug}-itch.zip`);

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), `${relative}/`));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Unsupported build entry: ${relative}`);
    }
  }
  return files.sort();
}

await access(path.join(dist, 'index.html'));
const files = await listFiles(dist);
if (files.length > 1000) throw new Error('itch.io allows at most 1,000 files.');
let totalBytes = 0;
for (const file of files) {
  const { size } = await stat(path.join(dist, file));
  if (file.length > 240) throw new Error(`itch.io path is too long: ${file}`);
  if (size > 200_000_000) throw new Error(`itch.io file exceeds 200 MB: ${file}`);
  totalBytes += size;
}
if (totalBytes > 500_000_000) throw new Error('itch.io extracted size exceeds 500 MB.');

const available = spawnSync('zip', ['-v'], { stdio: 'ignore' });
if (available.error || available.status !== 0) {
  throw new Error('Install the zip command-line utility, then run npm run build:itch again.');
}
await mkdir(path.dirname(archive), { recursive: true });
// Remove the previous archive so deleted game assets cannot survive a rebuild.
await rm(archive, { force: true });
const result = spawnSync('zip', ['-q', '-X', archive, ...files], {
  cwd: dist,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || 'ZIP creation failed.');
console.log(`Packaged ${files.length} files (${(totalBytes / 1_000_000).toFixed(1)} MB extracted).`);
console.log(`Upload: ${archive}`);
