// Entry of the TypeScript server plugin bundle (`dist/room-script-id-ts-plugin.js`, loaded by tsserver
// through `ts-plugin/index.js`). The plugin itself is in `./tsServerPlugin`.
import { init } from './tsServerPlugin';

export = init;
