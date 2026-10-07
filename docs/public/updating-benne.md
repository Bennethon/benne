---
title: Updating BENNE
outline: deep
---

# Updating BENNE

Because BENNE ships as a single VS Code extension that bundles the engine, editor, previews, and templates, updating works in two stages:

1. **Update the extension** to get the new editor and engine.
2. **Update each game** that you want to move onto the newer engine.

Existing games are **not** changed automatically when you update the extension — you decide when each project adopts a new engine version. This keeps you in control and means a new engine release can't break a game mid-development without your say-so.

## How versioning works

BENNE uses **one version number**: the extension's semantic version. There's no separate "engine version" or "SDK version" — when a release is referred to, it means this single number.

This version is stamped in three places so you always know what a project is running:

| Where | What it means |
|-------|---------------|
| The installed **extension version** | The editor + engine you currently have in VS Code. |
| A project's **`.benne-project`** file | The `scaffoldVersion` and `extensionVersion` the game was created or last updated with. |
| The scaffold payload inside the extension | The engine/template version the extension would install. |

When you run an update, the editor compares your installed extension version against the game's `.benne-project` version to decide whether you're upgrading, re-syncing, or downgrading.

## Updating the extension

Update the **BENNE Editor** the same way as any VS Code extension:

- **From the Marketplace** — VS Code will offer updates automatically, or you can update manually from the Extensions view.
- **From a `.vsix`** — Install a newer packaged build:

```bash
code --install-extension benne-editor-<version>.vsix
```

Updating the extension upgrades the editor UI, the bundled previews, and the engine that *new* games (and engine updates) will use. Your already-created games keep running on whatever engine they were last updated to until you update them.

## Updating a game's engine

To move an existing game onto the engine bundled with your current extension, run **BENNE: Update Engine**. You can launch it from:

- the **Command Palette**,
- the BENNE sidebar title bar, or
- right-clicking the workspace root in the BENNE tree.

A typical workflow:

1. Install a newer extension build.
2. Open your game's workspace in VS Code.
3. Run **BENNE: Update Engine**.
4. Review the summary (counts of unchanged, overwritten, new and removed files; the output channel lists them) and confirm.
5. If editor previews look stale afterward, run **Rebuild Editor Preview Bundles**.

After copying files, the command automatically runs `npm install` and rebuilds the BENNE Play bundle so your project is immediately ready.

### What gets updated, and what's preserved

The update is careful to refresh only engine-managed code and leave your authored content alone:

| Updated | Preserved |
|---------|-----------|
| `src/engine/`, `src/editor/`, `src/types/` | `src/game/` (rooms, characters, GUIs, inventory, dialogs, assets, scripts) |
| `src/game/boot/` — shared loader glue | `game-config.json`, `globalScript.ts`, and all your `*.room.ts` / `*.ts` scripts |
| Vite configs, HTML entrypoints, `scripts/` | `README.md`, `.vscode/settings.json` |
| `package.json` scripts and the `phaser` / `typescript` / `vite` versions | `package.json` `name`, `private`, `version` |
| `.benne-project` version stamps | `templateId`, `projectName`, `createdAt` |
| Engine files the new engine no longer has are **removed** (for example the old scripting API in `src/engine/scripting/`, gone since 0.1.0), along with folders they leave empty | Any other file you added, including your own files in engine folders |

::: info Why `src/game/boot/` is the one exception
The `boot/` folder is a thin layer of shared engine glue (for example, the asset-URL resolver) that engine modules import. New engine features can require new boot exports, so the update overwrites and adds boot files to keep them in lockstep with the engine. It's the **only** part of `src/game/` an update touches — your rooms, characters, assets, scripts, and configuration are never overwritten.
:::

### Version checks

The command behaves differently depending on how your installed extension compares to the game:

- **Extension newer than the game** → proceeds after you confirm the file summary (a normal upgrade).
- **Versions equal** → offers **Re-sync anyway**, useful during development or to repair a corrupted tree.
- **Extension older than the game** → warns before allowing a downgrade.

Games without a `.benne-project` file (such as a from-source dev project) still work; the engine version is simply treated as **unknown**.

### If `npm install` fails after the update

The engine files are already copied to disk before npm runs, so a failed install doesn't lose your update. Fix the underlying error, then either run `npm install` and `npm run build:benne-play` manually, or re-run **BENNE: Update Engine** (use **Re-sync** if the versions now match).

## Refreshing previews after an update

If a room, character, GUI, or inventory preview looks out of date after updating, rebuild the preview bundles. You can use **Rebuild Editor Preview Bundles** from the sidebar, the individual **Rebuild …** buttons in the **Actions** view, or the npm scripts directly:

```bash
npm run build:room-preview
npm run build:character-preview
npm run build:gui-preview
npm run build:inventory-preview
npm run build:benne-play
```

In a standalone game, rebuilt previews are written into the project (under `.benne/preview-bundles/`) and the editor picks them up from there.

## Summary

- BENNE has a single version: the extension's semver.
- Updating the extension upgrades your tooling and the engine used for new games.
- Existing games adopt a new engine only when you run **BENNE: Update Engine**.
- Updates replace engine code and the small `boot/` glue layer but never touch your authored content or configuration.
- Rebuild preview bundles if previews look stale after an update.
