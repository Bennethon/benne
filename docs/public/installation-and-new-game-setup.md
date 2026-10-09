---
title: Installation and New Game Setup
outline: deep
---

# Installation and New Game Setup

BENNE ships as a single, self-contained product: the **BENNE Editor** extension for Visual Studio Code. The extension bundles the engine, the editor tooling, the live previews, and a set of starter game templates. You don't install the engine separately or clone a repository — you install one extension, create a game, and start authoring.

This page walks you through everything you need to go from a clean machine to a running BENNE game.

## Prerequisites

Before you begin, make sure you have:

- **Visual Studio Code** (version 1.85 or newer).
- **Node.js** (a current LTS release is recommended). New games run on [Vite](https://vitejs.dev/) and Phaser 4, both installed through npm.
- **Aseprite** (recommended) for authoring sprite sheets. BENNE's art pipeline is built around Aseprite-exported sheets and tagged animations. You can technically supply compatible sheets another way, but Aseprite is the supported workflow.

You do **not** need a checkout of the BENNE source repository, a separate engine install, or any manual copying of templates. The extension is the SDK.

## Installing the BENNE Editor

You can install the extension two ways:

1. **From the Marketplace** — Search for **“BENNE Editor”** in the VS Code Extensions view and install it. This is the normal path once the extension is published.
2. **From a `.vsix` file** — If you have a packaged build (for example, a pre-release VSIX), install it from the command line:

```bash
code --install-extension benne-editor-<version>.vsix
```

Replace `<version>` with the version number of the VSIX you received.

After installation, you'll see a new **BENNE** icon in the VS Code Activity Bar (the vertical strip of icons on the far left). Clicking it opens the BENNE sidebar, which is your home base for creating and editing game content.

## Creating a New Game

With the extension installed:

1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **BENNE: Create New Game**. You can also trigger this from the BENNE sidebar when no game is currently open.
2. **Pick a template.** BENNE includes starter templates that set up a complete, playable game with different interaction styles:
   - **9-verb** — A classic LucasArts-style verb bar (Give, Pick up, Use, Open, Look at, Push, Close, Talk to, Pull) reminiscent of SCUMM-era adventures.
   - **2-click** — A minimalist, modern two-button scheme (typically walk/interact with one button and look/examine with the other).
3. **Name your project** and **choose a parent folder** where the new game directory will be created.
4. The extension scaffolds the project: it copies the engine and editor runtime, writes your `package.json`, `README.md`, `.vscode/settings.json`, and a `.benne-project` metadata file, then automatically runs **`npm install`** to fetch Phaser, TypeScript, and Vite.

When it finishes, open the newly created folder in VS Code. You'll have a fully functional game you can run immediately — both templates ship with rooms, characters, inventory items, GUIs, a dialog, and example scripts you can learn from and modify.

## Project Structure

A freshly created BENNE game is organized like this:

```
my-adventure/
├── src/
│   ├── engine/            ← the BENNE engine (managed by the editor; don't edit)
│   ├── editor/            ← preview / play entrypoints (managed)
│   ├── types/             ← shared + generated TypeScript types (managed)
│   ├── game/              ← YOUR game lives here
│   │   ├── game-config.json   ← resolution, verbs, cursor, audio, starting state…
│   │   ├── globalScript.ts    ← global game logic and fallbacks
│   │   ├── rooms/             ← *.room.json + *.room.ts per room
│   │   ├── characters/        ← *.character.json + *.character.ts
│   │   ├── guis/              ← *.gui.json + *.gui.ts
│   │   ├── inventory/         ← *.inventory.json + *.inventory.ts
│   │   ├── dialogs/           ← *.dialog.json + *.dialog.ts
│   │   ├── pdcs/              ← *.pdc.json puzzle dependency charts
│   │   └── assets/            ← images (Aseprite sheets), audio, fonts, videos
│   ├── main.ts
│   └── style.css
├── package.json
├── .benne-project          ← scaffold + extension version metadata
└── vite configs / HTML entrypoints
```

The key idea: **everything you author lives under `src/game/`**, while `src/engine/`, `src/editor/`, and `src/types/` are managed by the editor and refreshed when you update the engine. Your rooms, characters, assets, scripts, and `game-config.json` are never overwritten by an engine update.

::: tip Data-driven by design
Most of your content is described in JSON definition files (`*.room.json`, `*.character.json`, etc.), with light TypeScript files (`*.room.ts`, `globalScript.ts`, …) providing behavior. This separation keeps projects organized and lets the editor safely read and write your content.
:::

## Running Your Game

From the project folder, start the dev server:

```bash
npm run dev
```

This launches Vite and serves your game in the browser with hot-reloading. As you edit content and scripts, changes appear quickly so you can iterate without restarting.

For a production build:

```bash
npm run build
```

## Authoring Inside VS Code

While `npm run dev` is great for playing the whole game in a browser, most day-to-day authoring happens **inside VS Code** through the BENNE Editor:

- The **BENNE sidebar** gives you a tree of every room, character, GUI, inventory item, dialog, and puzzle chart in your game.
- **Live previews** open inside the editor so you can see rooms, characters, GUIs, and inventory items render exactly as they will in the shipped game.
- **Inspectors** let you edit properties visually and scaffold script handlers with a click.
- **“Play from this room”** lets you launch the game starting in any room, with optional setup hooks, so you can test a puzzle without playing from the beginning.

The next pages cover [game configuration](./game-configuration) and the [BENNE Editor](./benne-editor) in detail.

## A Note on Assets

BENNE expects a specific, opinionated art pipeline:

- **Sprite art** (characters, props, cursors, GUI elements) is authored as **Aseprite sprite sheets** with **tagged animations**. The editor can import tags directly to create props, inventory items, and character animations.
- **Text** is rendered with **bitmap fonts** only. Several retro bitmap fonts are included in new projects (for example, a LucasArts SCUMM-style font and a Sierra SCI menu font).
- **Audio** is organized by category: place sound effects under `src/game/assets/audio/sfx/` and music under `src/game/assets/audio/music/`, then reference them by filename (without extension) in scripts.

You don't have to memorize folder conventions — the editor's create commands and importers place files in the right locations for you.
