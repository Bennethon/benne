/**
 * `@game`: game-wide handles. HAND-WRITTEN for the BenneScript Phase 1 spike, with only what
 * `rooms/cafe/cafe.room.ts` needs. Phase 3 generates this module from content JSON, assets and
 * `game-config.json` (docs/bennescript-ergonomics-refactor.md §7, §8) and deletes this file.
 */
import {
  DialogHandle,
  ItemHandle,
  MusicHandle,
  RoomHandle,
  SfxHandle,
  defineFlags,
  withVerbMethods,
  type ClickableHandle,
  type ItemRef,
  type StepHandler,
  type VerbSpec,
} from '@benne/script';

// ─── Verbs (from game-config.json) ───────────────────────────────────────────

const verbList: readonly VerbSpec[] = [
  { id: 'take' },
  { id: 'use', usesItem: true },
  { id: 'look' },
  { id: 'clean' },
  { id: 'talkTo' },
  { id: 'move' },
];

export interface GameVerbMethods {
  onTake(handler: StepHandler): void;
  onUse(handler: StepHandler): void;
  onUseItem(item: ItemRef, handler: StepHandler): void;
  onLook(handler: StepHandler): void;
  onClean(handler: StepHandler): void;
  onTalkTo(handler: StepHandler): void;
  onMove(handler: StepHandler): void;
}

/** Adds this game's verb methods to a clickable handle (what generated `.ids` modules do). */
export function withGameVerbs<H extends ClickableHandle>(handle: H): H & GameVerbMethods {
  return withVerbMethods<H, GameVerbMethods>(handle, verbList);
}

// ─── Content ─────────────────────────────────────────────────────────────────

export const rooms = {
  cafe: new RoomHandle('cafe'),
  plaza: new RoomHandle('plaza'),
};

export const items = {
  coffee: new ItemHandle<'coffee' | 'coffee-full'>('coffee'),
  relay: new ItemHandle('relay'),
  soda: new ItemHandle('soda'),
};

export const dialogs = {
  barista: new DialogHandle('barista', {
    greetingBarista: 'greeting barista',
    waitingCustomer: 'waiting customer',
    dirtyDishes: 'dirty dishes',
    highTechThing: 'high tech thing',
    helped: 'helped',
    bye: 'bye',
  }),
  customer: new DialogHandle('customer', {
    nicePlace: 'nice place',
    howLong: 'how long',
    takeOrder: 'take order',
    bye: 'bye',
  }),
};

export const sfx = {
  doorBells: new SfxHandle('doorBells'),
  pourCoffee: new SfxHandle('pourCoffee'),
  whip: new SfxHandle('whip'),
};

export const music = {
  cafe: new MusicHandle('cafe'),
};

/** Phase 4 moves these to `src/game/state.ts` (§4.7). Keys match the old scripts' flag names. */
export const flags = defineFlags({
  canWork: false,
  tookOrder: false,
  deliveredOrder: false,
});
