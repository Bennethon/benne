# BENNE Editor

Visual authoring tools for [BENNE](https://github.com/bennethon/BENNE) — a web-based point-and-click adventure engine (Phaser 4, TypeScript, Vite).

Install this extension to create new games, edit rooms/characters/GUIs/inventory/dialogs in VS Code, and preview or play your game without leaving the editor.

## Getting started

### Create a new game

1. Open the Command Palette and run **BENNE: Create New Game**.
2. Choose a template (e.g. **2-Click Adventure** or **9-Verb SCUMM-style**).
3. Name the project and pick a parent folder.
4. When `npm install` finishes, open the new folder.
5. Run `npm run dev` in the project to play in the browser.

The extension scaffolds a self-contained project: engine source, template content under `src/game/`, and build scripts. Project metadata is stored in `.benne-project` at the workspace root.

### Open an existing BENNE game

Open a folder that contains `src/game/rooms/`. The **BENNE** activity bar view lists rooms, characters, GUIs, inventory, dialogs, and puzzle dependency charts.

## Features

- **Main tree** — browse and select game content; scaffold new rooms, characters, GUIs, inventory items, dialogs, and puzzle charts.
- **Inspector** — edit JSON metadata for the selected entity; auto-saves on blur.
- **Room preview** — live Phaser preview with walkable polygons, prop colliders, hotspots, regions, and points.
- **Character / GUI / inventory previews** — focused previews for authoring geometry and layout.
- **BENNE Play** — full runtime in a webview panel (same boot path as the shipped game).
- **Actions view** — rebuild preview bundles and run common authoring commands.

## Requirements

- **Node.js** and **npm** on your PATH (used when creating a new game and when rebuilding preview bundles).
- A BENNE game workspace layout: `src/game/` with at least `src/game/rooms/`.

## Extension settings

| Setting | Default | Description |
|--------|---------|-------------|
| `benneEditor.roomPreview.autoRebuildOnGameConfigChange` | `true` | Rebuild the room preview bundle when `src/game/game-config.json` changes. |
| `benneEditor.roomPreview.autoRebuildDebounceMs` | `1500` | Debounce (ms) before starting that automatic rebuild. |
| `benneEditor.dialogue.autoInsertBackticks` | `true` | In BenneScript files, typing `Hank:` at the start of a statement inserts `` `…` `` for the line of dialogue. |
| `benneEditor.layout.closePanelOnOpen` | `false` | Close the bottom Panel (Terminal, Output, Problems) when a room, character, GUI or inventory item opens in the two-row preview/source layout. |

## Preview rebuilds

The extension ships prebuilt preview bundles. After changing engine or preview entry code in your game project, rebuild locally:

- `npm run build:room-preview`
- `npm run build:character-preview`
- `npm run build:gui-preview`
- `npm run build:inventory-preview`
- `npm run build:benne-play`

Standalone projects (created via **Create New Game**) write output to `.benne/preview-bundles/`. Use the **Rebuild …** commands in the BENNE Actions view when needed. Build logs go to the **BENNE room preview build** output channel; the Panel only opens if a build fails and you choose **Show Output**.

## Documentation

Engine architecture and authoring conventions live in the BENNE repo under `docs/`. Packaging and distribution are described in `docs/publishing.md`.

## Release notes

### 0.0.1

- Initial extension-as-SDK release: **Create New Game**, bundled engine/templates, and VS Code authoring for BENNE projects.