/**
 * Real mouse clicks on an inventory slot (the hooks click objects directly, so they don't cover
 * this). Looking at an item starts its speech line during the slot's click; that same click must
 * not count as the click that skips the line.
 */
import { test, expect } from '@playwright/test';
import { collectErrors, openGame, state, waitIdle } from '../support';

/** Screen positions in the 1056×594 viewport: the verb bar's "Look at" and the first inventory slot. */
const LOOK_AT_BUTTON = { x: 330, y: 572 };
const FIRST_SLOT = { x: 604, y: 550 };

test('Look at, then an inventory item: the line stays up until the next click', async ({ page }) => {
  const errors = collectErrors(page);
  const lines: string[] = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[Player] ')) lines.push(m.text());
  });
  await openGame(page, { path: '/benne-play.html', startRoom: 'club' });
  await waitIdle(page, 'world');
  await page.selectOption('#benne-play-inventory-select', 'magnet');
  await page.click('#benne-play-give-inventory');
  await expect.poll(async () => (await state(page)).inventory).toContain('magnet');

  await page.mouse.click(LOOK_AT_BUTTON.x, LOOK_AT_BUTTON.y);
  await expect.poll(async () => (await state(page)).activeVerb).toBe('look');
  await page.mouse.move(FIRST_SLOT.x, FIRST_SLOT.y, { steps: 5 });
  await page.mouse.click(FIRST_SLOT.x, FIRST_SLOT.y);

  await expect.poll(() => lines).toEqual(['[Player] A cute promotional magnet for the friendly AI overlord.']);
  await page.waitForTimeout(300);
  expect((await state(page)).phase, 'the line is still on screen').toBe('busy');

  // The next click skips it.
  await page.mouse.click(FIRST_SLOT.x, FIRST_SLOT.y - 200);
  await waitIdle(page, 'world', { timeout: 2_000, settleMs: 200 });
  expect(errors).toEqual([]);
});
