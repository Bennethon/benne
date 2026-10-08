# BENNE: long-term engineering suggestions

> **Archived 2026-10-07.** Recommendation 2 (script lifetimes and cancellation) and the syntax-aware part of 12 were carried out by the BenneScript refactor. The rest are still open and tracked in [`docs/roadmap.md`](../roadmap.md). Paths and line numbers below are as they were when this was written.

Review date: 2026-10-03.

> **Historical document.** Written before the BenneScript refactor (October 2026). Its scripting examples and file references use the old `register*Script` / `B` API, which no longer exists. For the current API see `docs/public/bennescript.md` and `docs/bennescript-api.md`.

This is a source inspection of the engine, game boot layer, authoring extension, previews, scaffolding/update tools, tests, CI configuration, and documentation. Only this report was added. No application code, configuration, dependencies, or game content was changed. Tests, builds, performance benchmarks, and interactive editor sessions were not run. Concrete source observations are distinguished below from risks that need reproduction and performance hypotheses that need measurement. References are relative to the repository root; line numbers describe this checkout.

## Overall assessment

BENNE has a logical product model: JSON defines adventure content, TypeScript supplies behavior, Phaser presents it, and VS Code provides authoring tools. That is a good foundation for a long-lived adventure engine. Preserve the approachable Bennescript API, asset conventions, reusable runtime previews, and ability to inspect ordinary project files.

The largest investment should be in **ownership and compatibility boundaries**. Engine code currently depends directly on game-specific files; mutable runtime state can share objects with authored definitions; several services live in module globals; and upgrading a game means copying a substantial source tree into it. These are manageable today, but their combined maintenance cost increases as more games depend on older engine versions.

I would continue with the current TypeScript/Phaser/VS Code approach. This inspection does not establish a need for an engine rewrite, a full entity-component-system architecture, or a new editor platform. First make state ownership, script lifetimes, content contracts, and upgrades explicit. Then extract components along those boundaries.

## Existing strengths to preserve

- **Useful separation already exists.** `src/engine/`, `src/game/`, `src/editor/`, and `benne-editor/` distinguish runtime, content, browser previews, and extension-host code. Pure helpers for navigation, dispatch, layout, and persistence provide starting points for further extraction.
- **The engine is designed around adventure authoring.** Room hooks, verb routing, inventory, dialogs, cutscene skipping, region behavior, and Play From are more valuable than generic engine abstractions alone.
- **Preview reuse reduces behavioral divergence.** The room preview reuses `RoomScene`; BENNE Play runs the runtime scene stack. Retain this while reducing editor-specific responsibilities inside the gameplay scene.
- **There is a real regression foundation.** Unit, browser, extension-host, desktop, artifact, pathfinding, and graphics checks exist. CI is broader than a typecheck-only project. `docs/testing.md` candidly lists coverage limitations.
- **Persistence and editor concurrency are already considered.** Saves have v1-to-v2 migration; JSON editing uses per-file queues and dirty-buffer handling; room script imports have isolation and retry tests. Recommendations below extend these mechanisms.
- **Desktop boundaries are deliberate.** `electron/main.cjs:27` disables Node integration, enables context isolation and sandboxing, and restricts navigation. Keep the host API narrow as desktop capabilities grow.

## Current project map

| Area | Current responsibility | Long-term pressure |
| --- | --- | --- |
| `src/engine/` | Gameplay, rendering, state, scripts, audio, GUI | Reusability is weakened by direct imports from `src/game/` and global services. |
| `src/game/boot/` | Content discovery, asset resolution, shared loading helpers | Contains engine-owned integration code inside the game-owned tree; updates explicitly overwrite it. |
| `src/game/` outside `boot/` | Demo content and author scripts | Also serves as the working source for template workflows; keep demo evolution separate from starter guarantees. |
| `src/types/` | Content and API types, generated IDs | Compile-time shapes are not a complete runtime validation contract. |
| `src/editor/preview/`, `src/editor/play/` | Phaser authoring surfaces and full play mode | Separate bundles and repeated host protocols create synchronization work. |
| `benne-editor/src/` | Commands, discovery, mutations, scaffolding, panels, Inspector | Large orchestration/UI files and repeated discovery make feature additions expensive. |
| `benne-editor/ts-plugin/` | TypeScript completion integration | Needs compatibility tests against actual generated games and packaged extension behavior. |
| `game-templates/` | New-game starting content | Multiple copies of boot code and content can drift. |
| `scripts/`, `electron/`, Vite configs | Development, distribution, preview builds, desktop host | Release/update behavior is part of the engine's public contract. |
| `tests/`, `.github/workflows/` | Regression and release checks | Strong structure; remaining gaps are mostly lifecycle, UI interaction, and shipped-product behavior. |

## Priority order

Priority means recommended sequencing, not a claim that every item is a currently reproduced defect. Effort is relative: S is a focused change, M crosses several modules, L requires staged work.

| Priority | Recommendation | Effort | Why it comes here |
| --- | --- | --- | --- |
| P1 | Separate authored definitions from mutable room state | M | Fresh starts and older saves must restore authored defaults reliably. |
| P1 | Give script queues explicit cancellation/lifetime semantics | M–L | Pending actions must not survive the interaction or scene they belong to. |
| P1 | Strengthen save identity, cloning, and serialization contracts | M | Save compatibility becomes difficult to retrofit after games ship. |
| P1 | Make source-based engine updates recoverable and conflict-aware | M–L | Protect long-lived authored projects during upgrades. |
| P1 | Guarantee a trailing generated-ID refresh | S | Changes arriving during generation can otherwise be missed. |
| P2 | Establish shared content and editor-message contracts | M–L | Reduce drift across runtime, editor, validator, and templates. |
| P2 | Introduce explicit runtime services and decompose major controllers | L, incremental | Make future behavior independently testable and replaceable. |
| P2 | Add media loading budgets and measured rendering improvements | M | Prepare for larger, voiced games and more complex rooms. |
| P2 | Improve editor indexing and syntax-aware authoring tools | M | Keep authoring responsive and reliable as games grow. |
| P2 | Test complete authoring and upgrade journeys | M | Protect the product users actually install and use. |
| P3 | Build puzzle-aware debugging, localization, and reusable content features | L, staged | Turn the underlying architecture into distinctive authoring value. |

## 1. Keep authored definitions immutable

**Evidence:** `src/game/boot/loadRoomData.ts:34` returns the imported JSON module's `default` object. `src/engine/scenes/roomSceneBootstrap.ts:19` passes the room through into scene start data, and `src/engine/scenes/RoomScene.ts:709` assigns it directly to `this.roomData`. `setWalkableScriptActive` at `RoomScene.ts:3416` changes `poly.active` in place. The restore logic at `RoomScene.ts:3432` derives its fallback default from that same object. Region activity follows a similar pattern.

**Consequence:** the runtime can change the cached definition that a later room load treats as authored content. A specific regression to reproduce is: disable a walkable area, reset the game or load a save predating that override, then revisit the room. Without an override, restoration can fall back to the previously mutated value. This is a source-supported correctness concern; the full gameplay sequence was not executed during this review.

**Recommendation:** establish `RoomDefinition` as readonly authored data and a separate `RoomRuntimeState` for active flags and other mutable properties. A smaller first step is to clone room definitions at the boundary where a scene instance is created, before applying saved overrides. Preserve the original definition for default lookup. Apply the same ownership audit to region, hotspot, prop, character, and GUI data.

**Acceptance check:** changing runtime activity never changes the cached definition; new game and loading older snapshots restore original defaults; two room instances created from one definition are independent. Development-only freezing of definitions can expose accidental mutation early.

## 2. Give queued scripts explicit cancellation and completion semantics

**Evidence:** `src/engine/scripting/BenneScriptCore.ts:621` resets `interactionTail` to a resolved promise; `chain` at line 937 appends promise callbacks. Reassigning the tail does not cancel callbacks attached to the old promise. `dispose` at line 779 removes registered listeners but does not itself invalidate the queue. `src/engine/scenes/RoomScene.ts:1242` performs substantial transition cleanup, including removing timer events.

**Consequence:** the queue-level contract does not guarantee that old callbacks stop. Depending on the individual action, teardown can leave a promise unresolved or allow its continuation to execute later. Facades that resolve the current scene when an action executes make a stale continuation particularly important to test. Scene cleanup mitigates some paths, so this should not be described as every transition being broken.

**Recommendation:** give each interaction an execution context with a lifetime token, room/session identity, and a cancellation signal. Before starting a queued command, verify that its context is still active. Walking, speech, delays, video, and transitions should settle deliberately as completed, skipped, cancelled, or failed. Ensure input locks and listeners are released on each terminal path. Specify whether a second interaction interrupts, queues behind, or runs alongside the first.

Keep the current author-friendly queued API. Internally, named commands such as `WalkTo`, `Speak`, and `SetFlag` can implement the lifetime contract. Arbitrary `B.raw` work remains an escape hatch with documented cancellation limits.

**Acceptance check:** leave a room during speech, movement, delay, and a custom asynchronous action; reset/load during a cutscene; click rapidly. Old actions cannot mutate the next scene, every waiter settles, and input becomes usable again.

## 3. Treat save files as a durable product format

**Evidence:** `src/engine/gameState/GameStateManager.ts:160` uses keys such as `benne-save-<slot>`, with a shared manifest key and named-save prefix. They contain no game identity. `cloneSnapshot` at line 107 shallow-copies `variables`; `setVariable`/`getVariable` at lines 528/535 accept and return arbitrary object references. The existing save envelope validation and v1 migration are useful but do not establish a recursively serializable value contract.

**Risks and recommendations:**

- Namespace storage with a stable game ID, distinct from display name, plus an explicit preview/playtest profile. Two BENNE games served from the same browser origin can currently address the same keys. Plan a deliberate legacy-key import flow; do not silently claim another game's saves.
- Restrict persistent variables to JSON-compatible values or provide explicit codecs. `unknown` permits cycles, functions, and objects whose JSON representation does not match their runtime behavior.
- Define snapshot ownership. Nested objects in returned snapshots currently share references with live variables; mutating either can affect the other without a state-change event. Clone/validate at a documented boundary or use immutable updates.
- Separate engine save-format version from game-content/save version. Renaming a room, inventory item, or puzzle variable needs a game migration even when the engine envelope stays at v2.
- Separate player preferences from story progress structurally. Existing speech/dialog/audio merge-preservation helpers show that their lifetimes already differ.
- Extract a storage adapter from the state model. Keep local storage initially; another browser or desktop backend should not require changing gameplay state logic. Save payload and manifest writes need an explicit recovery policy if only one succeeds.

**Acceptance check:** independent games on one origin stay isolated; a snapshot remains unchanged after live nested state changes; malformed and future saves fail without partial state replacement; a fixture from an older game-content version still loads through its migration.

## 4. Make engine upgrades reversible and conflict-aware

**Evidence:** `benne-editor/src/scaffoldPayload.ts:242` compares target files with the incoming scaffold. `copySharedScaffold` and `copyTemplateBoot` use recursive forced copying. `benne-editor/src/engineUpdateScaffolding.ts` copies files, merges the package manifest, writes project metadata, and then installs/builds. `scripts/bundle-extension-scaffold.mjs` derives the scaffold version from the extension version.

The existing scan and confirmation are valuable. However, an incoming/current comparison cannot distinguish an author's modification from a pristine file belonging to an older engine. The copy process also lacks a transaction spanning all phases, and copying new files alone does not identify obsolete engine-owned files to remove.

**Recommendation:** record hashes of the previously installed managed files. Classify updates as unchanged, safely replaceable, locally modified, new, or obsolete. Stage the update, preserve a recovery copy, and report conflicts before replacing modified files. Delete obsolete files only when their ownership and previous hash match. Record an incomplete update explicitly, and finalize installed-version metadata after verification succeeds. Preserve lockfile/reproducibility expectations and explain managed script/dependency changes in the preview.

**Longer-term alternative:** package the reusable engine/build integration as versioned dependencies while retaining editable game content and explicit extension hooks. Source vendoring can remain supported for engine hackers, but then its merge/update workflow is a first-class feature. An offline bundled dependency is also possible if offline new-game creation matters.

**Acceptance check:** an old generated game with custom scripts, locally edited managed files, and removed upstream files upgrades predictably. Failed copy/install/build stages are recoverable. Engine, extension, content schema, and protocol compatibility are recorded independently where their release needs differ.

## 5. Do not drop generated-ID work during an active run

**Evidence:** `benne-editor/src/gameIdsGenerator.ts:42` returns immediately when a folder is already in `runningByFolder`. `scheduleGenerateGameIds` debounces changes, but the running check has no pending rerun flag.

**Risk:** if generation has already scanned content, and a second change's debounce fires while the process is still active, that request can be discarded. Generated types may remain stale until another edit occurs.

**Recommendation:** track running and dirty/pending state per workspace. Any request received during a run marks the workspace dirty; run once more after completion, coalescing further changes. Keep failures visible even when background output is quiet. Longer term, share an in-process scanner with the CLI so routine metadata changes do not need a new npm process.

**Acceptance check:** delay the generator, edit IDs twice during the run, and assert that its eventual output reflects the final document state. Include a failed-run/retry case.

## 6. Define one content contract across tools

**Evidence:** `src/types/` defines content interfaces; runtime loaders cast imported JSON; `scripts/lib/validate-game-content.mjs` independently checks selected fields and references; `benne-editor/src/inspectorMutations.ts` edits generic records; editor discovery reinterprets metadata. `benne-editor/src/verbHandlerPresence.ts:13` explicitly mirrors the runtime's verb-alias table.

**Recommendation:** create a small renderer-independent contracts module containing schemas/validators, IDs, defaults, verb aliases, and diagnostic types. Choose one authoritative schema/type workflow and derive the other representation where practical. Reuse validation in CLI, editor diagnostics, import, and runtime content loading. Add content format versions and explicit migrations before incompatible authoring changes accumulate.

Retain separate validation levels: incomplete geometry can be acceptable during editing, while a release build should reject unusable required content. Structural validation and cross-reference validation are separate jobs. Geometry validation should eventually detect self-intersections and invalid holes, beyond merely checking finite coordinates and vertex counts.

The existing generated literal IDs are valuable. Extend them toward context-specific references, such as room-local prop IDs, where this improves errors without making the scripting surface unwieldy. Track references so entity rename can become a safe cross-file operation.

**Acceptance check:** one invalid field produces consistent diagnostics in the Inspector, CLI, and runtime loader. Adding a content field does not require independently updating several conflicting default/validation tables.

## 7. Move engine-owned boot integration out of the authored game boundary

**Evidence:** `src/engine/ConfigManager.ts:13` imports `src/game/game-config.json`; scenes, state helpers, GUI builders, audio loading, and rendering setup import numerous helpers or data from `src/game/boot/` and `src/game/assets/`. The updater therefore treats `src/game/boot/` as a special engine-owned exception.

**Recommendation:** introduce a `GameContentProvider` with settings, definition lookup, asset resolution, and script-loading capabilities. Keep Vite glob discovery in a build adapter that creates this provider. Move reusable boot helpers into the engine/integration layer. Pass the provider into runtime creation.

This permits fixture games, editor-loaded content, and packaged games to use the same runtime without source-path substitution. It also makes a dependency-based engine distribution practical. Start with settings and room lookup; do not create an interface for every small helper.

**Acceptance check:** engine modules no longer import a particular game's JSON/assets. A minimal fixture can construct the runtime with a different content provider, and preview builds do not accidentally pull in unrelated demo content.

## 8. Scope services to a game instance and make event contracts explicit

**Evidence:** `src/engine/events/EventBus.ts:12` exports one global bus; `src/engine/gameState/activeBenneGame.ts:8` stores one active game; `src/engine/gameState/snapshotFlushHooks.ts:26` owns a module-global hook set. Additional script/dialog/transition registries use module-level state.

**Recommendation:** create a `RuntimeContext` owned by each game, containing the event bus, state manager, content provider, transition service, and script execution services. Register/dispose them together. Distinguish immutable script definitions from active per-game script instances. Existing convenience APIs can resolve an explicitly supplied context through their facade while migration proceeds.

Add typed event-name/payload mappings and return unsubscribe handles consistently. Use direct service calls for commands that require an authoritative result; use events for notifications. Preserve listener-first verb fallback semantics explicitly rather than making every listener into a competing command handler.

Separate webviews generally have separate JavaScript environments, so these globals do not establish cross-panel interference by themselves. The immediate benefit is clearer ownership and teardown; in-process multiple games and isolated tests are further benefits.

**Acceptance check:** creating, destroying, and recreating a game leaves no active listeners or snapshot hooks from the previous instance. Two instances in one environment cannot modify one another's state.

## 9. Decompose large modules by lifecycle and responsibility

At inspection, `RoomScene.ts` contains about 6,442 lines, `buildGuiOverlay.ts` 2,925, `BenneScriptCore.ts` 2,418, the Inspector browser entry 3,971, and extension activation 1,759. Size alone is not a defect, but the responsibilities in these files explain the change risk.

**Recommendation:** retain `RoomScene` as the composition/lifecycle root and extract cohesive collaborators: character movement/following, region evaluation, room interaction targeting, dialog/video presentation, GUI coordination, and room rendering order. Give each clear creation, update, snapshot, and disposal responsibilities as needed. Keep the transition orchestrator's existing separation.

For GUI construction, extend the existing specialized control builders behind a consistent control interface for layout, state changes, and disposal. For the extension, group feature commands and services by rooms, characters, GUIs, dialogs, inventory, playtest, and project lifecycle. Split Inspector views along those same boundaries and share field widgets.

Avoid a split that merely moves private methods into files while continuing to pass the entire scene everywhere. Extract a narrow capability and its tests with each move. A full ECS is not justified by the inspected workloads; explicit small systems fit this product well.

**Acceptance check:** a change to video completion or a GUI control can be tested without constructing all unrelated room systems. Public Bennescript behavior remains compatible throughout extraction.

## 10. Load large media according to use

**Evidence:** `src/engine/sound/queueBenneAudioBoot.ts:5` queues every bundled SFX, music, and voice entry. `BootScene.ts:212` invokes it. `resolveGameAssetUrl.ts` discovers URLs eagerly; URL discovery itself should not be confused with downloading/decoding all media—the loader queue is the key concern here.

**Recommendation:** maintain an asset manifest with logical IDs, dependencies, and loading policy. Load common UI sounds early, room/chapter media when entering that scope, and speech shortly before use with limited lookahead. Keep active music and speech pinned. Add bounded cache ownership and safe eviction for large assets; measure retained room textures after many transitions before choosing limits.

Preserve predictable behavior when an asset is slow or unavailable: subtitles should still work, transitions should explain loading, and missing optional voice should not deadlock a script. Account for indirect script references and explicitly declared shared assets when building dependency sets.

**Acceptance check:** a synthetic game with many voice lines does not download/decode the entire voice library before the first playable room. Record startup time, loaded bytes, transition latency, and retained memory on representative hardware. No measured startup or memory numbers are claimed here.

## 11. Optimize the update loop and navigation using measurements

**Evidence:** `RoomScene.ts:4531` evaluates several systems each update. `updateRoomStackDepths` at line 4561 rebuilds ordering every frame; `src/engine/room/roomStackDrawOrder.ts:184` partitions, sorts, inserts, and allocates arrays, then applies depths. `src/engine/pathfinding.ts:98` builds candidate nodes for obstructed queries and computes visibility during path search. The current straight-line fast path and follower heuristics already avoid some work.

**Recommendation:** instrument timings and counts before replacing algorithms. Likely improvements are dirty-driven depth updates when feet/baseline/z-index/order inputs change, cached static ordering, reused scratch storage where useful, and region evaluation driven by movement or region changes. Preserve deterministic baseline conflict behavior; a naive comparator replacement would lose intentional semantics.

For navigation, cache static visibility graph data by room geometry revision, attach each start/goal to it per query, and invalidate on walkable/region changes. Measure path cost with representative polygon counts and multiple followers. Dynamic blockers would need their own invalidation policy.

**Alternative approaches:** a triangulated navigation mesh with corridor smoothing may be appropriate for substantially more complex geometry, while a raster walk mask can suit pixel-painted authoring. Both change authoring and edge-case behavior. Keep the existing polygon approach until measured cost or desired tooling justifies the migration. Moving work to a worker adds asynchronous coordination and should have a measured reason.

**Acceptance check:** capture frame and path-query percentiles for small and stress rooms, including idle scenes. Optimizations preserve navigation regression cases, depth order, region event semantics, and preview behavior.

## 12. Introduce a workspace content index and syntax-aware script inspection

**Evidence:** `benne-editor/src/gameDiscovery.ts` repeatedly reads content directories and JSON metadata. `extension.ts:560` refreshes both trees, Inspector state, filtering, and ID generation; broad file watchers call that path. `verbHandlerPresence.ts:40` removes comments using regular expressions and then scans source patterns.

**Recommendation:** maintain a per-workspace index of definitions, assets, references, and recognized handler registrations. Update only affected entries after a debounced change batch; use dirty document contents where appropriate. Publish affected-entity changes so trees and panels can refresh selectively. Keep an explicit full-rescan operation for recovery.

Use the TypeScript parser for handler discovery, navigation, and insertion boundaries. Regex comment stripping does not understand strings/template literals that contain `//` or `/*`, and pattern-based insertion becomes increasingly fragile as authors refactor. Support documented static registration forms; report dynamic registrations as unknown instead of pretending arbitrary code can be fully understood. Preserve formatting by editing narrow source ranges.

**Acceptance check:** editing one room does not trigger a full project metadata scan in every consumer. Test strings containing comment markers, nested callbacks, aliased imports, duplicate registrations, and unfinished code in dirty buffers.

## 13. Strengthen editor mutation and preview-message contracts

**Evidence:** `benne-editor/src/inspectorJsonDocument.ts:35` already serializes work per JSON file, and its writer integrates with open documents. `roomPolygonPatch.ts` validates geometry payloads. However, host and preview maintain separate patch/message types; `roomPreviewPanel.ts:430` dispatches string-based messages, and the patch handler at line 636 accepts a URI supplied by the webview. Full-document replacements are used for JSON persistence.

**Recommendation:** share a versioned discriminated message contract with request IDs, document identity, and document revision. Bind mutations to the host's currently authorized document rather than treating a supplied URI as authority. Validate URI scope and payload at the host boundary, and correlate acknowledgments with requests. Existing payload validation should be retained.

The file queue prevents concurrent write interleaving, but does not by itself detect a patch computed from an older document revision. Reject or deliberately rebase stale edits. Group a drag into one semantic edit/undo operation, and use narrow JSON edits where practical to preserve formatting and reduce review noise. Extend cross-file commands to cover JSON-plus-script changes as one understandable authoring operation.

**Acceptance check:** drag while editing raw JSON, delete the selected entity before a patch arrives, switch rooms with a pending response, and undo/redo across save/reopen. No wrong-document write, stale overwrite, or unmatched success acknowledgment occurs.

## 14. Manage renderer compatibility as a small explicit subsystem

**Evidence:** `package.json` pins Phaser to `4.0.0-rc.7`. `src/engine/rendering/phaserQuadStandardShaderInline.ts:1` documents copied shader sources from that version; `benneCharacterPerspectiveBatch.ts` customizes render nodes and vertex layout. The HiDPI scaler and preview renderer configuration are also important to the visual result.

**Recommendation:** keep the renderer pin and document exactly which custom assumptions depend on it. Add a compatibility checklist and a small visual fixture for perspective scaling, atlas trim, animation, pixel alignment, resize/DPR, and context recovery. Record the upstream source provenance/version for copied shader material and review it on each renderer upgrade.

Consider a fallback that disables the custom perspective path while retaining ordinary sprite rendering if that produces acceptable output. This gives diagnostic and upgrade flexibility. Compare a fixed low-resolution render surface with the current HiDPI approach only as a prototype: crisper classic pixels may trade off smooth scaling and editor overlay behavior. The existing approach should be judged by visual tests and GPU cost, not by fashion.

This report makes no claim about which Phaser release is currently newest; the recommendation concerns the checked-in renderer dependency and integrations.

## 15. Consolidate build definitions and make templates release fixtures

**Evidence:** preview Vite configs share the same structure, and `benne-editor/package.json` builds five previews sequentially, each through a script that invokes the root typecheck and generation hooks. Dependency/script declarations also appear in `scaffoldPayload.ts`. `tests/fixtures/content-baseline.json` explicitly permits four missing room definitions in the 2-click template.

**Recommendation:** centralize preview config creation and separate one shared validation/typecheck phase from bundle emission. Parallelize only builds with independent outputs and no shared generated-file races. Keep separate webview bundles when they simplify runtime isolation; sharing configuration is useful even without merging bundles.

Generate scaffold dependency/script metadata from a single release definition or enforce parity tests. Treat each starter template as a complete supported example: create it in an empty temporary directory, install from its intended dependency state, validate, build, launch, and update it. Resolve the four known missing-room references intentionally rather than allowing them to become permanent starter behavior.

**Acceptance check:** every packaged template passes a clean creation/build/play cycle without baseline content errors. Shared boot code and dependency versions cannot silently diverge between templates and the engine repository.

## 16. Expand tests around product contracts

`tests/e2e/gameplay.spec.ts` covers interaction routing, save/load hooks, repeated transitions, and resize hit coordinates. Unit coverage thresholds protect selected pure logic. Extension tests cover meaningful persistence/scaffolding cases. Preserve these; the next priority is the untested seams, not an arbitrary global coverage percentage.

Recommended additions, in order:

1. Fresh-start/old-save restoration after runtime definition changes, nested snapshot isolation, and interaction cancellation cases from recommendations 1–3.
2. Real authoring journeys: create a room, drag geometry, edit Inspector fields, undo, save, close, reopen, and play. Exercise invalid/stale messages and dirty JSON/script buffers.
3. Upgrade fixtures spanning at least the previous supported engine version, including author modifications and failure recovery.
4. A launched generated game with the packaged VSIX, exercising actual completions and diagnostics. Launch the extracted web artifact and packaged desktop application, extending current build/structure checks.
5. Visual baselines for runtime/preview parity and the custom renderer, plus longer media/dialog/inventory sessions with retained-object and listener trends.

Use small fixture games independent of demo content. Property-based geometry and serialization checks would complement the existing hand-picked regressions; every failure should retain its reproducible seed/input. Keep cross-platform and native GPU testing targeted because software-rendered browser checks do not establish hardware compatibility. `docs/testing.md` already describes many of these gaps and should remain the testing source of truth.

## Suggested architectural destination

These are dependency boundaries to introduce gradually, not a requirement to create all these packages now:

| Boundary | Owns | May depend on |
| --- | --- | --- |
| Contracts/content model | Definitions, IDs, schemas, diagnostics, migrations, protocol | Small environment-neutral utilities |
| Adventure core | State, command lifetimes, dispatch rules, puzzle/dialog logic | Contracts; injected clock/storage/content capabilities |
| Phaser runtime | Scene composition, rendering, movement presentation, input/audio adapters | Core and contracts |
| Content/build tools | Discovery, asset manifests, ID generation, validation, packaging | Contracts and build tooling |
| Authoring services | Workspace index, document commands, reference updates | Contracts and host/file adapters |
| VS Code/browser UI | Commands, trees, Inspector, previews, message transport | Authoring services and preview/runtime APIs |
| Game project | Authored content, scripts, assets, game migrations | Public engine API and build adapter |

A practical first slice is shared verb/patch contracts, then content-provider injection, then instance-scoped services and one extracted room subsystem. Keep internal source paths private where possible so games depend on a documented facade. Publish deprecation guidance and migration examples when that facade changes.

## Creative directions with architectural payoff

| Idea | User value | Small first milestone | Depends on |
| --- | --- | --- | --- |
| **Adventure interaction debugger** | Show why a click chose a verb/target, which fallback ran, and where an interaction is waiting. | A playtest trace listing target, handler source, queued command, cancellation, and state changes. | Typed events, named commands, workspace index. |
| **Executable puzzle dependency charts** | Connect existing PDCs to actual flags, inventory conditions, and authored outcomes; highlight unreachable or unsatisfied steps. | Link chart nodes to state predicates and show live status during BENNE Play. | Shared references and observable state. Treat arbitrary script effects as unknown. |
| **Scenario-based Play From** | Reproduce late-game puzzles without repeatedly playing the whole game. | Named fixtures with room, character, inventory, flags, and expected assertions. | Stable save/content schemas; existing Play From support. |
| **Localization and voice workbench** | Keep translations, recordings, subtitles, and speaker metadata aligned as dialog changes. | Build a catalog around existing voice-ID/CSV tooling; stable line IDs, missing/stale recording diagnostics, locale preview. | Content index, durable IDs, lazy media loading. |
| **Reusable adventure prefabs** | Reuse a door, inspectable prop, NPC conversation, or inventory puzzle pattern without copying fragile IDs. | Instantiate a versioned prefab with namespaced IDs and a small parameter form. | Schemas, references, safe multi-file commands. Avoid arbitrary deep inheritance initially. |
| **Room/navigation diagnostics** | Explain unreachable walk targets, contradictory depth baselines, and region transitions visually. | Preview overlays for path decisions, blocked targets, winning scale regions, and depth constraints. | Existing preview geometry and navigation helpers. |
| **Accessible interaction profiles** | Make the same adventure playable with keyboard/controller focus and configurable speech pacing. | Focusable target cycling and confirm/cancel actions that reuse verb dispatch. | Input abstraction; consistent GUI control contracts. |
| **Playtest replay and bug bundles** | Let authors reproduce a player's bug with the relevant state and recent actions. | Export engine/content version, save snapshot, recent commands, seed, and asset errors. | Serialization and execution context. Full deterministic replay additionally needs controlled time/randomness and handling of arbitrary scripts. |

The interaction debugger and scenario fixtures are especially attractive early investments: they improve day-to-day development and create evidence for later performance and architecture decisions. The PDC integration could become a distinctive feature once references are reliable.

## A staged investment plan

**Stage 1 — protect game correctness and authored work.** Add regression fixtures for mutable definitions, snapshot ownership, and pending script work; resolve those contracts. Fix trailing ID generation. Specify save identity/content migration and upgrade recovery before another compatibility-sensitive release. Remove the known starter-template reference failures.

**Stage 2 — establish reusable boundaries.** Share contracts and diagnostics, introduce the content provider and instance-owned services, then extract one cohesive room subsystem at a time. Build the workspace index and syntax-aware registration inspection. Add real editor journeys while these boundaries change.

**Stage 3 — scale using evidence.** Benchmark media startup, repeated room transitions, update-loop costs, and editor refresh latency. Implement scoped media loading, dirty-driven rendering, or cached navigation only against those results. Consolidate build/release metadata and exercise old-game upgrades continuously.

**Stage 4 — grow the authoring advantage.** Deliver interaction tracing and scenario fixtures, followed by localization/voice tooling and live puzzle-chart status. Let real game authoring determine whether prefabs, richer plugin APIs, or another frontend deserve investment.

The long-term success criterion is that a new engine feature has an obvious owner, can be tested in isolation, and can reach an existing game through a predictable upgrade without compromising its content or saves.
