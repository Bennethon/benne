/**
 * Play From smoke tests: start every Play From entry point in BENNE Play (dev server) and check
 * it runs without errors and reaches a point where the game waits for the player.
 *
 * Entry points are found by scanning room scripts for `playFrom('<name>'`.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { collectErrors, openGame, setAutoSkip, waitIdle } from '../support';
import { gameDir } from '../../support/templates';

const roomsDir = path.join(gameDir('ai-apocalypse'), 'rooms');
const entries: Array<{ room: string; name: string }> = [];
for (const room of readdirSync(roomsDir)) {
  const script = path.join(roomsDir, room, `${room}.room.ts`);
  if (!existsSync(script)) continue;
  for (const m of readFileSync(script, 'utf8').matchAll(/\bplayFrom\(\s*(['"`])(.+?)\1/g)) {
    entries.push({ room, name: m[2]! });
  }
}

test('Play From entry points are discovered', () => {
  expect(entries.length).toBeGreaterThan(0);
});

for (const { room, name } of entries) {
  test(`Play From ${room} › ${name}`, async ({ page }) => {
    test.setTimeout(5 * 60_000);
    const errors = collectErrors(page);
    const playFromWarnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('Play From')) playFromWarnings.push(m.text());
    });
    await openGame(page, { path: '/benne-play.html', startRoom: room, playFrom: name });
    await setAutoSkip(page, true);
    const s = await waitIdle(page, 'any', { timeout: 4 * 60_000 });
    expect(s.phase).not.toBe('busy');
    expect(playFromWarnings).toEqual([]);
    expect(errors).toEqual([]);
  });
}
