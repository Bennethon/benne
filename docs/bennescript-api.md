# BenneScript API Reference

Every name a BENNE script can use, with what it does and whether the script waits for it.

- New to BenneScript? Start with the guide, [`website/guide/bennescript.md`](../website/guide/bennescript.md).
- How it works inside (the build transform, the step runtime, the handle generator): [`docs/architecture.md` §7](architecture.md#7-scripting--interaction-system-bennescript).
- Why it is designed this way, and every decision made while building it: [`docs/bennescript-ergonomics-refactor.md`](bennescript-ergonomics-refactor.md).

The second half of this page, from [Actions](#actions) on, is **generated from the source** of `@benne/script` (`src/engine/bennescript/`) by `npm run docs:api`: each row is a public member and the first paragraph of its JSDoc. `npm run check` fails when it is out of date, so change the JSDoc and regenerate rather than editing those tables by hand.

---
<!-- website/reference/bennescript-api.md publishes this region at benne.games -->
<!-- #region site -->

## Reading the tables

The second column says how a member behaves inside a handler:

| Column | Meaning |
|---|---|
| **waits · `.now`** | A timed action. As a statement it **waits** until the action finishes, then the next line runs. `x.now(…)` starts the same action and goes on at once, returning a [`Task`](#tasks-what-now-and-background-return). |
| **waits** | Waits until its block finishes. No `.now` form. |
| **doesn't wait** | Starts something and goes on (`background`). |
| **ends the handler** | Does its job, then ends the running handler: nothing after it runs. Typed `never`, so the editor greys out the code below. |
| **handler** | Registers a handler. Write it at the top level of a script file. |
| **instant** | Does its job at that line and goes on. |
| **settable** / **read-only** | A property. Reads see the world as it is at that line; writes take effect at that line. |

Type names in the signatures: `VerbId` is the union of your game's verb IDs, `AnimTag` the animation tags on that thing's Aseprite sheet, `StepHandler` a handler body `() => { … }`, `Block` the same for blocks, `Point2` is `{ x, y }` in room pixels, `CharacterFacingLetter` is `'U' | 'D' | 'L' | 'R'`.

---

## Where names come from

| Import from | Contains |
|---|---|
| `@benne/script` | Actions, blocks and game-wide objects: `walkToClicked`, `faceClicked`, `wait`, `waitForClick`, `say`, `display`, `fadeOut`, `fadeIn`, `unhandled`, `cutscene`, `together`, `background`, `withInputDisabled`, `input`, `player`, `inventory`, `camera`, `game`, `settings`, `pointer`, `saves`, `events`, `playFrom`, `onUpdate`, `defineFlags`, `defineVars`, `flag` |
| `@game` (generated) | Game-wide content: `rooms`, `characters`, `items`, `dialogs`, `guis`, `sfx`, `music`, `video`, `verbs`, `fallbacks`, `flags`, `vars` |
| `./<room>.ids` (generated, next to the room script) | `room`; the room's props, hotspots and characters as flat names (`door`, `windowHotspot`, `penny`); `points`, `regions`, `walkables` |
| `./<dialog>.ids` (generated) | `dialog`, `options` |
| `./<gui>.ids` (generated) | `gui`; the GUI's controls as flat names (`saveBtn`, `savedList`) |

A dialog or GUI script that changes a room imports that room's module too (`import { henry, points } from '../../rooms/outside/outside.ids'`). The editor's auto-import adds import lines as you type a name.

### Script files and handler scope

| File | Runs | Its handlers apply |
|---|---|---|
| `rooms/<id>/<id>.room.ts` | When the room first loads (lazily) | In that room. A room's handler wins over a character script's for the same verb. |
| `characters/<id>/<id>.character.ts` | At game start | To that character (`henry.onLook(…)`, `henry` from `./henry.ids`) in every room that spawns it |
| `inventory/<id>/<id>.inventory.ts` | At game start | To that item's inventory row (`items.sammich.onLook(…)`), and item-on-item (`onCombine`) |
| `dialogs/<id>/<id>.dialog.ts` | At game start | To that dialog's options (`options.greeting.onChoose(…)`) |
| `guis/<id>/<id>.gui.ts` | At game start | To that GUI's controls, in every room that shows it |
| `globalScript.ts` | At game start | Everywhere: `fallbacks.*`, `game.onEnterAnyRoom(…)`, `onUpdate(…)` |
| `*.script.ts` | When imported | Shared step functions for other script files |
| `src/game/state.ts` | When imported (`@game` re-exports it) | Declares `flags` and `vars`. An ordinary module, not transformed. |

A file with no handlers can be deleted; nothing needs to register it.

---

## Sequencing rules

Script files are TypeScript that the build transform (`vite-plugin-bennescript.ts`) rewrites so that each line waits for the one above it. In short:

1. **A handler body runs top to bottom.** Each statement starts after the previous one has finished.
2. **Timed actions wait** (walks, speech, `wait`, one-shot animations, fades, camera moves, `playAndWait`, `dialogs.x.start()`, `saves.save`, blocks and calls to your own step functions). Everything else is instant.
3. **`x.now(…)` starts a timed action at that line** and returns a `Task` without waiting. `task.wait()` on a later line waits for it.
4. **`goTo()`, `saves.load()`, `saves.import()`, `game.newGame()`, `unhandled()` and `dialog.end()` end the handler.**
5. **Reads see the current world**: `flags.x`, `door.visible`, `inventory.has(…)` reflect every line above them.
6. **A room change or a save load cancels running handlers** at their current step.
7. **Inside `cutscene(…)`** world clicks are ignored, click-to-skip on speech still works, and the skip key (ESC) fast-forwards the rest of the block.
8. **One gameplay interaction at a time.** A click on the world while a handler is still on its opening walk (`walkToClicked()`, or a first `player.walkTo(…)`) cancels it and starts the new one; once anything else has started, world clicks are ignored until the handler ends. GUI handlers and `background` blocks don't take this lock.

**Step functions.** Handler callbacks, block callbacks, functions declared at the top level of a script file, and functions exported from `*.script.ts` are step functions: their lines are sequenced, and calling one waits for it. Callbacks passed to anything else (`array.forEach`, `setTimeout`, `onUpdate`) are not sequenced. The full rules are in the design doc, §5 and §6.2.

**Saving.** `saves.canSaveNow` is false while a gameplay handler, an open dialog or a room transition is running; `saves.save(…)` then does nothing (DEV warning). GUI handlers don't count, so a save menu opened between interactions can save.

---

## Talking

```ts
Hank: "What the...?"                    // one line: label = character ID or display name
HenryJr: "Hello, Hank."                 // display name "Henry Jr.", punctuation dropped
Player: "That doesn't work."            // the active player
Hank: `I've been out here ${rooms.outside.visitCount} times.`

say`
  penny: Make me a sandwich and I'll give you the key.
  Hank: Uhh...
  Henry Jr.: Names as in the JSON, spaces and punctuation allowed.
`

penny.say("Humph!", { clickToSkip: false })    // method form: a variable speaker, or options
display("The door is locked.")                 // narration
```

**Labels.** A label followed by a string (or template, or any expression) is a speech line. The ID and the display name are both normalised (letters and digits only, any case) before matching, so `HenryJr:` matches the display name `Henry Jr.`. An unknown label in front of a string is a build error ("Unknown speaker `Hnak`. Did you mean `Hank`?"); a label that matches two characters is a build error listing both. A label needs statement position: write `() => { Hank: "Hi" }`, not `() => Hank: "Hi"`.

**Voice IDs.** A line may start with `|number|`: `Hank: "|17| Hello."` plays `assets/audio/voice/hank17.*`. The editor's **Process Game Voice IDs** command fills them in. See [Sound, voice and video](https://benne.games/guide/sound-voice-and-video#process-game-voice-ids).

---

## Generated handles

`npm run generate:game-ids` (run by `dev`, `build`, `typecheck` and the editor on every content change) writes the handle modules from `src/game/` content. They are gitignored (`src/game/**/*.ids.ts`) and start with a generated marker.

| Content | Handles |
|---|---|
| `rooms/<id>/<id>.room.json` | `rooms.<id>`; in `<id>.ids.ts`: `room`, props, hotspots and spawned characters (flat), `points.*`, `regions.*`, `walkables.*` |
| `characters/<id>/<id>.json` | `characters.<id>`; speaker labels from the ID and display name; animation tag types |
| `inventory/<id>/<id>.inventory.json` | `items.<id>`, with animation tag types |
| `dialogs/<id>/<id>.dialog.json` | `dialogs.<id>.options.*`; in `<id>.ids.ts`: `dialog`, `options` |
| `guis/<id>/<id>.gui.json` | `guis.<id>.controls.*`; in `<id>.ids.ts`: `gui` and the controls (flat) |
| `game-config.json` `verbs` | `verbs.<id>`, the [verb methods](#generated-verb-methods), `fallbacks.on<Verb>`, the `VerbId` / `ItemVerbId` types |
| `assets/audio/sfx/*`, `assets/audio/music/*`, `assets/videos/*` | `sfx.<name>`, `music.<name>`, `video.<name>` |
| `src/game/state.ts` | `flags`, `vars` (re-exported) |

**Naming.**

- IDs become camelCase: `what about the key` → `whatAboutTheKey`, `enter-from-door` → `enterFromDoor`. An all-capitals first word is lower-cased (`PB` → `pb`, `PB open` → `pbOpen`).
- In a room module, the room's own ID and the kind word are stripped: `outside-hotspot-door` → `door`, `outside-point-henry-fountain` → `points.henryFountain`, `apartment-walk` → `walkables.walk`. When what's left doesn't start with a letter, the whole ID is kept (`outside-point-1` → `points.outsidePoint1`).
- Two IDs that give the same name in one scope fail generation. Add `"scriptName": "otherName"` to one of them in its JSON (rooms, props, hotspots, points, regions, walkable polygons, characters, items, dialogs, options, GUIs and controls take it). Sound, music and video files that collide must be renamed.
- A flat name that is a JavaScript reserved word or shadows a BenneScript name (`wait`, `room`, `settings`, …) gets a trailing `_` and a warning; a `scriptName` is the cleaner fix (the templates' game menu names its `settings` button `settingsBtn`). A name that shadows a browser global (`window`, `close`) only warns.
- `stop`, `isPlaying` and `current` are reserved in `music`; `stopAll` in `sfx`; `pause`, `resume`, `seek`, `stop`, `isPlaying` and `current` in `video`.

**One object per thing.** `dialogs.chatwithpenny.options.bye` and `options.bye` in `chatwithpenny.dialog.ts` are the same object, as are `guis.saveMenu.controls.saveBtn` and `saveBtn` in `save-menu.gui.ts`. A room's `penny` and `characters.penny` differ only in scope: handlers on the room's handle apply in that room, handlers on `characters.penny` wherever Penny is. In `penny.character.ts`, `penny` from `./penny.ids` *is* `characters.penny`.

### Generated verb methods

The verbs in `game-config.json` are the only source of verb handlers; the engine knows no verb names. For each verb `V` (method name: `on` + the ID in PascalCase, so `talkTo` → `onTalkTo`, `pick-up` → `onPickUp`):

| On | Generated | Example (the 9-verb template: `give`, `pickUp`, `use`, `open`, `look`, `push`, `close`, `talkTo`, `pull`) |
|---|---|---|
| Props, hotspots, characters | `on<V>(fn)` | `rock.onPush(() => { … })` |
| Inventory items (verb on the inventory row) | `on<V>(fn)` | `items.pb.onOpen(() => { … })` |
| Clickables and items, for `usesItem` verbs | `on<V>Item(item, fn, options?)` | `door.onUseItem(items.key, () => { … })` |
| Items, for `usesItem` verbs | `on<V>.doNotActivate(fn)` | `items.sammich.onUse.doNotActivate(() => { … })`: the item isn't armed afterwards |
| `fallbacks` | `on<V>(fn)`; `on<V>Item((item, target) => …)` for `usesItem` verbs | `fallbacks.onPush(() => { Player: "It won't move." })` |
| `verbs` | `verbs.<V>` (a [`VerbHandle`](#verbs-verbsx)) | `verbs.look.select()` |

Built-in methods next to the generated ones: `x.on(['use', 'take'], fn)` (several verbs, one handler), `x.onItem(item, fn)` (any item verb), `x.onAnyItem((item, verb) => …)` (any item without its own handler), `items.x.onCombine(item, fn)` (same as `onItem`, for item-on-item).

**Config.** A verb with `"usesItem": true` (default: true when it has a `preposition`) arms the selected inventory item and is then used on a target. An item is armed by every `usesItem` verb on its row after that verb's handler (or at once when it has none), unless the handler was registered with `.doNotActivate`. The game-level `"defaultVerb"` (default: `look` when the game has it, else the first verb) is what a plain click on something without its own `defaultVerb` uses.

**Reserved verb IDs** fail generation: `walkTo`, `defaultVerb`, `item`, `anyItem`, `combine`, `verbItem`, IDs that don't start with a letter, and two verbs whose methods collide (a `usesItem` verb `use` next to a verb `useItem`).

**Dispatch order.** A verb on a target runs the first handler found: the room's handler for that target → the character script's (characters only) → the global fallback for that verb (`fallbacks.on<V>`) → `fallbacks.onAnyVerb` → `fallbacks.onUnhandled`. An item used on a target: the room's `on<V>Item` / `onItem` for that item → the room's `onAnyItem` → the character script's → `fallbacks.on<V>Item` → `fallbacks.onItemUnhandled`. Inside a handler, `unhandled()` ends it and hands the click to the next step.

---

## Engine events

`events.on(name, listener)` takes your own event names and these engine events (the editor completes them). Payload types are in `src/types/gameState.ts` and `src/engine/events/`.

| Event | Payload |
|---|---|
| `'gameState:flagChanged'` | `{ key, previousValue, value }` |
| `'gameState:variableChanged'` | `{ key, previousValue, value }` |
| `'gameState:inventoryChanged'` | `{ reason: 'add' \| 'remove' \| 'clear', characterId, itemId?, inventory }` |
| `'gameState:replaced'` | `{ snapshot }`: a save loaded or a new game started |
| `'gameState:activeVerbChanged'` | `{ previousValue, value }` (verb IDs or `null`) |
| `'gameState:activeInventoryItemChanged'` | `{ itemId }` (or `null`) |
| `'gameState:activePlayerCharacterChanged'` | `{ previousCharacterId, characterId }` |
| `'gameState:roomContextChanged'` | `{ currentRoom, lastRoom, previousCurrentRoom, previousLastRoom }` |
| `'benne:dialog:started'` / `'benne:dialog:stopped'` | `{ dialogId, guiId }` |
| `'benne:dialog:optionEnabledChanged'` | the dialog, option and new state |
| `'verb:unhandled'` | a verb nothing handled (`fallbacks.onUnhandled` is the friendlier way) |

In a room script a listener is live only while that room is active; anywhere else, for the whole game. Either way, a listener whose lines are still running (a `wait`, a line of speech) stops at that step on a room change or save load, like any handler. Listeners don't take the interaction lock.

---

## Build errors and gotchas

| You wrote | What happens | Do this |
|---|---|---|
| `() => Hank: "Hi"` | Syntax error: a label needs statement position (the build and the editor say to add braces) | `() => { Hank: "Hi" }` |
| `Hank: Hi there` | Not valid TypeScript | Quote it, or use a `` say`…` `` block |
| `Hnak: "Hi"` | Build error: unknown speaker, with a suggestion | Fix the name |
| `Hank: "Hi"` outside any handler | Build error: it would never run | Put it in a handler |
| `parts.forEach(handOver)` (a step function) | Build error: `forEach` doesn't wait | `for (const p of parts) handOver(p)` |
| `penny.say(greet())` (a step function called inside another call) | Build error | Call it on its own line first: `const g = greet()` |
| `wait(1)`, a walk, `face` or a fade inside `onUpdate` | Runtime error `TimedActionInUpdateError` (logged once); lint error | Start a `background(() => …)` block from it, once (guard with a flag) |
| `await henry.walkTo(p)` | Doesn't wait (the blocking form isn't a promise); lint error | Drop the `await` |
| `ready && henry.walkTo(p)`, `setTimeout(() => wait(1))` | Starts without waiting: only a call on its own line in a handler waits; lint error | `if (ready) henry.walkTo(p)`, or `.now(…)` when not waiting is what you want |
| Code after `rooms.x.goTo()` | Never runs (greyed out) | Put it before, or in the next room's `onEnter` |
| `henry.walkTo(…)` in a region handler | Holds the gameplay lock while Henry walks | `henry.walkTo.now(…)` |
| A handle named `window` | Works, but shadows the browser global (warning) | Add a `scriptName` |
| `emitter.on('x', fn)` on a non-BenneScript object | `fn` becomes a step function (async), because of its `on` name | Define `fn` outside the call, or move the code to an ordinary `.ts` file |

Source maps point at your lines: a breakpoint on a handler line stops there, and *Step over* moves to the next line once the timed action has finished.

---

<!-- BEGIN GENERATED: npm run docs:api -->

## Actions

Free functions from `@benne/script`. Each one runs at the line where it is written.

| Member | | Description |
|---|---|---|
| `` say`Speaker: line …` `` | waits · `.now` | A multi-line exchange, one `Speaker: text` line each. Speakers are written as in the character JSON (ID or display name, any case). Waits for the last line. |
| `display(text: string)` | waits · `.now` | Narration in the display-text overlay. Waits until clicked away (or skipped). |
| `wait(seconds: number)` | waits · `.now` | Pause for `seconds`. Returns at once in skip mode. |
| `waitForClick(options?: { timeout?: number })` | waits · `.now` | Waits for a left click (the same click that skips a speech line), or until `timeout` seconds have passed. Works inside cutscenes, where world clicks are otherwise ignored. |
| `walkToClicked()` | waits · `.now` | Walk the player to the clicked thing's walk-to point, then face it. Waits. |
| `faceClicked()` | waits · `.now` | Turn the player toward the clicked thing. |
| `fadeOut(seconds?: number, color?: number)` | waits · `.now` | Fades the screen to `color` (black by default) over `seconds`. Waits. |
| `fadeIn(seconds?: number, color?: number)` | waits · `.now` | Fades the screen back in over `seconds`. Waits. |
| `unhandled()` | ends the handler | Ends the running handler and hands the interaction to the next handler in the chain: the character script's handler, then the global handlers and fallbacks. |

## Blocks

Their callbacks are step functions: lines inside them are sequenced too.

| Member | | Description |
|---|---|---|
| `cutscene(fn: Block, options?: CutsceneOptions)` | waits | Runs `fn` as a cutscene: world clicks are ignored, click-to-skip on speech still works, and the skip key fast-forwards the whole block (timed steps finish at their end state). Waits. |
| `together(...fns: Block[])` | waits | Starts every function at once and waits until all of them have finished. |
| `background(fn: Block)` | doesn't wait | Runs `fn` alongside the scene without waiting for it. It doesn't take the interaction lock and stops on a room change or save load. `task.wait()` waits for it later. |
| `withInputDisabled(fn: Block)` | waits | Runs `fn` with player input disabled, and re-enables it afterwards, even if the room changes. Waits. |

### `input`

Player input. `input.disabled = true` locks out clicks until set back (survives room changes). In `src/engine/bennescript/blocks.ts`.

| Member | | Description |
|---|---|---|
| `input.disabled: boolean` | settable | True while player input is off. |

## Script-level registrations

Written at the top level of a script file.

| Member | | Description |
|---|---|---|
| `playFrom(name: string, setup: () => void)` | handler | A named starting state for BENNE Play's "Play From", written at the top level of a room script. It runs before the room's enter handlers, only when BENNE Play asks for it by name. |
| `onUpdate(fn: (deltaSeconds: number) => void)` | handler | Runs `fn` every frame with the seconds since the last one. Not sequenced: a timed action started here throws (`TimedActionInUpdateError`); start a `background(…)` block from a frame check instead. |
| `defineFlags(defaults: T)` | instant | Declares the game's flags with defaults, in `src/game/state.ts`. Reads and writes go straight to the game state at that line. Each flag is stored under its name, or its `saveKey`. |
| `defineVars(defaults: T)` | instant | Declares the game's variables with defaults, in `src/game/state.ts`. Reads and writes go straight to the game state. An array or object default is copied into the state the first time it is read, so changing it in place is saved too. |
| `flag(defaultValue: boolean, options?: { saveKey?: string })` | instant | `unlockedDoor: flag(false, { saveKey: 'unlocked door' })` |

## Game-wide objects

Objects from `@benne/script`.

### `player`

The active player character. In `src/engine/bennescript/actions.ts`.

| Member | | Description |
|---|---|---|
| `player.id: string` | read-only | The active player's character id. |
| `player.walkTo(target: WalkTarget)` | waits · `.now` | Walks to a point, a named point or a thing's walk-to point. Waits. `.now` doesn't. |
| `player.moveTo(target: WalkTarget)` | instant | Teleports (instant). |
| `player.stopWalking()` | instant | Stops a walk where the player is now. |
| `player.position: Point2` | read-only | Feet position in room pixels. |
| `player.face(direction: CharacterFacingLetter)` | waits · `.now` | Turns to `'U'`, `'D'`, `'L'` or `'R'`. Waits for the turn; `.now` doesn't. |
| `player.facing: CharacterFacingLetter` | read-only | The direction the player faces. Read it in `onUpdate`, where `face` can't start. |
| `player.say(text: string, options?: ScriptedSayLineOptions)` | waits · `.now` | One speech line. Waits. Same as a `Player: "…"` label. |
| `player.play(tag: string)` | waits · `.now` | One-shot animation; waits for it to finish, then returns to the base animation. |
| `player.fade(alpha: number, seconds: number)` | waits · `.now` | Fades to `alpha` (0–1) over `seconds`. Waits. |
| `player.alpha: number` | settable | Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. |
| `player.stopAnimation()` | instant | Back to directional idle. |
| `player.animation: string` | settable | Animation override (instant, saved). |
| `player.visible: boolean` | settable | Hidden, the player isn't drawn. Instant, saved. |
| `player.show()` | instant | Same as `visible = true`. |
| `player.hide()` | instant | Same as `visible = false`. |
| `player.movable: boolean` | settable | When false, walks (including click-to-walk) are ignored; `moveTo` still works. Saved. |
| `player.startFollowing(target: { readonly id: string }, options?: CharacterFollowOptions)` | instant | Follows `target` (another character) around the room. Saved. |
| `player.stopFollowing()` | instant | Stops following (`startFollowing`). |
| `player.isFollowing: boolean` | read-only | True while following someone (`startFollowing`). |
| `player.followingTarget: { readonly id: string } \| null` | read-only | The character being followed, or `null`. |
| `player.startFacing(target: { readonly id: string }, options?: FacingOptions)` | instant | Keeps turning to face `target` whenever either of them moves, after a short random delay. Not saved. Use it for "keep looking at", which `face` in `onUpdate` can't do. |
| `player.stopFacing()` | instant | Stops turning toward its target (`startFacing`). |
| `player.speechPosition: Point2 \| null` | settable | Where the player's speech lines appear, in room pixels (bottom centre), instead of above the talk point. `null` goes back to the talk point. Saved. |
| `player.speechOffset: Point2 \| null` | settable | Extra offset of the player's speech lines, in game canvas pixels. `null` clears it. Saved. |
| `player.resetSpeechPosition()` | instant | Clears both `speechPosition` and `speechOffset`. |
| `player.switchTo(character: { readonly id: string })` | instant | Hands control to another character in the room (instant, saved): from the next line on, `player` and `Player:` mean that character. |

### `inventory`

The active player's inventory. In `src/engine/bennescript/actions.ts`.

The active player's bag. `penny.inventory` is another character's, with the same members.

| Member | | Description |
|---|---|---|
| `inventory.add(item: ItemRef, quantity?: number)` | instant | Adds `quantity` (default 1) of the item. Instant. |
| `inventory.remove(item: ItemRef, quantity?: number)` | instant | Removes `quantity` (default 1) of the item. Instant. |
| `inventory.has(item: ItemRef)` | instant | True when the bag holds the item. |
| `inventory.count(item: ItemRef)` | instant | How many of the item the bag holds. |
| `inventory.clear()` | instant | Empties the bag. |
| `inventory.items: Array<{ item: ItemRef; quantity: number }>` | read-only | What is in the bag, in order. |

### `camera`

The room camera. Moves and zooms wait; `.now` doesn't. `seconds` defaults to the room's configured transition time; `0` is instant. In `src/engine/bennescript/camera.ts`.

| Member | | Description |
|---|---|---|
| `camera.focus(target: WalkTarget, seconds?: number)` | waits · `.now` | Pans to a point, a named point or a thing. Waits. |
| `camera.zoom(zoom: number, seconds?: number)` | waits · `.now` | Zooms to `zoom` (2 = twice as close). Waits. |
| `camera.zoomTo(target: WalkTarget, zoom: number, seconds?: number)` | waits · `.now` | Pans to `target` and zooms to `zoom` together. Waits. |
| `camera.reset(seconds?: number)` | waits · `.now` | Back to following the player at the room's zoom. Waits. |
| `camera.resetZoom(seconds?: number)` | waits · `.now` | Back to the room's zoom, keeping the current focus. Waits. |
| `camera.shake(intensity?: number, seconds?: number, falloff?: boolean)` | instant | Shakes the camera. Doesn't wait. |

### `game`

The running game. In `src/engine/bennescript/game.ts`.

| Member | | Description |
|---|---|---|
| `game.isDesktop: boolean` | read-only | True in the desktop (Electron) build, where `quit()` closes the window. |
| `game.quit()` | instant | Closes the desktop app. Does nothing in a browser. |
| `game.newGame(startRoom?: RoomRef)` | ends the handler | Starts a fresh game: resets all state, then goes to `startRoom` (the configured starting room by default). Ends the handler. |
| `game.currentRoom: RoomRef \| null` | read-only | The room the player is in (a `rooms.x` handle), or `null` before the first room. |
| `game.config: GameSettings` | read-only | `game-config.json`. |
| `game.time: number` | read-only | Seconds since the room started (the room clock; pauses with it). |
| `game.onEnterAnyRoom(handler: (from: RoomRef \| null) => void, options?: CutsceneOptions)` | handler | Every room, before its own `onEnter`. `from` is the room the player came from. `{ skippable: false }` keeps ESC from skipping the enter phase. |
| `game.onEnterAnyRoomAfterFade(handler: (from: RoomRef \| null) => void, options?: CutsceneOptions)` | handler | Every room, after the fade-in and before its own `onEnterAfterFade`. |
| `game.onLoadedAnyRoom(handler: (from: RoomRef \| null) => void)` | handler | Every room a save loads into, before its own `onLoaded` (the enter hooks don't run on a load). |
| `game.isCutsceneActive: boolean` | read-only | True while a cutscene runs: a `cutscene(…)` block or a room's enter hooks. |
| `game.onLeaveAnyRoom(handler: () => void)` | handler | Every room change, before the room is left. |

### `settings`

Player settings. Saved with the game's settings, not with save slots. In `src/engine/bennescript/game.ts`.

| Member | | Description |
|---|---|---|
| `settings.sfxVolume: number` | settable | Sound effects volume, 0–1. |
| `settings.musicVolume: number` | settable | Music volume, 0–1. |
| `settings.textSpeed: number` | settable | How long speech lines stay up: a multiplier, 1 = as configured, 2 = twice as long. Same as `speech.durationMultiplier`. |
| `settings.clickToSkip: boolean` | settable | Whether a click dismisses the current speech line. Same as `speech.clickToSkip`. |
| `settings.speech.clickToSkip: boolean` | settable | Whether a click dismisses the current line. Same as `settings.clickToSkip`. |
| `settings.speech.showText: boolean` | settable | Whether lines show as text (timing still runs when they don't). |
| `settings.speech.msPerCharacter: number` | settable | Milliseconds each character adds to a line's duration. |
| `settings.speech.durationMultiplier: number` | settable | Scales every line's duration. Same as `settings.textSpeed`. |
| `settings.speech.minDurationMs: number` | settable | Shortest a line stays up, in milliseconds. |
| `settings.speech.maxDurationMs: number` | settable | Longest a line stays up, in milliseconds. |
| `settings.speech.defaultTalkOffset: { x: number; y: number }` | settable | Offset, in game canvas pixels, of every line from its character's talk point. |
| `settings.dialog.choiceOptionsViewportHeightPx: number \| undefined` | settable | Height in pixels of the scrolling choice list. |
| `settings.dialog.usedColor: string \| undefined` | settable | Color of options the player has already chosen (`'#888888'`). |
| `settings.onChange(handler: () => void)` | handler | Runs `handler` after any setting changes (a settings menu that shows live values). |

### `pointer`

The verb / item / hover context of the pointer. In `src/engine/bennescript/game.ts`.

| Member | | Description |
|---|---|---|
| `pointer.verb: VerbHandle \| null` | settable | The armed verb (a `verbs.x` handle), or `null` in walk mode. Set it to arm a verb, or `null` to clear it. |
| `pointer.item: ItemHandle \| null` | settable | The armed inventory item (an `items.x` handle), or `null`. Set it to arm an item (`pointer.item = items.knife`) or to drop the armed one (`pointer.item = null`). |
| `pointer.hover: PointerHover \| null` | read-only | What the pointer is over (`{ kind, id, description, defaultVerb }`), or `null`. |
| `pointer.sentence: string` | read-only | The standard verb line: "Walk to", "Look at Door", "Use Coffee with Coffee maker". While a clicked verb runs (an armed verb, or a right-click's default verb), it is that action's line until its handler finishes, whatever the pointer is over. |
| `pointer.onContextChange(handler: () => void)` | handler | Runs `handler` whenever the armed verb, the armed item or the hover target changes, or a clicked action starts or finishes. |

### `saves`

Save slots. Saving is refused while a gameplay interaction or a dialog is running: see `saves.canSaveNow`. In `src/engine/bennescript/saves.ts`.

| Member | | Description |
|---|---|---|
| `saves.canSaveNow: boolean` | read-only | False while a gameplay interaction (room, character, inventory, dialog or global handler, including cutscenes), an open dialog or a room transition is in progress. GUI handlers don't count, so a save menu opened between interactions can save. |
| `saves.list()` | instant | Every save: numbered slots first, in slot order, then named saves, newest first. |
| `saves.get(save: SaveRef)` | instant | The save in `slot`, or the named save `name`. |
| `saves.save(save: SaveRef, name?: string)` | waits · `.now` | Writes the game: `saves.save(2, 'Before the lab')` to a slot, or `saves.save('checkpoint')` as a named save. Waits until written. While `canSaveNow` is false it does nothing and logs a DEV warning; it never throws, so a stray call can't break a GUI handler. |
| `saves.autosave(save = 'Autosave')` | instant | Saves the game as soon as saving is allowed: at once when `canSaveNow` is true, else when the running interaction, dialog or room transition is over. Works anywhere, including in `onEnter` and cutscenes, where `save` is refused. Doesn't wait. A later call replaces one still pending, and loading a game drops it. `saves.autosave()` writes the named save `'Autosave'`; pass a name or a slot to use another. |
| `saves.load(save: SaveRef)` | ends the handler | Loads a slot or a named save and ends the handler; the game reloads into the saved room. |
| `saves.delete(save: SaveRef)` | instant | Deletes a slot or a named save. |
| `saves.rename(save: SaveRef, newName: string)` | instant | Renames a slot's or a named save's save name. |
| `saves.export()` | instant | The game as it is now, as JSON (for a "copy save" button, or a file download). |
| `saves.import(json: string)` | ends the handler | Loads a game exported with `export` and ends the handler, like `load`. |

### `events`

The event bus: engine events (`'gameState:inventoryChanged'`, …) and events scripts send each other. Listeners are handlers: their lines are sequenced, and a room change or save load stops one that is still running. In `src/engine/bennescript/events.ts`.

| Member | | Description |
|---|---|---|
| `events.on(name: EventName, listener: (...args: never[]) => void)` | handler | Runs `listener` each time `name` is emitted. In a room script it listens only while that room is active (from its creation until the player leaves); anywhere else, for the whole game. |
| `events.once(name: EventName, listener: (...args: never[]) => void)` | handler | Like `on`, but only for the next `name` (in a room script: the next one in each visit). |
| `events.off(name: EventName, listener?: (...args: never[]) => void)` | instant | Stops `listener` (the same function passed to `on`), or every script listener of `name`. |
| `events.emit(name: EventName, ...args: unknown[])` | instant | Sends `name` with `args` to every listener. Returns whether anything was listening. |

## Handles

Generated handles are instances of these classes. Verb handlers (`onLook`, `onUseItem`, …) are added by the generator from `game-config.json`; see [Generated verb methods](#generated-verb-methods).

### Rooms: `room`, `rooms.x`

`RoomHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The room's ID (`'apartment'`). |
| `onEnter(handler: StepHandler, options?: CutsceneOptions)` | handler | Before the fade-in: invisible setup. The fade-in waits for it. Like every enter hook it runs as a cutscene; `{ skippable: false }` keeps ESC from skipping it. |
| `onEnterAfterFade(handler: StepHandler, options?: CutsceneOptions)` | handler | After the fade-in: visible entrances, cutscenes. `{ skippable: false }` keeps ESC from skipping it. |
| `onLeave(handler: StepHandler)` | handler | Each time the player leaves this room, before the next room loads. |
| `onLoaded(handler: StepHandler)` | handler | When a save loads into this room. The enter hooks don't run on a load, so restore what they would have set up here. |
| `visitCount: number` | settable | How many times the player has entered this room, including now. Settable (Play From). |
| `isFirstVisit: boolean` | read-only | True on the first visit (`visitCount === 1`). |
| `hasVisited: boolean` | read-only | True once the player has been here. |
| `last: RoomHandle \| null` | settable | The room the player was in before the current one (`null` at the start). Settable, for Play From setups that pretend the player came from somewhere. |
| `cameFrom(room: { readonly id: string })` | instant | True when the player came here from `room`. |
| `goTo()` | ends the handler | Starts the transition to this room and ends the handler. |

### Clickables: shared by props, hotspots and characters

A prop, hotspot or character: things the player clicks. Room `.ids` modules create them with their room id; `characters.x` in `@game` has none, so its handlers belong to the character script and apply wherever the character is spawned. `ClickableHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The content ID from the room or character JSON. |
| `on(verbs: VerbId \| readonly VerbId[], handler: StepHandler)` | handler | One handler for one or several verbs (`door.on(['open', 'use'], …)`). |
| `onVerbItem(verb: VerbId, item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions)` | handler | `verb` with `item` on this target. Generated item-verb methods (`onUseItem`) call this. `{ doNotClear: true }` keeps the item armed afterwards, whatever the drop policy says. |
| `onItem(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions)` | handler | `item` with any item verb on this target. |
| `onAnyItem(handler: (item: ItemRef, verb: { readonly id: VerbId }) => void, options?: ItemHandlerOptions)` | handler | Any item without a handler of its own, any item verb, on this target. On `characters.x` (a character script) it applies in every room, after the room's own item handlers. |

### Props: `door`

A prop. Its state lives in its own room: in that room, reads and writes go through the scene; from anywhere else they read and write the room's saved state, which the room applies when it loads. Actions that need the sprite (`play`) only work in the prop's room. `PropHandle` in `src/engine/bennescript/handles.ts`. Also has everything on `ClickableHandle`.

| Member | | Description |
|---|---|---|
| `visible: boolean` | settable | Hidden props aren't drawn or clickable. Instant, saved. |
| `hide()` | instant | Same as `visible = false`. |
| `show()` | instant | Same as `visible = true`. |
| `clickable: boolean` | settable | When false, the prop can't be hovered or clicked. Saved. |
| `description: string` | settable | The hover / verb-line name. Saved. |
| `animation: AnimTag` | settable | The prop's base (looping) animation tag. Setting it is instant and saved. From another room the tag is saved without checking it (the room's sheet isn't loaded). |
| `play(tag: AnimTag)` | waits · `.now` | One-shot animation; waits for it to finish, then returns to the base animation. Its room only. |
| `fade(alpha: number, seconds: number)` | waits · `.now` | Fades to `alpha` (0–1) over `seconds`. Waits. The end alpha is saved; from another room, at once. |
| `alpha: number` | settable | Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. Outside the prop's room it reads and writes the saved value (the room JSON's when none is saved). |
| `moveTo(point: Point2)` | instant | Teleports to room pixels (instant). From another room, the position is saved for it. |
| `slideTo(point: Point2, seconds: number)` | waits · `.now` | Moves to room pixels over `seconds`. Waits. From another room, it moves there at once. |

### Hotspots: `windowHotspot`

A hotspot. Like a prop, its state lives in its own room: from another room, reads and writes go to that room's saved state. `HotspotHandle` in `src/engine/bennescript/handles.ts`. Also has everything on `ClickableHandle`.

| Member | | Description |
|---|---|---|
| `active: boolean` | settable | When false, the hotspot can't be hovered or clicked. Saved. |
| `clickable: boolean` | settable | Same as `active`. |
| `description: string` | settable | The hover / verb-line name. Saved. |

### Characters: `penny`, `characters.penny`

`CharacterHandle` in `src/engine/bennescript/handles.ts`. Also has everything on `ClickableHandle`.

| Member | | Description |
|---|---|---|
| `isPlayer: boolean` | read-only | True when this is the character the player controls. |
| `say(text: string, options?: ScriptedSayLineOptions)` | waits · `.now` | One speech line from this character. Waits; `.now` doesn't. Same as a `Name: "…"` label. |
| `walkTo(target: WalkTarget)` | waits · `.now` | Walks to a point, a named point or a thing's walk-to point. Waits; `.now` doesn't. |
| `moveTo(target: WalkTarget)` | instant | Teleports (instant). |
| `stopWalking()` | instant | Stops a walk where the character is now. |
| `position: Point2` | read-only | Feet position in room pixels. |
| `face(direction: CharacterFacingLetter)` | waits · `.now` | Turns to `'U'`, `'D'`, `'L'` or `'R'` (completions insert the quotes). Waits for the turn; `.now` doesn't. |
| `facing: CharacterFacingLetter` | read-only | The direction the character faces. Read it in `onUpdate`, where `face` can't start. |
| `play(tag: AnimTag)` | waits · `.now` | One-shot animation; waits for it to finish, then returns to the base animation. |
| `fade(alpha: number, seconds: number)` | waits · `.now` | Fades to `alpha` (0–1) over `seconds`. Waits. |
| `alpha: number` | settable | Opacity, 0–1. Setting it is instant (it stops a running `fade`) and saved. |
| `animation: AnimTag` | settable | Animation override (instant, saved); the effective animation when read. |
| `stopAnimation()` | instant | Back to directional idle. |
| `visible: boolean` | settable | Hidden characters aren't drawn or clickable. Instant, saved. |
| `show()` | instant | Same as `visible = true`. |
| `hide()` | instant | Same as `visible = false`. |
| `movable: boolean` | settable | When false, walks are ignored; `moveTo` still works. Saved. |
| `clickable: boolean` | settable | When false, the character can't be hovered or clicked. Saved. |
| `description: string` | settable | The hover / verb-line name. Saved. |
| `startFollowing(target?: { readonly id: string }, options?: CharacterFollowOptions)` | instant | Follows `target` (another character, or the player by default) around the room. Saved. |
| `stopFollowing()` | instant | Stops following (`startFollowing`). |
| `startFacing(target?: { readonly id: string }, options?: FacingOptions)` | instant | Keeps turning to face `target` (the player by default) whenever either of them moves, after a short random delay. Not saved. Use it for "keep looking at", which `face` in `onUpdate` can't do. |
| `stopFacing()` | instant | Stops turning toward its target (`startFacing`). |
| `isFollowing: boolean` | read-only | True while following someone (`startFollowing`). |
| `followingTarget: { readonly id: string } \| null` | read-only | The character (or `player`) being followed, or `null`. |
| `speechPosition: Point2 \| null` | settable | Where this character's speech lines appear, in room pixels (bottom centre), instead of above its talk point. `null` goes back to the talk point. Saved. |
| `speechOffset: Point2 \| null` | settable | Extra offset of this character's speech lines, in game canvas pixels. `null` clears it. Saved. |
| `resetSpeechPosition()` | instant | Clears both `speechPosition` and `speechOffset`. |
| `inventory: Inventory` | read-only | This character's own bag. |

### Points: `points.x`

A named point in a room (`points.x`): a walk target. `PointHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The point's ID in the room JSON. |

### Regions: `regions.x`

A region in a room (`regions.x`). Like a prop, its state lives in its own room: from another room, `active` reads and writes that room's saved state. `RegionHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The region's ID in the room JSON. |
| `onEnter(handler: (who: CharacterHandle) => void)` | handler | Runs when a character's feet enter the region. `who` is that character's handle. |
| `onExit(handler: (who: CharacterHandle) => void)` | handler | Runs when a character's feet leave the region. |
| `active: boolean` | settable | Inactive regions don't fire and don't block walking. Saved. |

### Walkable areas: `walkables.x`

A walkable polygon in a room (`walkables.x`). Like a region, its state lives in its own room: from another room, `active` reads and writes that room's saved state. `WalkableHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The walkable polygon's ID in the room JSON. |
| `active: boolean` | settable | Inactive walkable polygons can't be walked on. Saved. |

### Inventory items: `items.x`

`ItemHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The item's ID in its JSON. |
| `name: string` | read-only | The item's display name from its JSON. |
| `animation: AnimTag` | settable | The item's icon animation. Setting it is instant and saved. |
| `cursorAnimation: string` | settable | The cursor animation while this item is armed. Setting it is instant and saved. |
| `description: string` | settable | The hover / verb-line name. Saved. |
| `on(verbs: VerbId \| readonly VerbId[], handler: StepHandler)` | handler | `verb` used on this item's inventory row. Generated verb methods (`onLook`) call this. |
| `onVerbItem(verb: VerbId, item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions)` | handler | `verb` with another item on this one. Generated item-verb methods (`onUseItem`) call this. `{ doNotClear: true }` keeps the other item armed afterwards, whatever the drop policy says. |
| `onItem(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions)` | handler | Any item verb with `item` on this one. |
| `onCombine(item: ItemRef, handler: StepHandler, options?: ItemHandlerOptions)` | handler | Same as `onItem`; reads better for item-on-item. |
| `onAnyItem(handler: (item: ItemRef, verb: { readonly id: VerbId }) => void, options?: ItemHandlerOptions)` | handler | Any other item without a handler of its own, any item verb, on this one. |

### Dialogs: `dialog`, `dialogs.x`

`DialogHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The dialog's ID. |
| `options: { [name]: DialogOptionHandle }` | read-only | This dialog's options by handle name (`dialogs.chatwithpenny.options.greeting`). |
| `start()` | waits · `.now` | Opens the conversation and waits until it ends. Started from a choice handler, it is a sub-dialog: its parent comes back when it ends. `.now` opens it without waiting. |
| `end()` | ends the handler | Ends this conversation (back to the parent, if it is a sub-dialog) and ends the handler. |
| `onStart(handler: StepHandler)` | handler | Runs each time the conversation opens, before the player picks: set up which options show. |

### Dialog options: `options.x`, `dialogs.x.options.y`

`DialogOptionHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The option's ID in the dialog JSON. |
| `on()` | instant | Shows the option in the choice list. Saved. |
| `off()` | instant | Hides the option from the choice list. Saved. |
| `enabled: boolean` | read-only | True while the option is shown. |
| `onChoose(handler: StepHandler)` | handler | Runs when the player chooses this option, after the player says its text. |
| `onChooseOnce(handler: StepHandler)` | handler | Same as `onChoose`, and turns the option off once chosen. |

### GUIs: `gui`, `guis.x`

`GuiHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The GUI's ID. |
| `controls: { [name]: GuiControlHandle }` | read-only | This GUI's controls by handle name (`guis.saveMenu.controls.saveBtn`). |
| `root: GuiControlHandle` | read-only | The GUI's packed content as one control: move or tween it to move the whole GUI. |
| `show()` | instant | Shows the GUI (instant) and runs its `onShow` handlers. |
| `hide()` | instant | Hides the GUI (instant) and runs its `onHide` handlers. |
| `visible: boolean` | settable | Whether the GUI is shown. Setting it is the same as `show()` / `hide()`. |
| `fadeIn(seconds = 0.5)` | waits · `.now` | Shows the GUI and fades it in over `seconds`. Waits. |
| `fadeOut(seconds = 0.5)` | waits · `.now` | Fades the GUI out over `seconds`, then hides it. Waits. |
| `onBuilt(handler: StepHandler)` | handler | Each time the GUI is built (once per room). |
| `onShow(handler: StepHandler)` | handler | Each time a script shows the GUI. |
| `onHide(handler: StepHandler)` | handler | Each time a script hides the GUI. |
| `onAnyClick(handler: (button: GuiControlHandle) => void)` | handler | Any button in this GUI, once the button's own `onClick` is over (not when that handler ended with `goTo`, `saves.load` or `dialog.end`). `button` is its control handle. |

### GUI controls: `saveBtn`, `guis.x.controls.y`

A GUI control (`guis.x.controls.y`, or flat in the GUI's own `.ids` module). `GuiControlHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The control's ID in the GUI JSON. |
| `text: string` | settable | Text controls: the shown text. |
| `alpha: number` | settable | Opacity, 0–1. Instant. |
| `visible: boolean` | settable | Whether the control is shown. Instant. |
| `x: number` | settable | Position in GUI pixels. Instant. |
| `y: number` | settable | Position in GUI pixels. Instant. |
| `enabled: boolean` | settable | Buttons, text inputs and checkboxes. A disabled control ignores the pointer and looks disabled. |
| `value: number` | settable | Sliders. Setting it doesn't fire `onChange`. |
| `checked: boolean` | settable | Checkboxes. Setting it doesn't fire `onChange`. |
| `selectedIndex: number` | settable | List boxes. |
| `setRowText(index: number, text: string)` | instant | List boxes. |
| `rowCount: number` | read-only | List boxes: how many rows the list has. |
| `focused: boolean` | settable | Text inputs: whether the input has the keyboard. Setting it focuses or blurs it. |
| `visualState: string` | write-only | Buttons: force `'normal'`, `'hover'`, `'pressed'` or `'disabled'` looks. `'normal'` gives control back to the pointer. |
| `fadeTo(alpha: number, seconds: number, options?: { clickToSkip?: boolean })` | waits · `.now` | Fades to `alpha` over `seconds`. Waits. With `clickToSkip`, a click finishes it at once. |
| `tweenTo(props: Record<string, number>, seconds: number, ease?: string, options?: { clickToSkip?: boolean })` | waits · `.now` | Tweens numeric properties (`{ y: -800 }`) over `seconds`. Waits. |
| `onClick(handler: StepHandler)` | handler | Buttons. Sequenced, but doesn't block gameplay. |
| `onChange(handler: (value: never) => void)` | handler | Sliders (number), text inputs (text) and checkboxes (checked). Runs immediately. |
| `onSelect(handler: (index: number) => void)` | handler | List boxes: the selected row changed. Runs immediately. |
| `onActivate(handler: (index: number) => void)` | handler | List boxes: a row was activated (double-click, or Enter on the selected row). Sequenced, like `onClick`. |
| `onSubmit(handler: (text: string) => void)` | handler | Text inputs: the player pressed Enter. `text` is the input's text. Sequenced, like `onClick`. |
| `onMouseEnter(handler: StepHandler)` | handler | The pointer moved onto the control. Runs immediately, outside the gameplay lock. |
| `onMouseLeave(handler: StepHandler)` | handler | The pointer left the control. Runs immediately, outside the gameplay lock. |

### Verbs: `verbs.x`

A verb, as `verbs.<id>` in `@game`. `VerbHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: VerbId` | read-only | The verb's ID in `game-config.json`. |
| `label: string` | read-only | The verb bar's text (`'Look at'`). |
| `preposition: string \| null` | read-only | `'with'` in "Use knife with bread", or `null`. |
| `usesItem: boolean` | read-only | True for verbs that use an inventory item on a target (`usesItem` in the config). |
| `select()` | instant | Makes this the active verb, as clicking its button in a verb bar does. |
| `isActive: boolean` | read-only | True while this is the armed verb. |

### Fallbacks: `fallbacks`

`fallbacks` in `@game`: global handlers for verbs nothing else handled. `FallbacksHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `on(verb: VerbId, handler: StepHandler)` | handler | Fallback for one verb. The generated `fallbacks.on<Verb>` methods call this. |
| `onVerbItem(verb: VerbId, handler: (item: ItemRef, target: FallbackTarget) => void)` | handler | Fallback for one item verb. The generated `fallbacks.on<Verb>Item` methods call this. |
| `onAnyVerb(handler: StepHandler)` | handler | Any verb nothing else handled, when it has no `on<Verb>` fallback. |
| `onItemUnhandled(handler: (item: ItemRef, target: FallbackTarget) => void)` | handler | Any item use nothing else handled, when its verb has no `on<Verb>Item` fallback. |
| `onUnhandled(handler: (verb: { readonly id: VerbId }, target: FallbackTarget) => void)` | handler | The last tier: a verb nothing handled, not even `onAnyVerb`. Handy as a DEV diagnostic (`if (import.meta.env.DEV) console.info(…)`). |

### Sounds: `sfx.x`

`SfxHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The sound's file name, without the extension. |
| `play(options?: SoundPlayOptions)` | instant | Starts the sound and continues. A skipped cutscene plays no one-shot sounds. |
| `playAndWait(options?: SoundPlayOptions)` | waits · `.now` | Plays the sound and waits until it ends. |
| `stop()` | instant | Stops this sound. |
| `isPlaying: boolean` | read-only | True while this sound plays. |

`sfx` itself also has these (`SfxControls`); the generator reserves their names:

| Member | | Description |
|---|---|---|
| `sfx.stopAll()` | instant | Stops every playing sound effect. |

### Music: `music.x`

`MusicHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The track's file name, without the extension. |
| `play(options?: MusicPlayOptions)` | instant | Starts (crossfades to) this track and continues. |
| `isPlaying: boolean` | read-only | True while this track is the one playing. |

`music` itself also has these (`MusicControls`); the generator reserves their names:

| Member | | Description |
|---|---|---|
| `music.stop()` | instant | Stops the music. |
| `music.isPlaying: boolean` | read-only | True while any track plays. |
| `music.current: MusicHandle \| null` | read-only | The track playing now, or `null`. |

### Videos: `video.x`

A video under `assets/videos/` (`video.x`). `VideoPlayOptions`: `loop`, `volume` (0–1), `clickToSkip`, `ignoreCameraZoom` (fill the screen even while the camera is zoomed in) and `onComplete`. `VideoHandle` in `src/engine/bennescript/handles.ts`.

| Member | | Description |
|---|---|---|
| `id: string` | read-only | The video's file name, without the extension. |
| `play(options?: VideoPlayOptions)` | instant | Starts the video and continues. |
| `playAndWait(options?: VideoPlayOptions)` | waits · `.now` | Plays the video and waits until it ends. |
| `stop()` | instant | Stops this video, if it is the one playing. |
| `isPlaying: boolean` | read-only | True while this video is the one playing. |

`video` itself also has these (`VideoControls`); the generator reserves their names:

| Member | | Description |
|---|---|---|
| `video.pause()` | instant | Pauses the playing video. |
| `video.resume()` | instant | Resumes a paused video. |
| `video.seek(seconds: number)` | instant | Jumps to `seconds` into the playing video. |
| `video.stop()` | instant | Stops the playing video. |
| `video.isPlaying: boolean` | read-only | True while a video plays (paused counts as playing). |
| `video.current: VideoHandle \| null` | read-only | The video playing now, or `null`. |

### Tasks: what `.now(…)` and `background(…)` return

`Task` in `src/engine/bennescript/task.ts`.

| Member | | Description |
|---|---|---|
| `done: boolean` | read-only | True once the action has finished. |
| `isTurn: boolean` | read-only | A turn (`face`, `faceClicked`), which the interrupt policy doesn't count as a timed step. |
| `wait()` | waits | Waits for this task, written as a statement: `walk.wait()`. |
| `finishNow()` | instant | Completes the action at its end state now (cutscene skip). |
| `cancel()` | instant | Stops the action. A later `wait()` returns at once. |

## Types

Types you may write in your own helpers.

**`WalkTarget`**: Where to walk: a named room point / thing id, raw room pixels, or a handle with an id.

```ts
type WalkTarget = Point2 | string | { readonly id: string }
```

**`ItemRef`**: Anything with an item ID: an `items.x` handle.

```ts
interface ItemRef {
  readonly id: string
}
```

**`ItemHandlerOptions`**: Options for item handlers (`door.onUseItem(items.key, fn, { doNotClear: true })`).

```ts
interface ItemHandlerOptions {
  readonly doNotClear?: boolean  // Keep the item armed after this handler, whatever the drop policy says.
}
```

**`FallbackTarget`**: What a fallback item handler was used on.

```ts
interface FallbackTarget {
  readonly kind: 'prop' | 'hotspot' | 'character' | 'item'
  readonly id: string
  readonly name: string  // Its verb-line label: description, else name, else id.
}
```

**`FacingOptions`**: How quickly a character turns to keep facing another (`startFacing`).

```ts
interface FacingOptions {
  readonly minWait?: number  // Shortest delay, in seconds, before turning after either character moves. Default 0.2.
  readonly maxWait?: number  // Longest delay, in seconds. Default 0.4.
}
```

**`SaveRef`**: A save: a numbered slot, or a name (named saves have no slot).

```ts
type SaveRef = number | string
```

**`SaveInfo`**: One save, as `saves.list()` and `saves.get()` return it.

```ts
interface SaveInfo {
  readonly slot: number | null  // The slot, or `null` for a named save.
  readonly name: string
  readonly timestamp: number
}
```

**`PointerHover`**: What the pointer is over.

```ts
interface PointerHover {
  readonly kind: 'prop' | 'hotspot' | 'character' | 'item' | null
  readonly id: string | null  // Prop, hotspot, character or item id.
  readonly description: string | null  // The hover description shown in the verb line.
  readonly defaultVerb: VerbHandle | null  // The verb a plain click would use (its own `defaultVerb`, else the game's): a `verbs.x` handle.
}
```

**`FlagSpec`**: A flag with options, for `defineFlags`.

```ts
interface FlagSpec {
  readonly default: boolean
  readonly saveKey?: string  // The key in the game state (and saves), when it differs from the flag's name.
}
```

**`VarValue`**: What a variable can hold: JSON-compatible values only, so saves stay safe.

```ts
type VarValue = string | number | boolean | null | readonly VarValue[] | { readonly [key: string]: VarValue }
```

**`StepHandler`**: A handler body as the author writes it. The transform makes it async.

```ts
type StepHandler = () => void
```

**`EventName`**: An engine event (completed by the editor) or any name of your own.

```ts
type EventName = EngineEventName | (string & {})
```

<!-- END GENERATED -->

<!-- #endregion site -->
---

## Source files

| File | What |
|---|---|
| `src/engine/bennescript/index.ts` | `@benne/script`: the public surface |
| `src/engine/bennescript/handles.ts` | Handle classes, `defineFlags` / `defineVars`, sound / music / video controls |
| `src/engine/bennescript/actions.ts` | `player`, `inventory`, speech, walks, `wait`, `display`, fades |
| `src/engine/bennescript/blocks.ts` | `cutscene`, `together`, `background`, `withInputDisabled`, `input` |
| `src/engine/bennescript/game.ts` | `game`, `settings`, `pointer` |
| `src/engine/bennescript/saves.ts`, `camera.ts`, `events.ts` | `saves`, `camera`, `events` |
| `src/engine/bennescript/task.ts`, `interactionContext.ts` | `Task`, `timed`, the step runtime, cancellation, `unhandled` |
| `src/engine/bennescript/roomHandlers.ts`, `globalHandlers.ts`, `itemHandlers.ts`, `dialogs.ts`, `guis.ts` | Handler tables and dispatch |
| `scripts/lib/generateGameHandles.mjs` | The handle generator (`npm run generate:game-ids`) |
| `scripts/lib/bennescriptTransform.mjs`, `vite-plugin-bennescript.ts` | The build transform |
| `scripts/lib/benneSpeakers.mjs` | Speaker label rules (shared by the transform and the generator) |
| `scripts/generate-bennescript-api-docs.mjs` | Generates the reference half of this page |
