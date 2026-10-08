# BenneScript refactor and subsequent changes: code review

> **Archived 2026-10-07.** Every finding was resolved; the resulting behavior changes are recorded as decision 56 in `docs/bennescript-ergonomics-refactor.md`.

**Current status:** all eleven original findings are addressed. Finding 4's remaining queued-callback lifetime issue is now fixed, with regressions confirmed to fail before the fix and pass afterward. See the [resolution](#resolution-of-the-remaining-gui-issue) for implementation and validation; the earlier reviews below preserve the original findings and evidence.

Reviewed `master`, from `c9237598d29a2a866a7a4ee3bcf8251108aa3de5` (exclusive) through `45bf32f4bb1facf79d8a911e51d89d75a8fbbaf6` (inclusive), on October 7, 2026. This covers 12 commits and 812 changed paths, including the scripting rewrite, engine-update changes, editor authoring enhancements, and the AI Apocalypse template/current-game switch.

The main concern was preserving engine behavior while changing the authoring model. The review covered the transform and generated handles, interaction/task lifetime, dispatch and fallback ordering, room transitions and state, GUI/dialog integration, editor parsing and authoring operations, scaffold/update packaging, templates, and associated validation/tests. Binary assets were exercised through builds/content checks/browser tests; their individual pixels and audio were not manually audited. No product fixes are included in this report.

## Findings

P1 means a serious runtime failure that should be fixed before release. P2 means an actionable correctness or workflow defect under the stated conditions. These are findings in the reviewed changes, rather than a restatement of the earlier architecture review.

| # | Priority | Finding | Primary location at reviewed HEAD |
| --- | --- | --- | --- |
| 1 | P1 | `unhandled()` in a room's `onAnyItem` redispatches the same handler indefinitely | `src/engine/bennescript/roomHandlers.ts:227–229` |
| 2 | P2 | Detached callbacks keep executing after room-change/load cancellation | `src/engine/bennescript/interactionContext.ts:269–277` |
| 3 | P2 | Cancelling an NPC walk settles the task without stopping the walk | `src/engine/bennescript/actions.ts:344` |
| 4 | P2 | GUI `onAnyClick` races the button's own handler | `src/engine/bennescript/guis.ts:139–146` |
| 5 | P2 | Region/walkable handles access the current room instead of their owning room | `src/engine/bennescript/handles.ts:826–853` |
| 6 | P2 | Custom verb names can overwrite built-in handle methods | `scripts/lib/benneVerbs.mjs:103–112` |
| 7 | P2 | Editor analysis cannot resolve namespace imports that editor completion inserts | `benne-editor/src/bennescript/scriptModel.ts:157–166` |
| 8 | P2 | Room deletion misses references to that room's contents | `benne-editor/src/delete/deleteService.ts:65–66` |
| 9 | P2 | Character deletion misses the new dialogue speaker syntax | `benne-editor/src/delete/deleteService.ts:128–130` |
| 10 | P2 | Accepted `scriptName` values can collide with generator implementation bindings | `scripts/lib/generateGameHandles.mjs:326–327` |
| 11 | P2 | Committed API documentation is stale, making `npm run check` fail | `docs/bennescript-api.md:734` |

### 1. [P1] Advance past the room any-item tier when it returns `unhandled()`

**Locations:** [roomHandlers.ts](../../src/engine/bennescript/roomHandlers.ts), lines 227–229; [dispatchInventoryOnVerbTarget.ts](../../src/engine/verbs/dispatchInventoryOnVerbTarget.ts), lines 192–218.

The room `anyItem` listener calls `continueInventoryOnDispatchAfterRoom` when its handler returns `unhandled`. That continuation means “after the room's per-item handler”: its first candidate is the room's any-item event. Because that listener is still present, dispatch immediately selects the same handler again.

```ts
door.onAnyItem(() => {
  unhandled()
})
```

Using an item on this target repeatedly invokes this callback instead of reaching the character/global fallback. An unconditional `unhandled()` produces an unbounded promise/microtask chain and can freeze the game. This affects room props, hotspots, characters and inventory targets using this tier.

**Evidence:** A targeted runtime reproduction limited `unhandled()` to the first invocation to avoid hanging the test process. One input invoked the room callback twice and the final fallback zero times; the correct counts are one and one. The continuation's candidate list establishes the unbounded case.

**Suggested fix:** Distinguish continuation after a room's specific-item handler from continuation after its any-item handler. The latter must skip both room tiers. Add coverage for the complete specific → room-any → character/global → fallback chain, with each tier returning `unhandled()`.

### 2. [P2] Give asynchronous detached callbacks a cancellable lifetime

**Locations:** [interactionContext.ts](../../src/engine/bennescript/interactionContext.ts), lines 203–204, 269–277 and 374–380; [events.ts](../../src/engine/bennescript/events.ts), event subscription runner; [guis.ts](../../src/engine/bennescript/guis.ts), detached lifecycle/control callbacks.

`runDetached` clears `current` before entering a transformed callback. The callback therefore captures the shared `detached` context, which is never registered in the `live` set that `cancelAllInteractions` cancels. These callbacks can contain awaited BenneScript steps, so “detached” does not mean they necessarily finish synchronously.

```ts
events.on('alarm', () => {
  wait(1)
  flags.finished = true
})
```

If this event fires and a room transition or save load occurs during the wait, the old callback still resumes and changes state afterward. Removing its listener does not stop the invocation already running. Because the detached context also has no captured scene, subsequent actions can resolve the new live room. GUI lifecycle/change/select/hover handlers and other users of `runDetached` have the same lifetime hole.

**Evidence:** Executed the real transform on an event handler with a gated timed step. After emitting the event, calling `cancelAllInteractions`, and releasing the gate, its following state assignment still executed. Ordinary tracked handlers do not have this behavior.

**Suggested fix:** Create and track a separate context for each asynchronous callback invocation, capturing its scene and cancelling it with the appropriate room/load lifetime. Preserve the intended non-gameplay activity/lock behavior separately from cancellation. Verify that callbacks begun before a load cannot mutate the loaded state or start actions in the destination room.

### 3. [P2] Stop NPC movement when its walk task is cancelled

**Locations:** [actions.ts](../../src/engine/bennescript/actions.ts), lines 334–344; [task.ts](../../src/engine/bennescript/task.ts), `Task.cancel`.

The player walk wraps its promise with cancellation hooks. The NPC branch simply constructs `new Task(scene.walkCharacterTo(...))`, with no hook to stop the scene's movement. `Task.cancel()` releases the task's promise regardless of whether a hook exists.

```ts
const walk = jensen.walkTo.now(points.exit)
walk.cancel()
walk.wait()
```

The task reports completion and `wait()` returns, but Jensen continues walking. This breaks the documented “stop the action” contract and permits the next scripted action to race ongoing movement.

**Evidence:** Invoked the real character handle/action against an instrumented scene. After cancellation, `task.done` became true while movement remained active and no character-stop operation was called.

**Suggested fix:** Supply NPC walk cancellation and finish-now hooks using the character movement implementation, matching the player-walk task contract. Test physical position/movement state as well as task completion. Audit other task producers with no hooks against the advertised cancellation/skip semantics.

### 4. [P2] Sequence GUI any-click callbacks after the button handler

**Locations:** [guis.ts](../../src/engine/bennescript/guis.ts), lines 93–97 and 135–146.

The specific button event and the GUI-wide event each start an independent `runHandler`. Emitting the specific event first does not wait for that transformed asynchronous handler to finish. The any-click callback therefore runs while the button's sequence is suspended, rather than after it as the API documents. The previous GUI scripting queue serialized these sequences.

```ts
button.onClick(() => {
  wait(1)
  flags.ready = true
})
gui.onAnyClick(() => {
  consume(flags.ready)
})
```

The general handler can observe `false`, perform cleanup too early, or race save/load/menu work initiated by the specific handler.

**Evidence:** Registered both callbacks using the real transform and emitted the two GUI events in button-runtime order. The observed sequence was `any`, then `specific finished` after releasing the timed step.

**Suggested fix:** Run both handlers in an explicit per-click sequence, or await the specific handler's completion before starting the general handler. Define what should happen after cancellation, room changes, or ending calls. Test asynchronous handlers rather than only synchronous flag writes.

### 5. [P2] Use the owning room for region and walkable state

**Location:** [handles.ts](../../src/engine/bennescript/handles.ts), lines 826–853.

Both classes retain `roomId`, but their `active` getters and setters ignore it. They read from `activeRoomScene()` and write through `roomFor(...)` using only the local object ID.

For example, importing room B's `regions.exit` or `walkables.floor` into room A and setting `active = false` disables A's same-ID object and persists A's state. If A has no matching object, the intended update to B is lost instead. Reads also report A's value.

**Evidence:** Constructed handles owned by `room-b` while an instrumented `room-a` scene was active. Both setters called the corresponding room-A mutation with the supplied IDs; neither checked or used `room-b`.

**Suggested fix:** Resolve live state only when the scene matches the handle's `roomId`, and otherwise read/write the owning room's saved state, as prop/hotspot handles already do. If cross-room changes are intentionally unsupported, reject them explicitly rather than changing another room. Cover same-ID objects in two rooms and persistence after entering the owner.

### 6. [P2] Validate generated verb method names against built-ins

**Locations:** [benneVerbs.mjs](../../scripts/lib/benneVerbs.mjs), lines 103–112; [handles.ts](../../src/engine/bennescript/handles.ts), lines 708–721.

The validator checks reserved raw IDs and collisions between generated verb methods. It does not check the generated method names against built-in handle methods. Different spelling/casing can bypass the raw-ID list: `verb-item` generates `onVerbItem`; `AnyItem`, `Item` and `Combine` likewise generate built-in names. An item verb named `any` generates `onAnyItem`.

`withVerbMethods` applies the generated functions with `Object.assign`, overwriting those methods. In particular, replacing `onVerbItem` also breaks otherwise valid generated methods such as `onUseItem`, because they forward dynamically through `target.onVerbItem`.

**Evidence:** The configuration validator accepted a `use` item verb plus `verb-item` without errors. Calling the resulting handle's `onUseItem(key, handler)` reached the replacement generic registration for `verb-item` instead of the original item-specific registration for `use`.

**Suggested fix:** Reserve generated method names, including `on`, `onVerbItem`, `onItem`, `onAnyItem`, `onCombine` and `onWithoutArming`, after normalization. Apply the check to both `method` and `itemMethod` for every applicable handle type. Include casing/hyphen variants in generator tests.

### 7. [P2] Resolve namespace imports in the editor's script model

**Locations:** [scriptModel.ts](../../benne-editor/src/bennescript/scriptModel.ts), lines 157–166; [tsPluginFeatures.ts](../../benne-editor/src/bennescript/tsPluginFeatures.ts), lines 331–350.

The newer other-room completion feature inserts namespace imports such as `import * as outside from '../outside/outside.ids'`. However, `ScriptModel` registers bindings only for `NamedImports`; it ignores `NamespaceImport`. References through the namespace cannot be resolved by the editor services built on this model.

```ts
import * as club from '../club/club.ids'
club.battery.hide()
```

This is valid generated-handle code offered by the editor itself, but dependency/deletion analysis and handler detection lose the content reference. Voice processing also cannot attribute namespace-qualified character method speech through the same resolution path.

**Evidence:** Compared equivalent named and namespace imports against the script-model/index resolver. The named import resolved to the battery hotspot; the namespace version produced no binding or usable content reference.

**Suggested fix:** Represent namespace bindings and resolve their first member against the indexed module exports, then resolve the remaining path. Exercise the exact text produced by other-room completion through handler, dependency and voice-analysis tests.

### 8. [P2] Include room-content dependencies in room deletion warnings

**Location:** [deleteService.ts](../../benne-editor/src/delete/deleteService.ts), lines 65–66.

For a room deletion, `refersToDeleteTarget` matches only `{ kind: 'room', id: roomId }`. A surviving script can instead import a prop, hotspot, point, region, walkable or spawned-character handle from that room's `.ids` module. These references carry the owning `roomId` but fail this predicate.

Deleting `club` while `cafe.room.ts` imports and uses `battery` from `../club/club.ids` therefore omits that dependency from the impact summary. The deletion removes the generated module and leaves the surviving script with an unresolved import/build failure. This reproduces with named imports independently of finding 7.

**Evidence:** The script resolver identifies the imported battery as a hotspot owned by `club`; the room-delete predicate rejects it because its kind is not `room`.

**Suggested fix:** Match references owned by the room as well as the room handle. Also consider direct imports of the module, including unused or type-only imports, because deleting the module breaks those too. Test deletion with references in another room, global scripts and GUI/dialog scripts.

### 9. [P2] Include speaker references when deleting a character

**Location:** [deleteService.ts](../../benne-editor/src/delete/deleteService.ts), lines 128–130; [scriptModel.ts](../../benne-editor/src/bennescript/scriptModel.ts), speech extraction.

The rewritten dependency scanner iterates only `model.references`. The new `Jensen: \`Hello\`` syntax and speaker lines inside `say` blocks are stored in `model.speech`, and need not contain any character-handle expression. A character used only in dialogue can therefore be deleted without that script appearing in the warning.

After deletion, the transform cannot resolve the speaker and the next build fails. This is especially easy to encounter now that speaker labels/backticks are the preferred authoring syntax.

**Evidence:** Parsing a script with a Jensen speech label produces a speech entry but no character handle reference. The delete scanner never examines that entry.

**Suggested fix:** Resolve speech speakers using the same speaker table/rules as transformation and voice tooling, and include their source locations in character dependencies. Cover labels, `say` block lines, IDs/display names, aliases, and the special `Player` speaker.

### 10. [P2] Avoid internal-binding collisions in generated room modules

**Location:** [generateGameHandles.mjs](../../scripts/lib/generateGameHandles.mjs), lines 326–327 and room-module emission.

The flat room scope reserves `room`, `points`, `regions`, `walkables`, reserved language words and public BenneScript names. It does not reserve the generator's imported constructors or helper bindings. An explicitly authored `scriptName` can therefore pass validation and make the emitted module invalid.

A prop with `"scriptName": "PropHandle"` produces the equivalent of:

```ts
import { PropHandle } from '@benne/script'
export const PropHandle = __withVerbs(new PropHandle(/* ... */))
```

This causes TypeScript declaration/use-before-declaration errors and a runtime initialization failure if emitted anyway. `HotspotHandle`, `CharacterHandle` and `__withVerbs` expose the same problem. A `scriptName` is the documented escape hatch for naming collisions, so the generator should either accept it safely or report the collision directly.

**Evidence:** A synthetic room with the `PropHandle` script name returned no generator errors and emitted the colliding import/export; compiling that module reports TS2395/TS2448.

**Suggested fix:** Alias internal imports into a reserved implementation namespace, or reserve every binding emitted in each module before allocating authored names. Test explicit `scriptName` values against all implementation bindings, not just the public DSL.

### 11. [P2] Regenerate the committed API documentation

**Location:** [bennescript-api.md](../bennescript-api.md), line 734, `FallbackTarget.name`.

The target-label enhancement changed the source documentation to “Its verb-line label: description, else name, else id.” The committed generated API still says “The hover description shown in the verb line.” `npm run check` runs the generated-document freshness check and fails on this one-line difference. Consequently, the aggregate check/test/CI path is red before later checks run.

**Evidence:** `npm run check` failed at `check:docs`. Regenerating the API in an isolated copy produced exactly this documentation difference; the production source was not modified to make the check pass.

**Suggested fix:** Run `npm run docs:api` and commit the generated update. Verify `npm run check` passes from a clean checkout, and keep generated-doc verification in CI.

## Validation and limits

The review used source comparison against the requested base, an independent editor/generator/scaffold review, existing suites, and five temporary runtime reproductions for findings 1–5. Those reproduction tests deliberately asserted the observed defective behavior; their passing result confirms the reproductions, not correct engine behavior. They were removed from the working tree after the review.

| Check | Result |
| --- | --- |
| Unit suite | Passed: 22 files, 196 tests |
| TypeScript typecheck | Passed |
| Root lint | Passed |
| `npm run check` | Failed at generated API documentation freshness; finding 11 |
| Content validation, run separately | Passed against its baseline: zero new/zero stale issues |
| Production build of the current AI Apocalypse game | Passed |
| Core browser E2E | Passed: 4 tests, including pointer routing, save/load, repeated transitions and resizing |
| Desktop tests | Passed: 2 tests |
| Pathfinding checks | Passed |
| VS Code extension integration | Passed: 26 tests |
| Fresh 2-click and 9-verb scaffold projects | Both built and linted successfully |
| Targeted runtime reproductions | Five confirmed; findings 1–5 |
| AI Apocalypse playthrough suite | 13 passed, including the full title-to-credits playthrough; one Play From test failed once and passed on a focused rerun |
| 2-click and 9-verb browser playthroughs | Passed: all 4 tests on fresh isolated servers, including both complete games and menu flows |

Content validation's four existing missing-room baseline entries in the 2-click template were not counted as new findings. Existing passing suites do not cover the failure scenarios described above. The standalone repros use the real transform/runtime with small instrumented scenes or event buses; findings 1–5 were not each exercised through the full rendered game. The complete VSIX artifact install/update suite, native Windows/macOS packaging, and manual visual/audio fidelity were outside the executed checks.

The first AI Apocalypse suite run exited nonzero because `Play From plaza › firstVisit` lost its JavaScript execution context during navigation. Repeating just that scenario passed (15.3 seconds). The full title-to-credits test passed in the original run. The isolated navigation failure remains a test reliability observation; the evidence does not establish an additional engine defect.

The first release-template run reused existing dev servers, which disconnected shortly after startup; both games then failed at their first uncached room transition, and the menu tests received connection-refused errors. A clean standard-config attempt also encountered an occupied AI-template port. Rerunning the unchanged 2-click and 9-verb specs with a temporary configuration that starts only their two servers on isolated ports passed all four tests (5.1 minutes). The temporary configuration changed server/output paths, not the test bodies or engine code. These initial infrastructure failures are not counted as engine findings.

## Recommended follow-up order

Fix the inventory fallthrough loop first. Then address callback lifetime, task cancellation and GUI ordering together, with tests that combine asynchronous steps, transitions and loads. Correct room ownership before expanding cross-room authoring. Finally, strengthen generator naming checks and editor dependency analysis, and regenerate the API docs. Each finding above includes a focused verification case so fixes can be reviewed without relying only on the broad happy-path suites.

## Follow-up review of the unstaged fixes

Reviewed the unstaged changes against the eleven findings above, including the new untracked `benne-editor/src/delete/scriptDependencies.ts`. HEAD remains `45bf32f4bb1facf79d8a911e51d89d75a8fbbaf6`. The original review is preserved above as historical evidence; the verdicts below describe the current working tree. No product fixes were made during this follow-up.

**Historical verdict before the requested GUI fix: ten findings fixed; finding 4 partially fixed.** The remaining P2 identified in this review has since been resolved below.

| Original finding | Status | Verification of the current implementation |
| --- | --- | --- |
| 1. Room any-item fallback loop | Fixed | `roomHandlers.ts:232` uses `continueInventoryOnDispatchAfterRoomAny`, whose tier list skips both room handlers. The new regression exercises specific → room-any → character-specific → character-any → fallback, each once, plus an any-item-first case. |
| 2. Detached callback lifetime | Fixed | `interactionContext.ts:272` creates a scene-bound, non-gameplay context per invocation and tracks it in `live` until completion. The event regression cancels a suspended callback, verifies no following write, then verifies a fresh invocation still works without taking a gameplay lock. All existing `runDetached` callers use this implementation. |
| 3. NPC walk cancellation | Fixed | `actions.ts:349–352` supplies stop/finish hooks. Browser probes using the real scene and tweens verified that cancellation physically stops the NPC, and `finishNow()` moves both NPC and Sprite-backed player to the destination and settles the task. |
| 4. GUI any-click ordering | **Partially fixed** | The specific handler now completes before the general callback, and the added tests cover an ending call and cancellation during a suspended handler. The waiting continuation itself has no cancellable lifetime; see the remaining issue below. |
| 5. Region/walkable ownership | Fixed | `handles.ts:840–891` uses `ownRoomScene` and the owner's saved-state keys. Generator output includes authored inactive defaults. Tests cover another room's same-ID objects, persisted reads/writes, authored defaults and live-scene access in the owning room. |
| 6. Generated verb methods collide with built-ins | Fixed | `benneVerbs.mjs:35–45,128–133` checks both generated method names against built-ins. Independent checks covered casing/hyphen variants, `any` as an item verb, and the built-in methods on clickable, inventory and fallback handles. |
| 7. Namespace import analysis | Fixed | `scriptModel.ts:170–172,407–410` records namespaces and resolves their first member through module exports. The original failure now resolves; namespace-based handler detection and voice attribution also pass. |
| 8. Room deletion dependencies | Fixed | `scriptDependencies.ts:43–45,102–115` matches room-owned content and imports of the deleted module. Independent cases included namespace uses, type-only namespace imports and side-effect imports. |
| 9. Character speaker dependencies | Fixed | `scriptDependencies.ts:117–127`, integrated through `deleteService.ts`, resolves speech speakers using the speaker table. Independent cases covered labels, case variants and `say` blocks while excluding unrelated speakers and `Player`. |
| 10. Generator implementation-binding collisions | Fixed | `generateGameHandles.mjs:113–123,188–191,346` reserves internal room-module bindings. All nine reserved bindings were checked independently: each produces a clear generator error without partial output. |
| 11. Stale API docs break aggregate checks | Fixed | Generated documentation is current. `npm run test:ci` now passes through `check:docs` and all subsequent checks. |

### Follow-up [P2]: cancel the pending GUI continuation before it can start after a load

**Location in the unstaged code:** [guis.ts](../../src/engine/bennescript/guis.ts), lines 179–181; the new context captures the live scene at line 172.

`registerGuiAnyClick` waits with `button.then(...)`, but that continuation is outside the contexts tracked by `cancelAllInteractions`. If cancellation occurs after the specific callback has executed but before the general callback starts, its outcome can still be `finished`. The queued continuation then calls `start()`, creates a new context and reads the now-live scene. Cancelling the old context or removing an event listener does not invalidate that pending continuation.

**Confirmed practical trigger:** register a synchronous button handler, an any-click handler that writes state, and an event listener that loads a save from the GUI-wide click event:

```ts
button.onClick(() => {})
gui.onAnyClick(() => { state.value = 'overwritten' })
events.on('gui:menu:allButtons:click', () => { saves.load(0) })
```

On a normal specific-button/general-GUI event pair, `saves.load(0)` cancels live contexts and replaces the state with the saved value. The queued `onAnyClick` subsequently runs and overwrites that loaded value. This was independently reproduced using the real BenneScript transform, GUI/event implementations, `saves.load` and cancellation runtime; only persistence/transition services were instrumented. A separate reproduction also demonstrated the callback starting against room B after cancellation of a click begun in room A.

**Suggested fix:** Give the entire click sequence, including the interval waiting to start the general handler, a cancellable lifetime. Alternatively, record a cancellation generation/token when the click is dispatched and reject its continuation after any load/transition cancellation. Capturing only the original scene is insufficient because same-room loads must also invalidate queued work. Add a regression where the specific handler is already complete and a same-event load occurs before the general callback starts; assert that the loaded state remains unchanged.

### Follow-up validation

| Check | Result |
| --- | --- |
| `npm run test:ci` | Passed, including generated handles/docs, engine/test/extension typechecks, root/extension lint, content validation, 209 unit tests, 2 desktop tests and pathfinding regressions |
| Independent editor/generator review | Original findings 6–10 fixed; 35 focused tests across three files passed, plus independent supported-case probes |
| Core browser E2E | All 4 passed: interaction routing, save/load, repeated transitions, resizing |
| VS Code extension integration | All 26 passed |
| Additional browser movement probes | All 3 passed: NPC cancellation, NPC finish-now, player finish-now. The static-image fixture player was replaced in memory with an equivalent real Phaser Sprite for the player probe. |
| Additional GUI cancellation probes | **Failed the expected-correctness assertions**, confirming the remaining P2 above; independently reproduced with an actual `saves.load` invocation |
| Working-tree whitespace check | Passed |

Temporary reproduction tests were removed from the project; evidence was retained under `/tmp`. The earlier full game playthroughs and template games were not rerun for this follow-up. Existing engine, editor and test changes were left unstaged and unmodified; this report is the only persistent review edit.

### Resolution of the remaining GUI issue

**Finding 4 is now fixed.** In [guis.ts](../../src/engine/bennescript/guis.ts), each button click captures a cancellation generation before its specific handlers run. The existing `onCancelAllInteractions` hook advances that generation on loads/transitions. A queued any-click callback checks its captured generation before starting, so it cannot revive after cancellation even if the specific handler's promise reports success or a newer click replaced its map entry. Later clicks capture the new generation and work normally. Handler ordering and the non-gameplay lock policy are preserved.

Two permanent regressions were added to [bennescript.test.ts](../../tests/unit/bennescript.test.ts): a real transformed `saves.load(0)` listener must preserve loaded state when the any-click is pending, and cancellation must drop multiple queued clicks of the same button. Both tests also verify that subsequent clicks still run. Before the fix, they failed with loaded state overwritten and two cancelled callbacks running; after the fix, both pass.

Validation after implementation: all 39 tests in the BenneScript test file passed, and `npm run test:ci` passed (generated handles/docs, all typechecks and lint, baseline content validation, 211 unit tests across 22 files, 2 desktop tests and pathfinding regressions). The working-tree whitespace check passed. No browser or extension suites were rerun for this small runtime fix. Apart from this report, only `guis.ts` and `bennescript.test.ts` were changed during implementation; all other pre-existing unstaged edits were preserved.
