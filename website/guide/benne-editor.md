---
title: BENNE Editor
outline: deep
---

# BENNE Editor

The **BENNE Editor** is a Visual Studio Code extension and the recommended way to build BENNE games. It gives you a visual tree of your entire game, live previews that render exactly like the shipped runtime, property inspectors, polygon editing, a puzzle chart editor, and one-click scaffolding for rooms, characters, GUIs, inventory items, dialogs and handlers.

While every piece of content is ultimately plain JSON and TypeScript that you *can* edit by hand, the editor removes the tedium: it places files in the right locations, keeps ids consistent, wires up script handlers, and shows you what your game looks like without leaving VS Code.

This page is a tour of the editor itself. For step-by-step guides to making each kind of content, see:

- [Creating a room](./creating-a-room): art, props, walkable areas, hotspots, points, regions and characters.
- [Creating a character](./creating-a-character): animations, feet, talk points and placing them in rooms.
- [Creating an inventory item](./creating-an-inventory-item): icons, combining and using items.
- [Creating a dialog](./creating-a-dialog): options, replies and branching conversations.
- [Creating a GUI](./creating-a-gui): controls, fonts and menus.
- [Puzzle dependency charts](./puzzle-dependency-charts): planning puzzles in the chart editor.

## Overview

<DocShot src="/images/benne-editor/overview.webp" alt="VS Code with the BENNE Editor open on the 9-verb template's apartment room: the BENNE tree, Actions and State views on the left, the room preview above the room script in the middle, and the Inspector on the right." :width="1600" :height="1000" caption="The 9-verb template with its apartment room selected: its preview, its script and its properties open together." />

When the extension is installed, a **BENNE** icon appears in the VS Code Activity Bar. Clicking it reveals the BENNE sidebar, which contains three views:

- **BENNE** (the main tree): a structured outline of your whole game: rooms, characters, GUIs, inventory, dialogs and puzzle charts, each expandable down to individual props, hotspots, regions, points, walkable areas and controls.
- **Actions**: buttons for rebuilding preview bundles, plus workspace-level helpers such as **Process Game Voice IDs**.
- **State**: your game's flags and variables, with their defaults (see [State](#state)).

The **Inspector**, which shows editable properties for whatever you've selected in the tree, sits on the other side of the window in the **Secondary Side Bar**. Selecting something in the tree opens the Secondary Side Bar on the Inspector if it's closed or showing another view, such as Chat. Turn that off with the `benneEditor.layout.revealInspector` setting. **BENNE: Show BENNE Sidebar** opens both. Like any VS Code view, you can drag any of them somewhere else.

::: tip Previews are the real renderer
The editor's previews use the **same** Phaser renderer configuration as the shipped game and BENNE Play. What you see in a room, character, GUI, or inventory preview is what your players see: same scaling, pixel snapping, and bitmap font rendering.
:::

## The BENNE tree

<DocShot src="/images/benne-editor/tree.webp" alt="The BENNE tree: filter and create buttons in its title bar, then Game Config, Global Script, and Rooms with the apartment expanded to its walkable areas, hotspots, props, characters and regions. The Door prop is selected." :width="350" :height="880" caption="The apartment expanded, with its Door prop selected.">

The main **BENNE** tree is your map of the game. At the top is the workspace (your game project), and beneath it:

- **Game Config** opens `game-config.json` (see [Game configuration](./game-configuration)).
- **Global Script** opens `globalScript.ts`, home of the [fallbacks](./verbs#fallbacks).
- **Rooms**: each room expands to its **props**, **hotspots**, **points**, **regions**, **walkable areas** (with their holes) and **characters**.
- **Characters**, **GUIs** (with their controls), **Inventory**, **Dialogs** and **Puzzle Dependency Charts**.

### Selecting things

Selecting something in the tree arranges the window for it: its preview opens on top, its script underneath, and its properties in the Inspector. Selecting a prop, hotspot or region inside a room selects it in the room preview too, ready to edit. Selecting something new closes the editors that were open for the previous selection. With `benneEditor.layout.closePanelOnOpen`, it also closes the bottom panel to give the preview and script the full height.

</DocShot>

### Creating and changing content

Right-click a node for what you can do with it:

| Right-click | To |
|---|---|
| The workspace, or a group (**Rooms**, **Characters**, …) | Create a room, character, GUI, inventory item, dialog or puzzle chart. These are also in the BENNE view's title bar. |
| A room | Play from here, add a prop, hotspot, point, region, walkable area, hole, character or Play From setup, import props from the room's Aseprite tags, open its art folder. |
| A walkable area | Add another walkable area or a hole. |
| A character | Import animations from Aseprite tags, open its art folder. |
| **Inventory**, or an item | Import inventory items from Aseprite tags. |
| A GUI | Add a control, open its art folder. |
| Almost anything | **Delete…**. The editor tells you where scripts still use it first. |
| The workspace | **Update Engine** (see [Updating BENNE](./updating-benne)). |

Each create command makes the JSON, the script and the art folder in the right places, and regenerates the [script names](./bennescript#names-and-imports) so the new thing can be used straight away.

<DocShot src="/images/benne-editor/context.webp" alt="The right-click menu on a room: Play from here, then Add Hole, Hotspot, Play From method, Point, Prop, Region, Spawned Character and Walkable Area, Import Props from Aseprite Tags, Open Assets Folder, and Delete." :width="368" :height="342" caption="Right-clicking a room." />

### Filtering

For larger games, the tree supports a **filter**: use **Filter BENNE tree** in its title bar to narrow it to matching entities, and **Clear BENNE tree filter** to reset.

## Inspector

<DocShot src="/images/benne-editor/inspector.webp" alt="The Inspector showing the Door prop: position, visibility, z-index, baseline, parallax, alpha, clickable, displayed tag, description and default verb, then a chip for each verb, and Save and Open raw JSON buttons." :width="292" :height="933" caption="The Inspector for the apartment door." legend="⚡ The door has a handler for this verb. Click to jump to it.|+ No handler yet. Click to add one.|Write your changes to the JSON, or open the file.">

The **Inspector** edits the properties of whatever is selected in the tree. Instead of hand-editing JSON, you change fields and the editor writes valid changes back to the definition file, when you leave a field or click **Save**. **Open raw JSON** shows the file itself.

What the Inspector shows depends on the selection:

- **Room**: its size and scroll bounds, buttons for its `onEnter`, `onEnterAfterFade`, `onLoaded` and `onUpdate` hooks, and its Play From setups.
- **Prop**: tag, animations, z-index, visibility, alpha, collider, walk-to and look-at points, baseline, description, default verb and clickability.
- **Hotspot / Region**: active state, polygon, walk-to and look-at points and description; regions add scaling, tint and their onEnter and onExit handlers.
- **Character**: name, walk speed, feet, talk and walk-to points, animations, collider and speech colour.
- **Inventory item**: name, description, stacking, animations and cursor.
- **Dialog**: its options, which you can add, edit, reorder and remove.
- **GUI and GUI controls**: type-specific fields (text, font, colours, state tags, sizes and so on).

### Adding handlers from the Inspector

The Inspector writes script handlers as well as JSON. Selecting a prop, hotspot, character or item shows a [verb chip](./verbs#verbs-in-the-editor) for each verb in your game: **⚡** means a handler exists (click to jump to it) and **+** means it doesn't (click to add one). For example, clicking **+ use** on a prop marks it clickable in the room JSON *and* adds a `door.onUse(() => { … })` stub, with its imports, to the end of the room script, then shows it to you. Rooms, regions, dialog options and GUI controls have the same kind of buttons for their own handlers (`onEnter`, `onChoose`, `onClick`, …).

</DocShot>

### Writing scripts

The editor also helps while you write scripts:

- It completes every generated name: rooms, props, items, sounds, verbs, dialog options and GUI controls.
- Typing a character's name and a colon at the start of a line (`Hank:`) inserts backticks for the line of dialogue and puts the cursor inside. Turn this off with `benneEditor.dialogue.autoInsertBackticks`.
- It completes animation tags and facing letters with their quotes, and flags unknown speaker names as you type.
- **Go to Definition** on a name like `couch` opens the JSON it came from.

<DocShot src="/images/benne-editor/script.webp" alt="The apartment room script with a completion list open after items., listing bread, broom, key, knife, lantern, pb and sammich. Lines of dialogue such as Hank: `Hey Penny!` are boxed." :width="896" :height="465" caption="Completing `items.` lists every inventory item in the game." />

## State

<DocShot src="/images/benne-editor/state.webp" alt="The State view: a Flags table with unlockedDoor and turnedOnFountain and a new flag row, and a Vars table with knocks, a num with default 0, and a new var row." :width="350" :height="330" legend="Open the entry in `state.ts`, or delete it.|Type a name and press Enter to add a flag.|Each var has a type: `text`, `num`, `bool` or `json`.">

The **State** view lists the flags and variables declared in `src/game/state.ts` (see [BenneScript → Flags, variables and visits](./bennescript#flags-variables-and-visits)) in two tables, **Flags** and **Vars**, each with a name and a default value. Whatever you do in the tables is written to `state.ts` for you:

- **Add** a flag or var in the last row of its table: type a name and press Enter. A var also takes a type (`text`, `num`, `bool`, or `json` for a list or object) and a default. If the game has no `state.ts` yet, the first one you add creates it.
- **Change a default** with the checkbox or field next to it.
- **Rename** by clicking a name. The rename goes through TypeScript, so every `flags.oldName` in your scripts changes with it. A flag is saved under its name, so renaming one that players already have in their saves also needs `flag(…, { saveKey: 'oldName' })` in `state.ts` to keep those saves.
- **Delete** with the ✕ that appears when you point at a row. If scripts still use it, the editor tells you where before deleting it.
- **↗** opens `state.ts` at that entry, and the button in the view's title bar opens the file.

Comments and the order of entries in `state.ts` are kept. An entry whose value isn't a plain value (a function call, say) is shown greyed out; edit it in `state.ts`.

</DocShot>

## Previews

Each kind of content has a live preview, rendered by the game engine:

| Preview | Opens when you select | What you do there |
|---|---|---|
| **Room** | A room or anything in it | Draw walkable areas, hotspots, regions and colliders; place props, points and characters; drag baselines. See [Creating a room](./creating-a-room). |
| **Character** | A character | Play any animation; drag the feet, walk-to point, talk point and collider. See [Creating a character](./creating-a-character#4-set-the-feet-walk-to-point-talk-point-and-collider). |
| **GUI** | A GUI or a control | See the GUI as the game draws it; move controls. |
| **Inventory** | An inventory item | See its icon as an inventory panel shows it. |
| **Puzzle chart** | A puzzle chart | Edit the chart. See [Puzzle dependency charts](./puzzle-dependency-charts#using-the-editor). |

In the room and character previews, the mouse wheel zooms around the pointer, a middle-button drag pans, and **F** fits everything back in view. Geometry you change in a preview is written to the JSON when you click **Save to JSON** in the preview's toolbar; until then it is only in the preview. The toolbar's hint line says what you can do with the current selection.

The room preview's top bar also has **GUIs**, **Characters** and **Outlines** checkboxes, which show or hide the HUD, the room's characters, and the walkable area, region and collider outlines. They only change the preview, never the room.

<DocShot src="/images/benne-editor/preview.webp" alt="The room preview with Outlines on and the door selected: the Play from menu, Play button and Mute checkbox, Save to JSON, the GUIs, Characters and Outlines checkboxes, and the door collider with its walk-to and look-at points." :width="896" :height="566" caption="The apartment with Outlines on and the door selected: drag its collider (magenta), walk-to point (cyan) and look-at point (amber), then click Save to JSON." />

## BENNE Play

**BENNE Play** runs your whole game in a VS Code tab, with the full runtime: walking, scripts, dialogs, saving and all. The room preview's top bar always has two buttons for it on the left:

- **Play** starts the game from its starting room, as a new player would.
- **Play from** starts in the current room. Its menu lists the room's **Play From** setups, which put the game into a prepared state first, such as "the player already has the key". You write them in the room script with `playFrom('gotKey', () => { … })`; the room Inspector's **+ playFrom** button adds one. See [Creating a room → Test it](./creating-a-room#11-test-it).

Tick **Mute** beside **Play** to playtest without sound. Right-clicking a room in the tree and choosing **Play from here** does the same as **Play from**.

While BENNE Play is open, its bar has an **Inventory** menu and a **Give** button that put any item straight into the player's inventory, for testing a puzzle without fetching its pieces. While it is open, BENNE Play rebuilds when you save a script or content file and restarts from where you launched it, so you can change a line and try it again straight away.

<DocShot src="/images/benne-editor/play.webp" alt="BENNE Play running the 9-verb template in a VS Code tab: Penny says Hi! to Hank in the apartment, above the nine-verb bar and inventory. An Inventory menu and Give button sit above the game." :width="896" :height="566" caption="BENNE Play, mid-conversation." />

## Rebuilding preview bundles

The editor's live previews are powered by prebuilt bundles. In a standalone game project, you can rebuild them from the **Actions** view or via npm scripts when a preview looks stale after engine or content changes:

- `npm run build:room-preview`
- `npm run build:character-preview`
- `npm run build:gui-preview`
- `npm run build:inventory-preview`
- `npm run build:benne-play` (and `npm run watch:benne-play` for auto-reload)

The matching **Rebuild …** buttons in the Actions view trigger these for you, and **Rebuild Editor Preview Bundles** in the BENNE view's title bar rebuilds them all. The room preview reloads automatically on a successful rebuild. With `benneEditor.roomPreview.autoRebuildOnGameConfigChange`, the room preview also rebuilds itself when `game-config.json` changes.

<DocShot src="/images/benne-editor/actions.webp" alt="The Actions view with nothing selected: Process Game Voice IDs, Export Speaking Text as CSV, and a Rebuild button for the room, character, GUI, inventory and dialog/Inspector bundles." :width="346" :height="206" caption="The Actions view when nothing is selected in the tree." />

## Voice tools

The Actions view also includes voice authoring helpers when nothing is selected in the main tree. **Process Game Voice IDs** scans `src/game/**/*.ts`, adds or rewrites `|number|` voice markers on lines of dialogue, and can show VS Code diffs before applying changes. **Export Speaking Text as CSV** writes those same lines to a spreadsheet with Character, ID, Script and Line columns. See [Sound, voice and video](./sound-voice-and-video#process-game-voice-ids).

## Settings

| Setting | What it does |
|---|---|
| `benneEditor.layout.revealInspector` | Open the Secondary Side Bar on the Inspector when you select something. On by default. |
| `benneEditor.layout.closePanelOnOpen` | Close the bottom panel (Terminal, Output, Problems) when an item opens, so the preview and script get the full height. |
| `benneEditor.dialogue.autoInsertBackticks` | Insert backticks after `Hank:` at the start of a line in a script. |
| `benneEditor.roomPreview.autoRebuildOnGameConfigChange` | Rebuild the room preview when `game-config.json` changes. |
| `benneEditor.roomPreview.autoRebuildDebounceMs` | How long to wait after the last change before that rebuild starts. |

---

With your content created and inspected in the editor, the behavior that brings it to life is written in [BenneScript](./bennescript).
