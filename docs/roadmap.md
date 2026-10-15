# BENNE roadmap

Open work and ideas, gathered from the October 2026 reviews (now in [`docs/history/`](history/README.md)) so they can be found without reading old reports. Each item says where it came from; the source has the full reasoning.

This is a list, not a plan: nothing here is scheduled. Check an item against the code before starting it, and remove it here when it's done. Last checked against the code on 2026-10-07.

Sources: **ER** = [engine review](history/2026-10-03-engine-review.md), **CS** = [Codex suggestions](history/2026-10-03-codex-suggestions.md), **FS** = [feasibility study](history/2026-10-05-feasibility-custom-language-and-native-editor.md), **BS** = [BenneScript design record](bennescript-ergonomics-refactor.md).

## Correctness and data safety

- **Save files aren't tied to a game.** Keys are `benne-save-<slot>`, so two BENNE games on one origin share saves. `cloneSnapshot` copies `variables` shallowly, so nested values are shared between a snapshot and live state. Game-content migrations are separate from the engine's save version. (CS 3)
- **Generated-ID requests during a run are dropped.** `runGenerateGameIds` returns the running promise without queuing another run, so an edit that lands mid-run can leave handles stale until the next edit. (CS 5)
- **Engine updates can't tell an author's edit from an old engine file.** No record of installed file hashes; no staged or recoverable update. (CS 4)

## BenneScript follow-ups

- **Timed actions other than walks don't honour `task.cancel()` / `finishNow()` from a script**: camera moves, speech, one-shot animations and fades create their tasks without hooks. Cutscene skip still works for them, through the scene. (2026-10-07 review, finding 3)
- **`gui.onAnyClick` on a button with no `onClick`** runs right after another listener on the same click loads a save. A firm rule would need the button runtime to record the cancellation generation when the click fires. (2026-10-07 review, finding 4 follow-up)
- **Revisit later** (BS decision table): save snapshots so players can save mid-interaction (decision 2); per-handler interrupt opt-outs (decision 1).

## Architecture

- **Distribute the engine as a versioned package** instead of copying source into each game. (ER 2.1, CS 4)
- **Break up `RoomScene.ts`** (about 6,400 lines) into systems with their own lifecycles, one at a time. (ER 2.3, CS 9)
- **Replace module-level singletons with a per-game runtime context** (`gameEvents`, active game, state manager, registries). (ER 2.4, CS 8)
- **Typed event bus.** `EventBus` is an untyped `Phaser.Events.EventEmitter` with string-built names. BenneScript's `events` already has an `EventName` union for engine events. (ER 2.5)
- **One schema for content JSON**, generating types, validation and editor IntelliSense. There is no schema library today. (ER 2.6, CS 6)
- **Phaser is pinned to `4.0.0-rc.7`.** Track 4.0 stable; keep the copied shader code behind a small adapter with a visual check. (ER 2.7, CS 14)
- `src/engine/Room.ts` is an unused placeholder. (ER 2.7)

## Editor

- **One Vite dev server with HMR for previews and BENNE Play**, instead of five prebuilt bundles. (ER 4.1)
- **Inspector**: `inspectorMain.ts` is about 3,950 lines of string-built HTML; host and webview messages have no shared typed contract. (ER 4.2, CS 13)
- **Workspace content index** so a change refreshes only what it affects. Script parsing is already syntax-aware (`benne-editor/src/bennescript/scriptModel.ts`). (CS 12)
- **State view: the "new var" field keeps its name after adding.** Typing a name and pressing Enter adds the var to `state.ts`, but the name stays in the field. Likely cause: `submit()` in `benne-editor/src/state/stateMain.ts` clears the draft and calls `render()` while the field still has focus, and `render()` puts the focused input's text back. The flag row probably does the same. (Seen while taking the BENNE Editor guide's screenshots, 2026-10-14)
- **Extension structure**: `extension.ts` is about 1,750 lines; `package.json` still lists 47 `onCommand:` activation events that VS Code generates itself; `benne-editor/vsc-extension-quickstart.md` is leftover. (ER 4.5)

## Performance (measure first)

- Depth sorting runs every frame (`updateRoomStackDepths` in `RoomScene.update`). (ER 5, CS 11)
- Pathfinding rebuilds its graph on every walk; no cache keyed on the walkable and region set. (ER 5, CS 11)
- Every SFX, music and voice file is queued at boot (`queueBenneAudioBoot`). (CS 10)

## Process

- One release version and changelog (root `package.json` is `0.0.0`, the extension `0.0.11`). (ER 6)
- Tool versions differ between the root and the extension: ESLint 10 and 9, `@types/node` 26 and 22. (ER 6)
- Tests for authoring journeys, engine upgrades and the packaged VSIX. (CS 16)

## Ideas

Larger features, not commitments. See the sources for detail.

- Executable puzzle dependency charts: solvability checks, live progress, hints. (ER 7.1, CS)
- Record and replay; playtest bug bundles. (ER 7.2, CS)
- Developer console and time travel in BENNE Play; an interaction debugger that shows why a click did what it did. (ER 7.3, CS)
- Scenario-based Play From fixtures. (CS)
- Visual effects: palette cycling, transitions, CRT filter (`src/engine/postfx/PostEffects.ts` is a placeholder). (ER 7.4)
- Localisation and a voice workbench, building on voice IDs. (ER 7.5, CS)
- Accessibility and player comfort settings. (ER 7.6, CS)
- Authoring helpers: unhandled-interaction report, Aseprite live link. (ER 7.7)
- Platform reach: PWA, Steam, mobile. (ER 7.8)
- More interaction schemes as templates: verb coin, parser, keyboard/gamepad. (ER 7.9)
- Reusable prefabs; a plugin API. (ER 7.10, CS)
- A narrative or cutscene DSL (or Ink/Yarn), and a standalone authoring app. Both were set aside in favour of the BenneScript refactor; see the feasibility study's decision gates. (FS)
