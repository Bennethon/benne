/**
 * Plays the 2-click template (`game-templates/2-click`) through the dev/test hooks: every script
 * handler, the exact lines spoken in order, flags, inventory and prop state. Written against the
 * template before its BenneScript port, and unchanged by it.
 */
import { test, expect } from '@playwright/test';
import { choose, collectErrors, combine, openGame, setAutoSkip, state, useItem, verb, waitIdle } from '../playthrough/support';
import { collectSpeech, inventoryVerb, menus, prop } from './support';

test('2-click template, start to finish', async ({ page }) => {
  const errors = collectErrors(page);
  const said = collectSpeech(page);
  const inventory = async () => (await state(page)).inventory;
  const look = (target: string) => said(() => verb(page, 'look', target));
  const use = (target: string) => said(() => verb(page, 'use', target));

  await openGame(page);
  await setAutoSkip(page, true);
  expect(await waitIdle(page)).toMatchObject({ room: 'apartment', player: 'hank' });
  expect(await inventory()).toEqual(['Broom', 'Lantern']);

  // ── Apartment ──
  expect(await look('Couch')).toEqual(["[Player] It's my weird, poorly drawn couch."]);
  expect(await look('Door')).toEqual(["[Player] It's the door to the outside."]);
  expect(await look('penny')).toEqual(["[Player] It's Penny."]);
  expect(await look('Table')).toEqual(['[Player] I like to keep this table here so I can walk around it.']);
  expect(await look('Bread')).toEqual(["[Player] It's some bread."]);
  expect(await look('Knife')).toEqual(["[Player] It's a knife."]);
  expect(await look('PeanutButter')).toEqual(["[Player] It's some peanut butter."]);
  expect(await use('Table')).toEqual([]);
  expect(await use('Door')).toEqual(['[Player] The door is locked.']);

  // ── Items on world targets ──
  expect(await said(() => useItem(page, 'Broom', 'Couch'))).toEqual(['[Player] I used the broom on the couch.']);
  expect(await said(() => useItem(page, 'Broom', 'Table'))).toEqual(['[Player] I cleaned the table.']);
  expect(await said(() => useItem(page, 'Lantern', 'penny'))).toEqual(["[Player] That doesn't work."]);
  expect(await said(() => useItem(page, 'Lantern', 'Door'))).toEqual(["[Player] That doesn't work."]);

  // ── Inventory verbs ──
  expect(await said(() => inventoryVerb(page, 'look', 'Broom'))).toEqual(["[Player] It's a broom."]);
  expect(await said(() => inventoryVerb(page, 'look', 'Lantern'))).toEqual([]);
  expect(await said(() => inventoryVerb(page, 'use', 'Broom'))).toEqual([]);
  expect(await state(page)).toMatchObject({ activeVerb: 'use', activeItem: 'Broom' });
  expect(await said(() => inventoryVerb(page, 'use', 'Lantern'))).toEqual(['[Player] I will turn on the Lantern.', '[Player] There we go!']);
  expect((await state(page)).activeItem).toBeNull();
  expect(await said(() => inventoryVerb(page, 'use', 'Lantern'))).toEqual(['[Player] I will turn off the Lantern.', '[Player] There we go!']);

  // ── Penny's dialog ──
  expect(await said(() => verb(page, 'use', 'penny', 'dialog'))).toEqual(['[Player] Hey Penny!']);
  expect(await said(() => choose(page, 'greeting'))).toEqual(["[Player] How's it goin?", '[Character penny] Fine.']);
  expect(await said(() => choose(page, 'door'))).toEqual([
    '[Player] The door is locked. How do I get out?',
    '[Player] I want to go outside.',
    '[Character penny] I want a sandwich.',
    '[Player] Uhh...',
    "[Character penny] Make me a sandwich and I'll give you the key.",
  ]);
  expect(await said(() => choose(page, 'bye', 'world'))).toEqual(['[Player] Ok, bye!', '[Character penny] Bye!']);

  // ── The sandwich ──
  for (const [target, item] of [['Bread', 'Bread'], ['Knife', 'Knife'], ['PeanutButter', 'PB']] as const) {
    expect(await use(target)).toEqual([]);
    expect(await inventory()).toContain(item);
    expect((await prop(page, target))?.visible).toBe(false);
  }
  expect(await said(() => inventoryVerb(page, 'look', 'Bread'))).toEqual(["[Player] It's some bread."]);
  expect(await said(() => inventoryVerb(page, 'look', 'Knife'))).toEqual(["[Player] It's a knife."]);
  expect(await said(() => inventoryVerb(page, 'look', 'PB'))).toEqual(["[Player] It's some peanut butter."]);
  expect(await said(() => combine(page, 'Knife', 'Bread'))).toEqual(["[Player] It won't do any good without something to spread!"]);
  expect(await said(() => combine(page, 'Knife', 'PB'))).toEqual(['[Player] I need to open the jar first.']);
  expect(await said(() => inventoryVerb(page, 'use', 'PB'))).toEqual(['[Player] I opened the jar.']);
  expect(await said(() => inventoryVerb(page, 'use', 'PB'))).toEqual(["[Player] It's already open."]);
  expect(await said(() => combine(page, 'Knife', 'PB'))).toEqual(['[Player] Mmmm... gooey peanut butter.']);
  expect(await said(() => combine(page, 'Knife', 'Bread'))).toEqual(['[Player] This looks delicious!']);
  expect(await state(page)).toMatchObject({ activeItem: null });
  expect(await inventory()).toContain('Sammich');
  expect(await inventory()).not.toContain('Bread');
  expect(await said(() => inventoryVerb(page, 'look', 'Sammich'))).toEqual(['[Player] It looks delicious!']);
  expect(await said(() => useItem(page, 'Sammich', 'penny'))).toEqual([
    '[Player] Here, Penny! Have a sandwich.',
    "[Character penny] Thank you! Here's the key.",
  ]);
  expect(await inventory()).not.toContain('Sammich');
  expect(await said(() => inventoryVerb(page, 'look', 'Key'))).toEqual(["[Player] It's a key."]);

  // ── Out of the apartment ──
  expect(await said(() => useItem(page, 'Key', 'Door'))).toEqual(['[Player] The door is unlocked.']);
  expect((await state(page)).flags).toMatchObject({ unlockedDoor: true });
  expect(await inventory()).not.toContain('Key');
  expect(await use('Door')).toEqual([
    '[Character henry] Hey, Hank!',
    '[Character henry] Come here!',
    "[Player] What's up?",
    '[Character henry] Check out this fountain!',
    '[Player] What about it?',
    "[Character henry] I need you to turn it on. It's really important.",
    '[Player] Uh, ok.',
  ]);
  expect((await state(page)).room).toBe('outside');

  // ── Outside ──
  expect(await look('henry')).toEqual([]);
  expect(await look('door')).toEqual(["[Player] It's the door."]);
  expect(await look('FountainOff')).toEqual(["[Player] It's a fountain.", "[Player] It's not running."]);
  expect(await use('FountainOff')).toEqual(["[Player] I don't see how to turn it on."]);
  expect(await look('Rock')).toEqual(["[Player] It's a weird looking, out of place rock."]);
  expect(await use('Rock')).toEqual(['[Player] I think I can move it.', '[Player] Huh, some weird lever hidden under the rock.']);
  expect((await prop(page, 'Rock'))?.visible).toBe(false);
  expect(await look('RockMoved')).toEqual(['[Player] I wonder what this lever does...']);
  expect(await use('RockMoved')).toEqual(["[Player] Let's see what this does...", "[Character henry] WOO HOO! IT'S WORKING!"]);
  expect((await state(page)).flags).toMatchObject({ turnedOnFountain: true });
  expect((await prop(page, 'FountainOn'))?.visible).toBe(true);
  expect(await look('FountainOn')).toEqual(['[Player] I got it working!.']);
  expect(await use('FountainOn')).toEqual(['[Player] Cool!.']);

  // ── Back in: the door closes behind Hank ──
  expect(await use('door')).toEqual([]);
  expect((await state(page)).room).toBe('apartment');
  expect((await prop(page, 'Door'))?.animation).toBe('room:apartment:Door');

  expect(errors).toEqual([]);
});

test('2-click template menus', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await waitIdle(page);
  await menus(page, 'menu-bar');
  expect(errors).toEqual([]);
});
