import { expect, type Page } from '@playwright/test';
import type { BenneTestHooks, BenneTestPhase, BenneTestState } from '../../src/engine/testing/benneTestHooks';

declare global {
  interface Window {
    __BENNE_HOOKS__?: BenneTestHooks;
    __BENNE_START_ROOM_ID?: string;
    __BENNE_PLAY_FROM_NAME?: string;
  }
}

/** Known console errors that are not regressions. Each needs a reason. */
const IGNORED_CONSOLE_ERRORS: RegExp[] = [];

/** Collects page errors, console errors, failed requests and HTTP errors for the whole test. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!IGNORED_CONSOLE_ERRORS.some((re) => re.test(text))) errors.push(`console: ${text}`);
  });
  page.on('requestfailed', (request) => {
    // Media elements abort range requests when playback is replaced; that is not a missing file.
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && /\.(mp3|ogg|wav|m4a|webm|mp4)$/i.test(request.url())) return;
    errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  return errors;
}

/** Opens the game (or BENNE Play) and waits for the hooks and the first room. */
export async function openGame(
  page: Page,
  options: { path?: string; startRoom?: string; playFrom?: string } = {},
): Promise<void> {
  if (options.startRoom || options.playFrom) {
    await page.addInitScript(({ startRoom, playFrom }) => {
      if (startRoom) window.__BENNE_START_ROOM_ID = startRoom;
      if (playFrom) window.__BENNE_PLAY_FROM_NAME = playFrom;
    }, { startRoom: options.startRoom, playFrom: options.playFrom });
  }
  await page.goto(options.path ?? '/');
  await expect.poll(() => page.evaluate(() => window.__BENNE_HOOKS__ !== undefined), { timeout: 60_000 }).toBe(true);
}

export const state = (page: Page): Promise<BenneTestState> => page.evaluate(() => window.__BENNE_HOOKS__!.state());

/**
 * Waits until the game is waiting for the player (`world` or `dialog`) and has stayed that way for
 * `settleMs`, then checks the phase is the expected one. The settle window covers the gap between
 * one queued step finishing and the next starting.
 */
export async function waitIdle(
  page: Page,
  expected: Exclude<BenneTestPhase, 'busy'> | 'any' = 'world',
  { timeout = 120_000, settleMs = 400 } = {},
): Promise<BenneTestState> {
  let last: BenneTestState | undefined;
  await expect
    .poll(
      async () => {
        last = await state(page);
        return last.phase !== 'busy' && last.phaseMs >= settleMs;
      },
      { timeout, intervals: [100], message: 'waiting for the game to become idle' },
    )
    .toBe(true);
  if (expected !== 'any') {
    expect(last!.phase, `expected phase "${expected}" in room "${last!.room}" (dialog: ${last!.dialog})`).toBe(expected);
  }
  return last!;
}

type Settled = Exclude<BenneTestPhase, 'busy'> | 'any';
type Action = 'verb' | 'walkTo' | 'useItem' | 'combine' | 'inventoryVerb' | 'choose' | 'clickGui';

/** Runs one hook action (a single player click) and waits for the game to settle. */
export async function act(page: Page, action: Action, args: unknown[], expected: Settled): Promise<BenneTestState> {
  await page.evaluate(([name, a]) => {
    const hooks = window.__BENNE_HOOKS__ as unknown as Record<string, (...x: unknown[]) => void>;
    hooks[name as string]!(...(a as unknown[]));
  }, [action, args] as const);
  return waitIdle(page, expected);
}

export const verb = (page: Page, verbId: string, target: string, expected: Settled = 'world') =>
  act(page, 'verb', [verbId, target], expected);
export const walkTo = (page: Page, target: string | { x: number; y: number }, expected: Settled = 'world') =>
  act(page, 'walkTo', [target], expected);
export const useItem = (page: Page, item: string, target: string, expected: Settled = 'world', verbId?: string) =>
  act(page, 'useItem', [item, target, verbId], expected);
export const combine = (page: Page, item: string, targetItem: string, expected: Settled = 'world', verbId?: string) =>
  act(page, 'combine', [item, targetItem, verbId], expected);
export const choose = (page: Page, option: string, expected: Settled = 'dialog') =>
  act(page, 'choose', [option], expected);
export const clickGui = (page: Page, gui: string, control: string, expected: Settled = 'world') =>
  act(page, 'clickGui', [gui, control], expected);

export const setAutoSkip = (page: Page, enabled: boolean, minShowMs = 250) =>
  page.evaluate(([e, ms]) => window.__BENNE_HOOKS__!.setAutoSkip(e as boolean, ms as number), [enabled, minShowMs] as const);
