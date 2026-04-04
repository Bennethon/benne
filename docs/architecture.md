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

- **Walk**: **Left click** on empty space (no hit-test targets) moves the **player** character toward the click, **clamped** into **walkable regions** (`walkable.ts` — each **`WalkablePolygon`** is an outer ring minus optional **active** hole rings; union across polygons; point-in-polygon + closest-point clamping toward the click).
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
- **Walkable mesh**: **`walkable.polygons[]`** entries support optional **`holes[]`** (inner rings subtracted when **`active`** is not **`false`**). Each polygon and hole may set **`active`**; omitted or non-**`false`** means included in tests and debug draw. See **`walkable.ts`** and **`RoomScene`** debug overlays (outer vs hole stroke colors).
- **Registration**: New room scripts must live under **`src/game/rooms/`** as **`*.room.ts`** exporting **`registerRoomScript`** to be picked up by **`registerGameContent`**.
- **Strict TypeScript**: Project uses **strict** compiler options; new code should preserve typings for payloads and JSON-shaped types.

---

## 7. Future Considerations

- **Room transitions**: Loading another room likely means **restarting `RoomScene`** (or a thin orchestrator) with new `RoomSceneStartData`; persistence of inventory/state across rooms is **not defined** in code yet.
- **Post-processing**: `PostEffects.ts` is ready for **camera filter** composition (CRT, dither, etc.).
- **Audio**: Volume helpers exist; **music loops, voice, and SFX triggers** from events are **future work**.
- **Dialogue / inventory**: Types exist under `src/types/` in places; **not integrated** into `RoomScene` flow yet.
- **Editor**: VS Code extension + **`build:room-preview`** ship a **live `RoomScene` preview** in a webview with **polygon editing** (walkable outer rings, holes, and prop colliders) via **`RoomPolygonEditScene`** — see **§8**.

---

## 8. VS Code extension & room preview (implementation detail)

This subsection documents **what exists today** for the **BENNE Editor** (`benne-editor/`) and the **room preview bundle** (`src/editor/preview/`). It does not replace earlier high-level notes; it adds concrete modules, messages, and rules.

### Purpose and build output

- **`npm run build:room-preview`** (repo root) runs **`vite.room-preview.config.ts`**, entry **`room-editor.html`**, and emits **`benne-editor/media/room-preview/room-preview.js`** (and assets). The extension loads that script from **`RoomPreviewPanelController`** HTML.
- The preview is **not** the same bundle as **`vite build`** for the playable game; it is a **separate** client that embeds Phaser with **`RoomScene`** and editor-only scenes.

### Preview runtime (`src/editor/preview/`)

| Module | Role |
|--------|------|
| **`roomEditorMain.ts`** | Webview entry: `window` **`message`** handler; **`acquireVsCodeApi`**; **`lastLoadedRoom`** for lightweight toolbar updates; **`wireToolbarFromPreviewState`** builds **room** vs **prop-tree** toolbars; **`loadRoomGeneration`** + **`destroyPreviewGameAsync()`** (same **150ms** delay after **`Phaser.Game.destroy(true)`** as before). |
| **`createRoomPreviewGame.ts`** | Constructs **`Phaser.Game`** with **`getBennePhaserGameConfigBase`**, **`callbacks.preBoot`** registry keys **`bennePreviewRoom`**, **`bennePreviewRoomJsonUri`**, **`bennePreviewPostPatch`**; scenes **`BennePreviewLoader`**, **`RoomScene`**, **`RoomPolygonEditScene`**. Loader **`create()`** starts **`RoomScene`**, **`launch`**es the polygon scene, then **`URL.revokeObjectURL`** for preview-only blob atlas URLs. |
| **`buildPreviewManifest.ts`** | **`fetch`**-based analogue of boot loading: builds **`PreviewManifest`** (`loads`, **`RoomSceneStartData`**, **`revokeObjectUrls`**) from **`RoomData`** + webview **`gameSrcWebviewUri`**. |
| **`RoomPolygonEditScene.ts`** | Overlay: **walkable** (outer or hole ring), or **prop collider** when allowed. **Drags** vertices, **double-tap edge** adds a vertex (closed rings with ≥3 points), **click-to-add** bootstraps the first three vertices on empty or short rings; **Delete/Backspace** respects minimum **3** points; **`benne-save-polygon`** → patch; **`polygonEditBridge`** disables **`RoomScene`** input while editing. Prop collider points are only edited when **`clickable === true`** (toolbar and **`getActivePoints`** both enforce). |
| **`polygonEditBridge.ts`** | **Mode** (`navigate` \| `walkable` \| `propCollider`), **`walkablePolygonId`**, **`walkableHoleId`** (empty = outer ring), **`propId`**; **`subscribe`** notifies the polygon scene. |
| **`polygonPatchTypes.ts`** | **`RoomPolygonPatch`**: **`walkable`** (**`polygonId`**, optional **`holeId`**, **`points`**) \| **`propCollider`** (**`propId`**, **`points`**). |

### Webview ↔ extension protocol

| Message (direction) | Role |
|---------------------|------|
| **`benne/preview/ready`** (webview → host) | Preview script booted; host then **`pushPreview`**. |
| **`benne/preview/loadRoom`** (host → webview) | **`room`**, **`gameSrcWebviewUri`**, **`roomJsonUri`**, plus **`previewFocus`**: **`room`** \| **`prop`**, and **`propColliderId`** when focus is **`prop`** (drives toolbar layout without extra round-trips). |
| **`benne/preview/toolbarUi`** (host → webview) | Same **`previewFocus`** / **`propColliderId`** fields when the **room JSON URI is unchanged** (e.g. switching **room node** ↔ **prop node** under the same room) so the webview rewires the toolbar and **`polygonEditBridge`** **without** tearing down Phaser. |
| **`benne/preview/clear`**, **`benne/preview/error`** | Reset or error string in the preview root. |
| **`benne/preview/polygonPatch`** (webview → host) | **`roomJsonUri`** + **`patch`**. |
| **`benne/preview/polygonPatchResult`** (host → webview) | **`ok`**, optional **`message`**; when **`ok`**, **`appliedPatch`** mirrors what was written (including **`walkable.holeId`** when applicable); webview applies it to registry **`RoomData`** — **no** follow-up **`pushPreview`** on save. |

**Persistence**: **`benne-editor/src/roomPolygonPatch.ts`** — **`applyRoomPolygonPatch`** merges into **`*.room.json`**, rounds **`Point2`** to integers, supports **`walkable`** patches on the **outer ring** or on a **hole** under **`polygonId`** via optional **`holeId`**.

### Toolbar UX (tree selection)

| BENNE tree selection | Preview toolbar |
|----------------------|-----------------|
| **Room** node (not a prop) | **Mode**: Navigate or **Edit walkable**. **Walkable/Holes** dropdown lists each polygon’s **outer** ring and each **hole** (JSON-encoded option values). **Save** when editing walkables. No prop collider mode here — colliders are edited only via prop selection. |
| **Prop** under a room | If **`clickable: true`**: **Prop collider** line + **Save** only; scene stays in **prop collider** edit mode for that **`propId`**. If not clickable: short message that **`"clickable": true`** is required; **Navigate** (no polygon edit). |

### Extension panel behavior (summary)

- **`RoomPreviewPanelController`** (`benne-editor/src/roomPreviewPanel.ts`): **`WebviewPanel`** **`benneRoomPreview`**; **`pushPreview`** posts **`loadRoom`** with toolbar fields; **`lastPushedRoomJsonUri`** skips redundant **`loadRoom`** when only the **prop vs room** tree focus changes (same file), and **`postToolbarUiIfNeeded`** sends **`toolbarUi`** instead; **`polygonPatch`** → **`polygonPatchResult`** (**no** automatic **`pushPreview`** after a successful save).
- Selecting another **prop** under the **same** room does **not** reset the editor surface (see **`extension.ts`**); the preview panel updates via **`toolbarUi`** / **`loadRoom`** as above.
- **Two-row** layout, **pinned** documents, and tree commands remain in **`extension.ts`** / **`roomScriptNavigation.ts`**.

### Data flow (preview save)

```
Toolbar Save → postMessage(polygonPatch) → applyRoomPolygonPatch(uri) → polygonPatchResult(ok, appliedPatch)
     → webview applies appliedPatch to registry room (Phaser game stays alive; no pushPreview)
```

### Runtime walk mesh (engine)

- **`src/engine/walkable.ts`**: **`isPointInWalkablePolygon`** — inside **active** outer, not inside any **active** hole; **`isPointInWalkableArea`** unions polygons; **`clampWalkDestinationTowardClick`** uses holed closest-point logic.
- **`RoomScene`** debug **`showWalkable`**: strokes **active** outers and **active** hole rings (distinct colors).

---

*This document reflects the repository as of the last update; when behavior changes, prefer updating this file over stale comments scattered in code.*
