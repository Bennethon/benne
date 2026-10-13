---
title: BenneScript
outline: deep
---

# BenneScript

**BenneScript** is how you bring a BENNE game to life: what happens when the player looks at the door, talks to Penny or gives her a sandwich. It is TypeScript, so you get autocomplete, type checking, the debugger and AI assistants, with three conveniences on top:

- **Lines run in the order you write them.** A walk finishes before the next line of dialogue starts, and a flag set after a speech line is set after the line has been spoken. You never type `await`.
- **Everything in your game has a name.** Rooms, props, characters, items, dialog options, GUI controls, sounds and verbs are typed names generated from your content (`door`, `items.key`, `sfx.doorOpen`), so a typo is a red squiggle, not a silent bug.
- **Dialogue reads like a script.** ``Hank: `Let's see if this fits.` `` is a line of dialogue. Backticks let a line contain `"` and `'` freely, and `${…}` drops in a value.

Here is a handler for the apartment door in the 9-verb template, where the player uses the key on the locked door:

```ts
door.onUseItem(items.key, () => {
  if (flags.unlockedDoor) unhandled()   // already open: "That doesn't work."
  walkToClicked()
  Hank: `Let's see if this fits.`
  inventory.remove(items.key)
  sfx.doorOpen.play()
  wait(0.75)
  door.animation = 'Door-open'
  Hank: `It's open!`
  dialogs.chatwithpenny.options.door.off()
  flags.unlockedDoor = true
})
```

Hank walks over, says his line, the key leaves the inventory, the sound plays, the script waits three quarters of a second, the door opens, Hank speaks again, the dialog option about the locked door disappears and the flag is set, each step after the one before.

## How a script runs

### Lines wait for each other

Inside a handler, each line starts when the line above it has finished. Some lines take time: a walk, a speech line, `wait(…)`, a one-shot animation, a fade, a camera move. Others are instant: setting a flag, adding an item, showing a prop, starting a sound. You don't have to know which is which to get the right order; it only matters when you want things to **overlap** (see [Doing things at the same time](#doing-things-at-the-same-time)).

| Takes time (the script waits) | Instant |
|---|---|
| `walkToClicked()`, `player.walkTo(…)`, `henry.walkTo(…)`, `face(…)` | `player.moveTo(…)` (teleport), `door.alpha = …` |
| ``Hank: `…` ``, `` say`…` ``, `penny.say(…)`, `display(…)` | `flags.x = …`, `vars.x = …`, any read |
| `wait(…)`, `waitForClick()` | `inventory.add(…)`, `inventory.remove(…)` |
| `door.play('Door-opening')` (one-shot animation) | `door.animation = …`, `door.show()`, `door.hide()` |
| `door.fade(…)`, `door.slideTo(…)`, `control.fadeTo(…)` | `sfx.x.play()`, `music.x.play()`, `music.stop()` |
| `fadeOut()`, `fadeIn()`, `camera.focus(…)`, `camera.zoom(…)` | `camera.shake()` |
| `sfx.x.playAndWait()`, `video.x.playAndWait()` | `options.x.on()`, `guis.x.show()` |
| `dialogs.x.start()` (until the conversation ends), `saves.save(…)` | `background(…)` |
| `cutscene(…)`, `together(…)`, your own helper functions | anything ending in `.now(…)` |

### Some lines end the handler

`rooms.x.goTo()` starts the transition to another room, and nothing after it in the handler runs: there is no "after" in a room you've left. The same goes for `unhandled()`, `dialog.end()`, `saves.load(…)` and `game.newGame()`. The editor greys out any code below them.

### One interaction at a time

While a handler runs, the player can't start another one by clicking the world, with one exception: while the player character is still walking over (`walkToClicked()` as the first thing in the handler), a click elsewhere cancels the handler and starts the new action. Players can change their mind on the way, as in classic SCUMM games. Once Hank starts talking, clicks on the world are ignored until he's done. A click still skips the current speech line (if click-to-skip is on).

GUI buttons keep working during an interaction, so the player can always open the game menu.

## Script files

Each kind of content has its own script file, next to its JSON. You write handlers at the top level of the file; there's nothing to register.

| File | What goes in it |
|---|---|
| `rooms/apartment/apartment.room.ts` | The room: what happens on entering and leaving, and verbs on its props, hotspots and characters |
| `characters/henry/henry.character.ts` | Handlers for Henry in every room he appears in |
| `inventory/PB/PB.inventory.ts` | The peanut butter: verbs on its inventory row, and other items used on it |
| `dialogs/chatwithpenny/chatwithpenny.dialog.ts` | What each choice in the conversation does |
| `guis/save-menu/save-menu.gui.ts` | The GUI's buttons, sliders and lists |
| `globalScript.ts` | Fallback lines for verbs nothing else handles, and hooks for every room |
| `state.ts` | Your game's flags and variables |
| `scripts/*.script.ts` | Helpers shared by several scripts |

The editor creates these files for you when you add content, and the Inspector can add handlers to them (see [BENNE Editor](./benne-editor)).

### Names and imports

Names come from three places. The editor's auto-import adds the import lines as you type a name.

```ts
// src/game/rooms/apartment/apartment.room.ts
import { faceClicked, inventory, player, unhandled, wait, walkToClicked } from '@benne/script'
import { dialogs, flags, items, music, rooms, sfx } from '@game'
import { room, couch, door, hank, knife, penny, regions, windowHotspot } from './apartment.ids'
```

- **`@benne/script`**: the engine's actions and objects: `walkToClicked`, `wait`, `say`, `inventory`, `player`, `camera`, `cutscene`, `saves`, `settings`, `game`, …
- **`@game`**: everything in your game, by kind: `rooms`, `characters`, `items`, `dialogs`, `guis`, `sfx`, `music`, `video`, `verbs`, `fallbacks`, `flags`, `vars`.
- **`./apartment.ids`**: this room's own things, as plain names: `room`, its props (`couch`, `door`, `knife`), hotspots (`windowHotspot`), characters (`hank`, `penny`), plus `points`, `regions` and `walkables`. A dialog script imports `dialog` and `options` from its `.ids` module; a GUI script imports `gui` and its controls.

The `.ids` modules and `@game` are **generated** from your JSON whenever it changes. Names are your IDs in camelCase: the prop `PeanutButter` is `peanutButter`, the item `PB` is `items.pb`, the point `henry-fountain` is `points.henryFountain`, and a dialog option `what about the key` would be `options.whatAboutTheKey`. A room's own ID and the kind of thing are dropped from the front, so a hotspot `outside-hotspot-door` would be plain `door`. If two things would get the same name, or a name clashes with a BenneScript name, give one of them a `"scriptName"` in its JSON (a character can't take a BenneScript name such as `camera` or `dialog` as its `scriptName` at all, because its name is used on its own in room scripts) (the templates' game menu has a button with `"scriptName": "settingsBtn"`, because `settings` is taken).

Things in a room are plain names because you use them constantly. Everything else is grouped (`items.knife`), because an item, a prop and a dialog can easily share a name: in the 9-verb template, the knife on the table is the prop `knife`, and the one in the inventory is `items.knife`.

## Rooms

### Entering and leaving

```ts
room.onEnter(() => {            // before the fade-in: set the scene up, invisibly
  guis.verbs.hide()
})

room.onEnterAfterFade(() => {   // after the fade-in: music, entrances, cutscenes
  music.myCatIsCrazy.play()
})

room.onLeave(() => { … })       // before the next room loads
room.onLoaded(() => { … })      // only when a save loads into this room, instead of the enter hooks
```

`onEnter` is for entering the room; `onLoaded` is for restoring it from a save (the enter hooks don't run then). The fade-in waits for `onEnter`, so keep it to instant setup: positions, visibility, flags. Put anything the player should see in `onEnterAfterFade`. Both run as cutscenes, so ESC skips them; pass `{ skippable: false }` as a second argument to prevent that.

Where the player came from, and how often they've been here:

```ts
// rooms/outside/outside.room.ts
room.onEnter(() => {
  if (room.cameFrom(rooms.apartment)) {
    hank.moveTo(points.enterFromDoor)
    hank.face('R')
  }
  if (room.isFirstVisit) {
    henry.moveTo(points.henryFountain)
  }
})
```

`room.visitCount`, `room.hasVisited`, `room.last` (the previous room) and `rooms.outside.visitCount` (any room) are there too.

### Changing rooms

```ts
door.onUse(() => {
  walkToClicked()
  sfx.doorOpen.play()
  rooms.outside.goTo()
})
```

### Play From

**Play From** in BENNE Play starts a room in a prepared state, so you can test the end of a puzzle without playing up to it. Write the setup at the top level of the room script:

```ts
playFrom('make sandwich', () => {
  inventory.add(items.bread)
  inventory.add(items.knife)
  items.knife.animation = 'Knife-PB'
  bread.hide()
  knife.hide()
})
```

The name is what appears in the Play From menu. `room.visitCount` and `room.last` can be set here, to pretend the player has been before or came from somewhere.

## Verbs on things

Handlers are named after the verbs in your `game-config.json`. The 9-verb template has `give`, `pickUp`, `use`, `open`, `look`, `push`, `close`, `talkTo` and `pull`, so its props, hotspots and characters have `onGive`, `onPickUp`, `onUse`, `onOpen` and the rest. The 2-click template has only `look` and `use`, so it has `onLook` and `onUse`. Custom verbs work the same way: add a verb to the config and its method appears. A verb your game doesn't have is a type error. [Verbs](./verbs) covers how a click becomes a verb, item verbs, and the order handlers are tried in.

```ts
knife.onLook(() => {
  faceClicked()
  Hank: `It's a knife.`
})

knife.onPickUp(() => {
  walkToClicked()
  inventory.add(items.knife)
  knife.hide()
})
```

`walkToClicked()` walks the player to the clicked thing's walk-to point and turns to face it. `faceClicked()` only turns toward it. Most handlers start with one of the two.

**One handler for several verbs:**

```ts
rockMoved.on(['pull', 'push'], () => {
  walkToClicked()
  Hank: `Let's see what this does...`
})
```

**Falling through.** `unhandled()` ends the handler and passes the click on, as if this handler didn't exist: to the character's own script, then to the global fallback ("That doesn't work."). Use it when a handler only applies sometimes:

```ts
penny.onGiveItem(items.sammich, () => {
  if (!flags.askedPennyForKey) unhandled()   // she hasn't asked for one yet
  walkToClicked()
  Hank: `Here, Penny! Have a sandwich.`
  // …
})
```

A plain `return` ends the handler without falling through.

**Changing things.** Props, hotspots and characters have properties you can set at any time. They take effect at once and are saved:

```ts
windowHotspot.active = false          // hotspots: can't be hovered or clicked
door.clickable = false                 // props and characters
door.description = 'broken door'       // the name shown when hovering
door.animation = 'Door-open'
penny.visible = false                  // or penny.hide() / penny.show()
```

## Talking

**A line of dialogue** is the speaker's name, a colon and the line in quotes. The name can be the character's ID or display name, in any case; `Player:` is whoever the player controls.

```ts
Hank: `What the...?`
PENNY: `MAKE ME A SANDWICH!`
Player: `I have to find a way out!`
```

Names with punctuation or spaces drop it: if Henry's display name were `Henry Jr.`, his lines could start `HenryJr:`. If you mistype a name, the build stops with "Unknown speaker `Hnak`. Did you mean `Hank`?".

Use backticks to put values in a line:

```ts
Hank: `I've been out here ${rooms.outside.visitCount} times.`
```

**A conversation** reads well as a `say` block. Inside one, names can be written exactly as in the JSON, and lines need no quotes:

```ts
couch.onLook(() => {
  faceClicked()
  say`
    Hank: It's my weird, magical, poorly drawn couch.
    Penny: It's OUR couch.
    Hank: It's our weird, magical, poorly drawn couch.
    Penny: Thank you.
  `
})
```

**The method form** is for a speaker you pick at runtime, or for options:

```ts
const speaker = penny.visible ? penny : hank
speaker.say("Is anyone there?")
player.say("Uh, whatever.", { clickToSkip: false })
```

**Narration** (no speaker) goes in the display-text box: `display("The door is locked.")`.

**Voice files.** A line that starts with a number between bars plays a recording: ``Hank: `|17| This case just got complicated.` `` plays `assets/audio/voice/hank17.mp3`. The editor numbers your lines for you; see [Sound, Voice & Video](./sound-voice-and-video#voiced-dialogue).

## Inventory

```ts
inventory.add(items.knife)
inventory.remove(items.sammich)
inventory.add(items.bread, 3)           // three, if Bread is stackable
if (inventory.has(items.key)) { … }
inventory.count(items.bread)
penny.inventory.add(items.sammich)      // another character's bag
```

### Using an item on something

When the player uses an item on a prop, hotspot or character, the matching `on<Verb>Item` handler runs:

```ts
table.onUseItem(items.broom, () => {
  walkToClicked()
  sfx.sweeping.playAndWait()
  Player: `I cleaned the table.`
})
```

Items with no handler on that target fall through to the global "That doesn't work." line. For one line covering every other item on a target, use `onAnyItem`:

```ts
henry.onAnyItem(() => {
  faceClicked()
  Hank: `Henry doesn't need that.`
})
```

`onUseItem` exists because `use` is an **item verb** in the config (`"usesItem": true`). A 9-verb game's `give` gets `onGiveItem`, and a custom "Throw … at" verb would get `onThrowItem`. `onItem(item, …)` handles an item with any item verb.

After an item is used, it stays selected or is put back depending on the item's `dropWhenUsed` (or the game's `dropWhenInventoryUsed`). Pass `{ doNotClear: true }` as the last argument to keep it selected after that handler.

### Item scripts

An item's own script handles verbs on its inventory row, and other items used on it:

```ts
// inventory/Bread/Bread.inventory.ts
items.bread.onLook(() => {
  Hank: `It's some bread.`
})

items.bread.onCombine(items.knife, () => {
  inventory.remove(items.bread)
  inventory.add(items.sammich)
  Hank: `This looks delicious!`
})
```

Using an item verb on an inventory row (`Use` on the bread) selects the item, so the player can then click a target. That happens after the item's `onUse` handler, if it has one. To handle `Use` on the row without selecting the item, register the handler with `items.sammich.onUse.doNotActivate(() => { … })`, as the 9-verb template's sandwich does.

An item's icon, cursor and name can change: `items.lantern.animation = 'Lantern-glowing'`, `items.key.cursorAnimation = 'Key-bent'`, `items.key.description = 'bent key'`.

## Flags, variables and visits

Declare your game's state once, with defaults, in `src/game/state.ts`:

```ts
import { defineFlags, defineVars } from '@benne/script'

export const flags = defineFlags({
  unlockedDoor: false,
  turnedOnFountain: false,
  askedPennyForKey: false,
})

export const vars = defineVars({
  timesAskedPenny: 0,
})
```

Then use them anywhere (`@game` exports them):

```ts
flags.unlockedDoor = true
if (flags.unlockedDoor && !flags.turnedOnFountain) { … }
vars.timesAskedPenny += 1
```

Flags are true or false. Variables hold numbers, strings, booleans, and arrays or objects of those. Both are saved. A misspelt flag is a type error, so you can't set `flags.unlockedDor` by accident.

The BENNE Editor's **State** view adds, renames and changes flags and variables without opening `state.ts` (see [BENNE Editor → State](./benne-editor#state)).

If you rename a flag after players have saves, keep the old name for the save with `flag(false, { saveKey: 'old name' })`.

## Dialogs

A dialog's options are written in its JSON; its script says what each choice does. The player says the option's text first, then the handler runs. [Creating a dialog](./creating-a-dialog) walks through building one.

```ts
// dialogs/chatwithpenny/chatwithpenny.dialog.ts
import { wait } from '@benne/script'
import { flags } from '@game'
import { penny } from '../../rooms/apartment/apartment.ids'
import { dialog, options } from './chatwithpenny.ids'

options.greeting.onChooseOnce(() => {
  Penny: `Fine.`
  options.door.on()
})

options.door.onChoose(() => {
  Player: `I want to go outside.`
  Penny: `I want a sandwich.`
  wait(0.5)
  Penny: `Make me a sandwich and I'll give you the key.`
  flags.askedPennyForKey = true
})

options.bye.onChoose(() => {
  Penny: `Bye!`
  penny.face('D')
  dialog.end()
})
```

- `onChoose` runs each time the option is chosen; `onChooseOnce` also removes the option afterwards.
- `options.x.on()` / `off()` show and hide options. From another script: `dialogs.chatwithpenny.options.door.on()`.
- `dialog.end()` closes the conversation and ends the handler, so put anything that should still happen above it.
- `dialog.onStart(() => { … })` runs each time the conversation opens, to decide which options to show.

**Starting a conversation** waits until it ends:

```ts
penny.onTalkTo(() => {
  walkToClicked()
  dialogs.chatwithpenny.start()
  // anything here runs after the player leaves the conversation
})
```

**Sub-conversations.** Starting a dialog from a choice opens it on top; when it ends, the first one comes back:

```ts
// chatwithpenny.dialog.ts
options.neighbours.onChoose(() => {
  Penny: `Sure. Who do you want to know about?`
  dialogs.pennyGossip.start()       // back to these choices when it ends
})

// penny-gossip.dialog.ts
options.thatsAll.onChoose(() => {
  Penny: `Okay!`
  dialog.end()                      // back to the chatwithpenny choices
})
```

A long choice can be wrapped in `cutscene(() => { … })` so ESC skips it (click-to-skip works line by line either way).

## Characters

A character's handlers in a **room script** apply in that room. In the character's **own script** they apply in every room the character appears in, unless the room has its own handler for that verb.

```ts
// characters/penny/penny.character.ts
import { walkToClicked } from '@benne/script'
import { dialogs } from '@game'
import { penny } from './penny.ids'

penny.onTalkTo(() => {
  walkToClicked()
  dialogs.chatwithpenny.start()
})
```

In its own script a character is imported from its `.ids` file, like a room's things in a room script. Any other character is `characters.x` there (from `@game`).

**Moving and facing:**

```ts
player.walkTo(points.henryFountain) // a point in the room
player.walkTo(fountainOff)           // a prop, hotspot or character's walk-to point
player.walkTo({ x: 120, y: 160 })    // room pixels
player.face('L')                     // 'U', 'D', 'L' or 'R'; waits for the turn
player.moveTo(points.enterFromDoor)  // teleport
henry.walkTo(points.henryFountain)
henry.startFollowing(player, { minDistance: 60 })
henry.stopFollowing()
henry.startFacing(hank)              // keep turning toward Hank as he moves
player.switchTo(penny)               // the player now controls Penny (in the apartment)
```

`player` is whoever the player controls; `hank` (from the room) is Hank specifically.

**Opacity:** `penny.alpha = 0.5` sets it at once (and is saved); `penny.fade(0, 1)` fades over a second and waits.

**Animation:** `henry.animation = 'IdleU'` sets an animation that stays (and is saved) until `henry.stopAnimation()`. `henry.play('Wave')` plays one once and waits for it, for a `Wave` tag you've drawn. Animation names come from the Aseprite file, so the editor completes them.

## Props

| | |
|---|---|
| `door.animation = 'Door-open'` | Change the looping animation. Instant, saved. |
| `door.play('Door-opening')` | Play an animation once and wait for it, then go back to the looping one. |
| `door.show()` / `door.hide()` | Instant, saved. |
| `door.fade(0, 1.5)` | Fade to invisible over 1.5 seconds, and wait. |
| `door.alpha = 0.5` | Set the opacity (0 to 1) instantly. Saved. |
| `door.moveTo({ x: 80, y: 90 })` | Move instantly. |
| `door.slideTo({ x: 80, y: 90 }, 2)` | Move over 2 seconds, and wait. |

A prop (or hotspot) can be changed from another room's script too: import it from its room's `.ids` module and set it. The change is saved for that room and shows when you go there. Fades and slides from another room happen at once, and `play` only works in the prop's own room.

If both rooms have a `door` (in the 9-verb template, the apartment's door is a prop and the street's is a hotspot), import the other room's module under its name and write `outside.door`:

```ts
import * as outside from '../outside/outside.ids';

door.hide()                    // this room's door
outside.door.active = false    // the one outside
```

The editor suggests `outside.door` when you type `door`, and adds the import when you pick it.

## Sound, music, camera and video

```ts
sfx.doorOpen.play()             // starts the sound and goes on
sfx.doorClose.playAndWait()     // waits until it ends
sfx.sweeping.play({ volume: 0.5 })

music.halloweenSpooky.play()    // crossfades as set in the config
music.stop()
if (!music.isPlaying) music.myCatIsCrazy.play()

camera.focus(fountainOff)       // pan; waits
camera.zoom(2, 1)               // 2× over 1 second; waits
camera.zoomTo(fountainOff, 1.5, 0.6)
camera.shake(0.3)
camera.reset()

fadeOut()                       // fade the screen to black; waits
fadeIn()

video.intro.playAndWait()       // a video you've added as assets/videos/intro.mp4
```

Sound and music names come from the files in `assets/audio/sfx/` and `assets/audio/music/`. See [Sound, Voice & Video](./sound-voice-and-video).

## Cutscenes and skipping

Wrap a scene in `cutscene(…)` to make it skippable:

```ts
rockMoved.on(['pull', 'push'], () => {
  walkToClicked()
  cutscene(() => {
    Hank: `Let's see what this does...`
    rockMoved.hide()
    leverPulled.show()
    fountainOff.hide()
    fountainOn.show()
    wait(0.75)
    Henry: `WOO HOO! IT'S WORKING!`
    music.halloweenSpooky.play()
  })
  flags.turnedOnFountain = true
})
```

While a cutscene runs, clicks on the world do nothing, a click still skips the current line, and **ESC** skips to the end of the block: lines are dismissed, waits end, walks and animations jump to where they would have ended. The script then carries on after the block, so whatever the cutscene set up is in place either way.

To turn off skipping for one cutscene, pass `{ skippable: false }`: `cutscene(() => { … }, { skippable: false })`. For the whole game, set `"cutscenesSkippable": false` in `game-config.json`.

**Locking out the player** without a cutscene: `input.disabled = true` … `input.disabled = false`, or `withInputDisabled(() => { … })`, which turns input back on when the block ends, even if the room changes.

**Waiting for a click:** `waitForClick({ timeout: 10 })` waits for a click, or ten seconds:

```ts
fountainOff.onLook(() => {
  faceClicked()
  camera.zoomTo(fountainOff, 1.5, 0.6)
  waitForClick({ timeout: 10 })   // look as long as you like
  camera.reset()
})
```

## Doing things at the same time

By default each line waits. To overlap actions, start the one you don't want to wait for with `.now`, **before** the one you do:

```ts
// Henry and Hank set off together; the scene goes on when Hank arrives.
henry.walkTo.now(points.henryFountain)
player.walkTo(fountainOff)
wait(0.5)
```

| You want | Write |
|---|---|
| A and B to start together, then go on when B finishes | `a.now(…)`, then `b(…)` |
| A and B to start together, then go on when both finish | `together(() => a(…), () => b(…))` |
| A to start now, and wait for it later | `const walk = henry.walkTo.now(…)` … `walk.wait()` |
| A sequence running alongside the scene | `background(() => { … })` |

```ts
together(
  () => player.walkTo(fountainOff),
  () => camera.focus(fountainOff),
)

background(() => {
  for (let i = 0; i < 3; i++) {
    sfx.sweeping.play()
    wait(0.33)
  }
})
Henry: `Why isn't this working?`
```

Any action that takes time has a `.now` form. Sounds and music never wait, so they don't need one.

## Regions and walkable areas

Regions are areas of the floor that react when someone walks in or out:

```ts
// apartment.room.ts
regions.darkness.onEnter(() => {
  Hank: `It's dark over here.`
})

// outside.room.ts: Henry heads back to the fountain when Hank walks into the distance.
// Hank doesn't wait for him.
regions.distance.onEnter((who) => {
  if (who === hank) {
    henry.walkTo.now(points.henryFountain)
  }
})
```

Regions fire for every character, so check `who` (or `who.isPlayer`). A region handler counts as an interaction, which is why the example uses `.now`: without it, the player couldn't click anything while Henry walks.

`regions.darkness.active = false` switches a region off; `walkables.walk1.active = false` makes an area of floor unwalkable. Both are saved.

## GUIs

A GUI's script handles its controls, which are plain names in the script:

```ts
// guis/game-menu/game-menu.gui.ts
import { game } from '@benne/script'
import { guis } from '@game'
import { gui, load, quit, resume, save, settingsBtn } from './game-menu.ids'

gui.onShow(() => {
  quit.visible = game.isDesktop   // Quit only makes sense in the desktop app
})

quit.onClick(() => game.quit())
resume.onClick(() => gui.hide())

save.onClick(() => {
  guis.saveMenu.show()
  gui.hide()
})

load.onClick(() => {
  guis.loadMenu.show()
  gui.hide()
})

settingsBtn.onClick(() => {
  guis.settingsMenu.show()
  gui.hide()
})
```

| Control | Read and set | Handlers |
|---|---|---|
| Any | `visible`, `alpha`, `x`, `y`, `fadeTo(…)`, `tweenTo(…)` | `onMouseEnter`, `onMouseLeave` |
| Text | `text` | |
| Button | `enabled`, `visualState` | `onClick` |
| Slider | `value` | `onChange((value) => …)` |
| Checkbox | `checked`, `enabled` | `onChange((checked) => …)` |
| Text input | `text`, `enabled`, `focused` | `onChange((text) => …)`, `onSubmit((text) => …)` |
| List box | `selectedIndex`, `setRowText(i, text)`, `rowCount` | `onSelect((i) => …)`, `onActivate((i) => …)` |

The GUI itself has `show()`, `hide()`, `fadeIn()`, `fadeOut()`, `onBuilt` (each time a room builds it), `onShow`, `onHide` and `onAnyClick`. From other scripts, reach a GUI through `guis`: `guis.verbs.hide()`, `guis.gameMenu.controls.save`.

**A verb bar.** `pointer` tells a GUI what the player is pointing at, and `pointer.sentence` is the ready-made "Use Knife with Bread" line:

```ts
// guis/verbs/verbs.gui.ts
const buttons = new Map([
  [verbs.give, giveBtn], [verbs.pickUp, pickUpBtn], [verbs.use, useBtn],
  [verbs.open, openBtn], [verbs.look, lookAtBtn], [verbs.push, pushBtn],
  [verbs.close, closeBtn], [verbs.talkTo, talkToBtn], [verbs.pull, pullBtn],
])

for (const [verb, button] of buttons) button.onClick(() => verb.select())
menuBtn.onClick(() => guis.gameMenu.show())

function refresh() {
  verbLineText.text = pointer.sentence
  const highlighted = pointer.hover?.defaultVerb
  for (const [verb, button] of buttons) {
    button.visualState = verb === highlighted ? 'hover' : 'normal'
  }
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
```

Once the player clicks, `pointer.sentence` is that action ("Use Door", even from a right-click's default verb) until its handler finishes, wherever the pointer moves. `pointer.hover` keeps following the pointer.

GUI handlers don't take the interaction lock, so menus work during a cutscene.

## Saving, loading and settings

```ts
saves.save(2, 'Before the fountain') // slot 2, with a name
saves.save('checkpoint')           // a named save
saves.load(2)                      // ends the handler; the game reloads
saves.get(2)?.name
saves.list()                       // [{ slot, name, timestamp }]
saves.delete(2)
saves.autosave()                   // saves 'Autosave' as soon as saving is allowed
game.newGame(rooms.apartment)      // fresh state; ends the handler
game.quit()                        // desktop only
```

Saving isn't possible while an interaction or a conversation is running. `saves.canSaveNow` says whether it is, so a save menu can disable its button:

```ts
function syncSaveButton(name: string) {
  saveBtn.enabled = saves.canSaveNow && name.trim() !== ''
}
```

`saves.autosave()` works anywhere, even in `onEnter` or a cutscene: it saves straight away if it can, and otherwise as soon as the interaction is over. Pass a name or a slot to save somewhere other than `'Autosave'`: `saves.autosave('Chapter 2')`.

**Settings** are the player's own and are kept outside save slots:

```ts
settings.sfxVolume = 0.8          // 0–1
settings.musicVolume = 0.6
settings.textSpeed = 1.5          // speech stays up 1.5× as long
settings.clickToSkip = true
settings.speech.showText = false  // any `speech` setting from game-config.json
```

## The global script

`globalScript.ts` holds the lines for verbs nothing else handles, one per verb:

```ts
import { game } from '@benne/script'
import { fallbacks } from '@game'

fallbacks.onLook(() => { Player: `Nothing special about that.` })
fallbacks.onUse(() => { Player: `That doesn't work.` })
fallbacks.onPickUp(() => { Player: `I can't take that.` })
fallbacks.onTalkTo(() => { Player: `I don't have anything to say to that.` })
fallbacks.onPush(() => { Player: `It won't move.` })
fallbacks.onPull(() => { Player: `It won't move.` })

fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine ?? "That doesn't work." })
fallbacks.onItemUnhandled(() => { Player: `That doesn't work.` })
```

Note the braces in ``() => { Player: `…` }``: a line of dialogue needs them.

Hooks for every room also go here: `game.onEnterAnyRoom((from) => { … })`, `game.onEnterAnyRoomAfterFade(…)`, `game.onLeaveAnyRoom(…)`, `game.onLoadedAnyRoom(…)`.

## Every frame

`onUpdate` runs a function every frame, for things like shimmering water:

```ts
onUpdate(() => {
  if (game.currentRoom !== room) return
  fountainOn.alpha = 0.8 + 0.2 * Math.sin(game.time * 6)
})
```

It runs in every room, so check `game.currentRoom` in a room script. Nothing inside `onUpdate` can wait, so anything that takes time (a `wait`, a walk, a line, `face`, a fade) is an error there. To start a sequence from it, use `background(() => { … })`, and guard it with a flag so it starts once.

Most things that take time have an instant form you can use there instead:

```ts
onUpdate(() => {
  fountainOn.alpha = 0.8 + 0.2 * Math.sin(game.time * 6)  // not fountainOn.fade(…)
})
henry.startFacing(hank)  // once, not in onUpdate: Henry keeps turning toward Hank
```

To turn a character from a frame check, read `facing` and turn in a `background` block only when it needs to change: `if (henry.facing !== 'L') background(() => henry.face('L'))`. To save from one, use `saves.autosave()`, guarded like a `background` block so it runs once.

## Events

`events` lets scripts react to things happening in the engine, and send each other messages:

```ts
events.on('gameState:inventoryChanged', () => {
  if (inventory.has(items.sammich)) dialogs.chatwithpenny.options.door.off()
})

events.on('sandwichMade', (filling: string) => { Hank: `One ${filling} sandwich!` })
events.emit('sandwichMade', 'peanut butter')
```

In a room script, a listener is active only while the player is in that room.

## Your own helpers

Scripts are TypeScript: constants, functions, loops and npm packages all work. Functions you write in a script file are sequenced like handlers, so calling one waits for it:

```ts
function makeSandwich() {
  inventory.remove(items.bread)
  inventory.add(items.sammich)
  dialogs.chatwithpenny.options.door.off()
}

playFrom('made sandwich', () => {
  makeSandwich()
})
```

Loops are sequenced too:

```ts
for (const ingredient of [items.bread, items.pb, items.knife]) {
  wait(0.5)
  inventory.remove(ingredient)
}
```

Helpers used by several scripts go in a `*.script.ts` file, which is sequenced the same way. Ordinary `.ts` files (data tables, maths) are left alone and can't use actions that take time.

Callbacks passed to other functions (`array.forEach`, `setTimeout`) are **not** sequenced. Use a `for … of` loop instead; the build tells you when you've passed a sequenced function to one.

`npm run lint` checks for these mistakes and the ones below: anything that takes time where nothing waits for it (in a callback, in `onUpdate`, inside an expression, in an ordinary `.ts` file), and `await` in a handler.

## Common mistakes

| You wrote | Fix |
|---|---|
| ``() => Hank: `Hi` `` | Add braces: ``() => { Hank: `Hi` }`` |
| `await henry.walkTo(…)` | Drop the `await`: lines already wait, and `await` stops this one from waiting. |
| `ready && henry.walkTo(…)` | Only a call on its own line waits: `if (ready) henry.walkTo(…)` |
| `Hank: Hi there` | Quote it: ``Hank: `Hi there` ``, or use a `` say`…` `` block |
| Code after `rooms.x.goTo()` | It never runs. Move it above, or into the next room's `onEnter`. |
| Code after `dialog.end()` | Same: move it above. |
| `henry.walkTo(…)` in a region handler | Use `henry.walkTo.now(…)`, or the player is locked out while Henry walks. |
| `parts.forEach(p => handOver(p))` | `for (const p of parts) handOver(p)` |
| A name ends in `_` (a prop called `wait` becomes `wait_`) | It clashes with a BenneScript name. Give it a `"scriptName"` in its JSON. |

The full list of every name and property, with what waits and what doesn't, is the [BenneScript API reference](../reference/bennescript-api).
