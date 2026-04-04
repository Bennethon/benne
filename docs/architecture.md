# BENNE — Architecture

## 1. Overview

**BENNE** is a **web-based point-and-click adventure game engine** (LucasArts / PowerQuest–style): fixed-resolution pixel rooms, click-to-walk, and verb-style interactions on props and characters. The runtime is **Phaser 4** (RC), **TypeScript**, and **Vite**.

**Core design goals**

- **Data-first**: Rooms, characters, and game tuning live in **JSON** (and Aseprite exports) under `src/game/`; TypeScript supplies **room scripts** and engine code, not hand-authored level blobs in code.
- **Separation**: **`src/engine/`** is reusable; **`src/game/`** is project-specific content and registration (`registerGameContent`).
- **Retro display**: Internal resolution defaults to **352×198**; Phaser scale mode **FIT** + **MAX_ZOOM** + **pixelArt** for crisp integer scaling. **Post-processing** is wired as a **camera hook** (`attachPostProcessingPlaceholder`) — currently a no-op, reserved for CRT / dissolve-style effects.
- **Simplicity over frameworks**: One primary gameplay scene (`RoomScene`), a thin boot loader (`BootScene`), and a **global `EventBus`** for script-facing events instead of a heavy ECS.

---

## 2. High-Level Architecture

**Major pieces**

| Area | Role |
|------|------|
| **`main.ts` + `Game.ts`** | DOM mount, `Phaser.Game` from `createGameConfig`. |
| **`gameConfig.ts`** | Phaser `GameConfig`: resolution from JSON, scale, `BootScene` + `RoomScene`. |
| **`ConfigManager.ts`** | Reads bundled `game-config.json` (`getGameSettings`). |
| **`BootScene`** | Loads assets for the **start room** (manifest + globbed JSON), then `scene.start(Room, startData)`. |
| **`RoomScene`** | Renders one room: background, Aseprite props, hotspots, characters, player walk, prop/character hit tests, debug overlays. |
| **`EventBus` (`gameEvents`)`** | `Phaser.Events.EventEmitter` — interaction strings from JSON (`onLook`, `onUse`, etc.) become events. |
| **`registerGameContent`** | Eager `import.meta.glob` of `globalScript` + `*.room.ts` registering handlers on `gameEvents`. |
| **`src/game/assets/`** | Images + Aseprite JSON; URLs resolved at build time via Vite `import.meta.glob` (`resolveGameAssetUrl`). |

**Interaction sketch**

```
┌─────────────────┐     load JSON + atlases      ┌──────────────┐
│   BootScene     │ ───────────────────────────► │  RoomScene   │
└────────┬────────┘     RoomSceneStartData       └──────┬───────┘
         │                                               │
         │  game-config.json / rooms.manifest            │ pointer → walk / prop / character
         ▼                                               ▼
┌─────────────────┐                            ┌─────────────────┐
│ ConfigManager   │                            │ EventBus        │◄── *.room.ts, globalScript
└─────────────────┘                            └─────────────────┘
```

**Editor (out of runtime path)**  
The **VS Code extension** (`benne-editor/`) and **`src/editor/preview/`** build a **bundled Phaser preview** that reuses `RoomScene` and fetches the same assets via webview URIs — tooling only, not part of the shipped game loop.

---

## 3. Core Systems

### Scene / room system

- **`BootScene`**: Entry after game creation. Uses `loadStartRoomData()` — **`startingRoomId` in `game-config.json` overrides** `rooms.manifest.json` — resolves the room’s `*.room.json` via Vite glob. Queues background image (optional), room Aseprite sheet, and character assets, then starts **`RoomScene`** with **`RoomSceneStartData`** (room JSON, spawn lists, texture keys).
- **`RoomScene`**: Single active gameplay view for that room. No second “room manager” type is used at runtime; the abstract **`Room`** class in `Room.ts` is a **placeholder** for future data-driven room types, not wired into Phaser yet.
- **Room switching**: **Not implemented** in-engine today — only the initial `BootScene` → `RoomScene` transition exists.

**Boundaries**: Room **layout and flags** come from JSON; **reactions** to emitted event ids belong in **`registerRoomScript`** in `*.room.ts`.

### Rendering system

- **Internal size** from `game-config.json` `resolution`; Phaser **Scale.FIT**, **CENTER_BOTH**, **MAX_ZOOM**, **autoRound** for pixel alignment.
- **Layers**: Background image (optional, full-frame) → props sorted by **`zIndex`** (Aseprite tags as frames) → characters at fixed high depth → debug graphics on top when enabled.
- **`PostEffects.ts`**: **`attachPostProcessingPlaceholder(this.cameras.main)`** — extension point for Phaser 4 camera filters; **no shaders shipped yet**.

### Input system

- **Walk**: **Left click** on empty space (no hit-test targets) moves the **player** character toward the click, **clamped** into **walkable polygons** (`walkable.ts` — point-in-polygon + segment clamping toward destination).
- **Props**: **Polygon hit area** per clickable prop; **left** = look (`onLook` string), **right** = use (`onUse`) when defined. Requires `walkToPoint`, `lookAtPoint`, and collider in JSON.
- **Characters / hotspots**: **Zones or sprites** with `pointerdown`; characters emit look events without the walk-to-stand flow unless extended later.
- **Context menu** disabled on mouse in `RoomScene`.

### Scripting / interaction system

- **String event ids** in JSON (e.g. `"look:office-desk"`) are **`gameEvents.emit(...)`** after walk + face (props) or immediately (hotspots / simple character look).
- **`registerGameContent()`** (called before `createBenneGame`) loads **`globalScript.ts`** (currently empty stub) and every **`./rooms/**/*.room.ts`** that exports **`registerRoomScript(events)`**.
- **Payloads**: Typed payloads for prop interaction (`propInteractionEvents.ts`), player walk start/stop, etc.
- **Boundary**: Scenes should not embed game-specific puzzle logic; they **emit** and **listen** only through agreed event names and small shared types.

### Asset management / loading

- **Room & character JSON** for Aseprite: **eager globs** in `loadAsepriteAtlasData.ts` (and friends); **normalized** for Phaser frame indices (`normalizeAsepriteJson.ts`).
- **Binary assets**: **`resolveGameAssetUrl` / `resolveGameAssetJsonUrl`** map paths like `images/rooms/office/office.png` to **Vite-built URLs** from `src/game/assets/**`.
- **Boot-time loading only** in `BootScene` (Phaser loader); **no streaming** or mid-room asset packs yet.

### Audio system

- **`applyBootAudioSettings`**: Sets Phaser sound manager volume from **`masterVolume`**.
- **Helpers**: `getEffectiveSfxVolume`, `getEffectiveMusicVolume`, `getEffectiveDialogueVolume` — for future SFX/music/dialogue; **no music/dialogue pipeline** is implemented in scenes yet beyond volume knobs in config.

---

## 4. Data Flow

1. **Bootstrap**: `game-config.json` → resolution, start room id, audio caps, debug flags.
2. **Boot**: Manifest + glob pick **`RoomData`** → **`BootScene`** builds load list → loader completes → **`RoomSceneStartData`** passed into **`RoomScene.create`**.
3. **Frame loop**: Phaser updates tweens / anims; **input** → hit tests → walk tweens or **`beginPropInteraction`** chain (walk → idle facing → **`gameEvents.emit`**).
4. **Scripts**: **`*.room.ts`** handlers (registered at startup) observe **`gameEvents`** and run side effects (logging, future UI/inventory/dialogue).

**Diagram (simplified)**

```
JSON + Aseprite  →  BootScene (Loader)  →  RoomScene (display + input)
                                              │
Pointer / keys ──────────────────────────────┤
                                              ▼
                                    gameEvents (EventBus)
                                              ▲
registerGameContent (*.room.ts, globalScript)─┘
```

---

## 5. Key Design Decisions

| Decision | Why | Tradeoff |
|----------|-----|----------|
| **One `RoomScene` + boot loader** | Keeps startup and asset story simple. | Room-to-room transition and state carryover **not built yet** — would add scene restart or sub-state machine. |
| **Global `gameEvents` singleton** | Fast to wire; matches stringly event ids from JSON. | Global coupling; tests need discipline or indirection later. |
| **JSON string event ids** | Editable in data; matches classic adventure “verb” naming. | Typos fail at runtime; editor/tooling (e.g. VS Code extension) helps. |
| **Vite glob for assets** | Correct hashed URLs and tree-shaking. | **Editor preview** must use a **separate fetch/Webview path** (`src/editor/preview/`) — two loading strategies. |
| **Walkable polygons in JSON** | Designer-controlled navmesh. | No auto navmesh; bad polygons break movement visually (mitigated by debug draw). |
| **Aseprite tags = props / anims** | Single sheet per room/character, industry-standard tool. | Untagged cels are invisible to the engine; tag discipline required. |

---

## 6. Constraints and Rules

- **Engine vs game**: Do not put **game-specific narrative or room logic** under `src/engine/` except through **generic hooks** (events, helpers). Put reactions in **`src/game/`** (`*.room.ts`, future modules).
- **Config**: **`game-config.json`** is the **single source** for resolution, default character, start room override, audio, debug flags — read via **`getGameSettings()`**, not duplicated literals.
- **Room data**: Follow **`RoomData`** / **`RoomPropInstance`** in **`src/types/room.ts`**; keep **`walkToPoint` / `lookAtPoint` / `collider`** consistent for clickable props.
- **Registration**: New room scripts must live under **`src/game/rooms/`** as **`*.room.ts`** exporting **`registerRoomScript`** to be picked up by **`registerGameContent`**.
- **Strict TypeScript**: Project uses **strict** compiler options; new code should preserve typings for payloads and JSON-shaped types.

---

## 7. Future Considerations

- **Room transitions**: Loading another room likely means **restarting `RoomScene`** (or a thin orchestrator) with new `RoomSceneStartData`; persistence of inventory/state across rooms is **not defined** in code yet.
- **Post-processing**: `PostEffects.ts` is ready for **camera filter** composition (CRT, dither, etc.).
- **Audio**: Volume helpers exist; **music loops, voice, and SFX triggers** from events are **future work**.
- **Dialogue / inventory**: Types exist under `src/types/` in places; **not integrated** into `RoomScene` flow yet.
- **Editor**: VS Code extension + **`build:room-preview`** targets **live `RoomScene` preview** in a webview; **polygon editing** in-editor is **planned**, not implemented in the engine repo beyond debug drawing.

---

## 8. VS Code extension & room preview (implementation detail)

This subsection documents **what exists today** for the **BENNE Editor** (`benne-editor/`) and the **room preview bundle** (`src/editor/preview/`). It does not replace earlier high-level notes; it adds concrete modules, messages, and rules.

### Purpose and build output

- **`npm run build:room-preview`** (repo root) runs **`vite.room-preview.config.ts`**, entry **`room-editor.html`**, and emits **`benne-editor/media/room-preview/room-preview.js`** (and assets). The extension loads that script from **`RoomPreviewPanelController`** HTML.
- The preview is **not** the same bundle as **`vite build`** for the playable game; it is a **separate** client that embeds Phaser with **`RoomScene`** and editor-only scenes.

### Preview runtime (`src/editor/preview/`)

| Module | Role |
|--------|------|
| **`roomEditorMain.ts`** | Webview entry: `window` **`message`** handler for host commands; **`acquireVsCodeApi`** for `postMessage` to the extension; DOM **toolbar** (Mode, walkable target, prop target, Save); **`wireToolbar`** / **`polygonEditBridge`** sync; **`loadRoomGeneration`** to ignore stale async **`buildPreviewManifest`** results when **`loadRoom`** overlaps; **`destroyPreviewGameAsync()`** calls **`Phaser.Game.destroy(true)`** then **`setTimeout(150ms)`** before reusing **`#benne-preview-root`** (webview **rAF** throttling makes listening for Phaser’s internal destroy event unreliable). |
| **`createRoomPreviewGame.ts`** | Constructs **`Phaser.Game`** with **`getBennePhaserGameConfigBase`**, **`callbacks.preBoot`** registry keys **`bennePreviewRoom`**, **`bennePreviewRoomJsonUri`**, **`bennePreviewPostPatch`**; scenes **`BennePreviewLoader`**, **`RoomScene`**, **`RoomPolygonEditScene`**. Loader **`create()`** starts **`RoomScene`**, **`launch`**es the polygon scene, then **`URL.revokeObjectURL`** for preview-only blob atlas URLs. |
| **`buildPreviewManifest.ts`** | **`fetch`**-based analogue of boot loading: builds **`PreviewManifest`** (`loads`, **`RoomSceneStartData`**, **`revokeObjectUrls`**) from **`RoomData`** + webview **`gameSrcWebviewUri`**. |
| **`RoomPolygonEditScene.ts`** | Overlay scene: when toolbar mode is **walkable** or **prop collider**, draws the active polygon, **drags** vertices (room pixel bounds), **double-tap edge** inserts a vertex, **Delete/Backspace** removes selected vertex (minimum **3** points), **`window`** **`benne-save-polygon`** dispatches **Save**; **`polygonEditBridge`** toggles **`RoomScene`** input off while editing. |
| **`polygonEditBridge.ts`** | Shared toolbar ↔ Phaser **mode** and selected **walkable polygon id** / **prop id** (`subscribe` for scene refresh). |
| **`polygonPatchTypes.ts`** | **`RoomPolygonPatch`** union sent to the extension (**Option A** payloads). |

### Webview ↔ extension protocol

| Message (direction) | Role |
|---------------------|------|
| **`benne/preview/ready`** (webview → host) | Preview script booted; host then **`pushPreview`**. |
| **`benne/preview/loadRoom`** (host → webview) | **`room`** (parsed **`RoomData`**), **`gameSrcWebviewUri`**, **`roomJsonUri`** (string for patch target identity). |
| **`benne/preview/clear`**, **`benne/preview/error`** | Reset or error string in the preview root. |
| **`benne/preview/polygonPatch`** (webview → host) | **`roomJsonUri`** + **`patch`** (`walkable` \| `propCollider` + ids + **`points`**). |
| **`benne/preview/polygonPatchResult`** (host → webview) | **`ok`**, optional **`message`**; when **`ok`**, optional **`appliedPatch`** (rounded polygon) for in-memory sync; webview updates status (no full game reload on save). |

**Persistence**: **`benne-editor/src/roomPolygonPatch.ts`** — **`parseRoomPolygonPatch`**, **`applyRoomPolygonPatch`**: merges patch into **`*.room.json`** on disk, **`JSON.stringify(…, null, 2)`**, integer-rounded **`Point2`**. On success the host sends **`polygonPatchResult`** with **`appliedPatch`** (rounded coordinates); the webview updates the live registry **`RoomData`** so the preview stays mounted. A full **`pushPreview` → `loadRoom`** rebuild is reserved for room selection changes and other host-driven refreshes — not for every polygon save (destroy/recreate in the webview was brittle).

### Extension panel behavior (summary)

- **`RoomPreviewPanelController`** (`benne-editor/src/roomPreviewPanel.ts`): **`WebviewPanel`** **`benneRoomPreview`**, **`localResourceRoots`** include workspace **`src/game`**; **`pushPreview`** reads room JSON from disk and posts **`loadRoom`**; handles **`polygonPatch`** and replies **`polygonPatchResult`** then **`pushPreview`**.
- Tree-driven **editor area** reset, **two-row** layout for room/prop selection, **pinned** text documents, and **serialized** preview pushes live in **`extension.ts`** / **`roomScriptNavigation.ts`** (see extension sources for exact commands — not duplicated here to avoid drift).

### Data flow (preview save)

```
Toolbar Save → postMessage(polygonPatch) → applyRoomPolygonPatch(uri) → polygonPatchResult(ok, appliedPatch)
     → webview applies appliedPatch to registry room (Phaser game stays alive)
```

---

*This document reflects the repository as of the last update; when behavior changes, prefer updating this file over stale comments scattered in code.*
