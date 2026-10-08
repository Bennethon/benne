# BENNE — Codebase Review & Long-Term Roadmap

> **Archived 2026-10-07.** The scripting recommendations (§3) and the syntax-tree editor tooling (§4.3) were carried out by the BenneScript refactor; most of the repository clean-up in §6 is done. What is still open is tracked in [`docs/roadmap.md`](../roadmap.md). Paths, line counts and file sizes below are as they were when this was written.

> **Historical document.** Written before the BenneScript refactor (October 2026). Its scripting examples and file references use the old `register*Script` / `B` API, which no longer exists. For the current API see `docs/public/bennescript.md` and `docs/bennescript-api.md`.

*Review date: 2026-10-03 · Scope: engine (`src/engine`), game/boot layer (`src/game`, `game-templates/`), editor previews (`src/editor`), VS Code extension (`benne-editor/`), build/test tooling, docs, and repo hygiene. No code was changed as part of this review.*

---

## 0. TL;DR — the ten things that matter most

Ordered roughly by long-term payoff versus effort.

| # | Recommendation | Why | Effort |
|---|----------------|-----|--------|
| 1 | **Ship the engine as a versioned package, not copied source** | Engine code is currently copied into every game, so changes drift and get back-ported by hand (see commit `3a30a87`, *"engine updates from the game dev – WARNING"*). | L |
| 2 | **Remove `src/game/boot/` from game content** by generating it with a Vite virtual module | Fixes the engine→game dependency inversion (23 engine files import `../../game/boot/*`) and stops 3 identical copies of `boot/` drifting apart. | M |
| 3 | **Fix the scripting timing model** (queued actions alongside immediate state changes) | `say`/`walkTo` are queued but `B.state.setFlag`, getters and `if` checks run straight away. Authors will hit ordering bugs that are hard to see. Moving to `async/await` or generator coroutines removes this whole class of bug. | L |
| 4 | **Break up `RoomScene.ts` (6,442 lines, ~600 methods)** into systems | It's the highest-risk file in the repo. Every feature touches it. | M–L |
| 5 | **Use one schema as the source of truth for content JSON** (types + validation + editor IntelliSense) | Right now the hand-written `src/types/*.ts`, the hand-written `validate-game-content.mjs` and the Inspector's assumptions can disagree with each other. | M |
| 6 | **Replace text scanning of scripts with the TypeScript AST** in the editor | Stub insertion and "is this verb handled?" use `indexOf`/regex brace counting (`propVerbScaffolding.ts`, `verbHandlerPresence.ts`). It breaks easily on comments, strings, or code split across files. | M |
| 7 | **Previews and BENNE Play on a Vite dev server with HMR** instead of 5 prebuilt bundles | Removes the "Rebuild … Preview" commands, stale bundles, and ~8 MB of built JS in git. | M |
| 8 | **Typed event bus** | Events are string-built (`verb:room:<room>:prop:<id>:<verb>`) on an untyped `Phaser.Events.EventEmitter`. A typed map catches typos at compile time. | S |
| 9 | **Repo hygiene**: remove committed VSIX files (219 MB), built bundles, source maps, `benne-snapshot.md` (1.6 MB), duplicated skill folders | Faster clones, cleaner diffs, less confusion about what is source. | S |
| 10 | **Restructure the docs**: short architecture overview + per-subsystem pages + ADRs | `architecture.md` is 1,048 lines of very long, heavily bolded paragraphs. It's hard for people (and AI tools) to keep it accurate. | S–M |

---

## 1. What the project looks like today

| Metric | Value |
|--------|-------|
| Engine (`src/engine`) | ~32.8k lines TS |
| Extension (`benne-editor/src`) | ~32.9k lines TS |
| Largest files | `RoomScene.ts` 6,442 · `inspectorMain.ts` 3,971 · `buildGuiOverlay.ts` 2,925 · `BenneScriptCore.ts` 2,418 · `inspectorStateBuilder.ts` 1,990 · `extension.ts` 1,759 |
| Runtime | Phaser **4.0.0-rc.7** (release candidate), Vite 8, TS 5.9 |
| Distribution | VS Code extension bundles engine + templates; "Create Game" / "Update Engine" copy source into a game folder |
| Tests | Vitest unit (≈5% line coverage per `docs/testing.md`), Playwright e2e, VS Code host tests, artifact builds, CI workflow |
| Git | `.git` ≈ 188 MB on disk; 11 `.vsix` files (~20 MB each) tracked |

### Strengths worth keeping

These are real strengths. The recommendations below build on them rather than replacing them.

- **Data-first content model.** JSON for layout, TS for behaviour, Aseprite as the art pipeline. It's the right shape for an adventure engine and makes visual editing possible.
- **Generated ID types** (`scripts/generate-game-ids.mjs` → `benne-game-ids.d.ts`) plus the TS server plugin for completions. This gives authors excellent autocomplete for ids at zero runtime cost.
- **Pathfinding** (`pathfinding.ts`) uses the correct algorithm (reflex-vertex visibility graph + A\*), handles edge cases carefully, and has seeded regression tests.
- **Room transitions** are well modelled: `RoomTransitionOrchestrator` with defined hook phases (leave → fade → load → enter → after-fade, plus load-from-save).
- **Versioned save format** (v1→v2 migration in `GameStateManager.ts`) with fixtures under `tests/fixtures/saves/`.
- **A real test and CI foundation.** Fixture game, Playwright journeys, extension-host tests, artifact builds, and a content baseline that fails on stale entries.
- **Thoughtful retro rendering**: hi-DPI backbuffer with integer-stable pixel art, plus a dedicated UI camera so the HUD doesn't drift.
- **Lazy room scripts** (`import.meta.glob` with `eager: false`).

---

## 2. Architecture

### 2.1 Engine distribution: copied source → versioned package

**Today.** "Create New Game" and "Update Engine" copy `src/engine`, `src/editor`, `src/types`, `src/game/boot`, Vite configs, HTML entries and `scripts/` into each game (`docs/public/updating-benne.md`). Every game holds a private, editable fork of the engine.

**Problems**
- Engine fixes made while building a game have to be copied back by hand. Commit `3a30a87` shows this is already happening and is risky.
- "Update Engine" has to diff and overwrite a file tree, which is a homemade package manager. Users can (and will) edit `src/engine/` by accident and lose the change on update.
- `game-templates/2-click`, `game-templates/9-verb` and `src/game` each hold a full copy of `boot/`, and `src/game` is a near-exact mirror of `9-verb` (only `.gitkeep` differs). `scripts/switch-game-template.mjs` (735 lines) exists only to keep these copies in sync.

**Recommendation.** Convert the repo into an **npm workspaces monorepo** and publish the engine as a package:

```
packages/
  engine/          @benne/engine     — runtime (today's src/engine + src/types)
  vite-plugin/     @benne/vite       — content discovery, id generation, preview entries
  content-schema/  @benne/schema     — JSON schemas + generated TS types + validator
  editor-shared/   @benne/tooling    — game discovery, script AST helpers (used by extension AND CLI)
  vscode/          benne-editor      — the extension
templates/
  2-click/  9-verb/                  — content ONLY (no boot/, no engine)
examples/
  dev-game/                          — the game you develop against (replaces src/game)
```

A game then becomes:

```jsonc
// my-adventure/package.json
{ "dependencies": { "@benne/engine": "^0.12.0" }, "devDependencies": { "@benne/vite": "^0.12.0" } }
```
```ts
// my-adventure/vite.config.ts
import benne from '@benne/vite';
export default defineConfig({ plugins: [benne()] });
```

"Update Engine" becomes `npm install @benne/engine@latest` (the extension can still drive it). Breaking changes become semver majors with codemods. While developing the engine and a game together, `npm link` or a workspace reference gives the same live-edit loop you have now, without the back-porting problem. The package doesn't need to be on the public npm registry. A GitHub Packages scope, or a tarball shipped inside the VSIX and installed via `file:`, keeps it private.

### 2.2 The `boot/` inversion

The engine is supposed to be reusable, but **23 engine files import from `src/game/boot/`** (e.g. `RoomScene.ts` imports `cursorAseprite`, `inventoryAseprite`, `asepritePhaserAnimationKeys`). `boot/` sits in the game folder only because `import.meta.glob('../rooms/**/*.room.ts')` needs a path relative to the content.

**Recommendation.** Move all of `boot/` into the engine and generate the glob part with a **Vite virtual module**. You already have a Vite plugin (`vite-plugin-bennegame-ids.ts`), so this is a natural extension:

```ts
// @benne/vite — emits a virtual module rooted at the configured content dir
// virtual:benne/content
export const roomScripts   = import.meta.glob('/src/game/rooms/**/*.room.ts');
export const roomData      = import.meta.glob('/src/game/rooms/**/*.room.json');
export const characterData = import.meta.glob('/src/game/characters/**/*.character.json', { eager: true });
// …
```
```ts
// engine
import * as content from 'virtual:benne/content';
```

Result: dependencies point one way only (`game → engine`). The content folder becomes configurable (`benne({ contentDir: 'game' })`). The template sync script and the "boot is the one exception" paragraph in the user docs can both go.

### 2.3 Decompose `RoomScene`

`RoomScene.ts` is 6,442 lines with ~66 fields and ~600 functions/methods. It owns rendering, input, walking, pathfinding calls, followers, regions, parallax, depth sort, camera, GUI composition, speech/display overlays, video layer, fades, cursor, inventory cursor, debug overlays, persistence flush hooks and editor camera modes. The import block alone pulls in ~60 helpers from `benneAnimationRuntime`.

**Recommendation.** Keep `RoomScene` as a thin coordinator that owns a set of **systems**. Each system has a narrow interface and its own lifecycle (`create`, `update(dt)`, `shutdown`):

| System | Takes over from RoomScene |
|--------|---------------------------|
| `RoomRenderer` / `RoomStack` | background, props, depth sort, parallax |
| `CharacterSystem` | spawn, sprites, facing, animation, region scale |
| `LocomotionSystem` | walking, path following, follower AI, NPC tweens |
| `InteractionSystem` | pointer → hit test → verb resolution → dispatch |
| `CameraController` | follow, scroll bounds, script focus/zoom, editor modes |
| `OverlaySystem` | GUI composition, speaking/display text, choice dialogs, fade layer, cursor |
| `MediaLayer` | video |
| `RoomPersistence` | read/write saved prop/character state, flush hooks |
| `DebugOverlay` | path debug, hotspot outlines (dev only, tree-shaken) |

Do it **one system at a time**, extracting behaviour behind the existing public methods, with the Playwright journeys as the safety net. This isn't a full ECS (the docs rightly reject one). It's ordinary composition, and it makes each piece unit-testable without a Phaser scene.

A related cleanup: `benneAnimationRuntime.ts` exports ~50 `readSaved*`/`writeSaved*` functions (one pair per property per entity type). Replace them with a generic, typed **entity-state store**:

```ts
roomState.prop(roomId, propId).get('visible')      // typed by a PropState interface
roomState.prop(roomId, propId).set('alpha', 0.5)
```

New persisted properties then need no new functions, and saving/migration is handled in one place.

### 2.4 Global singletons → one runtime context

Module-level mutable state is spread across the engine: `activeBenneGame`, `resolveGameStateManager.activeManager`, `roomTransitionGlobals.orchestrator` and `globalBForTransition`, `roomHookRegistrySingleton`, `dialogSession.activeDialogScript`, `registerRoomScript._currentLoadingRoomId`, `benneVerbContextScriptSurface.hoverDescriptionScript`, `SoundManager.activeAudioContext`, the `gameEvents` bus, plus ~35 module-level `Map`/`Set` registries.

This works for one game per page, but it:
- makes tests depend on order (state leaks between tests unless each one is reset by hand);
- prevents running two games side by side (e.g. comparing a preview and BENNE Play in one webview, or a test runner booting many fixtures);
- hides dependencies (any file can reach into any singleton).

**Recommendation.** Introduce a `BenneRuntime` object created by `createBenneGame()` that **owns** these services (state, events, registries, orchestrator, audio, dialog session) and is passed in explicitly, or at least looked up once from `game.registry`. Keep the existing free functions as thin wrappers for a release so scripts don't break.

### 2.5 Typed events

`EventBus` is a bare `Phaser.Events.EventEmitter`. Event names are built from strings (`verb:room:${roomId}:prop:${id}:${verb}`) and parsed back with regexes in the editor (`verbHandlerPresence.ts:727`). Payloads are `unknown` at the subscriber.

**Recommendation.** Use a typed facade with key builders:

```ts
interface BenneEvents {
  'player:walk:start': PlayerWalkStartPayload;
  'gameState:variableChanged': GameStateVariableChangedPayload;
  // …
}
const ev = {
  roomVerb: (room: RoomId, kind: 'prop'|'hotspot'|'character', id: string, verb: VerbId) =>
    `verb:room:${room}:${kind}:${id}:${verb}` as const,
};
class TypedBus<E> { on<K extends keyof E>(k: K, fn: (p: E[K]) => void): () => void; emit<K extends keyof E>(k: K, p: E[K]): void }
```

Returning the unsubscribe function from `on` also simplifies the `disposers` bookkeeping in `BenneScriptCore`. Share the key builders and parsers with the extension so neither side writes these strings by hand.

### 2.6 One schema for content JSON

There are currently three separate definitions of what valid content looks like:
1. hand-written interfaces in `src/types/*.ts` (`gui.ts` alone is 613 lines);
2. a hand-written validator in `scripts/lib/validate-game-content.mjs`, which repeats the control-type list and other details;
3. assumptions spread through `inspectorStateBuilder.ts` / `inspectorMutations.ts`.

**Recommendation.** Write the schemas once, in **TypeBox** or **Zod** (TypeBox produces standard JSON Schema directly), and generate the rest from them:
- the TS types (replacing `src/types/*.ts`);
- runtime validation in dev builds (clear "room `outside`: prop `Door` is missing `x`" errors instead of crashes deep in `RoomScene`);
- the CLI/CI validator (`validate:content`);
- **VS Code JSON IntelliSense** via the `contributes.jsonValidation` extension point (`*.room.json` → `room.schema.json`). Authors get autocomplete and red squiggles in raw JSON for free;
- a `schemaVersion` field per file plus migrations. You already do this for saves; content files need the same as the format changes.

Cross-file references (prop ids, room ids, asset paths) stay in a separate "link" validation pass, which `validate-game-content.mjs` already partly implements.

### 2.7 Small architectural items

- `src/engine/Room.ts` is an unused placeholder abstract class. Delete it or give it a purpose (it could become the `RoomModel` that systems share).
- `ConfigManager` imports `game-config.json` statically from the game folder. Once §2.2 is done it can come in through the virtual module, which also allows a runtime override for Play From and tests.
- **Phaser 4 RC pin.** Pin exactly (no caret), track Phaser 4 stable, and keep the Phaser-specific shader code (`phaserQuadStandardShaderInline.ts`, `benneCharacterPerspectiveBatch.ts`) behind a small adapter. Those files depend on renderer internals and are the most likely to break on upgrade.

---

## 3. Scripting model (Bennescript)

### 3.1 The timing hazard

Bennescript handlers are **synchronous functions that enqueue lazy promises** onto `interactionTail` (`BenneScriptCore.chain`). It reads nicely:

```ts
B.whenUse('Door', () => {
  B.walkToClicked();
  B.player.say('Unlocking…');
  B.state.setFlag('unlocked', true);   // ⚠ runs NOW, before the walk or the line
  B.prop('Door').visible = false;      // queued
  if (B.prop('Door').visible) { … }    // ⚠ reads the PRE-queue value (documented)
});
```

Because only some APIs are queued (walk, say, wait, sound, inventory add/remove, room change, prop setters) and others aren't (`B.state.*`, getters, any plain JS like `if`, `Math.random`, or local variables), **the order in the source isn't the order things happen**. The docs acknowledge this ("The getter returns the value already applied, not a step still waiting on the queue"). Expect bugs such as:
- a flag set "after" a line of dialogue is visible to a GUI or another handler while the line is still playing;
- a save made during a cutscene records state the player hasn't "seen" yet;
- `if (B.inventory.has('Key'))` placed after a queued `B.inventory.add('Key')` is false.

There's a second cost: each queued API needs a `.now` twin (`BlockingWithNow`, `withNow`, `withNowResult`). That doubles the API surface and the documentation.

**Options, in order of preference**

1. **`async`/`await`** — handlers become `async () => { await B.walkToClicked(); await B.say\`…\`; B.state.setFlag(…) }`. Execution order matches the source. `.now` is simply "don't await" (`B.sound.play('x')` without `await`, or an explicit `B.parallel(…)`). Cost: authors must remember `await`. Mitigate with the **`@typescript-eslint/no-floating-promises`** rule set up in game projects plus the TS plugin you already ship, so a missing `await` is flagged in the editor.
2. **Generator coroutines** (`function* () { yield B.walkTo('Door'); … }`). This is how Ren'Py, Unity and PowerQuest do it. It's also friendly to cancellation and cutscene skipping (the runner just stops resuming), and to saving mid-cutscene. The syntax is slightly less familiar.
3. **Keep the queue, but make it consistent**: queue *every* side effect, including `B.state.set*`, and add `B.then(() => …)` for arbitrary code. This is the smallest change, but you're still fighting JS control flow.

Whichever you pick, add a **compatibility shim and a codemod** (via the TS AST — see §4.3) so existing game scripts migrate automatically. Skipping cutscenes (`f265648`) is also simpler with options 1 or 2: you can pass an `AbortSignal` / "fast-forward" flag through the awaited calls instead of draining a queue.

### 3.2 `B` surface: inheritance → capabilities

`BenneScriptCore` is subclassed by `BenneScript` (room), `CharacterBenneScript`, `InventoryBenneScript`, `GlobalBenneScript`, `GuiBenneScript` and `DialogBenneScript`. The "context matrix" in `bennescript-api.md` exists because each subclass exposes a slightly different `B`.

**Recommendation.** Build `B` by **composing capability modules** (`withMovement`, `withSpeech`, `withRoomEntities`, `withGui`, `withVerbs(scope)`). Each script kind then declares exactly which capabilities it gets, and the matrix can be **generated from code** instead of maintained by hand. It also leads naturally to a public plugin API (§7.10).

### 3.3 Narrative content outside TS

The `B.say\`Hank: …\`` tagged template is lovely. Long dialogue trees in TypeScript don't scale, though, and the voice-ID / CSV export in `voiceIdProcessor.ts` already has to parse lines out of TS. Consider letting dialogs be authored in **Ink** or **Yarn Spinner**, both mature, writer-friendly formats with existing JS runtimes, with Bennescript hooks for game actions (`<<walkTo Door>>`, `~ give("Key")`). That gives you localisation, voice-ID tagging and branching visualisation for free.

---

## 4. Editor / tooling

### 4.1 Previews: prebuilt bundles → dev server

**Today.** Five Vite configs (`vite.{room,character,gui,inventory}-preview.config.ts`, `vite.benne-play.config.ts`) each produce a ~1.4–1.8 MB bundle (Phaser included in every one) into `benne-editor/media/*`, alongside a separate webpack pipeline for the Inspector and PDC editor. Authors must run "Rebuild … Preview" after engine changes, and BENNE Play needs `watch:benne-play` to see script edits.

**Recommendation.**
- In a game project, have the extension start (or attach to) **one Vite dev server**. Point every webview at it (`http://localhost:<port>/__benne/room-preview?room=…`). Previews and Play get **HMR**: edit `apartment.room.ts` and the change is live without a rebuild. VS Code webviews can load localhost content (set `portMapping` / CSP); this is how many framework extensions do it.
- Make it **one multi-entry build** (a single Vite config with `input: { play, room, gui, character, inventory }`) with Phaser in a shared chunk for the offline/packaged fallback.
- Move the Inspector/PDC webpack builds to Vite too (or esbuild), so there's one bundler.
- Once previews are served or built on demand, **stop committing `media/**/*.js` and `.map` files** (≈ 8 MB plus 6 MB of source maps in git right now).

### 4.2 Inspector UI

`inspectorMain.ts` (3,971 lines) renders by concatenating HTML strings (`renderRoom`, `renderGuiControlCardBody`, …) and re-rendering wholesale. `inspectorWebviewViewProvider.ts` switches on ~29 message types that aren't shared as a typed union with the webview.

**Recommendation.**
- Move to a small component framework that works well in webviews: **Preact + signals**, **Lit**, or **Svelte**. Keep using the VS Code theme variables, or adopt `@vscode-elements/elements`, the maintained successor to the deprecated webview-ui-toolkit.
- Define the **host ↔ webview protocol as a discriminated union in one shared file**, and validate incoming messages.
- Once JSON Schemas exist (§2.6), much of the Inspector can be **schema-driven** (`x-benne-widget: "point" | "color" | "assetTag"` annotations), so new fields get UI without new rendering code.

### 4.3 Script manipulation via the TypeScript AST

`insertIntoBenneRegisterRoomScript` finds `registerRoomScript(` with `indexOf`, then counts braces. `verbHandlerPresence.ts` (950 lines) uses `indexOf` and regexes to decide whether a verb is handled. This breaks on comments containing `registerRoomScript(`, on braces inside strings or template literals (e.g. `B.say\`…{…}\``), on handlers registered through helper functions, and on formatting differences.

**Recommendation.** The extension already depends on TypeScript (the TS server plugin). Build a single `scriptModel.ts` on the **TypeScript compiler API** (or `ts-morph`) that:
- parses each script once per change and caches it;
- lists `B.when*(...)` registrations with their target ids and source ranges (used by Inspector chips, Actions, navigation, "Play From" discovery and voice IDs);
- inserts stubs at the correct AST location, with formatting from `ts.formatting`;
- powers codemods for API migrations (§3.1).

A further step: the TS server plugin could flag **unknown ids** (`B.whenLookAt('Coutch')`) and **unhandled verbs** directly in the editor.

### 4.4 Duplicate discovery logic

`benne-editor/src/gameDiscovery.ts` (1,010 lines) and `scripts/lib/scanGameContentIds.mjs` (481 lines) both walk the content tree, and the latter says it "mirrors" the former. Move both to a shared `@benne/tooling` package (§2.1) used by the extension, the ID generator, the validator and the Vite plugin.

### 4.5 Extension structure

- `extension.ts` (1,759 lines) registers 134 commands. Split it into feature modules (`features/room/*`, `features/gui/*`) that each export `register(context)`.
- The ~20 `*Scaffolding.ts` files share a pattern (prompt → write JSON → insert script stub → reveal). Extract a shared **scaffold pipeline** and keep text templates in files (e.g. `templates/room.room.ts.hbs`) rather than string literals.
- `activationEvents` lists ~50 `onCommand:` entries. Since VS Code 1.74 these are generated automatically from `contributes.commands`, and you target `^1.85`, so they can go.
- Remove the leftover `vsc-extension-quickstart.md`.
- **Undo/redo.** Inspector edits go through VS Code document edits, which is good: keep everything on that path (including preview gizmo drags) so `Ctrl+Z` works the same everywhere. The room/GUI previews would benefit from a **custom editor** (`CustomTextEditorProvider` on `*.room.json`), which gets undo, dirty state and save for free and replaces the current "two-row layout" management in `benneEditorLayout.ts`.

---

## 5. Performance

Adventure games are light on CPU, so these are mostly about smooth frame pacing on low-end and mobile devices, and load times on itch.io.

| Area | Finding | Suggestion |
|------|---------|------------|
| Depth sort (`RoomScene.updateRoomStackDepths`, every frame) | `sortRoomStackEntities` re-splits, re-sorts the statics, allocates new arrays and calls `setDepth` on **every** entity each frame. In Phaser each `setDepth` triggers a display-list re-sort. | Sort statics once, and again only when a prop's z/baseline/visibility changes. Re-insert only characters that moved. Skip `setDepth` when the value hasn't changed. |
| Pathfinding | `findWalkPath` rebuilds graph nodes and recomputes `withNonWalkableRegionsAsHoles(...)` (polygon clipping) on every walk command. NPC followers call it repeatedly. | Cache `{nodes, node↔node visibility}` keyed by the active walkable/region set and invalidate it on `B.walkable(id).active` / region toggles. Queries then only need visibility from start and goal. |
| Per-frame `update` | Nine passes every frame, even in rooms without parallax, followers or regions. | Most passes already return early when empty. Go further and only register systems that the room actually uses (falls out of §2.3). |
| Content loading | All character/GUI/inventory/dialog JSON and scripts are eager globs, so they land in the main bundle. | Fine for jam-sized games. For bigger games, lazy-load per room as room scripts already do, and **preload adjacent rooms** (rooms reachable via `changeTo` targets found by the AST model) during idle time so transitions are instant. |
| Texture memory | Each room's atlas stays in the texture manager after leaving. | Add an LRU texture cache with a budget, keeping the previous room warm for back-and-forth play. |
| Bundle size | Each preview bundle includes all of Phaser. | Covered by §4.1. For shipped games, consider a custom Phaser build that leaves out unused modules (physics, tilemaps). |
| Audio | Verify music streams (HTML5 audio / media element) rather than being decoded fully into WebAudio buffers. | Decoded music is the largest memory cost in most web adventure games. |

Add a **dev-only performance HUD** (frame time, draw calls, texture memory, active tweens and listeners) to BENNE Play. The e2e suite already counts listeners and objects, so the data is close at hand.

---

## 6. Repository hygiene & process

| Issue | Evidence | Recommendation |
|-------|----------|----------------|
| Release binaries in git | 11 × `benne-editor/benne-editor-0.0.*.vsix`, ~219 MB total | Publish to GitHub Releases. Add `*.vsix` to `.gitignore`. Optionally rewrite history with `git filter-repo` to shrink the repo; do that deliberately, since it changes commit SHAs. |
| Built output in git | `benne-editor/media/*/*.js`, `inspector.js.map` (259 KB), `pdc-editor.js.map` (6.3 MB) | Build in CI and ship inside the VSIX only. |
| Snapshot dump | `benne-snapshot.md` (1.6 MB, a concatenated source dump) | Generate it on demand (script) and ignore it. |
| Duplicated agent skills | `.agents/skills/` and `.cursor/skills/` are near-identical copies of generic Phaser docs (already drifting: `input-keyboard-mouse-touch` differs) | Keep one copy, or reference the upstream source. |
| Triplicated content | `src/game` ≈ `game-templates/9-verb`; `boot/` × 3 | §2.1/§2.2. Make `src/game` an `examples/dev-game` that isn't also a template. |
| Root clutter | 6 HTML entry files + 6 Vite configs at the repo root | Move them into the plugin/preview package (§4.1). |
| Versioning | Root `package.json` is `0.0.0`; extension is `0.0.11`; engine has no version | Use one release version with **Changesets** (or release-please) to generate changelogs and catch breaking changes. |
| Tool version skew | eslint 10 (root) vs 9 (extension); `@types/node` 26 vs 22 | Align them through workspace root devDependencies. |
| Commit messages | e.g. "some engine updates from the game dev – WARNING" | Conventional Commits plus short PRs, even solo. This feeds automated changelogs and makes the history easier to search later. |

### Documentation

`architecture.md` is accurate and detailed, but very hard to maintain: single paragraphs run over 3,000 characters, almost every identifier is bold, and it mixes user guidance, implementation detail and change notes. Suggestions:

- **`docs/architecture/overview.md`** (≤ 2 pages): layers, the dependency rule, a runtime diagram and an editor diagram.
- **One page per subsystem** (`rendering.md`, `scripting.md`, `gui.md`, …), each with a "Key files" list. Even better, put a `README.md` inside each engine folder.
- **ADRs** (`docs/adr/0001-queue-based-scripting.md`, …) for decisions like "single RoomScene", "hi-DPI Scale.NONE", "no ECS". Future you will want to know *why*, not just *what*.
- **Generate API reference with TypeDoc** from the JSDoc you already write, instead of maintaining `bennescript-api.md` (1,144 lines) by hand.
- `docs/public/` already has VitePress frontmatter. Add a VitePress config and publish it as the docs site.

### Testing

Line coverage is about 5%. The highest-value additions:

1. **Headless scripting harness.** Run Bennescript handlers against a fake `RoomScene` built from the systems in §2.3 (no WebGL), so puzzle logic and timing (§3.1) can be tested in Vitest.
2. **Author-facing game tests.** Give game authors a way to write `test('can open door', async (g) => { await g.use('Key', 'Door'); expect(g.room).toBe('outside') })`. This is the foundation for the replay and solvability features in §7.
3. **Visual regression** screenshots for the pixel-alignment rules. `docs/testing.md` already lists this as a priority.
4. Raise coverage gradually on the modules extracted from `RoomScene`, not across the whole tree at once.

---

## 7. Creative directions for the future

These build on what BENNE already has: the PDC editor, voice IDs, Play From, the Aseprite pipeline and the hook system.

### 7.1 Make the Puzzle Dependency Chart a live, executable model
Today PDCs are planning-only Cytoscape JSON. Link nodes to real content: *"has item `Key`"*, *"flag `unlockedDoor`"*, *"in room `outside`"*. Then:
- **Solvability check.** Run a state-space search over the chart to detect dead ends and unwinnable states (a classic adventure-design failure), reported as diagnostics in the editor.
- **Live progress overlay** in BENNE Play: nodes light up as the player completes them.
- **Automatic hint system.** At runtime, find the player's frontier nodes and surface tiered hints (similar to Thimbleweed Park's in-game hint line).
- **Generated walkthroughs** for QA and press.

### 7.2 Record & replay
Log inputs (verb + target + timestamp) and RNG seeds. Uses:
- deterministic **regression playthroughs** in CI ("does the game still finish?");
- **bug reports** that include a replay file;
- **attract-mode** demos on the title screen;
- a **"Play From any point in a recording"** option, which is more natural than hand-written Play From scripts.

### 7.3 Developer console & time travel in BENNE Play
A docked panel showing flags, variables, inventory, current room, the queued interaction tail, and recent events, with the ability to edit values and **step back to any snapshot**. You already have serialisable snapshots (`exportJson`/`importJson`), so most of the work is UI.

### 7.4 Classic visual effects with Phaser 4 filters
`PostEffects.ts` is a placeholder. Period-accurate effects that suit the engine:
- **Palette cycling** (Mark Ferrari–style animated water and fire on static pixel art). Use indexed-colour textures plus a palette-shift shader.
- **Room palettes / light regions**: day/night or lamp-lit tints per region, building on the existing region system.
- **Dithered dissolves**, iris wipes and pixelate transitions for `changeTo`.
- An optional **CRT / scanline** filter as a player setting.
- **Walk-behind masks**: an optional painted mask layer (as in AGS / SCUMM) as an alternative to baselines for complex occlusion.

### 7.5 Localisation pipeline
Build on voice IDs and the Speaking Text CSV export:
- string tables per language with stable ids generated by the same processor;
- per-language bitmap fonts and line-wrap rules;
- an in-editor "pseudo-localise" toggle to catch overflowing GUI text;
- voice files resolved by `language/voiceId`.

### 7.6 Accessibility & player comfort
These are cheap to add and increasingly expected:
- a key that highlights all hotspots;
- text speed and auto-advance settings;
- subtitle size and background;
- remappable input, gamepad navigation between hotspots ("snap cursor"), touch support (long-press = look);
- reduced-flash and reduced-motion settings;
- an optional screen-reader live region announcing hovered object names and dialogue.

### 7.7 Content-aware authoring helpers
- An **"Unhandled interactions" report**: every `verb × target` combination that falls through to the global fallback. Designers can then decide which ones deserve a custom joke, a big part of the charm in the classic LucasArts games.
- **Bark generation at authoring time**: optionally draft fallback lines with an LLM for the author to edit and keep (never at runtime), saved into the script as normal `say` calls.
- **Aseprite live link**: watch `.aseprite` files and re-export on save via the Aseprite CLI, so art changes appear in previews without a manual export.

### 7.8 Platform reach
- **PWA / offline** web build, plus save sync via exported save codes.
- **Steam** via the existing Electron wrapper (Steamworks.js for achievements and cloud saves).
- **Mobile** through Capacitor, paired with the touch input work above.

### 7.9 Additional interaction schemes as templates
Beyond 2-click and 9-verb: Sierra-style **text parser**, **verb coin** (Curse of Monkey Island), **single-cursor context-sensitive** (Broken Sword), and a **keyboard/gamepad direct-control** mode. If verb resolution is cleanly separated (`resolvePointerVerb.ts` is already close), each scheme becomes a plugin plus a GUI template.

### 7.10 Plugin / extension API
Once the engine is a package (§2.1) and `B` is built from capabilities (§3.2), let games or third parties register **custom GUI controls**, **custom script capabilities** and **custom Inspector widgets** through a small, versioned plugin interface. This is the step from "engine for Ben's games" to "engine other people build on".

---

## 8. Suggested phased roadmap

**Phase 1 — Clean the foundation (low risk, quick wins)**
- Repo hygiene (§6 table): remove VSIX/built bundles/maps/snapshot, de-duplicate skills, align tool versions, add Changesets.
- Typed event bus (§2.5).
- Delete the `Room.ts` placeholder and redundant `activationEvents`.
- Depth-sort and pathfinding caches (§5).
- Split `architecture.md`; start ADRs.

**Phase 2 — Fix the structure**
- Monorepo with workspaces; `@benne/vite` virtual content module; `boot/` moves into the engine (§2.1–2.2).
- Content schemas → generated types, validator, `jsonValidation` (§2.6).
- TS-AST script model in the extension (§4.3), shared tooling package (§4.4).

**Phase 3 — Decompose and modernise**
- Extract systems from `RoomScene` one by one (§2.3), with a headless test harness growing alongside.
- `BenneRuntime` context replacing singletons (§2.4).
- Dev-server-backed previews with HMR (§4.1); Inspector on a component framework (§4.2).

**Phase 4 — Scripting v2**
- Decide between async/await and generators (§3.1), ship it behind a flag, provide a codemod, and migrate the templates.
- Capability-based `B` (§3.2) with a generated context matrix.

**Phase 5 — Differentiating features**
- Executable PDCs with solvability and hints (§7.1), record & replay (§7.2), dev console (§7.3), filters and palette cycling (§7.4), localisation and accessibility (§7.5–7.6).

Each phase leaves the engine shippable, and phases 1–2 make phases 3–5 much cheaper.
