/**
 * Plays the blank template (`game-templates/blank`): it has no content to play, so this checks that
 * an empty game boots into its start room with the player and lets them walk, without errors.
 */
import { test, expect } from '@playwright/test';
import { collectErrors, openGame, state, waitIdle, walkTo } from '../support';

test('blank template boots and walks', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  expect(await waitIdle(page)).toMatchObject({ room: 'start', player: 'hank', inventory: [], flags: {}, variables: {} });

  await walkTo(page, { x: 60, y: 160 });
  await walkTo(page, { x: 260, y: 130 });
  expect((await state(page)).room).toBe('start');

  expect(errors).toEqual([]);
});
