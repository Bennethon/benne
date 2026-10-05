/**
 * Baseline playthrough of AI Apocalypse, title screen to credits, through the engine-level test
 * hooks only (see `src/engine/testing/benneTestHooks.ts`). It must pass unchanged before and after
 * the BenneScript port.
 *
 * Speech lines are click-skipped (as an impatient player would) except during the three long
 * cutscenes, which play at natural speed and are cut from the run's video into
 * `test-results/playthrough/cutscenes/` as a visual reference for later phases.
 */
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  choose,
  clickGui,
  collectErrors,
  combine,
  openGame,
  setAutoSkip,
  state,
  useItem,
  verb,
  waitIdle,
  walkTo,
} from './support';
import { cutVideoSegments, type VideoSegment } from './video';

const VIDEO_SIZE = { width: 1056, height: 594 };

test('AI Apocalypse: title screen to credits', async ({ browser }, testInfo) => {
  test.setTimeout(30 * 60_000);
  const context = await browser.newContext({
    viewport: VIDEO_SIZE,
    recordVideo: { dir: testInfo.outputPath('video'), size: VIDEO_SIZE },
  });
  const page = await context.newPage();
  const videoStart = Date.now();
  const segments: VideoSegment[] = [];
  const errors = collectErrors(page);

  /** Plays `run` with speech at natural speed and records its span of the video. */
  async function cutscene(name: string, run: () => Promise<unknown>): Promise<void> {
    await setAutoSkip(page, false);
    const start = Date.now() - videoStart;
    await run();
    segments.push({ name, startMs: start, endMs: Date.now() - videoStart });
    await setAutoSkip(page, true);
  }

  const flags = async () => (await state(page)).flags;
  const inventory = async () => (await state(page)).inventory;

  try {
    await test.step('title screen → opening → hallway27', async () => {
      await openGame(page);
      expect((await waitIdle(page)).room).toBe('title');
      await setAutoSkip(page, true);
      const s = await clickGui(page, 'title-buttons', 'new-game');
      expect(s.room).toBe('hallway27');
    });

    await test.step('2027 lab: fetch the Timeonium, slip, travel to the future', async () => {
      expect((await verb(page, 'use', 'door-lab')).room).toBe('lab27');
      // Heading for the banana walks into the scientists' guard region: they ask for the canister.
      await verb(page, 'take', 'banana');
      expect(await flags()).toMatchObject({ firstBanana: true, scientistRequest: true });
      await cutscene('lab-first-visit', async () => {
        const s = await verb(page, 'take', 'timeonium');
        expect(s.room).toBe('lab');
        expect(s.inventory).toContain('timeonium');
      });
    });

    await test.step('2037 lab → hallway: Jensen gives Hank the mission', async () => {
      await verb(page, 'move', 'filingCabinet');
      expect((await verb(page, 'use', 'exit-door')).room).toBe('hallway');
      await verb(page, 'talkTo', 'jensen', 'dialog');
      await choose(page, 'greeting');
      await choose(page, 'what about AI');
      await choose(page, 'AI problem');
      await choose(page, 'what is a time scientist');
      await choose(page, 'time scientist', 'world');
      expect(await flags()).toMatchObject({ jensenCrying: true });
      await useItem(page, 'timeonium', 'jensen');
      expect(await flags()).toMatchObject({ 'got mission': true, jensenCrying: false, jensenBlockingDoor: false });
    });

    await test.step('plaza: first visit, BOTT-i3 gives a magnet', async () => {
      await cutscene('plaza-first-visit', async () => {
        expect((await verb(page, 'use', 'hallway-hotspot-exit')).room).toBe('plaza');
      });
      expect(await flags()).toMatchObject({ 'left MIT first time': true });
      await verb(page, 'talkTo', 'botti3', 'dialog');
      await choose(page, 'bye', 'world');
      expect(await flags()).toMatchObject({ talkedWithBottieOnce: true });
      expect(await inventory()).toContain('magnet');
    });

    await test.step('gallery: paint the masterpiece, take the lens', async () => {
      expect((await walkTo(page, 'plaza-region-gallery-exit')).room).toBe('gallery');
      await verb(page, 'talkTo', 'curator', 'dialog');
      await choose(page, 'ask about lens');
      await choose(page, 'can have lens');
      await choose(page, 'bye', 'world');
      expect(await flags()).toMatchObject({ canCleanPaint: true });
      await verb(page, 'clean', 'gallery-hotspot-paint-spill');
      expect(await flags()).toMatchObject({ canTakeLens: true });
      await verb(page, 'take', 'statue');
      expect(await flags()).toMatchObject({ gotLens: true });
      expect(await inventory()).toContain('lens');
      expect((await walkTo(page, 'gallery-region-leave')).room).toBe('plaza');
    });

    await test.step('café: work for the control relay', async () => {
      expect((await walkTo(page, 'plaza-region-cafe-exit')).room).toBe('cafe');
      await verb(page, 'look', 'relay');
      await verb(page, 'talkTo', 'barista', 'dialog');
      await choose(page, 'high tech thing');
      await choose(page, 'bye', 'world');
      expect(await flags()).toMatchObject({ canWork: true });
      await verb(page, 'clean', 'dishes');
      expect(await inventory()).toEqual(expect.arrayContaining(['coffee', 'soda']));
      await verb(page, 'talkTo', 'customer', 'dialog');
      await choose(page, 'take order', 'world');
      expect(await flags()).toMatchObject({ tookOrder: true });
      await useItem(page, 'coffee', 'cafe-hotspot-coffeemaker');
      await useItem(page, 'coffee', 'customer');
      expect(await flags()).toMatchObject({ deliveredOrder: true });
      expect(await inventory()).not.toContain('coffee');
      await verb(page, 'talkTo', 'barista', 'dialog');
      await choose(page, 'helped', 'world');
      expect(await flags()).toMatchObject({ gotRelay: true });
      expect(await inventory()).toContain('relay');
      expect((await verb(page, 'use', 'cafe-hotspot-door')).room).toBe('plaza');
    });

    await test.step('club: fix the car battery for the power regulator', async () => {
      expect((await walkTo(page, 'plaza-region-garage-exit')).room).toBe('club');
      await verb(page, 'look', 'regulator');
      await verb(page, 'look', 'club-hotspot-battery');
      await verb(page, 'talkTo', 'driver', 'dialog');
      await choose(page, 'fix battery');
      await choose(page, 'nevermind', 'world');
      expect(await flags()).toMatchObject({ askedAboutBattery: true });
      await useItem(page, 'soda', 'club-hotspot-battery');
      expect(await flags()).toMatchObject({ batteryClean: true });
      await verb(page, 'talkTo', 'driver', 'dialog');
      await choose(page, 'wrench');
      await choose(page, 'nevermind', 'world');
      expect(await flags()).toMatchObject({ askedAboutWrench: true });
      await verb(page, 'take', 'antenna');
      await combine(page, 'magnet', 'antenna');
      expect(await inventory()).toContain('magnetStick');
      await useItem(page, 'magnetStick', 'club-hotspot-toolChest');
      expect(await inventory()).toContain('wrench');
      // Fixing the battery ends with the car crashing and Hank walking out to the plaza.
      const s = await useItem(page, 'wrench', 'club-hotspot-battery');
      expect(s.flags).toMatchObject({ batteryFixed: true, gotRegulator: true });
      expect(s.inventory).toContain('regulator');
      expect(s.room).toBe('plaza');
    });

    await test.step('plaza → lab: hand Jensen the parts, get locked in the closet', async () => {
      await verb(page, 'talkTo', 'jensen', 'dialog');
      const s = await choose(page, 'found all', 'world');
      expect(s.room).toBe('lab');
      expect(s.flags).toMatchObject({ 'all done': true });
      for (const part of ['timeonium', 'lens', 'relay', 'regulator']) expect(s.inventory).not.toContain(part);
      expect((await verb(page, 'use', 'closet-door')).room).toBe('closet');
    });

    await test.step('closet: short the lock and escape', async () => {
      await verb(page, 'take', 'shelves');
      expect(await inventory()).toContain('coin');
      await useItem(page, 'coin', 'electricalBox');
      expect((await page.evaluate(() => window.__BENNE_HOOKS__!.prop('electricalBox')))?.animation).toContain('electricalBox-open');
      await verb(page, 'take', 'mop');
      expect(await inventory()).toContain('mop');
      const s = await useItem(page, 'coin', 'electricalBox');
      expect(s.room).toBe('lab');
      expect(s.flags).toMatchObject({ 'escaped closet': true });
    });

    await test.step('finale: stop Jensen, go home, credits', async () => {
      await cutscene('finale', async () => {
        await page.evaluate(() => window.__BENNE_HOOKS__!.useItem('mop', 'jensen'));
        await expect.poll(async () => (await state(page)).room, { timeout: 5 * 60_000 }).toBe('credits');
      });
      // The credits roll, then return to the title screen.
      expect((await waitIdle(page, 'world', { timeout: 120_000 })).room).toBe('title');
    });

    expect(errors).toEqual([]);
  } finally {
    await context.close();
    const video = page.video();
    if (video) {
      const file = await video.path();
      await testInfo.attach('playthrough video', { path: file, contentType: 'video/webm' });
      const dir = path.join(testInfo.project.outputDir, 'cutscenes');
      await mkdir(dir, { recursive: true });
      await testInfo.attach('cutscene segments', { body: JSON.stringify(segments, null, 2), contentType: 'application/json' });
      for (const clip of await cutVideoSegments(file, segments, dir)) {
        await testInfo.attach(`cutscene ${path.basename(clip)}`, { path: clip, contentType: 'video/webm' });
      }
    }
  }
});

