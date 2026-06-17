---
title: Bennescript
outline: deep
---

# Bennescript

**Bennescript** is the scripting layer you use to bring a BENNE game to life. It's plain TypeScript, but you rarely touch raw Phaser: instead you work against a clean, queue-aware facade conventionally named **`B`**. Through `B` you move characters, speak lines, play sounds and music, change rooms, run cutscenes, read and write game state, drive GUIs, and respond to player interaction.

This page covers **how scripts are organized** (the different script types and when each runs) and then a **reference of the methods and properties** available on `B`.

## The interaction queue

The single most important idea in Bennescript is the **interaction queue**. Most actions you trigger from an interaction handler — walking, speaking, waiting, playing sounds, changing rooms — are *queued*. The next line of your script does not start until the previous queued action has finished.

This lets you write narrative sequences that read top-to-bottom and just work:

```ts
B.player.walkTo('door');     // walk, and wait until arrival
B.player.say('Locked.');     // then speak, and wait until the line finishes
B.wait(0.5);                 // then pause half a second
B.room.changeTo('hallway');  // then change rooms
```

Without the queue you'd be juggling timers and callbacks. With it, ordering is automatic.

### Blocking vs `.now`

Many methods come in two forms:

- **Blocking** (the plain call, e.g. `B.player.say('Hi')`) — queues on the interaction tail; later lines wait for it.
- **`.now`** (e.g. `B.player.say.now('Hi')`) — performs the same work **without** extending the queue, so following lines run immediately rather than waiting.

Use the blocking form for sequential beats; use `.now` for things you intentionally want to overlap (for example, start a sound and keep going).

## Script types (General Use)

Behavior is split across several script files, each registered with a `register*Script` function and each exposing a `B` tailored to its context. You register handlers once (at load) and the engine dispatches to them as the player interacts.

### Global script

`src/game/globalScript.ts` runs once when the game boots. It's the right place for game-wide setup and **fallbacks** — what happens when a verb is used on something no specific handler covers.

```ts
import { registerGlobalScript } from '@engine/scripting';

registerGlobalScript(({ B }) => {
  // Seed flags used across rooms
  B.state.setFlag('unlockedDoor', false);

  // Per-verb fallbacks
  B.whenGlobalVerb('look',   () => B.player.say('Nothing special about that.'));
  B.whenGlobalVerb('talkTo', () => B.player.say("I don't have anything to say to that."));

  // Catch-all when an inventory item is used on an unhandled target
  B.whenInventoryOnVerbTargetUnhandled(() => B.player.say("That doesn't work."));

  // Hooks for every room load
  B.whenEnterAnyRoom((ctx) => { /* invisible setup */ });
  B.whenEnterAnyRoomAfterFade(() => { /* visible entrance */ });

  // Per-frame logic, if you need it
  B.onUpdate((ctx) => { /* runs every frame */ });
});
```

The global script also exposes `whenLeaveAnyRoom`, `whenLoadedAnyRoom`, `whenGlobalFallback` (the ultimate safety net for any verb), and `whenVerbUnhandled` (a diagnostic hook).

### Room script

Each room has a `*.room.ts` that runs when that room loads. This is where most gameplay lives: per-target verb handlers, "use item on target" logic, region triggers, and room transition hooks.

```ts
import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {
  B.whenLookAt('Couch', () => {
    B.faceClicked();
    B.player.say("It's my weird, magical, poorly drawn couch.");
  });

  B.whenPickUp('Bread', () => {
    B.walkToClicked();
    B.inventory.add('Bread');
    B.prop('Bread').hide();
  });

  B.whenInventoryUsedOn('Door', (payload) => {
    if (payload.itemId === 'Key' && payload.verbId === 'use') {
      B.walkToClicked();
      B.state.setFlag('unlockedDoor', true);
      B.inventory.remove('Key');
      B.player.say('The door is unlocked.');
      return;
    }
    return false; // let the global unhandled fallback respond
  });

  B.whenEnterRoom(() => {
    if (!B.sound.isMusicPlaying()) B.sound.playMusic('apartment-theme');
  });

  B.region('darkness').whenEnter(() => B.player.say("It's dark over here."));
});
```

String ids passed to room handlers resolve in order: **props → hotspots → characters in this room → room points**. The same id you click is the id you handle.

Room scripts also support: `whenVerb(verbId, target, …)` for any configured verb, `whenGive(itemId, propId, …)`, `B.prop('id')`, `B.region('id')`, `B.hotspot('id').active`, per-room transition hooks (`whenEnterRoom`, `whenEnterRoomAfterFade`, `whenLeaveRoom`, `whenLoadedRoom`), `B.onUpdate`, and `B.playFrom('name', …)` entry points for the editor's "Play from here".

### Character script

A character's `*.character.ts` runs when that character is spawned in the active room. It holds verb handlers that belong to the character itself, written without a target id (the target *is* this character):

```ts
import { registerCharacterScript } from '@engine/scripting';

registerCharacterScript('penny', ({ B }) => {
  B.whenLookAt(() => B.player.say("It's Penny."));
  B.whenTalkTo(() => B.dialog('chatwithpenny').start());
});
```

When both a room script and a character script handle the same verb on a character, the room handler wins. Character scripts can also handle `whenInventoryUsedOn` when the target id equals the character's own id.

### Inventory script

An inventory item's `*.inventory.ts` runs each room load and defines what the item's verb rows do, plus the special `whenUse` / `whenGive` registrars that arm the item for "use on target":

```ts
import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Key', ({ B }) => {
  B.whenLookAt(() => B.player.say("It's the key to the front door."));
  B.whenUse(() => { /* runs, then the engine arms the item by default */ });
});
```

Even an empty inventory script works — the engine still arms `use` / `give` so the item can be used on world targets.

### GUI script

A GUI's `*.gui.ts` wires up the controls in a `*.gui.json` overlay. Register handlers at the top level; use `onGuiBuilt` for first-time setup once the overlay is constructed:

```ts
import { registerGuiScript } from '@engine/scripting';

registerGuiScript('game-menu', ({ B }) => {
  B.whenButtonClick('saveBtn', () => B.gui('save-menu').show());
  B.whenButtonClick('resumeBtn', () => B.gui('game-menu').hide());

  B.onGuiBuilt((gui) => {
    // initial paint / sync from game state
  });
});
```

GUI scripts can respond to `whenButtonClick`, `whenAnyButtonClick`, `whenCheckboxCheck` / `whenCheckboxUncheck`, slider `whenValueChanged`, text-input `whenSubmit`, and hover (`whenMouseEnter` / `whenMouseLeave`). They can read and drive any control via `B.gui('overlayId').control('controlId')`, and show or hide whole overlays. A common use is building a verb bar that reflects the active verb and the hover description.

### Dialog script

A dialog's `*.dialog.ts` runs when that dialog opens. Each option gets a `whenChoice` handler:

```ts
import { registerDialogScript } from '@engine/scripting';

registerDialogScript('chatwithpenny', ({ B }) => {
  B.whenChoice('greeting', () => {
    B.say`
      Hank: How's it goin?
      Penny: Oh, you know. Locked in, as usual.
    `;
  });

  B.whenChoice('door', () => {
    B.say`Penny: Bring me a sandwich and I'll give you the key.`;
    B.dialog('chatwithpenny').optionOff('door');
  });

  B.whenChoice('bye', () => B.dialog('chatwithpenny').stop());
});
```

You open a dialog from gameplay with `B.dialog('id').start()`, and toggle which topics are available with `optionOn` / `optionOff` to model conversation state.

## Speaking lines

Two ways to put words on screen:

- **`B.player.say('A line')`** (and `B.character('id').say(...)`) — one line from a specific speaker.
- **Tagged `B.say`** — a multi-speaker block, one `Speaker: text` per line. The speaker `Player` maps to the active player character; other names must match spawned character ids (case-insensitive).

```ts
B.say`
  Hank: Hey Penny!
  Penny: Hi!
`;
```

`B.display('...')` shows narration in a dedicated overlay (click to dismiss) for descriptive text that isn't spoken by a character.

## Cutscenes

Wrap a sequence in `B.cutscene(() => { … })` to suppress player input (clicks on props, hotspots, characters, GUI buttons, and background walks) for the duration, so a scripted beat plays out uninterrupted. Enter-room hooks and `whenChoice` handlers are wrapped in a cutscene automatically.

```ts
B.cutscene(() => {
  B.camera.zoomTo('villain', 1.5, 0.6);
  B.player.say('Look out!');
  B.camera.shake();
  B.camera.reset();
});
```

---

# Methods and Properties

The `B` facade exposes several namespaces. The exact set available depends on the script type (for example, `B.prop(...)` and room verb sugar exist only in room scripts), but the core members below are available almost everywhere.

## Core (`B`)

| Member | Description |
|--------|-------------|
| `B.wait(seconds)` | Pause the queue for the given time. |
| `B.say\`…\`` | Tagged multi-speaker dialogue (queued per line). |
| `B.display(text)` | Show narration in the display-text overlay (click to dismiss). |
| `B.fadeOut(seconds?, color?)` / `B.fadeIn(...)` | Full-screen fade to/from a color (default black, ~0.35s). |
| `B.cutscene(fn)` | Run `fn` with player input suppressed. |
| `B.walkToClicked()` / `B.faceClicked()` | Walk the player to / face toward the target the player just clicked (inside a verb handler). |
| `B.setActiveVerb(id)` / `B.getActiveVerb()` / `B.clearActiveVerb()` | Read/write the active verb. |
| `B.setActiveInventory(id)` / `B.clearActiveInventory()` | Arm/disarm an inventory item for "use on target". |
| `B.activeVerb` / `B.activeInventory` | The current verb / armed item definitions (or `null`). |
| `B.currentHoverDescription` | The hover label under the pointer (`null` when none). |
| `B.onUpdate(fn)` | Per-frame callback (room and global scripts only). |
| `B.raw` | Low-level event bus (`on` / `once` / `off` / `emit`) for advanced use. |

Most time- or order-sensitive members also offer a `.now` variant.

## `B.room`

| Member | Description |
|--------|-------------|
| `B.room.current` / `B.room.last` | Current and previous room ids. |
| `B.room.visitCount` / `B.room.isFirstVisit` | Persisted number of times the player has entered this room, and whether this is the first. |
| `B.room.changeTo(roomId)` | Transition to another room (queued; handles fade, cleanup, and lifecycle hooks). |

## `B.player`

Controls the active player character.

| Member | Description |
|--------|-------------|
| `B.player.id` | The active player character id. |
| `B.player.switchTo(id)` | Hand player control to another spawned character (rebinds camera, input, inventory panel). |
| `B.player.walkTo(target)` | Pathfind and walk to a point `{x, y}` or a target id. |
| `B.player.moveTo(target)` | Teleport (no walk). |
| `B.player.say(line, { clickToSkip? })` | Speak a line as the player. |
| `B.player.face('L' \| 'R' \| 'U' \| 'D' \| …)` | Face a direction. |
| `B.player.animation` / `playAnimation(tag)` / `stopAnimation()` | Override the current clip, play a one-shot, or return to idle. |
| `B.player.movable` | When `false`, walks are ignored (teleports still work). |
| `B.player.startFollowingCharacter(id, opts?)` / `stopFollowingCharacter()` | Follow another character. |
| `B.player.inventory` | The active player's inventory bag (same as `B.inventory`). |
| `B.player.setSpeechOffset(x, y)` / `setSpeechPosition(x, y)` / `resetSpeechPosition()` | Fine-tune where the player's speech text appears. |

Movement targets are either `{ x, y }` in room pixels or a string id resolving **prop → hotspot → character → room point**.

## `B.character(id)`

Same movement / speech / animation / follow pattern as `B.player`, for any character spawned in the room. Additional members:

| Member | Description |
|--------|-------------|
| `.hide()` / `.show()` / `.visible` | Visibility (persisted across room changes and saves). |
| `.clickable` | Whether the character is hit-tested for interaction. |
| `.movable` | Whether the character can pathfind-walk. |
| `.fade(from, to, seconds)` | Tween the sprite's alpha (final alpha persists). |
| `.inventory` | This character's own item bag. |
| `.startFacingCharacter(id, min?, max?)` / `stopFacingCharacter()` | Keep this character's idle facing toward another. |
| `.say(...)` | Speak a line (uses the character's `speechColor`). |

```ts
B.character('penny').say('Thank you!');
B.character('penny').startFollowingCharacter('hank', { minDistance: 60 });
B.character('penny').fade(0, 1, 0.5);
```

## `B.prop(id)`  <Badge type="info" text="room scripts" />

Controls a room prop (its sprite, animation, visibility, position).

| Member | Description |
|--------|-------------|
| `.hide()` / `.show()` / `.visible` | Visibility (persisted). |
| `.animation` / `animationNow(tag)` / `playAnimation(tag)` | Set the base clip, set it immediately, or play a one-shot then restore. |
| `.fade(from, to, seconds)` | Tween alpha (final alpha persists). |
| `.moveTo(point)` | Teleport the prop's authoring origin in room space. |
| `.description` | The prop's description text. |

```ts
B.prop('Door').animation = 'Door-open';
B.prop('Knife').hide();
```

## `B.region(id)` and `B.hotspot(id)`  <Badge type="info" text="room scripts" />

```ts
B.region('stage-front').whenEnter((ctx) => {
  if (ctx.isPlayer) B.player.say('Stepping into the light.');
});
B.region('darkness').active = false; // deactivate (persisted)

B.hotspot('secret-door').active = true; // mount/unmount its input zone (persisted)
```

Region enter/exit handlers run on the interaction queue. Setting `.active` on a region or hotspot is immediate and persisted; deactivating disables triggers and interaction (movement resolution still works).

## `B.inventory`

The active player's item bag, plus a callable accessor for per-item control.

| Member | Description |
|--------|-------------|
| `B.inventory.add(id, qty?)` / `remove(id, qty?)` | Add/remove items (queued; `.now` for immediate). |
| `B.inventory.has(id)` / `quantityOf(id)` | Query the bag. |
| `B.inventory.items` | The current list of `{ id, quantity }`. |
| `B.inventory(id).animation` | The item's icon clip (with a runtime override option). |
| `B.inventory(id).cursorAnimation` | The cursor clip shown when the item is armed. |

```ts
B.inventory.add('Key');
if (B.inventory.has('Broom')) { /* … */ }
```

## `B.state`

Mirrors the [GameStateManager](./core-concepts#game-state): flags, variables, room context, and saves. All synchronous.

| Member | Description |
|--------|-------------|
| `setFlag(id, value)` / `getFlag(id)` / `hasFlag(id)` / `clearFlag(id)` | Boolean/value flags. |
| `setVariable(id, value)` / `getVariable(id)` / `hasVariable(id)` / `clearVariable(id)` | Arbitrary persisted values. |
| `save(name, slot?)` / `load(nameOrSlot)` / `deleteSave(...)` / `renameSave(...)` / `getSaveList()` | Named save slots. |
| `exportJson()` / `importJson(json)` | Serialize/restore the whole state. |
| `getCurrentRoom()` / `getLastRoom()` | Room context. |

```ts
B.state.setFlag('metPenny', true);
if (!B.state.getFlag('unlockedDoor')) B.player.say("It's locked.");
```

## `B.dialog(id)`

| Member | Description |
|--------|-------------|
| `.start()` | Open the dialog session. |
| `.stop()` | End the active session. |
| `.optionOn(optionId)` / `.optionOff(optionId)` | Enable/disable a choice. |

## `B.sound`

Available everywhere (also as `B.player.sound`, `B.prop('id').sound`, etc.). Reference SFX by filename from `assets/audio/sfx/` and music from `assets/audio/music/`. For asset folders, voice markers, and video workflow details, see [Sound, Voice, and Video](./sound-voice-and-video).

| Member | Description |
|--------|-------------|
| `play(key, opts?)` | Play a one-shot SFX (queued so it runs after prior steps). |
| `playAndWait(key, opts?)` | Play and wait until it finishes before continuing. |
| `playMusic(key, { fadeSeconds?, sync?, loop? })` | Play looping music in the single music slot (replaces current; can crossfade). Persists for save/load. |
| `stop(key?)` / `stopMusic()` | Stop SFX (all, or by key) / stop music. |
| `setSfxVolume(v)` / `setMusicVolume(v)` / `getSfxVolume()` / `getMusicVolume()` | Session volume multipliers (persisted). |
| `isPlaying(key)` / `isMusicPlaying()` | Query playback. |

```ts
B.sound.play('doorClose');
B.sound.playMusic('outside-ambient', { fadeSeconds: 2 });
```

## `B.video`

Full-screen cinematics from `assets/videos/`. The HUD hides during playback; speech and display text remain on top. See [Sound, Voice, and Video](./sound-voice-and-video#video) for file placement, options, and VS Code codec notes.

| Member | Description |
|--------|-------------|
| `play(key, opts?)` | Start a cinematic (queued, then runs concurrently). |
| `playAndWait(key, opts?)` | Play and wait for it to finish. |
| `pause()` / `resume()` / `stop()` / `seek(seconds)` | Playback control. |
| `isPlaying()` | Query state. |

## `B.camera`

Scriptable camera; state resets on room change and load. Limits come from the `camera` block in `game-config.json`.

| Member | Description |
|--------|-------------|
| `focus(target, seconds?)` | Center on a target (suspends player follow). |
| `reset(seconds?)` | Restore default player follow and zoom. |
| `setZoom(zoom, seconds?)` / `resetZoom(seconds?)` | Gameplay zoom (clamped to config). |
| `zoomTo(target, zoom, seconds?)` | Focus + zoom together. |
| `shake(intensity?, seconds?, falloff?)` | Screen shake (fire-and-forget). |

## `B.speechSettings` and `B.dialogSettings`

Getter/setter properties (synchronous, persisted) that mirror the `speech` and `dialog` blocks in `game-config.json` — e.g. `B.speechSettings.clickToSkip`, `showText`, `msPerCharacter`, and `B.dialogSettings.usedColor`. Setting them at runtime (typically from a settings GUI) overrides the config defaults and is included in save data.

---

This page is an approachable tour of Bennescript. Combined with the example scripts in a new project (the room, global, dialog, and GUI scripts shipped with each template), it should be enough to build a complete game. The next page covers [updating BENNE](./updating-benne).
