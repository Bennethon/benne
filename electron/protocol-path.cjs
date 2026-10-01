const path = require('node:path');

// Only serve files inside the production build, on our one local origin.
function resolveGamePath(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'benne:' || url.host !== 'game' || url.username || url.password) {
    throw new Error('Unknown game origin');
  }
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid path');
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Path outside game build');
  }
  return file;
}

module.exports = { resolveGamePath };
