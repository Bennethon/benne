/**
 * The café on the new BenneScript API (Phase 1 spike), played in BENNE Play. Covers more of
 * `cafe.room.ts` than the main playthrough: every handler, the order of lines inside a handler,
 * item use that falls through to the global script, and leaving the room mid-script.
 */
import { test, expect, type Page } from '@playwright/test';
import { choose, collectErrors, openGame, setAutoSkip, state, useItem, verb, waitIdle } from '../support';

const flags = async (page: Page) => (await state(page)).flags;
const inventory = async (page: Page) => (await state(page)).inventory;

/** Speech lines from the console, as `say` logs them. */
function collectSpeech(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (m) => {
    const match = /^\[(?:Player|Character \w+)\] /.exec(m.text());
    if (match) lines.push(m.text());
  });
  return lines;
}

test('café on the new BenneScript API', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors = collectErrors(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /BenneScript|not transformed|already has a handler|outside a verb handler/.test(m.text())) {
      warnings.push(m.text());
    }
  });
  const speech = collectSpeech(page);
  const said = async (action: () => Promise<unknown>) => {
    const from = speech.length;
    await action();
    return speech.slice(from);
  };

  await openGame(page, { path: '/benne-play.html', startRoom: 'cafe' });
  await setAutoSkip(page, true);
  expect((await waitIdle(page)).room).toBe('cafe');

  // Looks: faceClicked + lines in order, and an option switched on at the end.
  expect(await said(() => verb(page, 'look', 'barista'))).toEqual([
    '[Player] Looks like the owner of the place.',
    "[Player] He isn't doing much.",
  ]);
  for (const target of ['customer', 'cafe-hotspot-window', 'cafe-hotspot-coffeemaker', 'cafe-hotspot-door', 'menu', 'cleaning-stuff']) {
    expect(await said(() => verb(page, 'look', target))).not.toEqual([]);
  }
  expect(await said(() => verb(page, 'take', 'relay'))).toEqual(["[Player] I can't reach it."]);

  // One handler, three verbs.
  for (const v of ['use', 'take', 'clean']) {
    expect(await said(() => verb(page, v, 'cleaning-stuff'))).toEqual(["[Player] I'm not on the job here."]);
  }

  // Branch on a flag that is still false.
  expect(await said(() => verb(page, 'clean', 'dishes'))).toEqual(["[Player] These need to be bussed, but it's not MY job."]);
  expect((await state(page)).inventory).not.toContain('coffee');

  // The puzzle (same steps as the main playthrough).
  await verb(page, 'look', 'relay');
  await verb(page, 'talkTo', 'barista', 'dialog');
  await choose(page, 'high tech thing');
  await choose(page, 'bye', 'world');
  expect(await flags(page)).toMatchObject({ canWork: true });
  await verb(page, 'clean', 'dishes');
  expect(await inventory(page)).toEqual(expect.arrayContaining(['coffee', 'soda']));
  expect((await page.evaluate(() => window.__BENNE_HOOKS__!.prop('dishes')))?.visible).toBe(false);

  // Early return before the order is taken; an item with no handler here falls through to the global script.
  expect(await said(() => useItem(page, 'coffee', 'customer'))).toEqual(['[Player] Why would I give him that?']);
  expect(await said(() => useItem(page, 'soda', 'customer'))).toEqual(["[Player] That doesn't work."]);

  await verb(page, 'talkTo', 'customer', 'dialog');
  await choose(page, 'take order', 'world');
  expect(await flags(page)).toMatchObject({ tookOrder: true });
  expect(await said(() => useItem(page, 'coffee', 'customer'))).toEqual(["[Player] I'm not going to serve him an empty cup."]);
  expect(await said(() => useItem(page, 'coffee', 'cafe-hotspot-coffeemaker'))).toEqual(['[Player] The best part of waking up!']);

  // Two speakers, and a flag write that now happens after the conversation, where it is written.
  expect(await said(() => useItem(page, 'coffee', 'customer'))).toEqual([
    '[Player] Here you are, sir.',
    '[Character customer] I ordered decaf.',
    '[Player] You said black.',
    '[Character customer] Black decaf.',
    '[Player] You left out a pretty important word.',
    '[Character customer] Oh, this is fantastic.',
    '[Player] What?',
    '[Character customer] The misunderstanding. The mild resentment. This is exactly like 2024!',
  ]);
  expect(await flags(page)).toMatchObject({ deliveredOrder: true });
  expect(await inventory(page)).not.toContain('coffee');
  expect(await said(() => verb(page, 'talkTo', 'customer'))).toEqual(["[Player] I'm gonna leave that guy alone now."]);

  await verb(page, 'talkTo', 'barista', 'dialog');
  await choose(page, 'helped', 'world');
  expect(await inventory(page)).toContain('relay');
  expect(await said(() => verb(page, 'talkTo', 'barista'))).toEqual(["[Player] I don't want to talk to that guy anymore."]);

  // goTo() ends the handler and changes room.
  expect((await verb(page, 'use', 'cafe-hotspot-door')).room).toBe('plaza');

  expect(warnings).toEqual([]);
  expect(errors).toEqual([]);
});
