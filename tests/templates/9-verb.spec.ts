/**
 * Plays the 9-verb template (`game-templates/9-verb`) through the dev/test hooks: every script
 * handler, the exact lines spoken in order, flags, inventory and prop state. Written against the
 * template before its BenneScript port, and unchanged by it.
 */
import { test, expect } from '@playwright/test';
import { choose, collectErrors, combine, openGame, setAutoSkip, state, useItem, verb, waitIdle, walkTo } from '../playthrough/support';
import { collectSpeech, inventoryVerb, menus, prop } from './support';

test('9-verb template, start to finish', async ({ page }) => {
  const errors = collectErrors(page);
  const said = collectSpeech(page);
  const inventory = async () => (await state(page)).inventory;
  const look = (target: string) => said(() => verb(page, 'look', target));

  await openGame(page);
  await setAutoSkip(page, true);
  expect(await waitIdle(page)).toMatchObject({ room: 'apartment', player: 'hank' });
  expect(await inventory()).toEqual(['Broom', 'Lantern', 'Key']);

  // ── Apartment: looks, room handlers before character scripts, global fallbacks ──
  expect(await look('Couch')).toEqual(["[Player] It's my weird, magical, poorly drawn couch."]);
  expect(await look('penny')).toEqual(["[Player] It's Penny."]);
  expect(await look('Table')).toEqual(['[Player] I like to keep this table here so I can walk around it.']);
  expect(await look('Bread')).toEqual(["[Player] It's some bread."]);
  expect(await look('Knife')).toEqual(["[Player] It's a knife."]);
  expect(await look('PeanutButter')).toEqual(["[Player] It's some peanut butter."]);
  expect(await look('window')).toEqual(['[Player] Nothing special about that.']);
  const fallbacks: Array<[string, string]> = [
    ['pickUp', "I can't take that."],
    ['push', "It won't move."],
    ['pull', "It won't move."],
    ['open', "I can't open that."],
    ['close', "That doesn't need closing."],
    ['talkTo', "I don't have anything to say to that."],
  ];
  for (const [v, line] of fallbacks) {
    expect(await said(() => verb(page, v, 'Table')), v).toEqual([`[Player] ${line}`]);
  }
  expect(await said(() => verb(page, 'use', 'Table'))).toEqual([]);
  expect(await said(() => verb(page, 'pull', 'Couch'))).toEqual(["[Player] It's too heavy."]);
  expect(await said(() => verb(page, 'push', 'Couch'))).toEqual(['[Player] Goodbye window.']);
  expect(await said(() => verb(page, 'push', 'Couch'))).toEqual(['[Player] Hello window.']);
  expect(await said(() => walkTo(page, 'darkness'))).toEqual(["[Player] It's dark over here."]);

  // ── Items on world targets: per item and verb, and fall-through to the global line ──
  expect(await said(() => useItem(page, 'Broom', 'Bread'))).toEqual(["[Player] I don't need to clean the bread."]);
  expect(await said(() => useItem(page, 'Broom', 'Bread', 'world', 'give'))).toEqual(["[Player] I can't give something to bread."]);
  expect(await said(() => useItem(page, 'Broom', 'Couch'))).toEqual(['[Player] I used the broom on the couch.']);
  expect(await said(() => useItem(page, 'Broom', 'Table'))).toEqual(['[Player] I cleaned the table.']);
  expect(await said(() => useItem(page, 'Lantern', 'penny', 'world', 'give'))).toEqual(["[Player] That doesn't work."]);
  expect(await said(() => useItem(page, 'Lantern', 'Door'))).toEqual(["[Player] That doesn't work."]);
  expect(await said(() => verb(page, 'open', 'Door'))).toEqual(['[Player] The door is locked.']);

  // ── Inventory verbs ──
  expect(await said(() => inventoryVerb(page, 'look', 'Broom'))).toEqual(['[Player] The broom is a broom.']);
  const broomLines: Array<[string, string]> = [
    ['pickUp', 'I already have the broom.'],
    ['talkTo', "I can't talk to the broom."],
    ['open', "I can't open the broom."],
    ['close', "I can't close the broom."],
    ['push', "I can't push the broom."],
    ['pull', "I can't pull the broom."],
  ];
  for (const [v, line] of broomLines) {
    expect(await said(() => inventoryVerb(page, v, 'Broom')), v).toEqual([`[Player] ${line}`]);
  }
  for (const v of ['use', 'give']) {
    expect(await said(() => inventoryVerb(page, v, 'Broom')), v).toEqual([]);
    expect(await state(page), v).toMatchObject({ activeVerb: v, activeItem: 'Broom' });
  }
  expect(await said(() => inventoryVerb(page, 'use', 'Lantern'))).toEqual(['[Player] I will turn on the Lantern.', '[Player] There we go!']);
  expect((await state(page)).activeItem).toBeNull();
  expect(await said(() => inventoryVerb(page, 'use', 'Lantern'))).toEqual(['[Player] I will turn off the Lantern.', '[Player] There we go!']);
  expect(await said(() => inventoryVerb(page, 'look', 'Key'))).toEqual(['[Player] Nothing special about that.']);

  // ── Penny's dialog ──
  expect(await said(() => verb(page, 'talkTo', 'penny', 'dialog'))).toEqual(['[Player] Hey Penny!', '[Character penny] Hi!']);
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
    expect(await said(() => verb(page, 'pickUp', target))).toEqual([]);
    expect(await inventory()).toContain(item);
    expect((await prop(page, target))?.visible).toBe(false);
  }
  expect(await said(() => combine(page, 'Knife', 'Bread'))).toEqual(["[Player] It won't do any good without something to spread!"]);
  expect(await said(() => combine(page, 'Knife', 'PB'))).toEqual(['[Player] I need to open the jar first.']);
  expect(await said(() => inventoryVerb(page, 'open', 'PB'))).toEqual(['[Player] I opened the jar.']);
  expect(await said(() => combine(page, 'Knife', 'PB'))).toEqual(['[Player] Mmmm... gooey peanut butter.']);
  expect(await said(() => combine(page, 'Knife', 'Bread'))).toEqual(['[Player] This looks delicious!']);
  expect(await inventory()).toContain('Sammich');
  expect(await inventory()).not.toContain('Bread');
  expect(await said(() => inventoryVerb(page, 'look', 'Sammich'))).toEqual(['[Player] It looks delicious!']);
  expect(await said(() => inventoryVerb(page, 'use', 'Sammich'))).toEqual(['[Player] I am not hungry right now.']);
  expect((await state(page)).activeItem).toBeNull();
  expect(await said(() => useItem(page, 'Sammich', 'penny', 'world', 'give'))).toEqual([
    '[Player] Here, Penny! Have a sandwich.',
    "[Character penny] Thank you! Here's the key.",
  ]);
  expect(await inventory()).not.toContain('Sammich');
  expect(await said(() => useItem(page, 'Broom', 'Couch', 'world', 'give'))).toEqual(['[Player] Here, couch.']);
  expect(await inventory()).not.toContain('Broom');

  // ── Couch and Penny demos: fades, a prop teleport, switching the player ──
  for (const [v, target] of [['close', 'Couch'], ['open', 'Couch'], ['talkTo', 'Couch'], ['open', 'penny']] as const) {
    expect(await said(() => verb(page, v, target)), `${v} ${target}`).toEqual([]);
  }
  await verb(page, 'push', 'penny');
  expect((await state(page)).player).toBe('penny');
  await verb(page, 'push', 'hank');
  expect((await state(page)).player).toBe('hank');

  // ── Out of the apartment ──
  expect(await said(() => useItem(page, 'Key', 'Door'))).toEqual(['[Player] The door is unlocked.']);
  expect((await state(page)).flags).toMatchObject({ unlockedDoor: true });
  expect(await said(() => verb(page, 'open', 'Door'))).toEqual([
    '[Character henry] Hey, Hank!',
    '[Character henry] Come here!',
    "[Player] What's up?",
    '[Character henry] Check out this fountain!',
    '[Player] What about it?',
    "[Character henry] I need you to turn it on. It's really important.",
    '[Player] Uh, ok.',
  ]);
  expect((await state(page)).room).toBe('outside');

  // ── Outside: the character script, the camera, the fountain puzzle ──
  expect(await look('henry')).toEqual(['[Player] It looks like my buddy, Henry.']);
  expect(await said(() => verb(page, 'pickUp', 'henry'))).toEqual(["[Player] He's too heavy."]);
  expect(await look('door')).toEqual(["[Player] It's the door to the apartment."]);
  expect(await look('FountainOff')).toEqual(["[Player] It's a fountain.", "[Player] It's not running."]);
  expect(await look('Rock')).toEqual(["[Player] It's a weird looking, out of place rock."]);
  expect(await said(() => verb(page, 'push', 'Rock'))).toEqual([
    '[Player] I think I can move it.',
    '[Player] Huh, some weird lever hidden under the rock.',
  ]);
  expect((await prop(page, 'Rock'))?.visible).toBe(false);
  expect((await prop(page, 'RockMoved'))?.visible).toBe(true);
  expect(await look('RockMoved')).toEqual(['[Player] I wonder what this lever does...']);
  expect(await said(() => verb(page, 'pull', 'RockMoved'))).toEqual([
    "[Player] Let's see what this does...",
    "[Character henry] WOO HOO! IT'S WORKING!",
  ]);
  expect((await state(page)).flags).toMatchObject({ turnedOnFountain: true });
  expect((await prop(page, 'FountainOn'))?.visible).toBe(true);
  expect((await prop(page, 'LeverPulled'))?.visible).toBe(true);
  expect(await look('FountainOn')).toEqual(['[Player] I got it working!.']);

  // ── Back in: the door closes behind Hank ──
  expect(await said(() => verb(page, 'use', 'door'))).toEqual([]);
  expect((await state(page)).room).toBe('apartment');
  expect((await prop(page, 'Door'))?.animation).toBe('room:apartment:Door');

  expect(errors).toEqual([]);
});

/** Opens the game menu and walks through its sub-menus (load, save, settings) and back. */
test('9-verb template menus', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await waitIdle(page);
  await menus(page, 'verbs');
  expect(errors).toEqual([]);
});
