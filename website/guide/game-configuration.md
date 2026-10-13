---
title: Game Configuration
outline: deep
---

# Game Configuration

Every BENNE game has a single configuration file at `src/game/game-config.json`. It defines the game's internal resolution, the set of verbs the player can use, how the cursor behaves, audio levels, speech timing, the starting room and character, and more.

This file is the engine's source of truth for these settings. The shipped game, the **BENNE Play** runtime, and the editor previews all read from it, so changing a value here changes it everywhere.

Below is a complete example, followed by an explanation of each section.

```json
{
  "name": "9-verb",
  "resolution": { "width": 352, "height": 198 },
  "verbs": [
    { "id": "give", "label": "Give", "preposition": "to" },
    { "id": "use", "label": "Use", "preposition": "with" },
    { "id": "look", "label": "Look at" }
  ],
  "inputProfile": {
    "primaryButtonVerb": "walkTo",
    "secondaryButtonVerb": "defaultVerb"
  },
  "dropWhenInventoryUsed": true,
  "cutscenesSkippable": true,
  "defaultFallbackLine": "That doesn't seem to work.",
  "startingPlayerCharacter": "hank",
  "startingRoomId": "apartment",
  "initialGameState": {
    "flags": {},
    "variables": {},
    "inventory": ["Broom", "Lantern", "Key"]
  },
  "audio": { "masterVolume": 1, "sfxVolume": 1, "musicVolume": 0.75, "dialogueVolume": 1 },
  "speech": { "clickToSkip": true, "showText": true, "msPerCharacter": 80, "minDurationMs": 800, "maxDurationMs": 4500, "durationMultiplier": 1, "defaultTalkOffset": { "x": 0, "y": 0 } },
  "dialog": { "choiceOptionsViewportHeightPx": 46, "usedColor": "#888888" },
  "perspective": { "minWalkScale": 0.1, "walkScalePower": 1.3 },
  "camera": { "minZoom": 0.5, "maxZoom": 2.5, "defaultTransitionSeconds": 0.4, "shake": { "intensity": 0.02, "durationSeconds": 0.35, "falloff": true } },
  "cursor": { "idleAnimation": "Idle", "activeAnimation": "Active", "hotspot": "center", "animations": { "Idle": { "loop": true }, "Active": { "loop": true } }, "display": { "aseprite": true } }
}
```

## Resolution

```json
"resolution": { "width": 352, "height": 198 }
```

`resolution` defines your game's **internal rendering size** in pixels. This is the low-resolution canvas your game is drawn into before being scaled up to fit the player's display.

BENNE is built for crisp, pixel-perfect retro rendering, so internal resolutions are deliberately small — classic adventure sizes like **320×240**, **352×198**, or up to **640×480** are typical. The engine renders with WebGL using `pixelArt` and `roundPixels`, then handles hi-DPI scaling and integer letterboxing automatically so your art stays sharp at any window size.

A few important points:

- **Author against this resolution.** Room backgrounds, prop placement, walkable polygons, hotspots, GUI layouts, and talk-point offsets are all expressed in these internal pixels.
- **Rooms can be larger than the screen.** A room's `size` (in its `*.room.json`) can exceed the internal resolution; the camera scrolls to follow the player within the room's `scrollBounds`.
- **Changing resolution affects everything.** If you change resolution after building content, existing layouts won't automatically re-flow — you'll be repositioning things. Pick your resolution early.

## Verb Setup

```json
"verbs": [
  { "id": "give",    "label": "Give",    "preposition": "to",   "usesItem": true },
  { "id": "pickUp",  "label": "Pick up" },
  { "id": "use",     "label": "Use",     "preposition": "with", "usesItem": true },
  { "id": "look",    "label": "Look at" },
  { "id": "talkTo",  "label": "Talk to" }
],
"defaultVerb": "look",
"inputProfile": {
  "primaryButtonVerb": "walkTo",
  "secondaryButtonVerb": "defaultVerb"
},
"dropWhenInventoryUsed": true,
"defaultFallbackLine": "That doesn't seem to work."
```

The `verbs` array defines **which verbs exist in your game**, and every verb handler in your scripts is named after one (`talkTo` → `onTalkTo`). A full 9-verb SCUMM bar, a two-verb scheme, or anything in between is just a different list. [Verbs](./verbs) covers all of this in depth; in short:

| Field | Description |
|-------|-------------|
| `verbs[].id` | The verb's name in scripts. Must start with a letter; `walkTo`, `defaultVerb`, `item`, `anyItem`, `combine` and `verbItem` are reserved. |
| `verbs[].label` | The text shown on verb buttons and in the hover line (“Use”). |
| `verbs[].preposition` | The joining word for item lines: “Use key **with** door”. |
| `verbs[].usesItem` | `true` for verbs that use an inventory item on something. Defaults to `true` when the verb has a `preposition`. |
| `defaultVerb` | What a "default verb" click does on something with no `defaultVerb` of its own. When omitted: `look` if the game has it, otherwise the first verb. |
| `inputProfile` | What the left (`primaryButtonVerb`) and right (`secondaryButtonVerb`) mouse buttons do on a target: a verb id, `walkTo` (walk to it) or `defaultVerb` (the target's default verb). See [What a click does](./verbs#what-a-click-does). |
| `dropWhenInventoryUsed` | When `true`, an item in the player's hand goes back to the inventory after it's used on something. When `false` or left out, it stays in hand so the player can try it on something else. Items can override it with `dropWhenUsed`. See [Verbs → When the item leaves the player's hand](./verbs#when-the-item-leaves-the-players-hand). |
| `defaultFallbackLine` | A catch-all line for a verb used on something with no handler anywhere. Scripts read it as `game.config.defaultFallbackLine`; the templates' `globalScript.ts` says it from `fallbacks.onAnyVerb` (see [Verbs → Fallbacks](./verbs#fallbacks)). |

Renaming or removing a verb turns every handler that used it into a type error, so nothing silently stops working.

## Cursor Setup

```json
"cursor": {
  "idleAnimation": "Idle",
  "activeAnimation": "Active",
  "hotspot": "center",
  "animations": {
    "Idle":   { "loop": true },
    "Active": { "loop": true }
  },
  "display": { "aseprite": true }
}
```

BENNE replaces the system cursor with a custom, animated, sprite-based cursor authored in Aseprite. The `cursor` block controls how it looks and behaves.

| Field | Description |
|-------|-------------|
| `idleAnimation` | The Aseprite tag used for the normal cursor (e.g. when just moving around). |
| `activeAnimation` | The tag used when the cursor is "active" — for example when hovering an interactive target. |
| `hotspot` | The cursor's click point. `"center"` aligns the hotspot to the middle of the sprite; you can also specify a pixel coordinate. |
| `animations` | Per-tag options such as `loop`, matching the Aseprite tags on your cursor sheet. |
| `display.aseprite` | Marks the cursor as an Aseprite-sourced sprite sheet. |

Individual inventory items can also override the cursor when armed (via their `cursorAnimation`), so “using the key on the door” can show a key-shaped cursor. See [Creating an inventory item](./creating-an-inventory-item#3-set-it-up) and [Verbs → Cursors](./verbs#cursors).

## Starting State

```json
"startingPlayerCharacter": "hank",
"startingRoomId": "apartment",
"initialGameState": {
  "flags": {},
  "variables": {},
  "inventory": ["Broom", "Lantern", "Key"]
}
```

These fields define where a brand-new game begins:

- **`startingPlayerCharacter`** — The `id` of the character the player controls at game start. This is also the default owner of the inventory bag.
- **`startingRoomId`** — The `id` of the first room loaded.
- **`initialGameState`** — Seeds the [GameStateManager](./core-concepts#game-state) at the start of a new game:
  - `flags` — initial flag values. Scripts read flags through the names declared in `src/game/state.ts` (see [BenneScript → Flags](./bennescript#flags-variables-and-visits)), whose defaults usually make this unnecessary.
  - `variables` — arbitrary persisted values.
  - `inventory` — item ids the player starts carrying.

## Audio

```json
"audio": { "masterVolume": 1, "sfxVolume": 1, "musicVolume": 0.75, "dialogueVolume": 1 }
```

`audio` sets the default volume levels (0–1). Effective playback volume for a sound is the **master volume × the category volume** (× any per-call multiplier). Players can adjust SFX and music volumes at runtime through settings GUIs; those session adjustments are persisted in save data and layered on top of these config defaults. See [Sound, Voice, and Video](./sound-voice-and-video) for asset folders, script calls, voice markers, and video notes.

## Speech

```json
"speech": {
  "clickToSkip": true,
  "showText": true,
  "msPerCharacter": 80,
  "minDurationMs": 800,
  "maxDurationMs": 4500,
  "durationMultiplier": 1,
  "defaultTalkOffset": { "x": 0, "y": 0 }
}
```

The `speech` block controls how spoken lines (`Hank: "…"`, `` say`…` ``, `penny.say(…)`) are timed and displayed:

| Field | Description |
|-------|-------------|
| `clickToSkip` | Whether timed speech lines can be clicked to advance by default. |
| `showText` | When `false`, line timing still runs but the speech text overlay stays hidden (useful for voice-only modes). |
| `msPerCharacter` | Base milliseconds per character used to compute how long a line is shown. |
| `durationMultiplier` | Multiplier applied to the computed duration (must be > 0). |
| `minDurationMs` / `maxDurationMs` | Clamp the shortest and longest a line can be displayed. |
| `defaultTalkOffset` | A default `{ x, y }` pixel offset for where speech text appears relative to a speaking character. |

All of these can be overridden at runtime under the same names, through `settings.speech` (`settings.speech.showText = false`), and the player's choice is kept with their settings. Individual `say` calls can also override `clickToSkip` per line: `player.say("…", { clickToSkip: false })`.

## Cutscenes

```json
"cutscenesSkippable": true
```

When `true` (the default), the player can press **ESC** during a cutscene to skip it. Skipping fast-forwards the cutscene instead of cancelling it: every scripted step still runs, but waits, speech lines, walks, fades, camera moves, and video finish instantly, so the game ends in exactly the state the cutscene would have produced.

Set it to `false` to make every cutscene in the game unskippable. For a single cutscene, pass `{ skippable: false }` to `cutscene(…)` (or to `room.onEnter` / `room.onEnterAfterFade` / `game.onEnterAnyRoom` / `game.onEnterAnyRoomAfterFade`), the same idea as `player.say('…', { clickToSkip: false })`. See [BenneScript → Cutscenes](./bennescript#cutscenes-and-skipping).

## Dialog

```json
"dialog": { "choiceOptionsViewportHeightPx": 46, "usedColor": "#888888" }
```

Settings for the SCUMM-style dialog choice UI:

- **`choiceOptionsViewportHeightPx`** — Caps the vertical space used to stack dialog choice rows (the rest scrolls/pages). A per-GUI override on a dialog choice `*.gui.json` takes precedence over this game-level value.
- **`usedColor`** — A hex color applied to dialog options the player has already chosen, so used topics visually dim. Omit it to fall back to a simple transparency dim.

## Perspective

```json
"perspective": { "minWalkScale": 0.1, "walkScalePower": 1.3 }
```

BENNE supports region-based perspective scaling: characters can shrink as they walk "away" (up the screen) and grow as they approach. The `perspective` block tunes the global curve:

- **`minWalkScale`** — The smallest scale a character can be reduced to.
- **`walkScalePower`** — The curve exponent controlling how sharply scale changes with depth.

Per-room regions define where and how strongly perspective applies; this block sets sensible global limits.

## Camera

```json
"camera": {
  "minZoom": 0.5,
  "maxZoom": 2.5,
  "defaultTransitionSeconds": 0.4,
  "shake": { "intensity": 0.02, "durationSeconds": 0.35, "falloff": true }
}
```

Defaults and limits for the scriptable camera (`camera.focus`, `camera.zoom`, `camera.shake`, etc.):

| Field | Description |
|-------|-------------|
| `minZoom` / `maxZoom` | Clamp the gameplay zoom range. `1.0` is the room default. |
| `defaultTransitionSeconds` | Default tween time for camera moves when a call omits an explicit duration. |
| `shake.intensity` / `shake.durationSeconds` / `shake.falloff` | Defaults used by `camera.shake()` when called without arguments. |

## Debug

Templates also include a `debug` block that toggles editor/development overlays (walkable areas, prop outlines, GUI outlines, region outlines). These help while authoring and don't affect a shipped build's gameplay.

```json
"debug": {
  "showWalkable": true,
  "showPropOutlines": false,
  "showGuiOutlines": false,
  "showRegionOutlines": true
}
```

---

Most of these values can also be edited through the BENNE Editor's inspectors rather than by hand. The next page covers the [BENNE Editor](./benne-editor) in detail.
