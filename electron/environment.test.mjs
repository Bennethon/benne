import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBenneEnvironment, quitBenneApplication } from '../src/engine/scripting/benneEnvironment.ts';

test('environment detection uses the desktop bridge; browser quit never closes the page', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    delete globalThis.window;
    assert.equal(getBenneEnvironment(), 'browser');
    assert.doesNotThrow(quitBenneApplication);
    globalThis.window = { close() { assert.fail('Browser windows must stay open'); } };
    assert.equal(getBenneEnvironment(), 'browser');
    quitBenneApplication();
    let quitCalls = 0;
    window.benneDesktop = { environment: 'electron', quit() { quitCalls++; } };
    assert.equal(getBenneEnvironment(), 'electron');
    quitBenneApplication();
    assert.equal(quitCalls, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});
