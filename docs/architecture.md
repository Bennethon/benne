# BENNE — Architecture

## 1. Overview

**BENNE** is a **web-based point-and-click adventure game engine** (LucasArts / PowerQuest–style): fixed-resolution pixel rooms, click-to-walk, and verb-style interactions on props and characters. The runtime is **Phaser 4** (RC), **TypeScript**, and **Vite**.

**Core design goals**

- **Data-first**: Rooms, characters, and game tuning live in **JSON** (and Aseprite exports) under `src/game/`; TypeScript supplies **room scripts** and engine code, not hand-authored level blobs in code.
- **Separation**: **`src/engine/`** is reusable; **`src/game/`** is project-specific content and registration (`registerGameContent`).
- **Retro display**: Internal resolution defaults to **352×198**; Phaser scale mode **FIT** + **MAX_ZOOM** + **pixelArt** for crisp integer scaling. **Post-processing** is wired as a **camera hook** (`attachPostProcessingPlaceholder`) — currently a no-op, reserved for CRT / dissolve-style effects.
- **Scrolling rooms**: Rooms wider or taller than the viewport declare `size` in `RoomData` (e.g. `"size": { "width": 704, "height": 198 }`). `RoomScene` reads this and sets `cameras.main.setBounds` + `startFollow` on the player so the camera tracks movement within the room. An optional `scrollBounds` field further restricts how far the camera pans (PowerQuest-style).
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

### Scrolling room camera

- **Room size** (`RoomData.size`): the physical extent of the room in game-world pixels.  Controls camera bounds, walkable-area extent, and whether `startFollow` is activated.  The background image and Aseprite prop sheets render at their **own natural dimensions** — `size` does **not** scale the art.  Setting `size` smaller than the art restricts the camera to a sub-region of the art, which is valid (e.g. the art bleeds beyond the playable area).  Matches PowerQuest's "Room Bounds."

- **Scroll bounds** (`RoomData.scrollBounds`): optional `{ x, y, width, height }` in room space that restricts how far `cameras.main` may pan within the room.  When omitted the camera pans anywhere within `size`.  Making `scrollBounds` narrower than `size` keeps the camera away from room edges (the camera is "less eager" to scroll to the edge).  Making `scrollBounds` equal to `size` lets the camera pan all the way to the edge.  Implemented via `cameras.main.setBounds(scrollBounds)`.  Matches PowerQuest's "Scroll Bounds."
- **`RoomScene.setupRoomCamera`** (private): called at the end of `create` after characters spawn. Sets `cameras.main.setBounds` from `scrollBounds` (or room size) and calls `cameras.main.startFollow(player, true)` when the room is larger than the viewport and a player exists.
- **`RoomScene.setEditorCameraMode(mode)`** (public): called by the editor's `RoomPolygonEditScene` whenever the toolbar mode changes. Stores the current mode so it can be re-applied on panel resize. Two behaviours: `'navigate'` — letterboxes the game's virtual resolution (352×198) inside the panel using `cameras.main.setViewport`, sets zoom to fill that box, and re-activates player follow + scroll bounds for game-accurate preview; `'edit'` — expands the camera to fill the entire panel (`setViewport(0,0,panelW,panelH)`), computes `zoom = min(panelW/roomW, panelH/roomH)` to fit the full room art, sets bounds to room bounds, and disables player follow so the authoring view is stable. The `scale.on('resize')` hook re-invokes `setEditorCameraMode` automatically when the VS Code panel is resized.
- **Background and props** render at their **natural texture dimensions** — `room.size` does **not** call `setDisplaySize`. Art that extends beyond `room.size` is simply not scrolled into view.
- **Hotspot zones** are sized to `room.size` so polygon hit areas only cover the playable area.

### Scene / room system

- **`BootScene`**: Entry after game creation. Uses `loadStartRoomData()` — **`startingRoomId` in `game-config.json` overrides** `rooms.manifest.json` — resolves the room’s `*.room.json` via Vite glob. Queues background image (optional), room Aseprite sheet, and character assets, then starts **`RoomScene`** with **`RoomSceneStartData`** (room JSON, spawn lists, texture keys).
- **`RoomScene`**: Single active gameplay view for that room. No second “room manager” type is used at runtime; the abstract **`Room`** class in `Room.ts` is a **placeholder** for future data-driven room types, not wired into Phaser yet.
- **Room switching**: **Not implemented** in-engine today — only the initial `BootScene` → `RoomScene` transition exists.

**Boundaries**: Room **layout and flags** come from JSON; **reactions** to emitted event ids belong in **`registerRoomScript`** in `*.room.ts`.

### Rendering system

- **Internal size** from `game-config.json` `resolution`; Phaser **Scale.FIT**, **CENTER_BOTH**, **MAX_ZOOM**, **autoRound** for pixel alignment.
- **Layers**: Background image (optional, full-frame) → props sorted by **`zIndex`** (Aseprite tags as frames) → characters at fixed high depth → debug graphics on top when enabled.
- **`PostEffects.ts`**: **`attachPostProcessingPlaceholder(this.cameras.main)`** — extension point for Phaser 4 camera filters; **no shaders shipped yet**.

### Prop parallax

Room props support a **`parallax`** field (`RoomPropParallax` in `src/types/room.ts`) that drives per-frame position updates in `RoomScene.update()`.

**`depth`** — how much the prop moves relative to the camera scroll:
| `depth` | Effect |
|---------|--------|
| `0` | Fully screen-locked (infinitely distant — e.g. sky). |
| `0–1` | Distant; slides slower than the camera. |
| `1` | No parallax (default world-fixed position). |
| `>1` | Closer than the world plane; moves faster than the camera. |

**`alignX` / `alignY`** — the screen-space anchor the prop converges toward as `depth → 0`.  At `depth = 1` these have no effect.
- `alignX`: `-1` = left edge · `0` = horizontal center · `1` = right edge
- `alignY`: `-1` = bottom · `0` = vertical center · `1` = top  (PowerQuest / Unity Y-up convention)

**Formula** (computed every frame in `RoomScene.updateParallaxProps`):
```
screenAnchorX = viewportW / 2 * (1 + alignX)   // 0 → left, vW/2 → center, vW → right
screenAnchorY = viewportH / 2 * (1 - alignY)   // vH → bottom, vH/2 → center, 0 → top

worldX = depth * baseX + (1 − depth) * (cameraScrollX + screenAnchorX)
worldY = depth * baseY + (1 − depth) * (cameraScrollY + screenAnchorY)
```

At `depth = 1`: `worldX = baseX` (world-fixed, identical to no parallax).  
At `depth = 0`: `worldX = cameraScrollX + screenAnchorX` (sprite pinned to screen anchor).

**Example** — sky layer that stays fixed at the top-left corner of the screen:
```json
"parallax": { "depth": 0, "alignX": -1, "alignY": 1 }
```

**Example** — slowly scrolling distant mountains anchored to screen left:
```json
"parallax": { "depth": 0.3, "alignX": -1, "alignY": 1 }
```

**Performance**: Props with `depth === 1` (or no `parallax` field) are never added to the update list — only props that actually move incur per-frame work.  The scene's `update()` is a no-op when the list is empty.

### Input system

- **Walk**: **Left click** on empty space (no hit-test targets) moves the **player** character toward the click, **clamped** into **walkable regions** (`walkable.ts` — each **`WalkablePolygon`** is an outer ring minus optional **active** hole rings; union across polygons; point-in-polygon + closest-point clamping toward the click).
- **Props**: **Polygon hit area** per clickable prop; **left** = look (`onLook` string), **right** = use (`onUse`) when defined. Requires `walkToPoint`, `lookAtPoint`, and collider in JSON.
- **Characters / hotspots**: **Zones or sprites** with `pointerdown`; characters emit look events without the walk-to-stand flow unless extended later. **Hotspots** in JSON may use a **`points`** polygon (≥3 vertices, room space) with optional **`active`**, **`zIndex`**, **`walkToPoint`**, **`lookAtPoint`**, **`description`**, and **`onLook`** / **`onUse`**; legacy axis-aligned **`x` / `y` / `width` / `height`** still work when there is no usable polygon (**`src/types/room.ts`**, **`RoomScene.createHotspot`**).
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
- **Room data**: Follow **`RoomData`** / **`RoomPropInstance`** in **`src/types/room.ts`**; keep **`walkToPoint` / `lookAtPoint` / `collider`** consistent for clickable props. Optional **`points`** (**`RoomPointData[]`**, named **`x` / `y`**) and **`regions`** (**`RoomRegionData[]`**, closed polygons + **`active`**) are **authoring / future-system** fields; the runtime **`RoomScene`** does not consume them yet beyond **hotspots**.
- **Walkable mesh**: **`walkable.polygons[]`** entries support optional **`holes[]`** (inner rings subtracted when **`active`** is not **`false`**). Each polygon and hole may set **`active`**; omitted or non-**`false`** means included in tests and debug draw. See **`walkable.ts`** and **`RoomScene`** debug overlays (outer vs hole stroke colors).
- **Registration**: New room scripts must live under **`src/game/rooms/`** as **`*.room.ts`** exporting **`registerRoomScript`** to be picked up by **`registerGameContent`**.
- **Strict TypeScript**: Project uses **strict** compiler options; new code should preserve typings for payloads and JSON-shaped types.

---

## 7. Future Considerations

- **Room transitions**: Loading another room likely means **restarting `RoomScene`** (or a thin orchestrator) with new `RoomSceneStartData`; persistence of inventory/state across rooms is **not defined** in code yet.
- **Post-processing**: `PostEffects.ts` is ready for **camera filter** composition (CRT, dither, etc.).
- **Audio**: Volume helpers exist; **music loops, voice, and SFX triggers** from events are **future work**.
- **Dialogue / inventory**: Types exist under `src/types/` in places; **not integrated** into `RoomScene` flow yet.
- **Editor**: VS Code extension + **`build:room-preview`** ship a **live `RoomScene` preview** in a webview with **polygon editing** (walkable, prop colliders, **hotspots**, **regions**, and **room points**) via **`RoomPolygonEditScene`** — see **§8**.

---

## 8. VS Code extension & room preview (implementation detail)

This subsection documents **what exists today** for the **BENNE Editor** (`benne-editor/`) and the **room preview bundle** (`src/editor/preview/`). It does not replace earlier high-level notes; it adds concrete modules, messages, and rules.

### Purpose and build output

- **`npm run build:room-preview`** (repo root) runs **`vite.room-preview.config.ts`**, entry **`room-editor.html`**, and emits **`benne-editor/media/room-preview/room-preview.js`** (and assets). The extension loads that script from **`RoomPreviewPanelController`** HTML.
- The preview is **not** the same bundle as **`vite build`** for the playable game; it is a **separate** client that embeds Phaser with **`RoomScene`** and editor-only scenes.

### Content scaffolding (create room, prop, character)

The extension can **generate files** under **`src/game/`** so new content matches engine expectations. Implementation lives in **`benne-editor/src/roomScaffolding.ts`** and **`benne-editor/src/characterScaffolding.ts`**; commands are registered in **`extension.ts`** and **`package.json`** (**`benne-editor.createRoom`**, **`benne-editor.addRoomProp`**, **`benne-editor.importPropsFromAsepriteTags`**, **`benne-editor.createCharacter`**, **`benne-editor.importAnimationsFromAsepriteTags`**).

| Action | What it does |
|--------|----------------|
| **Create New Room** | **`runCreateRoomWizard`**: after **`pickWorkspaceFolder`** (BENNE roots = workspaces with **`src/game/rooms`**), prompts for **room id** (slug) and **display name**; creates **`src/game/rooms/<id>/`**, **`<id>.room.json`** (empty **`walkable.polygons`**, **`hotspots`**, **`points`**, **`regions`**, **`props`**), **`<id>.room.ts`** stub with **`registerRoomScript`**, **`src/game/assets/images/rooms/<id>/`**, and appends **`rooms.manifest.json`** (sorted **`rooms[]`**; preserves **`startRoomId`** when set). Opens JSON + TS. |
| **Add Prop** | **`runAddRoomPropWizard`**: target room from **focused room/prop tree node**, open **`.room.json`**, or quick-pick. Prompts for **Aseprite tag**, **prop id**, and **clickable** yes/no; appends to **`props`** with **`nextPropZIndexFromProps`**. Does **not** validate tags against exported sheet JSON. After success: **two-row editor layout** + **`openRoomJsonAndScriptBottomGroup`** (**`roomScriptNavigation.ts`**) so **room JSON** and **`.room.ts`** sit in the bottom group. |
| **Add Hotspot** | **`runAddRoomHotspotWizard`**: same room resolution as **Add Prop**. Prompts for **hotspot id**; appends **`hotspots[]`** with **`active`**, **`description`**, **`zIndex`**, a **default 48×48 axis-aligned square** centered on **default game resolution** (**352×198**), and default **`walkToPoint`** / **`lookAtPoint`** so the preview editor can reshape immediately. |
| **Add Point** | **`runAddRoomPointWizard`**: appends **`points[]`** with **`id`** and **`x` / `y`** at **room center** (same default resolution as above). |
| **Add Region** | **`runAddRoomRegionWizard`**: appends **`regions[]`** with **`active`** and the same **default centered square** polygon as **Add Hotspot** (no walk/look). |
| **Import Props from Aseprite Tags** | **`runImportPropsFromAsepriteTags`**: resolves room (tree or picker); reads **`meta.frameTags`** from **`src/game/assets/images/rooms/<roomId>/<roomId>.json`**. Multi-select quick pick (existing tags labeled); optional **clickable** for the whole batch; unique **`${roomId}-prop-…`** ids via **`allocateUniquePropId`**. Same post-step layout + **`openRoomJsonAndScriptBottomGroup`** as **Add Prop**. |
| **Create Character** | **`runCreateCharacterWizard`**: folder pick, **display name**, **character id** (slug); creates **`src/game/characters/<id>/`**, **`<id>.character.json`** (minimal fields incl. **`display.aseprite: true`**), **`<id>.character.ts`** stub (runtime does **not** auto-load **`*.character.ts`** yet — comment in file), and **`src/game/assets/images/characters/<id>/`**. Opens JSON + TS. |
| **Import Animations from Aseprite Tags** | **`runImportAnimationsFromAsepriteTags`**: requires **`display.aseprite: true`**; resolves character (tree or picker); reads **`meta.frameTags`** from **`src/game/assets/images/characters/<id>/<id>.json`**. Multi-select quick pick (keys already in **`animations`** labeled). New clips use **`{ "loop": true }`** per **`CharacterAnimationClipConfig`** (`src/types/character.ts` — keys **must match** Aseprite tag names). Merges into **`animations`**; then single-column layout + **`openCharacterJsonAndScriptPinned`**. |

**UI entry points**: BENNE **main tree** view title (**Create New Room**, **Create Character**), context menus on **Rooms** / **workspace** / **room** / **hotspot** / **point** / **region** / **prop** / **character** nodes (see **`package.json`** **`menus`** — includes **Add Hotspot** / **Add Point** / **Add Region** on **room** and those child types). Under each **room** node, the tree lists **hotspots**, **points**, **regions**, then **props** (distinct icons: e.g. **map** / **target** / **layout-panel** / **symbol-misc**); **`mainTreeProvider.ts`** reads **`hotspots`**, **`points`**, and **`regions`** from JSON via **`readRoomHotspots`**, **`readRoomPoints`**, and **`readRoomRegions`** in **`gameDiscovery.ts`**. **Actions** tree when a **room** is focused: **Add Hotspot**, **Add Point**, **Add Region**, **Add Prop**, **Import Props from Aseprite Tags**, then room-open shortcuts; **prop**-focused actions still prepend the same scaffold commands and append prop verb rows (**`actionsTreeProvider.ts`**). Tree selection for **hotspot** / **point** / **region** updates **`EditorSelection.roomPanel`** (**`editorSelection.ts`**) so the preview toolbar matches. Commands **`benne-editor.addRoomHotspot`**, **`addRoomPoint`**, **`addRoomRegion`** are registered in **`extension.ts`** / **`package.json`**. **`validateSlug`** / **`pickWorkspaceFolder`** are shared helpers (**`roomScaffolding.ts`**).

### Preview runtime (`src/editor/preview/`)

| Module | Role |
|--------|------|
| **`roomEditorMain.ts`** | Webview entry: `window` **`message`** handler; **`acquireVsCodeApi`**; **`lastLoadedRoom`** for lightweight toolbar updates; **`wireToolbarFromPreviewState`** builds toolbars for **room**, **prop collider**, **hotspot polygon**, **region polygon**, and **room point** modes; **`loadRoomGeneration`** + **`destroyPreviewGameAsync()`** (**150ms** after **`Phaser.Game.destroy(true)`** so teardown can finish before a new game mounts). **`normalizeRoomForPreview`** copies the host payload into a stable **`RoomData` shape** (`walkable.polygons`, **`hotspots`**, **`points`**, **`regions`**, **`props`**, **`characters`**) so partial JSON or odd **`postMessage`** payloads cannot break the toolbar or manifest. **`enqueuePreviewLifecycle`** chains **`clear` / `error` / `loadRoom`** work on a single promise tail so operations never overlap; failures log to the console instead of being swallowed. **`runLoadRoom`** builds a **`position: relative`** stack under **`benne-preview-root`**: a full-size inner **`div`** as Phaser’s **`parent`**, with the overlay canvas appended as a sibling on top of the game canvas. Toolbar wiring runs **before** **`buildPreviewManifest`** / **`createRoomPreviewPhaserGame`**; failures surface as **`Preview toolbar: …`**. |
| **`createRoomPreviewGame.ts`** | Constructs **`Phaser.Game`** with an **editor-specific config** (`getEditorPhaserGameConfig`) that uses **`Scale.RESIZE`** so the canvas always fills the VS Code preview panel — no letterboxing at the Phaser level. Navigate-mode letterboxing is handled instead by `RoomScene.setEditorCameraMode` via `cameras.main.setViewport`. Sets **`callbacks.preBoot`** registry keys **`bennePreviewRoom`**, **`bennePreviewRoomJsonUri`**, **`bennePreviewPostPatch`**; scenes **`BennePreviewLoader`**, **`RoomScene`**, **`RoomPolygonEditScene`**. Loader **`create()`** starts **`RoomScene`**, **`launch`**es the polygon scene, then **`URL.revokeObjectURL`** for preview-only blob atlas URLs. |
| **`buildPreviewManifest.ts`** | **`fetch`**-based analogue of boot loading: builds **`PreviewManifest`** (`loads`, **`RoomSceneStartData`**, **`revokeObjectUrls`**) from **`RoomData`** + webview **`gameSrcWebviewUri`**. |
| **`RoomPolygonEditScene.ts`** | Drives the **DOM overlay canvas** for polygon handles, strokes, **walk/look** markers, labels, and **rect handles** (room size + scroll bounds). Modes: **walkable** (outer or hole), **prop collider**, **hotspot polygon**, **region polygon**, **room point**, **room size** (cyan rect, origin locked at 0,0), **scroll bounds** (orange rect, freely resizable). On every bridge mode change calls `syncEditorCameraMode()` which forwards to `RoomScene.setEditorCameraMode`. **Middle-mouse drag** pans the camera; **mouse wheel** zooms around the cursor (`onOverlayWheel` uses the Phaser 4 origin-aware formula `scrollX = worldX - originX - (screenX - originX - cam.x) / newZoom`); **F key** resets to fit-room zoom. **Delete/Backspace** removes the selected polygon vertex. Caches a `roomScene` reference so the correct `cameras.main` (with active zoom/scroll) is used for all coordinate transforms. |
| **`previewPolygonOverlay.ts`** | Stacked `<canvas>` above the Phaser canvas. **`worldToCanvasCss(p, cam)`** uses the Phaser 4 origin-aware formula `(cam.zoomX * (world - scroll - origin) + origin + cam.x) / displayScale` — critical because Phaser 4 cameras default to `originX = originY = 0.5` (zoom from viewport centre); the simpler `(world - scroll) * zoom` formula only works at zoom = 1. **`domToWorld(pageX, pageY, cam)`** uses `scale.transformX/Y` + `cam.getWorldPoint`. **`clearAndDraw(state, cam)`** draws polygon handles. **`clearAndDrawRect(state, cam)`** draws an 8-handle resize rectangle with optional locked handles (used for room size where the origin corner is fixed). |
| **`polygonEditBridge.ts`** | **Mode** (`navigate` \| `walkable` \| `propCollider` \| `hotspotPolygon` \| `regionPolygon` \| `roomPoint` \| **`roomSize`** \| **`scrollBounds`**); **`walkablePolygonId`**, **`walkableHoleId`** (empty = outer ring); **`propId`**, **`hotspotId`**, **`regionId`**, **`roomPointId`**; **`subscribe`** notifies the polygon scene. Mode changes drive both input gating and `RoomScene.setEditorCameraMode`. |
| **`polygonPatchTypes.ts`** | **`RoomPolygonPatch`**: `walkable` \| `propCollider` \| `hotspotPolygon` \| `regionPolygon` \| `roomPoint` \| **`roomSize`** (`{ width, height }`) \| **`scrollBounds`** (`{ x, y, width, height }`). All kinds mirrored in **`benne-editor/src/roomPolygonPatch.ts`** which validates, integer-rounds, and persists to `*.room.json`. |

### High-DPI editor overlay

The editor preview uses **`Scale.RESIZE`** (not `Scale.FIT`) so the Phaser canvas always fills the VS Code panel. **Navigate mode** simulates the exact in-game view by computing `scale = min(panelW/gameW, panelH/gameH)` and using `cameras.main.setViewport(centreX, centreY, gameW*scale, gameH*scale)` — the viewport box is letterboxed inside the panel using the game background colour. **Edit mode** expands the viewport to the full panel (`setViewport(0,0,panelW,panelH)`), zooms to fit the room art, and enables mouse-wheel zoom (around the cursor) and middle-mouse pan. Pressing **F** resets to the fit-room zoom. The camera re-applies its mode automatically via `scale.on('resize')`. The DOM overlay canvas is sized to fill the full panel in both modes; all handle drawing uses `worldToCanvasCss(p, cam)` which accounts for the active camera zoom, scroll, and viewport origin (`cam.x`, `cam.y`). **Pointer capture** on the overlay handles drags; **`pointer-events: none`** in Navigate so `RoomScene` receives clicks. **Zoom formula** (Phaser 4-accurate): `scrollX = worldX - originX - (screenX - originX - cam.x) / newZoom` keeps the world point under the cursor fixed across zoom steps.

### Webview ↔ extension protocol

| Message (direction) | Role |
|---------------------|------|
| **`benne/preview/ready`** (webview → host) | Preview script booted; host then **`pushPreview`**. |
| **`benne/preview/loadRoom`** (host → webview) | **`room`**, **`gameSrcWebviewUri`**, **`roomJsonUri`**, plus **`previewFocus`**: **`room`** \| **`prop`** \| **`hotspot`** \| **`region`** \| **`roomPoint`**, with **`propColliderId`**, **`hotspotId`**, **`regionId`**, or **`roomPointId`** as appropriate (drives toolbar and **`polygonEditBridge`** without extra round-trips). |
| **`benne/preview/toolbarUi`** (host → webview) | Same **`previewFocus`** and id fields when the **room JSON URI is unchanged** (e.g. switching among **room** / **prop** / **hotspot** / **point** / **region** nodes under the same **`.room.json`**) so the webview rewires the toolbar **without** tearing down Phaser. **`RoomPreviewPanelController`** dedupes **`toolbarUi`** with a composite key over focus + ids. |
| **`benne/preview/clear`**, **`benne/preview/error`** | Reset or error string in the preview root. |
| **`benne/preview/requestRefresh`** (webview → host) | User **Refresh** in the preview top bar. Optional **`roomJsonUri`**; host **`pushPreview({ fromRefreshRequest, explicitRoomJsonUri })`** re-reads JSON and posts **`loadRoom`** again (or **`error`** if there is no room context). |
| **`benne/preview/polygonPatch`** (webview → host) | **`roomJsonUri`** + **`patch`**. |
| **`benne/preview/polygonPatchResult`** (host → webview) | **`ok`**, optional **`message`**; when **`ok`**, **`appliedPatch`** mirrors what was written (including **`walkable.holeId`** when applicable); webview applies it to registry **`RoomData`** — **no** follow-up **`pushPreview`** on save. |

**Persistence**: **`benne-editor/src/roomPolygonPatch.ts`** — **`applyRoomPolygonPatch`** merges into `*.room.json`, rounds `Point2` to integers; supports **`walkable`** (outer or `holeId`), **`propCollider`**, **`hotspotPolygon`**, **`regionPolygon`**, **`roomPoint`** (`x`/`y`), **`roomSize`** (`width`/`height`), and **`scrollBounds`** (`x`/`y`/`width`/`height`). **`parseRoomPolygonPatch`** validates all payloads from the webview.

### Toolbar UX (tree selection)

| BENNE tree selection | Preview toolbar |
|----------------------|-----------------|
| **Room** node (no hotspot/point/region/prop child selected) | **Mode**: Navigate, **Edit walkable**, **Room Size**, or **Scroll Bounds**. Walk/Holes dropdown visible in walkable mode; rect handles visible in Room Size (cyan) / Scroll Bounds (orange) modes. **Save** visible in all non-navigate modes. |
| **Prop** under a room | If **`clickable: true`**: **Prop collider** + **walk/look** + **Save**; **`propCollider`** mode for that **`propId`**. If not clickable: message that **`"clickable": true`** is required; **Navigate**. |
| **Hotspot** under a room | **Hotspot** polygon + **walk/look** + **Save**; **`hotspotPolygon`** mode. |
| **Region** under a room | **Region** polygon + **Save**; **`regionPolygon`** mode. |
| **Point** under a room | **Room point** + **Save**; `roomPoint` mode (drag `x`/`y`). |
| **Room Size** (mode dropdown, room node) | Cyan resize rectangle anchored at (0,0); drag bottom/right handles to set `room.size.width` / `height`. Top-left handles are locked. **Save** writes `room.size`. |
| **Scroll Bounds** (mode dropdown, room node) | Orange resize rectangle; all 8 handles draggable; sets `room.scrollBounds.x/y/width/height`. **Save** writes `room.scrollBounds`. After save, `RoomScene.setEditorCameraMode` is re-invoked to update camera bounds. |

### Extension panel behavior (summary)

- **`RoomPreviewPanelController`** (`benne-editor/src/roomPreviewPanel.ts`): **`WebviewPanel`** **`benneRoomPreview`**; **`pushPreview`** posts **`loadRoom`** with toolbar fields; **`lastPushedRoomJsonUri`** skips redundant **`loadRoom`** when only the **tree focus** changes among **room** / **prop** / **hotspot** / **point** / **region** for the **same** **`.room.json`**, and **`postToolbarUiIfNeeded`** sends **`toolbarUi`** instead; preview stays open when switching among those nodes (**`EditorSelection`** **`roomPanel`**). **`polygonPatch`** → **`polygonPatchResult`** (**no** automatic **`pushPreview`** after a successful save).
- **`readRoomJsonAsUtf8`**: If the room **`*.room.json`** is open in VS Code, the preview uses **`TextDocument.getText()`** so **Refresh** and pushes match **unsaved buffer** content; otherwise it reads the file from disk.
- **Selection churn**: **`onSelectionChanged`** runs on a **`selectionReactionChain`** promise tail so overlapping handlers cannot **`postMessage`** in the wrong order. Leaving **room-scoped** preview (no **room** focus and no **`roomPanel`** prop/hotspot/point/region) schedules a **debounced `clear`** (~**180ms**); re-entering cancels that timer. **`resetPreviewPanel`** clears the debounce timer when the panel is torn down.
- **`pushPreview`** is also serialized via **`previewPushTail`** so rapid triggers do not interleave **`loadRoom`** posts.
- Selecting another **prop**, **hotspot**, **point**, or **region** under the **same** room does **not** reset the Phaser surface when the JSON URI is unchanged; the preview updates via **`toolbarUi`** / **`loadRoom`** as above (**`extension.ts`**).
- **Two-row** layout, **pinned** documents, and tree commands remain in **`extension.ts`** / **`roomScriptNavigation.ts`**.

### Data flow (preview save)

```
Toolbar Save → postMessage(polygonPatch) → applyRoomPolygonPatch(uri) → polygonPatchResult(ok, appliedPatch)
     → webview applies appliedPatch to registry room (Phaser game stays alive; no pushPreview)
```

### Preview reload order (why toolbar can run with no `Phaser.Game`)

A full **Refresh** or **`loadRoom`** **destroys** the previous **`Phaser.Game`**, clears **`benne-preview-root`**, then **normalizes** room JSON and **rebuilds the HTML toolbar** (dropdowns, mode, **`polygonEditBridge`** updates). Only after that does the webview **`await buildPreviewManifest`** and **`createRoomPreviewPhaserGame`**. That order keeps **walkable** / **prop** / **hotspot** / **region** / **point** toolbar UI safe when JSON is incomplete, but it means **`polygonEditBridge.notify()`** can fire **while the old `RoomPolygonEditScene` is still subscribed** and **`ScenePlugin.manager`** is already cleared — hence the **manager null guards** in **`RoomPolygonEditScene`** (see table above). **`wireRoomToolbar`** also treats **`walkable.polygons`** defensively when building the **Walkable/Holes** list.

### Runtime walk mesh (engine)

- **`src/engine/walkable.ts`**: **`isPointInWalkablePolygon`** — inside **active** outer, not inside any **active** hole; **`isPointInWalkableArea`** unions polygons; **`clampWalkDestinationTowardClick`** uses holed closest-point logic.
- **`RoomScene`** debug **`showWalkable`**: strokes **active** outers and **active** hole rings (distinct colors).

---

*This document reflects the repository as of the last update; when behavior changes, prefer updating this file over stale comments scattered in code.*
