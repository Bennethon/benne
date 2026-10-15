#!/usr/bin/env node
// @ts-check
/**
 * Runs one step against the VS Code that `rig.mjs start` opened (docs/doc-screenshots.md).
 *
 *   node scripts/doc-screenshots/run.mjs step.mjs          a file whose default export is `async (c) => …`
 *   node scripts/doc-screenshots/run.mjs -e "<code>"       inline code, with the client as `c`
 *
 * `c` is the client from `cdp.mjs`. For example:
 *
 *   node scripts/doc-screenshots/run.mjs -e "await c.select(['Apartment', 'Props', 'Couch']); await c.shot('look')"
 *
 * then look at $TMPDIR/benne-doc-shots/shots/look.png.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect } from './cdp.mjs';

const [flag, arg] = process.argv.slice(2);
if (!flag || (flag === '-e' && !arg)) {
  console.error('Usage: node scripts/doc-screenshots/run.mjs <step.mjs> | -e "<code>"');
  process.exit(2);
}

const c = await connect();
try {
  if (flag === '-e') {
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const result = await new AsyncFunction('c', arg)(c);
    if (result !== undefined) console.log(JSON.stringify(result, null, 1));
  } else {
    const step = await import(pathToFileURL(path.resolve(flag)).href);
    await step.default(c);
  }
} finally {
  c.close();
}
