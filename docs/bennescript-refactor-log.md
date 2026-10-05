# BenneScript refactor: progress log

One entry per phase (see §14 of `docs/bennescript-ergonomics-refactor.md`). Newest last.

---

## Phase 0: Setup & baseline (2026-10-05)

### Done

1. **Branch** `bennescript-refactor` from `main` (done before this session).
2. **Standing instructions** from §14.2 are in `CLAUDE.md` (done before this session).
3. **AI Apocalypse content** copied into `src/game/` without `boot/` (commit `76e7395`, done before this session). In this session it type-checks, passes `validate:content`, builds for production, and plays from the title screen to the credits on the dev server and in BENNE Play. The content needed no changes.
4. **Engine-level test hooks** in `src/engine/testing/benneTestHooks.ts`, installed on `window.__BENNE_HOOKS__`. The game entry (`src/main.ts`) and BENNE Play (`src/editor/play/bennePlayMain.ts`) load them by dynamic import only when `import.meta.env.DEV` or `VITE_BENNE_TEST_HOOKS=true`. A production build contains no hook code (checked).

   | Hook | What it does |
   |---|---|
   | `state()` | Room, `phase` (`busy` / `world` / `dialog`) and how long it has held, open dialog, flags, variables, inventory, active verb and item |
   | `verb(verbId, targetId)` | Sets the active verb as the verb bar does, then clicks the prop / hotspot / character |
   | `useItem(itemId, targetId)` | Arms Use + the item as the inventory panel does, then clicks the world target |
   | `combine(itemId, targetItemId)` | Same, but clicks the target item's inventory slot, paging the panel as needed |
   | `walkTo(target)` | Clicks a target (walk-to), or the room background at a named point / region centre / `{x, y}` |
   | `choose(optionId)` | Clicks the dialog option's button, scrolling the option list as needed |
   | `clickGui(guiId, controlId)` | Clicks a GUI button (e.g. the title screen's New Game) |
   | `skipLine()`, `setAutoSkip(on, ms)` | Left-click to skip the current speech line (click-to-skip) |
   | `prop(id)` | Visible / current animation, for assertions |

   Every action emits a synthetic primary pointer event on the real game object (prop sprite, hotspot zone, character sprite, GUI button container, inventory slot, or the room's background input). Everything after Phaser's hit test is the real click path. No hook calls the scripting API.

   "Idle" means: no room transition, cutscene, player walk, speech line or click-to-skip, no input block, **and no running interaction** (see the next section). `phase` is recomputed on every `state()` call and every frame.

5. **`npm run test:playthrough`** (`playwright.playthrough.config.ts`, `tests/playthrough/`):
   - `playthrough.spec.ts` plays the whole game, title screen → credits → back to the title, using only the hooks. It asserts room, flags and inventory at every puzzle step (about 90 assertions). Speech is click-skipped after 250 ms, except during the three long cutscenes, which play at natural speed. Those are cut from the run's video into `test-results/playthrough/cutscenes/{lab-first-visit,plaza-first-visit,finale}.webm` and attached to the HTML report (`playwright-report/playthrough/`). Clipping needs `ffmpeg` on PATH; without it the full video and the segment timestamps are still attached.
   - `play-from.spec.ts` finds every `playFrom('<name>'` in `src/game/rooms/*/*.room.ts` (10 entries), starts each in BENNE Play (`/benne-play.html` on the dev server, with `__BENNE_START_ROOM_ID` / `__BENNE_PLAY_FROM_NAME` injected as the extension does), and checks that it reaches idle with no errors and no "Play From" warnings. The regex matches the new API's `playFrom('name', …)` too.
   - Both fail on page errors, console errors, failed requests and HTTP ≥ 400. One known console error is ignored (see Known issues).
   - `docs/testing.md` lists the new command.
6. **Existing tests**: nothing broke, so nothing was fixed, replaced or skipped:
   - `tests/e2e/gameplay.spec.ts` still passes. The spec expected it to break, but it runs the isolated fixture game in `tests/fixtures/game` (only `src/game/boot` is copied from the real game), so the content swap does not affect it.
   - `tests/fixtures/content-baseline.json` is unchanged. `validate:content` reports 0 new errors; the 4 baseline entries are the 2-click template's missing rooms, which were not touched.
   - Prebuilt BENNE Play bundle (`benne-editor/media/benne-play/`): rebuilt with `npm run build:benne-play` so the extension's BENNE Play runs AI Apocalypse on the current engine. These generated files account for the large `benne-editor/media` diff.
   - Results: see "Exit checks" below.
7. This log.

### Engine changes (no scripting API changes)

All of these are additive. They keep the old `register*Script` / `B` behaviour.

- **`src/engine/interaction/interactionActivity.ts` (new): engine-level interaction activity registry.** Without it, "idle" cannot be detected reliably: a handler sitting in `B.wait(1)` looks exactly like a game waiting for the player. Script runtimes report each handler; the hooks only read the registry.
  - `BenneScriptCore.subscribe` / `subscribeAfterInteractionTail` begin an activity per handler and end it when the handler's queue drains.
  - `chain()` carries the queuing interaction into each step (`runInInteraction`). `RoomScene.walkPlayerToWorldPoint` records which interaction started a player walk. If that walk is interrupted outside a cutscene, the interaction ends. **This is needed because the old runtime never settles a handler whose walk was interrupted.** For example, in lab27, *Take banana* walks Hank into `bananaGuard`, the region handler calls `moveTo.now`, and the banana handler's promise hangs forever. Its remaining steps never run, so treating it as over matches what the player sees.
  - `RoomTransitionOrchestrator.prepareForLeave` clears the registry, alongside the existing interaction-tail resets.
  - Recorded as decision 12 in §13 and as a row in §10. **Phase 2: the new InteractionContext must report to this registry, run its steps in `runInInteraction`, and end its activity on completion and on cancellation.** Otherwise `test:playthrough` will hang on new-API handlers, or treat them as idle too early. The save policy (decision 2) can reuse it.
- `RoomScene`: read-only accessors for the hooks, `hasScriptedDialogClickToSkip()`, `getClickTargetObjectForTesting()`, `getInputStateForTesting()`, `getRoomDataForTesting()`, plus the walk-interaction bookkeeping above.
- `buildGuiButton` tags each button hit container with `{ guiId, controlId }` (`BENNE_GUI_BUTTON_ID_DATA_KEY`) so hooks can find GUI buttons, including dynamic dialog option rows (`dc__<optionId>`).

### Deviations from the spec

- Decision 12 (interaction activity registry), as above. §10 and §13 are updated.
- §14.4's list of expected breakage was wrong for `gameplay.spec.ts` and `content-baseline.json` (see step 6). No spec change needed; it was a prediction, not a design.
- The hooks go beyond the five listed in §14.4: they add `walkTo`, `combine`, `clickGui`, `skipLine` / `setAutoSkip` and `prop`. The game needs all of them: region exits, item-on-item, the title screen, and a run time of minutes instead of more than half an hour.

### Known issues (not regressions)

- **`[Benne] GUI text references unknown font id ""`**, logged as a console error at boot. Icon-only buttons use `"font": ""`, which `buildGuiButton` treats as "no label", but `src/game/boot/queueGuiFontsForBootLoader.ts` still reports it. The same happens in the original AI Apocalypse and in both templates (`9-verb/guis/verbs`, `*/guis/dialog`). It was not fixed here because changing `src/game/boot` would break boot/template parity (`test:artifacts`), and template sync is off-limits on this branch. The playthrough ignores exactly this message. **Fix in Phase 6** (skip blank font ids in the boot loader, then sync the templates).
- Dev-only console warnings, harmless: `opening-text` GUI has no Aseprite sheet; `title-buttons` sheet has no frame tags; no `give` verb for the `give` alias (the alias list goes away in §8); `AnimationManager key already exists: cursor:*` on every room load; one room-stack baseline/zIndex conflict.
- Old-runtime behaviour worth knowing for Phase 2 (decision 1, interrupt policy): an interrupted player walk outside a cutscene silently abandons the rest of the handler (see above).

### Exit checks

| Check | Result |
|---|---|
| Game runs in dev (`npm run dev`) and BENNE Play | ✅ Playthrough runs on the dev server; all Play From entries run in `benne-play.html`; extension bundle rebuilt |
| `npm run test:playthrough`, 3 runs in a row | ✅ 12/12 each run (10.1 / 11.0 / 10.4 min; playthrough 8.6 / 9.6 / 8.6 min) |
| `npm run check` (typecheck, lint, content, generated ids) | ✅ |
| `npm run test:unit` | ✅ 64/64 |
| `npm run test:desktop`, `test:pathfinding` | ✅ |
| `npm run test:e2e` (fixture game) | ✅ 4/4 |
| `npm run test:extension` | ✅ 21/21 |
| `npm run test:artifacts` (incl. VSIX, both templates, AI Apocalypse prod build) | ✅ |
| Production build has no hook code | ✅ |

### Notes for Phase 1

- Run `npm run test:playthrough` early and often. It takes about 10 minutes (playthrough ≈ 8.5 min, Play From ≈ 1.5 min). `npx playwright test -c playwright.playthrough.config.ts play-from` runs just the smoke tests. `BENNE_HEADED=1` shows the browser.
- The playthrough's cafe step (`café: work for the control relay` in `playthrough.spec.ts`) is the Phase 1 check that the ported `cafe.room.ts` still works.
- Hooks live in `src/engine/testing/`; keep them free of scripting imports.
