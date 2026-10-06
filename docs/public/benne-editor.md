---
title: BENNE Editor
outline: deep
---

# BENNE Editor

The **BENNE Editor** is a Visual Studio Code extension and the recommended way to build BENNE games. It gives you a visual tree of your entire game, live previews that render exactly like the shipped runtime, property inspectors, polygon editing, and one-click scaffolding for rooms, characters, GUIs, inventory items, dialogs, and puzzle charts.

While every piece of content is ultimately plain JSON and TypeScript that you *can* edit by hand, the editor removes the tedium: it places files in the right locations, keeps ids consistent, wires up script handlers, and shows you what your game looks like without leaving VS Code.

## Overview

When the extension is installed, a **BENNE** icon appears in the VS Code Activity Bar. Clicking it reveals the BENNE sidebar, which contains three views:

- **BENNE** (the main tree) — A structured outline of your whole game: rooms, characters, GUIs, inventory, dialogs, and puzzle charts, each expandable down to individual props, hotspots, regions, points, walkable areas, and controls.
- **Actions** — Buttons for rebuilding preview bundles (room, character, GUI, inventory, dialog/inspector, and BENNE Play), plus workspace-level helpers such as **Process Game Voice IDs**.
- **Inspector** — A webview panel that shows editable properties for whatever you've selected in the tree.

From the sidebar title bars and right-click context menus you can create new content, add elements to a room, scaffold script handlers, import from Aseprite tags, play from a room, update the engine, and delete entities.

::: tip Previews are the real renderer
The editor's previews use the **same** Phaser renderer configuration as the shipped game and BENNE Play. What you see in a room, character, GUI, or inventory preview is what your players see — same scaling, pixel snapping, and bitmap font rendering.
:::

## Main Treeview

The main **BENNE** tree is your map of the game. At the top is the workspace (your game project), and beneath it are grouped sections:

- **Rooms** — Each room expands to show its **props**, **hotspots**, **points**, **regions**, **walkable areas** (with holes), and **spawned characters**.
- **Characters** — Each character and its animations.
- **GUIs** — Each GUI and its controls.
- **Inventory** — Each inventory item.
- **Dialogs** — Each dialog and its options.
- **Puzzle Charts** — Each puzzle dependency chart.

### Working from the tree

Selecting a node populates the **Inspector** with its properties and (where relevant) opens or focuses the matching preview. Right-clicking a node offers context-appropriate actions, for example:

- On a **room**: Play from here, Add Prop, Add Hotspot, Add Point, Add Region, Add Walkable Area, Add Hole, Add Spawned Character, Add Play From method, Import Props from Aseprite Tags, Delete.
- On a **prop / hotspot / character**: add verb handlers (which edit both the JSON and the script), make it clickable, reveal or add an "item used on this" handler (`onAnyItem`), Delete.
- On the **workspace root**: Update Engine.

### Creating content

The tree's title bar and group context menus expose the **create** commands:

- **Create New Room**
- **Create Character**
- **Create GUI**
- **Create Inventory Item**
- **Create Dialog**
- **Create Puzzle Chart**

Each command scaffolds the JSON definition, a matching script file, and the folder structure, then adds the new entity to the tree.

### Filtering

For larger games, the tree supports a **filter**: use **Filter BENNE tree** to narrow it to matching entities, and **Clear BENNE tree filter** to reset.

## Inspector

The **Inspector** is a webview panel that edits the properties of the currently selected tree node. Instead of hand-editing JSON, you adjust fields and the editor writes valid changes back to the underlying definition file.

What the Inspector shows depends on the selection. Examples:

- **Room** — size, scroll bounds, and links to its sub-elements.
- **Prop** — id, Aseprite tag, animations, z-index, visibility, alpha, collider, walk-to point, look-at point, baseline, description, default verb, and clickability.
- **Hotspot / Region** — id, active state, polygon, walk-to / look-at points, descriptions; regions add tint and tint-alpha for atmospheric effects.
- **Character** — name, walk speed, feet/talk/walk-to points, animations, collider, speech color.
- **GUI control** — type-specific fields (text, font, colors, state tags, sizes, etc.).
- **Inventory item** — name, description, enabled verbs, stackability, animations, cursor animation.

A major convenience: from the Inspector and the tree, you can **scaffold script handlers** for an entity. For example, adding a "Use" handler to a prop edits the room JSON to mark the prop clickable *and* adds a `door.onUse(() => { … })` stub (with its imports) to the end of the room script, then reveals it so you can fill in behavior. You can also reveal an existing handler to jump straight to it.

The editor also helps while you write scripts: it completes every generated name (rooms, props, items, sounds, …), offers `Hank: ""` when you start a line with a character's name, completes animation tags and facing letters with their quotes, flags unknown speaker names as you type, and **Go to Definition** on a name like `battery` opens the JSON it came from.

## Rooms

Rooms are where most authoring happens, and the room preview is the editor's most powerful surface. Selecting a room opens a **live preview** of the room rendered with the actual engine, on top of which you can directly edit the room's geometry.

### Polygon editing

Most of a room's interactive geometry is defined as **polygons**, and you edit them visually in the preview:

- **Walkable areas** — Polygons describing where the player can walk. Each walkable area can contain **holes** (e.g. a table the player must walk around). The example apartment room defines a single walkable polygon with one hole.
- **Hotspots** — Clickable polygonal areas with no sprite of their own (a window, a sign, a patch of floor). Each can have a `walkToPoint` and `lookAtPoint`.
- **Regions** — Polygonal zones used for triggers (`regions.x.onEnter` / `onExit` in the room script), perspective scaling, and character tinting. A region can carry a `tint` and `tintAlpha` to darken or color characters standing in it.
- **Prop colliders** — The clickable shape of a prop (only when the prop is clickable).
- **Prop / hotspot baseline** — A horizontal line used for depth sorting against walking characters. Clickable props and hotspots show it alongside collider/polygon editing; **non-clickable props** still get this line so you can walk around scenery correctly.

You draw and reshape these polygons by dragging vertices in the preview, with real-time feedback. Debug overlays (configurable in `game-config.json`) can show walkable areas, prop outlines, and region outlines while you work.

### Props

Props are the room's sprites — furniture, doors, items, animated background elements. A prop references an **Aseprite tag** for its art and defines a z-index for layering, an optional baseline (for depth sorting against the player), a description, and — when clickable — a collider, a walk-to point, a look-at point, and an optional `defaultVerb`.

You can add props one at a time (**Add Prop**) or **Import Props from Aseprite Tags** to create multiple props at once from a tagged sheet.

### Points, spawned characters, and "Play From"

- **Points** are named room coordinates you can walk or move characters to by id.
- **Spawned characters** place character instances into the room (with position, initial facing, initial animation, visibility, and z-index).
- **Play From methods** let you define named entry points with setup code (e.g. "start here with the key already in inventory"), then launch the game from that state using **Play from here**.

## Characters

A character definition (`*.character.json`) describes a person/creature the engine can place in rooms and animate:

- **Identity** — `id`, `name`, `description`.
- **Movement** — `walkSpeed`, a `feet` anchor, a `walkToPoint`, and a `talkPoint` (where speech text appears).
- **Animations** — Directional Aseprite tags for idle, walk, and talk (e.g. `IdleL`, `WalkU`, `TalkD`), each with loop and frame-duration options. BENNE resolves the right directional clip from a base name plus facing.
- **Collider** — The clickable shape.
- **`speechColor`** — The color of this character's spoken text.
- **`clickable`** — Whether the character can be interacted with.

The **character preview** renders the character with its animations so you can verify tags, facing, and timing. Use **Import Animations from Aseprite Tags** to pull animation definitions directly from a tagged sheet.

One character is designated the player at game start (via `startingPlayerCharacter` in `game-config.json`), but you can switch control between characters at runtime with `player.switchTo(penny)`.

## GUIs

**GUIs** are JSON-defined overlays that sit on top of the game world — verb bars, inventory panels, dialog choice strips, menus (save/load/settings), and custom HUD elements. New projects ship with a working set of GUIs you can study and adapt.

A GUI (`*.gui.json`) has an `id`, a `name`, a default `visible` state, a `display` (for Aseprite-backed art), and an array of **controls**. Control types include:

- **image** — Static or 9-slice background art, with anchoring (e.g. to the screen).
- **button** — Clickable buttons with per-state Aseprite tags (`hover`, `pressed`, `disabled`), bitmap-font labels, colors, and per-state text colors.
- **checkbox**, **slider**, **listBox**, **textInput** — Standard interactive controls.
- **inventoryPanel** — A grid that displays the player's inventory with configurable rows/columns, slot sizes, spacing, scroll direction, and back/forward buttons.
- **text** — Bitmap-font text display.

The **GUI preview** renders the overlay live. You can add controls via **Add GUI Control** (from a GUI's context menu) and edit each control's properties in the Inspector.

Behavior lives in the GUI's script (`*.gui.ts`), where each control is a name you can use directly: `saveBtn.onClick(…)`, `musicVolume.onChange((v) => …)` for sliders and checkboxes, `saveName.onSubmit((text) => …)` for text inputs, `savedList.onSelect((i) => …)` for list boxes, and `gui.onShow(…)` for the GUI itself. See [BenneScript → GUIs](./bennescript#guis) for the full surface.

## Inventory

**Inventory items** (`*.inventory.json`) are the objects the player collects and uses. Each item defines:

| Field | Description |
|-------|-------------|
| `id` / `name` | Identifier and display name. |
| `description` | Optional flavor/look text. |
| `onVerb` | Which verbs the item row responds to (e.g. `look`, `use`). |
| `stackable` | Whether multiple copies stack into a quantity. |
| `animations` | Aseprite tags for the item's icon. |
| `display` | How the item's art is sourced (e.g. a shared Aseprite sheet). |
| `cursorAnimation` | The cursor clip shown when this item is armed for "use on target". |

The **inventory preview** renders item icons as they'll appear in an inventory panel. **Import Inventory Items from Aseprite Tags** lets you create many items at once from a tagged sheet.

Item behavior is written in the item's script (`*.inventory.ts`): verbs on its inventory row (`items.key.onLook(…)`) and other items used on it (`items.magnet.onCombine(items.antenna, …)`). Where an item is *used on a world target* (use the key on the door), that logic lives in the room or character script: `door.onUseItem(items.key, …)`. See [BenneScript → Inventory](./bennescript#inventory).

## Dialogs

**Dialogs** power branching conversations. A dialog definition (`*.dialog.json`) is intentionally simple: an `id`, a `displayName`, and a list of **options** the player can choose:

```json
{
  "id": "chatwithpenny",
  "displayName": "ChatWithPenny",
  "options": [
    { "id": "greeting", "text": "How's it goin?" },
    { "id": "door",     "text": "The door is locked. How do I get out?" },
    { "id": "bye",      "text": "Ok, bye!" }
  ]
}
```

The conversation logic lives in the dialog's script (`*.dialog.ts`), where each option gets a handler: `options.greeting.onChoose(…)`, or `onChooseOnce(…)` to remove the option once chosen. Inside a handler you write the back-and-forth as lines of dialogue (`Penny: "Hi!"`), show or hide other options with `options.door.on()` / `off()` to model conversation state, and end the conversation with `dialog.end()`. Options the player has already used are visually dimmed (color configurable via the `dialog.usedColor` setting).

You start a dialog from gameplay with `dialogs.chatwithpenny.start()`, for example from a character's "Talk to" handler; the handler waits there until the conversation ends. The choice UI itself is a normal GUI, so its appearance (including how many choices are visible before scrolling) is configurable. See [BenneScript → Dialogs](./bennescript#dialogs).

## Puzzle Dependency Charts

**Puzzle Dependency Charts (PDCs)** are a planning tool, not runtime content. Borrowed from the classic adventure-design technique, a PDC is a node-and-arrow graph that lays out the puzzles in your game and the dependencies between them — which steps must be completed before others become possible.

Create one with **Create Puzzle Chart**. The editor opens a graph editor where you add labeled nodes (e.g. "Get knife", "Use knife on bread to make sammich", "Give sammich to Penny to get key", "Use key on door") and connect them with directional edges. Nodes can be grouped (for example, by room) so you can see how puzzles cluster across your game.

Because a PDC captures the *intended* solution path and its prerequisites, it's invaluable for designing fair puzzles, spotting dead ends or softlocks, and keeping a large game's logic coherent. PDCs are stored as `*.pdc.json` alongside the rest of your content but have no effect on the running game.

## Previews and Rebuilding Bundles

The editor's live previews are powered by prebuilt bundles. In a standalone game project, you can rebuild them from the **Actions** view or via npm scripts when a preview looks stale after engine or content changes:

- `npm run build:room-preview`
- `npm run build:character-preview`
- `npm run build:gui-preview`
- `npm run build:inventory-preview`
- `npm run build:benne-play` (and `npm run watch:benne-play` for auto-reload)

The matching **Rebuild …** buttons in the Actions view trigger these for you. The room preview reloads automatically on a successful rebuild.

The Actions view also includes voice authoring helpers when nothing is selected in the main tree. **Process Game Voice IDs** scans `src/game/**/*.ts`, adds or rewrites `|number|` voice markers on supported `say` lines, and can show VS Code diffs before applying changes. **Export Speaking Text as CSV** writes those same supported speaking lines to a spreadsheet with Character, ID, Script, and Line columns. See [Sound, Voice, and Video](./sound-voice-and-video#process-game-voice-ids).

---

With your content created and inspected in the editor, the behavior that brings it to life is written in [BenneScript](./bennescript).
