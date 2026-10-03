import { test, expect, type Page } from '@playwright/test';
import type { SerializableBenneGameStateV2 } from '../../src/types/gameState';
declare global { interface Window { __BENNE_TEST__: { layout(): { width: number; zoom: number; viewportWidth: number; inputScale: number }; snapshot(): SerializableBenneGameStateV2; ready(): boolean; counts(): { listeners: number; objects: number } } } }
const snapshot = (page: Page) => page.evaluate(() => window.__BENNE_TEST__.snapshot());
const ready = (page: Page) => expect.poll(() => page.evaluate(() => window.__BENNE_TEST__?.ready() ?? false)).toBe(true);
async function click(page: Page, x: number, y: number, button: 'left' | 'right' = 'left') {
  await ready(page);
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.click(canvas!.x + x * canvas!.width / 320, canvas!.y + y * canvas!.height / 180, { button });
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  (page as Page & { benneErrors?: string[] }).benneErrors = errors;
  await page.goto('/');
  await page.locator('canvas').click({ position: { x: 2, y: 2 } });
  await ready(page);
});
test.afterEach(async ({ page }) => { expect((page as Page & { benneErrors?: string[] }).benneErrors).toEqual([]); });
test('left/right interactions route once and survive a room round trip', async ({ page }) => {
  await click(page, 115, 30);
  await expect.poll(async () => (await snapshot(page)).variables.count).toBe(1);
  await click(page, 115, 30, 'right');
  await expect.poll(async () => (await snapshot(page)).flags.looked).toBe(true);
  await click(page, 295, 30);
  await expect.poll(async () => (await snapshot(page)).currentRoom).toBe('b');
  await click(page, 295, 30);
  await expect.poll(async () => (await snapshot(page)).currentRoom).toBe('a');
  await click(page, 115, 30);
  await expect.poll(async () => (await snapshot(page)).variables.count).toBe(2);
});
test('save/load restores state and invokes load hooks without enter hooks', async ({ page }) => {
  await click(page, 115, 30);
  await click(page, 25, 30);
  await click(page, 115, 30);
  await expect.poll(async () => (await snapshot(page)).variables.count).toBe(2);
  await click(page, 295, 30);
  await expect.poll(async () => (await snapshot(page)).currentRoom).toBe('b');
  await click(page, 70, 30);
  await expect.poll(async () => (await snapshot(page)).flags.loaded).toBe(true);
  expect(await snapshot(page)).toMatchObject({ currentRoom: 'a', variables: { count: 1, entered: 1 } });
  await page.reload(); await ready(page);
  await click(page, 70, 30);
  await expect.poll(async () => (await snapshot(page)).variables.count).toBe(1);
});
test('repeated transitions keep listener and display-object counts bounded', async ({ page }) => {
  const initial = await page.evaluate(() => window.__BENNE_TEST__.counts());
  const cycles = process.env.BENNE_SOAK ? 100 : 4;
  test.setTimeout(cycles * 4000 + 30000);
  for (let i = 0; i < cycles; i++) {
    await click(page, 295, 30);
    await expect.poll(async () => (await snapshot(page)).currentRoom).toBe(i % 2 ? 'a' : 'b');
    await ready(page);
  }
  expect(await page.evaluate(() => window.__BENNE_TEST__.counts())).toEqual(initial);
});
test('resizing preserves correct hit coordinates', async ({ page }) => {
  for (const size of [{ width: 640, height: 360 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => (await page.locator('canvas').boundingBox())?.width).toBe(size.width);
    await expect.poll(() => page.evaluate(() => window.__BENNE_TEST__.layout())).toEqual({ width: size.width, zoom: size.width / 320, viewportWidth: size.width, inputScale: 1 });
    await click(page, 115, 30);
    await expect.poll(async () => (await snapshot(page)).variables.count).toBe(size.width === 640 ? 1 : 2);
  }
  await expect.poll(async () => (await snapshot(page)).variables.count).toBe(2);
});
