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

---

## Phase 1: Spike (2026-10-05)

### Done

1. **Build transform** (§6): `scripts/lib/bennescriptTransform.mjs`, wrapped by the Vite plugin `vite-plugin-bennescript.ts` (`enforce: 'pre'`).
   - Step functions: callbacks of `.on…(…)` methods (except `onUpdate`) and of `playFrom` / `cutscene` / `background` / `together` / `withInputDisabled`, plus top-level functions and imports from `*.script.ts`. They become `async` and start with `const __$ = __bs.ctx();`.
   - Statement-level calls (and `return call()`) become `await __$.step(() => call)`. Step-function calls in expression position become `(await __$.step(() => f()))`.
   - Speech labels: `Hank: "…"` → `await __$.step(() => __bs.say("hank", "…"))`. Speakers are read from `src/game/characters/*/*.character.json` (ID or display name, normalised, case-insensitive; `Player` is the active player). Unknown speakers get a "Did you mean" hint; ambiguous ones list the candidates.
   - Build errors (Vite overlay, with the source position): unknown or ambiguous speaker, a speech line outside a step function, a step function passed as a value to a non-BenneScript call (rule 6), and a step-function call nested in another statement's call (it would run inside a synchronous thunk).
   - Source maps via `magic-string`. Edits are in place, so the transform's output keeps every source line on its line. The runtime import is appended at the end of the file.
   - **Registered in `vite.config.ts`**. The four preview configs and `vite.benne-play.config.ts` merge it, so dev, production, BENNE Play and the previews all transform. `@benne/script` and `@game` are aliased in `vite.config.ts` and `tsconfig.json`. `tsconfig.json` sets `allowUnusedLabels: true`.
   - Parser: Oxc through Vite's own `parseAst` export, so there is no extra parser dependency. `magic-string` is now a direct dev dependency (it only came through vitest before), and the scaffold's `package.json` and file list include it and the plugin.
2. **Minimal runtime**, `src/engine/bennescript/` (`@benne/script`):
   - `task.ts`: `Task` (promise + `done` + `wait()`). No `finishNow` / `cancel` yet.
   - `interactionContext.ts`: `InteractionContext` with `step(thunk)`, `run(fn)` (ambient context + `runInInteraction`), cancellation (`raceCancel`); `runHandler` (one engine interaction activity per handler, decision 12); `cancelAllInteractions`; `endHandler()` for `never` calls; a DEV warning when a registered handler was not transformed (§12).
   - `roomHandlers.ts`: top-level registrations go into a per-room table. `RoomScene.create` attaches it after the old room scripts (`attachRoomHandlers`), subscribing to the **same event IDs** as the old API. Dispatch is listener-first, so each click reaches whichever API registered it, and the dispatch code did not change. Item handlers subscribe to the per-item event (`…:inventoryOnHotspot:<id>:<item>`), so an item without a handler falls through to the global "That doesn't work." with no `return false`. The old drop policy is applied after the handler. Room lifecycle handlers go into the room hook registry, which awaits them.
   - `actions.ts`: `walkToClicked`, `faceClicked`, `wait`, `say` (the label target), `inventory.add/remove/has/count`.
   - `handles.ts`: `PropHandle` (visible/hide/show), `HotspotHandle`, `CharacterHandle` (`say`), generic `on(verb | verbs[])` / `onVerbItem`; `withVerbMethods(handle, verbs)` adds `on<Verb>` / `on<Verb>Item` from a verb list, so the engine has no verb names; `RoomHandle` (`onEnter`, `onEnterAfterFade`, `onLeave`, `onLoaded`, `visitCount`, `isFirstVisit`, `goTo(): never`); `ItemHandle` (`animation`); `DialogHandle` / `DialogOptionHandle` (`start`, `on`, `off`); `SfxHandle`, `MusicHandle`; `defineFlags`.
   - `RoomTransitionOrchestrator.prepareForLeave` calls `cancelAllInteractions()` (§5 rule 7).
3. **Hand-written handles**: `src/game/rooms/cafe/cafe.ids.ts` and `src/game/game.ids.ts` (`@game`: the café's rooms, items, dialogs with option-name maps, sfx, music, flags, and this game's verb list and `GameVerbMethods` type). Both hold only what the café needs (decision 15).
4. **Ported `src/game/rooms/cafe/cafe.room.ts`.** Every other script is still on the old API.
5. **Shared helpers moved out of `BenneScriptCore`** so both runtimes use the same code: `scripting/scriptedSpeech.ts` (`playScriptedSayLine`, voice markers) and `scripting/verbClickTarget.ts` (clicked walk / face targets). `BenneScriptCore` delegates to them; behaviour is unchanged.
6. **Tests**:
   - `tests/unit/bennescript.test.ts` (13 tests): transform rules and errors, line preservation on the real café file, and runtime semantics. Snippets are transformed, type-stripped and actually run against the real `InteractionContext`: line order across a timed step, a helper joining the caller's interaction (waits, return value, clicked target), cancellation stopping at the current step, and the activity registry.
   - `tests/playthrough/cafe.spec.ts` (now part of `npm run test:playthrough`, about 1 minute): plays the café in **BENNE Play** through the hooks, covering every handler. It asserts the exact spoken lines and their order (from the console, where the old and new `say` both log), flags, inventory, prop visibility, the multi-verb handler, early returns, item fall-through to the global script, and `goTo()`.
7. **Extension bundle** rebuilt (`npm run build:benne-play`), so the VS Code extension's BENNE Play runs the ported café.

### Deviations from the spec

All are recorded in §6 and §12, and as decisions 13–16 in §13.

- **13: `$.step(() => call)` instead of `$.step(call)`, plus an ambient context.** The spec's form evaluates the call *before* `step` sees it, so actions can't find their interaction: `walkToClicked()` needs the clicked target, and a player walk must be attributed to the interaction for decision 12. Running the call inside `step` solves both without a `$` parameter, so step functions keep their own parameter lists (`onAnyItem((item) => …)`) and can be passed to registration APIs.
- **14: transform only files that use the new API** (they import `@benne/script`, `@game` or a `.ids` module). Otherwise old scripts would break: `B.onProp(…)` matches the `.on…` registration rule.
- **15: `@game` is hand-written at `src/game/game.ids.ts`** for the spike, so the café already imports from its final module names.
- **16: speech labels accept any expression** when the label resolves to a speaker. §4.20's `Jensen: pick(insults)` contradicted §6.2 rule 4.

### Timing judgements in the café (§11.3 checklist)

| Handler | Old timing | New timing | Judgement |
|---|---|---|---|
| Coffee on customer: `deliveredOrder = true` | Set at click time, before the eight lines played | Set after the last line | Intended. Nothing reads it mid-conversation, and the playthrough checks it once idle. |
| Coffee on customer: `coffee.animation` check, `tookOrder` check | Read at click time | Read at the top of the handler | Same moment. |
| Clean dishes: `canWork` | Read at click time | Read after the walk | Nothing changes it during the walk. Same result. |
| Talk to barista: `inventory.has(relay)` | Click time | Top of handler | Same. |
| Use door: `doorBells`, then change room | `B.sound.play` waited until the sound had *started* | `sfx.play()` doesn't wait (§5) | Same outcome: the bell rings during the fade-out and is stopped on leave as before. |
| `dialogs.x.start()` | Opened the dialog, didn't wait | Same (waiting is decision 3, Phase 2) | Every `start()` is the last line, so nothing changes. |
| `Hank: "…"` (was `B.player.say`) | Active player | Character `hank` | Same in AI Apocalypse (Hank is always the player). `Player:` exists for the general case. |

### Spike report

**What worked**

- **The label trick works end to end.** `Hank: "…"` type-checks (`allowUnusedLabels`), and plain TypeScript tooling doesn't complain. The café reads like a script: no `B.`, no `await`, no quoted IDs. The quoted strings that remain are almost all dialogue (98 → 44).
- **Sequencing is right, and the old timing bug class is gone.** `flags.deliveredOrder = true` now runs after the conversation, where it's written. The runtime tests check this directly.
- **Side-by-side routing cost almost nothing.** Dispatch is listener-first, so the new runtime subscribes to the same event IDs and needed no dispatch changes. The only engine changes are one call in `RoomScene` and one in the transition. Per-item event IDs already existed, which made `onUseItem(item, …)` free and removed every `return false` from the café.
- **Debugging.** DevTools behaviour was checked over CDP, the way DevTools does it: breakpoints set on the generated script through the served source map, and each pause mapped back. A breakpoint on a café line pauses on that line. *Step over* walks 42 → 43 → 44 → 45 through `dishes.onClean`: across the walk, into the `if`, across a speech line. It moves to the next source line only once the timed action has finished. A breakpoint in an untriggered handler doesn't fire.
- **Every bundle works:** dev server, production build (transformed code checked in `dist/`), BENNE Play from the dev server, and the prebuilt BENNE Play bundle (the café spec passes against a hooks-enabled copy served statically).
- **Size:** `cafe.room.ts` went from 142 to 130 non-blank lines and from 3,760 to 2,762 non-whitespace characters (−27%). That includes five lines of imports the old file didn't need. The café is mostly dialogue, so it is a conservative sample for the §11.4 estimate of 35–45%.

**What felt awkward to write**

- **Imports.** The café imports ten names from `./cafe.ids`, six from `@game` and four from `@benne/script`. By hand that is the most tedious part of the file. It depends on auto-import working well (Phase 3 generation + Phase 5 editor), and the scaffolding should pre-fill it.
- **A handle called `window`** (`cafe-hotspot-window`). It is legal and works, but it shadows the browser global in that module. The generator should probably warn on browser globals, not only reserved words (added to §12).
- **`Hank:` vs `Player:`.** Writing the protagonist's name is natural in a one-protagonist game, but a template author has to choose. Both work.
- **Early exits.** `if (!flags.tookOrder) { …; return }` reads fine. The old `return false` fall-through is unnecessary now that items route per item. `unhandled()` was not needed in the café.
- **Lying return types.** Authors see `void` for timed actions (§6.3), but the runtime returns `Task`s, so the implementation needs casts (`blocking()` in `actions.ts`). It works, but the Phase 2 author-facing `.d.ts` should be separate from the implementation types.

**Transform edge cases hit**

1. **Breakpoints inside the thunk.** At first, `await __$.step(() => walkToClicked())` mapped the source column to `walkToClicked` *inside* the thunk. A breakpoint on the line was set in the thunk, and *Step over* on a handler's first line left the handler into `interactionActivity.ts`. Fixed by inserting the wrapper as an overwrite of the statement's first character, which maps the source position to the `await` (rule 7 in §6.2). Labels already behaved this way.
2. **Concise arrows with parenthesised bodies** (`() => ({ … })`). The body's AST range excludes the parentheses, so the rewrite has to replace everything after `=>`.
3. **Silent no-op labels.** `Hank: "…"` inside a non-step callback (`[].map(() => { Hank: "x" })`, `onUpdate`) would compile to a label that does nothing. It is now a build error. The first version missed files with no step functions at all; a unit test caught it.
4. **Old-API files match the registration rule** (`B.onProp`, `B.onUpdate`), hence decision 14.
5. **Step calls nested in a statement's call** (`say(greeting())`) can't be awaited inside the synchronous thunk, so they are a build error that asks for a separate line.
6. **Oxc reprints the code after the transform**, so line preservation doesn't survive to the served file (the `const __$` moves to its own line). The composed source map is what carries positions. One cosmetic gap: after the last statement, the pause on the handler's closing `});` has no mapping.
7. **Offsets.** Vite's `parseAst` returns UTF-16 offsets, which is what `magic-string` needs. Checked with the café's "café".
8. **Naming.** The context is emitted as `__$`, not `$`, so it can't clash with an author's `$`.
9. **`.now` in expression position** (`const t = x.walkTo.now()`) would run without the ambient context. The café doesn't use it; it is noted in §12 for Phase 2.
10. **Bundle layout.** With `@benne/script` imported from a room chunk, Rolldown now emits the engine as a shared chunk (`chunks/interactionContext.js` in BENNE Play, `assets/interactionContext-*.js` in `dist/`) instead of keeping it in the entry. Nothing depends on chunk names, and the extension packages the whole folder. The two `walk l.webp` sprites (Hank and Jensen) swapped their deduplicated names (`walk l` / `walk l2`) in the BENNE Play bundle. This is harmless: the references follow the rename. The clash existed before Phase 1.

**Recommendation: GO.** The three risks Phase 1 was meant to test all came out fine: the label syntax, the transform rules and the debugging experience. The transform is about 400 lines, and every unsafe pattern found so far fails the build instead of misbehaving. The main costs are import management (an editor/generator problem) and the rules in decisions 13–14. Before Phase 2, please read `cafe.room.ts` and play the café, as §14.4 asks.

### Engine changes

- New `src/engine/bennescript/` (runtime above).
- `RoomScene.create`: `attachRoomHandlers(roomId, this, gameEvents)`, disposed on shutdown.
- `RoomTransitionOrchestrator.prepareForLeave`: `cancelAllInteractions()`.
- `BenneScriptCore`: speech-line and click-target helpers moved to `scripting/scriptedSpeech.ts` and `scripting/verbClickTarget.ts`. `parseBenneSayVoiceMarker` is still re-exported from `BenneScriptCore`.

### Known issues

- An interrupted opening walk leaves the new handler waiting forever on `walkToClicked()`, exactly like the old runtime. `RoomScene` still ends its activity, so idle detection is correct, and the suspended function is garbage-collected with its promise. Phase 2's interrupt policy (decision 1) should cancel the context instead.
- `wait()` supports cutscene skip through `registerCutsceneSkipFinisher`. `Task` has no `finishNow()` yet.
- The new handles reuse two old facades internally: `createBenneScriptDialogAccessor` (`option.on/off`) and the inventory item facade (`items.x.animation`). Phase 6 must move their internals before deleting the old API.
- Like the old API, the new `say` logs each line to the console (`[Player] …` / `[Character id] …`). `cafe.spec.ts` relies on that.
- The first full playthrough run this session failed in the 2027 lab because I edited the transform mid-run: Vite restarted for a config-dependency change and reloaded the page under the test. It was rerun with no edits (see exit checks). **Don't edit `vite*.ts` or `scripts/lib/*` while a playthrough is running.**

### Exit checks

| Check | Result |
|---|---|
| Café fully playable in dev | ✅ Main playthrough's café step, plus `cafe.spec.ts` during development |
| Café fully playable in BENNE Play | ✅ `cafe.spec.ts` (every handler) on `benne-play.html` from the dev server, and against the rebuilt prebuilt bundle (hooks-enabled copy, served statically) |
| Breakpoints in `cafe.room.ts` hit the right lines | ✅ Checked over CDP through the served source map: breakpoints pause on the source line, and *Step over* follows source lines through walks and speech (see the spike report) |
| `npm run test:playthrough` | ✅ 13/13 (11.0 min; main playthrough 8.5 min). The earlier failure this session was caused by my edit (see Known issues) |
| `npm run check` | ✅ |
| `npm run test:unit` | ✅ 77/77 (13 new) |
| `npm run test:e2e`, `test:extension`, `test:desktop`, `test:pathfinding` | ✅ 4/4, 21/21, 3/3, passed |
| `npm run test:artifacts` (both templates, scaffold with the new plugin) | ✅ |
| Production build transformed | ✅ `cafe.room-*.js` in `dist/` contains the `step(…)` / `say(…)` form |

### Notes for Phase 2

- Extend `src/engine/bennescript/interactionContext.ts`; don't start a new runtime. Handlers start synchronously in the dispatching event, as the old ones did.
- Add one runtime test per §5 rule to `tests/unit/bennescript.test.ts`. Its `load()` helper compiles and runs real snippets against the real runtime with fake actions.
- Still to do from §10: `finishNow` / skip mode, `.now` (with ambient context in expression position), `Task.wait()` beyond statement level, `together`, `background`, `cutscene`, `withInputDisabled`, `unhandled()`, `dialog.end()`, `saves.load()`, dialog `start()` waiting, the interrupt policy and the save policy.
- `goTo()` already throws `END_HANDLER` after scheduling the transition, and `runHandler` reports the outcome (`finished` / `ended` / `cancelled` / `failed`).

---

## Phase 2: Runtime (2026-10-05)

### Done

1. **`Task`** (`src/engine/bennescript/task.ts`): `done`, `wait()`, `finishNow()` (cutscene skip), `cancel()`. Hooks mark player walks (for the interrupt policy) and actions that wait on the player (dialogs). Every timed action is built once with `timed(start)`: the blocking form returns `task.wait()` (a `TaskWait` marker), `.now` returns the bare `Task`. `$.step` waits on the marker and on step-function promises only, so `.now` as a statement does not wait and `t.wait()` later does (decision 17).
2. **`InteractionContext`** (`interactionContext.ts`), extended rather than rewritten:
   - Phase tracking for the interrupt policy (`start` → `openingWalk` → `busy`) and a cutscene depth.
   - Skip mode: in a skipped cutscene `$.step` calls `finishNow()` on each task; an ESC press mid-step finishes the in-flight one through the room's skip finishers. The room's own primitives already finish walks and speech when skipped.
   - `runHandler` gives the activity registry the handler's world-click policy and an interrupt callback, and reports `finished` / `ended` / `unhandled` / `cancelled` / `failed`.
   - `startBackground` (own context, keeps the click payload, no lock, no activity), `cancelAllInteractions(except?)` plus cancel hooks, `unhandled()`.
3. **Blocks** (`blocks.ts`): `cutscene(fn, options?)` (pushes the room cutscene, which already ignores world clicks and keeps click-to-skip; doesn't pop after a cancel because the room change emptied the stack), `together(...fns)`, `background(fn)`, `withInputDisabled(fn)` (nested-safe, re-enables after cancellation), `input.disabled`.
4. **Ending calls typed `never`:** `rooms.x.goTo()` (Phase 1), `saves.load(slot)`, `unhandled()`, `dialogs.x.end()`. `unhandled()` falls through after the room level: verbs → character script → global verb → global fallback; items → room any-item → global → unhandled fallback (decision 22; new helpers `continueVerbDispatchAfterRoom` and `continueInventoryOnDispatchAfterRoom`, the global tiers split out of `dispatchVerbInteraction` without changing its behaviour).
5. **Cancellation (§5 rule 7):** room leave (Phase 1) and now any snapshot load or new game (`GAME_STATE_REPLACED_EVENT`, so old-API loads stop new-API handlers too). `saves.load()` stops every other handler before loading and ends its own.
6. **Interrupt policy (decision 1, decision 18):** engine-level, in `interactionActivity.ts`: `admitGameplayClick()` asks each running activity's policy. `RoomScene` calls it on the prop, hotspot, character and background-walk click paths, and `buildGuiOverlay` on inventory-row verb clicks. Clicks that only clear the armed verb/item are not gated. A new-API handler on its opening walk is cancelled by the click; otherwise the click is dropped; inside `cutscene` it is always dropped. Old-API activities set no policy, so their behaviour is unchanged. `RoomScene`'s dropped-walk path now calls `activity.abandon()`, which cancels a new-API handler (fixes the Phase 1 known issue of a handler suspended forever on an interrupted opening walk); for the old API it is the same `end()` as before.
7. **Save policy (decision 2, decision 20):** `saves` (`saves.ts`): `canSaveNow`, `list()`, `get()`, `save(slot, name)` (refused with a DEV warning while `canSaveNow` is false), `load()`, `delete()`. `canSaveNow` is false while any gameplay activity runs (old or new API, including one waiting on a dialog), a dialog is open, or a room transition is in progress. Activities now carry a `gameplay` flag; `GuiBenneScript` reports `false`. The old `B.state.save` is unchanged.
8. **Dialogs (decision 3, decision 19)** (`dialogs.ts`): `dialogs.x.start()` waits until the conversation ends, `start.now()` doesn't. A stack on top of the engine's single dialog session gives sub-dialogs return-to-parent: the parent is suspended while the sub-dialog runs, and reopens once the choice handler that started the sub-dialog has finished. Starting a dialog already on the stack throws in DEV. New-API choice handlers: `options.x.onChoose(fn)` / `onChooseOnce(fn)` (the player says the option text first, as `whenChoice` does), `options.x.on()/off()/enabled` without the old facade, `dialog.end()`. A handler waiting on `start()` marks its activity "waiting for the player", so the test hooks see the `dialog` phase rather than `busy`. Sessions opened by `B.dialog(…).start()` are not on the stack and behave as before.
9. **Handles**: `player` (`walkTo` / `walkTo.now`, `face`, `say` / `say.now`), `CharacterHandle.walkTo` / `face` / `say.now`. Still only what the tests and the café need; Phase 4 completes the API.
10. **Transform:** `x.now(…)` and `background(…)` in expression position are wrapped in `__$.run(() => …)` (the §12 gotcha), so `const t = jensen.walkTo.now(…)` starts with the handler's context.
11. **Tests** (`tests/unit/bennescript.test.ts`, 19 new runtime tests, 32 in the file):
    - one per §5 rule: rule 1 order, rule 2 "finished" (instant vs timed vs helper), rule 3 `.now` (statement and expression position, ambient payload), rule 4 `Task.wait()`, rule 5 `goTo` / `saves.load` / `unhandled` / `dialog.end`, rule 6 reads at that line, rule 7 room change and save load (including a background block), rule 8 cutscene skip (ESC mid-step, rest of block instant, normal timing after);
    - interrupt policy (rule 9): opening walk cancels; speech, a second walk and a non-walk first step ignore; cutscene ignores even during a walk; background and old-API activities don't take the lock; an abandoned walk cancels;
    - save refusal: refused during a handler with a warning, allowed when idle; GUI activity doesn't block; open dialog does;
    - blocks: `together`, `background` + `wait()`, `withInputDisabled` after cancellation;
    - dialogs: `start()` waits, sub-dialog returns to the parent after the choice handler, "waiting for the player" is not busy but blocks saving; starting an open dialog errors.

### Deviations from the spec

All recorded as decisions 17–22 in §13, with "as built" notes in §4.5, §4.8, §4.13, §4.16, §5 rule 9, §6.2, §6.4, §10 and §12.

- **17:** `TaskWait` marker vs bare `Task` (the spec's §6.4 sketch waited on every `Task`, which would make `.now` as a statement wait).
- **18:** which clicks the interrupt policy covers, what counts as the opening walk, and abandon → cancel.
- **19:** the dialog stack sits on the engine's single session, and **new-API choice handlers are not cutscenes** (the old `whenChoice` pushed one). A choice that waits on a sub-dialog would otherwise block the sub-dialog's buttons. Authors wrap long choices in `cutscene()` for ESC skip. Worth a look when porting the dialogs in Phase 4.
- **20:** save policy details (transitions count, GUI flag, load cancellation through the state-replaced event).
- **21:** `background` semantics.
- **22:** `unhandled()` fall-through tiers; the target's own `onVerbFallback` channel is skipped.

### Known issues

- The café is the only new-API script, and it uses none of the Phase 2 features except waiting `start()` (its dialogs are old-API and end with `stop()`, after which the handler finishes). Sub-dialogs, `cutscene`, `together`, `background`, the interrupt policy and the save policy are exercised by unit tests only, against a fake room. They get real-room coverage when Phase 4 ports the plaza, lab and botti3 dialogs.
- `cutscene`'s `finishNow` relies on the room's existing skip handling for walks and speech; new-API tasks with no finisher (none yet besides `wait`) simply stop being waited for when skipped.
- `.now` speech or walks started in a cutscene and never waited for are fast-forwarded by the room's own skip handling, not by `$.step`.
- `ItemHandle.animation` still goes through the old inventory facade (Phase 6 must move it). The dialog facade dependency is gone.
- Module-level listeners in `dialogs.ts` / `saves.ts` would be registered twice if Vite hot-reloads those engine files. Dev only; a page reload fixes it.

### Exit checks

| Check | Result |
|---|---|
| New unit tests | ✅ 19 new runtime tests (one per §5 rule 1–8, six for rule 9 / the interrupt policy, two for save refusal, plus blocks and dialogs); `bennescript.test.ts` 32/32 |
| `npm run test:unit` | ✅ 96/96 |
| Café still works | ✅ `cafe.spec.ts` in BENNE Play (every handler, including the barista and customer dialogs, whose `start()` now waits) and the main playthrough's café step |
| `npm run test:playthrough` | ✅ 13/13 (11.0 min; main playthrough 8.4 min) |
| `npm run check` (typecheck, lint, content, generated ids) | ✅ |
| `npm run test:e2e` (old-API fixture game; checks the click-path and dispatch changes) | ✅ 4/4 |
| Extension bundle | Rebuilt (`npm run build:benne-play`). As in Phase 1, Rolldown reshuffled some deduplicated sprite names (`talk *2/3.gif`, `walk l*.webp`); the references follow. |

### Notes for Phase 3

- Generated handles should build on `timed()` for every timed action, so each gets `.now` for free, and on `DialogHandle` / `DialogOptionHandle` from `handles.ts` (`start`, `end`, `onChoose`, `onChooseOnce`, `on`/`off`/`enabled`).
- `player` exists in `@benne/script` now; generated character handles for the player character should keep producing player walks (`walkCharacterTask` does this by id), since the interrupt policy depends on it.

---

## Phase 3: Generator (2026-10-05)

### Done

1. **Handle generator** `scripts/lib/generateGameHandles.mjs`, run by `scripts/generate-game-ids.mjs` next to the old `benne-game-ids.d.ts`. From AI Apocalypse it writes 33 modules (238 top-level handles):
   - `src/game/game.ids.ts` (`@game`): `rooms`, `characters`, `items`, `dialogs` (with `options`), `guis` (with `controls`), `sfx`, `music`, `video`, `verbs`, `fallbacks`, the `VerbId` / `ItemVerbId` types, the `VerbMethods` / `FallbackVerbMethods` interfaces, and `flags` / `vars` re-exported from `state.ts`;
   - `rooms/<id>/<id>.ids.ts`: `room`, props, hotspots and spawned characters (flat), `points`, `regions`, `walkables`;
   - `dialogs/<id>/<id>.ids.ts`: `dialog`, `options` (the same objects as `dialogs.x.options`);
   - `guis/<id>/<id>.ids.ts`: `gui` and flat controls (the same objects as `guis.x.controls`).
   - Animation tag unions for props (room sheet), characters (sheet + `animations` keys) and items (shared or own sheet), so `items.coffee.animation = 'coffe-full'` is a type error with a "Did you mean".
2. **Naming** (`scripts/lib/benneNames.mjs`): camelCase, room-prefix and kind-word stripping with the whole-ID fallback (`lab-point-1` → `labPoint1`, as the spec's examples already used), `scriptName` overrides, collision errors per scope, reserved / BenneScript names → trailing `_` + warning in flat scopes, browser-global warnings. Exact rules: §7.2 "as built" and decision 24.
3. **Verbs** (`scripts/lib/benneVerbs.mjs`, shared with validate-content): `on<V>` and, for `usesItem` verbs, `on<V>Item` on props, hotspots, characters and items; `fallbacks.on<V>` / `fallbacks.on<V>Item((item, target) => …)`; `verbs.<v>` (`VerbHandle`: `id`, `label`, `preposition`, `usesItem`, `select()`, `isActive`). `usesItem` defaults from the preposition (decision 7). Reserved verb IDs (`walkTo`, `defaultVerb`, `item`, `anyItem`, `combine`, plus `verbItem`) and generated-name collisions (`use` + `useItem`) stop generation. The method names travel in the generated verb list, so the engine still has no verb names.
4. **Engine, decisions 7 and 8**: `GameVerbDefinition.usesItem`, `GameSettings.defaultVerb`; `isItemVerb()` and `resolveGameDefaultVerbId()` in `verbConfig.ts`. The pointer's `defaultVerb` fallback now uses the game-level default instead of the hard-coded `look` (same result in AI Apocalypse). `DEFAULT_VERB_FALLBACK` stays exported for the old `verbs.gui.ts`. AI Apocalypse's config now says `"usesItem": true` on `use` and `"defaultVerb": "look"` (§8.5). The use/give alias lists and item arming are unchanged (Phase 4).
5. **Runtime handle classes** (`handles.ts`): `ClickableHandle` / `PropHandle` / `HotspotHandle` / `CharacterHandle` / `ItemHandle` are generic over the verb ID (and animation tags); `PropHandle.animation` and `CharacterHandle.animation` added (the type parameter needed a use). New: `VerbHandle`, `FallbacksHandle`, `PointHandle`, `RegionHandle`, `WalkableHandle`, `GuiHandle`, `GuiControlHandle`, `VideoHandle`, `flag()`, `defineVars()`. `CharacterHandle` takes a `null` room for `characters.x`.
6. **`src/game/state.ts`** with `defineFlags` / `defineVars`; only the café's three flags for now (Phase 4 moves the rest out of `globalScript.ts`).
7. **Speaker labels** (decision 4): resolution moved to `scripts/lib/benneSpeakers.mjs`, shared by the transform, its Vite plugin and the generator. The generator warns about names several characters normalise to and about characters named "player"; using such a label stays a build error. AI Apocalypse has none.
8. **validate-content** checks every verb ID in content JSON: `game-config.json` (`verbs` reserved/collisions, `defaultVerb`, `inputProfile` slots, `usesItem` type), props' and hotspots' `defaultVerb`, characters' and items' `defaultVerb`, items' `onVerb` keys. AI Apocalypse and both templates: no new diagnostics.
9. **Generated files are gitignored** (`src/game/**/*.ids.ts`; also in the `.gitignore` the extension writes for new games). The hand-written `game.ids.ts` and `cafe.ids.ts` are removed from git and replaced by generated ones. `cafe.room.ts` did not change: the generated names and imports match the hand-written ones. Regeneration: `predev` / `prebuild*` (as before), the Vite plugin's build start and dev watcher, the extension's existing `generate:game-ids` runs, and now `pretypecheck`. The writer only rewrites changed files and only deletes `.ids.ts` files with the generated marker. The dev watcher ignores `*.ids.ts`, also reacts to audio/video files, and shows generator errors in the overlay instead of crashing the dev server.
10. **`npm run check`** now runs `check:generated` first (committed `.d.ts` is current and the handles generate without errors), then `typecheck` (which generates the gitignored modules), lint and validate-content.
11. **Tests**: `tests/unit/handleGenerator.test.mjs` (13: naming, verbs and decisions 7/8, reserved verbs, validate-content verb checks, module output, `state.ts` re-export, collision → `scriptName`, audio collisions, reserved/browser names, bad `scriptName`s, ambiguous speakers) and `tests/unit/bennescriptHandles.test.ts` (5: verb mixin, `flag` saveKey, `defineVars` copies, `VerbHandle`, `isItemVerb` / `resolveGameDefaultVerbId`).

### Collisions and warnings in AI Apocalypse

| Where | What | Resolution |
|---|---|---|
| `guis/settings-menu` | **Collision:** slider `musicVolume` and its text label `music-volume` both become `musicVolume` | `"scriptName": "musicVolumeLabel"` on the label. Explained: a control and its caption named after the same setting. |
| `guis/game-menu`, `guis/title-buttons` | Button `settings` would shadow the `settings` helper (→ `settings_`) | `"scriptName": "settingsBtn"` on both. §4.15's example updated. |
| `rooms/cafe` (`cafe-hotspot-window`), `rooms/lab` (`window`) | Handle `window` shadows the browser global | Warning only, kept (the café has used it since Phase 1). |

The **templates** (`game-templates/2-click`, `9-verb`) carry the same `settings-menu` and `game-menu` GUIs, so they hit the same collision, which failed their builds in `test:artifacts` (generation errors stop `prebuild`). They got the same two `scriptName`s, edited directly (no sync scripts). The 9-verb template's `window` hotspot (`apartment`) warns.

No other collisions. Names match the spec's examples (`points.firstVisitJensen`, `regions.garageExit`, `regions.cantWalk`, `points.labPoint1`, `points.walkToCloset`, `toolChest`, `savedList`, `saveBtn`).

### Deviations from the spec

Recorded as decisions 23–26 in §13, with "as built" notes in §4.7, §4.15, §4.17, §7.1, §7.2, §8.2, §8.3 and §12.

- **23:** generated files are real `.ts` modules next to the content, with a marker; `verbs` and `fallbacks` are in `@game`, not `@benne/script` (§4.17's import changed), because their methods come from config.
- **24:** exact naming rules (camelCase of all-caps words, whole-ID fallback, which scopes reserve names, `scriptName` validation, audio collisions need a file rename).
- **25:** `verbItem` reserved too; verb IDs must start with a letter; **no JSON Schema enums**, because the repo has no content schemas (the Inspector dropdowns are Phase 5).
- **26:** `state.ts` is an ordinary module; `flag(default, { saveKey })`; object var defaults are copied on first read.

### Known issues / left for Phase 4

- **Generated API without a runtime yet:** per-verb methods on `items.x` (`onLook`, `onUseItem`, `onCombine`, `onItem`, `onAnyItem`), everything on `fallbacks`, and `characters.x.on…` outside a room script type-check, but log a DEV warning ("not implemented yet") and don't register. Room-scoped handles (`./<room>.ids`) work as in Phase 2.
- `PointHandle`, `RegionHandle`, `WalkableHandle`, `GuiHandle`, `GuiControlHandle`, `VideoHandle` carry only their IDs; `RoomHandle` has no `cameFrom` / `last` yet. Points already work as walk targets (`WalkTarget` accepts any `{ id }`).
- A room-scoped character handle (`hank` from `./plaza.ids`) and `characters.hank` are different objects, so `who === hank` in a region handler (§4.14) needs care in Phase 4.
- The Inspector (`inspectorStateBuilder.ts`, `inspectorMutations.ts`) still treats `look` as the default verb (Phase 5). Editors that rewrite JSON should keep the new `scriptName` fields; the type definitions now declare them.
- Generator warnings (`window`) print on every regeneration.

### Exit checks

| Check | Result |
|---|---|
| AI Apocalypse generates with no unexplained collisions | ✅ 33 modules; one collision, explained and fixed with a `scriptName` (table above); `window` warnings kept |
| `npm run check` (check:generated, typecheck, lint, validate-content) | ✅ |
| Café works on generated handles | ✅ `cafe.spec.ts` in BENNE Play (every handler); `cafe.room.ts` unchanged; generated types reject a wrong verb, item, animation tag and item-verb method (checked with a throwaway probe file) |
| `npm run test:playthrough` | ✅ 13/13 (13.3 min; main playthrough 10.2 min, slower than Phase 2's 8.4 on this run, with no retries) |
| `npm run test:unit` | ✅ 114/114 (18 new) |
| `npm run test:e2e`, `test:extension`, `test:desktop`, `test:pathfinding` | ✅ 4/4, 21/21, 3/3, passed |
| `npm run test:artifacts` (scaffold, both templates, prod build) | ✅ after the template `scriptName`s (see above) |
| Fresh clone (no generated files) | ✅ `tsc` alone fails as expected; `npm run typecheck` generates first and passes |
| Extension bundle | Rebuilt (`npm run build:benne-play`); Rolldown reshuffled the deduplicated `talk *` / `walk l*` sprite names again. `media/room-preview/room-preview.js` was rebuilt by the extension test run, picking up the `resolvePointerVerb` change. |

### Notes for Phase 4

- Every handle is created in generated code; add behaviour to the classes in `src/engine/bennescript/handles.ts`, not to the generator. Replace each `notYet(…)` with real registration.
- The generator test fixture in `tests/unit/handleGenerator.test.mjs` is a quick way to see the output for new content shapes.
- Port flags into `src/game/state.ts` as you port scripts; the old string keys still work for flags not yet declared (`saveKey` is there if a name must differ).
- Run `node scripts/generate-game-ids.mjs` after content edits outside the dev server; `npm run typecheck` does it for you.

---

## Phase 4: Handle API and port (2026-10-05)

### Done

1. **Handle API** (`src/engine/bennescript/`), building on the Phase 2–3 classes:
   - `handles.ts`: props (`clickable`, `description`, `play`, `fade`, `moveTo`, `slideTo`), hotspots (`active`, `description`), characters (`walkTo`, `moveTo`, `stopWalking`, `position`, `isPlayer`, `play`, `fade`, `animation`, `stopAnimation`, `visible`/`show`/`hide`, `movable`, `clickable`, `description`, `startFollowing`/`stopFollowing`, `inventory`), `onItem` / `onAnyItem` on clickables, regions (`onEnter((who) => …)`, `onExit`, `active`), walkables (`active`), rooms (`visitCount` and `last` settable, `hasVisited`, `cameFrom`), items (`name`, `animation`, `cursorAnimation`, `description`, verbs, `onUse.doNotActivate`, `onVerbItem` / `onItem` / `onCombine` / `onAnyItem`), `dialog.onStart`, GUIs (`show`/`hide`/`visible`, `fadeIn`/`fadeOut`, `onBuilt`/`onShow`/`onHide`, `root`) and controls (see §4.15 as-built), `sfx.x.playAndWait` / `stop`, `music.stop()` / `isPlaying` / `current` (`withMusicControls`), `video.x.play` / `playAndWait` / `stop`, real `fallbacks`.
   - `actions.ts`: `` say`…` `` blocks, `display`, `fadeOut` / `fadeIn`, `waitForClick`, `player` (`id`, `moveTo`, `stopWalking`, `position`, `play`, `stopAnimation`, `animation`, `visible`, `movable`), `inventory.items`, `inventoryOf(owner)`.
   - New modules: `camera.ts` (`focus`, `zoom`, `zoomTo`, `reset`, `resetZoom`, `shake`), `game.ts` (`game`, `settings`, `pointer` with `sentence`, `hover`, `verb`, `item`, `onContextChange`), `itemHandlers.ts` (item verbs, `usesItem` arming, item-on-item), `globalHandlers.ts` (fallbacks, character scripts, any-room hooks, `onUpdate`), `guis.ts` (GUI lifecycle, control events, tweens), `registry.ts` (handles by id). `roomHandlers.ts` gained regions, `playFrom` and room-level any-item handlers.
   - `interactionContext.ts`: `runDetached` for callbacks that run outside any handler.
2. **Engine changes** (old API unchanged):
   - `RoomScene` builds a `GuiRuntime` for every GUI overlay (it used to need an old GUI script) and runs new `onBuilt` handlers; `clearScriptedDialogClickToSkipIf(fn)`.
   - Old `B.gui(…).show/hide` also runs new `onShow` / `onHide` (`benneScriptGuiApi.ts`).
   - `wireBenneGlobalScripts` calls `attachGlobalRoomHooks()` once the hook registry exists.
   - Verb context: a persistent event that `RoomScene` doesn't clear on shutdown (`BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT`).
   - Dispatch: `continueVerbDispatchToGlobal`, `continueInventoryOnDispatchAfterGlobal` (fall-through from global-tier handlers), `markInventoryItemArmedByScript` (click-time arming skips items the new runtime arms).
   - `getLoadingRoomScriptId()` in `registerRoomScript.ts`.
3. **Generator**: `ItemVerbMethods` / `__withItemVerbs` (item verbs typed with `doNotActivate`), `music = withMusicControls({…})` with `stop` / `isPlaying` / `current` reserved.
4. **Transform**: `` say`…` `` blocks resolve their speakers at build time (unknown / ambiguous speaker or a line without `:` is a build error) and emit `say.__withSpeakers({…})`.
5. **Port of AI Apocalypse**, group by group, with `npm run test:playthrough` after each (results below): 11 rooms, 9 dialogs, 12 inventory scripts, 7 GUI scripts, `globalScript.ts`, `state.ts` (every flag). Deleted the 10 empty character scripts and the 4 empty GUI scripts (`dialog`, `display-text`, `opening-text`, `speaking-text`), as §4.9 allows; the editor only creates character scripts from its wizard.
6. **Tests**: `tests/unit/bennescriptHandleApi.test.ts` (11): item arming and `doNotActivate`, `onCombine` and fall-through, fallbacks with `(item, target)`, character-script `unhandled()`, region `who`, GUI `onClick` (non-gameplay, doesn't block saving) and `onChange`, `pointer.sentence` / `hover.defaultVerb`, `waitForClick` (click and timeout), `say` block transform and playback. A throwaway Playwright check (deleted afterwards) covered what the playthrough doesn't: the BOTT-i3 sub-dialogs return to the parent (`around here` → `thats all`, `ai future` → `drive` → `thats all`), the game, settings, load and save menus, and the verb line text.
7. **Extension bundle** rebuilt (`npm run build:benne-play`).

### Size (§11.4)

Against the original game (`76e7395`): rooms and dialogs 2,156 → 1,981 non-blank lines (−8%), 61,377 → 46,352 non-whitespace characters (**−24%**); all scripts 2,850 → 2,247 lines (−21%), 84,115 → 53,650 characters (**−36%**). Rooms and dialogs land below the §11.4 estimate of 35–45% because most of their text is dialogue, which doesn't shrink.

### Timing judgements (§11.3)

"Click time" is the old API running non-queued code when the handler was dispatched.

| Where | Old timing | New timing | Judgement |
|---|---|---|---|
| Flag writes at the end of long handlers: hallway Timeonium on Jensen (`gotMission`, `jensenCrying`, `jensenBlockingDoor`), club wrench on battery (`batteryFixed`, `gotRegulator`), gallery paint (`canTakeLens`), statue (`gotLens`), closet coin (`escapedCloset`), lab27 guard region (`firstBanana`, `scientistRequest`), dialogs `time scientist` (`jensenCrying`), `bye` (`spokeWithJensenFirstTime`, `talkedWithBottieOnce`), `can have lens` (`canCleanPaint`), `high tech thing` (`canWork`), `helped` (`gotRelay`), `take order` (`tookOrder`), `fix battery`, `wrench`, `found all` (`allDone`) | Click time | Where written, after the lines | Intended. Nothing reads them while the handler runs, and the player can't click meanwhile. The playthrough checks them once idle. |
| Flag and state reads at the top of handlers (`jensenCrying`, `gotMission`, `escapedCloset`, `inventory.has(coin)`, `electricalBox.animation`, …) | Click time | At that line, after the walk | Same result: nothing changes them during the walk. |
| club `regulator.onLook`: `battery.active = true` | Click time (the hotspot setter wasn't queued) | After the driver's lines | Intended: the driver mentions the battery in those lines. |
| lab27 `timeonium.onTake`: `bananaGuard.active = false` | Click time | **Moved to the top of the branch**, before `walkToClicked()` | Kept the old timing: the walks to the canister and the cord must not trip the scientists' guard region. |
| lab `closetDoor.onUse`: `cantWalk.active = false` | Click time | **Moved above the walk** | Kept the old timing: the walk into the closet needs the region open. |
| plaza first visit: `jensen.walkTo.now` | Fired with Hank's walk | **Moved above `player.walkTo`** | The §11.3 case: Jensen and Hank start together, the scene waits for Hank. |
| plaza `jensenMoveRight` / `jensenMoveLeft` regions | Queued walk; old handlers never held a lock | `jensen.walkTo.now(…)` | Region handlers are gameplay handlers now; a blocking walk would ignore the player's clicks while Jensen steps aside. |
| plaza `jensen.onAnyItem` (was `whenInventoryUsedOn('jensen')` with no `return false`) | Any item | `onAnyItem` | Same. |
| lab27 guard region: `moveTo.now({feet})` + `stopAnimation()` | Instant teleport to the player's own feet | `player.stopWalking()` + `player.stopAnimation()` | Same effect; both abandon the walking handler (new API: it is cancelled). |
| jensen-in-hallway `its the future`: `stop()` then `face('U')` | `face` ran after `stop()` | `jensen.face('U')` before `dialog.end()` | The §11.3 case. |
| botti3 sub-dialogs `thats all`: `B.dialog('botti3').start()` | Restarted the parent | `dialog.end()` | The §11.3 case; the parent comes back (checked in the browser). |
| `optionOff(self)` at the end of a choice | Turned off after the lines | `onChooseOnce` turns it off when chosen | No visible difference: the choices are hidden while the handler runs. |
| jensen-in-plaza top-level code | Ran on every session open | `dialog.onStart(…)` | Same moment. |
| Every `start()` (café, hallway, gallery, club, plaza) | Last line | Last line, now waits | Nothing after it changes. |
| Dialog choices with ≥6 lines, a fade or a walk | Every `whenChoice` was a cutscene (ESC skip) | Wrapped in `cutscene(…)` | Keeps ESC skip where it matters (decision 36). |
| `B.sound.play` / `playMusic` waited until playback started | Queued, waited for start | `play()` doesn't wait | As in Phase 1: no visible difference in the videos. |
| closet first visit played `trapped` twice | Two `playMusic` calls | One | Duplicate call removed. |
| Opening: click-to-advance | A click during a fade-in also skipped the hold | A click finishes the fade it lands in, or ends the hold | §4.12's code. Skipping a paragraph early now takes two clicks. |
| Title "New Game": `B.state.reset()` + `changeTo('opening')` | | `game.newGame(rooms.opening)` | Same. |
| Save menu | Save always enabled when a name is typed | Also needs `saves.canSaveNow` | §4.16; the button is disabled while an interaction or dialog runs. |

### Cutscene videos vs Phase 0

The Phase 0 recordings survived in that session's scratchpad (`…/4dcd6bab-…/scratchpad/run{1,2,3}/cutscenes/`); this phase's final run is in `test-results/playthrough/cutscenes/`. Durations (s):

| Cutscene | Phase 0 runs 1/2/3 | After group 1 | Final |
|---|---|---|---|
| lab first visit (take Timeonium → slip → 2037 lab) | 78.7 / 78.6 / 80.0 | 81.7 | 79.5 |
| plaza first visit | 20.5 / 20.6 / 20.9 | 21.0 | 20.6 |
| finale | 50.1 / 50.4 / 49.8 | 49.8 | 49.7 |

Frame sheets (every 6 s / 2 s / 4 s, Phase 0 run 1 against the final run) show the same shots in the same order, offset by at most a line. The group 1 run's extra lab time was run-to-run variation; the final run is inside the Phase 0 range. **One visible difference:** in the finale the verb line reads "Use mop with" for the whole cutscene, where Phase 0 showed "Walk to". The armed item is dropped (`dropWhenInventoryUsed`) when the handler ends, which is after its `cutscene(…)`. The old runtime dropped it when its *outer* queue drained, right after the walk, because the cutscene's inner steps were chained onto a newer queue. Only handlers that wrap their work in `cutscene()` show this. Left as is, since "after the interaction" is the documented policy; worth a look if it bothers you.

### Deviations from the spec

Decisions 27–37 in §13, with as-built notes in §4.2, §4.4, §4.7, §4.8, §4.12, §4.14, §4.15, §4.16, §4.19, §8.2 and §10. In short: top-level registration for non-room handlers (27), the arming rule (28), Play From and settable `visitCount` / `last` (29), region `who` and the lock (30), build-time `say` speakers (31), a runtime for every GUI (32), `pointer` details and its persistent event (33), API additions `dialog.onStart`, `game.newGame(startRoom?)`, `stopWalking`, `inventoryOf` (34), music controls (35), cutscene-wrapped long choices (36), flag keys kept via `saveKey` (37).

### Known issues

- **The armed-item drop in cutscene handlers** (above).
- **JSON-only items** (no new-style handler) still arm through the engine's click-time path, which also plays the global `use` fallback line. AI Apocalypse has none. Phase 6 should make the new rule cover every item.
- **Old facades still used inside new handles**: the inventory item facade (`ItemHandle.animation` / `cursorAnimation` / `description`) and `GuiRuntime` / `ControlFacade` for controls. Phase 6 must keep `GuiRuntime` (it isn't scripting API) and move the item facade's internals.
- **Module-level subscriptions** (items, fallbacks, GUI controls, `pointer`) are registered twice if Vite hot-reloads an engine or script module; a page reload fixes it. Dev only, as in Phase 2.
- **Editor**: Inspector handler chips, "add handler" and voice-ID export still read the old syntax, so they show nothing for the ported game (Phase 5).
- `Phaser…Mask.setMask: This method is not supported in WebGL` was logged as a warning while the menus were open in the throwaway check. Not verified whether it predates the port (the Phase 0 list of known warnings doesn't mention it); the menus work.

### Exit checks

| Check | Result |
|---|---|
| No AI Apocalypse script uses the old API | ✅ 41 script files, all on `@benne/script` / `@game`; `grep` finds no `register*Script` or `B.` outside `boot/` |
| `npm run check` | ✅ |
| `npm run test:playthrough` after each group | ✅ 13/13 after rooms (11.8 min), dialogs (11.2), inventory + characters (11.1), GUIs (11.3, after one fix: the verb-line handler wrote to a GUI destroyed during a room change; destroyed controls now resolve to "not in the room"), global script + `state.ts` (11.2) |
| Every Play From smoke test | ✅ 11/11 in each run (10 entries + discovery) |
| Cutscene videos vs Phase 0 | ✅ same shots and timing; one difference noted above |
| `npm run test:unit` | ✅ 125/125 (11 new) |
| `npm run test:e2e` (old-API fixture game) | ✅ 4/4 |
| `npm run test:extension` | ✅ 21/21 |
| `npm run test:artifacts` (both old-API templates, desktop, itch package) | ✅ |
| Extension bundle | Rebuilt (`npm run build:benne-play`) |

### Fix after review: inventory Look lines skipped by the same click

Reported after playing (desktop build and BENNE Play): Look at, then left-click the magnet or the mop, and Hank says nothing. The line was spoken (it was in the console log) but skipped in the same frame. An inventory slot's click starts the item's handler, and the new runtime runs a handler's first statement synchronously, so the speech line and its click-to-skip hook were set up *inside* the slot's `pointerdown`. The room's own `pointerdown` handler then saw the same click and used it to skip the line. The old runtime queued the line to a later tick. World handlers weren't affected, because they start with `faceClicked()` or `walkToClicked()`, and neither were right-clicks (they never skip). Timeonium seemed to work because a right-click looks at it (its default verb is the game's `look`; mop, magnet and coin default to `use`).

- **Fix** (`RoomScene`): a click-to-skip hook armed while a press is in progress records that press's `downTime`, and that same press can't consume it. The next click skips as usual.
- **Test**: `tests/playthrough/inventory-look.spec.ts` (now part of `npm run test:playthrough`) uses real mouse clicks in BENNE Play: Look at, then the magnet's slot. It checks that the line is still up 300 ms later and that the next click skips it. Without the fix it fails ("the line is still on screen"). The playthrough's hooks click objects directly, which is why they didn't catch this.
- **New dev/test hook** `inventoryVerb(verbId, itemId)`: selects a verb and clicks the item's inventory slot.

### Notes for Phase 5

- New syntax to recognise: `x.on<Verb>(…)`, `x.on<Verb>Item(items.y, …)`, `x.on([…], …)`, `items.x.onCombine(items.y, …)`, `regions.x.onEnter`, `options.x.onChoose` / `onChooseOnce`, `dialog.onStart`, GUI `x.onClick` / `onChange` / `onSelect`, `gui.onBuilt` / `onShow`, `fallbacks.on<Verb>`, `playFrom('name', …)`. Speech is `Name: "…"` labels and `` say`…` `` blocks.
- `say` blocks keep speakers as written in JSON (hyphens, spaces), so the voice-ID export must resolve them with `benneSpeakers.mjs` like the transform does.
