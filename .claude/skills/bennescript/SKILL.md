---
name: bennescript
description: "Use this skill when reading or writing BENNE game scripts: *.room.ts, *.character.ts, *.inventory.ts, *.dialog.ts, *.gui.ts, *.script.ts, globalScript.ts or state.ts under src/game/. BenneScript is TypeScript where lines run in order without await, content is referenced by generated handles (no quoted IDs, no `B.`), and `Hank: \"…\"` is a line of dialogue. Triggers on: BenneScript, room script, verb handler, onLook, onUseItem, dialog choice, onChoose, cutscene, walkToClicked, playFrom, fallbacks, @benne/script, @game, .ids."
---

# BenneScript

> BENNE's scripting layer. Plain TypeScript syntax, but a build transform makes **every statement inside a handler wait for the one above it**. There is no `await`, no `B.` object, no `register*Script(...)` wrapper, and no quoted content IDs.

**Examples below are from the jam game AI Apocalypse** (verbs `take`, `use`, `look`, `clean`, `talkTo`, `move`). Your game's verb methods come from *its* `game-config.json`: a 9-verb game has `onPickUp`, `onOpen`, `onGive`… and no `onTake`.

## Rules that matter

1. **Lines run in order.** Each statement in a handler starts after the previous one finishes. Timed actions (walks, speech, `wait`, `face`, one-shot `play`, fades, camera moves, `playAndWait`, `dialogs.x.start()`, blocks, your own top-level functions) wait, but only as a line of their own (not inside `&&`, `?:` or a callback); everything else is instant. Never write `await`, `.then`, or `setTimeout` for sequencing.
2. **Handlers are registered at the top level of the file**, not inside a wrapper: `battery.onLook(() => { … })`.
3. **Every content reference is a generated handle**: `battery`, `items.soda`, `dialogs.driver`, `rooms.plaza`, `sfx.sodaPour`, `music.garage`, `points.standBack`, `regions.leave`, `flags.batteryClean`. A typo is a type error. Never pass ID strings (`'club-hotspot-battery'`).
4. **Dialogue is a label**: `Hank: "Hello."` (character ID or display name, letters and digits only, any case; `Player:` = whoever is controlled). A label needs statement position, so an arrow body needs braces: `() => { Player: "…" }`.
5. **`.now` means "start it and don't wait"**: `jensen.walkTo.now(points.x)`. Start the thing you don't wait for first, then the thing you do.
6. **These end the handler** (nothing after them runs): `rooms.x.goTo()`, `unhandled()`, `dialog.end()`, `saves.load(…)`, `game.newGame()`.
7. **`unhandled()` falls through** to the next handler (character script, then global fallback). Use it instead of `return false`. A plain `return` just ends the handler.
8. **Generated files (`*.ids.ts`, `game.ids.ts`) are never edited.** They regenerate from JSON (`npm run generate:game-ids`; `dev`, `build` and `typecheck` run it). After adding content JSON, regenerate before using its handle.

## Files and imports

| File | Contains |
|---|---|
| `rooms/<id>/<id>.room.ts` | `room` hooks, verbs on that room's props / hotspots / characters, regions, `playFrom` |
| `characters/<id>/<id>.character.ts` | `penny.onLook(…)` etc., with `import { penny } from './penny.ids'`: applies in every room (a room's own handler wins). Other characters are `characters.x` |
| `inventory/<id>/<id>.inventory.ts` | `items.<id>.onLook(…)`, `items.<id>.onCombine(items.other, …)` |
| `dialogs/<id>/<id>.dialog.ts` | `options.x.onChoose(…)` / `onChooseOnce(…)`, `dialog.onStart(…)` |
| `guis/<id>/<id>.gui.ts` | Control events (`saveBtn.onClick`), `gui.onBuilt` / `onShow` / `onHide` |
| `globalScript.ts` | `fallbacks.on<Verb>(…)`, `game.onEnterAnyRoom(…)`, `onUpdate(…)` |
| `state.ts` | `defineFlags({ … })`, `defineVars({ … })`: every flag and variable, with defaults |
| `*.script.ts` | Shared helper functions (sequenced like handlers) |

```ts
import { faceClicked, inventory, player, unhandled, wait, walkToClicked } from '@benne/script' // engine
import { dialogs, flags, items, music, rooms, sfx } from '@game'                              // game-wide
import { room, antenna, battery, driver, hank, points, regions } from './club.ids'           // this room
```

Dialog scripts import `dialog, options` from `./<id>.ids`; GUI scripts import `gui` and controls from `./<id>.ids`. A dialog or GUI script that touches a room imports that room's module: `import { jensen } from '../../rooms/hallway/hallway.ids'`. Room handle names drop the room prefix: `club-hotspot-battery` → `battery`, `plaza-point-first-visit` → `points.firstVisit`, option `what about AI` → `options.whatAboutAI`.

## Rooms

```ts
// club.room.ts
playFrom('fix battery', () => {          // BENNE Play "Play From" setup
  flags.askedAboutBattery = true
  inventory.add(items.wrench)
  battery.active = true
})

regions.leave.onEnter(() => {
  rooms.plaza.goTo()
})

// plaza.room.ts (imports room, hank, jensen, points from './plaza.ids')
room.onEnter(() => {                     // before the fade-in: instant setup only
  if (room.cameFrom(rooms.hallway)) {
    hank.moveTo(points.enterFromHall)
    if (room.isFirstVisit) jensen.moveTo(points.enterFromHallJensen)
  }
})

room.onEnterAfterFade(() => {            // after the fade-in: music, entrances, cutscenes
  music.plaza.play()
  if (!room.isFirstVisit) return
  jensen.walkTo.now(points.firstVisitJensen)   // both start; continue when Hank arrives
  player.walkTo(points.firstVisit)
  Hank: "Hey, the future looks pretty nice!"
})
```

## Verbs on things

```ts
// club.room.ts (cleaningStuff is in cafe.room.ts, jensen's handler in plaza.room.ts)
antenna.onLook(() => {
  faceClicked()
  Hank: "A broken off car antenna."
})

antenna.onTake(() => {
  walkToClicked()                 // walk over and face it; waits
  hank.play('ReachR')             // one-shot animation; waits
  antenna.hide()
  sfx.whip.play()                 // sounds never wait
  inventory.add(items.antenna)
})

cleaningStuff.on(['use', 'take', 'clean'], () => {   // several verbs, one handler
  faceClicked()
  Hank: "I'm not on the job here."
})

battery.onUseItem(items.soda, () => {                // item used on a target
  if (!flags.askedAboutBattery) unhandled()          // → "That doesn't work."
  walkToClicked()
  Hank: "I hope this works."
  inventory.remove(items.soda)
  sfx.sodaPour.play()
  wait(0.75)
  dialogs.driver.options.wrench.on()
  flags.batteryClean = true                          // set here, after the lines above
})

jensen.onAnyItem(() => {                             // any other item on Jensen (also on characters.x)
  faceClicked()
  Hank: "I don't want to give anything to him yet."
})
```

`on<Verb>Item` exists for verbs with `"usesItem": true` (`onUseItem`, a 9-verb `onGiveItem`). `onItem(item, …)` = any item verb. Pass `{ doNotClear: true }` as a last argument to keep the item armed afterwards.

Settable state (instant, saved): `battery.active`, `door.visible` / `show()` / `hide()`, `door.clickable`, `door.description`, `car.animation = 'car-fixed'`, `jensen.animation = 'WorkingU'` / `stopAnimation()`, `regions.x.active`, `walkables.x.active`, `items.coffee.animation`.

## Talking

```ts
Hank: "What the...?"
BOTTi3Disembodied: "Hello, Hank."          // display name "BOTT-i3 Disembodied"
Hank: `I've got ${inventory.count(items.coin)} coins.`
say`
  Hank: Looks like a fancy futuristic museum or something.
  Jensen: It's an AI art gallery. All the art created by robots!
`                                           // block: names as in JSON, no quotes per line
jensen.say("Humph!")                        // method form: variable speaker or options
display("The door is locked.")              // narration
```

## Items, state, dialogs

```ts
// inventory/magnet/magnet.inventory.ts
items.magnet.onLook(() => {
  Hank: "A cute promotional magnet for the friendly AI overlord."
})
items.magnet.onCombine(items.antenna, () => {
  inventory.remove(items.antenna)
  inventory.remove(items.magnet)
  inventory.add(items.magnetStick)
  Hank: "Cool!"
})

// state.ts — declare before use; a new flag goes here, not in game-config.json
export const flags = defineFlags({ askedAboutBattery: false, batteryClean: false })
export const vars = defineVars({ coins: 0 })

// dialogs/jensen-in-hallway/jensen-in-hallway.dialog.ts
options.greeting.onChooseOnce(() => {       // Once: the option disappears after choosing
  Jensen: "HOW'S IT GOING?!"
  wait(0.75)
  Jensen: "NOT GREAT!"
  options.whatAboutAI.on()
})
options.itsTheFuture.onChooseOnce(() => {
  Jensen: "GO AWAY!"
  jensen.face('U')                          // before end(): end() ends the handler
  dialog.end()
})
dialog.onStart(() => {                      // each time it opens: choose which options show
  if (flags.gotLens && flags.gotRelay) options.foundAll.on()
})

driver.onTalkTo(() => {
  walkToClicked()
  dialogs.driver.start()                    // waits until the conversation ends
})
```

A dialog started from a choice handler is a sub-dialog: its "back" option calls `dialog.end()`, and the parent's choices come back. Do not restart the parent.

## Cutscenes and overlap

```ts
cutscene(() => {                 // world clicks ignored; ESC fast-forwards to the end of the block
  Hank: "I'm going home."
  smack.play('smack-play')
  jensen.hide()
  wait(0.9)
  music.stop()
})

together(() => player.walkTo(points.timeChamber), () => camera.focus(timeChamber))  // wait for both
const walk = jensen.walkTo.now(points.labPoint1)   // start now…
Hank: "Jensen, wait!"
walk.wait()                                        // …wait later
background(() => { for (let i = 0; i < 3; i++) { sfx.click.play(); wait(0.33) } })  // runs alongside
```

Long dialog choices (6+ lines, a fade or a walk) go in `cutscene(…)` so ESC skips them.

## GUIs, saves, settings, global

```ts
// guis/verbs/verbs.gui.ts
for (const [verb, button] of buttons) button.onClick(() => verb.select())
function refresh() { verbLineText.text = pointer.sentence }   // "Use Coffee with Coffee maker"
gui.onBuilt(refresh)
pointer.onContextChange(refresh)

// guis/save-menu/save-menu.gui.ts — control state is set from handlers, not at module top level
function syncSaveButton(name: string) {
  saveBtn.enabled = saves.canSaveNow && name.trim() !== ''   // saving is refused mid-interaction
}
gui.onShow(() => syncSaveButton(saveName.text))
saveName.onChange((text: string) => syncSaveButton(text))
savedList.onSelect((i) => { selected = i })
saveBtn.onClick(() => {
  saves.save(selected, saveName.text.trim())
  gui.hide()
  guis.gameMenu.show()
})

// rooms/lab/lab.room.ts — a checkpoint: autosave works even in onEnter (it waits until saving is allowed)
room.onEnter(() => { saves.autosave() })                     // or saves.autosave('Chapter 2')
room.onLoaded(() => { … })                                   // only when a save loads into this room

// globalScript.ts
fallbacks.onLook(() => { Player: "Nothing special about that." })
fallbacks.onItemUnhandled(() => { Player: "That doesn't work." })
```

`settings.musicVolume`, `settings.textSpeed`, `settings.speech.*`; `game.isDesktop`, `game.quit()`, `game.currentRoom`; `events.on('gameState:inventoryChanged', () => …)`.

## Mistakes to avoid

| Don't | Do |
|---|---|
| `B.player.say('Hi')`, `registerRoomScript(({ B }) => …)`, `whenLookAt('door', …)` | `Player: "Hi"`, top-level `door.onLook(…)` (that API was deleted) |
| `await wait(1)` / `async () => …` | `wait(1)`: the build adds the awaits (and `await walkTo(…)` does *not* wait) |
| `ready && jensen.walkTo(…)` | `if (ready) jensen.walkTo(…)`: only a call on its own line waits |
| `() => Hank: "Hi"` | `() => { Hank: "Hi" }` |
| `rooms.x.goTo(); flags.left = true` | Set the flag first: nothing runs after `goTo()` |
| `return false` to fall through | `unhandled()` |
| `parts.forEach((p) => handOver(p))` with a step function | `for (const p of parts) handOver(p)` |
| `jensen.walkTo(…)` in a region handler | `jensen.walkTo.now(…)` (else the player is locked out while Jensen walks) |
| `wait`/walks/`face`/fades/`saves.save` inside `onUpdate` | Instant forms: `x.alpha = …`, `x.startFacing(target)` (once, outside), `x.facing` to check, `saves.autosave()`; else a guarded `background(() => …)` (a timed action there throws) |
| `characters.penny.onLook(…)` in `penny.character.ts` | `penny.onLook(…)` from `./penny.ids` (both work; the flat one is the convention) |
| `flags['all done']`, a flag missing from `state.ts` | Add it to `defineFlags` in `state.ts` |
| Inventing a verb method (`onExamine`) | Use the game's verbs from `game-config.json`, or add the verb there |
| Editing `*.ids.ts` or renaming a handle | Change the JSON (`"scriptName"` renames a handle) and regenerate |

**Check your work** with `npm run typecheck` (regenerates handles first): unknown handles, verbs and animation tags are type errors. `npm run lint` reports timed actions where nothing waits for them (callbacks, `onUpdate`, expressions, plain `.ts` files) and `await` in handlers. Speaker labels are plain TypeScript labels to `tsc`; the build transform (`npm run build`, the dev server) rejects unknown speakers ("Unknown speaker `Hnak`. Did you mean `Hank`?"), speech outside a handler and step functions passed to `forEach`, and the editor shows the speaker errors as you type.

Full reference: `docs/bennescript-api.md`; guide: `docs/public/bennescript.md` (in the BENNE repository).
