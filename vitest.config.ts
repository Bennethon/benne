import { defineConfig } from 'vitest/config';

// Deliberately independent of vite.config.ts: tests must never regenerate game content.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,mjs}'],
    setupFiles: ['tests/support/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['src/engine/**/*.ts', 'benne-editor/src/**/*.ts', 'scripts/lib/*.mjs'],
      exclude: ['**/test/**', '**/*.d.ts'],
      // Ratchet critical pure logic independently; do not disguise untested renderer code.
      thresholds: {
        'src/engine/pathfinding.ts': { lines: 85, branches: 70, functions: 100 },
        'src/engine/scripting/registerRoomScript.ts': { lines: 90, branches: 60, functions: 100 },
        'src/engine/gameState/characterInventory.ts': { lines: 90, branches: 85, functions: 85 },
        'src/engine/verbs/resolvePointerVerb.ts': { lines: 80, branches: 80, functions: 65 },
        'benne-editor/src/playFromDiscovery.ts': { lines: 85, branches: 80, functions: 100 },
      },
    },
  },
});
