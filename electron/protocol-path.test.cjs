const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveGamePath } = require('./protocol-path.cjs');
const root = path.resolve('dist');

test('resolves entry point and encoded asset filenames', () => {
  assert.equal(resolveGamePath(root, 'benne://game/'), path.join(root, 'index.html'));
  assert.equal(resolveGamePath(root, 'benne://game/assets/room%20one.png'), path.join(root, 'assets/room one.png'));
});

test('rejects foreign origins, malformed paths, and encoded traversal', () => {
  for (const url of [
    'https://game/index.html', 'benne://other/index.html', 'benne://user@game/index.html',
    'benne://game/%2e%2e%2fpackage.json', 'benne://game/..%5cpackage.json',
    'benne://game/%00', 'benne://game/%ZZ',
  ]) assert.throws(() => resolveGamePath(root, url), url);
});
