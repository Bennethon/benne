# BENNE — Publishing and distribution

This document describes how BENNE is packaged for authors and how engine/template versions are tied to the VS Code extension. For runtime architecture, see [architecture.md](architecture.md).

## Package a release VSIX (one command)

From the **repo root**, after `npm install` in both the root and `benne-editor/`:

```powershell
npm run package:extension
```

That single command:

1. **Increments** `benne-editor/package.json` `version` by one **patch** (e.g. `0.0.1` → `0.0.2`)
2. **Bundles** engine, editor runtime, Vite configs, and game templates into `benne-editor/scaffold/`
3. **Builds** all editor preview bundles into `benne-editor/media/`
4. **Webpacks** the extension (`dist/extension.js`, Inspector, PDC editor)
5. **Writes** `benne-editor/benne-editor-<version>.vsix`

The scaffold manifest and every new game created from this VSIX will carry the same version as the extension.

### Variants

| Command | Version bump | When to use |
|---------|--------------|-------------|
| `npm run package:extension` | patch (+0.0.1) | Bug fixes, routine releases |
| `npm run package:extension:minor` | minor (+0.1.0) | New features, template changes |
| `npm run package:extension:major` | major (+1.0.0) | Breaking engine or scaffold changes |
| `npm run package:extension:no-bump` | none | Retry after a failed build, or rebuild at the current version |

### Install the VSIX locally

```powershell
code --install-extension benne-editor\benne-editor-<version>.vsix
```

Replace `<version>` with the number printed at the end of the packaging run (e.g. `0.0.2`).

### Publish to the Marketplace

After packaging, from `benne-editor/` (requires a [publisher token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)):

```powershell
cd benne-editor
npx @vscode/vsce publish
```

The marketplace rejects a version that is already published — always run `npm run package:extension` (or `:minor` / `:major`) first so the version is new.

### If packaging fails after a version bump

The version in `benne-editor/package.json` is updated **before** the build. If a later step fails, fix the error and retry without bumping again:

```powershell
npm run package:extension:no-bump
```

Or revert the version change in `benne-editor/package.json` manually.

---

## Distribution model (extension-as-SDK)

**The VS Code extension is the single distributable** for game authors. There is no separate npm package for the engine.

The extension ships:

- The **BENNE Editor** (sidebar, Inspector, previews, scaffolding commands)
- **Prebuilt preview bundles** under `benne-editor/media/` (room, character, GUI, inventory, BENNE Play)
- A **scaffold payload** under `benne-editor/scaffold/` (engine source, editor preview runtime, configs, and game templates)

Authors install the extension, run **BENNE: Create New Game**, and receive a standalone project folder with full source and build scripts.

## Monorepo development (unchanged)

Day-to-day engine and template work still happens in the BENNE monorepo:

```
BENNE/
├── src/engine/          ← shared engine
├── src/editor/          ← preview / play entrypoints
├── src/game/            ← live dev game slot
├── game-templates/      ← switchable templates (2-click, 9-verb, …)
├── benne-editor/        ← VS Code extension source
└── scripts/             ← template switcher, scaffold bundler, …
```

Template switching, boot sync, and live authoring are documented in [architecture.md §9](architecture.md#9-game-content-templates-and-switch-script). The monorepo workflow is **not** replaced by the extension-as-SDK model.

## Publish checklist (manual steps)

The **`npm run package:extension`** command above runs everything below automatically. Use this section only if you need to run steps individually.

From the repo root, a full extension release build runs:

1. **`npm run bundle:scaffold`** — copies engine, editor, types, Vite configs, scripts, and `game-templates/*` into `benne-editor/scaffold/`
2. **Preview builds** — `build:room-preview`, `build:character-preview`, `build:gui-preview`, `build:inventory-preview`, `build:benne-play` (outputs to `benne-editor/media/` in the monorepo)
3. **Extension webpack** — `npm run compile` / `package` under `benne-editor/`
4. **VSIX** — `npx @vscode/vsce package` (or `publish`) from `benne-editor/`

The `vscode:prepublish` script in `benne-editor/package.json` chains steps 1–3 automatically when packaging.

### Local scaffold only

During extension development (Extension Development Host), run from the repo root:

```bash
npm run bundle:scaffold
```

Without this, **Create New Game** will report that the scaffold payload is missing.

## Versioning

- **Extension version** (`benne-editor/package.json` `version`) implicitly defines the **engine and template version** bundled into the VSIX.
- **`scaffold/manifest.json`** records `scaffoldVersion` (same as extension version at build time) and the template catalog.
- Generated projects include **`.benne-project`** at the workspace root:

```json
{
  "scaffoldVersion": "0.0.1",
  "extensionVersion": "0.0.1",
  "templateId": "2-click",
  "projectName": "my-adventure",
  "createdAt": "2026-06-01T12:00:00.000Z"
}
```

Future upgrade flows can compare `scaffoldVersion` / `extensionVersion` against the installed extension (not implemented in v1.5).

## End-user flow

1. Install **BENNE Editor** from the marketplace (or a `.vsix`).
2. Run **BENNE: Create New Game** (Command Palette or BENNE sidebar when no game is open).
3. Pick a template, name the project, choose a parent folder.
4. The extension copies scaffold files, writes `package.json`, `README.md`, `.vscode/settings.json`, `.benne-project`, and runs **`npm install`** (Phaser + TypeScript + Vite).
5. Open the new folder and use the BENNE sidebar to author content; run **`npm run dev`** to play in the browser.

## Scaffold payload contents

| Copied from extension `scaffold/shared/` | Generated on create |
|------------------------------------------|---------------------|
| `src/engine/`, `src/editor/`, `src/types/` | `.benne-project` |
| `src/main.ts`, `src/style.css` | `package.json` |
| Vite configs, HTML entrypoints, `scripts/` | `README.md` |
| | `.vscode/settings.json` |

| Copied from `scaffold/templates/<id>/` | Destination |
|----------------------------------------|-------------|
| Full template tree (boot, rooms, assets, …) | `src/game/` |

Generated `package.json` includes runtime and dev dependencies only (`phaser`, `typescript`, `vite`) plus npm scripts for dev, build, and preview bundle rebuilds. It does **not** include monorepo-only scripts (`set-template`, `sync-boot-down`, etc.).

## Preview rebuilds in standalone projects

The extension loads preview scripts from:

1. **Workspace** `.benne/preview-bundles/<preview-name>/` when present (after a local rebuild), else
2. **Monorepo sibling** `benne-editor/media/<preview-name>/` when developing inside the BENNE repo, else
3. **Extension bundled media** shipped in the VSIX.

Standalone projects write rebuild output to `.benne/preview-bundles/` because the marketplace extension install directory is not writable. Rebuild commands in the generated project:

- `npm run build:room-preview`
- `npm run build:character-preview`
- `npm run build:gui-preview`
- `npm run build:inventory-preview`
- `npm run build:benne-play`
- `npm run watch:benne-play` (BENNE Play auto-reload in the editor)

After rebuilding, use the matching **Rebuild …** command in the BENNE Actions view if the extension does not pick up the new bundle automatically (room preview reloads HTML on rebuild success).

## What authors do not need

- A checkout of the BENNE monorepo
- A separate engine npm install
- Manual copying of `game-templates/`

Install the extension, create a game, and author.
