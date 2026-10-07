---
title: BenneScript
outline: deep
---

# BenneScript

**BenneScript** is how you bring a BENNE game to life: what happens when the player looks at the door, talks to the barista or uses the soda on the battery. It is TypeScript, so you get autocomplete, type checking, the debugger and AI assistants, with three conveniences on top:

- **Lines run in the order you write them.** A walk finishes before the next line of dialogue starts, and a flag set after a speech line is set after the line has been spoken. You never type `await`.
- **Everything in your game has a name.** Rooms, props, characters, items, dialog options, GUI controls, sounds and verbs are typed names generated from your content (`battery`, `items.soda`, `sfx.sodaPour`), so a typo is a red squiggle, not a silent bug.
- **Dialogue reads like a script.** ``Hank: `I hope this works.` `` is a line of dialogue. Backticks let a line contain `"` and `'` freely, and `${…}` drops in a value.

Here is a real handler from the jam game *AI Apocalypse*. The player uses the soda on a corroded car battery:

```ts
battery.onUseItem(items.soda, () => {
  if (!flags.askedAboutBattery) unhandled()   // not yet: "That doesn't work."
  walkToClicked()
  Hank: `I hope this works.`
  inventory.remove(items.soda)
  sfx.sodaPour.play()
  wait(0.75)
  Hank: `Hey! The corrosion is gone.`
  Hank: `Now I need to tighten that cable.`
  dialogs.driver.options.wrench.on()
  flags.batteryClean = true
})
```

Hank walks over, says his line, the soda leaves the inventory, the sound plays, the script waits three quarters of a second, Hank speaks again, a new dialog option appears and the flag is set, each step after the one before.

## How a script runs

### Lines wait for each other

Inside a handler, each line starts when the line above it has finished. Some lines take time: a walk, a speech line, `wait(…)`, a one-shot animation, a fade, a camera move. Others are instant: setting a flag, adding an item, showing a prop, starting a sound. You don't have to know which is which to get the right order; it only matters when you want things to **overlap** (see [Doing things at the same time](#doing-things-at-the-same-time)).

| Takes time (the script waits) | Instant |
|---|---|
| `walkToClicked()`, `player.walkTo(…)`, `jensen.walkTo(…)`, `face(…)` | `player.moveTo(…)` (teleport), `door.alpha = …` |
| ``Hank: `…` ``, `` say`…` ``, `jensen.say(…)`, `display(…)` | `flags.x = …`, `vars.x = …`, any read |
| `wait(…)`, `waitForClick()` | `inventory.add(…)`, `inventory.remove(…)` |
| `door.play('door-open')` (one-shot animation) | `door.animation = …`, `door.show()`, `door.hide()` |
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
| `rooms/club/club.room.ts` | The room: what happens on entering and leaving, and verbs on its props, hotspots and characters |
| `characters/jensen/jensen.character.ts` | Handlers for Jensen in every room he appears in |
| `inventory/magnet/magnet.inventory.ts` | The magnet: verbs on its inventory row, and other items used on it |
| `dialogs/botti3/botti3.dialog.ts` | What each choice in the conversation does |
| `guis/save-menu/save-menu.gui.ts` | The GUI's buttons, sliders and lists |
| `globalScript.ts` | Fallback lines for verbs nothing else handles, and hooks for every room |
| `state.ts` | Your game's flags and variables |
| `scripts/*.script.ts` | Helpers shared by several scripts |

The editor creates these files for you when you add content, and the Inspector can add handlers to them (see [BENNE Editor](./benne-editor)).

### Names and imports

Names come from three places. The editor's auto-import adds the import lines as you type a name.

```ts
// src/game/rooms/club/club.room.ts
import { faceClicked, inventory, player, unhandled, wait, walkToClicked } from '@benne/script'
import { dialogs, flags, items, music, rooms, sfx } from '@game'
import { room, antenna, battery, driver, hank, points, regions } from './club.ids'
```

- **`@benne/script`**: the engine's actions and objects: `walkToClicked`, `wait`, `say`, `inventory`, `player`, `camera`, `cutscene`, `saves`, `settings`, `game`, …
- **`@game`**: everything in your game, by kind: `rooms`, `characters`, `items`, `dialogs`, `guis`, `sfx`, `music`, `video`, `verbs`, `fallbacks`, `flags`, `vars`.
- **`./club.ids`**: this room's own things, as plain names: `room`, its props (`antenna`), hotspots (`battery`), characters (`driver`, `hank`), plus `points`, `regions` and `walkables`. A dialog script imports `dialog` and `options` from its `.ids` module; a GUI script imports `gui` and its controls.

The `.ids` modules and `@game` are **generated** from your JSON whenever it changes. Names are your IDs in camelCase, with the room's prefix dropped: the hotspot `club-hotspot-battery` is `battery`, the point `plaza-point-first-visit-jensen` is `points.firstVisitJensen`, the dialog option `what about AI` is `options.whatAboutAI`. If two things would get the same name, or a name clashes with a BenneScript name, give one of them a `"scriptName"` in its JSON (a character can't take a BenneScript name such as `camera` or `dialog` as its `scriptName` at all, because its name is used on its own in room scripts) (AI Apocalypse's game menu has a button with `"scriptName": "settingsBtn"`, because `settings` is taken).

Things in a room are plain names because you use them constantly. Everything else is grouped (`items.antenna`), because an item, a prop and a dialog can easily share a name: in AI Apocalypse, `antenna` is both a prop in the garage and an inventory item.

## Rooms

### Entering and leaving

```ts
room.onEnter(() => {            // before the fade-in: set the scene up, invisibly
  guis.verbs.hide()
})

room.onEnterAfterFade(() => {   // after the fade-in: music, entrances, cutscenes
  music.garage.play()
})

room.onLeave(() => { … })       // before the next room loads
room.onLoaded(() => { … })      // only when a save loads into this room, instead of the enter hooks
```

`onEnter` is for entering the room; `onLoaded` is for restoring it from a save (the enter hooks don't run then). The fade-in waits for `onEnter`, so keep it to instant setup: positions, visibility, flags. Put anything the player should see in `onEnterAfterFade`. Both run as cutscenes, so ESC skips them; pass `{ skippable: false }` as a second argument to prevent that.

Where the player came from, and how often they've been here:

```ts
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
  }
  jensen.show()
})
```

`room.visitCount`, `room.hasVisited`, `room.last` (the previous room) and `rooms.plaza.visitCount` (any room) are there too.

### Changing rooms

```ts
door.onUse(() => {
  walkToClicked()
  sfx.doorBells.play()
  rooms.plaza.goTo()
})
```

### Play From

**Play From** in BENNE Play starts a room in a prepared state, so you can test the end of a puzzle without playing up to it. Write the setup at the top level of the room script:

```ts
playFrom('fix battery', () => {
  flags.askedAboutBattery = true
  flags.batteryClean = true
  inventory.add(items.wrench)
  battery.active = true
})
```

The name is what appears in the Play From menu. `room.visitCount` and `room.last` can be set here, to pretend the player has been before or came from somewhere.

## Verbs on things

Handlers are named after the verbs in your `game-config.json`. AI Apocalypse has `take`, `use`, `look`, `clean`, `talkTo` and `move`, so its props, hotspots and characters have `onTake`, `onUse`, `onLook`, `onClean`, `onTalkTo` and `onMove`. A 9-verb game gets `onOpen`, `onClose`, `onPush`, `onPull`, `onPickUp`, `onGive` and the rest. Custom verbs work the same way: add a verb to the config and its method appears. A verb your game doesn't have is a type error.

```ts
antenna.onLook(() => {
  faceClicked()
  Hank: `A broken off car antenna.`
})

antenna.onTake(() => {
  walkToClicked()
  hank.play('ReachR')        // one-shot animation; waits for it
  antenna.hide()
  sfx.whip.play()
  inventory.add(items.antenna)
})
```

`walkToClicked()` walks the player to the clicked thing's walk-to point and turns to face it. `faceClicked()` only turns toward it. Most handlers start with one of the two.

**One handler for several verbs:**

```ts
cleaningStuff.on(['use', 'take', 'clean'], () => {
  faceClicked()
  Hank: `I'm not on the job here.`
})
```

**Falling through.** `unhandled()` ends the handler and passes the click on, as if this handler didn't exist: to the character's own script, then to the global fallback ("That doesn't work."). Use it when a handler only applies sometimes:

```ts
battery.onUseItem(items.wrench, () => {
  if (!flags.askedAboutBattery || !flags.batteryClean) unhandled()
  walkToClicked()
  Hank: `Ok I'll tighten 'er up here.`
  // …
})
```

A plain `return` ends the handler without falling through.

**Changing things.** Props, hotspots and characters have properties you can set at any time. They take effect at once and are saved:

```ts
battery.active = true                  // hotspots: can be hovered and clicked
door.clickable = false                 // props and characters
door.description = 'A broken door'     // the name shown when hovering
filingCabinet.animation = 'filingCabinet-over'
jensen.visible = false                 // or jensen.hide() / jensen.show()
```

## Talking

**A line of dialogue** is the speaker's name, a colon and the line in quotes. The name can be the character's ID or display name, in any case; `Player:` is whoever the player controls.

```ts
Hank: `What the...?`
JENSEN: `NOT GREAT!`
Player: `I have to find a way home!`
```

Names with punctuation or spaces drop it: the character `BOTT-i3 Disembodied` is `BOTTi3Disembodied:`. If you mistype a name, the build stops with "Unknown speaker `Hnak`. Did you mean `Hank`?".

Use backticks to put values in a line:

```ts
Hank: `I've got ${inventory.count(items.coin)} coins.`
```

**A conversation** reads well as a `say` block. Inside one, names can be written exactly as in the JSON, and lines need no quotes:

```ts
gallery.onLook(() => {
  faceClicked()
  say`
    Hank: Looks like a fancy futuristic museum or something.
    Jensen: It's an AI art gallery. All the art created by robots!
    Hank: Looks nice.
    Jensen: Of course it looks nice. That's how they get you.
  `
})
```

**The method form** is for a speaker you pick at runtime, or for options:

```ts
const speaker = flags.metBotti ? characters.botti3 : characters.botti3Disembodied
speaker.say("Hello, Hank.")
player.say("Uh, whatever.", { clickToSkip: false })
```

**Narration** (no speaker) goes in the display-text box: `display("The door is locked.")`.

**Voice files.** A line that starts with a number between bars plays a recording: ``Hank: `|17| This case just got complicated.` `` plays `assets/audio/voice/hank17.mp3`. The editor numbers your lines for you; see [Sound, Voice & Video](./sound-voice-and-video#voiced-dialogue).

## Inventory

```ts
inventory.add(items.wrench)
inventory.remove(items.soda)
inventory.add(items.coin, 3)
if (inventory.has(items.relay)) { … }
inventory.count(items.coin)
jensen.inventory.add(items.timeonium)   // another character's bag
```

### Using an item on something

When the player uses an item on a prop, hotspot or character, the matching `on<Verb>Item` handler runs:

```ts
toolChest.onUseItem(items.magnetStick, () => {
  walkToClicked()
  sfx.metalScrape.play()
  wait(0.5)
  inventory.remove(items.magnetStick)
  sfx.whip.play()
  inventory.add(items.wrench)
  Hank: `Ah, got it!`
})
```

Items with no handler on that target fall through to the global "That doesn't work." line. For one line covering every other item on a target, use `onAnyItem`:

```ts
jensen.onAnyItem(() => {
  faceClicked()
  Hank: `I don't want to give anything to him yet.`
})
```

`onUseItem` exists because `use` is an **item verb** in the config (`"usesItem": true`). A 9-verb game's `give` gets `onGiveItem`, and a custom "Throw … at" verb would get `onThrowItem`. `onItem(item, …)` handles an item with any item verb.

After an item is used, it stays selected or is put back depending on the item's `dropWhenUsed` (or the game's `dropWhenInventoryUsed`). Pass `{ doNotClear: true }` as the last argument to keep it selected after that handler.

### Item scripts

An item's own script handles verbs on its inventory row, and other items used on it:

```ts
// inventory/magnet/magnet.inventory.ts
items.magnet.onLook(() => {
  Hank: `A cute promotional magnet for the friendly AI overlord.`
})

items.magnet.onCombine(items.antenna, () => {
  inventory.remove(items.antenna)
  inventory.remove(items.magnet)
  sfx.whip.play()
  inventory.add(items.magnetStick)
  Hank: `Cool!`
})
```

Using an item verb on an inventory row (`Use` on the magnet) selects the item, so the player can then click a target. That happens after the item's `onUse` handler, if it has one. To handle `Use` on the row without selecting the item, register the handler with `items.magnet.onUse.doNotActivate(() => { … })`.

An item's icon, cursor and name can change: `items.coffee.animation = 'coffee-full'`, `items.key.cursorAnimation = 'key-alt'`, `items.key.description = 'A bent key'`.

## Flags, variables and visits

Declare your game's state once, with defaults, in `src/game/state.ts`:

```ts
import { defineFlags, defineVars } from '@benne/script'

export const flags = defineFlags({
  askedAboutBattery: false,
  batteryClean: false,
  batteryFixed: false,
  gotRegulator: false,
})

export const vars = defineVars({
  coins: 0,
  timesAskedJensen: 0,
})
```

Then use them anywhere (`@game` exports them):

```ts
flags.batteryClean = true
if (flags.askedAboutBattery && !flags.batteryClean) { … }
vars.timesAskedJensen += 1
```

Flags are true or false. Variables hold numbers, strings, booleans, and arrays or objects of those. Both are saved. A misspelt flag is a type error, so you can't set `flags.batteryClaen` by accident.

If you rename a flag after players have saves, keep the old name for the save with `flag(false, { saveKey: 'old name' })`.

## Dialogs

A dialog's options are written in its JSON; its script says what each choice does. The player says the option's text first, then the handler runs.

```ts
// dialogs/jensen-in-hallway/jensen-in-hallway.dialog.ts
import { wait } from '@benne/script'
import { jensen } from '../../rooms/hallway/hallway.ids'
import { dialog, options } from './jensen-in-hallway.ids'

options.greeting.onChooseOnce(() => {
  Jensen: `HOW'S IT GOING?!`
  Jensen: `The world has been taken over by an evil, totalitarian artificial intelligence and you ask me how's it going?!`
  wait(0.75)
  Jensen: `NOT GREAT!`
  options.whatAboutAI.on()
})

options.itsTheFuture.onChooseOnce(() => {
  wait(1)
  Jensen: `WHAT ARE YOU TALKING ABOUT?!`
  Jensen: `GO AWAY!`
  jensen.face('U')
  dialog.end()
})
```

- `onChoose` runs each time the option is chosen; `onChooseOnce` also removes the option afterwards.
- `options.x.on()` / `off()` show and hide options. From another script: `dialogs.driver.options.wrench.on()`.
- `dialog.end()` closes the conversation and ends the handler, so put anything that should still happen above it.
- `dialog.onStart(() => { … })` runs each time the conversation opens, to decide which options to show.

**Starting a conversation** waits until it ends:

```ts
driver.onTalkTo(() => {
  walkToClicked()
  dialogs.driver.start()
  // anything here runs after the player leaves the conversation
})
```

**Sub-conversations.** Starting a dialog from a choice opens it on top; when it ends, the first one comes back:

```ts
// botti3.dialog.ts
options.aroundHere.onChoose(() => {
  Botti3: `Sure. What would you like to know?`
  dialogs.botti3LocalArea.start()     // back to these choices when it ends
})

// botti3-local-area.dialog.ts
options.thatsAll.onChoose(() => {
  Botti3: `Okay!`
  dialog.end()                        // back to the botti3 choices
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
player.walkTo(points.timeChamber)    // a point in the room
player.walkTo(couch)                 // a prop, hotspot or character's walk-to point
player.walkTo({ x: 120, y: 160 })    // room pixels
player.face('L')                     // 'U', 'D', 'L' or 'R'; waits for the turn
player.moveTo(points.standBack)      // teleport
jensen.walkTo(points.hallwayPoint2)
jensen.startFollowing(player, { minDistance: 60 })
jensen.stopFollowing()
henry.startFacing(hank)              // keep turning toward Hank as he moves
player.switchTo(penny)               // the player now controls Penny
```

`player` is whoever the player controls; `hank` (from the room) is Hank specifically.

**Opacity:** `jensen.alpha = 0.5` sets it at once (and is saved); `jensen.fade(0, 1)` fades over a second and waits.

**Animation:** `jensen.animation = 'WorkingU'` sets an animation that stays (and is saved) until `jensen.stopAnimation()`. `jensen.play('Wave')` plays one once and waits for it. Animation names come from the Aseprite file, so the editor completes them.

## Props

| | |
|---|---|
| `door.animation = 'door-open'` | Change the looping animation. Instant, saved. |
| `door.play('door-opening')` | Play an animation once and wait for it, then go back to the looping one. |
| `door.show()` / `door.hide()` | Instant, saved. |
| `door.fade(0, 1.5)` | Fade to invisible over 1.5 seconds, and wait. |
| `door.alpha = 0.5` | Set the opacity (0 to 1) instantly. Saved. |
| `door.moveTo({ x: 80, y: 90 })` | Move instantly. |
| `door.slideTo({ x: 80, y: 90 }, 2)` | Move over 2 seconds, and wait. |

A prop (or hotspot) can be changed from another room's script too: import it from its room's `.ids` module and set it. The change is saved for that room and shows when you go there. Fades and slides from another room happen at once, and `play` only works in the prop's own room.

If both rooms have a `door`, import the other room's module under its name and write `outside.door`:

```ts
import * as outside from '../outside/outside.ids';

door.hide()           // this room's door
outside.door.show()   // the one outside
```

The editor suggests `outside.door` when you type `door`, and adds the import when you pick it.

## Sound, music, camera and video

```ts
sfx.doorOpen.play()             // starts the sound and goes on
sfx.doorClose.playAndWait()     // waits until it ends
sfx.click.play({ volume: 0.5 })

music.lab.play()                // crossfades as set in the config
music.stop()
if (!music.isPlaying) music.plaza.play()

camera.focus(timeChamber)       // pan; waits
camera.zoom(2, 1)               // 2× over 1 second; waits
camera.zoomTo(points.endingZoom, 1.5, 2)
camera.shake(0.3)
camera.reset()

fadeOut()                       // fade the screen to black; waits
fadeIn()

video.intro.playAndWait()
```

Sound and music names come from the files in `assets/audio/sfx/` and `assets/audio/music/`. See [Sound, Voice & Video](./sound-voice-and-video).

## Cutscenes and skipping

Wrap a scene in `cutscene(…)` to make it skippable:

```ts
jensen.onUseItem(items.mop, () => {
  walkToClicked()
  cutscene(() => {
    Hank: `I'm going home.`
    sfx.smack.play()
    smack.play('smack-play')
    jensen.hide()
    wait(0.9)
    music.stop()
    wait(0.75)
    Hank: `Sorry, Jensen.`
    music.gallery.play()
  })
})
```

While a cutscene runs, clicks on the world do nothing, a click still skips the current line, and **ESC** skips to the end of the block: lines are dismissed, waits end, walks and animations jump to where they would have ended. The script then carries on after the block, so whatever the cutscene set up is in place either way.

To turn off skipping for one cutscene, pass `{ skippable: false }`: `cutscene(() => { … }, { skippable: false })`. For the whole game, set `"cutscenesSkippable": false` in `game-config.json`.

**Locking out the player** without a cutscene: `input.disabled = true` … `input.disabled = false`, or `withInputDisabled(() => { … })`, which turns input back on when the block ends, even if the room changes.

**Waiting for a click:** `waitForClick({ timeout: 10 })` waits for a click, or ten seconds. AI Apocalypse's opening crawl:

```ts
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

## Doing things at the same time

By default each line waits. To overlap actions, start the one you don't want to wait for with `.now`, **before** the one you do:

```ts
// Jensen and Hank set off together; the scene goes on when Hank arrives.
jensen.walkTo.now(points.firstVisitJensen)
player.walkTo(points.firstVisit)
wait(0.5)
```

| You want | Write |
|---|---|
| A and B to start together, then go on when B finishes | `a.now(…)`, then `b(…)` |
| A and B to start together, then go on when both finish | `together(() => a(…), () => b(…))` |
| A to start now, and wait for it later | `const walk = jensen.walkTo.now(…)` … `walk.wait()` |
| A sequence running alongside the scene | `background(() => { … })` |

```ts
together(
  () => player.walkTo(points.timeChamber),
  () => camera.focus(timeChamber),
)

background(() => {
  for (let i = 0; i < 3; i++) {
    sfx.click.play()
    wait(0.33)
  }
})
Jensen: `Why isn't this working?`
```

Any action that takes time has a `.now` form. Sounds and music never wait, so they don't need one.

## Regions and walkable areas

Regions are areas of the floor that react when someone walks in or out:

```ts
regions.leave.onEnter(() => {
  rooms.plaza.goTo()
})

// Jensen steps aside when Hank comes close. Hank doesn't wait for him.
regions.jensenMoveRight.onEnter((who) => {
  if (who === hank) {
    jensen.walkTo.now(points.jensenRightSide)
  }
})
```

Regions fire for every character, so check `who` (or `who.isPlayer`). A region handler counts as an interaction, which is why the example uses `.now`: without it, the player couldn't click anything while Jensen walks.

`regions.enterCloset.active = false` switches a region off; `walkables.upperLedge.active = false` makes an area of floor unwalkable. Both are saved.

## GUIs

A GUI's script handles its controls, which are plain names in the script:

```ts
// guis/game-menu/game-menu.gui.ts
import { game } from '@benne/script'
import { guis, rooms } from '@game'
import { gui, load, quit, resume, save, settingsBtn, titleScreen } from './game-menu.ids'

gui.onShow(() => {
  quit.visible = game.isDesktop   // Quit only makes sense in the desktop app
})

quit.onClick(() => game.quit())
resume.onClick(() => gui.hide())

save.onClick(() => {
  guis.saveMenu.show()
  gui.hide()
})

titleScreen.onClick(() => rooms.title.goTo())
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

The GUI itself has `show()`, `hide()`, `fadeIn()`, `fadeOut()`, `onBuilt` (each time a room builds it), `onShow`, `onHide` and `onAnyClick`. From other scripts, reach a GUI through `guis`: `guis.verbs.hide()`, `guis.openingText.controls.text`.

**A verb bar.** `pointer` tells a GUI what the player is pointing at, and `pointer.sentence` is the ready-made "Use Coffee with Coffee maker" line:

```ts
// guis/verbs/verbs.gui.ts
const buttons = new Map([
  [verbs.look, lookAtBtn], [verbs.use, useBtn], [verbs.take, takeBtn],
  [verbs.talkTo, talkToBtn], [verbs.move, moveBtn], [verbs.clean, cleanBtn],
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

GUI handlers don't take the interaction lock, so menus work during a cutscene.

## Saving, loading and settings

```ts
saves.save(2, 'Before the lab')    // slot 2, with a name
saves.save('checkpoint')           // a named save
saves.load(2)                      // ends the handler; the game reloads
saves.get(2)?.name
saves.list()                       // [{ slot, name, timestamp }]
saves.delete(2)
saves.autosave()                   // saves 'Autosave' as soon as saving is allowed
game.newGame(rooms.opening)        // fresh state; ends the handler
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
fallbacks.onTake(() => { Player: `I can't take that.` })
fallbacks.onTalkTo(() => { Player: `I don't have anything to say to that.` })
fallbacks.onClean(() => { Player: `I don't need to clean that.` })
fallbacks.onMove(() => { Player: `It doesn't move.` })

fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine ?? "That doesn't work." })
fallbacks.onItemUnhandled(() => { Player: `That doesn't work.` })
```

Note the braces in ``() => { Player: `…` }``: a line of dialogue needs them.

Hooks for every room also go here: `game.onEnterAnyRoom((from) => { … })`, `game.onEnterAnyRoomAfterFade(…)`, `game.onLeaveAnyRoom(…)`, `game.onLoadedAnyRoom(…)`.

## Every frame

`onUpdate` runs a function every frame, for things like a blinking light:

```ts
onUpdate(() => {
  if (game.currentRoom !== room) return
  alarmLight.visible = flags.alarmOn && Math.sin(game.time * 6) > 0
})
```

It runs in every room, so check `game.currentRoom` in a room script. Nothing inside `onUpdate` can wait, so anything that takes time (a `wait`, a walk, a line, `face`, a fade) is an error there. To start a sequence from it, use `background(() => { … })`, and guard it with a flag so it starts once.

Most things that take time have an instant form you can use there instead:

```ts
onUpdate(() => {
  lamp.alpha = 0.5 + 0.5 * Math.sin(game.time * 6)  // not lamp.fade(…)
})
henry.startFacing(hank)  // once, not in onUpdate: Henry keeps turning toward Hank
```

To turn a character from a frame check, read `facing` and turn in a `background` block only when it needs to change: `if (jensen.facing !== 'L') background(() => jensen.face('L'))`. To save from one, use `saves.autosave()`, guarded like a `background` block so it runs once.

## Events

`events` lets scripts react to things happening in the engine, and send each other messages:

```ts
events.on('gameState:inventoryChanged', () => {
  coins.text = `${inventory.count(items.coin)}`
})

events.on('alarm', (level: number) => { Hank: `Alarm level ${level}!` })
events.emit('alarm', 3)
```

In a room script, a listener is active only while the player is in that room.

## Your own helpers

Scripts are TypeScript: constants, functions, loops and npm packages all work. Functions you write in a script file are sequenced like handlers, so calling one waits for it:

```ts
function gotLens() {
  inventory.add(items.lens)
  flags.gotLens = true
  dialogs.jensenInPlaza.options.foundLens.on()
}

playFrom('got lens', () => {
  gotLens()
})
```

Loops are sequenced too:

```ts
for (const part of [items.relay, items.regulator, items.lens, items.timeonium]) {
  wait(0.5)
  sfx.whip.play()
  inventory.remove(part)
}
```

Helpers used by several scripts go in a `*.script.ts` file, which is sequenced the same way. Ordinary `.ts` files (data tables, maths) are left alone and can't use actions that take time.

Callbacks passed to other functions (`array.forEach`, `setTimeout`) are **not** sequenced. Use a `for … of` loop instead; the build tells you when you've passed a sequenced function to one.

`npm run lint` checks for these mistakes and the ones below: anything that takes time where nothing waits for it (in a callback, in `onUpdate`, inside an expression, in an ordinary `.ts` file), and `await` in a handler.

## Common mistakes

| You wrote | Fix |
|---|---|
| ``() => Hank: `Hi` `` | Add braces: ``() => { Hank: `Hi` }`` |
| `await jensen.walkTo(…)` | Drop the `await`: lines already wait, and `await` stops this one from waiting. |
| `ready && jensen.walkTo(…)` | Only a call on its own line waits: `if (ready) jensen.walkTo(…)` |
| `Hank: Hi there` | Quote it: ``Hank: `Hi there` ``, or use a `` say`…` `` block |
| Code after `rooms.x.goTo()` | It never runs. Move it above, or into the next room's `onEnter`. |
| Code after `dialog.end()` | Same: move it above. |
| `jensen.walkTo(…)` in a region handler | Use `jensen.walkTo.now(…)`, or the player is locked out while Jensen walks. |
| `parts.forEach(p => handOver(p))` | `for (const p of parts) handOver(p)` |
| A name ends in `_` (a prop called `wait` becomes `wait_`) | It clashes with a BenneScript name. Give it a `"scriptName"` in its JSON. |

The full list of every name and property, with what waits and what doesn't, is the **BenneScript API reference** (`docs/bennescript-api.md` in the BENNE repository).
