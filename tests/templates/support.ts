import type { Page } from '@playwright/test';
import { act, clickGui } from '../playthrough/support';

const speech = (page: Page): Promise<string[]> => page.evaluate(() => window.__BENNE_HOOKS__!.speech());

/**
 * Returns `said(action)`: runs the action and returns the speech lines shown during it, in order
 * (`[Player] …` / `[Character id] …`, from the hooks' `speech()`).
 */
export function collectSpeech(page: Page): (action: () => Promise<unknown>) => Promise<string[]> {
  return async (action) => {
    const from = (await speech(page)).length;
    await action();
    return (await speech(page)).slice(from);
  };
}

/** Selects `verbId` and clicks `itemId`'s inventory slot. */
export const inventoryVerb = (page: Page, verbId: string, itemId: string) =>
  act(page, 'inventoryVerb', [verbId, itemId], 'world');

export const prop = (page: Page, propId: string) => page.evaluate((id) => window.__BENNE_HOOKS__!.prop(id), propId);

/** Opens the game menu from `menuGui`'s MenuBtn, visits settings, save and load, and resumes. */
export async function menus(page: Page, menuGui: string): Promise<void> {
  await clickGui(page, menuGui, 'MenuBtn', 'any');
  for (const [button, menu, back] of [
    ['settings', 'settings-menu', 'back'],
    ['save', 'save-menu', 'back-btn'],
    ['load', 'load-menu', 'back-btn'],
  ] as const) {
    await clickGui(page, 'game-menu', button, 'any');
    await clickGui(page, menu, back, 'any');
  }
  await clickGui(page, 'game-menu', 'resume', 'any');
}
