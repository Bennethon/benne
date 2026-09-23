const fs = require('fs');
const path = require('path');

// npm links this folder into node_modules. Resolve the bundle from the real
// package directory so `main` works both through that symlink and directly.
const packageDir = fs.realpathSync(__dirname);
module.exports = require(path.join(packageDir, '../dist/room-script-id-ts-plugin.js'));
