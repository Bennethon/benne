# BenneScript Ergonomics Refactor (Design Proposal)

_Written 2026-10-05. **Status: implemented** (Phases 0–7, 2026-10-05 to 2026-10-06, branch `bennescript-refactor`). Open design questions were resolved on 2026-10-05; every decision and deviation made while building it is in §13, and the sections carry "As built" notes where the result differs from the proposal._

> **This is now the design record.** The "TODAY" examples show the old `register*Script` / `B` API, which no longer exists; read them as history. For writing scripts, use the guide (`docs/public/bennescript.md`), the API reference generated from the code (`docs/bennescript-api.md`), and the `bennescript` agent skill (`.agents/skills/bennescript/SKILL.md`). How the pieces fit inside the engine is in `docs/architecture.md` §7. Progress per phase: `docs/bennescript-refactor-log.md`.

This document describes a redesign of BenneScript that **stays in TypeScript** but:

1. **fixes the sequencing problem**: script lines run in the order they're written, without typing `await`;
2. **cuts the typing friction**: no `B.character('…')`, no quoted IDs for game content, and dialogue written as `Hank: "Hello!"`.

It follows on from the feasibility study in `docs/feasibility-custom-language-and-native-editor.md`. The examples below are mostly rewrites of real scripts from the jam game **AI Apocalypse** (`~/Projects/ai-apocalypse`, 54 script files, ~3,300 lines). They show what that game would look like under the new design.

---

## Contents

1. [Goals](#1-goals)
2. [A first look](#2-a-first-look)
3. [How it works (three pieces)](#3-how-it-works-three-pieces)
4. [Language tour](#4-language-tour)
   - 4.1 [Files, imports and names](#41-files-imports-and-names)
   - 4.2 [Talking](#42-talking)
   - 4.3 [Moving and facing](#43-moving-and-facing)
   - 4.4 [Room lifecycle: enter, leave, first visits](#44-room-lifecycle-enter-leave-first-visits)
   - 4.5 [Verbs on props, hotspots and characters](#45-verbs-on-props-hotspots-and-characters)
   - 4.6 [Inventory](#46-inventory)
   - 4.7 [Game state: flags, variables, visits](#47-game-state-flags-variables-visits)
   - 4.8 [Dialogs](#48-dialogs)
   - 4.9 [Character scripts](#49-character-scripts)
   - 4.10 [Props and animation](#410-props-and-animation)
   - 4.11 [Sound, music, camera, fades, video](#411-sound-music-camera-fades-video)
   - 4.12 [Cutscenes, skipping and input](#412-cutscenes-skipping-and-input)
   - 4.13 [Doing things at the same time](#413-doing-things-at-the-same-time)
   - 4.14 [Regions and walkable areas](#414-regions-and-walkable-areas)
   - 4.15 [GUI scripting](#415-gui-scripting)
   - 4.16 [Saving, loading and settings](#416-saving-loading-and-settings)
   - 4.17 [The global script and fallbacks](#417-the-global-script-and-fallbacks)
   - 4.18 [Per-frame updates](#418-per-frame-updates)
   - 4.19 [Play From](#419-play-from)
   - 4.20 [Plain TypeScript and shared helpers](#420-plain-typescript-and-shared-helpers)
   - 4.21 [The event bus](#421-the-event-bus)
5. [Sequencing rules, precisely](#5-sequencing-rules-precisely)
6. [The build transform](#6-the-build-transform)
7. [Generated handles](#7-generated-handles)
8. [The verb system](#8-the-verb-system)
9. [Editor support](#9-editor-support)
10. [Runtime changes](#10-runtime-changes)
11. [Migration](#11-migration)
12. [Gotchas](#12-gotchas)
13. [Risks and decisions](#13-risks-and-decisions)
14. [Implementation plan](#14-implementation-plan)

---

## 1. Goals

**Primary goal: a fast, pleasant authoring flow.** Writing a scene during a two-week jam should feel close to writing a screenplay.

| Goal | Today | Proposed |
|---|---|---|
| Lines run in source order | ❌ `if`, flags and getters run at click time, before queued steps | ✅ every line runs after the one above it finishes |
| No `await` / `yield` typing | ✅ (but at the cost of the bullet above) | ✅ the build adds it |
| No quoted IDs for content | ❌ `B.character('jensen')`, `B.prop('Door')`, `B.inventory.add('wrench')` | ✅ `jensen`, `Door`, `items.wrench`, all autocompleted |
| Dialogue reads like a script | 🟡 `B.say\`…\`` blocks only | ✅ `Jensen: "NOT GREAT!"` anywhere |
| Typos caught before running | 🟡 ID unions on some APIs | ✅ every content reference is a typed identifier |
| One API surface (no `.now` twins with different timing) | ❌ | ✅ `.now` remains, but only means "don't wait" |
| Still TypeScript | ✅ | ✅ type checker, debugger, npm, AI assistants all keep working |

**Non-goals**
- Inventing a new file format or parser for scripts. Everything here is valid TypeScript syntax.
- Changing the content JSON (rooms, characters, GUIs, dialogs). It stays the source of truth, and the handles in §7 are generated from it.

---

## 2. A first look

A real handler from `ai-apocalypse/src/game/rooms/club/club.room.ts`:

```ts
// TODAY
B.whenInventoryUsedOn('club-hotspot-battery', (payload) => {
  if (B.state.getFlag(`askedAboutBattery`)) {
    if (payload.itemId === `soda`) {
      B.walkToClicked();
      B.player.say(`I hope this works.`);
      B.inventory.remove(`soda`);
      B.sound.play('sodaPour');
      B.wait(.75);
      B.player.say(`Hey! The corrosion is gone.`);
      B.player.say(`Now I need to tighten that cable.`);
      B.player.say(`Just need a 10mm socket wrench.`);
      B.dialog(`driver`).optionOn(`wrench`);
      B.state.setFlag(`batteryClean`, true);   // ⚠ actually runs at click time
      return;
    }
  }
  // … wrench branch …
  return false;
});
```

```ts
// PROPOSED
battery.onUseItem(items.soda, () => {
  if (!flags.askedAboutBattery) unhandled()
  walkToClicked()
  Hank: "I hope this works."
  inventory.remove(items.soda)
  sfx.sodaPour.play()
  wait(0.75)
  Hank: "Hey! The corrosion is gone."
  Hank: "Now I need to tighten that cable."
  Hank: "Just need a 10mm socket wrench."
  dialogs.driver.options.wrench.on()
  flags.batteryClean = true                  // runs here, after the lines above
})
```

The proposed version is valid TypeScript: it type-checks, autocompletes and debugs. Every name in it (`battery`, `items.soda`, `sfx.sodaPour`, `dialogs.driver`, `flags.batteryClean`) is generated from the game's JSON and assets, so a typo is a red squiggle.

---

## 3. How it works (three pieces)

```
 content JSON + assets ──► (1) handle generator ──► lab.ids.ts, @game (typed names)
                                                          │ imported by
 *.room.ts / *.dialog.ts / … ──► (2) Vite transform ──► async code with awaited steps + say()
                                                          │ runs on
                                 (3) step runtime: Task, cancellation, skip, interaction lock
```

1. **Handle generator** (extends today's `scripts/generate-game-ids.mjs`). It turns every room, prop, hotspot, character, point, region, item, dialog, dialog option, GUI, GUI control, sound, music track and verb into a typed object you reference by name. Verb handler methods are generated from `game-config.json` too. → §7, §8
2. **Sequencing transform** (a Vite plugin that runs before TypeScript is stripped). It makes handler bodies `async`, wraps each statement-level call in `await __step(…)`, and turns `Speaker: "line"` labels into `say` calls. → §6
3. **Step runtime** (replaces `interactionTail`). Timed actions return a `Task`. `__step` waits only on `Task`s, checks whether the interaction is still alive, and resolves instantly in skip mode. → §10

---

## 4. Language tour

> **Imports.** For readability, most examples below leave out import lines. In practice TypeScript's auto-import adds them as you type a name (`jen` → `jensen` + `import { jensen } from './lab.ids'`). §4.1 shows a full file once.

### 4.1 Files, imports and names

File kinds and names don't change: `*.room.ts`, `*.character.ts`, `*.inventory.ts`, `*.dialog.ts`, `*.gui.ts`, `globalScript.ts`. The `registerRoomScript(({ B }) => { … })` wrapper goes away. You register handlers at the top level of the file, and the engine attaches them when the room loads.

```ts
// src/game/rooms/cafe/cafe.room.ts
import { walkToClicked, faceClicked, inventory } from '@benne/script'
import { items, dialogs, rooms, sfx, music, flags } from '@game'
import { room, barista, customer, dishes, door, coffeemaker } from './cafe.ids'

room.onEnterAfterFade(() => {
  sfx.doorBells.play()
  music.cafe.play()
})

barista.onLook(() => {
  faceClicked()
  Hank: "Looks like the owner of the place."
  Hank: "He isn't doing much."
})

door.onUse(() => {
  walkToClicked()
  sfx.doorBells.play()
  rooms.plaza.goTo()
})
```

Where names come from:

| Import from | Contains | Example |
|---|---|---|
| `@benne/script` | Engine verbs and helpers | `walkToClicked`, `faceClicked`, `wait`, `say`, `display`, `inventory`, `player`, `camera`, `fadeOut`, `cutscene`, `background`, `together`, `unhandled`, `saves`, `settings`, `game` |
| `@game` (generated) | Game-wide content | `rooms`, `items`, `characters`, `dialogs`, `guis`, `sfx`, `music`, `video`, `verbs`, `fallbacks`, `flags`, `vars` |
| `./<room>.ids` (generated, next to the script) | This room's things | `room`, props, hotspots and characters in the room as flat names, plus `points`, `regions`, `walkables` |
| `./<dialog>.ids` / `./<gui>.ids` | This dialog's / GUI's things | `dialog`, `options` / `gui`, controls as flat names |

Why some names are flat and others are namespaced is explained in §7. In short: things you click in a room are flat, and everything else is grouped because AI Apocalypse alone has 11 IDs shared between two or more kinds of content.

### 4.2 Talking

**One line from a character: label syntax.** A label followed by a string is a speech line. The label can be the character's **ID or display name** (`name` in the character JSON), matched case-insensitively. `Player:` always means the active player.

```ts
Hank: "What the...?"
Jensen: "HOW'S IT GOING?!"
JENSEN: "NOT GREAT!"            // case doesn't matter
Player: "I have to find a way home!"
botti3: "Hello!"                // by ID
BOTTi3: "Hello!"                // by display name "BOTT-i3"
```

**Interpolation** uses backticks:

```ts
Hank: `I've got ${inventory.count(items.coin)} coins. That's not enough.`
```

**Multi-line blocks** keep today's tagged template, which is handy for long exchanges. Inside a block, IDs and display names can be written exactly as they appear in JSON, hyphens and spaces included:

```ts
say`
  Hank: Jensen! Stop!
  Jensen: You're too late, Hank.
  botti3-disembodied: Temporal displacement authorization denied.
  BOTT-i3 Disembodied: Authorization remains denied.
`
```

_As built (Phase 4, decision 31):_ the transform resolves a block's speakers at build time, with the same rules and errors as labels, and passes them to the runtime (`` say.__withSpeakers({…})`…` ``). Speakers built from `${…}` are resolved at runtime against the characters in the room.

**Method form** is still available when the speaker is a variable or you need options:

```ts
jensen.say("Humph!")
player.say("Uh, whatever.", { clickToSkip: false })
const speaker = flags.metBotti ? characters.botti3 : characters.botti3Disembodied
speaker.say("Hello, Hank.")
```

**Narration** in the display-text overlay:

```ts
display("The door is locked. AHH! I can't get out!")
display("Ok calm down.")
```

**How speaker names are matched.** Labels must be valid identifiers, so both the ID and the display name are normalised before matching: drop every character that isn't a letter or digit, then compare case-insensitively.

| Character JSON | Accepted labels (any case) |
|---|---|
| `id: "hank"`, `name: "Hank"` | `Hank:` |
| `id: "botti3"`, `name: "BOTT-i3"` | `botti3:`, `BOTTi3:` |
| `id: "botti3-disembodied"`, `name: "BOTT-i3 Disembodied"` | `botti3disembodied:`, `BOTTi3Disembodied:` |
| `id: "botti3-27"`, `name: "BOTT-i3 2027"` | `botti327:`, `BOTTi32027:` |

If a normalised label matches **more than one** character (e.g. one character's display name equals another's ID), the build fails and lists the candidates; use the other form or the method call (`characters.x.say(…)`) to disambiguate. Renaming a character's display name can therefore break labels that used it; the build reports exactly which ones.

### 4.3 Moving and facing

Every movement line finishes before the next line runs.

```ts
walkToClicked()                       // walk to the clicked thing's walk-to point
faceClicked()                         // turn toward it

player.walkTo(points.labPoint1)       // named room point
player.walkTo(couch)                  // a prop / hotspot / character's walk-to point
player.walkTo({ x: 120, y: 160 })     // raw room pixels
player.face('L')                      // 'U' | 'D' | 'L' | 'R' (completions insert the quotes)
player.moveTo(points.walkToCloset)    // teleport (instant)

jensen.walkTo(points.hallwayPoint2)
jensen.face('R')
jensen.startFollowing(player, { minDistance: 60 })
jensen.stopFollowing()
```

_As built (Phase 6, decision 45):_ the templates needed three more: `player.switchTo(penny)` hands control to another character in the room (instant, saved); `henry.startFacing(hank, { minWait, maxWait })` keeps a character turning toward another (the player by default) whenever either moves, and `stopFacing()` ends it.

_As built (Phase 6 follow-up, decision 50):_ `player` has `startFollowing` / `stopFollowing` too, and characters and `player` report `isFollowing` and `followingTarget` (a handle, or `player`). Where speech lines appear is per character: `jensen.speechPosition = { x, y }` (room pixels, bottom centre, instead of above the talk point), `jensen.speechOffset = { x, y }` (canvas pixels), `null` to clear either, `jensen.resetSpeechPosition()` for both. All are saved.

**Before / after: Hank and Jensen start walking at the same time** (from `plaza.room.ts`):

```ts
// TODAY
B.player.walkTo(`plaza-point-first-visit`);
B.character(`jensen`).walkTo.now(`plaza-point-first-visit-jensen`);  // fires at click time
B.wait(.5);
```

Today this works only because "click time" happens to be the moment Hank's walk starts. With any queued line before it (say, `B.player.say('Huh?')`), Jensen would start walking during the speech instead.

```ts
// PROPOSED: both start together; the scene continues when Hank arrives
jensen.walkTo.now(points.firstVisitJensen)   // start Jensen; don't wait
player.walkTo(points.firstVisit)             // Hank starts in the same frame; wait for Hank
wait(0.5)
```

```ts
// PROPOSED: both start together; the scene continues when BOTH have arrived
together(
  () => player.walkTo(points.firstVisit),
  () => jensen.walkTo(points.firstVisitJensen),
)
wait(0.5)
```

The idiom is **start what you don't want to wait for first, then the thing you do.** See §4.13 for all the ways to overlap actions.

### 4.4 Room lifecycle: enter, leave, first visits

```ts
room.onEnter(() => {               // before the fade-in: invisible setup
  ...
})
room.onEnterAfterFade(() => {      // after the fade-in: visible entrances, cutscenes
  ...
})
room.onLeave(() => { ... })
room.onLoaded(() => { ... })       // when a save loads into this room (instead of the enter hooks)
```

**`onEnter` is setup.** It runs before the fade-in, and the fade-in waits for it to finish. Timed actions like `walkTo` or a `say` line are allowed but rare there; that's what `onEnterAfterFade` is for.

**Arriving from different rooms** (from `plaza.room.ts`):

```ts
// TODAY
B.whenEnterRoom(() => {
  if (B.room.last === 'hallway' && B.room.isFirstVisit) {
    B.state.setFlag('left MIT first time', true);
    B.character('hank').moveToNow('plaza-point-enter-from-hall');
    B.character('jensen').moveToNow('plaza-point-enter-from-hall-jensen');
  } else if (B.room.last === 'hallway') {
    B.character('hank').moveToNow('plaza-point-enter-from-hall');
  } else if (B.room.last === 'gallery') {
    B.character('hank').moveTo('plaza-point-enter-from-gallery');
    B.player.face('D');
  }
  // …
  B.character('jensen').show();
});
```

```ts
// PROPOSED
room.onEnter(() => {
  if (room.cameFrom(rooms.hallway)) {
    hank.moveTo(points.enterFromHall)
    if (room.isFirstVisit) {
      flags.leftMitFirstTime = true
      jensen.moveTo(points.enterFromHallJensen)
    }
  } else if (room.cameFrom(rooms.gallery)) {
    hank.moveTo(points.enterFromGallery)
    hank.face('D')
  } else if (room.cameFrom(rooms.cafe)) {
    hank.moveTo(points.enterFromCafe)
    hank.face('D')
  }
  jensen.show()
})
```

**Changing rooms.** `goTo()` starts the transition and **ends the handler**, which is what you always want in practice. It's typed as returning `never`, so TypeScript greys out any code after it.

```ts
door.onUse(() => {
  walkToClicked()
  Hank: "Last room of the night. Let's finish this up and I can go home."
  wait(0.5)
  rooms.lab27.goTo()
})
```

**Other room info**

```ts
room.isFirstVisit        // boolean
room.visitCount          // number (settable, handy in Play From)
room.last                // RoomHandle | null
room.cameFrom(rooms.x)   // boolean
room.id                  // 'plaza'
```

_As built (Phase 4, decision 29):_ `room.visitCount` and `room.last` are settable, for Play From setups (`room.last = rooms.plaza`); `room.hasVisited` exists too.

_As built (Phase 7 audit, decision 52):_ `room.onLoaded` runs **only when a save loads into the room** (the `'load'` start kind), after `game.onLoadedAnyRoom`; the enter hooks don't run then. It does not run on ordinary room entry. _Decision 53:_ that is its purpose, so the example comment above now says so; per-visit setup goes in `onEnter`.

_As built (Phase 6 follow-up, decision 50):_ the enter hooks run as a skippable cutscene; `room.onEnter(fn, { skippable: false })` (also on `onEnterAfterFade`, `game.onEnterAnyRoom` and `game.onEnterAnyRoomAfterFade`) keeps ESC from skipping that phase. `game.onLoadedAnyRoom(fn)` runs for every room a save loads into, before the room's own `onLoaded`.

### 4.5 Verbs on props, hotspots and characters

Handler methods are **generated from the verbs in `game-config.json`**. AI Apocalypse's verbs (`look`, `use`, `take`, `talkTo`, `move`, `clean`) become `onLook`, `onUse`, `onTake`, `onTalkTo`, `onMove`, `onClean`. A 9-verb game gets `onOpen`, `onClose`, `onPush`, `onPull`, `onPickUp`, `onGive`, and so on. **Custom verbs work exactly the same way**: `clean` isn't one of the classic nine, but `onClean` is generated like any other. Using a verb your game doesn't have is a type error. The full verb-system changes, including custom item verbs like "Throw rock at window", are in §8.

```ts
filingCabinet.onLook(() => {
  faceClicked()
  Hank: "It's blocking the door."
})

filingCabinet.onMove(() => {
  walkToClicked()
  sfx.bodyFall.play()
  filingCabinet.animation = 'filingCabinet-over'
  filingCabinet.clickable = false
})

exitDoor.onUse(() => {
  walkToClicked()
  if (flags.escapedCloset || flags.allDone) {
    Hank: "I don't want to leave!"
    Hank: "I have to get back to my home time!"
  } else if (filingCabinet.animation === 'filingCabinet-over') {
    rooms.hallway.goTo()
  } else {
    Hank: "I can't squeeze past this filing cabinet."
  }
})
```

**One handler, several verbs** (from `cafe.room.ts`):

```ts
// TODAY
const notMyJob = () => { B.faceClicked(); B.say`Hank: I'm not on the job here.` };
B.whenUse('cleaning-stuff', notMyJob);
B.whenPickUp('cleaning-stuff', notMyJob);
B.whenVerb('clean', 'cleaning-stuff', notMyJob);
```

```ts
// PROPOSED
cleaningStuff.on(['use', 'take', 'clean'], () => {
  faceClicked()
  Hank: "I'm not on the job here."
})
```

**Falling through.** Calling `unhandled()` hands the interaction to the next handler in the chain (character script, then global fallback). It replaces `return false`, and like `goTo()` it ends the handler.

```ts
battery.onClean(() => {
  if (!flags.askedAboutBattery) unhandled()     // global "I don't need to clean that."
  walkToClicked()
  if (flags.batteryClean) {
    Hank: "It's already clean."
  } else {
    Hank: "I don't think my raw cleaning abilities will work here."
    Hank: "I need something with more punch."
  }
})
```

_As built (Phase 2, decision 22):_ after a room's verb handler, `unhandled()` continues with the character script's handler for that verb (characters only), then the global verb handler, then the global fallback. After a room's `on<Verb>Item` handler, it continues with the room's any-item handler, the global item handlers, then the "That doesn't work" fallback. In room lifecycle and dialog choice handlers there is nothing to fall through to, so it only ends the handler.

**Hotspots** have the same handlers, plus:

```ts
battery.active = true
battery.description = 'Corroded battery'
```

### 4.6 Inventory

```ts
inventory.add(items.wrench)
inventory.remove(items.soda)
inventory.add(items.coin, 3)
if (inventory.has(items.relay)) { ... }
inventory.count(items.coin)
inventory.items                                  // [{ item, quantity }]

items.coffee.animation = 'coffee-full'           // icon tag (autocompleted from Aseprite)
items.key.description = 'Now slightly bent.'
items.key.cursorAnimation = 'key-alt'

jensen.inventory.add(items.timeonium)            // an NPC's bag
```

**Using an item on something.** `onUseItem(item, …)` replaces `whenInventoryUsedOn` + `payload.itemId` chains + `return false`. Items without a handler fall through to the global fallback automatically.

```ts
// TODAY (cafe.room.ts)
B.whenInventoryUsedOn('cafe-hotspot-coffeemaker', (payload) => {
  if (payload.itemId === 'coffee') {
    B.walkToClicked();
    B.wait(1);
    B.sound.play('pourCoffee');
    B.inventory(`coffee`).animation = "coffee-full";
    B.player.say(`The best part of waking up!`);
    return;
  }
  return false;
});
```

```ts
// PROPOSED
coffeemaker.onUseItem(items.coffee, () => {
  walkToClicked()
  wait(1)
  sfx.pourCoffee.play()
  items.coffee.animation = 'coffee-full'
  Hank: "The best part of waking up!"
})
```

Variants:

`onUseItem` is generated because `use` is an item verb (`usesItem` in config, §8.2). Every item verb gets its own `on<Verb>Item`:

```ts
customer.onGiveItem(items.coffee, () => { ... })   // the "give" verb (if the game has one)
window.onThrowItem(items.rock, () => { ... })      // a custom item verb
customer.onItem(items.coffee, () => { ... })       // any item verb
customer.onAnyItem((item) => {                     // catch-all for this target
  faceClicked()
  Hank: `Why would I give him the ${item.name}?`
})
```

**Picking things up** (from `club.room.ts`):

```ts
antenna.onTake(() => {
  walkToClicked()
  hank.play('ReachR')            // one-shot animation, waits for it to finish
  antenna.hide()
  sfx.whip.play()
  inventory.add(items.antenna)
})
```

**Inventory item scripts** (`*.inventory.ts`). The item's own handle is its name in `items`.

```ts
// magnet.inventory.ts
items.magnet.onLook(() => {
  Hank: "A cute promotional magnet for the friendly AI overlord."
})

items.magnet.onCombine(items.antenna, () => {     // was whenInventoryUsedOn('magnet', …)
  inventory.remove(items.antenna)
  inventory.remove(items.magnet)
  sfx.whip.play()
  inventory.add(items.magnetStick)
  Hank: "Cool!"
})
```

```ts
// coffee.inventory.ts
items.coffee.onLook(() => {
  if (items.coffee.animation === 'coffee-full') {
    Hank: "A full cup of black coffee."
  } else {
    Hank: "An empty coffee cup."
  }
})
```

`onUse` / `onGive` on an item still arm it for "use on target" by default, as today. Use `items.key.onUse.doNotActivate(…)` to opt out.

_As built (Phase 6 follow-up, decision 50):_ every item handler takes `{ doNotClear: true }` as a last argument (`door.onUseItem(items.key, () => { … }, { doNotClear: true })`) to keep the item armed afterwards, whatever the drop policy says. `inventory.clear()` and `jensen.inventory.clear()` empty a bag.

### 4.7 Game state: flags, variables, visits

**Flags and variables are declared once**, with defaults, in `src/game/state.ts`. That gives autocomplete, typos become errors, and you no longer need to seed flags in the global script.

```ts
// src/game/state.ts
import { defineFlags, defineVars, flag } from '@benne/script'

export const flags = defineFlags({
  canCleanPaint: false,
  canWork: false,
  cleanedDishes: false,
  askedAboutBattery: false,
  batteryClean: false,
  batteryFixed: false,
  gotRegulator: false,
  allDone: false,
  escapedCloset: flag(false, { saveKey: 'escaped closet' }),   // only needed if released saves use the old key
})

export const vars = defineVars({
  coins: 0,
  playerName: '',
  timesAskedJensen: 0,
})
```

Using them:

```ts
flags.batteryClean = true
if (flags.askedAboutBattery && !flags.batteryClean) { ... }
vars.timesAskedJensen += 1
if (vars.timesAskedJensen > 3) {
  Jensen: "STOP ASKING ME THAT!"
}
```

Reads and writes go straight to `GameStateManager`, so they're saved, and they happen **at that line**. The sequencing bug class from today ("flag set after a `say` is visible while the line is still playing") disappears.

_As built (Phase 3, decision 26):_ `state.ts` is an ordinary module, not a script file, so the transform leaves it alone; `@game` re-exports its `flags` and `vars`. A flag declared with `flag(default, { saveKey })` is stored under `saveKey`. An array or object default in `defineVars` is copied into the game state the first time it is read, so `vars.list.push(x)` is saved and the default itself never changes. _As built (Phase 4, decision 37):_ AI Apocalypse's `state.ts` declares every flag. The flags whose old key had spaces (`'all done'`, `'escaped closet'`, …) keep it as their `saveKey`, because the baseline playthrough reads flags by key; the others kept their names. Two seeded flags nothing read (`cleanedDishes`, `servedMan`) were dropped.

Flags stay booleans. Variables must be JSON-compatible values (numbers, strings, booleans, arrays and plain objects of those), which keeps saves safe (see codex-suggestions §3).

**Visits**

```ts
room.isFirstVisit
room.visitCount
rooms.plaza.visitCount     // any room
rooms.plaza.hasVisited
```

**Other persistent state on handles.** The same properties exist today; they just stop being queued.

```ts
door.visible = false           // or door.hide() / door.show()
door.clickable = false
door.description = 'A broken door'
jensen.visible = true
jensen.movable = false
regions.enterCloset.active = true
walkables.upperLedge.active = false
```

### 4.8 Dialogs

Dialog JSON is unchanged (topics, options, text). Each option becomes a typed handle under `options` in the dialog's own `.ids` module, and under `dialogs.<id>.options` everywhere else. Option IDs are camelCased: `"what about AI"` → `options.whatAboutAI`.

**Starting a dialog** waits until the conversation ends, so code after `start()` runs once the player leaves the dialog:

```ts
jensen.onTalkTo(() => {
  walkToClicked()
  Jensen: "Well? Do you have the components yet??"
  dialogs.jensenInPlaza.start()
  // runs after the conversation closes
  if (flags.allDone) rooms.lab.goTo()
})
```

`dialogs.x.start.now()` opens a dialog without waiting.

**A dialog script** (rewrite of `jensen-in-hallway.dialog.ts`):

```ts
// TODAY
B.whenChoice("greeting", () => {
  B.character(`jensen`).say(`HOW'S IT GOING?!`);
  B.character(`jensen`).say(`The world has been taken over by an evil, totalitarian artificial intelligence and you ask me how's it going?!`);
  B.wait(.75);
  B.character(`jensen`).say(`NOT GREAT!`);
  B.dialog(`jensen-in-hallway`).optionOn(`what about AI`);
  B.dialog(`jensen-in-hallway`).optionOff(`greeting`);
});

B.whenChoice("its the future", () => {
  B.wait(1);
  B.character(`jensen`).say(`WHAT ARE YOU TALKING ABOUT?!`);
  B.character(`jensen`).say(`GO AWAY!`);
  B.dialog(`jensen-in-hallway`).stop();
  B.character(`jensen`).face(`U`);
  B.dialog(`jensen-in-hallway`).optionOff(`its the future`);
});
```

```ts
// PROPOSED
import { dialog, options } from './jensen-in-hallway.ids'

options.greeting.onChooseOnce(() => {          // "Once" turns the option off after choosing
  Jensen: "HOW'S IT GOING?!"
  Jensen: "The world has been taken over by an evil, totalitarian artificial intelligence and you ask me how's it going?!"
  wait(0.75)
  Jensen: "NOT GREAT!"
  options.whatAboutAI.on()
})

options.itsTheFuture.onChooseOnce(() => {
  wait(1)
  Jensen: "WHAT ARE YOU TALKING ABOUT?!"
  Jensen: "GO AWAY!"
  jensen.face('U')
  dialog.end()
})
```

`onChooseOnce` covers the very common "turn this option off after choosing it" pattern: 7 of the 9 choices in `jensen-in-hallway.dialog.ts` do it by hand. A `"once": true` field on the option in the dialog JSON would do the same declaratively.

**Option control**

```ts
options.whatAboutAI.on()
options.greeting.off()
options.greeting.enabled          // boolean
dialogs.barista.options.helped.on()   // another dialog's option, from anywhere
dialog.end()                      // was B.dialog('<self>').stop()
```

**Sub-dialogs return to the parent.** Because `start()` waits, a nested dialog naturally returns to its parent when it ends. The sub-dialog's "back" option just calls `dialog.end()`; it doesn't restart the parent. From `botti3.dialog.ts`:

```ts
options.aroundHere.onChoose(() => {
  Botti3: "Sure. What would you like to know?"
  dialogs.botti3LocalArea.start()      // when this ends, the botti3 choices reappear
})

options.bye.onChoose(() => {
  if (!flags.talkedWithBottieOnce) {
    Botti3: "Thanks for stopping by, Hank! It was good to see you again."
    Botti3: "Please accept this commemorative magnet that we offer to all first-time visitors."
    sfx.whip.play()
    inventory.add(items.magnet)
    Hank: "Ah, thanks."
    flags.talkedWithBottieOnce = true
  }
  Botti3: "Have a swell day!"
  dialog.end()
})
```

_As built (Phase 2, decision 19):_ a choice handler is **not** a cutscene, unlike the old `whenChoice`. The choice list is hidden while it runs and the open conversation already blocks world clicks, so the only difference is the skip key: wrap long choices in `cutscene(…)` to make them skippable. The reason is sub-dialogs: a choice that starts one waits for it, and a cutscene held during that wait would block the sub-dialog's choice buttons. When a sub-dialog ends, its parent comes back after the choice handler that started it has finished, so lines after `start()` play before the parent's choices reappear.

_As built (Phase 4, decisions 34 and 36):_ `dialog.onStart(…)` runs each time the conversation opens, before the player picks; AI Apocalypse's `jensen-in-plaza` uses it to swap the three "found" options for "found all". In the port, choices with six or more lines, a fade or a walk are wrapped in `cutscene(…)`, so ESC still skips them as it did with `whenChoice`.

**Changing the room during a conversation** works as today (props, hotspots and regions of the room the conversation is in), but with typed names imported from that room's `.ids` module:

```ts
options.door.onChoose(() => {
  Penny: "Bring me a sandwich and I'll give you the key."
  cabinet.show()
  inside.active = true
  options.door.off()
})
```

### 4.9 Character scripts

A character's handlers use the same syntax as room handlers. **Which file a handler lives in decides its scope**:

- `jensen.onLook(…)` in `lab.room.ts` applies in the lab only.
- `jensen.onLook(…)` in `jensen.character.ts` applies wherever Jensen is spawned.

The room handler still wins when both exist.

```ts
// penny.character.ts
penny.onLook(() => {
  Hank: "It's Penny."
})

penny.onTalkTo(() => {
  walkToClicked()
  dialogs.chatWithPenny.start()
})

penny.onUseItem(items.sandwich, () => {
  walkToClicked()
  Penny: "Finally!"
  inventory.remove(items.sandwich)
  inventory.add(items.key)
})
```

Empty character scripts (most of AI Apocalypse's ten) can simply be deleted. There's no `void B;` placeholder to keep.

_As built (Phase 3 naming, recorded in decision 52):_ in a character script the handle is `characters.penny` (from `@game`), not a flat `penny`: flat character handles exist only in room modules, where they register room-scoped handlers. The templates' `penny.character.ts` is `characters.penny.onLook(() => { Player: "It's Penny." })`. `characters.penny.onAnyItem((item, verb) => …)` works in a character script (listening on the engine's character any-item tier, after the room's own item handlers); until the Phase 7 follow-up it was ignored with a DEV warning.

_As built (decision 53):_ as specified above, a character script has its own character **flat**: the generator writes `characters/<id>/<id>.ids.ts` exporting `penny` (the same object as `characters.penny`), so `penny.character.ts` is `import { penny } from './penny.ids'` and then `penny.onLook(…)`. Other characters are still `characters.x` there. The rule across script files: each file gets its own thing flat (`room` and the room's contents, `dialog` / `options`, `gui` / controls, the character), and everything else through `@game`. Flat names are not available everywhere, because a flat character in a room script is the room-scoped one (§7.1), so a flat `penny` in another room or in `globalScript.ts` would have no clear scope. The Inspector writes `penny.onLook(…)` into character scripts.

### 4.10 Props and animation

| Call | Behaviour |
|---|---|
| `door.animation = 'Door-open'` | Set the base (looping) animation. Instant. Saved. |
| `door.play('doorOpen-play')` | One-shot animation, **waits** for it to finish, then returns to the base animation. |
| `door.play.now('doorOpen-play')` | Start the one-shot and continue. |
| `jensen.animation = 'WorkingU'` | Character animation override (instant, saved). |
| `jensen.stopAnimation()` | Back to directional idle. |
| `door.show()` / `door.hide()` / `door.visible` | Instant, saved. |
| `door.fade(0, 1.5)` | Fade to alpha 0 over 1.5 s, **waits**. `fade.now` to continue. |
| `door.alpha = 0.5` | Set opacity (0–1) at once; stops a running `fade`. Saved. Characters and `player` too (_decision 53_). |
| `door.moveTo({ x: 80, y: 90 })` | Teleport (instant). |
| `door.slideTo({ x: 80, y: 90 }, 2)` | Tween over 2 s, **waits**. |

Animation tag names are string-literal types generated from the Aseprite JSON, so the editor completes them (inserting the quotes) and a typo is an error.

**A smack-and-swap animation beat** (from `lab.room.ts`):

```ts
jensen.onUseItem(items.mop, () => {
  walkToClicked()
  cutscene(() => {
    Hank: "I'm going home."
    sfx.smack.play()
    smack.play('smack-play')       // waits for the one-shot to finish
    jensen.hide()
    wait(0.9)
    music.stop()
    wait(0.75)
    Hank: "Sorry, Jensen."
    music.gallery.play()
    ...
  })
})
```

_As built (decision 55):_ **a prop's or hotspot's state lives in its own room.** In that room, reads and writes go through the scene. From any other room, `visible`, `clickable`, `description`, `animation`, `alpha` and the position (`moveTo`) read and write that room's saved state, which the room applies when it loads. A `fade` or `slideTo` from another room jumps to its end state and doesn't wait; `play` warns and does nothing there. Reads fall back to the room JSON, which the generator passes to the handle (only the fields that differ from the defaults: `new PropHandle("cafe", "ghost", { visible: false, alpha: 0.4 })`). Before this, these went through whichever room was active, so they saved under that room's key and could change a prop with the same ID there (many rooms have a `bg`).

### 4.11 Sound, music, camera, fades, video

Sounds and music tracks are generated handles, so no quotes are needed:

```ts
sfx.doorOpen.play()             // starts; doesn't wait
sfx.doorOpen.playAndWait()      // waits until the sound ends
sfx.click.play({ volume: 0.5 })

music.lab.play()                // crossfades per config; doesn't wait
music.stop()
if (!music.isPlaying) music.plaza.play()
music.current                   // MusicHandle | null  (decision 35: `stop`, `isPlaying`, `current` are reserved music names)

camera.focus(timeChamber)       // pans; waits
camera.zoom(2, 1)               // zoom 2× over 1 s; waits
camera.shake(0.3)               // doesn't wait
camera.reset()

fadeOut()                       // waits
fadeOut(2, 0xffffff)            // 2 s fade to white
fadeIn()

video.intro.playAndWait()
video.intro.play()
```

**The lab's whip-whip-whip handover** (from `lab.room.ts`) shows sequencing paying off:

```ts
Hank: "I guess I have no choice."
for (const part of [items.relay, items.regulator, items.lens, items.timeonium]) {
  wait(0.5)
  sfx.whip.play()
  inventory.remove(part)
}
wait(0.5)
Jensen: "Good. Good. Yes this is exactly what I need."
```

A plain `for` loop works because loops inside handlers are sequenced like any other statement. Today the loop would run at click time, so this has to be written out by hand.

_As built (Phase 6 follow-up, decision 50):_ a room shows one video at a time, so `video` has controls for whichever plays, next to its videos: `video.pause()`, `resume()`, `seek(seconds)`, `stop()`, `isPlaying`, `current` (and `video.intro.isPlaying`). `sfx.door.isPlaying` and `sfx.stopAll()` complete the sound side. The generator reserves these names in their namespaces, as it does `music.stop` / `isPlaying` / `current`.

### 4.12 Cutscenes, skipping and input

`cutscene(…)` marks a block as skippable. While it runs:

- **Clicks on the world are ignored.** Nothing the player clicks starts a new interaction or interrupts the cutscene (the interrupt policy in §5, rule 9).
- **Click-to-skip dialogue still works**, exactly as today. A click dismisses the current speech line (when `settings.clickToSkip` is on) and the cutscene moves on to its next step. It does not skip the rest of the cutscene.
- **The skip key fast-forwards the whole block.** Speech is dismissed, `wait`s return immediately, and walks and animations snap to their end state. Execution then continues after the block.

```ts
room.onEnterAfterFade(() => {
  if (!room.isFirstVisit) {
    music.lab.play()
    return
  }
  cutscene(() => {
    sfx.timeTravelBack.play()
    doorOpen.play('doorOpen-play')
    doorOpen.hide()
    hank.show()
    wait(0.5)
    Hank: "What the...?"
    wait(0.25)
    BOTTi3Disembodied: "Hello, Hank. Do not be alarmed."
    player.walkTo(points.labPoint1)
    Hank: "Hello?"
    wait(0.5)
    player.face('R')
    Hank: "Who said that?"
    BOTTi3Disembodied: "I am BOTT-i3, your friendly municipal control AI."
    player.face('L')
    BOTTi3Disembodied: "You have inadvertently traveled ten years into the future."
    Hank: "WHAT?!"
    // …
  })
  camera.reset()
  music.lab.play()
})
```

**Input control** outside cutscenes:

```ts
input.disabled = true
...
input.disabled = false

withInputDisabled(() => {   // re-enabled automatically, even if the room changes
  ...
})
```

**Click-to-skip waits.** `opening.room.ts` is about 110 lines of tween callbacks to fade paragraphs in and out with click-to-advance. With steps and two small engine primitives (`fadeTo` with `clickToSkip`, and `waitForClick`), it becomes:

```ts
room.onEnter(() => guis.verbs.hide())

room.onEnterAfterFade(() => {
  music.intro.play()
  const text = guis.openingText.controls.text
  text.alpha = 0
  guis.openingText.show()

  cutscene(() => {
    for (const paragraph of paragraphs) {
      text.text = paragraph
      text.fadeTo(1, 1.2, { clickToSkip: true })
      waitForClick({ timeout: 10 })
      text.fadeTo(0, 1.2, { clickToSkip: true })
    }
  })
  rooms.hallway27.goTo()
})
```

_As built (Phase 4):_ exactly this, in `opening.room.ts` (`fadeTo` / `tweenTo` take seconds). One visible difference from the old tween code: a click during a fade-in now only finishes that fade, so skipping a paragraph early takes two clicks instead of one.

### 4.13 Doing things at the same time

By default everything waits. Every way to overlap work is built on one rule: **an action starts at the line where it's written.** `.now` and `background` only decide whether the script waits for it.

| You want… | Write |
|---|---|
| A and B to start together, continue when **B** finishes | `A.now(…)` then `B(…)` |
| A and B to start together, continue when **both** finish | `together(() => A(…), () => B(…))` |
| A to start, continue immediately, wait for it later | `const t = A.now(…)` … `t.wait()` |
| A multi-step sequence to run alongside the scene | `background(() => { … })` |

```ts
// 1. Start one action and keep going: .now
jensen.walkTo.now(points.labPoint1)
Hank: "Where's he going?"

// 2. Start now, wait later: .now returns a Task
const walk = jensen.walkTo.now(points.labPoint1)
Hank: "Jensen, wait!"
walk.wait()                  // statement-level, so it waits; no `await` needed
Jensen: "What?"

// 3. Several things together; continues when all finish
together(
  () => player.walkTo(points.timeChamber),
  () => camera.focus(timeChamber),
  () => music.fadeOut(2),
)

// 4. A whole sequence in the background
background(() => {
  for (let i = 0; i < 3; i++) {
    sfx.click.play()
    wait(0.33)
  }
})
Jensen: "Why isn't this working?"
```

Sounds and music `play()` never block, so they never need `.now`.

_As built (Phase 2, decision 21):_ a `background` block runs on its own interaction context. It keeps the click it was started from (so `walkToClicked()` works inside it), it doesn't take the interaction lock or count as "busy" for idle detection, and it doesn't block saving. A room change or save load stops it. The handler that started it ending, or being interrupted, does not.

### 4.14 Regions and walkable areas

```ts
regions.enterCloset.onEnter(() => rooms.closet.goTo())

regions.garageExit.onEnter(() => {
  if (flags.gotRegulator) {
    Hank: "I don't think I want to go back in there."
  } else {
    rooms.club.goTo()
  }
})

regions.jensenMoveRight.onEnter((who) => {      // was ctx.characterId === 'hank'
  if (who === hank) jensen.walkTo(points.jensenRightSide)
})

regions.darkness.onExit(() => { ... })
regions.enterCloset.active = true
walkables.upperLedge.active = false
```

_As built (Phase 4, decision 30):_ `who` is the room module's own handle for that character (so `who === hank` works), or `characters.x`. Regions fire for every character, as before, so check `who.isPlayer` when only the player should trigger one. A region handler is a gameplay handler: one that only sends an NPC somewhere should use `jensen.walkTo.now(…)`, or it holds the interaction lock while the NPC walks. Characters and `player` also have `stopWalking()` and `position` (feet, in room pixels).

Region IDs are camelCased, and the generator strips a leading room-ID prefix: `plaza-region-garage-exit` → `regions.garageExit`, `club-hotspot-battery` → `battery`. This mattered in practice: AI Apocalypse prefixes most hotspot, point and region IDs with the room name.

### 4.15 GUI scripting

GUI controls become typed handles in the GUI's own `.ids` module. Events are methods on the controls. Other GUIs are reached through `guis`.

**Menu buttons** (from `game-menu.gui.ts`):

```ts
// PROPOSED
import { gui, quit, resume, settingsBtn, save, load, titleScreen } from './game-menu.ids'

gui.onShow(() => {
  quit.visible = game.isDesktop
  quit.enabled = game.isDesktop
})

quit.onClick(() => game.quit())
resume.onClick(() => gui.hide())
settingsBtn.onClick(() => { guis.settingsMenu.show(); gui.hide() })
save.onClick(() => { guis.saveMenu.show(); gui.hide() })
load.onClick(() => { guis.loadMenu.show(); gui.hide() })
titleScreen.onClick(() => rooms.title.goTo())
```

The `settings` button has `"scriptName": "settingsBtn"` in `game-menu.gui.json`: a control named `settings` would shadow the `settings` helper (§7.2).

**Sliders and checkboxes** (from `settings-menu.gui.ts`):

```ts
gui.onBuilt(() => {
  sfxVolume.value = settings.sfxVolume * 100
  musicVolume.value = settings.musicVolume * 100
  textSpeed.value = toSlider(settings.textSpeed)
})

sfxVolume.onChange((v) => { settings.sfxVolume = v / 100 })
musicVolume.onChange((v) => { settings.musicVolume = v / 100 })
textSpeed.onChange((v) => { settings.textSpeed = fromSlider(v) })
clickToSkip.onChange((checked) => { settings.clickToSkip = checked })

back.onClick(() => {
  gui.hide()
  if (game.currentRoom !== rooms.title) guis.gameMenu.show()
})
```

**The verb bar** (from `verbs.gui.ts`). Verb buttons map directly to verb handles:

```ts
import { gui, verbLine, lookAtBtn, useBtn, takeBtn, talkToBtn, moveBtn, cleanBtn, menuBtn } from './verbs.ids'

const buttons = new Map([
  [verbs.look, lookAtBtn], [verbs.use, useBtn], [verbs.take, takeBtn],
  [verbs.talkTo, talkToBtn], [verbs.move, moveBtn], [verbs.clean, cleanBtn],
])

for (const [verb, button] of buttons) button.onClick(() => verb.select())
menuBtn.onClick(() => guis.gameMenu.show())

pointer.onContextChange(() => {
  verbLine.text = pointer.sentence            // "Use Coffee on Coffee maker"
  for (const [verb, button] of buttons) {
    button.visualState = pointer.hover?.defaultVerb === verb ? 'hover' : 'normal'
  }
})
```

`pointer.sentence` would be a new engine helper that builds the standard "Verb Item prep Target" line. Today every game re-implements it.

_As built (Phase 4, decisions 32–33):_ `pointer.sentence` uses the engine's `composeVerbLineText`; `pointer.hover` is `{ kind, id, description, defaultVerb }` with `defaultVerb` a `verbs.x` handle (the target's own, else the game's), and `pointer.verb` / `pointer.item` are handles; `pointer.item` is settable (`pointer.item = null` drops the armed item, decision 45). `onContextChange` handlers register once and survive room changes. GUI handlers also register once, at module top level; every GUI overlay now gets a runtime, `gui.onBuilt` runs each time a room builds the GUI, and `onShow` / `onHide` run on any script show or hide (old API or new). Controls: `text`, `alpha`, `visible`, `x`, `y`, `enabled`, `value`, `checked`, `selectedIndex`, `setRowText()`, `visualState`, `fadeTo()` / `tweenTo()` (seconds, waits; `{ clickToSkip }`), `onClick` (sequenced, no gameplay lock), `onChange` (slider number, text input text or checkbox `checked`, immediate), `onSelect` (list boxes), `onMouseEnter` / `onMouseLeave`. `gui.root` is the GUI's packed content as one control; `gui.fadeIn()` / `fadeOut()` wait. _As built (Phase 6 follow-up, decision 50):_ `gui.onAnyClick((button) => …)` runs for any button in the GUI (after its own `onClick`); text inputs have `onSubmit((text) => …)` (Enter) and `focused`; list boxes `onActivate((index) => …)` (double-click, or Enter) and `rowCount`; `enabled` covers checkboxes too. The three new handlers are sequenced and non-gameplay, like `onClick`.

**List boxes and text inputs** are covered in §4.16.

**GUI handlers don't block gameplay.** GUI button handlers are sequenced like any other handler (so `guis.x.fadeIn()` then `wait(1)` works), but they don't take the gameplay interaction lock. Pausing the game menu doesn't fight a running cutscene. Hover handlers (`onMouseEnter` / `onMouseLeave`) stay immediate, as today.

**Driving a GUI from a room script:**

```ts
room.onEnter(() => {
  guis.verbs.hide()
  guis.titleButtons.show()
})

guis.credits.show()
guis.credits.fadeIn(1)          // waits
guis.inventoryBar.controls.coins.text = `${vars.coins}`
```

### 4.16 Saving, loading and settings

```ts
saves.list()                       // [{ slot, name, timestamp }]
saves.get(2)                       // one slot or undefined
saves.save(2, 'Before the lab')    // waits until written
saves.load(2)                      // ends the handler; the game reloads
saves.delete(2)
saves.autosave()
game.newGame(rooms.opening)        // was B.state.reset() + changeTo; ends the handler
game.quit()                        // no-op in browsers
game.isDesktop
```

**Save menu** (rewrite of `save-menu.gui.ts`, 102 lines today):

```ts
import { gui, savedList, saveName, saveBtn, backBtn } from './save-menu.ids'

const SLOTS = 5
let selected = 0

function refresh(autoSelect = false) {
  for (let i = 0; i < SLOTS; i++) {
    savedList.setRowText(i, saves.get(i)?.name ?? `(Empty Slot ${i + 1})`)
  }
  if (autoSelect) selected = firstEmptySlot() ?? SLOTS - 1
  savedList.selectedIndex = selected
  saveName.text = saves.get(selected)?.name ?? ''
  saveBtn.enabled = saveName.text.trim() !== ''
}

const firstEmptySlot = () =>
  [...Array(SLOTS).keys()].find((i) => !saves.get(i))

gui.onBuilt(() => refresh(true))
gui.onShow(() => refresh())

savedList.onSelect((i) => { selected = i; refresh() })
saveName.onChange((v) => { saveBtn.enabled = v.trim() !== '' })

saveBtn.onClick(() => {
  saves.save(selected, saveName.text.trim())
  gui.hide()
  guis.gameMenu.show()
})

backBtn.onClick(() => { gui.hide(); guis.gameMenu.show() })
```

**Load button** (from `load-menu.gui.ts`):

```ts
loadBtn.onClick(() => {
  if (!saves.get(selected)) return
  gui.hide()
  guis.gameMenu.hide()
  saves.load(selected)            // ends the handler
})
```

**When saving is allowed.** Because handlers now run as explicit steps, the engine always knows whether a gameplay interaction is in progress. **Saving is refused while one is running** (any room, character, inventory, dialog or global handler, including cutscenes). This replaces today's "whatever `GameStateManager` holds at that moment".

- `saves.canSaveNow` is `false` during an interaction. Save menus use it to disable their Save button.
- `saves.save(…)` called while `canSaveNow` is `false` does nothing and logs a DEV warning. It doesn't throw, so a stray call can't break a GUI handler.
- An open dialog counts as an interaction, so players can't save mid-conversation.
- GUI handlers don't count. Opening the game menu and saving between interactions works as normal.

```ts
gui.onShow(() => {
  saveBtn.enabled = saves.canSaveNow && saveName.text.trim() !== ''
})
```

Snapshotting the last idle state instead (so saving is always available) may be revisited later; see §13.

_As built (Phase 2, decision 20):_ `canSaveNow` is also false during a room transition. A handler waiting on a dialog it started still counts. `saves.load()` stops every other running handler before the snapshot replaces the state, and any snapshot load or new game (including from the old `B` API) does the same. `saves.list()` / `get()` cover numbered slots only.

_As built (Phase 4, decision 34):_ `game.newGame(startRoom?)` takes the room to start in (default: `startingRoomId` from the config), because AI Apocalypse's title screen starts in the opening, not in its starting room.

**Settings**

```ts
settings.sfxVolume       // 0–1
settings.musicVolume
settings.textSpeed       // was B.speechSettings.durationMultiplier
settings.clickToSkip
```

_As built (Phase 6 follow-up, decision 50):_ every speech and dialog setting from `game-config.json` can be overridden at runtime, under the config's own names: `settings.speech.showText`, `msPerCharacter`, `durationMultiplier`, `minDurationMs`, `maxDurationMs`, `defaultTalkOffset`, `clickToSkip`, and `settings.dialog.choiceOptionsViewportHeightPx` / `usedColor` (`undefined` goes back to the config). `settings.onChange(fn)` runs after any setting changes. Saves take a slot or a name, as before the refactor: `saves.save('checkpoint')`, `saves.load('checkpoint')`, `saves.delete(…)`, `saves.get(…)`; `saves.list()` lists both (`slot: null` for a named save). `saves.rename(save, name)`, `saves.export()` (JSON) and `saves.import(json)` (loads it like `saves.load`, ending the handler) complete it.

_As built (decision 53):_ **`saves.autosave(save = 'Autosave')`** saves as soon as saving is allowed: at once when `saves.canSaveNow` is true, otherwise at the first frame after the running interaction, dialog or room transition ends. So it works where `saves.save` is refused (decision 2), such as `room.onEnter` and cutscenes: `room.onEnter(() => { saves.autosave() })` saves once the room has settled. It takes a name or a slot (`saves.autosave('Chapter 2')`, `saves.autosave(0)`), doesn't wait, and a later call replaces one still pending; loading a save or starting a new game drops a pending one. (Until decision 53 there was no `autosave`, decision 52.)

### 4.17 The global script and fallbacks

Flag seeding moves to `state.ts` (§4.7), which leaves only behaviour here:

```ts
// globalScript.ts
import { game } from '@benne/script'
import { fallbacks } from '@game'      // generated: one method per configured verb (§8.2)

fallbacks.onLook(() => { Player: "Nothing special about that." })
fallbacks.onUse(() => { Player: "That doesn't work." })
fallbacks.onTake(() => { Player: "I can't take that." })
fallbacks.onTalkTo(() => { Player: "I don't have anything to say to that." })
fallbacks.onClean(() => { Player: "I don't need to clean that." })
fallbacks.onMove(() => { Player: "It doesn't move." })

fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine })
fallbacks.onItemUnhandled(() => { Player: "That doesn't work." })

game.onEnterAnyRoom((from) => { ... })
game.onEnterAnyRoomAfterFade(() => { ... })
game.onLeaveAnyRoom(() => { ... })
```

AI Apocalypse's `globalScript.ts` goes from 111 lines to about 15.

Note the braces: `() => { Player: "…" }`. A label needs statement position, so it can't be used as a concise arrow body (§12).

_As built (Phase 6 follow-up, decision 50):_ `fallbacks.onUnhandled((verb, target) => …)` is the last tier: a verb nothing handled, not even `onAnyVerb` (the 9-verb template's old DEV diagnostic). `game.isCutsceneActive` is true while a cutscene or a room's enter hooks run.

### 4.18 Per-frame updates

```ts
onUpdate((dt) => {
  if (flags.alarmOn) alarmLight.alpha = 0.5 + 0.5 * Math.sin(game.time * 6)
})
```

`onUpdate` callbacks are **not** sequenced: they run synchronously every frame. Timed actions (`walkTo`, `say`, `wait`) inside them are an error, at build time where the transform can see them and at runtime otherwise. To start a sequence from a frame check, use `background(() => …)`.

_As built (decision 53):_ `onUpdate` callbacks run in a frame context, and **any timed action started there throws `TimedActionInUpdateError`** (the blocking form and `.now` alike), logged once per callback, not every frame; the rest of that callback doesn't run. A `background(() => …)` block started from the callback gets its own context, so timed actions inside it work. At build time, a speech label there fails the build (it is outside a step function), and the ESLint rule `bennescript/no-unwaited-timed-call` (§6.3) reports other timed calls by type. An ending call (`goTo`) just stops the callback. `onUpdate` is global (it runs in every room, decision 40) and receives the frame's seconds: `onUpdate((dt) => …)`. Props and characters have a settable **`alpha`** (instant, saved, and it stops a running `fade`), so the example above works as written. (Decision 52 recorded the earlier gaps: no runtime check, and no `alpha` property.)

_As built (decision 54):_ each `onUpdate` callback has its own frame context. The guard covers speech labels too (they go through `timed()` like any action), and a step-function helper called from the callback stops at the step that failed: the error is reported and the helper's promise never settles, so `if (x) helper()` in a block body doesn't leave an unhandled rejection every frame. `unhandled()` and ending calls just stop the callback. A failing callback is logged once per distinct message, and after five different messages (one with a changing value in it) it is logged as silenced. The instant forms for frame code: `x.alpha = …` (not `fade`), `x.startFacing(target)` to keep a character turned toward another, `x.facing` to read the direction (start a guarded `background(() => x.face(…))` to turn), and `saves.autosave()` (not `saves.save`). A new `alpha` or `fade` stops a running fade, which then settles, so a handler waiting on it carries on.

### 4.19 Play From

`playFrom` blocks set up state instantly before the room starts, as today. They stay keyed by a display string because that's what appears in the editor's dropdown.

```ts
playFrom('fix battery', () => {
  flags.askedAboutBattery = true
  flags.batteryClean = true
  inventory.add(items.wrench)
  battery.active = true
})

playFrom('go time', () => {
  room.visitCount = 3
  flags.allDone = true
  flags.escapedCloset = true
  inventory.add(items.mop)
  regions.cantWalk.active = false
  closetOpen.show()
})
```

_As built (Phase 4, decision 29):_ `playFrom` is a top-level call in a room script; it belongs to the room whose module is loading. It runs as a non-gameplay handler, so its lines are sequenced too.

### 4.20 Plain TypeScript and shared helpers

Script files are still TypeScript. Constants, types, `Map`s, helper functions, `Math.random()` and npm packages all work.

```ts
const insults = ["You fool!", "Imbecile!", "Amateur!"]
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

jensen.onTalkTo(() => {
  walkToClicked()
  Jensen: pick(insults)
})
```

**Local helper functions are sequenced too.** A function defined in a script file is a "step function": calling it runs its steps in order and waits.

```ts
function handOver(part: ItemHandle) {
  wait(0.5)
  sfx.whip.play()
  inventory.remove(part)
}

handOver(items.relay)       // waits for all three lines inside
handOver(items.regulator)
```

**Shared helpers across files** go in `*.script.ts` files (e.g. `src/game/scripts/doors.script.ts`). The transform treats them like script files, and calls to them from other script files are awaited.

```ts
// src/game/scripts/doors.script.ts
export function openDoorTo(door: PropHandle, target: RoomHandle) {
  walkToClicked()
  door.animation = 'open'
  sfx.doorOpen.playAndWait()
  target.goTo()
}
```

Ordinary `.ts` files (math utilities, data tables) are untouched. They can't use timed actions, and the type of the call tells you which is which (§6.3).

### 4.21 The event bus

`events` (from `@benne/script`, decision 50) is the game's event bus, the old `B.raw`. Scripts listen to engine events (state changes, dialogs, unhandled verbs) and send each other their own.

```ts
events.on('gameState:inventoryChanged', () => { coins.text = `${inventory.count(items.coin)}` })
events.on('alarm', (level: number) => { Hank: `Alarm level ${level}!` })
events.emit('alarm', 3)
events.once('benne:dialog:stopped', () => { … })
events.off('alarm', listener)
```

Listeners run immediately with the event's arguments, and their own lines are sequenced. In a room script a listener is live only while that room is active; anywhere else, for the whole game. The editor completes the engine's event names; any other string works too.

---

## 5. Sequencing rules, precisely

1. **A handler body runs top to bottom.** Each statement starts after the previous one has finished.
2. **"Finished"** means: for a timed action (walk, say, display, wait, one-shot animation, fade, tween, camera move, `playAndWait`, dialog `start`, `saves.save`), when that action completes; for anything else, immediately.
3. **`.now` starts a timed action and returns a `Task` without waiting.** The action starts **at that line**, not at click time.
4. **`Task.wait()`** waits for a `.now` task later in the handler.
5. **`goTo()`, `saves.load()`, `unhandled()` and `dialog.end()` end the handler.** They are typed `never`.
6. **Reads see the current world.** `flags.x`, `door.visible`, `inventory.has()` and `room.last` reflect everything above them in the handler.
7. **Cancellation.** If the room changes or a save loads while a handler is waiting, the handler stops at its current step. Code after that point never runs against the new room.
8. **Skip mode** (inside `cutscene`). Timed actions complete instantly and apply their end state, and `wait` returns immediately.
9. **One gameplay interaction at a time.** When the player clicks the world while an interaction is running:
   - **while the handler is still on its opening walk** (`walkToClicked()` or a `player.walkTo(…)` that is its first timed step), the click **cancels** the running handler and starts the new interaction. This matches SCUMM: you can change your mind while Hank is still walking over.
   - **once anything else has started** (a speech line, a wait, an animation, a second walk), the click is **ignored** until the handler finishes.
   - **inside `cutscene`**, world clicks are always ignored, even during a walk. Click-to-skip on speech lines keeps working (§4.12).

   GUI handlers and `background` blocks run alongside and don't take the lock.

   _As built (Phase 2, decision 18):_ "clicking the world" means a click that would start a walk or an interaction: a background walk, a verb or item on a prop, hotspot or character, and a verb on an inventory row. Clicks that only clear the armed verb or item are UI and always work. The opening walk is a first timed step that is a walk of the active player (`walkToClicked()`, `player.walkTo(…)`, or `x.walkTo(…)` where `x` is the player). If that walk is dropped for any other reason outside a cutscene, the handler is cancelled too. Handlers on the old `B` API keep their old behaviour (they never block clicks).

**What blocks**

| Waits (timed) | Doesn't wait (instant) |
|---|---|
| `walkTo`, `walkToClicked`, `faceClicked`*, `face`* | `moveTo` (teleport), `show`, `hide`, `visible =` |
| `say`, `Speaker: "…"`, `` say`…` ``, `display` | `animation =`, `alpha =`, `clickable =`, `active =`, `description =` |
| `wait`, `waitForClick` | `flags.x =`, `vars.x =`, all reads |
| `play` (one-shot anim), `fade`, `slideTo`, `fadeTo` | `sfx.x.play()`, `music.x.play()`, `music.stop()` |
| `sfx.x.playAndWait()`, `video.x.playAndWait()` | `camera.shake()` |
| `camera.focus`, `camera.zoom` | `inventory.add/remove` (the GUI may animate, but the script doesn't wait) |
| `fadeOut`, `fadeIn` | `options.x.on/off`, `guis.x.show/hide` |
| `dialogs.x.start()`, `saves.save()` | any `.now(...)` call |
| `together`, `cutscene`, `Task.wait()`, step functions | `background(...)` (returns a `Task`) |

\* Turning takes a few frames when facing animations exist.

_As built (decision 53):_ `player.face(…)` and `jensen.face(…)` are timed actions like `faceClicked()`, with a `.now` form. Turning is still instant, so the wait ends at once, but scripts are already written to wait for it, so turning animations can be added later without changing them. A turn (`face` or `faceClicked`) doesn't end a handler's opening-walk phase (rule 9): a player walk after it still counts as the opening walk, so a click can still interrupt it. (Decision 52 recorded that `face` was instant and didn't wait.) _Decision 54:_ `face` stays timed, so it can't start in `onUpdate`; frame code uses `startFacing` (now on `player` too) or reads the new `facing` property.

---

## 6. The build transform

### 6.1 Where it runs

The transform is a Vite plugin with `enforce: 'pre'`, so it runs before TypeScript is stripped. It applies to `*.room.ts`, `*.character.ts`, `*.inventory.ts`, `*.dialog.ts`, `*.gui.ts`, `*.script.ts` and `globalScript.ts`. Every bundle (game, previews, BENNE Play, desktop) uses the same plugin. This is one more reason for the single multi-entry Vite config recommended in `docs/engine-review-2026-10.md` §4.1.

Implementation: parse with `oxc-parser` (Vite 8 already ships Oxc) or the TypeScript compiler API, edit with `magic-string`, and emit source maps so breakpoints and stack traces point at the original lines.

_As built (Phase 1):_ the transform is `scripts/lib/bennescriptTransform.mjs` (pure, unit-tested), wrapped by the Vite plugin in `vite-plugin-bennescript.ts`. It parses with Oxc through Vite's own `parseAst` export, edits with `magic-string`, and keeps every source line on the same line (the runtime import is appended at the end of the file). It is registered once in `vite.config.ts`; BENNE Play and the four editor previews merge that config. While the old API still existed, a script file was only transformed if it imported `@benne/script`, `@game` or a `.ids` module (decision 14). _As built (Phase 6, decision 46):_ every script file is transformed, and `items.x.onUse.doNotActivate(…)` callbacks are step functions too.

### 6.2 What it does

```ts
// Source
battery.onUseItem(items.soda, () => {
  if (!flags.askedAboutBattery) unhandled()
  walkToClicked()
  Hank: "I hope this works."
  inventory.remove(items.soda)
  wait(0.75)
  flags.batteryClean = true
})
```

```ts
// Output (as built in Phase 1; same lines as the source)
battery.onUseItem(items.soda, async () => { const __$ = __bs.ctx();
  if (!flags.askedAboutBattery) await __$.step(() => unhandled())
  await __$.step(() => walkToClicked())
  await __$.step(() => __bs.say("hank", "I hope this works."))
  await __$.step(() => inventory.remove(items.soda))
  await __$.step(() => wait(0.75))
  flags.batteryClean = true
})
// …
import { __runtime as __bs } from "@benne/script";
```

The context is called `$` in the rest of this document; the emitted name is `__$` so it can't clash with an author's `$`.

The rules:

1. **Step functions.** These become `async` and pick up the interaction context on entry (`const __$ = __bs.ctx()`). Their parameter lists are unchanged, so `onAnyItem((item) => …)` and `regions.x.onEnter((who) => …)` keep their arguments, and a step function can be passed to a registration API as a value (`door.onUse(openDoor)`). Step functions are:
   - callbacks passed directly to BenneScript registration and block APIs: any method call `x.on(…)` / `x.on<Upper>…(…)` except `onUpdate`, and `playFrom`, `cutscene`, `background`, `together`, `withInputDisabled`. The test is on the method name only (decision 13);
   - function declarations and `const f = () => …` at the top level of a script file;
   - functions exported from `*.script.ts`.
2. **Statement-level calls** inside step functions become `await $.step(() => call)`. The call runs inside `$.step`, synchronously, with `$` as the *ambient* context: that is how `walkToClicked()` finds the clicked target, and how a player walk is attributed to the interaction (`runInInteraction`, decision 12), without passing `$` around. `$.step` waits only if the value is a `Task` (or the promise of a step function); otherwise it returns at once. `return call()` is wrapped the same way.
3. **Calls to step functions in expression position** (e.g. `if (isReady())` where `isReady` is a local step function) become `(await $.step(() => isReady()))`. Calls that start an action without waiting (`x.now(…)`, `background(…)`) in expression position become `$.run(() => call)`, so `const walk = jensen.walkTo.now(…)` starts with the handler's context (Phase 2). The transform knows which functions it converted in this file and which imports come from `*.script.ts`. A step-function call nested *inside* another statement-level call (`say(greeting())`) is a build error asking for a separate line, because the outer call runs inside a synchronous thunk.
4. **Speech labels.** A labelled expression statement whose label resolves to `Player` or to exactly one character by ID or display name (normalised as in §4.2) becomes `say(<id>, <expression>)`. The expression is usually a string or template literal, but any expression works (`Jensen: pick(insults)`, §4.20). A label that does not resolve keeps its normal meaning (`outer: for …`), unless its body is a string or template literal: then the build fails with "Unknown speaker `Hnak`. Did you mean `Hank`?" or, for ambiguous labels, a list of the matching characters. A speech label outside any step function is also a build error, since it would never run.
5. **Loops and branches** (`for`, `for…of`, `while`, `if`, `switch`, `try`) inside step functions are sequenced naturally, because each inner statement is transformed.
6. **Not transformed:** callbacks passed to anything else (`array.forEach`, `map`, `setTimeout`, `onUpdate`, `Promise.then`). A step function passed into one of those as a value (e.g. `parts.forEach(handOver)`) is a **build error** with a hint: "use `for (const p of parts) handOver(p)`".
7. **Source maps.** The inserted `await $.step(() => ` is mapped to the start of the original statement. A DevTools breakpoint on a line therefore stops on the handler's statement, not inside the thunk, and *Step over* moves to the next source line once the timed action has finished.

### 6.3 Types

The author-facing type declarations are designed so the source type-checks as written:

- Blocking forms return **`void`**. You can't accidentally depend on a promise, and TypeScript is happy with a bare call.
- `.now(...)` returns **`Task`** (`{ wait(): void; cancel(): void; readonly done: boolean }`).
- `goTo`, `saves.load`, `unhandled` and `dialog.end` return **`never`**.
- Step functions keep their declared return types. `function isReady(): boolean` is called as `if (isReady())`, and the transform supplies the `await`.

A small ESLint rule (shipped with the template) flags timed calls in non-script files and inside `onUpdate`. The transform and runtime errors are the backstop.

_As built (decision 53):_ two rules, in `scripts/lib/eslint-plugin-bennescript.mjs`, with the transform's step-function rules shared through `scripts/lib/bennescriptSteps.mjs`:

- **`bennescript/no-unwaited-timed-call`**: a timed action (anything callable with a `.now()` returning a `Task`, found by type) or a step function, called where nothing waits for it: inside `onUpdate` (both forms; `background` blocks inside it are fine), in a callback or nested function that isn't a handler (`setTimeout(() => wait(1))`, `list.map(() => helper())`), at the top level, in a plain `.ts` file, or inside an expression in a handler (`cond && walkTo(p)`: only a call on its own line waits). `.now(…)` is allowed everywhere except `onUpdate`.
- **`bennescript/no-await-in-step`**: `await` in a handler or helper. Lines already wait, and `await walkTo(p)` doesn't (the blocking form returns a wait marker, not a promise).

They need typed linting (`parserOptions.projectService`); without types they still check step functions and `await`. `gameScriptsConfig({ parser, tsconfigRootDir })` is the flat-config block for `src/game/**/*.ts` (minus `*.ids.ts`): the repository's `eslint.config.mjs` uses it, so `npm run lint` checks AI Apocalypse, and new games get an `eslint.config.mjs` that uses it, with `npm run lint` and `eslint` / `typescript-eslint` dev dependencies (Update Engine adds the config only when a game has none). (Decision 52 recorded that no rule existed.)

### 6.4 Runtime checks

`$.step` is also where the runtime enforces lifetimes:

```ts
async step(thunk) {
  if (this.cancelled) throw CANCELLED            // room changed / load / interrupt
  const value = this.run(thunk)                  // ambient context + runInInteraction
  if (value instanceof TaskWait) {               // a blocking action: `task.wait()`
    if (scene.isCutsceneSkipFastForwarding()) value.task.finishNow()   // skip mode
    // + while in a cutscene, an ESC skip mid-step calls value.task.finishNow()
    return await raceCancel(value.task.promise, this.signal)
  }
  if (isPromise(value)) return await raceCancel(value, this.signal)   // a step function
  return value                                   // instant, or the bare Task of a `.now` call
}
```

Because the check comes before the thunk runs, a cancelled handler never starts its next statement, and a handler waiting on a step is released by `raceCancel` the moment it is cancelled.

`CANCELLED` is swallowed by the handler dispatcher. Authors never see it.

_As built (Phase 2):_ every timed action is built once by `timed(start)` (`src/engine/bennescript/task.ts`). `start` begins the action and returns its `Task`. The blocking form returns `task.wait()`, a `TaskWait` marker that `step` waits on; `.now` returns the `Task` itself, which `step` does not wait on. That is how `jensen.walkTo.now(…)` written as a statement doesn't wait, and how `walk.wait()` later does (decision 17).

---

## 7. Generated handles

### 7.1 What gets generated

| Source | Handle(s) | Where |
|---|---|---|
| `rooms/*/*.room.json` | `rooms.<id>`; in that room's `.ids`: `room`, props, hotspots, spawned characters (flat), `points.*`, `regions.*`, `walkables.*` | `@game`, `./<room>.ids` |
| `characters/*/*.json` | `characters.<id>`, speaker labels (from ID and display name), animation tag unions; in the character's `.ids`: the character, flat (_decision 53_) | `@game`, `./<character>.ids` |
| `inventory/*/*.inventory.json` | `items.<id>` with animation tag unions | `@game` |
| `dialogs/*/*.dialog.json` | `dialogs.<id>.options.*`; in the dialog's `.ids`: `dialog`, `options` | `@game`, `./<dialog>.ids` |
| `guis/*/*.gui.json` | `guis.<id>.controls.*`; in the GUI's `.ids`: `gui`, controls (flat) | `@game`, `./<gui>.ids` |
| `game-config.json` verbs | `verbs.<id>`, `on<Verb>` / `on<Verb>Item` methods on clickable and item handles, `fallbacks.on<Verb>` (§8) | `@game`, types |
| `assets/audio/sfx/*`, `assets/audio/music/*` | `sfx.<name>`, `music.<name>` | `@game` |
| `src/game/state.ts` | `flags`, `vars` (re-exported) | `@game` |

The generated files are gitignored, regenerated on `dev` / `build` and on every editor change, the same as `benne-game-ids.d.ts` today.

_As built (Phase 3, decision 23):_ the generator is `scripts/lib/generateGameHandles.mjs`, run by `scripts/generate-game-ids.mjs` alongside the old `benne-game-ids.d.ts` (retired after Phase 6: the handles replaced its quoted-ID unions, and nothing used them any more). It writes real TypeScript modules (runtime objects and their types in one file) next to the content: `src/game/game.ids.ts` (aliased as `@game`), `rooms/<id>/<id>.ids.ts`, `dialogs/<id>/<id>.ids.ts` and `guis/<id>/<id>.ids.ts`. `.gitignore` covers `src/game/**/*.ids.ts`. Each file starts with a generated marker, and only files carrying it are deleted when their source goes away. Files are written only when their text changes, so the dev watcher (which ignores `*.ids.ts`) doesn't loop. `npm run typecheck` generates first (`pretypecheck`), and `npm run check:generated` fails on collisions, reserved verb IDs and bad `scriptName`s. In dev, a failed regeneration shows in Vite's error overlay and leaves the previous modules in place; a failed build start fails the build.

- **Handles are generic over the game's verbs.** The engine classes (`PropHandle<VerbId, Anim>`, `HotspotHandle<VerbId>`, `CharacterHandle<VerbId, Anim>`, `ItemHandle<VerbId, Anim>`) contain no verb names; `@game` declares `VerbId`, `ItemVerbId`, the `VerbMethods` / `FallbackVerbMethods` interfaces and the verb list, and attaches the methods through an internal `__withVerbs` that the `.ids` modules call. So `x.on(['use', 'cleen'], …)` and `items.coffee.animation = 'coffe-full'` are type errors.
- **One object per thing.** `dialogs.x.options.y` and `options.y` in the dialog's module are the same object, as are `guis.x.controls.y` and the flat control. Room-scoped character handles (registration in that room) are separate from `characters.x` (no room: character-script scope, §4.9).
- **Animation tags.** Props: every tag on the room's Aseprite sheet. Characters: the character sheet's tags plus the keys of `animations` in the character JSON. Items: the shared inventory sheet (`display.aseprite: "shared"`) or the item's own sheet. With no tags the type is `string`.
- **`flags` / `vars`** are re-exported from `src/game/state.ts` when it exists; otherwise `@game` declares empty ones.

### 7.2 Naming

- IDs are converted to camelCase: `club-hotspot-toolChest` → `toolChest`, `what about AI` → `whatAboutAI`, `botti3-disembodied` → `botti3Disembodied`.
- A leading `<roomId>-` and kind word (`hotspot-`, `point-`, `region-`) are stripped inside room modules: `plaza-point-first-visit-jensen` → `points.firstVisitJensen`.
- If two IDs in the same scope produce the same name, the generator reports an error and asks for a `"scriptName"` on one of them in JSON. `scriptName` only overrides the generated handle name; it is not a speaker label. It never silently suffixes `_2`.
- Reserved words and names that collide with BenneScript helpers (`wait`, `say`, `room`, …) get a trailing `_` and a warning.

_As built (Phase 3, decision 24):_
- **camelCase**: split on anything that isn't a letter or digit; the first word is lower-cased when it is all capitals (`AI problem` → `aiProblem`), otherwise only its first letter is (`TakeBtn` → `takeBtn`, `what about AI` → `whatAboutAI`). A name that would start with a digit gets a leading `_` and a warning.
- **Prefix stripping** applies only to the room's own ID, followed by the thing's own kind word (`hotspot-`, `point-`, `region-`, `prop-`, `walk-`/`walkable-`): `cafe-walk` → `walkables.walk`. When what's left doesn't start with a letter, the whole ID is used: `lab-point-1` → `points.labPoint1`.
- **Scopes**: each `@game` namespace; each room module's top level (props, hotspots, spawned characters, plus the fixed `room`, `points`, `regions`, `walkables`), and its `points`, `regions` and `walkables` separately; each dialog's `options`; each GUI module's top level (controls plus `gui`); each character module (the character alone, decision 53).
- **Reserved names** (trailing `_`, warning) apply only to flat scopes, where a handle is an import binding: JavaScript reserved words, everything `@benne/script` and `@game` export, and the generated module names (`room`, `points`, `regions`, `walkables`, `gui`, `dialog`, `options`). Namespaced keys (`items.default`) need no renaming. Flat names that shadow a browser global (`window`, `close`, `open`, …) only warn.
- **`scriptName`** is accepted on rooms, props, hotspots, points, regions, walkable polygons, characters (it names the character in `characters` and in every room that spawns it), items, dialogs, dialog options, GUIs and GUI controls. It must be a valid identifier, and in a flat scope not a reserved name; otherwise generation fails. Two sound, music or video files whose names collide can't take a `scriptName`; the error asks to rename one of the files.
- _Decision 54:_ **the `characters` namespace follows the flat rules**, because a character's name is also a flat name in its own module and in rooms that spawn it. A character has one name everywhere (a character with the ID `dialog` is `characters.dialog_` and `dialog_`), and a reserved `scriptName` is refused once, at the character ("reserved for characters"), whether or not a room spawns it. The room and character modules reuse that name.
- **Speaker labels** (decision 4) are resolved by one shared module, `scripts/lib/benneSpeakers.mjs`, used by the transform and the generator. The generator warns about names that several characters normalise to, and about a character whose ID or name normalises to `player`; using such a label is still the build error from §6.2.

### 7.3 Why some names are namespaced

Flat names are the fastest to type, but AI Apocalypse shows real collisions between kinds:

| Name | Is a… |
|---|---|
| `antenna`, `mop`, `regulator`, `relay`, `timeonium` | prop in a room **and** inventory item |
| `barista`, `curator`, `customer`, `driver` | character **and** dialog |
| `botti3` | character **and** dialog **and** prop |
| `credits` | room **and** GUI |

So the layout is:
- **Flat:** things in *this* room (props, hotspots, characters) and the active GUI's controls. These are what you click and refer to constantly.
- **Namespaced:** `items.*`, `dialogs.*`, `rooms.*`, `guis.*`, `characters.*` (for characters not in this room), `sfx.*`, `music.*`, `points.*`, `regions.*`, `walkables.*`.

When typing, `items.` immediately narrows the completion list to items, which is arguably faster than a flat list of every name in the game.

---

## 8. The verb system

This refactor also changes how verbs work. Today a handful of verbs get special treatment in BenneScript, and custom verbs are second-class. Under this design **every verb comes from `game-config.json`**, and the built-in ones get no special treatment.

### 8.1 Today

- **Config.** `game-config.json` lists `verbs` (`id`, optional `label`, optional `preposition`). If the list is missing, the engine uses `look` + `use` (`DEFAULT_VERBS` in `src/engine/verbs/verbConfig.ts`).
- **Fixed shortcuts.** BenneScript has a hard-coded list of nine sugar methods (`whenLookAt`, `whenUse`, `whenPickUp`, `whenGive`, `whenTalkTo`, `whenPush`, `whenPull`, `whenOpen`, `whenClose`). They're mapped to config IDs through `VERB_ALIAS_CANDIDATES` (`src/engine/scripting/BenneScriptCore.ts:226`). That's how AI Apocalypse's `whenPickUp` lands on its `take` verb.
- **Custom verbs use string APIs.** A verb outside that list, like AI Apocalypse's `clean` and `move`, can only be handled through `B.whenVerb('clean', 'target', …)`, `B.onProp('dishes', 'clean', …)` or `B.whenGlobalVerb('clean', …)`. Nothing checks the verb ID or the target ID.
- **Item verbs are hard-wired.** Only verbs matching the `use` aliases (`use`, `interact`) or `give` can arm the selected inventory item and be used on a target (`resolveEffectiveUseVerbId` / `resolveEffectiveGiveVerbId` in `verbConfig.ts`). A custom "Throw rock at window" verb isn't possible.
- **Hard-coded default.** When a clickable has no `defaultVerb`, the engine falls back to `look` (`DEFAULT_VERB_FALLBACK`), even in a game with no `look` verb.
- **Verb IDs in JSON are plain strings**: `defaultVerb` on props, hotspots, characters and items; each item's `verbs` list; `inputProfile` slots.

AI Apocalypse uses both styles side by side: 11 `whenPickUp` calls for its `take` verb, but `whenVerb('clean', …)` ×5, `whenVerb('move', …)` ×1 and `onProp(…)` ×3 for its custom verbs.

### 8.2 Proposed: the config is the only source of verbs

```jsonc
// game-config.json
{
  "verbs": [
    { "id": "take",   "label": "Take" },
    { "id": "use",    "label": "Use",   "preposition": "with", "usesItem": true },
    { "id": "look",   "label": "Look at" },
    { "id": "clean",  "label": "Clean" },
    { "id": "talkTo", "label": "Talk to" },
    { "id": "move",   "label": "Move" },
    { "id": "throw",  "label": "Throw", "preposition": "at",   "usesItem": true }   // hypothetical
  ],
  "defaultVerb": "look"
}
```

Two config additions (both read by the engine since Phase 3: `isItemVerb` and `resolveGameDefaultVerbId` in `src/engine/verbs/verbConfig.ts`):

- **`usesItem`** marks a verb that arms the selected inventory item and is then used on a target ("Use mop with Jensen", "Throw rock at window"). It replaces the hard-wired `use`/`give` alias lists. When omitted, it defaults to `true` for verbs that have a `preposition`, so existing `use` / `give` configs keep working unchanged.
- **Game-level `defaultVerb`** replaces the hard-coded `look` fallback for clickables without their own `defaultVerb`.

**What gets generated for each verb `V`** (shown for `clean` and `throw`):

| Where | Generated | Example |
|---|---|---|
| Clickable handles (props, hotspots, characters) | `on<V>(fn)` | `dishes.onClean(…)` |
| Item handles (verb used on the inventory row) | `on<V>(fn)` | `items.mop.onClean(…)` |
| Clickable and item handles, if `usesItem` | `on<V>Item(item, fn)` | `window.onThrowItem(items.rock, …)`, `items.magnet.onUseItem(items.antenna, …)` |
| Global fallbacks | `fallbacks.on<V>(fn)`; if `usesItem`, `fallbacks.on<V>Item((item, target) => …)` | `fallbacks.onClean(…)` |
| `verbs` namespace | `verbs.<V>` with `id`, `label`, `preposition`, `usesItem`, `select()`, `isActive` | `verbs.clean.select()` |
| Types | `VerbId` union and `ItemVerbId` union; JSON Schema enums for `defaultVerb`, item `verbs`, `inputProfile` | `cleaningStuff.on(['use', 'take', 'clean'], …)` |

_As built (Phase 3):_ the repository has no JSON Schemas for content, so there are no schema enums; validate-content checks verb IDs instead (§8.3), and the Inspector dropdowns are Phase 5. _As built (Phase 4, decisions 27–28):_ item, fallback and character-script handlers register once, at module top level, on the global dispatch channels and stay subscribed. An item with any new-style handler is armed by every `usesItem` verb on its row: after the verb's handler, or at once when it has none; `items.x.on<V>.doNotActivate(…)` opts out (the generator types it through `ItemVerbMethods`). JSON-only items keep the engine's click-time arming until Phase 6.

Built-in item-verb helpers stay on top of the generated ones:

```ts
customer.onItem(items.coffee, …)     // any usesItem verb with this item
customer.onAnyItem((item, verb) => …) // any item, any usesItem verb
items.magnet.onCombine(items.antenna, …)  // alias of onItem on item handles; reads better for item-on-item
```

**Custom verbs in practice** (from AI Apocalypse):

```ts
// TODAY
B.whenVerb('clean', 'club-hotspot-battery', () => { … })
B.onProp('dishes', 'clean', () => { … })
B.onProp('filingCabinet', 'move', () => { … })
B.whenGlobalVerb('clean', () => { B.player.say("I don't need to clean that."); })
```

```ts
// PROPOSED
battery.onClean(() => { … })
dishes.onClean(() => { … })
filingCabinet.onMove(() => { … })
fallbacks.onClean(() => { Player: "I don't need to clean that." })
```

A hypothetical custom item verb, which isn't possible today:

```ts
window.onThrowItem(items.rock, () => {
  walkToClicked()
  sfx.glassBreak.play()
  window.animation = 'window-broken'
  inventory.remove(items.rock)
  Hank: "Oops."
})

fallbacks.onThrowItem((item, target) => {
  Player: `Throwing the ${item.name} at the ${target.name} won't help.`
})
```

### 8.3 Naming rules

- **Method name** = `on` + the verb ID in PascalCase: `look` → `onLook`, `talkTo` → `onTalkTo`, `pick-up` → `onPickUp`. Item form: `on<V>Item`.
- **No aliases.** The config ID *is* the name. A game whose verb is `take` has `onTake`, not `onPickUp`; a game that calls its use verb `interact` has `onInteract` and `onInteractItem`. One name per verb keeps autocomplete short and matches the JSON exactly.
- **Reserved verb IDs** are generator errors:
  - the engine tokens `walkTo` and `defaultVerb`;
  - IDs whose generated names would collide with built-in handle members: `item`, `anyItem` and `combine` (`onItem`, `onAnyItem`, `onCombine`);
  - two verbs that generate the same name, e.g. a `usesItem` verb `use` (→ `onUseItem`) next to a verb called `useItem`.
- _As built (Phase 3, decision 25):_ `verbItem` is reserved too (its method would be the generic `onVerbItem`), verb IDs must start with a letter, and the `verbs.<name>` keys are checked for collisions as well. validate-content reports the same problems, plus unknown verb IDs in `game-config.json` (`defaultVerb`, `inputProfile`), in props' and hotspots' `defaultVerb`, in characters' and items' `defaultVerb`, and in items' `onVerb`.
- **Adding, renaming or removing a verb** regenerates the handles, as the editor already does on JSON changes. New methods appear in autocomplete immediately. Handlers for a removed or renamed verb become type errors instead of silently never firing.

### 8.4 Runtime changes

| Area | Change |
|---|---|
| Handle methods | Handles have one generic `on(verb, fn)`. The generated `@game` module adds the per-verb methods from config at startup, and the generated `.d.ts` gives them types. The engine itself contains no verb names. |
| `VERB_ALIAS_CANDIDATES`, `when*` sugar | Deleted. There is no compatibility layer (§11). |
| `USE_` / `GIVE_VERB_ALIAS_CANDIDATES` | Replaced by `usesItem`. `dispatchInventoryOnVerbTarget` already passes the verb ID through, so handlers are keyed by (verb, item, target). |
| Item arming | `onUse` / `onGive` arming generalises to "every `usesItem` verb arms the item by default". `doNotActivate` still opts out. _As built (Phase 6, decision 44):_ this covers every item, including items with no script; the alias lists are gone, and a walk-to click with an armed item uses the game's default item verb (`use` when it is an item verb, else the first `usesItem` verb). |
| `DEFAULT_VERB_FALLBACK` | Replaced by game-level `defaultVerb` (defaults to `look` when present in `verbs`, else the first verb). |
| Dispatch order | Unchanged: room handler → character script → object `onVerbFallback` → `fallbacks.on<V>` → `fallbacks.onAnyVerb` → `verb:unhandled`. `unhandled()` moves to the next step. |
| Verb line | `pointer.sentence` composes `label` + item + `preposition` + target from config (today `verbs.gui.ts` builds it by hand). |
| Validation | `npm run validate-content` checks every verb ID in content JSON against config. The Inspector's verb fields become dropdowns of configured verbs. |

### 8.5 Migration

Porting verb handlers in AI Apocalypse and the templates (part of the one-time port in §11):

- Old sugar becomes the method named after the game's actual verb ID: `whenPickUp('antenna', …)` → `antenna.onTake(…)` in AI Apocalypse (its verb is `take`), and → `antenna.onPickUp(…)` in the 9-verb template.
- `whenVerb('clean', x, …)` and `onProp(x, 'clean', …)` → `x.onClean(…)`; `whenGlobalVerb('clean', …)` → `fallbacks.onClean(…)`.
- `whenInventoryUsedOn` branches on `payload.verbId` → `on<V>Item` per verb; branches that ignore the verb → `onItem`.
- Config: add `"usesItem": true` to `use` / `give`, and `"defaultVerb": "look"` where the game relied on the hard-coded fallback.
- In AI Apocalypse that is 11 `whenPickUp`, 83 `whenLookAt`, 41 `whenUse`, 10 `whenTalkTo`, 6 `whenVerb`, 3 `onProp`, 6 `whenGlobalVerb` and 11 `whenInventoryUsedOn` calls, all mechanical renames.

---

## 9. Editor support

Most of the ergonomics come from the build and type layers. The VS Code extension and its TS server plugin add the finishing touches:

| Feature | How |
|---|---|
| Completions for every handle | Free: plain TypeScript over the generated modules, with auto-import |
| Speaker completions | TS plugin: typing a capital letter at statement start offers `Hank: ""` with the cursor inside the quotes |
| Unknown speaker / bad label diagnostics | TS plugin, same rules as the transform |
| String-union completions **with quotes** (`face(`, `animation =`, `play(`) | TS plugin: offers `'U'`, `'D'`, … at `(` or `=` and inserts the quotes |
| Go to definition: `battery` → `club.room.json` hotspot | TS plugin redirects definition requests for generated handles to the JSON source |
| Inspector "add handler" / "reveal handler" | ScriptModel on the TS AST (engine review §4.3) finds `battery.onUseItem(items.soda, …)` exactly, with no regex |
| Voice-ID / localisation export | Labels and `say` calls are trivially found in the AST, replacing the parsing in `voiceIdProcessor.ts` |
| Snippets | `room-enter`, `cutscene`, `choice`, `use-item` |
| tsconfig for script files | `allowUnusedLabels: true`; ESLint `no-labels` off for script globs (_as built: the game ESLint config enables only the BenneScript rules, §6.3, decision 53_) |

_As built (Phase 5, decisions 38–42):_ the extension's BenneScript layer is `benne-editor/src/bennescript/`, free of `vscode` imports so the TS server plugin shares it:

- **ScriptModel** (`scriptModel.ts`) parses a script with the TypeScript AST into registrations (any `x.on…(…)` call, `x.onUse.doNotActivate(…)`, `playFrom`, `onUpdate`), speech lines (labels, `` say`…` `` block lines, `x.say(…)`, each with the source range of its text) and references to generated handles. Receivers stay syntactic (`items.soda`) and are resolved by **`IdsIndex`** (`idsIndex.ts`), which reads the generated `.ids.ts` modules: every handle there is built from its content ID (`new HotspotHandle("club", "club-hotspot-battery")`), so the editor never re-implements the naming rules. A handle missing from the modules (new content) makes the editor run the generator once and retry. Speaker rules are mirrored from `scripts/lib/benneSpeakers.mjs` in `speakers.ts` (the CommonJS bundles can't import the ES module); a unit test keeps the two in step.
- **Handlers** (`handlerSpecs.ts`): the Inspector chips, "add handler" and "reveal handler" all go through one `HandlerSpec` (verb on a prop / hotspot / character / item, any item on a target, room hook, `onUpdate`, region, GUI hook, control event, dialog choice, Play From). A new handler is appended at the end of the script, and its imports are merged into the existing `import { … }` lines (`@benne/script`, then `@game`, then `./x.ids`). Stubs: `battery.onLook(() => { // TODO: Look at })`; "item used on this" is `x.onAnyItem(() => { Player: "That doesn't work." })` (any `onUseItem` / `onItem` / `onCombine` / `onAnyItem` counts as present); a room's `onUpdate` stub starts with `if (game.currentRoom !== room) return`, because `onUpdate` runs in every room (§4.18); checkboxes get one `onChange`; dialog options get `onChoose` (either `onChoose` or `onChooseOnce` counts). Per-object verb fallbacks (`onVerbFallback` in JSON) and text-input "submit" have no BenneScript handler, so those Inspector buttons explain that instead.
- **Old-API scripts** (`register*Script`) are neither read nor edited: their chips show no handlers and "add handler" says to port the file first (decision 39).
- **TS server plugin** (`tsPluginFeatures.ts`, wired in `tsServerPlugin.ts`): speaker diagnostics with the transform's messages (unknown, ambiguous, a `say` line without `Speaker:`, a speech line outside a step function); `Hank: "$1"` snippet completions at the start of a statement once a capital letter is typed; TypeScript's own quoted string-union entries are sorted first and match without the quote (decision 41); a definition that lands in a generated module is redirected to the content: the `"id"` in the room / character / item / dialog / GUI JSON, the verb in `game-config.json`, or the sound / music / video file.
- **Voice IDs and the speaking-text CSV** use the ScriptModel. In AI Apocalypse they find 579 lines (430 labels, 149 `say` block lines) for all ten characters; the one line they skip is `Player: game.config.defaultFallbackLine ?? "…"`, which has no literal text.
- **Delete impact** lists every use of the deleted thing's handle (`resolveReference`).
- **Inspector default verb** shows the game-level `defaultVerb` (decision 8) when a clickable has none.

---

## 10. Runtime changes

| Area | Change |
|---|---|
| `BenneScriptCore.interactionTail` / `chain` | Replaced by an **InteractionContext** per dispatched event: `step()`, cancellation signal, skip flag, owner (room / dialog / GUI / global). |
| `BlockingWithNow`, `withNow`, `withNowResult` | Collapse into one implementation per action that returns a `Task`. `.now` becomes a thin "start without waiting" wrapper on the same function. |
| Script facades (`B.*`) | Replaced by **capability modules** with handle objects (`PropHandle`, `CharacterHandle`, …). `B`, the `BenneScriptCore` subclasses and `register*Script` are deleted. |
| Registration | Module top-level registrations are collected into per-file handler tables. Room tables attach on room load and detach on leave; character and inventory tables attach while relevant, as today. |
| Dialog `start()` | Returns a `Task` that resolves when the session ends. Sub-dialog return-to-parent becomes the default. |
| Cutscene skip | Every `Task` implements `finishNow()`. This replaces `registerCutsceneSkipFinisher` callbacks for the common cases. Speech `Task`s also keep today's click-to-skip, which ends only the current line. |
| Verbs | Verb names leave the engine: per-verb methods are generated from config, `usesItem` replaces the `use`/`give` alias lists, and game-level `defaultVerb` replaces the hard-coded `look` (§8.4). |
| Interrupt policy | The InteractionContext records whether it is still on its opening walk. The pointer handler cancels it in that state, and otherwise drops world clicks until it ends (§5, rule 9). |
| `goTo`, `load`, `unhandled`, `end` | Throw an internal `END_HANDLER` after scheduling their effect; the dispatcher swallows it. |
| Save policy | `saves.canSaveNow` is false while a gameplay interaction (including an open dialog) runs, and saving is refused (§4.16). |
| Interaction activity | Every InteractionContext reports to the engine registry `src/engine/interaction/interactionActivity.ts` from start until it ends, finishes or is cancelled, and runs its steps inside `runInInteraction` so a player walk it starts is attributed to it. The dev/test hooks' idle check and the save policy read this registry; the old API already reports to it (decision 12). |
| New primitives | `waitForClick`, control `fadeTo` / `tweenTo` returning `Task`, `pointer.sentence`, `together`, `background`, `withInputDisabled`. |

None of this changes rendering, content JSON or the editor previews.

_As built (Phase 2):_ the runtime is in `src/engine/bennescript/` (`task.ts`, `interactionContext.ts`, `blocks.ts`, `dialogs.ts`, `saves.ts`). The engine registry `interactionActivity.ts` gained what the policies need, without the engine importing BenneScript: a `gameplay` flag per activity (the save policy; old GUI handlers report `false`), a world-click policy the room asks before a click starts anything (`admitGameplayClick()`, called from the prop, hotspot, character, background and inventory-row click paths), `abandon()` for a dropped player walk, and `setWaitingForPlayer()` so a handler waiting on a dialog isn't "busy". `goTo`, `saves.load` and `dialog.end` throw `END_HANDLER`; `unhandled` throws its own marker so the dispatcher can fall through (decision 22). Cancellation reaches handlers through `cancelAllInteractions()` (room leave) and the game-state-replaced event (any load or new game). Cutscene skip uses the room's existing fast-forward: `$.step` calls `finishNow()` on the in-flight task when ESC is pressed and on every later task until the cutscene ends, and the room's own primitives (walks, speech) already finish themselves when skipped.

_As built (Phase 4):_ the handle API is in `src/engine/bennescript/` (`handles.ts`, `actions.ts`, `camera.ts`, `game.ts`, `guis.ts`, `itemHandlers.ts`, `globalHandlers.ts`, `roomHandlers.ts`, `registry.ts`). New primitives: `waitForClick`, control `fadeTo` / `tweenTo` (Tasks), `pointer.sentence`, `display`, `fadeOut` / `fadeIn`. AI Apocalypse runs entirely on the new API; the old one stays for the templates until Phase 6.

_As built (Phase 6, decision 43):_ the old API is deleted with `src/engine/scripting/`. What other code relied on moved to engine modules with no `B` in them: the dialog session (`dialog/dialogSession.ts`), the GUI control runtime (`gui/GuiRuntime.ts`, immediate operations only), room module loading (`scenes/roomScriptModules.ts`), Play From setups (`scenes/playFromRegistry.ts`), the transition wiring (`scenes/wireRoomTransitions.ts`), the per-frame registry (`bennescript/onUpdateRegistry.ts`), speech lines and clicked targets (`bennescript/speech.ts`, `bennescript/verbClickTarget.ts`), the verb and speech-settings events (`verbs/verbContext.ts`, `dialog/speechSettingsEvents.ts`) and `benneEnvironment.ts`. Enter hooks are no longer followed by a queue drain: each handler's promise already resolves after its last step.

---

## 11. Migration

### 11.1 No backwards compatibility

The new BenneScript **replaces** the old API outright. There is no compatibility layer in any release. (While the refactor is in progress, both APIs run side by side on the working branch so AI Apocalypse stays playable. The old one is deleted before merge; see §14.1.)

- `register*Script(({ B }) => …)`, the `B` object, the `BenneScriptCore` subclasses, `interactionTail` / `chain`, `BlockingWithNow` / `withNow`, the `when*` verb sugar and `VERB_ALIAS_CANDIDATES` are all **deleted**.
- `docs/bennescript-api.md` and `docs/public/bennescript.md` are rewritten for the new API, not extended. _(Done in Phase 7; the reference half of `bennescript-api.md` is generated from the code, decision 51.)_
- Editor scaffolding, the Inspector's "add handler" / "reveal handler" and Play From discovery emit and understand only the new syntax.

This is affordable because AI Apocalypse is the only game built on BENNE, and it's small (54 script files, ~3,300 lines). Not carrying the old API keeps the runtime simple: one timing model, one way to register a handler, one API reference.

_As built (Phase 6, decision 48):_ some old `B` features had no BenneScript equivalent at the end of Phase 6, because neither AI Apocalypse nor the templates use them. _Phase 6 follow-up (decision 50):_ all of them are ported, plus the gaps a second audit of the old API found; the log's Phase 6 follow-up entry maps each one.

**What needs porting:**

1. **AI Apocalypse**: the acceptance test (§11.4).
2. **The game templates** (`game-templates/2-click`, `game-templates/9-verb`) and the dev game in `src/game`, so new games start on the new API.
3. **Engine tests** that drive scripts through `B` are rewritten against the new handles.

There is **no codemod**. For one small game it costs more to build than to port by hand (or with an AI assistant using the table below as a guide). If BENNE ever has several games in the wild before a future breaking change, a codemod can be reconsidered then.

### 11.2 Translation guide

| Old | New |
|---|---|
| `registerRoomScript(({ B }) => { … })` | top-level statements |
| `B.whenLookAt('Couch', …)` / `B.whenPickUp('antenna', …)` | `couch.onLook(…)` / `antenna.onTake(…)` (named after the game's verb IDs, §8.5) |
| `B.whenVerb('clean', 'x', …)` / `B.onProp('x', 'clean', …)` | `x.onClean(…)` |
| `B.whenInventoryUsedOn('t', p => { if (p.itemId === 'a') {…; return} … return false })` | `t.onUseItem(items.a, () => {…})` per branch |
| `B.character('jensen').say('…')` / `B.player.say('…')` | `Jensen: "…"` / `Player: "…"` (or the player's name) |
| `B.prop('Door').animation = 'x'` | `door.animation = 'x'` |
| `B.state.setFlag('all done', true)` / `getFlag` | `flags.allDone = true` + entry in `state.ts` |
| `B.room.changeTo('x')` | `rooms.x.goTo()` |
| `B.sound.play('x')` / `playMusic('x')` | `sfx.x.play()` / `music.x.play()` |
| `B.dialog('d').optionOn('o')` | `dialogs.d.options.o.on()` |
| `B.whenChoice('o', …)` + `optionOff('o')` inside | `options.o.onChooseOnce(…)` |
| `B.gui('g').control('c')` | `guis.g.controls.c` (or `c` inside `g.gui.ts`) |
| `B.whenButtonClick('c', …)` | `c.onClick(…)` |
| `B.state.save.now(n, s)` + `flush()` | `saves.save(s, n)` |

**Saves.** With no compatibility promise, old AI Apocalypse save files don't need to load after the port. Flags can simply be renamed (`'all done'` → `allDone`) without a `saveKey`. The `saveKey` option in `defineFlags` (§4.7) stays available for *future* renames once players have saves worth keeping.

### 11.3 Timing checklist for the port

The old API ran everything that wasn't queued at click time, and the new one runs everything in order. When porting a handler, check for these patterns. All of them occur in AI Apocalypse:

- **Instant statements after queued ones** (flag writes, getter reads, `moveToNow`). Example: `club.room.ts` sets `batteryClean` after four queued lines. Under the new rules it is set at that point in the sequence, which is almost certainly what was intended. Check that nothing relied on the early write.
- **Code after `dialog.stop()`** (`jensen-in-hallway.dialog.ts` "its the future": `stop()` then `face('U')`). `dialog.end()` now ends the handler, so move `face` above it.
- **Code after `B.dialog(…).start()`** now runs after the conversation ends. In AI Apocalypse every `start()` call is already last in its handler, so nothing changes.
- **Sub-dialogs that "go back" by restarting the parent.** `botti3-local-area` and `botti3-ai-future` end their "thats all" choice with `B.dialog('botti3').start()`. The parent is now still open and waiting, so this becomes `dialog.end()`:

  ```ts
  options.thatsAll.onChoose(() => {
    Botti3: "Okay!"
    dialog.end()          // back to the botti3 choices
  })
  ```

  Starting a dialog that is already open on the stack is a runtime error in DEV, so a missed case is reported, not silently stacked.
- **`.now` placed after a blocking call** (`plaza.room.ts`: `jensen.walkTo.now(…)` after `player.walkTo(…)`). The old `.now` fired at click time, which in that handler meant "together with Hank's walk". To keep that, move the `.now` call above the step it used to fire before:

  ```ts
  jensen.walkTo.now(points.firstVisitJensen)   // start Jensen first
  player.walkTo(points.firstVisit)             // then Hank; wait for Hank
  wait(0.5)
  ```

### 11.4 Acceptance: AI Apocalypse

AI Apocalypse is the acceptance test for the new API, transform and runtime:

1. Port every script file to the new API.
2. The game type-checks with zero errors, and the old API no longer exists to fall back on.
3. Every Play From entry point runs without errors in BENNE Play.
4. A scripted playthrough (Playwright, the existing e2e setup) reaches the credits.
5. Measure lines and characters before and after. A rough count of the samples in this doc suggests around **35–45% fewer characters** in room and dialog scripts.

---

## 12. Gotchas

| Gotcha | Why | Mitigation |
|---|---|---|
| `() => Hank: "Hi"` is a syntax error | Labels need statement position | Use a block: `() => { Hank: "Hi" }`. The snippets insert braces (_as built: there is no code action, decision 52; the build error and the editor's syntax error say "Put it in braces: `() => { Hank: "…" }`", decision 53_). |
| Speech must be quoted | `Hank: Hi there` isn't valid TS | The speaker completion inserts `""` with the cursor inside. Use `` say`…` `` for unquoted blocks. |
| Hyphenated or spaced speaker names | Labels must be identifiers | Drop the punctuation (`BOTTi3Disembodied:` for `"BOTT-i3 Disembodied"`), or use a `` say`…` `` block, which accepts names verbatim. |
| `parts.forEach(p => handOver(p))` | Callbacks to non-BenneScript APIs aren't sequenced | Build error with a hint to use `for…of`. |
| Script code run without the transform (e.g. imported into a unit test directly) | Labels would be no-ops and steps wouldn't wait | Tests import through Vite / Vitest, which use the same plugin. A runtime guard warns if a handler runs untransformed. |
| `return` inside a handler | Works as normal: ends the handler early | — |
| Heavy logic in step functions is a little slower | Each call awaits a microtask | Irrelevant at adventure-script scale; per-frame code goes in `onUpdate`. |
| Prettier may change quote style | — | Fine either way; the transform accepts any string literal. |
| `emitter.on('x', fn)` in a script file | The transform recognises registration APIs by method name, so `fn` becomes a step function (async) | Rare in script files. Wrap such callbacks in a plain function defined outside the call, or move the code to an ordinary `.ts` file. |
| A handle named after a browser global (`window`, `close`, `open`) | Generated names follow the JSON IDs; `cafe-hotspot-window` → `window` | Legal (the import shadows the global inside the module), but confusing in the debugger. The generator warns (Phase 3); add a `scriptName` to rename it. |
| `const t = jensen.walkTo.now(…)` | Only statement-level calls run with the ambient context; a call in a variable initialiser does not | Handled (Phase 2): the transform wraps `x.now(…)` and `background(…)` calls in expression position in `$.run(() => …)`, so they start with the handler's context (decision 17). Other expression-position calls are reads and don't need it. |

---

## 13. Risks and decisions

**Risks**

- **"Magic" TypeScript.** The code means something different from what plain JS would do. Accepted on purpose: script files are a dialect, documented as such, and only ever run through the plugin.
- **Transform edge cases** around helpers used as values. Mitigated by making unsafe patterns build errors, never silent misbehaviour. Prototype first (§14).
- **Generated-name churn.** Renaming an ID in JSON renames the handle, and every use becomes a type error. That is actually desirable, and the editor can offer "rename ID everywhere" via TS rename on the generated declaration.
- **AI assistants** know TypeScript but not these conventions. Ship a concise `bennescript` agent skill and cursor rule with the template (the project already maintains these). _Done in Phase 7 (decision 51)._

**Decisions (resolved 2026-10-05)**

| # | Question | Decision | Where it applies |
|---|---|---|---|
| 1 | What happens when the player clicks the world during an interaction? | **Cancel only while the handler is still on its opening walk; otherwise ignore the click. Inside `cutscene`, always ignore world clicks. Click-to-skip on dialogue keeps working during cutscenes.** | §4.12, §5 rule 9, §10 |
| 2 | Can the player save mid-interaction? | **No. Saving is refused while a gameplay interaction or dialog is running** (`saves.canSaveNow` is false). Snapshotting the last idle state may be revisited later. | §4.16, §10 |
| 3 | Should `dialogs.x.start()` wait for the conversation to end? | **Yes.** Sub-dialogs return to their parent; `start.now()` opens without waiting. | §4.8, §11.3 |
| 4 | Which names can speaker labels use? | **Both the character ID and the display name**, normalised (letters and digits only) and case-insensitive. Ambiguous labels are build errors. | §4.2, §6.2, §12 |
| 5 | Verb handler names: from verb ID or label? | **From the verb ID**: `onLook`, `onTalkTo`, `onClean`. | §4.5, §7.1 |
| 6 | Keep the name BenneScript? | **Yes.** | — |
| 7 | Verb item field: name and default? | **`usesItem`**, defaulting to `true` for verbs that have a `preposition`. Ported configs set it explicitly anyway. | §8.2, §8.4 |
| 8 | Game-level `defaultVerb` fallback? | **`look` when the game has a `look` verb, otherwise the first verb in `verbs`.** | §8.2, §8.4 |
| 9 | Keep `onCombine`? | **Keep**, as a readable alias of `onItem` on item handles. | §4.6, §8.2 |
| 10 | Backwards compatibility with `register*Script`? | **None.** Old and new APIs coexist only on the working branch during the refactor; the old API is deleted in the final porting phase before merge. | §11.1, §14 |
| 11 | What does the refactor build against? | **A copy of AI Apocalypse's `src/game`** (minus `boot/`) on a dedicated branch. The extra ~88 MB of assets is accepted on that branch. | §14 |
| 12 | How do the test hooks know a script is still running without depending on BenneScript? | **An engine-level interaction activity registry** (`src/engine/interaction/interactionActivity.ts`). Script runtimes report each handler from start to end; the hooks read only the registry and scene state. An interaction whose player walk is interrupted outside a cutscene is treated as over, because the old runtime never resolves it. Added in Phase 0; the Phase 2 runtime must report to it too. | §10, §14 |
| 13 | How does a statement reach the interaction context, and how are step functions found? (Phase 1) | **Statements are wrapped as `await $.step(() => call)`, not `$.step(call)`.** The call runs inside `step`, with the context set as ambient state, so actions like `walkToClicked()` and player walks find their interaction without a `$` parameter. Step functions pick the context up on entry (`const __$ = __bs.ctx()`) and keep their own parameter lists. Registration callbacks are recognised by method name (`.on…`, except `onUpdate`). | §6.2, §6.4, §12 |
| 14 | Which files does the transform touch while both APIs coexist? (Phase 1) | **Only script files that import `@benne/script`, `@game` or a `.ids` module.** Old `register*Script` files must stay untransformed: their callbacks run synchronously at click time, and `B.onProp(…)` would otherwise be mistaken for a registration API. Phase 6 drops the import test along with the old API. | §6.1, §14 |
| 15 | Where do the hand-written Phase 1 handles live? (Phase 1) | **`src/game/game.ids.ts` (aliased as `@game`) next to `rooms/cafe/cafe.ids.ts`**, so `cafe.room.ts` already imports from its final module names. Both files hold only what the café needs and are replaced by generated modules in Phase 3. Per-verb methods are added by `withVerbMethods(handle, verbs)`, so the engine stays free of verb names (§8.4). | §4.1, §7, §14 |
| 16 | Can a speech label take a non-literal expression? (Phase 1) | **Yes**, if the label resolves to a speaker (`Jensen: pick(insults)`, as §4.20 already showed). Unresolved labels only fail the build when their body is a string or template literal, so ordinary labels such as `outer: for …` keep working. | §4.2, §6.2 |
| 17 | How does `$.step` tell a blocking call from `.now`? (Phase 2) | **Blocking forms return `task.wait()`, a `TaskWait` marker; `.now` returns the bare `Task`.** `$.step` waits on the marker and on step-function promises only. Both forms come from one `timed(start)` helper, so every action is written once. `x.now(…)` and `background(…)` in expression position are wrapped in `$.run(() => …)` by the transform so they start with the handler's context. | §5, §6.2, §6.4, §12 |
| 18 | Which clicks does the interrupt policy apply to, and what is an opening walk? (Phase 2) | **Clicks that would start a walk or an interaction** (background walk, verb or item on a prop / hotspot / character, verb on an inventory row). Clicks that only clear the armed verb or item always work. **The opening walk is a first timed step that walks the active player.** A dropped player walk outside a cutscene (`abandon()`) cancels the handler instead of leaving it suspended. Old-API handlers set no policy, so they keep their old click behaviour. | §5 rule 9, §10 |
| 19 | How do new-API dialog choices and sub-dialogs work on the engine's single dialog session? (Phase 2) | **A stack in `bennescript/dialogs.ts` on top of the one engine session.** Starting a dialog from inside an open one suspends the parent; when the sub-dialog ends, the parent reopens once the choice handler that started it has finished. Starting a dialog already on the stack throws in DEV. **Choice handlers are not cutscenes** (unlike the old `whenChoice`): a cutscene held while a choice waits on a sub-dialog would block its buttons. A handler waiting on `start()` is marked "waiting for the player", so idle detection sees the dialog, not a busy script. | §4.8, §10 |
| 20 | What exactly blocks saving, and how do loads stop handlers? (Phase 2) | **Any running gameplay activity (old or new API, including one waiting on a dialog), an open dialog, or a room transition.** GUI handlers report `gameplay: false`. Any snapshot load or new game (the game-state-replaced event) cancels every running handler, so old-API loads stop new-API handlers too. The handler that calls `saves.load()` ends (`ended`) rather than being cancelled. | §4.16, §10 |
| 21 | What does a `background` block share with its handler? (Phase 2) | **Its own context, keeping the handler's click payload.** It doesn't take the lock, report to the activity registry (idle detection) or block saving. Room changes and loads stop it; the handler ending or being interrupted doesn't. | §4.13 |
| 22 | Where does `unhandled()` continue? (Phase 2) | **After the room level:** verbs go on to the character script's handler, the global verb handler, then the global fallback (the target's own `onVerbFallback` channel is skipped, since the handler that fell through is already the target's). Item handlers go on to the room's any-item handler, the global item handlers, then the unhandled fallback. | §4.5 |
| 23 | What does the generator emit, and how does tooling find it? (Phase 3) | **Real `.ts` modules next to the content** (`src/game/game.ids.ts` as `@game`, `<kind>/<id>/<id>.ids.ts`), gitignored via `src/game/**/*.ids.ts` and marked as generated, so only marked files are ever deleted. Writes happen only on change. `typecheck` generates first; `check:generated` fails on generator errors. **`verbs` and `fallbacks` live in `@game`**, not `@benne/script` (§4.17's import), because their methods come from the config. Handle classes are generic over `VerbId`; `@game` attaches the per-verb methods with an internal `__withVerbs`. | §4.1, §4.17, §7.1 |
| 24 | Exact naming rules (Phase 3) | **camelCase** lower-cases an all-capitals first word (`aiProblem`); **prefix stripping** removes only the room's own ID plus the thing's own kind word, and falls back to the whole ID when the rest doesn't start with a letter (`labPoint1`); **reserved names** (`_` + warning) apply only to flat scopes and include the generated module names; browser globals only warn; **`scriptName`** must be an identifier and not reserved, or generation fails; colliding audio/video file names must be renamed. AI Apocalypse needed three `scriptName`s (see the Phase 3 log). | §7.2, §4.15 |
| 25 | Verb rules beyond §8.3 (Phase 3) | **`verbItem` is reserved** (`onVerbItem` is the generic method), verb IDs must start with a letter, and `verbs.<name>` keys are collision-checked. validate-content checks every verb reference in content JSON with the same shared rules (`scripts/lib/benneVerbs.mjs`). No JSON Schema enums: the repo has no content schemas. | §8.2, §8.3 |
| 26 | `state.ts` details (Phase 3) | **An ordinary module, re-exported by `@game`.** `flag(default, { saveKey })` stores under `saveKey`; object/array var defaults are copied into the state on first read so in-place changes are saved. | §4.7 |
| 27 | Where do handlers outside rooms register? (Phase 4) | **Once, at module top level, on the global dispatch channels, and they stay subscribed.** Inventory, character-script, fallback, GUI and dialog-start handlers; any-room hooks (`game.onEnterAnyRoom`) wait until the room hook registry exists (`attachGlobalRoomHooks()` in `wireBenneGlobalScripts`). Character-script handlers only fire for characters in the room, because only those can be clicked. `unhandled()` in a character or item handler goes on to the global tiers (`continueVerbDispatchToGlobal`, `continueInventoryOnDispatchAfterGlobal`). | §4.9, §4.17, §8.4 |
| 28 | How does `usesItem` arming work? (Phase 4) | **An item with any new-style handler is armed by every `usesItem` verb on its row**: after that verb's handler (unless it was cancelled or registered with `doNotActivate`), or at once when it has none. The engine's click-time arming skips those items (`markInventoryItemArmedByScript`). JSON-only items keep the engine path until Phase 6. Item-on-item handlers apply the drop policy afterwards, like the old `whenInventoryUsedOn`. | §4.6, §8.4 |
| 29 | How does Play From register, and how does it fake history? (Phase 4) | **A top-level `playFrom(name, fn)` belongs to the room whose module is loading** (`getLoadingRoomScriptId()`), is re-registered on every room create (the engine clears Play From per room), and runs as a non-gameplay handler. **`room.visitCount` and `room.last` are settable** for it. | §4.4, §4.19 |
| 30 | What do region handlers get, and do they take the lock? (Phase 4) | **`who` is the room module's own character handle** (a handle registry), so `who === hank` works; regions still fire for every character. **They are gameplay handlers**, so a handler that only moves an NPC uses `.now`. Added `stopWalking()`, `position` and `isPlayer` on characters / `player` (the old code teleported the player to its own feet to stop a walk). | §4.14 |
| 31 | How are `say` block speakers resolved? (Phase 4) | **At build time, like labels**, by ID or display name as written in JSON; unknown and ambiguous speakers are build errors. The transform passes the result as `` say.__withSpeakers({…})`…` ``; a speaker built from `${…}` is matched at runtime against the room's characters. | §4.2, §6.2 |
| 32 | How do GUI scripts reach controls without an old `registerGuiScript`? (Phase 4) | **`RoomScene` builds a `GuiRuntime` for every GUI overlay**, not only for GUIs with an old script, and runs new-style `onBuilt` handlers after each build. Old and new `show()` / `hide()` both run new-style `onShow` / `onHide`. Value, selection and hover callbacks run at once outside any handler (`runDetached`); `onClick` is a sequenced non-gameplay handler. Timings are in seconds. | §4.15 |
| 33 | `pointer` (Phase 4) | **`sentence` is the engine's `composeVerbLineText`**; `hover.defaultVerb`, `verb` and `item` are handles. `onContextChange` listens on a new persistent verb-context event, because `RoomScene` clears the old event's listeners on every room shutdown and new-style handlers register only once. | §4.15, §8.4 |
| 34 | API additions the port needed (Phase 4) | **`dialog.onStart(fn)`** (jensen-in-plaza's per-session option setup), **`game.newGame(startRoom?)`** (the title screen starts in the opening, not the configured start room), **`player.stopWalking()`**, **`inventoryOf` / `jensen.inventory`** (the state manager already keeps per-character bags), **`gui.root`**. | §4.8, §4.16 |
| 35 | Music controls next to generated tracks (Phase 4) | **`@game` builds `music` with `withMusicControls({…})`**, adding `stop()`, `isPlaying` and `current`; the generator reserves those three names in the music namespace (a track file with one of those names is a collision error asking for a rename). | §4.11, §7 |
| 36 | Do ported dialog choices stay skippable? (Phase 4) | **Choices with six or more lines, a fade or a walk are wrapped in `cutscene(…)`**, so ESC still skips them as it did when every `whenChoice` was a cutscene (decision 19). Short choices aren't wrapped; their lines are still click-to-skip. | §4.8 |
| 37 | Flag keys in the port (Phase 4) | **Flags whose old key had spaces keep it as `saveKey`** (`gotMission` → `'got mission'`, …): the baseline playthrough must pass unchanged and reads flags by key. Saves still don't need to load across the port (§11.2). | §4.7, §11.2 |
| 38 | How does the editor map handle names to content IDs? (Phase 5) | **By reading the generated `.ids.ts` modules** (`IdsIndex`), not by re-implementing the naming rules: each handle is constructed from its content ID, and aliases (`export const room = rooms.club`) are followed. When a handle is missing (content added since the last generation), the editor runs `generate:game-ids` once and retries. Speaker resolution is mirrored in the extension (`speakers.ts`) because CommonJS bundles can't import `benneSpeakers.mjs`; a unit test compares the two. | §9 |
| 39 | What does the editor do with scripts still on the old API? (Phase 5) | **Nothing:** it neither reads handlers from `register*Script` files nor adds new-style code to them (that would make the build transform rewrite the file's old callbacks, decision 14). Their chips show no handlers, and "add handler" asks to port the file first. Until Phase 6 ports the templates, games created from them get this behaviour. The old-API quoted-ID completion providers stay until Phase 6. | §9, §11.1 |
| 40 | Which handler stands for each Inspector action? (Phase 5) | **"Item used on this" is `x.onAnyItem(…)`**, and any item handler on the target counts as present. **A checkbox has one `onChange`** (was check / uncheck). **Per-object verb fallbacks have no BenneScript handler**: that Inspector button explains it instead of writing code (text-input submit got `onSubmit` in decision 50). **A room's `onUpdate` stub checks `game.currentRoom`**, since `onUpdate` is global. Play From names may be any single-line string (AI Apocalypse uses `'fix battery'`). New handlers go at the end of the file with their imports merged. | §4.15, §4.18, §4.19, §9 |
| 41 | How do string-union completions insert their quotes? (Phase 5) | **TypeScript already offers the quoted values** (`'U'`, `'coffee-full'`) wherever the expected type is a string-literal union; the plugin sorts them first and sets `filterText` so typing `U` matches `'U'`. VS Code doesn't ask for completions after `(` or `= `, so the extension opens the list there when the TS server has quoted values for that position. | §9 |
| 42 | Packaging and scaffolding (Phase 5) | **The extension bundles TypeScript** for the ScriptModel (the TS server plugin uses tsserver's own copy): the packaged (minified) `dist/extension.js` is about 4 MB. New room scripts start with `room.onEnter(…)` (the generator runs right after the room JSON is written); new character, item, GUI and dialog scripts are a comment with a new-style example, since an unused import would fail `noUnusedLocals`. Game templates are still old-API until Phase 6. | §9, §14 |
| 43 | What survives the deletion of the old API? (Phase 6) | **Engine services move out of `src/engine/scripting/`, which is deleted.** The dialog session becomes a plain engine module (`dialog/dialogSession.ts`: open, end, the active session); `GuiRuntime` keeps only immediate control operations (no queue, no `when*` bindings, no no-op facades); room-module loading, Play From setups and the transition wiring get their own scene modules; the per-frame registry moves into `bennescript/`. The transition orchestrator stops draining script queues after enter hooks, and the Inspector's message protocol uses the hook names (`onEnter`, `onBuilt`, …). | §10, §11.1 |
| 44 | Arming items with no script, and the default item verb (Phase 6) | **The engine arms an item when an item verb (`usesItem`) on its row has no handler**, with no global fallback line; BenneScript's after-handler arming (decision 28) is unchanged. This replaces the use/give alias lists. Where the engine needs an item verb without one being chosen (a walk-to click while an item is armed, test hooks), it uses `use` when the game has it as an item verb, else the first `usesItem` verb (`resolveDefaultItemVerbId`), the same shape of rule as decision 8. | §8.4 |
| 45 | API additions the templates needed (Phase 6) | **`player.switchTo(character)`** (9-verb's Push on Penny / Hank), **`character.startFacing(target?, { minWait, maxWait })` / `stopFacing()`** (Henry watching Hank), and a **settable `pointer.item`** (2-click drops the knife after making the sandwich). | §4.3, §4.15 |
| 46 | Transform scope once the old API is gone (Phase 6) | **Every script file is transformed** (decision 14's import test is gone), and **`x.onY.doNotActivate(fn)`** callbacks are step functions; before, `doNotActivate` handlers with speech failed the build because the method name doesn't start with `on`. AI Apocalypse never used `doNotActivate`. | §6.1, §6.2 |
| 47 | Template ports (Phase 6) | **Behaviour-preserving, checked by `npm run test:templates`**, which plays each template through the hooks and compares every spoken line with a run on the old template. Intended differences: 9-verb's peanut butter now lets other items fall through to "That doesn't work." (the old handler lacked `return false`); the DEV `whenVerbUnhandled` log and empty `void B` scripts are gone; 9-verb's `window` hotspot is `windowHotspot` (`scriptName`), so new games don't warn about a browser global; the any-room hooks are comments; hover-slide tweens run at once instead of queueing behind each other. Both configs now set `usesItem` and `defaultVerb` (§8.5). | §8.5, §11 |
| 48 | Old features without a BenneScript equivalent (Phase 6) | **Not added in Phase 6**, listed in the log; all ported in the follow-up (decision 50). Among them: video pause / resume / seek, speech settings beyond `textSpeed` and `clickToSkip`, dialog settings, per-character speech position and offset, follow-state getters, `whenAnyButtonClick`, list-box item activation and text-input submit, checkbox `disabled` and text-input focus, `whenLoadedAnyRoom`, `B.raw`, save rename / export / import, clearing a character's inventory. | §11.1 |
| 49 | Testing the templates (Phase 6) | **`npm run test:templates`** runs each template in a throwaway workspace (`scripts/template-workspace.mjs`: this repo's engine with the template as `src/game`), so `src/game` stays untouched. The dev/test hooks record every speech line where it is shown (`speech()`), report the active player, take a verb for `useItem` / `combine`, and `inventoryVerb` drops the armed item first, as `verb` does. The e2e fixture game is ported too; its server now generates handles and loads the BenneScript plugin. | §14 |
| 50 | Parity with the old `B` API (Phase 6 follow-up) | **Everything the old API could do, BenneScript can**, in its own style: properties for state (`speechPosition`, `focused`, `pointer.verb`), handlers on the thing they belong to (`gui.onAnyClick`, `input.onSubmit`, `list.onActivate`, `fallbacks.onUnhandled`, `game.onLoadedAnyRoom`), controls next to generated files where one slot is shared (`video.pause()`, `sfx.stopAll()`), and the config's own names for runtime settings (`settings.speech.*`, `settings.dialog.*`). **`B.raw` becomes `events`** (§4.21): engine events and script-to-script events, room-scoped in room scripts; `events.once` callbacks are step functions. **Saves take a slot or a name again.** Item handlers take `{ doNotClear: true }` (was `whenInventoryUsedOn.doNotClear`); the enter hooks take `{ skippable }`. `saves.import` reloads the imported room and ends the handler, like `load` (the old `importJson` only replaced the state). Not ported (confirmed after review): string-keyed flags and variables (`B.state.getFlag('x')` & co.), which typed `flags` / `vars` replace by design (§4.7); and `B.state.flush` / `setCurrentRoom`, which saves and room changes already do for you. | §4.3, §4.4, §4.6, §4.11, §4.15, §4.16, §4.17, §4.21 |
| 51 | Docs (Phase 7) | **The reference half of `docs/bennescript-api.md` is generated from the code** by `scripts/generate-bennescript-api-docs.mjs` (`npm run docs:api`): every value export of `@benne/script` must be placed in its layout (or listed as internal), and every public member needs a JSDoc comment, whose first paragraph becomes the description; design-doc references (`§4.2`, `decision 9`) are stripped. **`npm run check` runs `check:docs`**, which fails when the page is out of date. The hand-written half covers what the code can't say (sequencing, naming, generated verb methods, dispatch order, engine events, build errors). **The `bennescript` agent skill** is `.agents/skills/bennescript/SKILL.md`, mirrored in `.cursor/skills/bennescript/` as the repo's other skills are, with the cursor rule `.cursor/rules/bennescript.mdc` (scoped to script files). **They ship in the extension scaffold's shared files** (`bundle-extension-scaffold.mjs`), not in `game-templates/`, so new games get them and Update Engine refreshes them. Docs written before the refactor (engine review, codex suggestions, feasibility study) keep their old-API examples under a "historical document" note. | §11.1, §13 risks, `docs/` |
| 52 | Deviations found by the Phase 7 audit | Writing the docs from the code turned up promises in this spec that were never built or were built differently, recorded here and in as-built notes: **`room.onLoaded`** runs only when a save loads into the room, not before every `onEnter` (§4.4); **character scripts use `characters.x`**, flat character handles exist only in room modules (§4.9; `characters.x.onAnyItem` was ignored too, fixed in the Phase 7 follow-up); **no `saves.autosave()`** (§4.16); **timed calls inside `onUpdate` are not an error**: they start every frame and nothing waits; only speech labels fail the build (§4.18); **`face(…)` is instant**, only `faceClicked()` waits (§5); **no ESLint rule** for timed calls and no ESLint config for script files (§6.3, §9); **no brace-inserting code action**, only snippets (§12); **props have no `alpha` property** (§4.18's example): `fade(alpha, seconds)` sets it (and saves it). None of these blocked AI Apocalypse or the templates. **Decision 53 resolves all of them except the code action** (which gets a clearer error instead). | §4.4, §4.9, §4.16, §4.18, §5, §6.3, §9, §12 |
| 53 | Closing the decision 52 gaps (post-Phase 7) | **`room.onLoaded` runs only when a save loads into the room, by design**: it replaces the enter hooks on a load; `onEnter` is for entering. **A character script has its own character flat** (`characters/<id>/<id>.ids.ts` exports `penny`, the same object as `characters.penny`), like `room`, `dialog` and `gui` in their scripts; other characters stay `characters.x`, and flat names are not global, because a room's flat character is room-scoped. **`saves.autosave(save = 'Autosave')`** saves at once when allowed, else at the first frame where `saves.canSaveNow` is true, so it works in `onEnter` and cutscenes. **A timed action started in `onUpdate` throws `TimedActionInUpdateError`** (the frame context; `background` blocks get their own), logged once per callback. **`face(…)` is a timed action** with `.now`, instant for now, so turning animations can be added without changing scripts; a turn (`face`, `faceClicked`) doesn't count as a handler's first timed step for the interrupt policy, so `player.face('L')` then `walkToClicked()` keeps the walk interruptible (§5 rule 9). **ESLint rules** `bennescript/no-unwaited-timed-call` and `bennescript/no-await-in-step` (typed), in the repository's lint and in new games (`eslint.config.mjs`, `npm run lint`). **`() => Hank: "…"`** keeps failing to parse (no code action), but the build and the editor now say to add braces. **`alpha`** on props, characters and `player`: settable, instant, saved, stops a running `fade`. | §4.4, §4.9, §4.10, §4.16, §4.18, §5, §6.3, §7.1, §9, §12 |
| 54 | Review fixes to decision 53 | **Each `onUpdate` callback gets its own frame context**; a step that fails there (a timed action in a helper) is reported and the helper stops (its promise never settles), so dropped helper promises don't reject every frame; speech labels go through `timed()` and so hit the guard; `unhandled()` is quiet; a callback is logged once per message, at most five messages. **`face` stays timed**: frame code uses `startFacing` (added to `player`) or the new read-only `facing`. **A fade replaced by another fade or `alpha =` settles** (it used to be killed and never resolve). **A prop's handle carries its authored alpha** (generated as a third argument when it isn't 1), so `alpha` outside its room reads it. **Reserved names are reserved for characters**: the `characters` namespace uses flat naming rules, one name everywhere. **Update Engine keeps a game's own `lint` script.** The editor's arrow-speech message mirrors the build's, with a unit test keeping them in step. | §4.18, §5, §7.2 |
| 55 | Props and hotspots of another room | **State lives in the thing's own room.** Outside it, prop `visible` / `clickable` / `description` / `animation` / `alpha` / position and hotspot `active` / `description` read and write that room's saved state (they used to go through the active room, saving under its key and hitting a same-ID prop there). `fade` / `slideTo` jump to the end; `play` warns. Generated handles carry the non-default room JSON fields (`PropDefaults`, `HotspotDefaults`) as a third argument, replacing decision 54's alpha-only argument. | §4.10 |

**Revisit later**

- **Save snapshots.** Let players save mid-interaction by storing the last idle state (decision 2).
- **Per-handler interrupt opt-outs.** If some non-cutscene handlers need "never interruptible" or "always interruptible", add an option to the handler rather than changing the default (decision 1).

---

## 14. Implementation plan

The refactor is built by Claude, **one phase per prompt (one session per phase)**. Each session starts cold, so the spec (this doc), a progress log and standing instructions carry the context between phases. You review and commit at the end of every phase.

Sizes are rough relative estimates for one full-time developer, not schedules (see the caveat in the feasibility doc). With Claude implementing, elapsed time is mostly bounded by your review.

### 14.1 Ground rules

- **Branch.** All work happens on a dedicated branch (e.g. `bennescript-refactor`), never on `main`. The branch carries AI Apocalypse's content (~88 MB of assets).
- **Old API deleted last.** The old `register*Script` / `B` API keeps working on the branch until every script has been ported (Phase 6). Until then both APIs run side by side, so AI Apocalypse stays playable and testable after every phase. This is temporary scaffolding, never merged or shipped (decision 10).
- **The baseline playthrough is the safety net.** Phase 0 records an automated playthrough of AI Apocalypse on the *current* engine. Every later phase must keep it passing. The test drives the game through engine-level hooks (verb on target, item on target, dialog choice), never through BenneScript, so the same test runs unchanged before and after the port.
- **The spec stays true.** When implementation has to deviate from this doc, Claude updates the relevant section and adds a row to the §13 decisions table, rather than letting code and doc diverge.
- **Progress log.** Each phase appends a short entry to `docs/bennescript-refactor-log.md`: what was done, deviations from the spec, known issues, and anything the next phase needs to know.
- **Claude stops at the exit criteria** and reports. It doesn't commit and doesn't start the next phase.

### 14.2 Standing instructions (add to `CLAUDE.md` on the branch)

Paste this into `CLAUDE.md` on the refactor branch so every session picks it up automatically:

```markdown
## BenneScript refactor (branch: bennescript-refactor)

- The spec is `docs/bennescript-ergonomics-refactor.md`. Read §1–§11 and the
  §13 decisions table before changing scripting code. §14 is the phase plan.
- Progress so far is in `docs/bennescript-refactor-log.md`. Read it first.
- `src/game/` is a copy of the AI Apocalypse jam game, used as the test game.
  Do NOT run `set-template`, `sync-template-down` or `sync-boot-down`.
- The old `register*Script` / `B` API must keep working until Phase 6 deletes it.
- The baseline playthrough (`npm run test:playthrough`) must pass at the end of
  every phase.
- If the implementation must deviate from the spec, update the spec section and
  add a row to the §13 decisions table.
- At the end of a phase: run the phase's exit checks, append an entry to the
  progress log, then stop and report. Do not commit. Do not start the next phase.
```

### 14.3 Phases at a glance

_All eight phases are done (2026-10-06); see the progress log. What's left is the merge (Phase 6 log, "Merge preparation") and §14.5._

| Phase | Scope | Exit criteria | Size |
|---|---|---|---|
| **0. Setup & baseline** | Branch; copy AI Apocalypse content; engine-level test hooks; baseline playthrough + Play From smoke tests | Game runs in dev and BENNE Play on the current engine; playthrough passes 3 runs in a row | 2–4 days |
| **1. Spike** | Transform (steps + labels), minimal `Task` runtime, hand-written `cafe.ids`; port `cafe.room.ts` only | Cafe playable via the new API; playthrough passes; source maps work; go/no-go report | 1–2 weeks |
| **2. Runtime** | Full InteractionContext, `Task`, cancellation, skip, `.now`, `together`, `background`, ending calls, interrupt and save policies | A unit test per §5 rule; playthrough passes | 2–3 weeks |
| **3. Generator** | Handle generation (§7), verbs from config (§8), `state.ts`, speaker resolution, collision/reserved-name errors | AI Apocalypse generates cleanly; cafe uses generated handles; playthrough passes | 1–2 weeks |
| **4. Handle API + port** | All handles and verb dispatch; port AI Apocalypse group by group | Every AI Apocalypse script on the new API; playthrough passes | 2–3 weeks |
| **5. Editor** | TS plugin completions/diagnostics, go-to-JSON, AST ScriptModel, scaffolding emits new syntax | Inspector "add handler" emits new syntax; extension tests pass | 1–2 weeks |
| **6. Templates & delete old API** | Port both templates; delete the old API; merge preparation | No old-API references remain; `npm run test:ci` and playthrough pass | 1 week |
| **7. Docs** | Rewrite public and API docs, architecture §7, agent skill | Docs describe only the new API | 1 week |

**Phase 1 is the decision point.** If the label trick, the transform rules or the debugging experience feel wrong in a real room, stop there. Keeping only the async runtime underneath still fixes the sequencing bug.

### 14.4 Phase details and prompts

Each prompt assumes the standing instructions in §14.2 are in `CLAUDE.md`.

#### Phase 0: Setup & baseline

**Before running it:** commit any outstanding work in `~/Projects/ai-apocalypse` (e.g. the untracked `paint spill 2.png`) so you copy a clean snapshot. Add the standing instructions to `CLAUDE.md` as part of this phase.

- Create the branch and copy `~/Projects/ai-apocalypse/src/game/` into `src/game/`, **excluding `boot/`** (BENNE's engine-owned boot files stay).
- Get the game building and running on BENNE's current engine. AI Apocalypse's engine copy is older, so fix any content incompatibilities in the content, not the engine.
- Add **engine-level test hooks**, available in dev and test builds only: dispatch a verb on a target ID, use an item on a target, choose a dialog option, wait until the game is idle, and read state (current room, flags, inventory). They must go through the same dispatch path as real clicks and must not depend on BenneScript.
- Write `npm run test:playthrough`: a Playwright test that plays AI Apocalypse from the title screen to the credits through the hooks, asserting key state along the way. Record video for the long cutscenes (lab first visit, plaza first visit, finale) as a visual reference for later phases.
- Write Play From smoke tests: start each Play From entry point and assert no errors.
- Expected breakage: `tests/e2e/gameplay.spec.ts` (clicks coordinates in the old sample game), `tests/fixtures/content-baseline.json`, the prebuilt BENNE Play chunks. Fix, replace or explicitly skip each one, and note it in the log.
- Create `docs/bennescript-refactor-log.md`.

```text
We're starting the BenneScript refactor described in
docs/bennescript-ergonomics-refactor.md. Run Phase 0 (Setup & baseline) from §14.4.

1. Create a branch `bennescript-refactor` from main.
2. Add the standing instructions from §14.2 to CLAUDE.md.
3. Copy ~/Projects/ai-apocalypse/src/game/ into src/game/, excluding boot/.
   Get the game running on this repo's current engine (npm run dev and
   BENNE Play). Fix incompatibilities in the content, not the engine.
4. Add dev/test-only engine-level test hooks (verb on target, item on target,
   dialog choice, wait for idle, read state) that go through the real dispatch
   path and don't use BenneScript.
5. Write `npm run test:playthrough`: a Playwright playthrough from the title
   screen to the credits via those hooks, asserting key state, with video for
   the major cutscenes. Add Play From smoke tests.
6. Fix, replace or skip tests broken by the content swap, and explain each one.
7. Create docs/bennescript-refactor-log.md with a Phase 0 entry.

Do not change any scripting APIs in this phase. Stop when the exit criteria
in §14.3 are met: the playthrough must pass 3 runs in a row.
```

#### Phase 1: Spike

- The Vite transform (§6): step functions, statement-level `$.step`, speech labels, source maps. Register it in every Vite config that bundles game scripts (game, BENNE Play, previews).
- A minimal `Task` runtime that runs new-style handlers next to the old API. Events route to whichever API registered the handler.
- A **hand-written** `cafe.ids.ts` and just enough handle API for the cafe.
- Port `cafe.room.ts` (and only that) to the new syntax.
- Write a spike report in the log: what felt good, what felt wrong, transform edge cases found, and a go/no-go recommendation.

```text
Run Phase 1 (Spike) of the BenneScript refactor. Read the progress log first.

Build the smallest end-to-end slice of the new BenneScript:
- the Vite transform from §6 (step functions, $.step wrapping, speech labels,
  source maps), registered in every Vite config that bundles game scripts;
- a minimal Task runtime that runs new-style handlers alongside the existing
  register*Script API;
- a hand-written src/game/rooms/cafe/cafe.ids.ts and only the handle API the
  cafe needs.

Port src/game/rooms/cafe/cafe.room.ts to the new syntax. Leave every other
script on the old API.

Exit checks: the cafe is fully playable in dev and BENNE Play, breakpoints in
cafe.room.ts hit the right lines in DevTools, and `npm run test:playthrough`
passes. Then write a spike report in the progress log: what worked, what felt
awkward to write, transform edge cases you hit, and a go/no-go recommendation.
Stop and report. This phase is a decision point.
```

**After Phase 1:** read the ported `cafe.room.ts` and play the cafe yourself before deciding to continue.

#### Phase 2: Runtime

- Full InteractionContext (§10): `Task`, `$.step` lifetime checks, cancellation on room change and load, skip mode with `finishNow()`, `.now`, `Task.wait()`, `together`, `background`, `cutscene`, `withInputDisabled`.
- Ending calls typed `never`: `goTo`, `saves.load`, `unhandled`, `dialog.end`.
- Interrupt policy (decision 1) and save refusal (decision 2) for new-API handlers.
- Dialog `start()` waits, and sub-dialogs return to their parent (decision 3).
- Old-API handlers keep their old behaviour.

```text
Run Phase 2 (Runtime) of the BenneScript refactor. Read the progress log first.

Implement the full step runtime described in §5, §9 and §10: InteractionContext,
Task (including finishNow for cutscene skip), cancellation on room change and
save load, .now and Task.wait(), together, background, cutscene,
withInputDisabled, and the ending calls goTo / saves.load / unhandled /
dialog.end typed as never. Implement decisions 1–3 from §13 (interrupt policy,
save refusal during interactions, dialog start waits and sub-dialogs return to
their parent) for new-API handlers.

The old API must keep its current behaviour. Write one unit test per numbered
rule in §5, plus tests for the interrupt policy and the save refusal.

Exit checks: new unit tests pass, `npm run test:unit` passes, the cafe still
works, and `npm run test:playthrough` passes. Update the log, then stop and report.
```

#### Phase 3: Generator

- Extend `scripts/generate-game-ids.mjs` (§7): `@game` and per-room, per-dialog and per-GUI `.ids` modules; naming and prefix stripping; namespaces; `scriptName` overrides; collision errors.
- Verbs from config (§8): `on<V>`, `on<V>Item`, `fallbacks.*`, the `verbs` namespace, `usesItem` defaulting (decision 7), game-level `defaultVerb` (decision 8), reserved verb IDs.
- `state.ts` with `defineFlags` / `defineVars`.
- Speaker-label resolution data: IDs plus normalised display names, ambiguity errors (decision 4).
- `validate-content` checks every verb ID in content JSON.
- Replace the hand-written `cafe.ids.ts` with the generated one.

```text
Run Phase 3 (Generator) of the BenneScript refactor. Read the progress log first.

Extend the ID generator into the handle generator described in §7 and §8:
the @game module, per-room / per-dialog / per-GUI .ids modules, naming rules,
namespaces, scriptName overrides and collision errors; verb methods, item-verb
methods, fallbacks and the `verbs` namespace generated from game-config.json,
with usesItem and game-level defaultVerb per decisions 7 and 8; reserved verb
IDs; state.ts with defineFlags / defineVars; and speaker-label resolution
(ID or normalised display name, ambiguity is an error, decision 4). Make
validate-content check all verb IDs in content JSON.

Replace the hand-written cafe.ids.ts with the generated module. Generated files
are gitignored and regenerate on dev, build and editor changes, like
benne-game-ids.d.ts today.

Exit checks: AI Apocalypse's content generates with no collisions you can't
explain (list any in the log), `npm run check` passes, the cafe works on
generated handles, and `npm run test:playthrough` passes. Update the log, then
stop and report.
```

#### Phase 4: Handle API and port

- Implement every handle in §4 and the generic `on(verb)` dispatch with `usesItem` arming (§8.4).
- Port AI Apocalypse **group by group**, running the playthrough after each group:
  1. remaining rooms;
  2. dialogs;
  3. inventory and character scripts;
  4. GUIs;
  5. the global script, plus `state.ts` replacing flag seeding.
- Apply the timing checklist (§11.3) to every handler, and note each timing judgement in the log.
- Add any new engine primitives the port needs (`waitForClick`, control `fadeTo`, `pointer.sentence`).

```text
Run Phase 4 (Handle API and port) of the BenneScript refactor. Read the
progress log first.

Implement the remaining handle API from §4 (characters, props, hotspots,
regions, walkables, items, dialogs and options, GUIs and controls, sound,
music, camera, fades, video, saves, settings, game, fallbacks) and generic
on(verb) dispatch with usesItem arming (§8.4). Add the new primitives the port
needs (waitForClick, control fadeTo, pointer.sentence).

Then port AI Apocalypse to the new API in this order, running
`npm run test:playthrough` after each group and fixing failures before moving
on: (1) remaining rooms, (2) dialogs, (3) inventory and character scripts,
(4) GUIs, (5) globalScript.ts plus src/game/state.ts. Use the translation
guide in §11.2 and apply the timing checklist in §11.3 to every handler. Log
every timing judgement you make.

Exit checks: no AI Apocalypse script uses the old API, `npm run check` passes,
the playthrough passes, and every Play From smoke test passes. Compare the
cutscene videos with the Phase 0 recordings and note any visible differences.
Update the log, then stop and report.
```

#### Phase 5: Editor

- TS server plugin: speaker completions, string-union completions that insert quotes, unknown-speaker diagnostics, go to definition from handles to JSON (§9).
- The AST-based ScriptModel replaces `verbHandlerPresence.ts` regex scanning: Inspector handler chips, "add handler" and "reveal handler", Play From discovery, voice-ID export.
- All scaffolding emits the new syntax.

```text
Run Phase 5 (Editor) of the BenneScript refactor. Read the progress log first.

Update the VS Code extension for the new BenneScript per §9: TS server plugin
speaker completions, string-union completions that insert quotes,
unknown/ambiguous speaker diagnostics, and go-to-definition from generated
handles to their JSON. Replace the regex-based script scanning
(verbHandlerPresence.ts and friends) with a TypeScript-AST ScriptModel used by
Inspector handler chips, add/reveal handler, Play From discovery and the voice
ID export. Make every scaffolding command emit the new syntax.

Exit checks: `npm run test:extension` passes, Inspector "add handler" on a prop
in AI Apocalypse inserts a correct new-style handler, voice-ID export finds all
speech lines in the ported game, and `npm run test:playthrough` still passes.
Update the log, then stop and report.
```

#### Phase 6: Templates, delete the old API, merge preparation

- Port `game-templates/2-click` and `game-templates/9-verb` to the new API.
- **Delete the old API**: `register*Script`, `B`, the `BenneScriptCore` subclasses, `interactionTail` / `chain`, `BlockingWithNow`, `when*` sugar, `VERB_ALIAS_CANDIDATES`, and the side-by-side routing from Phase 1.
- Merge preparation: decide what `src/game` is on `main`. The recommendation is the ported 9-verb template, keeping AI Apocalypse's content off `main`.

```text
Run Phase 6 (Templates and delete old API) of the BenneScript refactor. Read the
progress log first.

1. Port game-templates/2-click and game-templates/9-verb to the new API.
2. Delete the old scripting API entirely (register*Script, B, the
   BenneScriptCore subclasses, interactionTail/chain, BlockingWithNow/withNow,
   the when* sugar, VERB_ALIAS_CANDIDATES) and the side-by-side routing added
   in Phase 1.
3. Prepare for merging: list what must change so `main` gets the ported 9-verb
   template in src/game instead of AI Apocalypse, but do not make that switch
   yet. I'll decide when to merge.

Exit checks: no references to the old API remain (search for them and include
the result in the log), `npm run test:ci` passes, and `npm run test:playthrough`
passes on AI Apocalypse. Update the log, then stop and report.
```

#### Phase 7: Docs

- Rewrite `docs/public/bennescript.md` and `docs/bennescript-api.md` (generated from code where possible), and the scripting parts of `docs/architecture.md` §7.
- Add a `bennescript` agent skill and cursor rule so AI assistants write the new syntax.
- Mark this design doc as implemented, and record final deviations in §13.

```text
Run Phase 7 (Docs) of the BenneScript refactor. Read the progress log first.

Rewrite docs/public/bennescript.md and docs/bennescript-api.md for the new API
(generate the API reference from code where practical), update the scripting
sections of docs/architecture.md, and add a concise `bennescript` agent skill
and cursor rule teaching the new syntax, built from real AI Apocalypse
examples. Mark docs/bennescript-ergonomics-refactor.md as implemented and make
sure §13 records every deviation from the original spec.

Exit check: no doc describes the old API except as history. Update the log,
then stop and report.
```

### 14.5 After the refactor

- **Merge** the branch once you've switched `src/game` back to the ported 9-verb template (Phase 6 lists the steps).
- **Bring AI Apocalypse forward.** Its repo still has the old engine copy. Update its engine to the new BENNE and copy the ported scripts back from the branch.
