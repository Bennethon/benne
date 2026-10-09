/**
 * `scripts/removed-engine-files.json`: the engine files Update Engine deletes from games. Each must
 * be gone from this repository, inside what `bundle:scaffold` ships (or the old `src/game/boot/`), and
 * never game content.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const list = JSON.parse(readFileSync('scripts/removed-engine-files.json', 'utf8')) as {
  groups: Array<{ version: string; why: string; files: string[] }>;
};
const files = list.groups.flatMap((g) => g.files);
/** Engine code that earlier versions shipped inside the game folder (now `src/engine/content/`). */
const LEGACY_GAME_BOOT = 'src/game/boot/';
/** The folders `bundle:scaffold` copies into the scaffold's shared layer. */
const SHIPPED_DIRS = ['src/engine/', 'src/editor/', 'src/types/', 'electron/', 'scripts/lib/', LEGACY_GAME_BOOT];

describe('removed engine files', () => {
  it('are listed once, with a version and a reason per group', () => {
    expect(new Set(files).size).toBe(files.length);
    for (const g of list.groups) {
      expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(g.why.length).toBeGreaterThan(0);
    }
  });

  it('are gone from the engine, were shipped, and are never game content', () => {
    for (const file of files) {
      expect(existsSync(file), file).toBe(false);
      expect(SHIPPED_DIRS.some((dir) => file.startsWith(dir)) || file.startsWith('scripts/'), file).toBe(true);
      expect(file.startsWith('src/game/') && !file.startsWith(LEGACY_GAME_BOOT), file).toBe(false);
    }
  });

  it('include the old scripting API', () => {
    expect(files).toContain('src/engine/scripting/registerRoomScript.ts');
  });

  it('include the old boot layer', () => {
    expect(files).toContain('src/game/boot/registerGameContent.ts');
  });
});
