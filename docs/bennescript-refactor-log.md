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

---

## Phase 5: Editor (2026-10-06)

### Done

1. **BenneScript layer for the editor**, `benne-editor/src/bennescript/` (no `vscode` imports, so the extension and the TS server plugin share it; details in §9 "as built"):
   - `scriptModel.ts`: the **ScriptModel**, read from the TypeScript AST. Registrations (any `x.on…(…)` call, `x.onUse.doNotActivate(…)`, `playFrom`, `onUpdate`), speech lines (labels, `` say`…` `` block lines, `x.say(…)` with the exact range of each text), references to generated handles, and whether the file still uses `register*Script`.
   - `idsIndex.ts`: reads the generated `.ids.ts` modules to map handle names ↔ content IDs (decision 38). `findBinding` answers "how does this script name `club-hotspot-battery`?" (`battery` from `./club.ids`, `items.soda` from `@game`, `options.fixBattery`); `refAtDeclaration` answers the reverse for go to definition.
   - `handlerSpecs.ts` + `handlerEvents.ts`: one `HandlerSpec` per Inspector action (verb, any item, room hook, `onUpdate`, region, GUI hook, control event, dialog choice, Play From), the Inspector's `verb:room:…` event IDs mapped onto it, `findHandlers` and stub planning.
   - `scriptEdits.ts`: merges named imports into the existing `import { … }` lines (keeping one-line / multi-line layout) and appends top-level statements.
   - `speakers.ts`: mirror of `scripts/lib/benneSpeakers.mjs` (parity test), `voiceLines.ts`: speech lines with their character, `contentLocate.ts`: where a content ID is defined (JSON `"id"`, `game-config.json` verb, asset file), `tsPluginFeatures.ts`: the plugin features.
2. **Regex scanning removed**: `verbHandlerPresence.ts` is deleted, and so are the four `gui*Scaffolding.ts` files (one `guiControlScaffolding.ts` replaces them) and the regex parts of `playFromDiscovery.ts`, `roomScriptNavigation.ts`, `voiceIdProcessor.ts` and `delete/deleteService.ts`. `src/scriptHandlers.ts` is the extension-side glue: handler presence (`handlerQuery`, one parse per script for all of an Inspector card's chips), `ensureHandler` (reveal, or add the stub + imports; regenerates the handles once when a target is new), `revealHandler`.
3. **Consumers on the ScriptModel**: Inspector verb chips (props, hotspots, room characters, character definitions, items), "item used on" chips, region, room-lifecycle and GUI-lifecycle chips; every "add handler" / "reveal handler" command and Inspector action; the Actions tree (its hints now read `battery.onLook`); Play From discovery (Room preview dropdown); voice IDs and the speaking-text CSV; delete impact ("used in these scripts").
4. **Scaffolding emits the new syntax**: verb, item, region, room-hook, GUI-hook, control, dialog-choice and Play From stubs (§9 as built); new room scripts start with `room.onEnter(() => { … })` (the generator now runs right after the room JSON is written); new character, item, GUI and dialog scripts are a comment with a new-style example. Command titles and Inspector texts no longer mention `B.when…` / `registerRoomScript`. Play From names may contain spaces.
5. **TS server plugin** (`tsServerPlugin.ts`; `roomScriptIdTsPlugin.ts` is now only the bundle entry, so the plugin can be unit-tested): speaker diagnostics (codes 90001–90004, the transform's messages), `Hank: "$1"` speaker completions, string-union values first and matching without quotes, go to definition from handles to their JSON or asset. The old-API quoted-ID filter is kept for the templates.
6. **Extension**: `stringUnionSuggest.ts` opens suggestions after `(` / `= ` in script files when the TS server has quoted values there (decision 41); BenneScript snippets `room-enter`, `cutscene`, `choice`, `use-item`; the Inspector shows the game-level default verb (decision 8) instead of a hard-coded `look`, and writes an explicitly chosen verb to JSON; `runGenerateGameIds` lets a caller wait for a run already in progress.
7. **Tests**:
   - `tests/unit/editorScriptModel.test.ts` (13): speaker parity with `benneSpeakers.mjs`; `IdsIndex` names and reverse lookup; every registration receiver in all 41 AI Apocalypse scripts resolves; club chips, multi-verb `on([…])`, `doNotActivate`; Play From names match the smoke tests' list (10); **every label the build transform turns into speech is found**; every literal line gets a character; stub and import insertion.
   - `tests/unit/editorTsPlugin.test.ts` (6): the plugin on a real language service over AI Apocalypse (diagnostics, speaker completions, literal promotion, go to definition for a hotspot, item, region, dialog option and music track) and **every stub kind type-checks and builds** when added to `club.room.ts`.
   - Extension tests (`npm run test:extension`): voice-ID tests rewritten for the new syntax (7); `authoring.test.ts` checks handler detection on a copy of the club room and runs **Inspector "add handler" on an AI Apocalypse prop** in the VS Code host.
   - `scripts/lib/generateGameHandles.d.mts` added so TypeScript tests can import the generator.

### Exit-check details

- **Inspector "add handler" on a prop in AI Apocalypse** (`addPropVerbEvent`, what the Inspector's `+ Look at` chip runs) on the club's `bg` prop: appends `bg.onLook(() => {\n  // TODO: Look at\n})` and adds `bg` to the existing `import { … } from './club.ids'`; a second click reveals the handler instead of adding another. The same file then gets `outside.onTake`, `car.onAnyItem`, `room.onEnter` and the guarded `onUpdate`; all of them type-check against the real generated handles and pass the build transform (unit test).
- **Voice-ID export** on the ported game: 579 lines (430 labels, 149 `say` block lines) for all ten characters (hank 276, jensen 135, botti3 46, driver 35, curator 29, barista 18, botti3-disembodied 17, customer 11, scientists 10, botti3-27 2). The build transform rewrites 431 labels and 149 block lines in the same files; the one line the export skips (and reports) is `Player: game.config.defaultFallbackLine ?? "…"` in `globalScript.ts`, which has no literal text to mark.
- **Plugin through a real `tsserver`** (scratch script driving the protocol with the built bundle, as VS Code loads it): unknown-speaker diagnostic, definitions landing in `club.room.json` / `wrench.inventory.json`, the `Hank: "$1"` snippet entry, quoted `face(` values first.

### Deviations from the spec

Decisions 38–42 in §13, with the "as built" note in §9:

- **38:** the editor reads the generated `.ids.ts` modules for names (no second copy of the naming rules); speaker rules are mirrored, with a parity test.
- **39:** old-API scripts are left alone: no chips, no stubs (a new-style statement in an old-style file would get its old callbacks rewritten by the transform). Template games show no handlers until Phase 6 ports them.
- **40:** the handler each Inspector action stands for (`onAnyItem` for "item used on", one checkbox `onChange`, no submit / per-object fallback handler, `onUpdate` guarded by the room, Play From names with spaces, stubs appended at the end).
- **41:** string-union quotes come from TypeScript's own completions, promoted by the plugin; the extension opens the list after `(` / `= `.
- **42:** TypeScript is bundled into the extension (packaged `dist/extension.js`: about 4 MB, minified); creation templates.

### Known issues

- **Templates are still old-API**, so a game created from them gets no Inspector chips or stubs until Phase 6 ports them (decision 39). `gameCreationScaffolding` copies the templates and emits nothing itself.
- **Old-API editor support still in the extension** for Phase 6 to delete: `benneScriptIdCompletion.ts`, `dialogCompletion.ts` (quoted-ID completions after `B.…('`) and the quoted-ID filter in `tsServerPlugin.ts`. They only trigger on old-API call shapes.
- Handles are found through the **generated modules**: until the generator has run (dev server, `npm run typecheck`, or the editor's own regeneration on JSON changes), a brand-new prop has no handle; "add handler" regenerates once itself.
- Registrations whose receiver is a **local variable** (`for (const [verb, button] of buttons) button.onClick(…)` in `verbs.gui.ts`) can't be attributed to a control; top-level `const x = a.b` aliases can. Speech through a variable (`who.say(…)`) is reported as skipped by the voice tools.
- The string-union trigger asks the TS server for completions on every `(` / `= ` typed in a script file; it's asynchronous and only opens the list when quoted values exist.

### Exit checks

| Check | Result |
|---|---|
| `npm run test:extension` | ✅ 21/21 (voice-ID tests rewritten; add-handler and detection tests on the real club room) |
| Inspector "add handler" on a prop in AI Apocalypse inserts a correct new-style handler | ✅ `bg.onLook(() => { … })` + merged import, in the VS Code host; all stub kinds type-check and build (unit test) |
| Voice-ID export finds all speech lines in the ported game | ✅ 579 lines, matching the transform's 431 labels + 149 block lines; the one skip is the non-literal fallback line, reported |
| `npm run test:playthrough` | ✅ 14/14 (12.4 min) |
| `npm run check` | ✅ |
| `npm run test:unit` | ✅ 144/144 (19 new) |
| `npm run test:artifacts` (VSIX with the new plugin/bundle, both templates, desktop, itch) | ✅ |
| Plugin through a real `tsserver` | ✅ diagnostics, completions and go to JSON (scratch script, see above) |

### Notes for Phase 6

- Port the templates, then delete the old-API editor support listed under Known issues, and drop the `usesOldApi` branches in `scriptHandlers.ts` / `scriptModel.ts` (decision 39).
- The Inspector webview still uses old hook names on the wire (`whenEnterRoom`, `onGuiBuilt`, `guiEnsureCheckboxCheckHandler`); only the labels changed. Renaming them is optional cleanup.
- The `media/inspector/inspector.js` bundle was rebuilt by the extension build.

---

## Phase 6: Templates, delete the old API, merge preparation (2026-10-06)

### Done

1. **Template test harness** (built first, so the ports could be checked against the old templates):
   - `scripts/template-workspace.mjs <template> [--serve <port>]` builds a throwaway workspace in the OS temp dir: this repo's engine, scripts and root configs (as `test:artifacts` copies them), the template as `src/game`, `node_modules` symlinked. `src/game` is never touched.
   - `npm run test:templates` (`playwright.templates.config.ts`, `tests/templates/`): one dev server per template (ports 4191 / 4192; 4181 was held by a stray `vite preview` from an earlier session, which I left alone) and one spec per template. Each spec plays the whole template through the dev/test hooks and checks every handler: the exact lines spoken, in order, plus flags, inventory, prop state, the active player and the game / settings / save / load menus. **Both specs passed against the templates on the old `B` API before any port** (9-verb 2.4 min, 2-click 1.7 min); they are unchanged since.
   - Hooks (`src/engine/testing/benneTestHooks.ts`): `speech()` records every line where it is shown (wrapping the room's `setDialogTextOverlay`), the same for any scripting API (the old free-scope `` B.say`…` `` block never logged to the console); `state().player`; an optional verb on `useItem` / `combine` (Give); `inventoryVerb` drops the armed item first, as `verb` already did.
2. **Templates ported** (`game-templates/9-verb`, `game-templates/2-click`), following the AI Apocalypse ports:
   - Config (§8.5): `"usesItem": true` on `use` / `give`, `"defaultVerb": "look"`. 9-verb's `window` hotspot got `"scriptName": "windowHotspot"`, so new games don't print a browser-global warning on every regeneration.
   - `state.ts` with the two flags; `globalScript.ts` keeps one fallback per verb, and the any-room hooks and `onUpdate` become a comment showing the syntax.
   - Rooms, dialogs, items, characters and the GUIs (game, save, load and settings menus, the 9-verb verb bar, the 2-click hover text and sliding bars) on the new API. Empty `void B` scripts deleted (§4.9): 9-verb `hank.character.ts`, `Key` / `Knife` inventory scripts, the empty `dialog` / `display-text` / `speaking-text` GUI scripts in both; 2-click `penny.character.ts` and `hank.character.ts` (the player can't click himself). Empty `// TODO` handlers that change behaviour are kept (2-click Henry's and the Lantern's Look silence the global fallback).
   - Size (non-blank lines / non-whitespace characters): 9-verb 872 → 536 / 26,169 → 13,166 (−50%), 2-click 774 → 476 / 21,511 → 11,682 (−46%), including the new `state.ts`.
3. **API additions the templates needed** (decision 45): `player.switchTo(character)`, `character.startFacing(target?, { minWait, maxWait })` / `stopFacing()`, settable `pointer.item`.
4. **Transform fix** (decision 46): `items.x.onUse.doNotActivate(() => { Hank: "…" })` failed the build ("speech line outside a handler"), because the callee's method name is `doNotActivate`, not `on…`. AI Apocalypse never used it; the templates do. The transform now treats `x.onY.doNotActivate(fn)` as a registration (unit test added). The editor's mirror of the rule already did.
5. **Old API deleted**: `src/engine/scripting/` is gone (33 files: `register*Script`, `B`, `BenneScriptCore` and its subclasses, the facades, `interactionTail` / `chain`, `BlockingWithNow` / `withNow`, the `when*` sugar, the script contexts). What other code used moved to engine modules (decision 43): `dialog/dialogSession.ts`, `gui/GuiRuntime.ts` (immediate operations only), `scenes/roomScriptModules.ts`, `scenes/playFromRegistry.ts`, `scenes/wireRoomTransitions.ts` (replaces `wireBenneGlobalScripts`), `bennescript/onUpdateRegistry.ts`, `bennescript/speech.ts`, `bennescript/verbClickTarget.ts`, `verbs/verbContext.ts`, `dialog/speechSettingsEvents.ts`, `benneEnvironment.ts`. `ItemHandle` reads and writes item state directly instead of through the old inventory facade.
   - **`VERB_ALIAS_CANDIDATES` and the use/give alias lists** are gone (decision 44). `resolveDefaultItemVerbId` picks `use` when it is an item verb, else the first `usesItem` verb; the engine arms an item whose item verb has no handler (no fallback line), so JSON-only items follow the same rule as scripted ones (the Phase 4 known issue).
   - **Phase 1 side-by-side routing removed**: `RoomScene` no longer builds room / character / inventory script contexts or old GUI scripts (every GUI gets a runtime); the orchestrator no longer drains script queues after enter hooks or resets interaction tails on leave; the choice-list hide/show no longer pops a `whenChoice` cutscene (`hideDialogChoicesWhileChoiceRuns` / `showDialogChoicesAfterChoice`); the transform's import test (decision 14) is gone, so every script file is transformed; the hook registry's `when*AnyRoom` methods are `registerAny*Room`.
   - **Boot** (`registerGameContent.ts`, all three copies, edited by hand): just imports the script modules (rooms lazily). Also fixed the Phase 0 known issue: blank GUI font ids (icon-only buttons) are no longer reported as unknown fonts (`loadGuiData.ts`), so the playthrough's ignored-error list is empty now.
   - **Editor**: deleted `benneScriptIdCompletion.ts`, `dialogCompletion.ts` and the TS plugin's quoted-ID filter; dropped `usesOldApi` (decision 39); the Inspector's message protocol now uses the hook names (`onEnter`, `onLoaded`, `onEnterAfterFade`, `onBuilt`, `onShow`, `onHide`); the "Open room script" command is `benne-editor.revealRoomScript`.
   - **e2e fixture game** (`tests/fixtures/game`) ported, with a `state.ts`; `scripts/serve-test-game.mjs` now generates its handles and loads the BenneScript plugin. Its "save" hotspot saves from a `background` block once the click's handler has ended, because saving is refused during an interaction (decision 2).
   - Every comment and DEV warning that named `B.*` / `when*` now names the BenneScript call or the engine behaviour.
6. **`switch-game-template.mjs`** skips generated `*.ids.ts` files when syncing a game into a template (it would have copied them into `game-templates/`, where they weren't gitignored); `.gitignore` also ignores `game-templates/**/*.ids.ts`.
7. Extension bundle rebuilt (`npm run build:benne-play`).

### Old-API search (exit check)

The search below looks for `register*Script`, `BenneScriptCore` and the `*BenneScript` classes, `interactionTail`, `BlockingWithNow`, `withNow` / `withNowResult`, `*ALIAS_CANDIDATES`, `engine/scripting`, every `when*` sugar and binding name, `B.<anything>`, `({ B })`, `usesOldApi` and `onGuiBuilt/Show/Hide`.

```bash
PAT='\bregister(Room|Character|Inventory|Dialog|Gui|Global)Script\b|BenneScriptCore|\b(Global|Gui|Dialog|Inventory|Character)BenneScript\b|interactionTail|BlockingWithNow|\bwithNow(Result)?\b|ALIAS_CANDIDATES|engine/scripting|\bwhen(LookAt|Use|PickUp|Give|TalkTo|Push|Pull|Open|Close|Verb|GlobalVerb|GlobalFallback|InventoryUsedOn|InventoryOnVerbTargetUnhandled|Choice|ButtonClick|AnyButtonClick|EnterRoom|EnterRoomAfterFade|LeaveRoom|LoadedRoom|EnterAnyRoom|EnterAnyRoomAfterFade|LeaveAnyRoom|LoadedAnyRoom|EnterRegion|ExitRegion|MouseEnter|MouseLeave|CheckboxCheck|CheckboxUncheck|VerbUnhandled|ValueChanged|SelectionChanged|Submit|ItemActivated)\b|\bB\.[a-zA-Z]+|\(\{ ?B ?\}\)|usesOldApi|onGui(Built|Show|Hide)\b'
git ls-files -co --exclude-standard | grep -vE '^benne-editor/media/|^benne-editor/scaffold/|\.ids\.ts$|package-lock' \
  | grep -vE '\.md$' | grep -E '\.(ts|mjs|js|cjs|json|tsx|html|css)$' | xargs grep -nE "$PAT"
```

**Result: 0 matches in code** (engine, game, templates, editor, scripts, tests, configs). The built bundles in `benne-editor/media/` are regenerated output.

Markdown still matches, and is Phase 7's to rewrite or keep as history:

| File | Matches | Note |
|---|---|---|
| `benne-snapshot.md` | 1,328 | A Repomix dump of the codebase, already stale; regenerate it or delete it |
| `docs/bennescript-api.md` | 394 | Phase 7: rewrite |
| `docs/architecture.md` | 213 | Phase 7: scripting sections |
| `docs/public/bennescript.md` | 148 | Phase 7: rewrite |
| `docs/bennescript-ergonomics-refactor.md` | 108 | History: the "today" examples and the translation guide |
| `docs/public/sound-voice-and-video.md` | 33 | Phase 7 |
| `docs/engine-review-2026-10.md` | 23 | History |
| `docs/bennescript-refactor-log.md` | 21 | History |
| `docs/public/game-configuration.md` | 9 | Phase 7 |
| `docs/feasibility-custom-language-and-native-editor.md` | 8 | History |
| `docs/public/benne-editor.md` | 7 | Phase 7 |
| `docs/public/core-concepts.md` | 6 | Phase 7 |
| `docs/codex-suggestions.md` | 3 | History |
| `docs/testing.md`, `docs/public/publishing-games.md`, `docs/public/introduction.md` | 1 each | Phase 7 |

### Old `B` features without a BenneScript equivalent (decision 48)

Nothing in AI Apocalypse or the templates uses these, so no handle was added; the engine code behind them stays. Decide which ones the new API needs before merging (or later):

| Old | Engine support left |
|---|---|
| `B.video.pause` / `resume` / `seek` / `isPlaying` | `RoomScene` video layer |
| `B.speechSettings.showText`, `msPerCharacter`, `minDurationMs`, `maxDurationMs`, `defaultTalkOffset` (only `textSpeed` and `clickToSkip` are in `settings`) | `speech:*` game-state variables |
| `B.dialogSettings.choiceOptionsViewportHeightPx`, `usedColor` | `dialog:*` game-state variables |
| `setSpeechPosition` / `setSpeechOffset` / `resetSpeechPosition` on characters and the player | saved per character; the room reads them |
| `isFollowing` / `followingTarget` getters | follow state in the game state |
| `B.whenAnyButtonClick`, list-box `whenItemActivated`, text-input `whenSubmit` (decision 40 already noted submit) | the GUI events still fire |
| checkbox `disabled`, text-input `focused` | `ControlFacade.disabled` / `focused` |
| `B.whenLoadedAnyRoom` (any-room `onLoaded`) | hook registry `registerAnyLoadedRoom` |
| `B.whenVerbUnhandled` (the 9-verb DEV diagnostic used it) | `verb:unhandled` event |
| `B.sound.isPlaying(id)`, `pointer.verb = null` (clear the verb), `B.onSpeechSettingsChanged` for GUIs | sound manager, game state, speech-settings event |
| `B.state.renameSave` / `exportJson` / `importJson`, `clearInventory` on a character | `GameStateManager` |
| `B.raw` (escape hatch to the scene) | — |

### Merge preparation (not done; for when you decide to merge)

The repository's main branch is **`master`** (not `main`). `master` has not moved since the branch point (`9d04db8`), and its `src/game` is exactly its `game-templates/9-verb` plus `boot/`, so the switch means: `src/game` becomes the ported 9-verb template.

Order matters, because Phase 7 builds its docs, skill and cursor rule from the AI Apocalypse scripts:

1. **Run Phase 7 first**, on this branch, while `src/game` is still AI Apocalypse.
2. **Keep the ported AI Apocalypse.** Copy `src/game` (scripts, `state.ts`, configs) to the AI Apocalypse repository, or keep this branch, before switching (§14.5). It isn't recoverable from `master` after a squash merge.
3. **Switch `src/game`**: `npm run set-template:9-verb -- --yes`. With `src/game` named `ai-apocalypse` (no template folder), it skips the sync-down, syncs `boot/` into both templates (identical already), wipes `src/game` and copies `game-templates/9-verb` in, `boot/` included. (Not run on this branch, per the standing instructions.)
4. **Regenerate and commit** `src/types/generated/benne-game-ids.d.ts` (`npm run generate:game-ids`; `check:generated` fails until then).
5. **Rebuild the extension bundles** in `benne-editor/media/` (`npm run build:benne-play`, and the previews via `npm --prefix benne-editor run build:previews`). Today they carry AI Apocalypse's assets.
6. **Retarget the tests that read AI Apocalypse in `src/game`:**
   - `tests/playthrough/playthrough.spec.ts` and `cafe.spec.ts`: replace with the 9-verb spec, run against `src/game` (move `tests/templates/9-verb.spec.ts` into `tests/playthrough/` and drop the 9-verb project from `playwright.templates.config.ts`, or keep both).
   - `tests/playthrough/inventory-look.spec.ts`: uses the magnet and mop; point it at a 9-verb item with a Look line (the Broom: "The broom is a broom.").
   - `tests/playthrough/play-from.spec.ts`: generic (scans the rooms); finds 9-verb's `gotKey` and `doorUnlocked`.
   - `tests/unit/editorScriptModel.test.ts` (41 scripts, the club, 579 voice lines, 10 Play From names), `tests/unit/editorTsPlugin.test.ts` (club diagnostics and definitions) and `benne-editor/src/test/authoring.test.ts` (`clubGameCopy`): rewrite against the 9-verb rooms (the apartment has a prop, a hotspot, a region, a character and Play From).
   - Not affected: `handleGenerator.test.mjs`, `bennescript*.test.ts`, `voiceIdProcessor.test.ts` (synthetic games), the e2e fixture game.
7. **Docs and config**: `docs/testing.md` (the playthrough is no longer AI Apocalypse); remove the "BenneScript refactor" section from `CLAUDE.md`; consider adding `test:templates` to `test:nightly`.
8. **Merge without the AI Apocalypse blobs.** Commit `76e7395` added ~88 MB of AI Apocalypse assets; a normal merge puts them in `master`'s history for good, even after step 3 deletes them (decision 11 only accepted them on this branch). Squash-merge (one commit, 9-verb in `src/game`) keeps them out; the cost is losing the per-phase commits on `master` (the branch keeps them). Alternatively rewrite the branch to drop the assets from `76e7395` before merging.

### Deviations from the spec

Decisions 43–49 in §13, with as-built notes in §4.3, §4.15, §6.1, §8.4, §10 and §11.1: what replaced `src/engine/scripting/` (43), engine arming and the default item verb (44), `player.switchTo`, `startFacing` and a settable `pointer.item` (45), every script file transformed plus the `doNotActivate` fix (46), the template ports' intended differences (47), old features left without a BenneScript equivalent (48), and `npm run test:templates` (49).

### Known issues

- **The old features in the table above** have no BenneScript access until someone adds it.
- `src/types/generated/benne-game-ids.d.ts` (the quoted-ID unions the old API used) is still generated and committed; `src/types` re-exports its types and one engine helper uses `ResolvableTargetId`. It could be retired in a later cleanup.
- Hover-slide tweens in 2-click's menu and inventory bars now run at once instead of queueing, so a quick enter → leave lets the leave tween take over mid-slide (it ends at the right place).
- As in earlier phases, rebuilding the BENNE Play bundle reshuffled Rolldown's deduplicated sprite names (`talk D3.gif`, `talk d.gif` are new files in `benne-editor/media/benne-play/assets/`).

### Exit checks

| Check | Result |
|---|---|
| No references to the old API remain | ✅ 0 matches in code (search above); Markdown matches are listed for Phase 7 |
| `npm run test:ci` (check, unit, desktop, pathfinding) | ✅ unit 145/145, desktop 3/3, pathfinding passed, content 0 new errors |
| `npm run test:playthrough` on AI Apocalypse | ✅ 14/14 (12.0 min; main playthrough 9.0 min) |
| `npm run test:templates` (new) | ✅ 4/4 (9-verb 2.4 min, 2-click 1.7 min), same results as on the old templates |
| `npm run test:e2e` (ported fixture game) | ✅ 4/4 |
| `npm run test:extension` | ✅ 21/21 |
| `npm run test:artifacts` (VSIX package, scaffold, both ported templates built standalone, desktop, itch) | ✅ |
| Boot parity (`src/game/boot` = both template `boot/` folders) | ✅ (edited by hand; no sync scripts run) |

### Notes for Phase 7

- Docs to rewrite are in the search table above. `docs/public/bennescript.md` and `docs/bennescript-api.md` have the most; `benne-snapshot.md` is a stale Repomix dump.
- Run Phase 7 before the merge switch: it should take its examples from AI Apocalypse while it is still in `src/game` (merge step 1).
- The templates are short, complete examples of every common pattern (verbs, item on item, `doNotActivate`, dialogs, GUIs, `playFrom`, player switching), useful for the agent skill.

---

## Phase 6 follow-up: parity with the old `B` API (2026-10-06)

You asked for every feature in the Phase 6 table "Old `B` features without a BenneScript equivalent" to be ported, with `B.raw` left open. A second, member-by-member audit of the deleted API (from `7fc0ab9`) found five more gaps; they are ported too. Spec: decision 50, §4.21 (new) and as-built notes in §4.3, §4.4, §4.6, §4.11, §4.15, §4.16, §4.17, §11.1.

### Old → new

| Old `B` | BenneScript |
|---|---|
| `B.raw.on` / `once` / `off` / `emit` | `events.on` / `once` / `off` / `emit` (§4.21). Engine event names are completed; in a room script a listener is live only while that room is active, as `B.raw` was |
| `B.video.pause` / `resume` / `seek` / `stop` / `isPlaying()` | `video.pause()`, `resume()`, `seek(s)`, `stop()`, `isPlaying`, plus `video.current` and `video.x.isPlaying` |
| `B.sound.isPlaying(id)`, `B.sound.stop()` (no id: every sound) | `sfx.x.isPlaying`, `sfx.stopAll()` |
| `B.speechSettings.showText` / `msPerCharacter` / `minDurationMs` / `maxDurationMs` / `defaultTalkOffset` / `durationMultiplier` / `clickToSkip` | `settings.speech.*`, same names (`settings.textSpeed` / `clickToSkip` stay) |
| `B.dialogSettings.choiceOptionsViewportHeightPx` / `usedColor` | `settings.dialog.*`, same names; `undefined` clears |
| `B.onSpeechSettingsChanged` | `settings.onChange(fn)`, for any setting |
| `setSpeechPosition(x, y)` / `setSpeechOffset(x, y)` / `resetSpeechPosition()` on characters and the player | `jensen.speechPosition = { x, y }`, `jensen.speechOffset = { x, y }` (`null` clears), `jensen.resetSpeechPosition()`; the same on `player` |
| `isFollowing` / `followingTarget` | `isFollowing`, `followingTarget` (a handle, or `player`) on characters and `player` |
| `B.player.startFollowingCharacter` / `stopFollowingCharacter` *(audit)* | `player.startFollowing(target)` / `stopFollowing()` |
| `B.whenAnyButtonClick((id) => …)` | `gui.onAnyClick((button) => …)`, with the clicked control's handle |
| `control.whenSubmit((text) => …)` | `input.onSubmit((text) => …)` |
| `control.whenItemActivated((index) => …)` | `list.onActivate((index) => …)` |
| checkbox `disabled`, text-input `focused`, list-box `rowCount` | `enabled` (now covers checkboxes), `focused`, `rowCount` |
| `B.whenLoadedAnyRoom` | `game.onLoadedAnyRoom(fn)` |
| `whenEnterRoom(fn, { skippable: false })` & co. *(audit)* | `room.onEnter(fn, { skippable: false })`, and on `onEnterAfterFade`, `game.onEnterAnyRoom`, `game.onEnterAnyRoomAfterFade` |
| `B.whenVerbUnhandled` | `fallbacks.onUnhandled((verb, target) => …)` |
| `B.state.isCutsceneActive` *(audit)* | `game.isCutsceneActive` |
| `B.clearActiveVerb()` / `setActiveVerb` | `pointer.verb = null` / `pointer.verb = verbs.look` |
| `B.state.save(name)` / `load(name)` / `deleteSave(name)`, named saves without a slot *(audit)* | `saves.save('checkpoint')`, `saves.load('checkpoint')`, `saves.delete('checkpoint')`, `saves.get('checkpoint')`; `saves.list()` includes them (`slot: null`) |
| `B.state.renameSave` / `exportJson` / `importJson` | `saves.rename(save, name)`, `saves.export()`, `saves.import(json)` (reloads the imported room and ends the handler, like `saves.load`) |
| character inventory `clearInventory()` | `inventory.clear()`, `jensen.inventory.clear()` |
| `whenInventoryUsedOn.doNotClear(…)` *(audit)* | `{ doNotClear: true }` as the last argument of any item handler (`onUseItem`, `onItem`, `onAnyItem`, `onCombine`, …) |

**On `B.raw`:** it was the old API's only way to react to engine events (the docs pointed scripts at `B.raw.on('gameState:inventoryChanged', …)`) and to send events between scripts. Nothing else in BenneScript covered either, so it is still needed. `events` keeps its four methods, but listeners are BenneScript handlers (their lines are sequenced), and the editor completes the engine's event names.

### Changes outside the API

- Generator: `sfx = withSfxControls({…})`, `video = withVideoControls({…})`; `stopAll` (sfx) and `pause` / `resume` / `seek` / `stop` / `isPlaying` / `current` (video) are reserved like the `music` controls; item-verb methods take the options argument. `events` is a reserved flat name.
- Transform and editor: `x.once(fn)` callbacks are handlers (`events.once`), like `on…`.
- `RoomScene.getRoomVideoKey()`; `ControlFacade.enabled` covers checkboxes.
- The e2e fixture saves to a named save again (`'checkpoint'`), as before the port.

### Not ported (confirmed after review)

- **String-keyed flags and variables**: `B.state.getFlag('x')` / `setFlag` / `hasFlag` / `clearFlag` and the variable equivalents. Typed `flags` / `vars` declared in `state.ts` replace them by design (§4.7); a game that builds flag names at runtime would put an object in a var instead.
- **`B.state.flush()`** (saves and room changes flush positions themselves) and **`B.state.setCurrentRoom()`** (room changes set it). Neither does anything a script needs now.

### Tests

- `tests/unit/bennescriptParity.test.ts` (13): every row above against the real runtime with a fake game: events (global, `once`, `off`, room-scoped attach/detach, transform), sound and video controls, settings and `onChange`, speech position and follow state, the three GUI events and handle mapping, any-room loaded and `skippable` reaching the hook registry, `onUnhandled`, `isCutsceneActive`, `pointer.verb`, `inventory.clear()`, named saves / rename / export / import, `doNotClear` on a room item handler and an item-on-item handler.
- `handleGenerator.test.mjs`: the new generated signatures, and sound / video files named like their namespace's controls are collisions.
- e2e: the fixture's named save round trip (save / load hooks test).

### Checks

| Check | Result |
|---|---|
| `npm run test:ci` | ✅ unit 159/159 (13 new parity tests, 2 new generator assertions), desktop 3/3, pathfinding, content |
| `npm run test:playthrough` (AI Apocalypse) | ✅ 14/14 (11.3 min) |
| `npm run test:templates` | ✅ 4/4 |
| `npm run test:e2e` (named save round trip) | ✅ 4/4 |
| `npm run test:extension` | ✅ 21/21 |
| `npm run test:artifacts` (both templates built with the new `sfx` / `video`) | ✅ |
| Old-API search (code) | ✅ still 0 matches |
| Extension bundle | Rebuilt (`npm run build:benne-play`) |

### Cleanup after review

- **`src/types/generated/benne-game-ids.d.ts` retired.** Its quoted-ID unions (`PropId`, `GuiId`, …) typed the old `B.prop('Door')` calls. Nothing used them any more: `src/types` only re-exported them and one engine helper used `ResolvableTargetId` (now `string`). `generate-game-ids.mjs` writes only the handle modules, `check:generated` checks only that they generate, and `scripts/lib/scanGameContentIds.mjs` (which fed the file) and its unit test are gone. Merge step 4 ("regenerate and commit the ID types") no longer applies.
- **Stopped** the stray `vite preview` on port 4181 left by an earlier session.

---

## Phase 7: Docs (2026-10-06)

### Done

1. **API reference generated from the code.** `scripts/generate-bennescript-api-docs.mjs` (`npm run docs:api`) reads `@benne/script` with the TypeScript compiler API and writes the reference half of `docs/bennescript-api.md` between `<!-- BEGIN GENERATED -->` / `<!-- END GENERATED -->` markers: actions, blocks, script-level registrations, the game-wide objects (`player`, `inventory`, `camera`, `game`, `settings`, `pointer`, `saves`, `events`), every handle class (with the `sfx` / `music` / `video` controls) and the public types. Each row is a signature, how it behaves in a handler (`waits · .now`, `waits`, `ends the handler`, `handler`, `instant`, `settable`, `read-only`) and the first paragraph of its JSDoc. The script fails when an export isn't placed in its layout or a public member has no JSDoc. **`npm run check` now runs `check:docs`**, which fails when the page is out of date.
   - To make that work, **69 public members got one-line JSDoc comments** (`handles.ts`, `actions.ts`, `blocks.ts`, `game.ts`, `saves.ts`; `events` got an object comment). Two comments were reworded: `unhandled()` no longer says "replaces `return false`", and `Task.wait()` keeps the transform detail in a second paragraph. Comments only; no behaviour changed.
2. **`docs/bennescript-api.md` rewritten.** The hand-written half covers what the code can't: reading the tables, where names come from, script files and handler scope, the sequencing rules, talking and voice ids, generated handles and naming, the generated verb methods and config, dispatch order, engine events with payloads, build errors and gotchas, and the source files.
3. **`docs/public/bennescript.md` rewritten** as an author's guide built from AI Apocalypse scripts (the club battery, the plaza entrance, the jensen-in-hallway and botti3 dialogs, the opening crawl, the verb bar, the save menu, the global fallbacks), with the 2-click / 9-verb templates for what AI Apocalypse doesn't use. It is self-contained, since the public docs site can't link into `docs/`.
4. **Other public pages**: `sound-voice-and-video.md` (`sfx` / `music` / `video` handles, voice markers on labels and `say` blocks, the reserved control names), `game-configuration.md` (`usesItem`, game-level `defaultVerb`, verb methods, reserved verb ids, `settings.speech`, `defaultFallbackLine` read by scripts), `benne-editor.md`, `core-concepts.md`, `publishing-games.md` (`game.isDesktop` / `game.quit()`), `introduction.md`. "Bennescript" is spelled "BenneScript" everywhere (decision 6's name).
5. **`docs/architecture.md`**: §7 replaced (the three pieces, generated handles, the transform, the step runtime with the interrupt and save policies, the handler tables and dispatch, sprite animation and every persistence key, speech settings, `onUpdate`, cutscenes and skipping, the GUI runtime, events, editor support, core files). Every other old-API line in §2–§6 and §8–§10 was rewritten, including behaviour Phase 6 changed that the doc still described: `wireRoomTransitions` instead of `wireBenneGlobalScripts`, no queue drains after enter hooks, cancellation on room leave, the generated handle modules instead of `benne-game-ids.d.ts`, engine arming for item verbs without handlers, the scaffolders' new stubs.
6. **`docs/testing.md`**: `check` now covers handle generation and the API doc; new rows for `test:templates` and the BenneScript and generator unit tests; the deleted `scripting/registerRoomScript.ts` row now names `scenes/roomScriptModules.ts`.
7. **Agent skill and cursor rule.** `.agents/skills/bennescript/SKILL.md` (mirrored in `.cursor/skills/bennescript/`, as the repo's Phaser skills are), about 240 lines: the eight rules that matter, files and imports, rooms, verbs, talking, items / state / dialogs, cutscenes and overlap, GUIs / saves / global, a "mistakes to avoid" table, and how to check work. A third copy in `.claude/skills/bennescript/` lets Claude Code pick it up. `.cursor/rules/bennescript.mdc` (scoped to the script globs) is the short version and points at the skill; `benne.mdc` points at both. All three **ship in the extension scaffold's shared files** (`bundle-extension-scaffold.mjs`), so new games get them and Update Engine refreshes them (checked: `npm run bundle:scaffold` copies them and `vsce ls` lists them in the VSIX).
8. **Design doc marked implemented**, with a note that it is now the design record (its "TODAY" examples are history) and pointers to the guide, the reference and the skill. Phase 7 is decision 51; **decision 52** records what an audit of the spec against the code found (below), with as-built notes in §4.4, §4.9, §4.16, §4.18, §5, §6.3, §9 and §12. §11.1, the §13 AI-assistant risk and §14.3 say what's done.
9. **History docs marked.** `engine-review-2026-10.md`, `codex-suggestions.md` and `feasibility-custom-language-and-native-editor.md` keep their old-API examples under a "Historical document" note.
10. **`benne-snapshot.md` regenerated** with Repomix (`npx repomix@latest --style xml`), with the same include and ignore patterns as before except `architecture.md` → `docs/architecture.md` (the old root-level pattern matched nothing). 316 files, ~553k tokens, 2.1 MB; the gitignored `*.ids.ts` modules are excluded. Like the old one, it covers `src/**/*.ts`, `src/**/*.json`, `docs/architecture.md`, `package.json` and `vite.config.ts` only: not `scripts/` (the transform and generator) or `benne-editor/`.
11. One stale code comment fixed: `DIALOG_OPTION_ENABLED_CHANGED_EVENT` named `optionOn` / `optionOff`.

### Spec audit (decision 52)

Generating the reference from the code meant checking every promise in §4–§12 against it. Not built, or built differently (none of these mattered to AI Apocalypse or the templates):

| Spec | As built |
|---|---|
| §4.4: `room.onLoaded` "after assets load, before onEnter" | Runs only when a save loads into the room |
| §4.9: `penny.onLook(…)` in `penny.character.ts` | `characters.penny.onLook(…)`; flat character handles exist only in room modules. `onAnyItem` worked only on room handles (`characters.x.onAnyItem` was ignored with a DEV warning; fixed in the follow-up below) |
| §4.16: `saves.autosave()` | Not built |
| §4.18: timed actions in `onUpdate` are an error | Only speech labels fail the build; other timed calls start every frame and nothing waits |
| §4.18: `alarmLight.alpha = …` on a prop | Props have no `alpha`; `fade(alpha, seconds)` sets it |
| §5: `face(…)` waits | Instant; only `faceClicked()` waits |
| §6.3, §9: an ESLint rule for timed calls; `no-labels` off for scripts | No rule; ESLint doesn't lint game scripts at all |
| §12: a code action inserts braces around `() => Hank: "…"` | Only the snippets do |

### Old-API search (exit check)

The Phase 6 search, run over every Markdown and `.mdc` file:

| File | Matches | Status |
|---|---|---|
| `benne-snapshot.md` | 1,353 → 0 | Regenerated |
| `docs/bennescript-api.md`, `docs/public/*.md`, `docs/architecture.md`, `docs/testing.md` | 0 | Rewritten |
| `docs/bennescript-ergonomics-refactor.md` | 113 | History: the design record's "TODAY" examples and translation guide, under the new status note |
| `docs/bennescript-refactor-log.md` | 64 | History |
| `docs/engine-review-2026-10.md`, `codex-suggestions.md`, `feasibility-…md` | 24, 3, 9 | History, under a "Historical document" note |
| `.agents/skills/bennescript/SKILL.md` (and its mirror) | 1 | The "mistakes to avoid" row that says the old API was deleted |

Code: still 0 matches (the Phase 6 search).

### Deviations from the spec

Decisions 51 (how the docs, skill and rule are built and shipped) and 52 (the audit above).

### Known issues

- **Inspector "item used on this" on a standalone character is broken.** For a character definition it writes `characters.jensen.onAnyItem(() => { … })` into `jensen.character.ts` (`inventoryUsedOnScaffolding.ts` → `handlerSpecs.ts`), and the runtime ignores `onAnyItem` on a handle without a room (DEV warning "only works in a room script"). Fix either side: give character scripts an any-item tier (the engine already has the global any-item channel per target, `continueInventoryOnDispatchAfterGlobal`), or have the Inspector write a per-item `onUseItem` stub there. Room-scoped targets work. **Fixed in the Phase 7 follow-up below.**
- The decision-52 gaps are open if anyone wants them: a DEV warning for timed calls in `onUpdate` is the cheapest useful one.
- The extension bundle wasn't rebuilt: this phase changed only comments in engine code.

### Exit checks

| Check | Result |
|---|---|
| No doc describes the old API except as history | ✅ (search above) |
| `npm run test:ci` (check incl. new `check:docs`, unit, desktop, pathfinding) | ✅ unit 158/158 (159 in the Phase 6 follow-up included the since-removed `scanGameContentIds` test), desktop 3/3, pathfinding, content 0 new errors |
| `npm run check:docs` | ✅ up to date |
| `npm run test:playthrough` (AI Apocalypse) | ✅ 14/14 (11.2 min; main playthrough 8.6 min). A first run had the café spec fail at 47 s with `__BENNE_HOOKS__` undefined (the page reloaded), while I was running `test:ci` and `bundle:scaffold` (which deletes and rewrites `benne-editor/scaffold/`) alongside it; the café spec alone and then the full suite, run with nothing else, passed. |
| Scaffold ships the skill and rule | ✅ `bundle:scaffold` + `vsce ls` |

### Notes for the merge

- Merge prep is unchanged (Phase 6 log). After the switch to the 9-verb template, the docs' AI Apocalypse examples stay valid as examples, but `docs/public/bennescript.md` and the skill name AI Apocalypse's verbs; both say a game's verb methods come from its own config.
- `CLAUDE.md`'s refactor section can go at merge (merge step 7), and `benne-snapshot.md` should be regenerated again after the switch, since it will describe AI Apocalypse's content until then.

---

## Phase 7 follow-up: `characters.x.onAnyItem` (2026-10-06)

The Phase 7 known issue: the Inspector's "item used on this" on a standalone character writes `characters.jensen.onAnyItem(…)` into the character script, which the runtime ignored. Fixed in the runtime, so the Inspector's output is now correct as it was.

- **`registerCharacterAnyItemHandler`** (`bennescript/globalHandlers.ts`) listens on the character's global any-item channel (`verb:inventoryOnCharacterAny:<id>`). The engine already dispatched to that tier (room per-item → room any-item → character-script per-item → **character-script any-item** → unhandled fallback); nothing listened. The handler gets the item and verb handles, as the room version does; when it finishes, the drop policy applies (unless `{ doNotClear: true }`); `unhandled()` goes straight to the "item unhandled" fallback (continuing "after global" would emit the same channel again).
- **`ClickableHandle.onAnyItem`** calls it for handles without a room, instead of warning.
- Docs: decision 52 and the §4.9 as-built note, `architecture.md` (use-on-target), the skill (all three copies) and the regenerated API reference no longer say "room scripts only".
- The skill is also in `.claude/skills/bennescript/` and the scaffold ships that copy too.

### Checks

| Check | Result |
|---|---|
| New unit test (`bennescriptHandleApi.test.ts`): a character-script per-item handler wins over `onAnyItem`; `onAnyItem` gets the item and verb; the drop policy applies; `unhandled()` reaches the fallback | ✅ |
| `npm run test:ci` | ✅ unit 159/159, desktop 3/3, pathfinding, content, `check:docs` |
| `npm run test:playthrough` | ✅ 14/14 (11.3 min) |

---

## Post-Phase 7: closing the decision 52 gaps (2026-10-06)

You asked for the decision 52 gaps to be fixed before the merge, and chose a flat handle for a character script's own character (a question asked during the session). Spec: decision 53 and as-built notes in §4.4, §4.9, §4.10, §4.16, §4.18, §5, §6.3, §7.1, §7.2, §9 and §12; decision 52 now says which items 53 resolves.

### Done

1. **`room.onLoaded` runs only when a save loads into the room, by design.** No code change: the spec's example comment ("after assets load, before onEnter") was the wrong part. The public guide, spec and skill now say `onEnter` is for entering and `onLoaded` replaces the enter hooks on a load.
2. **Character scripts have their own character flat.** The generator writes `characters/<id>/<id>.ids.ts` exporting e.g. `penny` (the same object as `characters.penny`), named with the same rules as other flat scopes (`scriptName`, reserved-name `_`). `generate-game-ids.mjs` cleans stale ones up. In the editor, `siblingIdsModulePath` now covers `*.character.ts`, so the Inspector writes `penny.onLook(…)` with `import { penny } from './penny.ids'`; the `preferGame` workaround in `findBinding` is gone (`sameContent` already tells a room's `penny` from `characters.penny`). The new-character scaffold comment and the three template character scripts use the flat handle. AI Apocalypse has no character scripts.
3. **`saves.autosave(save = 'Autosave')`**: saves at once when `saves.canSaveNow`, otherwise on the first frame where it is (a per-frame handler in `saves.ts`). A later call replaces a pending one; `gameState:replaced` (load, new game) drops it. Takes a name or a slot; doesn't wait.
4. **Timed actions in `onUpdate` throw.** `onUpdate` callbacks run through `runFrameHandler` in a dedicated frame context (they ran through `runDetached` before); `timed()` calls a start guard (`setTimedStartGuard`, set by `interactionContext.ts`) that throws `TimedActionInUpdateError` there, for the blocking form and `.now`. `background` blocks get their own context, so they're allowed. An ending call (`goTo`) just stops the callback. `runOnUpdateHandlers` now logs a failing handler once per message instead of every frame.
5. **`face(…)` waits.** `jensen.face` and `player.face` are timed actions (`faceCharacterTask`, with `.now`), still instant. Found during review: a timed `face` before `walkToClicked()` would have become the handler's first timed step and made the walk uninterruptible, so tasks now carry a `turn` hook (`face` and `faceClicked`) that leaves the interrupt policy's phase alone (§5 rule 9). Unit test added.
6. **ESLint rules** (`scripts/lib/eslint-plugin-bennescript.mjs`, typed): `bennescript/no-unwaited-timed-call` (a timed action or step function inside `onUpdate`, in a non-handler callback or nested function, at the top level, in a plain `.ts` file, or inside an expression; `.now` is fine outside `onUpdate`) and `bennescript/no-await-in-step`. Timed actions are found by type (callable, with a `.now()` returning a `Task`), not by a name list. The transform's step-function detection moved to `scripts/lib/bennescriptSteps.mjs` so both use it. `gameScriptsConfig(…)` is the flat-config block for `src/game/**/*.ts` (minus `*.ids.ts`):
   - this repository's `eslint.config.mjs` uses it, so `npm run lint` (and `check`, `test:ci`) now lint AI Apocalypse: **0 findings**;
   - new games get `eslint.config.mjs`, a `lint` script and `eslint` / `typescript-eslint` dev dependencies (`scaffoldPayload.ts`); Update Engine adds the config only when a game has none.
7. **`() => Hank: "…"`**: still no code action, but the error says what to do. The transform catches the parse error at the colon after `=> Label` and rethrows "A speech line can't be the whole body of an arrow function … Put it in braces: `() => { Hank: "…" }`"; the TS plugin rewrites TypeScript's "',' expected." the same way (`explainArrowSpeechErrors`, on `getSyntacticDiagnostics`).
8. **`alpha`** on props, characters and `player` (and `player.fade`, which was missing): settable, instant, saved, and it stops a running `fade` (a zero-length fade through the existing saved-alpha path). A prop outside its room, or a character not spawned, reads and writes the saved value.

Docs: spec (above), `docs/public/bennescript.md`, `docs/bennescript-api.md` (regenerated, plus the hand-written gotchas), `docs/architecture.md` §7, `docs/testing.md`, the skill (three copies) and the cursor rule.

### Deviations from the spec

None beyond decision 53 itself. Two judgement calls recorded there: `.now` is also an error in `onUpdate` (anything that starts a timed action there would start every frame), and turns don't count for the interrupt policy.

### Known issues

- Prop `visible` / `clickable` / `description` setters still write through the active room (pre-existing): setting another room's prop from elsewhere saves it under the active room's key. `alpha` does it right; the others could follow.
- The lint rules need typed linting, so they run on `src/game` here and in games, but not on `game-templates/` in this repository (its handles aren't generated in place). Checked by hand instead: each template in a `template-workspace.mjs` workspace, with the exact `eslint.config.mjs` new games get, lints clean (exit 0). No automated check covers this; `test:templates` or `test:artifacts` could run it.
- The BENNE Play / preview bundles in `benne-editor/media/` were not rebuilt, so the extension's embedded engine lacks these changes until the next rebuild (merge step 5 rebuilds them anyway).
- A prop's `alpha` outside its room reads 1 when nothing is saved, not its JSON `alpha`.

### Checks

| Check | Result |
|---|---|
| New unit tests (`bennescriptDecision53.test.ts`, `eslintBennescript.test.ts`; additions to `bennescript.test.ts`, `editorTsPlugin.test.ts`, `editorScriptModel.test.ts`, `handleGenerator.test.mjs`) | ✅ |
| `npm run test:ci` (check incl. lint with the new rules, unit, desktop, pathfinding) | ✅ unit 171/171, desktop 3/3, pathfinding, content 0 new errors, AI Apocalypse 0 lint findings |
| `npm run test:playthrough` (AI Apocalypse) | ✅ 14/14 (11.4 min), run alone |
| `npm run test:templates` | ✅ 4/4 (4.3 min) |
| `npm run test:e2e` | ✅ 4/4 |
| `npm run test:extension` (after `bundle:scaffold`) | ✅ 21/21 |
| `npm run test:artifacts` | ✅ |
| Templates linted as new games (see Known issues) | ✅ 9-verb and 2-click, 0 findings |

---

## Decision 53 review fixes (2026-10-06)

A `/code-review high` of the decision 53 work found ten problems; all are fixed. You chose to keep `face` timed and to reserve names for characters (decision 54 in the spec, with as-built notes in §4.18, §5 and §7.2).

### Done

1. **Speech labels hit the `onUpdate` guard.** `sayLine` (what the transform emits for `Hank: "…"`) is built with `timed()`, so a label reached from `onUpdate` through a helper throws `TimedActionInUpdateError` like any other timed action.
2. **Frame errors reach the log, not an unhandled rejection.** Each `onUpdate` callback gets its own frame context (`createFrameRunner` replaces `runFrameHandler`). A step that throws there is reported, and the helper stops at that step: its promise never settles. So `onUpdate(() => { if (x) helper() })`, where the block body drops the promise, no longer rejects every frame. An async callback's returned promise is caught too.
3. **`unhandled()`, ending calls and cancellation are quiet in `onUpdate`**, as they were under `runDetached`.
4. **Logging is bounded.** `reportOnUpdateFailure` logs each distinct message once per callback. After five different messages it logs "keeps failing … not logging it any more" and stops, so the set stops growing.
5. **A replaced fade settles.** `RoomScene` tracks each sprite's running alpha fade (`spriteAlphaFades`). A new fade or `alpha =` stops only that tween and settles its promise, so a handler waiting on `door.fade(0, 2)` carries on. It used to be `killTweensOf(sprite)`, which also killed a running `slideTo` tween and left both promises pending.
6. **`face` stays timed.** For frame code there are three instant alternatives: `startFacing(target)` (now on `player` too, with `stopFacing`), a new read-only `facing` on characters and `player`, and the `TimedActionInUpdateError` message, which names the instant forms (`startFacing`, `facing`, `alpha =`, `saves.autosave()`).
7. **Reserved names are reserved for characters.** The `characters` namespace now follows flat naming rules, so a character has one name everywhere: a character with the ID `dialog` is `characters.dialog_` and `dialog_`. A reserved `scriptName` (e.g. `camera`) is one error at the character ("reserved for characters: …"), whether or not a room spawns it, not one error per module. Room and character modules reuse the name `characters` settled on, so rename warnings aren't repeated. AI Apocalypse's generated output is unchanged.
8. **Update Engine keeps a game's own `lint` script** (`GAME_OWNED_SCRIPTS` in `scaffoldPayload.ts`) and adds the template one only when it's missing.
9. **Arrow-speech detection is shared in the same way as the speaker rules.** The editor's `arrowSpeechLabelAt` / `arrowSpeechMessage` mirror the transform's exports (the CommonJS bundle can't import the `.mjs`), and a unit test checks that the two agree. The `.d.mts` declares the transform's exports.
10. **One alpha path.** `readScriptAlpha` / `writeScriptAlpha` (`actions.ts`) serve props, characters and `player`. A prop handle carries its authored JSON alpha: the generator emits it as a third constructor argument when it isn't 1. Outside its room, `alpha` reads that value instead of 1, which closes the decision 53 known issue.

Docs: spec (decision 54 and as-built notes), `docs/public/bennescript.md` (instant forms in `onUpdate`, the character `scriptName` rule), the skill (three copies), and `docs/bennescript-api.md` (regenerated; `Task.isTurn` got its missing JSDoc).

### Checks

| Check | Result |
|---|---|
| New unit tests: `bennescriptDecision53.test.ts` (label guard, dropped and returned helper promises reported with no unhandled rejection, quiet `unhandled()`, log cap, authored prop alpha), `roomSceneAlphaFade.test.ts` (replaced fades settle; with its own Phaser stub), `handleGenerator.test.mjs` (reserved character names, authored alpha), `editorTsPlugin.test.ts` (arrow-speech parity), extension `authoring.test.ts` (`lint` kept) | ✅ |
| `npm run test:ci` | ✅ unit 181/181, desktop 3/3, pathfinding, content 0 new errors, lint 0 |
| `npm run test:playthrough` (AI Apocalypse) | ✅ 14/14 (11.3 min), run alone |
| `npm run test:extension` (after `bundle:scaffold`) | ✅ 22/22 |

Not run this time: `test:templates`, `test:e2e`, `test:artifacts`. The extension's media bundles weren't rebuilt either; merge step 5 rebuilds them.

---

## Props and hotspots of another room (2026-10-06)

Closes the decision 53 known issue "prop `visible` / `clickable` / `description` setters still write through the active room". Spec: decision 55 and an as-built note in §4.10.

- The issue was worse than the log said. The setters called the active room's scene, which saved under the active room's ID. If that room had a prop with the same ID (most rooms have a `bg`), the setter changed that prop too. `animation`, `fade`, `play`, `moveTo`, `slideTo` and the hotspot `active` / `description` setters had the same problem.
- **`PropHandle` and `HotspotHandle` use their own room** (`ownRoomScene` in `handles.ts`). In that room they go through the scene as before. From anywhere else, `visible`, `clickable`, `description`, `animation`, `alpha` and `moveTo` (props) and `active` and `description` (hotspots) read and write that room's saved keys, which the room applies when it loads. `fade` and `slideTo` jump to their end state; `play` warns (DEV) and does nothing.
- **Reads fall back to the room JSON.** The generator passes the non-default fields as a third argument (`{ visible: false, clickable: true, alpha: 0.4, description: "…", tag: "…" }` for props, `{ active: false, description: "…" }` for hotspots). This replaces decision 54's alpha-only number. The editor's `IdsIndex` reads only the first two arguments, so it needs no change.
- `readScriptAlpha` / `writeScriptAlpha` became the generic `readLiveOrSaved` / `writeLiveOrSaved` (`actions.ts`).

### Checks

| Check | Result |
|---|---|
| New `bennescriptOwnRoomState.test.ts`: a `cafe` `bg` set from the plaza saves under `cafe` and never calls the plaza scene; reads use saved state, then the JSON defaults; `play` warns; own-room props go through the scene; hotspots likewise. `handleGenerator.test.mjs`: the defaults argument | ✅ unit 186/186 |
| `npm run test:ci` | ✅ unit 186/186, desktop 3/3, pathfinding, content 0 new errors, lint 0 |
| `npm run test:playthrough` | ✅ 14/14 (11.3 min) |
| `npm run test:templates` | ✅ 4/4 (4.3 min) |
| `npm run test:e2e` | ✅ 4/4 |
| `npm run test:extension` (after `bundle:scaffold`) | ✅ 22/22 |
| `npm run test:artifacts` | ✅ |

---

## Merge (2026-10-07)

The merge steps from the Phase 6 log, in order.

1. **Docs first.** Phase 7 already took its examples from AI Apocalypse.
2. **The ported AI Apocalypse is kept:** the tag `ai-apocalypse-ported` (on `add3905`, the last commit with AI Apocalypse in `src/game`), and a copy of `src/game` in `~/Projects/ai-apocalypse/src/game` (generated `*.ids.ts` left out; the 14 old-API character and GUI scripts the port removed are deleted there; not committed there). That repository still has the old engine, so it won't build until its engine is updated (§14.5).
3. **`src/game` is the 9-verb template** (`npm run set-template:9-verb -- --yes`, run by you).
4. **Handles regenerated.** `benne-game-ids.d.ts` no longer exists (retired in `5a094a6`), so there was nothing else to commit.
5. **Extension bundles rebuilt** (`build:benne-play`, `build:previews`): the AI Apocalypse assets are gone from `benne-editor/media/`.
6. **Tests retargeted to the 9-verb game:**
   - `tests/playthrough/playthrough.spec.ts` is the old `tests/templates/9-verb.spec.ts` (with a 5-minute timeout; the playthrough config's default is 60 s). `test:templates` now plays only 2-click. `cafe.spec.ts` and `video.ts` (AI Apocalypse cutscene clips) are deleted.
   - `inventory-look.spec.ts`: Look at the Broom, the first starting item (the 9-verb inventory panel's first slot is higher: y 492 instead of 550).
   - `editorScriptModel.test.ts`, `editorTsPlugin.test.ts`, the line-mapping test in `bennescript.test.ts` and the extension's `authoring.test.ts` use the apartment, the outside, `chatwithpenny`, the 9-verb GUIs and items. The Inspector lifecycle stub in `authoring.test.ts` is `onLoaded`, which the apartment doesn't have yet.
7. **Docs and config:** `docs/testing.md` (playthrough and templates rows); `CLAUDE.md` deleted (by you); `docs/architecture.md`'s §7 example is labelled as AI Apocalypse; `benne-snapshot.md` regenerated (239 files); `test:nightly` runs `test:templates`; the spec's §14.3 and §14.5 say the merge is done.
8. **Squash-merged into `master`**, so the ~88 MB of AI Apocalypse assets from `76e7395` stay out of `master`'s history. The branch keeps the per-phase commits. Not pushed.

### Checks (on the branch, before the squash)

| Check | Result |
|---|---|
| `npm run test:ci` | ✅ unit 186/186, desktop 3/3, pathfinding, content 0 new errors, lint 0 |
| `npm run test:playthrough` (9-verb) | ✅ 6/6 (2.6 min) |
| `npm run test:templates` (2-click) | ✅ 2/2 (1.8 min) |
| `npm run test:extension` (after `bundle:scaffold`) | ✅ 22/22 |
| `npm run test:e2e` | ✅ 4/4 |
| `npm run test:artifacts` | ✅ |
