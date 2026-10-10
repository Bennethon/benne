# Changelog

All notable changes to BENNE. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). BENNE has one version number, the extension's: it covers the editor, the engine and the game templates. Releases before 0.1.0 have their builds on the [GitHub releases page](https://github.com/Bennethon/benne/releases).

## [Unreleased]

### Added

- **State view** in the BENNE sidebar: your game's flags and vars, from `src/game/state.ts`, in two tables. Add one, change its default, rename it or delete it there and the editor writes `state.ts` for you. A rename changes every script that uses the name, and deleting one that scripts still use asks first.

### Changed

- **The Inspector moved to the Secondary Side Bar**, on the other side of the window from the BENNE tree, so the sidebar has room for the State view. **BENNE: Show BENNE Sidebar** opens both.
- **The BENNE Editor needs VS Code 1.106 or newer** (was 1.85), the first release that lets extensions add views to the Secondary Side Bar.

## [0.1.0] - 2026-10-09

### Breaking: game scripts are BenneScript

The `register*Script` / `B.` scripting API is gone. Game scripts are now **BenneScript**: TypeScript whose lines run in the order you write them without `await`, with a typed name for everything in your game (`battery`, `items.soda`, `sfx.sodaPour`) instead of quoted IDs, and dialogue written as ``Hank: `I hope this works.` ``. Read the [BenneScript guide](https://github.com/Bennethon/benne/blob/master/docs/public/bennescript.md) before updating an existing game.

**Updating a game made with 0.0.x:** after **BENNE: Update Engine**, scripts written for the old API no longer compile and have to be rewritten in BenneScript. Commit your game first so you can compare. Update Engine now also deletes engine files that the new engine no longer ships, including the old `src/engine/scripting/` folder and your game's `src/game/boot/` folder, whose loaders moved into the engine. Nothing else under `src/game/` is touched. See [Updating BENNE](https://github.com/Bennethon/benne/blob/master/docs/public/updating-benne.md).

### Added

- **Typed names for game content.** Each room, character, item, dialog and GUI gets a generated `.ids.ts` file, so a misspelt prop or sound is a red squiggle, not a silent bug.
- **Scripting features:** cutscenes the player can skip, running actions together or in the background, cancelling or finishing an action now (`task.cancel()`, `finishNow()`), `onUpdate` handlers, and fallbacks for interactions nothing else handles (`unhandled()`).
- **Editor help for scripts:** speaker name completions and checks, go to a handle's JSON definition, and offers of another room's handles (`outside.door`) with the import written for you.
- **Lint rules** in new games for the mistakes BenneScript can't catch while typing, such as `await` inside a handler.
- **Dialogue backticks:** typing a speaker name and a colon at the start of a line inserts `` `…` `` with the cursor inside (setting `benneEditor.dialogue.autoInsertBackticks`).
- **Room preview:**
  - Play from and Play stay at the left of the top bar in every mode.
  - New **Characters** and **Outlines** checkboxes show or hide those in the preview only.
  - A **Mute** checkbox starts BENNE Play without sound.
- **Character preview:** an **Animation** dropdown plays any tag on the character's sheet. Clips that don't loop in the game are marked "(once)".
- **Inspector:** a **+ playFrom** chip on a room starts the Play From wizard, and each existing `playFrom` has a chip that jumps to it.
- **New rooms, characters, items, GUIs, dialogs and puzzle charts** open in their editor layout straight away, and new scripts start with comments that explain what goes in the file.
- The extension is now MIT licensed.

### Changed

- Every create wizard asks for the name first and proposes an id from it, rooms included.
- Ids proposed for room content are shorter: a prop is `desk`, not `<room>-prop-desk`, and hotspots, points, regions and walkable areas start empty with an example. They only need to be unique within their room.
- When something has no description, the verb line shows its name, then its id, instead of just the verb ("Look at").
- Both game templates (2-click and 9-verb) are written in BenneScript, with dialogue in backticks.

### Fixed

- Turning a region or walkable area on or off from a script no longer changes the room's authored default for the rest of the session. Before, a New Game or a save made before the change could load with the wrong value.
- Inspector edits to a JSON file that is open in an editor tab now save through VS Code, so they no longer cause save conflicts.
- The 2-click template no longer lists four rooms that don't exist.
