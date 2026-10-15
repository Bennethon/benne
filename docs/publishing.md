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

### Attach the VSIX to a GitHub release

VSIX files are not tracked in git (`*.vsix` is ignored). Each one is kept as an asset on the [GitHub release](https://github.com/Bennethon/benne/releases) for its version tag. After packaging, commit the version bump, then tag and release:

```bash
git tag v<version>
git push github master v<version>
git push gitlab master v<version>
gh release create v<version> benne-editor/benne-editor-<version>.vsix --verify-tag --title "v<version>" --generate-notes
```

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
├── src/game/            ← live dev game slot (gitignored)
├── game-templates/      ← switchable templates (2-click, 9-verb, blank, ai-apocalypse)
├── benne-editor/        ← VS Code extension source
└── scripts/             ← template switcher, scaffold bundler, …
```

Template switching and live authoring are documented in [architecture.md §9](architecture.md#9-game-content-templates-and-switch-script). The monorepo workflow is **not** replaced by the extension-as-SDK model.

## Publish checklist (manual steps)

Before publishing, commit and push the final release candidate, then run **BENNE regressions** from GitHub Actions using **Run workflow** on that branch or tag. Wait for all 12 jobs to succeed, including the browser soak, compatibility matrix, Windows packaging, and graphics checks. Alternatively, dispatch from the CLI with `gh workflow run regression.yml --repo Bennethon/benne --ref <candidate-ref>`. This is the pre-release check; monthly validation does not replace testing the actual candidate. Packaging locally does not dispatch the GitHub workflow automatically.

The **`npm run package:extension`** command above runs everything below automatically. Use this section only if you need to run steps individually.

From the repo root, a full extension release build runs:

1. **`npm run bundle:scaffold`** — copies engine, editor, types, Vite configs, scripts, and the release templates (`scripts/lib/releaseTemplates.mjs`; not the development-only `ai-apocalypse`) into `benne-editor/scaffold/`
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

BENNE uses **one version number**: the extension semver in **`benne-editor/package.json`**. There is no separate “engine version”, “SDK version”, or internal milestone label like “v1.5” — when docs or conversation refer to a release, they mean this semver.

| Label | Where it lives | Meaning |
|-------|----------------|---------|
| **Extension version** | `benne-editor/package.json` → `version` | What `@vscode/vsce` publishes; VSIX filename (`benne-editor-0.0.2.vsix`) |
| **Scaffold version** | `benne-editor/scaffold/manifest.json` → `scaffoldVersion` | Copied from extension `version` when you run `bundle:scaffold` / package |
| **Project metadata** | `.benne-project` in each created game | `scaffoldVersion` + `extensionVersion` stamped at **Create New Game** time |

The monorepo root `package.json` (`"version": "0.0.0"`, private) is **not** the distributable version — only `benne-editor/package.json` matters for authors.

**Extension-as-SDK** is the distribution *model* (extension ships engine + editor + templates), not a version number.

Example `.benne-project` written into a new game:

```json
{
  "scaffoldVersion": "0.0.1",
  "extensionVersion": "0.0.1",
  "templateId": "2-click",
  "projectName": "my-adventure",
  "createdAt": "2026-06-01T12:00:00.000Z"
}
```

### Updating an existing game’s engine

Use **BENNE: Update Engine** (Command Palette, BENNE sidebar title bar, or right-click the workspace root in the BENNE tree).

**Typical workflow:**

1. Install a newer extension build (`npm run package:extension` in the monorepo, then install the VSIX).
2. Open your game workspace in VS Code.
3. Run **BENNE: Update Engine**.
4. Review the summary (unchanged / overwritten / new file counts) and confirm **Update**.
5. If editor previews look stale afterward, run **Rebuild Editor Preview Bundles**.

**What changes**

| Updated | Preserved |
|---------|-----------|
| `src/engine/`, `src/editor/`, `src/types/` (from `scaffold/shared/`) | `src/game/` (rooms, characters, assets, scripts) |
| Engine files the new version no longer ships (`scripts/removed-engine-files.json`) are deleted | `README.md`, `.vscode/settings.json` |
| Vite configs, HTML entrypoints, `scripts/` | `package.json` `name`, `private`, `version` |
| `package.json` scripts + `phaser` / `typescript` / `vite` versions | `templateId`, `projectName`, `createdAt` |
| `.benne-project` → `scaffoldVersion` + `extensionVersion` | |

The command runs `npm install` and `npm run build:benne-play` after copying files.

> **`src/game/` is never written.** The code that loads game content lives in the engine (`src/engine/content/`). Games made before 0.1.0 kept it in `src/game/boot/`; Update Engine deletes those files, the only files under `src/game/` it ever touches.

**Version behavior**

- Extension **newer** than the game → update proceeds after the file summary confirmation.
- Versions **equal** → offers **Re-sync anyway** (useful for dev or a corrupted tree).
- Extension **older** than the game → warns before allowing a downgrade.

Games without `.benne-project` (e.g. the monorepo dev slot) still work; the current engine version is treated as **unknown**.

**If npm fails after the copy**

Engine files are already on disk. Fix the error and run `npm install` and `npm run build:benne-play` manually, or re-run the command (use **Re-sync** if versions match).

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

Generated `package.json` includes the engine, Vite, TypeScript, Electron packaging dependencies, and npm scripts for development, preview rebuilds, itch.io HTML ZIPs, and Windows desktop ZIPs. It does **not** include monorepo-only scripts (`set-template`, `sync-template-down`, etc.). See [Publishing Games](public/publishing-games.md).

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
