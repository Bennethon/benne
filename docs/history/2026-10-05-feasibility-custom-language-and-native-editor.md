# BENNE — Feasibility: Custom BenneScript Language & Native Authoring App

> **Archived 2026-10-07.** Its first recommendation, fixing script semantics inside TypeScript before considering a new language, became the BenneScript refactor (`docs/bennescript-ergonomics-refactor.md`). The custom language, narrative DSL and native authoring app were not pursued; they are listed as ideas in [`docs/roadmap.md`](../roadmap.md).

> **Historical document.** Written before the BenneScript refactor (October 2026). Its scripting examples and file references use the old `register*Script` / `B` API, which no longer exists. For the current API see `docs/public/bennescript.md` and `docs/bennescript-api.md`.

_Written 2026-10-05. Covers two proposed large refactors:_

1. **A custom scripting language for BenneScript** to replace the TypeScript-based scripting layer.
2. **A native authoring application** to replace the `benne-editor` VS Code extension.

This document looks at whether each one is feasible, which technologies and architectures could work, and what each would gain and cost. It builds on `docs/engine-review-2026-10.md` (§3 Scripting, §4 Editor) and `docs/codex-suggestions.md` (§2, §12, §13). Effort figures are rough estimates in **full-time person-months for one experienced developer**. Treat them as relative sizes, not schedules.

---

## 0. TL;DR

| | Custom language | Native authoring app |
|---|---|---|
| **Feasible?** | Yes. The domain is narrow and well understood (SCUMM, AGS, Ren'Py, Ink, Yarn). | Yes, as long as "native" means a **desktop shell around web views**. A truly native UI toolkit is technically possible but works against the Phaser renderer. |
| **Best technical route** | A small DSL compiled to an **in-engine coroutine VM** (or to generator functions), with a **TypeScript escape hatch** and a **Langium- or hand-written parser + LSP**. | An **Electron** app (already a dependency) with **Monaco** or **CodeMirror 6**, a dockable layout, and a shared, headless **authoring-model** package. |
| **Biggest win** | Execution order matches source order, so the timing hazard and the `.now` API twins go away. Scripts become structurally analysable, which enables tooling, voice IDs, localisation and save-anywhere. | One integrated, purpose-built workspace: real canvas editors, docking, undo, onboarding for non-programmers, and no webview/extension-API constraints. |
| **Biggest cost** | You own a language indefinitely: parser, errors, LSP, debugger, docs, and migration. AI assistants and TS developers lose their fluency. | You rebuild everything VS Code provides for free: text editing, IntelliSense, search, git, terminal, extension ecosystem, AI tooling. |
| **Effort** | MVP 2–3 pm · production-quality 6–12 pm | MVP 3–5 pm · parity+ 8–14 pm |
| **Recommendation** | **First fix the semantics inside TypeScript** (async/generator handlers, already recommended in the engine review). Then build a **narrative/cutscene DSL** for dialogue-heavy content, and adopt a full custom language only if that DSL proves itself. | **Extract a headless authoring core first.** Then ship a standalone Electron app **focused on visual editing**, and let authors keep using VS Code (or any editor) for code until the app's code editing is good enough. |

The decisions **compound**: a custom language plus a native app means building a whole IDE. See §3.

---

## 1. Baseline: what exists today

Facts that drive the analysis:

- **Runtime:** Phaser 4 RC + TypeScript + Vite. Games ship to the web and to desktop via **Electron** (`electron/main.cjs`, `electron-builder.config.cjs`).
- **Scripting:** about 37 files in `src/engine/scripting/`. Six script kinds (room, character, inventory, GUI, dialog, global) are registered through `register*Script(({ B }) => …)`. Each one gets a differently shaped `B` facade (`BenneScriptCore` and its subclasses, documented in a 1,100-line API reference).
- **Execution model:** handlers are **synchronous functions that enqueue lazy promises** onto `interactionTail` (`BenneScriptCore.chain`, `src/engine/scripting/BenneScriptCore.ts:937`). Only some calls are queued. Plain JS (`if`, locals, `B.state.getFlag`, getters) runs at enqueue time. The sample game shows the hazard directly:

  ```ts
  // src/game/rooms/apartment/apartment.room.ts
  B.walkToClicked();                       // queued
  if (B.state.getFlag('unlockedDoor')) {   // evaluated NOW, before the walk
  ```

  Every queued call needs a `.now` twin (`withNow`, `BlockingWithNow`), so the API surface is doubled.
- **Static typing of content IDs** already exists: `scripts/generate-game-ids.mjs` produces `src/types/generated/benne-game-ids.d.ts`, and a TS server plugin (`benne-editor/ts-plugin`, `roomScriptIdTsPlugin.ts`) adds ID completions.
- **Tooling parses scripts with regexes and brace counting:** `verbHandlerPresence.ts` (950 lines), the stub insertion in the scaffolding files, and `voiceIdProcessor.ts` (which pulls `B.say` lines out of TS for voice-ID/CSV export).
- **Editor:** a VS Code extension of about 33k lines. It has 55 contributed commands, a tree view, an Inspector webview (`inspectorMain.ts`, about 4k lines of string-built HTML), and five Phaser preview bundles (room, character, GUI, inventory, BENNE Play) built by separate Vite configs. It also has a Cytoscape-based Puzzle Dependency Chart editor and about 20 `*Scaffolding.ts` flows that edit JSON and script together.
- **Rendering parity is a hard rule** (`.cursor/rules/benne-preview-rendering-parity.mdc`): previews must use the same Phaser renderer config as the shipped game.
- The project relies heavily on **AI coding assistants** (`.cursor/rules`, `.agents/skills`, `.cursor/skills`). This matters for both decisions.

---

## 2A. Custom scripting language

### 2A.1 What problem would it solve?

A custom language is justified only if it fixes things that TypeScript cannot fix cheaply. Ranked by value:

| Problem | Fixable inside TS? | Custom-language advantage |
|---|---|---|
| **Timing hazard:** source order ≠ execution order | **Yes:** `async/await` or generator handlers (engine review §3.1, option 1/2) | Marginal. A DSL makes every statement sequential by default, with no `await` to forget. |
| **`.now` duplication** | **Yes**, once handlers are async (`.now` simply means "don't await") | Marginal. `parallel:` / `background:` blocks express this a little more clearly. |
| **Ceremony and boilerplate** (`registerRoomScript(({ B }) => {`, `B.` everywhere, `payload.itemId === …` chains) | Partly, with helpers and codegen | **Strong.** `on use Key on Door:` is far more readable for non-programmers. |
| **Narrative authoring** (long dialogue trees, voice IDs, localisation extraction) | Partly. Tagged templates work, but tooling must parse TS. | **Strong.** Dialogue lines, choices and voice tags become first-class syntax. |
| **Tooling fragility** (regex scanning, brace counting, stub insertion) | **Yes**, with the TS compiler API / `ts-morph` (engine review §4.3) | **Strong.** You own the AST, so "which verbs are handled?", "insert a handler" and "rename a prop" are trivial and exact. |
| **Save anywhere / skip cutscene / cancellation** | Hard. JS closures and promise chains cannot be serialised; cancellation needs threading `AbortSignal` through everything. | **Strong.** A VM with explicit frames can serialise, cancel and fast-forward a running script. |
| **Hot reload of scripts during play** | Possible via Vite HMR, but handler identity and in-flight promises make it messy | **Good.** Swap compiled handler tables; running coroutines can finish on old code. |
| **Sandboxing / modding** | Hard (arbitrary JS) | **Good.** The language can expose only the `B` capabilities. |

**Conclusion:** the top two complaints can be fixed without a new language. A custom language pays off through **authoring ergonomics, structural tooling, narrative features and save/skip semantics**. Those are real but secondary benefits, so the case is strongest if BENNE targets **writers and designers** rather than programmers.

### 2A.2 What TypeScript gives you for free today (and you would have to replace)

- A world-class type checker, with typo-checking of IDs through generated unions.
- IntelliSense, refactoring, go-to-definition, find-references, hover docs, all in every editor.
- A debugger (breakpoints, stepping, watches) through Chrome DevTools / VS Code, plus source maps.
- Formatting (Prettier), linting (ESLint), and the whole npm ecosystem for helpers.
- Vite bundling, tree-shaking, HMR, and the existing CI typecheck (`npm run typecheck`).
- Fluency for **every LLM coding assistant**. A new language starts at zero, and you would have to ship grammar docs and examples as agent skills to compensate.
- Familiarity for any web developer who picks up the engine.

### 2A.3 What the language might look like

A sketch, for comparison with `apartment.room.ts`:

```benne
room apartment

on enter:
    unless music.playing:
        music.play "my-cat-is-crazy"

on enter after fade:
    if room.last is outside:
        wait 0.5
        sound.play "doorClose"
        Door.animation = "Door"

on look at Couch:
    face clicked
    Hank: It's my weird, magical, poorly drawn couch.

on talk to penny:
    walk to clicked
    Hank: Hey Penny!
    Penny: Hi!
    start dialog chatwithpenny

on open, use Door:
    walk to clicked
    if flag unlockedDoor:                 # evaluated AFTER the walk
        Door.animation = "Door-open"
        sound.play "doorOpen" and wait
        go to room outside
    else:
        Hank: The door is locked.         #@voice HANK_042
        display "The door is locked. AHH!"

on use Broom on Couch:
    walk to Couch
    Hank: I used the broom on the couch.

on give Broom to Couch:
    walk to Couch
    face up
    Hank: Here, couch.
    inventory.remove Broom

background:                               # replaces `.now`
    sound.play "sweeping"
```

Key design decisions to settle early:

- **Sequential by default:** every statement completes before the next one starts. Concurrency is explicit (`background:`, `parallel:`, `race:`).
- **First-class narrative:** `Speaker: line` statements, choice blocks for dialogs, `#@voice` / `#@loc` tags, and string interpolation.
- **Typed content IDs:** the compiler loads the game JSON (rooms, props, characters, inventory, verbs) and reports `Coutch` as an error with a suggestion.
- **Scoping by file kind:** `room`, `character`, `inventory`, `gui`, `dialog` and `global` headers decide which capabilities are in scope. This replaces the subclass "context matrix" with declarative capability sets (engine review §3.2).
- **Escape hatch:** `extern` / `import ts "./helpers.ts"` lets authors call TypeScript functions for anything the language can't express (math-heavy minigames, custom GUI logic). This is essential. Without it the language either grows into a general-purpose one or blocks users.
- **Syntax style:** an indentation-based style (Ren'Py, Python) reads best for writers. Braces are easier to parse and format robustly. Pick one and commit.

### 2A.4 Implementation approaches

#### Option A1: Transpile to TypeScript/JavaScript (generators or async)

`.benne` → compiler → `.ts` that calls today's `register*Script` + `B` APIs (after they move to async/generator handlers). A Vite plugin compiles files on import, so HMR, bundling and source maps keep working.

- **Pros:** cheapest route. It reuses the whole runtime, debugging maps back through source maps, and the escape hatch is just an `import`.
- **Cons:** save-anywhere is still impossible (JS closures can't be serialised). Cancellation semantics are inherited from the runtime.
- **Effort:** 2–3 pm for language, compiler, Vite plugin and a basic LSP.

#### Option A2: Compile to bytecode / IR, run on an in-engine coroutine VM

`.benne` → compiler → a compact JSON IR (instruction lists per handler). The runtime ships a small interpreter that runs each handler as a **resumable coroutine** with explicit frames (program counter, locals, call stack).

- **Pros:** the VM owns time, so you get **save mid-cutscene**, **skip/fast-forward** (run until the next input point with animations collapsed), **deterministic replay** (engine review §7.2), clean cancellation on room change, hot-swappable handlers, and sandboxing. Performance is irrelevant at adventure-game script volumes.
- **Cons:** you build a debugger yourself (a DAP adapter over the VM). Runtime errors need your own source mapping. Locals in saves must be restricted to serialisable values, which also enforces the save-format discipline from codex-suggestions §3. TS interop goes through an explicit FFI table.
- **Effort:** 5–8 pm for a production-quality VM, compiler, LSP and DAP.

#### Option A3: Adopt existing languages instead of inventing one

- **Ink** (inkle) or **Yarn Spinner** for dialogue and narrative, both with mature JS runtimes, editors and localisation. Game actions go through external functions or commands (`<<walk_to Door>>`). This covers most of the narrative and voice-ID value at a fraction of the cost.
- **Lua** via **wasmoon** (Lua 5.4 in WASM) or **Fengari** (pure JS), for a general scripting language with native coroutines. Many adventure engines use it (e.g. Grim Fandango's Lua). Coroutines solve sequencing, but Lua coroutines are not serialisable either, and you take on a second runtime and type-checking gap.
- **Pros:** proven languages with existing tooling and documentation. LLMs know them.
- **Cons:** two languages in one project (Ink + TS, or Lua + TS). Integrating them with BENNE's ID system, previews and editor tooling is still custom work.
- **Effort:** Ink/Yarn integration 1–2 pm; Lua 2–4 pm.

#### Option A4: Stay in TypeScript, fix the semantics (the baseline to beat)

Convert handlers to `async` (or generator) functions. Enforce `no-floating-promises` in game projects, delete the `.now` twins, and replace regex tooling with a `ts-morph` script model.

- **Effort:** 1.5–3 pm including a codemod for existing scripts.
- This should happen **regardless**. A1 is far easier on top of it, and it makes the custom-language decision lower-stakes.

### 2A.5 Toolchain technology options

| Concern | Options | Notes |
|---|---|---|
| **Parser** | **Hand-written recursive descent** · **Langium** · Chevrotain · Ohm · Lezer · tree-sitter | Hand-written gives the best error messages and recovery (rustc, TypeScript and Roslyn all do this). **Langium** (TypeScript, Eclipse) generates parser, AST types, scoping and a **full LSP server**, runs in Node and in the browser, and targets VS Code and Monaco, which suits both editor paths. Lezer is ideal for CodeMirror highlighting. tree-sitter is best for highlighting in Zed, Neovim, Helix and GitHub. |
| **Language server** | `vscode-languageserver` (Node) · Langium built-in | Diagnostics, completion (IDs from JSON), hover (API docs), go-to-definition (into JSON), rename, code actions ("add handler"), semantic tokens. |
| **Highlighting** | TextMate grammar (VS Code, Shiki for docs site) · Lezer · tree-sitter | You will want a TextMate grammar at least, for VS Code and the VitePress docs. |
| **Formatter** | Custom pretty-printer over the AST | Important for indentation-sensitive syntax. |
| **Debugger** | Debug Adapter Protocol (`@vscode/debugadapter`) talking to the VM over a WebSocket/IPC from BENNE Play | Required for A2. A1 can lean on source maps. |
| **Build integration** | Vite plugin (`transform` hook) · or a pre-build step like `generate-game-ids` | A Vite plugin keeps HMR and the existing dev loop. |
| **Testing** | Golden-file tests (source → IR/diagnostics), VM step tests, the existing Playwright e2e | A language needs a large conformance suite. |

### 2A.6 Target architecture (A2 variant)

```
                    ┌────────────────────────── @benne/lang ───────────────────────────┐
 *.benne ──► lexer ─► parser (CST, error-recovering) ─► binder (IDs from game JSON) ─►   │
             typecheck (capabilities per script kind) ─► lower ─► IR (JSON) + source map  │
                    └──────┬──────────────────────────────────────┬────────────────────┘
                           │ used by                              │ used by
              ┌────────────▼───────────┐            ┌─────────────▼─────────────┐
              │ LSP server (VS Code,   │            │ Vite plugin: .benne → IR  │
              │ Monaco, any LSP editor)│            │ module, HMR               │
              └────────────────────────┘            └─────────────┬─────────────┘
                                                                  ▼
 Runtime: ScriptVM (coroutines, frames, serialisable) ──► capability bindings ──► today's
          ▲  save/load frames · cancel on room change · skip mode · DAP hooks        engine
          └── FFI table ◄── authored TypeScript helpers (escape hatch)               services
```

### 2A.7 Pros and cons

**Pros**
- Execution order matches source order by construction, which removes a whole class of authoring bugs.
- Halves the API surface (no `.now` twins) and removes the `register*Script` / `B.` ceremony.
- Exact, cheap structural tooling: handler discovery, scaffolding, rename-ID refactors, voice-ID and localisation extraction, PDC↔script linking (engine review §7.1). The regex code in `verbHandlerPresence.ts` disappears.
- Enables save-anywhere, skip-cutscene, replay, cancellation and hot reload (A2).
- Approachable for writers and designers, and a strong differentiator ("BENNE has its own adventure language", like AGS Script, SCUMM, Ren'Py).
- Sandboxing makes mods and user-generated content safer.

**Cons**
- **Permanent maintenance burden:** grammar evolution, backwards compatibility, error-message quality, LSP, formatter, debugger and docs. This is the dominant cost, and it never ends.
- You lose TypeScript's type system, ecosystem and debugger for game logic. The escape hatch adds a second language to learn.
- **AI assistants can't write it well** out of the box, which hurts the current workflow (agents, skills, cursor rules). You would need to maintain a language reference and examples as skills.
- Every existing game script needs migration (a codemod, plus manual review of non-trivial handlers).
- Expressiveness creep: authors will ask for arrays, functions, modules and closures, and the language drifts toward reinventing JS.
- Splits the debugging experience: engine bugs live in TS DevTools, script bugs in your debugger.
- Little value for programmer-authors who already like TypeScript.

### 2A.8 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep into a general-purpose language | Fix a written charter ("sequencing, narrative, state, verbs; everything else goes through the TS FFI") before writing the grammar. |
| Poor error messages drive users away | Hand-written parser with error recovery, and a diagnostics golden suite from day one. |
| Migration breaks shipped games | Keep TS scripts supported in parallel for at least one major version. Both register into the same dispatcher. |
| VM bugs in save/load of frames | Restrict locals to JSON-compatible values. Version the IR. Add save-fixture tests per IR version. |
| Tooling lag (LSP behind language) | Generate the LSP from the same front-end (Langium, or a shared hand-written front-end). Never write two parsers. |

---

## 2B. Native authoring app

### 2B.1 Clarifying "native"

The renderer is **Phaser/WebGL**, and the parity rule requires previews to run the exact runtime config. Every option below therefore needs a **web view hosting Phaser** for room, character, GUI and inventory canvases and for BENNE Play. The real choice is the **shell** around those views:

1. a desktop shell built on web tech (Electron, Tauri, NW.js), or
2. a native UI toolkit (Qt, Avalonia, egui, Slint, SwiftUI) that embeds web views for every canvas.

Option 2 gives native chrome, but the most important panels are still web, which adds a bridge and duplicates the UI in two technologies.

### 2B.2 What VS Code gives you for free today (and you would have to replace)

- A world-class text editor with TS IntelliSense, refactoring, search/replace across files, multi-cursor, and minimap.
- Git integration, a terminal, problems panel, debugger, tasks, settings sync.
- Workspace and file management, file watching, dirty-state and undo for text documents.
- Extension distribution and update (`.vsix`, Marketplace / Open VSX) and cross-platform support.
- An ecosystem: Prettier, ESLint, Aseprite viewers, Copilot / Claude Code / Cursor (Cursor is a VS Code fork, so the extension works there too).
- Familiarity for any developer.

### 2B.3 What the extension model costs you today

- **Webview constraints:** iframe sandboxing, `postMessage` protocols (about 29 untyped message types in the Inspector), CSP, no shared state across panels, and slow panel startup.
- **Layout control is limited:** `benneEditorLayout.ts` fights VS Code to manage a two-row layout. You can't dock a property grid next to a canvas the way a game editor would.
- **Tree views are basic:** no drag-and-drop thumbnails or inline editing, and limited styling.
- **Prebuilt preview bundles** (five Vite configs, Phaser duplicated in each, committed `media/**/*.js`).
- **Undo** is split across text documents and webview gizmos.
- **Audience:** non-programmers find VS Code intimidating. A purpose-built app (like AGS, Godot, Adventure Creator or Visionaire) is friendlier.

### 2B.4 Shell technology options

| Option | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Electron** | Chromium + Node. Same stack as the shipped desktop build. | Already a dependency (`electron@44`, `electron-builder`). Chromium gives the **same WebGL as BENNE Play / shipped desktop**, so parity holds. Node access for fs, child processes (Vite dev server, Aseprite CLI). Monaco and the TS language service run unchanged. `electron-updater` for auto-update. Mature (VS Code, Figma desktop, GitHub Desktop). | ~100–150 MB installers, memory-heavy. Security hardening needed (context isolation, preload IPC, already done for the game shell). | **Recommended.** |
| **Tauri 2** | Rust core + **system web view** (WebView2 on Windows, WKWebView on macOS, **WebKitGTK** on Linux). | Small binaries (~10 MB), lower memory, Rust backend, good security model. | **Rendering parity risk:** three different web engines, and WebKitGTK's WebGL performance and compatibility on Linux is noticeably weaker. That violates the parity rule unless BENNE Play is run in a separate Chromium. Node-based tooling (Vite, TS) needs a sidecar process. Rust adds a second language. | Viable only if the parity rule is relaxed. |
| **Web app** (browser + local dev server, or File System Access API) | `npx benne studio` starts a local server and opens the browser, like Storybook or Vite UI. | Zero install beyond Node, trivially cross-platform, same Chromium (in Chrome/Edge), easy to wrap in Electron later. | File System Access API is Chromium-only. Weaker OS integration (menus, file associations, multi-window). Feels less "app". | **A good stepping stone:** build it as a web app first, wrap it in Electron. |
| **Qt (C++ or PySide)** | Native widgets + `QWebEngineView` (Chromium) for canvases. | Best native feel, mature docking (`QDockWidget`), performance. | Two UI stacks. Every canvas still in Chromium. C++/Python codebase separate from the TS engine. Licensing considerations (LGPL/commercial). | Not recommended. |
| **Avalonia (.NET) / Slint / egui (Rust)** | Native UI, embedded web view for canvases. | Native performance; Avalonia has good docking. | Same dual-stack problem, and web-view embedding on Linux is weak. All authoring logic would need rewriting outside TS. | Not recommended. |
| **Godot / other engine as the editor shell** | Use an engine's editor UI. | Gets docking, inspectors and scene trees for free. | Different renderer, so parity is broken unless the runtime is rewritten. | Out of scope. |

### 2B.5 UI building blocks (Electron / web-app route)

| Need | Options |
|---|---|
| UI framework | **Svelte 5**, **Solid**, **Preact + signals**, or React. Small, reactive and fast; any of them is fine. Choose the one you'll enjoy maintaining. |
| Docking layout | **Dockview** (zero-dependency, VS Code-like), FlexLayout, Golden Layout 2 |
| Code editor | **Monaco** (the VS Code editor; TS IntelliSense via its TS worker; LSP via `monaco-languageclient`) or **CodeMirror 6** (lighter, Lezer grammars, `@codemirror/lsp-client`) |
| Property grid / Inspector | Schema-driven forms from the JSON Schemas proposed in engine review §2.6 (e.g. JSON Forms, or a custom widget set keyed on `x-benne-widget`) |
| Graph editing (PDC) | Keep **Cytoscape + ELK** (already used) or move to **React Flow / Svelte Flow** |
| Canvas previews | Today's `src/editor/preview/*` Phaser scenes, loaded from a **single Vite dev server** with HMR (engine review §4.1) |
| Undo/redo | Command pattern over a central document store (Immer patches or a custom op log) |
| File watching | `chokidar` / `@parcel/watcher` in the main process |
| Git (optional) | Shell out to `git`, or `isomorphic-git`. Keep it minimal; users can still use their own tools. |
| Packaging/updates | `electron-builder` (already configured) + `electron-updater` |
| Terminal (optional) | `xterm.js` + `node-pty` |

### 2B.6 Target architecture

The most important architectural move is the same for **both** editor futures: pull authoring logic **out of the VS Code extension** into a headless package that any shell can use.

```
┌──────────────────────────── @benne/authoring (headless, pure TS, no vscode import) ─────────────────────┐
│ ContentIndex (rooms, props, chars, GUIs, inventory, dialogs, PDCs) · JSON Schemas + validation          │
│ Mutations as typed commands (addProp, movePoint, renameId…) · Undo/redo op log · Revisioned documents  │
│ ScriptModel (ts-morph today, BenneScript AST tomorrow): handler discovery, stub insertion, rename       │
│ Scaffold pipeline (templates/) · Engine update · Voice-ID / localisation export                        │
└───────────────┬──────────────────────────────────────────────────────┬─────────────────────────────────┘
                │                                                      │
     ┌──────────▼───────────┐                         ┌────────────────▼──────────────────────────────┐
     │ VS Code extension    │                         │ BENNE Studio (Electron)                       │
     │ (thin adapter: tree, │                         │ main: fs, watcher, Vite dev server, IPC       │
     │ commands, webviews)  │                         │ renderer: Dockview layout, project tree,      │
     └──────────┬───────────┘                         │ inspector, Monaco/CM6, PDC graph, asset browser│
                │                                     └────────────────┬──────────────────────────────┘
                └──────────────┬───────────────────────────────────────┘
                               ▼
            Vite dev server (one multi-entry config) ──► Phaser previews + BENNE Play (HMR, parity)
```

Benefits of this ordering:
- Every step is useful even if the native app is never built (codex-suggestions §12/§13 and engine review §4.3–4.5 all point the same way).
- The VS Code extension and the app can **coexist** during migration and possibly forever.
- The authoring core is testable in plain Vitest, with no VS Code test harness.

### 2B.7 Feature parity checklist

What needs porting or rebuilding, and how hard each piece is:

| Feature | Reuse potential | Difficulty |
|---|---|---|
| Phaser previews (room/character/GUI/inventory) + polygon edit scene | High: `src/editor/preview/*` is already standalone | Low |
| BENNE Play | High: same runtime bundle | Low |
| Inspector | Medium. The logic is reusable but the string-built HTML should be rewritten as components. | Medium |
| Main tree + filtering + context menus | Logic reusable (`gameDiscovery.ts`), UI new | Medium |
| ~20 scaffolding flows / 55 commands | High once moved to `@benne/authoring` | Medium |
| PDC editor (Cytoscape) | High: already a standalone webview bundle | Low |
| Script editing with BENNE-aware completions | Monaco TS worker + port of the TS plugin logic | **High** |
| Go-to-handler / reveal stub / navigation | Needs the ScriptModel | Medium |
| Project creation / engine update | Logic reusable | Low–Medium |
| Search across project, git, terminal, debugger | Must be built or deferred ("Open in VS Code" button) | **High** |
| Undo/redo across visual + JSON edits | New central store | Medium–High |

### 2B.8 Pros and cons

**Pros**
- A purpose-built UX: docked canvases, inspectors and asset browsers, drag-and-drop from an asset panel into a room, thumbnails, and multi-select.
- Much friendlier onboarding for artists, writers and designers. One download, no "install VS Code, then the extension, then Node".
- Full control of layout, focus, undo and keyboard shortcuts, with no fighting the host's extension API.
- Typed in-process state instead of webview `postMessage` plumbing.
- Can bundle Node/Vite/engine versions, removing environment setup failures.
- A natural home for features VS Code can't host well: timeline/cutscene editor, walk-path debugging overlays, live game-state inspector, time-travel debugging (engine review §7.3), localisation tables.
- Distinct product identity ("BENNE Studio").

**Cons**
- **Reimplementing an IDE.** Text editing, IntelliSense, search, git and debugging are years of work in VS Code. Without them, authors bounce between two apps anyway.
- Loses the AI-assistant integration authors get in VS Code and Cursor (Copilot, Claude Code, Cursor agents) unless you build or embed your own.
- Distribution cost: code signing (Windows Authenticode, macOS notarisation), auto-update infrastructure, per-OS installer bugs.
- Two editors to maintain during migration, and possibly permanently if programmer-authors keep preferring VS Code.
- A ~33k-line extension represents a lot of tested behaviour that must be re-proven, and e2e tests must be rewritten for Playwright-Electron.
- App size and memory (Electron) are noticeably larger than an extension.

### 2B.9 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Code editing never reaches VS Code quality | Phase 1 ships **visual editing only**, with "Open script in external editor" (respecting `$EDITOR` / VS Code). Add Monaco later. |
| Rendering drift between app and game | Load previews from the same Vite entry the game uses, in Chromium (Electron). Keep the parity test in CI. |
| Double maintenance | Make the extension a thin adapter over `@benne/authoring`, so most features are written once. |
| Big-bang rewrite stalls | Ship the authoring core first, then a web "Studio" served by `npx benne studio`, then wrap it in Electron. Each step is releasable. |

---

## 3. How the two decisions interact

| | **Keep VS Code extension** | **Native app** |
|---|---|---|
| **Keep TypeScript** | Status quo. Cheapest. Fix semantics (async/generators) and tooling (ts-morph). | Monaco gives TS IntelliSense almost for free. Work goes into visual editors. **Moderate.** |
| **Custom language** | An LSP + TextMate grammar gives a first-class experience in VS Code (and Cursor, Zed, Neovim) with modest effort. **Moderate.** | You must build the language **and** host its tooling in your own editor. Langium + Monaco reduces the pain, but this is the **largest and riskiest** combination. |

Observations:
- A **custom language helps a native app more than TS does** in one respect. Your own AST makes visual editing of scripts possible: a handler list in the Inspector, a block/flow view of a cutscene, a dialog tree view, and PDC nodes linked to handlers. With TS this always stays heuristic.
- A **custom language reduces the cost of leaving VS Code** in another respect: if scripts are simple DSL files, you don't need full TS IntelliSense in the app.
- Conversely, doing **both at once** doubles the blast radius. Sequence them.

---

## 4. Recommended path (with decision gates)

**Phase 0: do-regardless foundations (3–5 pm total, all useful on their own)**
1. Switch BenneScript handlers to async/generator semantics, remove `.now` twins, and ship a codemod (engine review §3.1).
2. Introduce JSON Schemas for content (engine review §2.6).
3. Extract `@benne/authoring`: content index, typed mutations, undo log, scaffold pipeline, `ts-morph` ScriptModel (codex §12/§13, engine review §4.3–4.5).
4. Move to one multi-entry Vite dev server for previews and Play, with HMR (engine review §4.1).

**Gate A:** after Phase 0, are authors still hitting sequencing bugs, or is the remaining pain mostly narrative authoring and tooling?

**Phase 1: narrative DSL pilot (2–3 pm)**
- Build a **dialogue/cutscene DSL** (or integrate **Ink/Yarn**) compiled by a Vite plugin to the async API. It covers `B.say` blocks, dialog choices, voice IDs and localisation, and calls TS for game logic.
- Build it with **Langium** or a hand-written front-end shared by the compiler and an LSP, and ship it in the VS Code extension.

**Gate B:** do writers and authors prefer it? Does it remove the voice-ID and localisation pain? If yes, grow it toward full room/character scripting (A1). Move to the VM (A2) only when save-anywhere or skip/replay become product requirements.

**Phase 2: BENNE Studio (visual-first) (3–5 pm for an MVP)**
- Serve a web Studio from the authoring core (`npx benne studio`) and wrap it in Electron with the existing `electron-builder` setup.
- Scope: project tree, schema-driven Inspector, room/character/GUI/inventory canvases, PDC editor, BENNE Play, and scaffolding. Script editing opens in the external editor.

**Gate C:** do authors live in Studio, or keep switching back to VS Code? Only then invest in embedded Monaco + LSP, search, and a debugger (another 4–8 pm). Keep the VS Code extension as a thin adapter for programmer-authors.

---

## 5. Effort summary

| Item | Low | High | Notes |
|---|---|---|---|
| Async/generator handlers + codemod (A4) | 1.5 | 3 | Recommended regardless |
| Authoring core extraction | 2 | 3 | Recommended regardless |
| Narrative DSL / Ink-Yarn integration | 1 | 3 | Lowest-risk custom-language step |
| Full DSL → TS transpiler + LSP (A1) | 2 | 4 | Builds on A4 |
| Coroutine VM + IR + DAP debugger (A2) | 5 | 8 | Needed for save-anywhere / replay |
| Migration of existing game scripts | 0.5 | 1.5 | Per codebase; codemod + review |
| Studio MVP (web + Electron, visual-only) | 3 | 5 | After authoring core |
| Studio code editing (Monaco + TS/LSP) | 2 | 4 | |
| Studio search / git / debugger / polish | 2 | 4 | Where an IDE rebuild starts |
| Code signing, auto-update, installers | 0.5 | 1 | Partly reusable from the game desktop build |

---

## 6. Open questions to answer before committing

1. **Who is the primary author?** Programmers who like TS, or writers and artists? This single answer decides most trade-offs in both proposals.
2. Is **save-anywhere / skip cutscene / replay** a product requirement? If yes, that is the strongest argument for a VM-based language.
3. How important is **AI-assisted authoring** to the workflow? It favours TS and VS Code-family editors unless you invest in language docs as agent skills.
4. Is the **rendering parity rule** non-negotiable? If yes, use Electron or Chromium-based web views only (this rules out Tauri on Linux).
5. Should the VS Code extension be **retired**, or kept long-term as a "pro mode" over the shared authoring core?
6. Would BENNE ever support **mods or untrusted content**? If so, a sandboxed language becomes much more valuable.
