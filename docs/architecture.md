# BENNE — Architecture

> Terminology cleanup (2026-04-15): standardized system-level wording to `inventory` (including Bennescript/docs paths), while keeping `inventory item` only for single carried entries.

## 1. Overview

**BENNE** is a **web-based point-and-click adventure game engine** (LucasArts / PowerQuest–style): fixed-resolution pixel rooms, click-to-walk, and verb-style interactions on props and characters. The runtime is **Phaser 4** (RC), **TypeScript**, and **Vite**.

**Core design goals**

- **Data-first**: Rooms, characters, **GUIs** (overlay UI definitions), **inventory** definitions, and game tuning live in **JSON** (and Aseprite exports) under `src/game/`; TypeScript supplies **room** / **character** / **GUI** / **inventory** scripts and engine code, not hand-authored level blobs in code.
- **Separation**: **`src/engine/`** is reusable; **`src/game/`** is project-specific content and registration (`registerGameContent`).
- **Retro display**: Internal resolution defaults to **352×198**; Phaser scale mode **FIT** + **MAX_ZOOM** + **pixelArt** for crisp integer scaling. **Post-processing** is wired as a **camera hook** (`attachPostProcessingPlaceholder`) — currently a no-op, reserved for CRT / dissolve-style effects.
- **Scrolling rooms**: Rooms wider or taller than the viewport declare `size` in `RoomData` (e.g. `"size": { "width": 704, "height": 198 }`). `RoomScene` reads this and sets `cameras.main.setBounds` + `startFollow` on the player so the camera tracks movement within the room. An optional `scrollBounds` field further restricts how far the camera pans (PowerQuest-style).
- **Simplicity over frameworks**: One primary gameplay scene (`RoomScene`), a thin boot loader (`BootScene`), and a **global `EventBus`** for script-facing events instead of a heavy ECS.

---

## 2. High-Level Architecture

**Major pieces**

| Area | Role |
|------|------|
| **`main.ts` + `Game.ts`** | DOM mount, `Phaser.Game` with **`BootScene` + `RoomScene`** wired in `Game.ts` (keeping the scene imports out of `gameConfig.ts` so previews don't transitively pull them). **`createBenneGame`** registers **`GameStateManager`** on **`game.registry`**. |
| **`gameConfig.ts`** | **Side-effect free** Phaser config helpers: resolution from JSON, scale, and **`getBenneRendererConfigFields()`** — single source of truth for renderer-identity fields (`type: Phaser.CANVAS`, `pixelArt`, `roundPixels`, `antialias`, `backgroundColor`, `render.powerPreference`) that **must** be spread into every VS Code preview config so `BitmapText` glyph rendering matches the shipped game (Phaser 4's WebGL path does not render fixed-to-camera `BitmapText` reliably — see `.cursor/rules/benne-preview-rendering-parity.mdc`). Scenes are **not** imported here; doing so would transitively pull `resolveGameAssetUrl.ts` (which `import.meta.glob`'s every asset PNG) into all three editor preview bundles. |
| **`ConfigManager.ts`** | Reads bundled `game-config.json` (`getGameSettings`). |
| **`BootScene`** | Loads assets for the **start room** (manifest + globbed JSON), then `scene.start(Room, startData)`. |
| **`RoomScene`** | Renders one room: background, Aseprite props, hotspots, characters, player walk, prop/character hit tests, debug overlays, and **every** screen-space GUI from **`./guis/**/*.gui.json`** (via **`buildGuiOverlay`**; reserved **`dialog-text`** handling for **`say`**). |
| **`EventBus` (`gameEvents`)`** | `Phaser.Events.EventEmitter` — verb dispatch turns JSON handlers (`onVerb` / `onVerbFallback`) plus optional global fallbacks into emitted events. |
| **`registerGameContent`** | Eager `import.meta.glob` of `*.room.ts`, `*.character.ts`, `*.gui.ts`, `*.inventory.ts`, and `globalScript.ts` so top-level **`registerRoomScript`**, **`registerCharacterScript(id, …)`**, **`registerGuiScript(id, …)`**, **`registerInventoryScript(id, …)`**, and **`registerGlobalScript(…)`** (from `@engine/scripting`) run as side effects; registers **`*.inventory.json`** definitions; pushes room/character lists for **`RoomScene`** and runs GUI callbacks; records each **`GuiBenneScript`** instance per **`guiId`** so **`RoomScene`** can build a **`GuiRuntime`** after **`buildGuiOverlay`**. **`wireBenneGlobalScripts(game)`** in `main.ts` (after `createBenneGame`) wires global Bennescript with a live **`Phaser.Game`**. |
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
│ ConfigManager   │                            │ EventBus        │◄── *.room.ts, *.character.ts, *.gui.ts, globalScript
└─────────────────┘                            └─────────────────┘
```

**Editor (out of runtime path)**  
The **VS Code extension** (`benne-editor/`) and **`src/editor/preview/`** build **bundled Phaser previews** (room, character, GUI) that fetch game assets via webview URIs — tooling only, not part of the shipped game loop. The room preview reuses **`RoomScene`**.

**BENNE — Actions view** (`benne-editor`): Verb rows use **`game-config.json`** `verbs` (same order and defaults as the engine if `verbs` is omitted).

**BENNE — Inspector view** (`benne-editor`): A third sidebar **WebviewView** (**Inspector**) under the same BENNE activity bar. When the main tree selection is a **room** or **any item under a room** (prop, hotspot, point, region, spawned character), the Inspector edits that room’s **`*.room.json`**. The webview is styled with **VS Code theme variables** (inputs, buttons, panel borders) so it matches the host. **Room metadata** and **Walkable areas** are top-level **accordions** (`<details>`). Metadata uses a **property grid** for **Display name** and **Room ID** (read-only badge), a **Fit to background** action, and compact **dimension grids**: one row for **room size** (**W** / **H**), and a **2×2** grid for **scroll bounds** (**X**, **Y** on the first row; **W**, **H** on the second). Walkable polygons and holes stay in a table with **active** toggles plus add-polygon / add-hole controls. **Hotspots**, **Props**, **Spawned characters**, **Points**, and **Regions** each sit in their own accordion, with a **vertical list of flat cards** inside (no nested per-entity accordions). Cards carry **`data-entity` / `data-id`** for tooling; tree focus is mirrored in the payload as **`expanded`**, which **scrolls the matching card into view** and opens its section. **Prop** cards keep **Visible** in the header; **zIndex**, **Parallax**, **Alpha**, and **Clickable** use the property grid, with **Description** and a **Verbs** label above **verb chips** (same defined vs add behaviour as **Actions**). **Clickable** props get a subtle tint and an **Edit in Preview** button (non-clickable props omit that button). **Hotspot** cards use **Active** (JSON **`active`**) in the header and a property row for **zIndex**. **Character** cards keep **Visible** in the header; **X** / **Y** use the dimension-grid row, then a property grid for read-only **Clickable**, **zIndex**, **Facing**, and **Animation**. **Edit in Preview** on props, hotspots, **points**, and **regions** drives the **BENNE Room preview** the same way as selecting that entity in the main tree: **`RoomPreviewPanelController.focusInspectorGeometry`** folds a one-shot target into the next **`loadRoom`** so the preview opens in the correct polygon / point / region edit mode (**spawned characters** do not use **Edit in Preview** here). **`*.room.json` remains the source of truth**; edits persist with **Save** and field **blur**, and **Open raw JSON** opens the file. **Actions** stays the compact verb-centric list; the Inspector is the full-room surface. Implementation: **`benne-editor/src/inspector/inspectorMain.ts`** bundles to **`benne-editor/media/inspector/inspector.js`**; shared shell CSS lives in **`inspectorWebviewViewProvider.ts`** (run **`npm run compile`** or **`npm run watch`** under `benne-editor/` after UI changes). After changing **`src/editor/preview/roomEditorMain.ts`** (or other room preview entry code), rebuild from the repo root: **`npm run build:room-preview`**. Selecting a standalone **character** or **inventory** definition opens the character or inventory Inspector; selecting a **GUI** opens the GUI Inspector for **`*.gui.json`** (see **GUIs** below).

- **Props** (selected under a room): Shown only when the prop is **`clickable: true`** (matches the engine). Non-clickable props get **Make clickable** first (`clickable` in room JSON); authors still add a **collider** (≥3 points) in the preview or JSON. Mapped verbs open the handler in **`*.room.ts`**; unmapped verbs add **`onVerb[verbId] = true`** in room JSON and a stub using **`roomPropVerbEventId(roomId, propId, verbId)`** inside **`registerRoomScript`**. New-room templates use an example comment with a literal **`propName`** placeholder so tooling does not treat it as a real handler.

- **Hotspots**: Same verb / add-verb flow when a hotspot is selected; **`onVerb`** lives on room JSON; handlers in **`*.room.ts`**. Inactive hotspots show a reminder that they are not hit-tested.

- **Characters**: When a character is selected, **`clickable: true`** is required before verb rows (same as the engine). **Make clickable** updates **`*.character.json`**. Verbs add **`onVerb`** there and stubs in **`registerCharacterScript('id', ({ B }) => { … })`** in **`*.character.ts`** (eager-loaded by **`registerGameContent`**; **`RoomScene`** runs the callback when that character is spawned in the active room). For **precise clicks** on sprites with transparent padding, authors add **`collider`** (≥3 points in **frame space**, like **`feet`**) in **`*.character.json`** or in the **BENNE Character preview** (polygon editor, same interaction model as **prop colliders**). Optional **`walkToPoint`** / **`talkPoint`** (frame space, same origin as **`feet`**) tune **`walkTo('…')`** resolution and script-facing **world** hints on verb clicks. The **Actions** view may remind you to add a collider when the character is clickable but none is defined.

- **GUIs**: **Main tree** lists **`src/game/guis/<id>/<id>.gui.json`** under a **GUIs** group (below **Characters**); expanding a GUI lists **`controls[]`** entries (same **`type:id:index`** keys as the GUI Inspector), and selecting a control scrolls that card into view (**`EditorSelection.guiPanel`** → **`InspectorGuiState.expanded`**). **Create GUI** scaffolds **`*.gui.json`**, **`*.gui.ts`** (`registerGuiScript`), and **`src/game/assets/images/guis/<id>/`** (Aseprite export target). The GUI **Inspector**'s **Controls** section has an **Add Control** button that opens a **Quick Pick** (Text / Inventory Panel / Image), then runs **`runAddGuiControlWizard`** (**`benne-editor/src/guiScaffolding.ts`**) — prompts for an optional control id (default `text1` / `inventoryPanel1` / `image1`, skipped if left blank), appends a kind-specific default entry to **`controls[]`** in **`*.gui.json`**, and refreshes the Inspector (same pattern as **Add Hotspot** / **Add Prop** / **Add Point** / **Add Region** in the room Inspector). Selecting a GUI opens the **two-row** layout with **BENNE GUI preview** on top (internal resolution from **`game-config.json`**) and the companion **`*.gui.ts`** in the Benne **script row**; the **`*.gui.json`** is edited in the **Inspector** (or any open editor tab), not as a second tab stacked with the script in the bottom row. **Runtime** (**`RoomScene`**): every matching **`*.gui.json`** is composed with **`buildGuiOverlay`** (screen-fixed **`scrollFactor` 0**). Supported **`controls`** are **`text`** (Phaser **`BitmapText`**), **`inventoryPanel`** (player inventory grid), and **`image`** (Aseprite tag from this GUI’s sheet). Bitmap fonts for **`text`** live in **`src/game/assets/fonts/fonts.json`** (PNG + BMFont XML) and **`BootScene`** calls **`load.bitmapFont`**. **`B.player.say` / `B.character(…).say`** drive only the reserved **`dialog-text`** GUI via **`setDialogTextOverlay`**; all other GUI ids are ordinary HUD layers—there is **no** per-id whitelist in **`RoomScene`**. **`GuiData.visible`**: for non-**`dialog-text`** GUIs, **`false`** hides the overlay at room load; omitted or **`true`** shows it. **`dialog-text`** ignores that flag for initial visibility (engine shows/hides the line for speech). GUI overlays are sorted by **`id`**, assigned spaced base **`depth`** values, and **`dialog-text`** is built last so dialogue stacks above other GUIs. **GUI Aseprite sheets** (`display.aseprite: true`): unlike rooms or characters, there is **no** “import animations from tags” command for GUIs. Only tags **explicitly bound** on a control (Inspector **Animations** section, or the same fields in JSON) are played or shown; unreferenced tags on the export are ignored. **`image`** controls and **`inventoryPanel`** slot/backdrop/highlight layers use a per-sprite **`anchor`**: **`top-left`** (default) aligns the sprite’s top-left to the control origin; **`center`** aligns the sprite’s center to the authored **`x`/`y`**; **`screen`** draws at canvas **(0,0)** in internal resolution (ignores the control’s **`x`/`y`** for placement—full-frame HUD art) while **`x`/`y`/size** remain available for layout and future clipping. The VS Code **GUI preview** uses **`buildGuiOverlay`** (same compositor as **`RoomScene`**). **`letterSpacing`** may be set per **`text`** control in **`*.gui.json`**, otherwise per-font **`defaultLetterSpacing`** in **`fonts/fonts.json`**. Wrapped text uses an even **`wordWrapWidth`** (snapped down by one pixel when odd) to reduce sub-pixel centering artifacts from Phaser **`BitmapText`**. **`gameConfig.ts`** and the **GUI preview** both use Phaser **`Canvas`** (not **`WebGL`**) so **`BitmapText`** snaps with **`roundPixels`** the same in-game and in the webview. After changing **`src/editor/preview/guiEditorMain.ts`** (or related preview entry), rebuild **`npm run build:gui-preview`** from the repo root so **`benne-editor/media/gui-preview/`** stays current.

**Add Prop / Hotspot / Point / Region** and **Import Props from Aseprite Tags** appear only when the **room** node or a **category** row (Props, Hotspots, Points, Regions) is selected; they are hidden when a specific prop, hotspot, point, or region item is selected.

---

## 3. Core Systems

### Scrolling room camera

- **Room size** (`RoomData.size`): the physical extent of the room in game-world pixels.  Controls camera bounds, walkable-area extent, and whether `startFollow` is activated.  The background image and Aseprite prop sheets render at their **own natural dimensions** — `size` does **not** scale the art.  Setting `size` smaller than the art restricts the camera to a sub-region of the art, which is valid (e.g. the art bleeds beyond the playable area).  Matches PowerQuest's "Room Bounds."

- **Scroll bounds** (`RoomData.scrollBounds`): optional `{ x, y, width, height }` in room space that restricts how far `cameras.main` may pan within the room.  When omitted the camera pans anywhere within `size`.  Making `scrollBounds` narrower than `size` keeps the camera away from room edges (the camera is "less eager" to scroll to the edge).  Making `scrollBounds` equal to `size` lets the camera pan all the way to the edge.  Implemented via `cameras.main.setBounds(scrollBounds)`.  Matches PowerQuest's "Scroll Bounds."
- **`RoomScene.setupRoomCamera`** (private): called at the end of `create` after characters spawn. Sets `cameras.main.setBounds` from `scrollBounds` (or room size). When the room is larger than the viewport and a player exists, **`applyPlayerCameraFollow`** calls `startFollow` with an offset derived from **`CharacterData.feet`** so the camera tracks the character’s **feet** (see **`src/engine/characterFeet.ts`**), not the sprite’s top-left.
- **`RoomScene.setEditorCameraMode(mode)`** (public): called by the editor's `RoomPolygonEditScene` whenever the toolbar mode changes. Stores the current mode so it can be re-applied on panel resize. Two behaviours: `'navigate'` — letterboxes the game's virtual resolution (352×198) inside the panel using `cameras.main.setViewport`, sets zoom to fill that box, and re-activates player follow + scroll bounds for game-accurate preview; `'edit'` — expands the camera to fill the entire panel (`setViewport(0,0,panelW,panelH)`), computes `zoom = min(panelW/roomW, panelH/roomH)` to fit the full room art, sets bounds to room bounds, and disables player follow so the authoring view is stable. The `scale.on('resize')` hook re-invokes `setEditorCameraMode` automatically when the VS Code panel is resized.
- **Background and props** render at their **natural texture dimensions** — `room.size` does **not** call `setDisplaySize`. Art that extends beyond `room.size` is simply not scrolled into view.
- **Hotspot zones** are sized to `room.size` so polygon hit areas only cover the playable area.

### Scene / room system

- **`BootScene`**: Entry after game creation. Uses `loadStartRoomData()` — **`startingRoomId` in `game-config.json` overrides** `rooms.manifest.json` — resolves the room’s `*.room.json` via Vite glob. Queues background image (optional), room Aseprite sheet, character assets, and registered **inventory** Aseprite sheets (shared `inventory.json` and/or per-item exports), then starts **`RoomScene`** with **`RoomSceneStartData`** (room JSON, spawn lists, texture keys).
- **`RoomScene`**: Single active gameplay view for that room. No second “room manager” type is used at runtime; the abstract **`Room`** class in `Room.ts` is a **placeholder** for future data-driven room types, not wired into Phaser yet. On **`create`**, it walks **`getAllGuiData()`** (all **`*.gui.json`** under **`src/game/guis/`**) and builds one overlay per GUI except that **`dialog-text`** is wired only to **`setDialogTextOverlay`** / **`say`** (starts hidden at boot regardless of JSON **`visible`**); every other GUI follows **`GuiData.visible`** (**`false`** hides at load; omitted / **`true`** shows). Stable **`id`** sort and spaced **`depth`** bands keep stacking predictable, with **`dialog-text`** last so dialogue draws above HUD GUIs.
- **Room switching**: **Not implemented** in-engine today — only the initial `BootScene` → `RoomScene` transition exists.

**Boundaries**: Room **layout and flags** come from JSON; **reactions** for room-scoped content (props, hotspots, or room-scoped character verbs) typically live in **`registerRoomScript`** in `*.room.ts`. **Character-definition** reactions use **`registerCharacterScript('characterId', ({ B }) => { … })`** in `*.character.ts` with **self-only** verb sugar (`B.whenLookAt(() => …)` subscribes to **`verb:character:<id>:<verb>`** only). **`dispatchVerbInteraction`** still prefers **room-scoped** character handlers when present; character-file handlers are the **fallback**. Cross-entity wiring (verbs on other props/NPCs) stays in **`*.room.ts`**.

### Rendering system

- **Renderer**: Phaser **`Canvas`** (`gameConfig.ts` `type`) for consistent crisp **`BitmapText`** with **`roundPixels`** (same choice as the GUI preview bundle).
- **Internal size** from `game-config.json` `resolution`; Phaser **Scale.FIT**, **CENTER_BOTH**, **MAX_ZOOM**, **autoRound** for pixel alignment.
- **Layers**: Background image (optional, full-frame) → props sorted by **`zIndex`** (Aseprite tags as frames) → characters at fixed high depth → debug graphics on top when enabled.
- **`PostEffects.ts`**: **`attachPostProcessingPlaceholder(this.cameras.main)`** — extension point for Phaser 4 camera filters; **no shaders shipped yet**.

### Prop parallax

Room props may set **`parallaxDepth`** (`RoomPropInstance` in `src/types/room.ts`). Each frame, `RoomScene.updateParallaxProps` blends the prop’s authored position with the **top-left of the camera’s visible world rectangle** (`camera.worldView`), not raw `scrollX` / `scrollY` (those diverge from the visible corner when zoom ≠ 1, which breaks editor navigate mode):

```
worldX = parallaxDepth * baseX + (1 − parallaxDepth) * camera.worldView.x
worldY = parallaxDepth * baseY + (1 − parallaxDepth) * camera.worldView.y
```

(`baseX` / `baseY` are the prop’s authored `x` / `y` in room space.)

| `parallaxDepth` | Effect |
|-----------------|--------|
| `0` | Sprite position tracks camera scroll origin (moves fully with the camera). |
| `0–1` | Distant; moves slower than the camera. |
| `1` | No parallax (default if the field is omitted); world-fixed at authored position. |
| `>1` | Foreground; moves faster than the camera. |

**Example** — distant layer at half camera coupling:
```json
"parallaxDepth": 0.5
```

**Performance**: Props with `parallaxDepth === 1` or no `parallaxDepth` are not added to the parallax update list. The scene’s `update()` skips work when that list is empty.

### Input system

- **Custom pointer** (optional `game-config.json` **`cursor`**): when **`cursor.display.aseprite`** is **`true`** and `src/game/assets/images/cursor/cursor.{png,json}` are bundled, **`BootScene`** loads the sheet as **`aseprite:cursor`**; **`RoomScene`** hides the OS cursor, draws a screen-fixed **`Sprite`** that follows the pointer, and swaps clips named by **`idleAnimation`** vs **`activeAnimation`** (Aseprite frame tags / Phaser animation keys). Optional **`cursor.animations`** uses the same per-tag shape as **`CharacterData.animations`** (`loop`, `frameDuration`, `events`); **`applyCharacterAnimationClips`** applies it after **`createFromAseprite`**. Optional **`cursor.hotspot`** picks where the logical pointer tip sits on the art (**`top-left`** through **`bottom-right`** as Phaser `setOrigin` fractions, or **`custom`** with required **`cursor.hotspotPixel`** **`{ x, y }`** from the sprite’s top-left). Hover uses Phaser **`hitTestPointer`** over props (clickable colliders only), **`benneHotspot`** zones, clickable characters, and GUI **`button`** hit targets (`buildGuiOverlay` sets **`benneGuiButton`** on button hit targets). The VS Code **room preview** queues the same asset via **`buildPreviewManifest`** (`queueGameCursorLoad`).
- **Walk**: **Left click** on empty space (no hit-test targets) moves the **player** character toward the click. Clicks outside the mesh are **clamped** into **walkable regions** (`walkable.ts` — each **`WalkablePolygon`** is an outer ring minus optional **active** hole rings; union across polygons; point-in-polygon + closest-point clamping). Characters then **pathfind** around holes and concave parts of the mesh via `src/engine/pathfinding.ts` (see **Pathfinding** below).
- **Props**: **Polygon hit area** per clickable prop; **pointerdown** runs **verb dispatch** immediately (no engine walk/face). Walk and facing toward an object are implemented in **`*.room.ts`** if desired (optional **`walkToPoint`** / **`lookAtPoint`** on the prop are hints for scripts, not used by the engine on click). Default **`inputProfile`**: **primary (left)** → **`look`**, **secondary (right)** → **`use`**. Requires a **collider** when **`clickable`**.
- **Characters / hotspots**: **`pointerdown`** uses the same two-button **verb resolution**; no walk-to-stand for these targets yet (dispatch is immediate). **Hotspots** use closed **`points`** polygons (at least three vertices); **`onVerb`** / **`onVerbFallback`** define reactions. **Clickable characters** use a **polygon hit area** when **`CharacterData.collider.points`** has at least three vertices (coordinates in **sprite frame space**, origin top-left of the cel, consistent with **`feet`**); otherwise the **full sprite rectangle** is interactive.
- **Context menu** disabled on mouse in `RoomScene`.

### Verb system

- **Config** (`src/game/game-config.json`, types **`src/types/game.ts`**): optional **`verbs`** (`{ id, label? }` each), optional **`inputProfile`** (only **`kind: "twoVerb"`** today: **`primaryButtonVerb`**, **`secondaryButtonVerb`**), optional **`defaultFallbackLine`** (used for **`verb:unhandled`**).
- **Defaults**: Omitting **`verbs`** implies ids **`look`** and **`use`**. Omitting **`inputProfile`** defaults to **left → `look`**, **right → `use`**.
- **Per-object data** (**`RoomPropInstance`**, **`RoomHotspotData`**, **`CharacterData`**): **`onVerb`** maps verb **id** → **`true`** (supported verbs). **`onVerbFallback`** is a boolean enabling object-level fallback handling.
- **Dispatch** (`src/engine/verbs/dispatchVerb.ts`): object supports verb → emit canonical scoped event ids from target context (`verb:room:<roomId>:<targetType>:<targetId>:<verbId>`). If object fallback is enabled and verb is unsupported, emit `verb:room:<roomId>:<targetType>:<targetId>:fallback` with `verbFallback: true`. For **characters**, **`verb:room:<roomId>:character:<characterId>:<verbId>`** is tried **first** (if any listener is registered); only if that channel has **no** listeners does dispatch emit **`verb:character:<characterId>:<verbId>`** (character-global / `*.character.ts` Bennescript). Character-global fallback follows the same precedence (room-scoped fallback first, then `verb:character:<id>:fallback`). If no object-level path applies, chain continues to **`verb:global:<verbId>`** (emitted only if a listener exists — see `globalVerbHandlerEventId` in **`verbInteractionEvents.ts`**) → **`verb:global:fallback`** → **`verb:unhandled`**. In **Vite dev**, unhandled verbs also **`console.warn`**. **`RoomScene.tryBeginPropLook`** dispatches the look verb on a prop without moving the player.
- **Payloads** (`propInteractionEvents.ts`): **`RoomPropInteractPayload`**, **`RoomHotspotInteractPayload`**, and **`CharacterVerbInteractPayload`** carry **`verbId`** and target ids; props also expose optional **`walkToPoint`** / **`lookAtPoint`** (room pixels). Characters may include optional **world** **`walkToPoint`** / **`talkPoint`** when the matching fields exist in **`CharacterData`** (converted from frame offsets at click time). Object fallback emissions add **`verbFallback: true`**.

### Character feet (walk / camera)

Optional **`feet`** on **`CharacterData`** (`src/types/character.ts`): **`{ "x", "y" }`** in **frame pixel space** from the cel’s **top-left** to the ground contact. The runtime places Aseprite sprites with **`origin (0,0)`** and offsets position so room spawn **`(x, y)`** is where the feet stand; walk tweens and camera follow use the same point. If **`feet`** is omitted, the engine uses the **bottom-centre** of the **current** frame (works best when cels share a consistent size). The VS Code **BENNE Character preview** webview (`npm run build:character-preview`) plays a default idle (prefers **`IdleD`**, then other **`Idle*`** tags), shows **Feet**, **Walk to**, and **Talk** handles plus the collider on one overlay, and **Save to JSON** writes **`feet`**, **`walkToPoint`**, **`talkPoint`**, and **`collider`** together via **`characterGeometryPatch.ts`**. In the preview, **Feet** and **collider** vertices are clamped to the cel; **Walk to** and **Talk** may be placed outside the sprite bounds (camera bounds grow to include them).

Optional **`walkToPoint`** on **`CharacterData`**: same **frame space** as **`feet`**; world stand = sprite position + offset. Used when **`RoomScene`** resolves script **`walkTo('<characterId>')`** to that character. If omitted, resolution uses the character’s **world feet** (same effective stand as when **`walkToPoint`** matches **`feet`**).

Optional **`talkPoint`** on **`CharacterData`**: same **frame space**; a script-facing **look / dialogue** hint. Verb payloads include **world** **`talkPoint`** when the field is set (like prop **`lookAtPoint`**, but stored per character in frame space).

**Click collider (authoring)** — Optional **`collider: { "points": [ { "x", "y" }, … ] }`** on **`CharacterData`**, same **frame space** as **`feet`**. The preview reuses **`PreviewPolygonOverlay`** with the same vertex / edge / Delete gestures as prop colliders; fewer than three points on save **removes** **`collider`** so the engine falls back to the full-sprite hit test. Verbs and scaffolding use **`CharacterVerbInteractPayload`** from **`propInteractionEvents.ts`**; **Create Character** and verb-handler insertion ensure that **import** is present in new **`*.character.ts`** files.

### Character directional animation (facing)

Directional clips use **Aseprite frame-tag names** built as **`<base><facing>`** (e.g. `IdleL`, `WalkDR`, `TalkUL`). Implementation lives in **`src/engine/directionalCharacterAnimation.ts`**; types for room JSON use **`CharacterFacingLetter`** in **`src/types/character.ts`**.

**Facings (eight-way)** — left, right, up, down, and diagonals: **`L`**, **`R`**, **`U`**, **`D`**, **`UL`**, **`UR`**, **`DL`**, **`DR`**. World space matches the rest of the engine (**y increases downward** on screen).

**Choosing facing from movement** — **`facingFromWorldDelta(dx, dy)`** normalizes the walk (or look) vector and picks the facing whose **unit direction** has the **largest dot product** with that vector, so purely horizontal or vertical motion maps to a **cardinal** (e.g. straight down → **`D`**), and diagonal motion maps to a **diagonal** when both components matter. A **zero** delta defaults to **`D`**.

**Playing a clip when some facings are missing** — **`playDirectionalAnimation(sprite, baseName, facing)`** first tries **`${baseName}${facing}`**. If that Phaser animation does not exist (or has no frames), it walks **other facings in order of smallest angular distance** from the requested facing, and for each candidate tries:

1. The **unflipped** tag for that facing.
2. If a **horizontal mirror partner** exists — **`L`↔`R`**, **`UL`↔`UR`**, **`DL`↔`DR`** — the partner’s tag with **`flipX`**, so a character can ship only **`WalkDL`** and still satisfy a **`DR`** request. **`U`** and **`D`** have **no** mirror pair in this scheme.

The sprite’s **`facing`** data stores the **logical** facing the gameplay asked for (walk end, look-at, spawn), not necessarily the suffix of the clip that ended up playing.

**Spawn and idle defaults** — **`resolveSpawnIdleFacing`** honors **`initialFacing`** on room character instances when it is one of the eight letters; otherwise it falls back like **`resolveInitialIdleFacing`**, which prefers an existing **`Idle*`** in a default order (**cardinals** `R`, `D`, `L`, `U`, then **diagonals** `DR`, `DL`, `UR`, `UL`), and finally **`D`** if nothing matches.

**RoomScene** uses this for **player walk**, **idle after walk**, and **NPC spawn** animation bases (`Idle`, `Walk`, etc.).

### Scripting / interaction system

- **Canonical scoped event ids** are emitted by **`dispatchVerbInteraction`** from runtime target context; JSON no longer stores ad-hoc event-id strings. Props/hotspots/room-scoped characters use `verb:room:...`, character-global uses `verb:character:...` (props still dispatch immediately; no auto-walk first).
- **`registerGameContent()`** (called before `createBenneGame`) eagerly loads **`./rooms/**/*.room.ts`**, **`./characters/**/*.character.ts`**, **`./guis/**/*.gui.ts`**, **`./inventory/**/*.inventory.ts`**, and **`./globalScript.ts`** so side-effect registrations run. **`wireBenneGlobalScripts(game, gameEvents)`** runs immediately after **`createBenneGame`** and invokes **`registerGlobalScript`** callbacks with **`GlobalBenneScript`** (`B.whenGlobalFallback`, `B.whenVerbUnhandled`, …). There is **no** exported `register*Script(events)` loader path.
- **Payloads**: Typed payloads for prop interaction (`propInteractionEvents.ts`), player walk start/stop, etc.
- **`BenneScript` movement**: **`B.player.walkTo(target)`** and **`B.character(id).walkTo(target)`** accept **`Point2`** or a **string id**. Resolution order for strings (first match): **prop** in the room → **hotspot** → **character** in the room → **`room.points`** entry; props use **`walkToPoint`**, else closest point in/on the **collider** to the walker, else the prop frame **center**; hotspots use **`walkToPoint`** or polygon **centroid**; characters use **`CharacterData.walkToPoint`** or **feet** world position. Unknown ids **`console.warn`** once per id and fall back to the walker’s current feet (no move).
- **`BenneScript` verb sugar** (**`whenLookAt`**, **`whenUse`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenVerb`**, **`whenTalkTo`**) registers handlers using the same **prop → hotspot → character** rule for the string id (room **`props`** / **`hotspots`** / spawned **`CharacterData.id`**). **`B.onProp`** and **`B.prop`** stay **prop-only**; **`whenGive`** remains **prop-only** for the recipient id.
- **Boundary**: Scenes should not embed game-specific puzzle logic; they **emit** and **listen** only through agreed event names and small shared types.

### Asset management / loading

- **Room & character JSON** for Aseprite: **eager globs** in `loadAsepriteAtlasData.ts` (and friends); **normalized** for Phaser frame indices (`normalizeAsepriteJson.ts`).
- **Binary assets**: **`resolveGameAssetUrl` / `resolveGameAssetJsonUrl` / `resolveGameAssetXmlUrl`** map paths under `src/game/assets/**` to **Vite-built URLs** (images, JSON, BMFont XML for GUI bitmap fonts).
- **Boot-time loading only** in `BootScene` (Phaser loader); **no streaming** or mid-room asset packs yet.

### Audio system

- **`applyBootAudioSettings`**: Sets Phaser sound manager volume from **`masterVolume`**.
- **Helpers**: `getEffectiveSfxVolume`, `getEffectiveMusicVolume`, `getEffectiveDialogueVolume` — for future SFX/music/dialogue; **no music/dialogue pipeline** is implemented in scenes yet beyond volume knobs in config.

### Game state (v1)

- **`GameStateManager`** (`src/engine/gameState/GameStateManager.ts`): in-memory **flags** (`Record<string, boolean | number | string>`), **variables** (`Record<string, unknown>`), and **inventory** (**`Record<string, number>`** — item id → quantity). Constructed in **`createBenneGame`** (`src/engine/Game.ts`) and stored on **`Phaser.Game.registry`** under **`benneGameState`** (`BENNE_GAME_STATE_REGISTRY_KEY`) so the same instance survives **`RoomScene`** teardown. **`applySnapshot` / `importSnapshotJson`** accept legacy snapshots whose **`inventory`** was a **`string[]`** (each id becomes quantity **1**).
- **Data-first bootstrap**: optional **`initialGameState`** on **`game-config.json`** (merged at startup; validated in **`ConfigManager.ts`**). **`initialGameState.inventory`** may be a **unique id list** (legacy) or a **quantity map**.
- **EventBus**: incremental changes emit **`gameState:flagChanged`**, **`gameState:variableChanged`**, **`gameState:inventoryChanged`**; wholesale replace (**`applySnapshot`**, successful browser load) emits **`gameState:replaced`** only. Scripts listen with **`B.raw.on(...)`** (payload types in **`src/types/gameState.ts`**).
- **Bennescript**: **`B.state`** (set/get/has/clear flag and variable, **`saveToBrowser` / `loadFromBrowser` / `clearBrowserSave`**, **`exportJson` / `importJson`**) and **`B.inventory`** (`add` / `addToInventory`, `remove` / `removeFromInventory`, `has` / `hasInInventory`, `quantityOf`, `clearInventory`) on **`BenneScript`**, **`CharacterBenneScript`**, **`InventoryBenneScript`**, and **`GlobalBenneScript`**. Mutations are **synchronous** (not queued on the interaction tail). **`GuiBenneScript`** has no `game` handle at registration time — no **`B.state`** / **`B.inventory`** there yet.
- **Persistence v1**: **`localStorage`** keys **`benne-save-<slot>`** (default slot **`0`**); **`exportSnapshotJson` / `importSnapshotJson`** on the manager are the extension point for future file-based saves.

### Inventory System

- **Authoring layout**: Under **`src/game/inventory/<inventoryId>/`**, each inventory entry has **`<inventoryId>.inventory.json`** (source of truth, **`InventoryItemData`** in **`src/types/inventory.ts`**) and **`<inventoryId>.inventory.ts`** with top-level **`registerInventoryScript('inventoryId', ({ B }) => { … })`** from **`@engine/scripting`** (side effects only, mirroring characters).
- **Registry**: **`registerInventoryDefinitionsFromGame()`** (from **`registerGameContent`**) eager-loads **`./inventory/**/*.inventory.json`** into **`inventoryDefinitionRegistry`** so **`GameStateManager`** can read **`stackable`** when applying **`add` / `remove`**, and **`BootScene`** knows which Aseprite sheets to queue.
- **Shared Aseprite (PowerQuest-style)**: One export at **`src/game/assets/images/inventory/inventory.png`** + **`inventory.json`**. Each **frame tag** on the sheet is an inventory clip (and default animation name); entry-specific variants should use a root naming convention like **`<root>-*`** (for example **`lantern-glow`**, **`lantern-open`** for root **`lantern`**). The engine normalizes JSON for Phaser, then prefixes Phaser animation keys as **`inventory:<tag>`** so tags stay namespaced on a single texture (**`aseprite:inventory:shared`**). In JSON, set **`display.aseprite`** to **`"shared"`**. Optional **`defaultAnimation`** is the Aseprite frame tag used as the default clip in UI/cursor; when omitted, the inventory **`id`** is used (so the tag name normally matches the folder / inventory id).
- **Per-inventory-entry Aseprite**: **`display.aseprite: true`** loads **`images/inventory/<id>/<id>.png`** + **`.json`** (same pattern as characters). Animation keys are the raw Aseprite tag names on that sheet (texture key **`aseprite:inventory:<id>`**). The **same soft `<root>-*` convention** as the shared sheet applies in tooling: roots are the inventory **`id`** plus optional **`defaultAnimation`**; a sheet tag is grouped with the entry when it equals a root or starts with **`root-`** (literal hyphen). The Inspector derives suggested animation rows from the per-item export the same way it does for **`"shared"`**; authored **`animations`** in JSON remains authoritative.
- **Bennescript**: **`InventoryBenneScript`** exposes the same **`B.player` / `B.character` / `B.state` / `B.inventory`** surface as character scripts, plus inventory-entry-scoped **`whenLookAt`**, **`whenUse`**, … that subscribe to **`verb:room:<roomId>:inventory:<inventoryId>:<verbId>`** and **`verb:inventory:<inventoryId>:<verbId>`**. **`dispatchInventoryVerbInteraction`** ( **`src/engine/verbs/dispatchInventoryVerb.ts`** ) mirrors character precedence: **room-scoped** listeners first, then **global** inventory listeners. **`RoomScene`** runs every **`registerInventoryScript`** callback on each room load (inventory is not “spawned” like characters).
- **VS Code extension**: Main tree **Inventory** group (with **Rooms**, **Characters**, **GUIs**). Tree selection opens **`*.inventory.json`** in the primary editor column and **`openBenneInventoryTypeScript`** (**`roomScriptNavigation.ts`**) for the companion **`*.inventory.ts`** in the Benne script row. Commands **`benne-editor.createInventoryItem`** (wizard: id + name → folder, minimal JSON with **`"aseprite": "shared"`**, stub **`.inventory.ts`**) and **`benne-editor.importInventoryItemsFromAsepriteTags`** (reads **`inventory.json`**, multi-select tags, writes/updates **`.inventory.json`** per tag and optionally **`.inventory.ts`**). In the Inspector, **both** **`display.aseprite: "shared"`** and **`display.aseprite: true`** entries derive animation cards from the relevant sheet using item-scoped roots (item **`id`** plus optional **`defaultAnimation`**) and only include matching tags (**`root`** and **`root-*`**); editing a derived row materializes that row into the entry JSON under **`animations`**. Tags outside that family can still be added manually in JSON (soft convention). Context menus follow the same pattern as **Characters** / **GUIs** (create on group/workspace; import from group or entry context where applicable).

---

## 4. Data Flow

1. **Bootstrap**: `game-config.json` → resolution, start room id, **verbs / input profile / fallback line**, audio caps, debug flags, optional **`initialGameState`** for **`GameStateManager`**.
2. **Boot**: Manifest + glob pick **`RoomData`** → **`BootScene`** builds load list → loader completes → **`RoomSceneStartData`** passed into **`RoomScene.create`**.
3. **Frame loop**: Phaser updates tweens / anims; **input** → hit tests → background **walk** on empty space, or **prop/hotspot/character** hit → **`dispatchVerbInteraction`** → **`gameEvents.emit`** on the chosen event id.
4. **Scripts**: **`*.room.ts`** / **`*.character.ts`** / **`*.gui.ts`** / **`*.inventory.ts`** / **`globalScript.ts`** register on **`gameEvents`** (or receive **`B`** from `@engine/scripting`) and run side effects when their lifecycle runs (per room load for room + character + inventory Bennescript; after game create for global; at content registration for GUI).

**Diagram (simplified)**

```
JSON + Aseprite  →  BootScene (Loader)  →  RoomScene (display + input)
                                              │
Pointer / keys ──────────────────────────────┤
                                              ▼
                                    gameEvents (EventBus)
                                              ▲
registerGameContent (*.room.ts, *.character.ts, *.gui.ts, *.inventory.ts, globalScript)─┘
```

---

## 5. Key Design Decisions

| Decision | Why | Tradeoff |
|----------|-----|----------|
| **One `RoomScene` + boot loader** | Keeps startup and asset story simple. | Room-to-room **scene** transition is still future work; **cross-room data** (flags / variables / inventory) is carried by **`GameStateManager`** on **`game.registry`**. |
| **Global `gameEvents` singleton** | Fast to wire; matches stringly event ids from JSON. | Global coupling; tests need discipline or indirection later. |
| **JSON string event ids** | Editable in data; matches classic adventure “verb” naming. | Typos fail at runtime; editor/tooling (e.g. VS Code extension) helps. |
| **Central verb dispatch** | One precedence chain (object → global → unhandled) and one place for future 9-verb / coin UIs to plug in. | Handlers must register **`verb:global:*`** if they rely on global overrides; listener counts drive whether the global tier runs. |
| **Vite glob for assets** | Correct hashed URLs and tree-shaking. | **Editor preview** must use a **separate fetch/Webview path** (`src/editor/preview/`) — two loading strategies. |
| **Walkable polygons in JSON + visibility-graph pathfinding** | Designer-controlled navmesh; shortest-path routing around holes and concavities via reflex-vertex visibility graph + A\* (classical approach for polygons with holes; matches LucasArts feel). | No auto navmesh; bad polygons break movement visually (mitigated by debug draw of mesh + live path polyline). O(N²) visibility build per walk query — fine for hand-authored rooms, would need caching / triangulation for very large meshes. |
| **Aseprite tags = props / anims** | Single sheet per room/character, industry-standard tool. | Untagged cels are invisible to the engine; tag discipline required. |

---

## 6. Constraints and Rules

- **Engine vs game**: Do not put **game-specific narrative or room logic** under `src/engine/` except through **generic hooks** (events, helpers). Put reactions in **`src/game/`** (`*.room.ts`, future modules).
- **Config**: **`game-config.json`** is the **single source** for resolution, default character, start room override, **verbs**, **inputProfile**, **defaultFallbackLine**, audio, debug flags, optional **`initialGameState`** — read via **`getGameSettings()`**, not duplicated literals. Optional **`cursor`** (custom pointer) adds **`idleAnimation`** / **`activeAnimation`** (Aseprite tag names), optional **`cursor.animations`** (same per-tag shape as **`CharacterData.animations`**), and optional **`cursor.hotspot`** / **`cursor.hotspotPixel`** for pointer-tip placement.
- **Room data**: Follow **`RoomData`** / **`RoomPropInstance`** in **`src/types/room.ts`**; **`collider`** is required for **`clickable`** props. **`walkToPoint`** / **`lookAtPoint`** are optional script hints (not applied by the engine on click). Use **`onVerb` / `onVerbFallback`** for interactions. Room-level **`points`** (**`RoomPointData[]`**, named **`x` / `y`**) are used by **`RoomScene`** when **`BenneScript`** resolves **`walkTo('pointId')`**; **`regions`** (**`RoomRegionData[]`**, closed polygons + **`active`**) remain **authoring / future-system** for gameplay that opts in. **Hotspot** polygons are separate **`hotspots[].points`**.
- **Room prop clip families (soft convention)**: Optional **`RoomPropInstance.defaultAnimation`** adds a second **root** alongside **`id`** for editor/Inspector grouping of tags on the room Aseprite sheet: a tag is suggested for that prop when it **equals** a root or matches **`root-*`** (literal hyphen after the root). **`RoomScene`** still uses **`tag`** for which clip is drawn; **`animations`** maps Aseprite tag names to optional **`loop`** / **`frameDuration`** overrides (same shape as character clip config). The Inspector merges **`meta.frameTags`** with **`animations`** using those roots; JSON stays the source of truth and arbitrary tags remain valid if added manually.
- **Character data**: Follow **`CharacterData`** in **`src/types/character.ts`**. Optional **`collider`** (≥3 **`points`** in frame space) restricts **click** hit-testing for **`clickable`** characters; omit it or save fewer than three points in the preview to use the **full sprite** bounds.
- **GUI data**: Follow **`GuiData`** in **`src/types/gui.ts`**. Optional **`controls`** describe screen-space widgets (**`text`**, **`inventoryPanel`**, **`image`**, **`button`**, **`trigger`**; more types later). Optional top-level **`x`** / **`y`** set the initial screen-space offset of the packed **`gui.root`** (e.g. **`"y": -34`** to park a dropdown bar offscreen; fixed controls are not offset). Optional **`fixedControls`** is a string array of control **`id`** values: those controls are **not** parented under **`gui.root`**, so **`gui.root.tweenTo`** (and future whole-overlay moves) slide the rest of the HUD without moving them. Aseprite sheets use **`images/guis/<guiId>/<guiId>.png`** and **`.json`** when **`display.aseprite`** is true (same export pattern as characters). On **`image`** controls, **`tag`** and **`backgroundAnchor`** live on the control object (parallel to **`backgroundTag`** / **`backgroundAnchor`** on **`inventoryPanel`** and **`button`**); the GUI root **`display`** block is only for overlay-level options such as **`aseprite`**. **Bitmap fonts** for text controls: PNG atlas + BMFont **`.xml`** under **`src/game/assets/fonts/`**, logical ids and paths in **`fonts/fonts.json`** (Phaser **`load.bitmapFont`** key = id = GUI control **`font`**). **`RoomScene`** builds **one overlay per `*.gui.json`** (not a hard-coded id list): **`dialog-text`** is reserved for **`setDialogTextOverlay`** / **`say`**; every other GUI is shown at room load unless **`"visible": false`**. The **GUI preview** uses the same **`buildGuiOverlay`** path for the selected GUI. Further control types (9-slice images, etc.) remain future work.
- **Walkable mesh**: **`walkable.polygons[]`** entries support optional **`holes[]`** (inner rings subtracted when **`active`** is not **`false`**). Each polygon and hole may set **`active`**; omitted or non-**`false`** means included in tests and debug draw. See **`walkable.ts`** and **`RoomScene`** debug overlays (outer vs hole stroke colors).
- **Registration**: New room scripts live under **`src/game/rooms/`** as **`*.room.ts`** with top-level **`registerRoomScript(({ B }) => { … })`**. Character scripts use **`registerCharacterScript('id', ({ B }) => { … })`** under **`src/game/characters/`**. GUI scripts use **`registerGuiScript('id', ({ B }) => { … })`** under **`src/game/guis/<id>/`**. Inventory scripts use **`registerInventoryScript('id', ({ B }) => { … })`** under **`src/game/inventory/<id>/`**. Global hooks use **`registerGlobalScript(({ B, game }) => { … })`** in **`src/game/globalScript.ts`**. All are side-effect-only (no **`export function register*Script`**).
- **Strict TypeScript**: Project uses **strict** compiler options; new code should preserve typings for payloads and JSON-shaped types.

---

## 7. Scripting / interaction system (Bennescript)

BENNE uses a **two-layer scripting architecture** that keeps the engine data-first while giving authors a clean, modern, PowerQuest-inspired authoring experience.

**Layer 1 – Engine Core (unchanged)**  
- Verb dispatch still emits canonical scoped event IDs via `dispatchVerbInteraction` (`verb:room:office:prop:desk:look`, etc.).
- Raw `EventBus` (`gameEvents`) and typed payloads (`RoomPropInteractPayload`, etc.) remain the foundation.

**Layer 2 – Bennescript Facade (new authoring surface)**

Authors now write against a clean, discoverable facade. Handlers are **ordinary sync functions**; the engine registers `async` listeners and, for queued actions, awaits an internal **interaction tail** built from `Promise`s so linear scripts work **without** author `async`/`await` (see **Blocking interaction queue vs `.now`** below).

```ts
import { registerRoomScript } from '@engine/scripting';

// Sugar verbs (`whenLookAt`, `whenUse`, `whenTalkTo`, …) use one string id: `props[]` → `hotspots[]` → character in room.
// `walkTo('…')` resolves prop → hotspot → character → `points[]`.
registerRoomScript(({ B }) => {
  B.whenLookAt('desk', () => {
    B.player.walkTo('desk');
    B.player.say('Looks like an ordinary desk with some paperwork…');
  });

  B.whenUse('desk', () => {
    B.player.say("I don't know what to do with that yet.");
  });
});
```

Character definition scripts use the same `B` movement/dialog primitives on the active `RoomScene`, but **self-only** verb sugar (no target id string — subscribes to `verb:character:<id>:<verb>` only):

```ts
import { registerCharacterScript } from '@engine/scripting';

registerCharacterScript('hank', ({ B }) => {
  B.whenLookAt(() => {
    B.player.say('Hank stares back.');
  });
});
```

**Blocking interaction queue vs `.now` (core Bennescript behavior)**  

Room and character verb handlers are written as **ordinary synchronous functions**, but several `B` methods represent **time** (movement tweens, short `say` pacing delays, `wait`, etc.). Those methods participate in an **internal interaction queue** (`interactionTail` in `BenneScriptCore`): each step is a `Promise` that must finish before the **next** queued step **starts**. That makes linear scripts read top-to-bottom while still driving real async engine work (e.g. `RoomScene.walkPlayerTo` resolves when the walk tween completes). The same queue backs **`BenneScript`** (room), **`CharacterBenneScript`**, **`GlobalBenneScript`**, and **`GuiBenneScript`**.

**Important implementation detail:** queued steps are registered with **lazy factories** (`() => Promise<…>`), not pre-created promises. If the queue were fed eager promises, every `walkTo` / `say` in one handler body would **start immediately** in the same synchronous tick; only **completion** order would be serialized. Lazy registration ensures the **next** walk (or delay) does not begin until the previous step’s promise has settled.

**Methods that use the queue today (blocking by default)**  

These schedule work on the queue when called from a handler (or any code path using the same `BenneScript` instance). Not every facade method is queued; only ones that need ordering relative to time or prior steps.

| API | Blocking call | Non-blocking (same effect, no queue) |
|-----|----------------|--------------------------------------|
| `B.player` / `B.character(id)` — walk | `walkTo(target)` | `walkTo.now(target)` |
| `B.player` / `B.character(id)` — line | `say(text)` | `say.now(text)` |
| `B.player` / `B.character(id)` — clip | `playAnimation(tag)` | `playAnimation.now(tag)` |
| `B.player` / `B.character(id)` — facing | `face(dir)` | `face.now(dir)` |
| Room pacing | `B.wait(seconds)` | `B.wait.now(seconds)` |

**`.now` semantics**  

- **`.now`** runs the **same** underlying behavior (walk tween, `delayedCall` for `say` / `wait`, sync animation or facing).  
- It does **not** append to `interactionTail`; later **blocking** lines in the same handler still run in source order, but **without waiting** for the `.now` action to finish.  
- Return type is **`void`** (same as the blocking form); the engine does not surface promises to authors for the default API.  
- TypeScript models blocking methods as **`BlockingWithNow<…>`** — the callable plus a **`now`** property with the same parameters (good autocomplete).

**Core files**  
- `src/engine/scripting/registerRoomScript.ts` — side-effect registration for room callbacks.  
- `src/engine/scripting/registerCharacterScript.ts` — side-effect registration keyed by character definition id.  
- `src/engine/scripting/registerGlobalScript.ts` + `wireBenneGlobalScripts.ts` — global registrations; wiring runs after `createBenneGame`.  
- `src/engine/scripting/registerGuiScript.ts` — GUI registrations (invoked from `registerGameContent`); **`getGuiBenneScript`** for the live facade instance.  
- `src/engine/scripting/GuiRuntime.ts` — **`GuiRuntime`**, **`ControlFacade`** (GUI behavior surface after `buildGuiOverlay`; pointer hover via **`B.whenMouseEnter` / `B.whenMouseLeave`**).  
- `src/engine/scripting/BenneScriptCore.ts` — shared queue, verb alias resolution, dialog line + input lock, `wait`, `raw`.  
- `src/engine/scripting/BenneScript.ts` — room `B` (`whenLookAt('target', …)`, `player`, `prop`, …).  
- `src/engine/scripting/CharacterBenneScript.ts` — character `B` with **self-only** `whenLookAt(() => …)` (character-global bus ids).  
- `src/engine/scripting/GlobalBenneScript.ts` / `GuiBenneScript.ts` — global and GUI facades.  
- `src/engine/gameState/GameStateManager.ts` — cross-room state; **`src/engine/Game.ts`** registers it on **`game.registry`**.  
- `src/engine/scripting/RoomScriptContext.ts` / `CharacterScriptContext.ts` — typed contexts.  
- `src/game/registerGameContent.ts` — eager globs, `window.__benneRoomScripts` / `__benneCharacterScripts`, GUI callback invocation, DEV warnings if a module still **exports** legacy `register*Script`.

**Runtime wiring**  
- Room scripts run **after** props, characters, the player, and the camera are set up in `RoomScene.create()` (so `B.prop` / `B.player` resolve real scene objects).  
- Character scripts for a given id run in the same phase **only if** that character is spawned in the room; each gets its own `CharacterBenneScript` and `B.dispose()` on scene shutdown.  
- On scene shutdown, each room/character `B.dispose()` removes listeners that instance registered (avoids duplicate handlers if the room scene is recreated).  
- Optional payload-typed handlers use `(p: any)` for unified **`when*`** methods (runtime shape depends on prop vs hotspot vs character), or import specific payload types from `propInteractionEvents.ts` when wiring **`onProp`** / raw events.

**Key Design Decisions**  
- Single `B.` namespace → excellent Cursor IntelliSense and discoverability (better than multiple `C.`, `H.`, `P.` prefixes for a modern TS codebase).  
- `registerRoomScript(({ B }) => { ... })` → natural, minimal boilerplate; **blocking** timing is internal (`async` listener + `await` on the tail after the sync handler body); **`.now`** opts out per call.  
- Side-effect registration via module-level array → works reliably with Vite `import.meta.glob` (avoids marker propagation issues).  
- All real work still flows through the existing `EventBus` and verb dispatch system — zero runtime cost for the facade.

**Multi-room note:** every `registerRoomScript` callback runs once per room load with that room’s `ctx`. Scripts meant for a single room should guard with `if (ctx.roomId !== 'myRoom') return` at the top until a tighter binding exists.

**Future extensions** (easy to add under `B.`):  
- `B.sequence(...)` for parallel/cutscene actions  
- `B.room.changeTo(...)` (or equivalent) for room transitions  
- `B.dialogue.showChoices(...)`

This layer turns BENNE from "wiring events" into "telling a story" while keeping the engine clean and data-driven.

### GUI behavior runtime (`GuiRuntime`, `B.onGuiBuilt`)

After **`buildGuiOverlay`** composes a GUI in **`RoomScene`**, the engine constructs a **`GuiRuntime`** for that overlay and invokes every **`B.onGuiBuilt((gui) => { … })`** callback registered in the matching **`registerGuiScript('guiId', …)`** facade. The same path runs for the reserved **`dialog-text`** overlay. Authors use this for **low-level, composable** UI behavior (slide panels, fades, hover bands, etc.) without adding opinionated helpers to the engine core.

- **`gui.root`** — **`ControlFacade`** for the **`Phaser.GameObjects.Container`** that parents every authored control **except** those whose **`id`** appears in **`fixedControls`** on the GUI JSON. **`gui.root.tweenTo`** / **`setY`**, etc. move or fade only that packed subtree (same Bennescript interaction queue as per-control facades). Fixed controls keep their own scene objects; tween them via **`gui.getControl(id)`** if needed. **`GuiOverlayHandle.gameObjects`** lists the packed container **plus** each fixed control’s top-level object(s) so editor UI-camera routing stays correct. Optional **`GuiData.x`** / **`GuiData.y`** set the **initial** position of the packed root at build time — e.g. **`"y": -34`** parks a dropdown bar just offscreen so a **`tweenTo({ y: 0 })`** in **`onGuiBuilt`** reveals it without any setup call. Fixed controls ignore **`GuiData.x`/`y`** (that is the whole point — keep the reveal trigger pinned in screen space while the rest slides).
- **`gui.getControl(controlId)`** returns **`ControlFacade | null`** — use when a control may be absent and you branch. **`gui.getControlOrThrow(controlId)`** returns **`ControlFacade`** and throws with **`guiId`** + control id if missing; **prefer this** when a missing id means bad JSON so TypeScript stays strict without local guards. Controls need a stable **`id`** in **`*.gui.json`** (`text`, **`button`** `id`, **`inventoryPanel`** optional `id`, **`image`** optional `id`, **`trigger`** `id`). Each facade exposes **`gameObject`**, immediate setters (**`setY`**, **`setVisible`**, **`setAlpha`**, …), and **`tweenTo(props, duration?, easing?)`** / **`tweenTo.now(...)`** — tweens use the **same interaction queue** as other Bennescript (`say`, **`B.wait`**, …) on that GUI’s **`GuiBenneScript`** instance.
- **Pointer hover events**: **`B.whenMouseEnter(controlId, handler)`** / **`B.whenMouseLeave(controlId, handler)`** fire when the pointer enters / leaves any GUI control with that **`id`**. They work uniformly for **`button`** (while enabled, via Phaser's native `pointerover` / `pointerout` since buttons already need `setInteractive` for clicks) and for **`image`**, **`inventoryPanel`**, **`text`**, and **`trigger`** — all of which use a **non-blocking scene-level `pointermove` observer** (**`installGuiControlPointerHoverObserver`**) that tests the pointer against the control's current world bounds without calling `setInteractive`. Events emit on `gameEvents` as **`gui:<guiId>:control:<controlId>:mouseenter` / `:mouseleave`** (see **`guiControlHoverEvents.ts`**). **The observer is critical to keep HUD overlays from eating room clicks**: because non-button GUI controls are not hit-tested by Phaser, the `RoomScene` pointer pipeline (prop / hotspot / character `pointerdown`, and the walk-on-empty-space path that calls `hitTestPointer`) still receives events for pixels covered by an `inventoryBar` backdrop or `image` control.
- **`trigger` control** — **`GuiTriggerControl`** in **`src/types/gui.ts`** (fields: **`id` / `name?` / `x` / `y` / `width` / `height` / `active?` / `visible?`**). It is **never drawn** (a `debug.showGuiOutlines` overlay still traces it for layout). Triggers use the same non-blocking observer as the other non-button controls. Multiple overlapping triggers all fire independently (each is its own rect-containment test). When **`active: false`** no events emit; hiding the rect flushes a synthetic **`mouseleave`** so subscribers always see a clean exit. Authored via the **Add Control** wizard in the Inspector as **“Trigger”**.
- **Dropdown / slide-in HUD pattern**: combine **`GuiData.y`** for the parked position with **two triggers** — a small reveal rect at the top of the screen plus a larger keep-alive rect covering the bar footprint, both listed in **`fixedControls`** so they stay in place while **`gui.root`** slides. Wire reveal on **`whenMouseEnter('hoverZone')`** and hide on **`whenMouseLeave('hideZone')`**. Because triggers are non-blocking, moving the pointer from the reveal zone down onto a button inside the bar keeps **`hideZone`** "inside" and the bar stays open while the click is processed; see **`src/game/guis/inventoryBar/inventoryBar.gui.json`** + **`.gui.ts`** for the canonical example.

```ts
B.onGuiBuilt((gui) => {
  const root = gui.root;

  B.whenMouseEnter('hoverZone', () => {
    root.tweenTo({ y: 0 }, 300, 'Sine.easeOut');
  });

  B.whenMouseLeave('hideZone', () => {
    root.tweenTo({ y: -34 }, 250, 'Sine.easeIn');
  });
});
```

- **Teardown**: **`GuiRuntime.dispose`** (from overlay **`destroy`**) kills tweens on **`gui.root`** and per-control facades; **`buildGuiOverlay`** destroys the packed content container **and** any **`fixedControls`** scene objects, and detaches every hover-forwarder listener it installed. **`GuiBenneScript`** subscriptions (button click, mouseenter/leave) remain on **`gameEvents`** for the next room load; **`onGuiBuilt`** handlers run again whenever the overlay is rebuilt.

Core modules: **`src/engine/scripting/GuiRuntime.ts`**, **`GuiBenneScript.ts`**, and **`buildGuiOverlay`** (`BuiltGuiOverlay` / **`createGuiRuntime`**).

---

## 8. VS Code extension & room preview (implementation detail)

This subsection documents **what exists today** for the **BENNE Editor** (`benne-editor/`) and the preview bundles (`src/editor/preview/`). It does not replace earlier high-level notes; it adds concrete modules, messages, and rules.

### Purpose and build output

- **`npm run build:room-preview`** (repo root) runs **`vite.room-preview.config.ts`**, entry **`room-editor.html`**, and emits **`benne-editor/media/room-preview/room-preview.js`** (and assets). The extension loads that script from **`RoomPreviewPanelController`** HTML.
- **`npm run build:character-preview`** → **`vite.character-preview.config.ts`**, **`character-editor.html`**, **`benne-editor/media/character-preview/character-preview.js`**.
- **`npm run build:gui-preview`** → **`vite.gui-preview.config.ts`**, **`gui-editor.html`**, **`benne-editor/media/gui-preview/gui-preview.js`**.
- **`npm run build:inventory-preview`** → **`vite.inventory-preview.config.ts`**, **`inventory-editor.html`**, **`benne-editor/media/inventory-preview/inventory-preview.js`**.
- The BENNE extension exposes one-off rebuild commands (**`benne-editor.rebuildRoomPreview`**, **`benne-editor.rebuildCharacterPreview`**, **`benne-editor.rebuildGuiPreview`**, **`benne-editor.rebuildInventoryPreview`**) plus **`benne-editor.rebuildEditorPreviewBundles`** to rebuild all preview bundles in order.
- These previews are **not** the same bundle as **`vite build`** for the playable game; they are **separate** clients. The room preview embeds Phaser with **`RoomScene`** and editor-only scenes; character, GUI, and inventory previews are smaller standalone Phaser apps.

### Content scaffolding (create room, prop, character, GUI)

The extension can **generate files** under **`src/game/`** so new content matches engine expectations. Implementation lives in **`benne-editor/src/roomScaffolding.ts`**, **`benne-editor/src/characterScaffolding.ts`**, and **`benne-editor/src/guiScaffolding.ts`**; commands are registered in **`extension.ts`** and **`package.json`** (**`benne-editor.createRoom`**, **`benne-editor.addRoomProp`**, **`benne-editor.importPropsFromAsepriteTags`**, **`benne-editor.createCharacter`**, **`benne-editor.importAnimationsFromAsepriteTags`**, **`benne-editor.createGui`**).

| Action | What it does |
|--------|----------------|
| **Create New Room** | **`runCreateRoomWizard`**: after **`pickWorkspaceFolder`** (BENNE roots = workspaces with **`src/game/rooms`**), prompts for **room id** (slug) and **display name**; creates **`src/game/rooms/<id>/`**, **`<id>.room.json`** (empty **`walkable.polygons`**, **`hotspots`**, **`points`**, **`regions`**, **`props`**), **`<id>.room.ts`** stub with **`registerRoomScript`**, **`src/game/assets/images/rooms/<id>/`**, and appends **`rooms.manifest.json`** (sorted **`rooms[]`**; preserves **`startRoomId`** when set). Opens **`*.room.json`** for editing and **`openBenneRoomTypeScript`** (**`roomScriptNavigation.ts`**) so **`*.room.ts`** pins in the Benne script row (preview + script two-row layout). |
| **Add Prop** | **`runAddRoomPropWizard`**: target room from **focused room/prop tree node**, open **`.room.json`**, or quick-pick. Prompts for **Aseprite tag**, **prop id**, and **clickable** yes/no; appends to **`props`** with **`nextPropZIndexFromProps`**. Does **not** validate tags against exported sheet JSON. After success: **two-row editor layout** + **`openBenneRoomTypeScript`** (**`roomScriptNavigation.ts`**) to show **`*.room.ts`** in the script row (JSON is already the active room document / Inspector target). |
| **Add Hotspot** | **`runAddRoomHotspotWizard`**: same room resolution as **Add Prop**. Prompts for **hotspot id**; appends **`hotspots[]`** with **`active`**, **`description`**, **`zIndex`**, a **default 48×48 axis-aligned square** centered on **default game resolution** (**352×198**), and default **`walkToPoint`** / **`lookAtPoint`** so the preview editor can reshape immediately. |
| **Add Point** | **`runAddRoomPointWizard`**: appends **`points[]`** with **`id`** and **`x` / `y`** at **room center** (same default resolution as above). |
| **Add Region** | **`runAddRoomRegionWizard`**: appends **`regions[]`** with **`active`** and the same **default centered square** polygon as **Add Hotspot** (no walk/look). |
| **Import Props from Aseprite Tags** | **`runImportPropsFromAsepriteTags`**: resolves room (tree or picker); reads **`meta.frameTags`** from **`src/game/assets/images/rooms/<roomId>/<roomId>.json`**. **Mode** — **Grouped (recommended)**: pick **candidate base** tags (not a shorter tag’s **`tag-*`** extension); each base creates **one** prop with **`animations`** entries for every **`base`** / **`base-*`** tag on the sheet; **`id`** is the base slug when free and valid, otherwise **`${roomId}-prop-…`** plus **`defaultAnimation: <base>`**. **Legacy**: multi-select any tags; one prop per tag with **`allocateUniquePropId`**. Optional **clickable** for the batch. Same post-step layout + **`openBenneRoomTypeScript`** as **Add Prop**. |
| **Create Character** | **`runCreateCharacterWizard`**: folder pick, **display name**, **character id** (slug); creates **`src/game/characters/<id>/`**, **`<id>.character.json`** (minimal fields incl. **`display.aseprite: true`**), **`<id>.character.ts`** stub with **`registerCharacterScript('<id>', ({ B }) => { … })`** from **`@engine/scripting`**, and **`src/game/assets/images/characters/<id>/`**. **`registerGameContent`** eagerly loads **`./characters/**/*.character.ts`**. Opens **`*.character.json`** and **`openBenneCharacterTypeScript`** for the companion **`*.character.ts`**. |
| **Import Animations from Aseprite Tags** | **`runImportAnimationsFromAsepriteTags`**: requires **`display.aseprite: true`**; resolves character (tree or picker); reads **`meta.frameTags`** from **`src/game/assets/images/characters/<id>/<id>.json`**. Multi-select quick pick (keys already in **`animations`** labeled). New clips use **`{ "loop": true }`** per **`CharacterAnimationClipConfig`** (`src/types/character.ts` — keys **must match** Aseprite tag names). Merges into **`animations`**; then **two-row** layout + **`openBenneCharacterTypeScript`** (character preview on top when a character is selected in the tree). |
| **Create GUI** | **`runCreateGuiWizard`**: folder pick, **display name**, **GUI id** (slug); creates **`src/game/guis/<id>/`**, **`<id>.gui.json`** (minimal **`GuiData`**, **`display.aseprite: true`**), **`<id>.gui.ts`** stub with **`registerGuiScript('<id>', ({ B }) => { … })`** from **`@engine/scripting`**, and **`src/game/assets/images/guis/<id>/`**. Opens **`*.gui.json`** and **`openBenneGuiTypeScript`** for **`*.gui.ts`**. |

**UI entry points**: BENNE **main tree** view title (**Create New Room**, **Create Character**, **Create GUI**, rebuild preview bundles), context menus on **Rooms** / **GUIs** / **workspace** / **room** / **hotspot** / **point** / **region** / **prop** / **character** nodes (see **`package.json`** **`menus`** — includes **Add Hotspot** / **Add Point** / **Add Region** on **room** and those child types). Under each **room** node, the tree lists **hotspots**, **points**, **regions**, then **props** (distinct icons: e.g. **map** / **target** / **layout-panel** / **symbol-misc**); **`mainTreeProvider.ts`** reads **`hotspots`**, **`points`**, and **`regions`** from JSON via **`readRoomHotspots`**, **`readRoomPoints`**, and **`readRoomRegions`** in **`gameDiscovery.ts`**. **Actions** tree when a **room** is focused: **Add Hotspot**, **Add Point**, **Add Region**, **Add Prop**, **Import Props from Aseprite Tags**, then room-open shortcuts; **prop**-focused actions still prepend the same scaffold commands and append prop verb rows (**`actionsTreeProvider.ts`**). Tree selection for **hotspot** / **point** / **region** updates **`EditorSelection.roomPanel`** (**`editorSelection.ts`**) so the preview toolbar matches. Commands **`benne-editor.addRoomHotspot`**, **`addRoomPoint`**, **`addRoomRegion`** are registered in **`extension.ts`** / **`package.json`**. **`validateSlug`** / **`pickWorkspaceFolder`** are shared helpers (**`roomScaffolding.ts`**).

### Preview runtime (`src/editor/preview/`)

| Module | Role |
|--------|------|
| **`roomEditorMain.ts`** | Webview entry: `window` **`message`** handler; **`acquireVsCodeApi`**; **`lastLoadedRoom`** for lightweight toolbar updates; **`wireToolbarFromPreviewState`** builds toolbars for **room**, **prop collider**, **hotspot polygon**, **region polygon**, and **room point** modes; **`loadRoomGeneration`** + **`destroyPreviewGameAsync()`** (**150ms** after **`Phaser.Game.destroy(true)`** so teardown can finish before a new game mounts). **`normalizeRoomForPreview`** copies the host payload into a stable **`RoomData` shape** (`walkable.polygons`, **`hotspots`**, **`points`**, **`regions`**, **`props`**, **`characters`**) so partial JSON or odd **`postMessage`** payloads cannot break the toolbar or manifest. **`enqueuePreviewLifecycle`** chains **`clear` / `error` / `loadRoom`** work on a single promise tail so operations never overlap; failures log to the console instead of being swallowed. **`runLoadRoom`** builds a **`position: relative`** stack under **`benne-preview-root`**: a full-size inner **`div`** as Phaser’s **`parent`**, with the overlay canvas appended as a sibling on top of the game canvas. Toolbar wiring runs **before** **`buildPreviewManifest`** / **`createRoomPreviewPhaserGame`**; failures surface as **`Preview toolbar: …`**. |
| **`createRoomPreviewGame.ts`** | Constructs **`Phaser.Game`** with an **editor-specific config** (`getEditorPhaserGameConfig`) that spreads `getBenneRendererConfigFields()` from `engine/gameConfig.ts` (so the room preview renders via **`Phaser.CANVAS`** + `roundPixels: true`, matching the shipped game) and only overrides the scale block with **`Scale.RESIZE`** so the canvas always fills the VS Code preview panel — no letterboxing at the Phaser level. Navigate-mode letterboxing is handled instead by `RoomScene.setEditorCameraMode` via `cameras.main.setViewport`. Sets **`callbacks.preBoot`** registry keys **`bennePreviewRoom`**, **`bennePreviewRoomJsonUri`**, **`bennePreviewPostPatch`**, **`benneRoomSceneGenericGuisVisible`** (initial value of the toolbar **Show GUIs** toggle); scenes **`BennePreviewLoader`**, **`RoomScene`**, **`RoomPolygonEditScene`**. Loader **`create()`** starts **`RoomScene`**, **`launch`**es the polygon scene, then **`URL.revokeObjectURL`** for preview-only blob atlas URLs. The loader also supports a third entry kind (**`bitmapFont`**) alongside **`image`** / **`aseprite`** so preview GUI text controls can render. |
| **`buildPreviewManifest.ts`** | **`fetch`**-based analogue of boot loading: builds **`PreviewManifest`** (`loads`, **`RoomSceneStartData`**, **`revokeObjectUrls`**) from **`RoomData`** + webview **`gameSrcWebviewUri`**. Also queues **GUI bitmap fonts** (via `collectFontIdsReferencedByGuiControls`), **per-GUI Aseprite sheets** (every GUI with `display.aseprite: true`), and **inventory Aseprite sheets** (shared + per-item, for any registered `*.inventory.json`) when at least one GUI declares an **`inventoryPanel`** control. This matches `BootScene`'s load list so the **Show GUIs** toolbar toggle can switch HUD GUIs on without a preview reload. |
| **`guiVisibilityBridge.ts`** | Small subscribe/notify holder (same pattern as `polygonEditBridge`) for the **Show GUIs** toolbar toggle state. `roomEditorMain.ts` persists the current value in webview state (`vscode.getState/setState`) so the toolbar remembers the user's last choice across reloads (default **off** on first ever open). |
| **`RoomPolygonEditScene.ts`** | Drives the **DOM overlay canvas** for polygon handles, strokes, **walk/look** markers, labels, and **rect handles** (room size + scroll bounds). Modes: **walkable** (outer or hole), **prop collider**, **hotspot polygon**, **region polygon**, **room point**, **room size** (cyan rect, origin locked at 0,0), **scroll bounds** (orange rect, freely resizable). On every bridge mode change calls `syncEditorCameraMode()` which forwards to `RoomScene.setEditorCameraMode`. **Middle-mouse drag** pans the camera; **mouse wheel** zooms around the cursor (`onOverlayWheel` uses the Phaser 4 origin-aware formula `scrollX = worldX - originX - (screenX - originX - cam.x) / newZoom`); **F key** resets to fit-room zoom. **Delete/Backspace** removes the selected polygon vertex. Caches a `roomScene` reference so the correct `cameras.main` (with active zoom/scroll) is used for all coordinate transforms. |
| **`previewPolygonOverlay.ts`** | Stacked `<canvas>` above the Phaser canvas. **`worldToCanvasCss(p, cam)`** uses the Phaser 4 origin-aware formula `(cam.zoomX * (world - scroll - origin) + origin + cam.x) / displayScale` — critical because Phaser 4 cameras default to `originX = originY = 0.5` (zoom from viewport centre); the simpler `(world - scroll) * zoom` formula only works at zoom = 1. **`domToWorld(pageX, pageY, cam)`** uses `scale.transformX/Y` + `cam.getWorldPoint`. **`clearAndDraw(state, cam)`** draws polygon handles. **`clearAndDrawRect(state, cam)`** draws an 8-handle resize rectangle with optional locked handles (used for room size where the origin corner is fixed). |
| **`polygonEditBridge.ts`** | **Mode** (`navigate` \| `walkable` \| `propCollider` \| `hotspotPolygon` \| `regionPolygon` \| `roomPoint` \| **`roomSize`** \| **`scrollBounds`**); **`walkablePolygonId`**, **`walkableHoleId`** (empty = outer ring); **`propId`**, **`hotspotId`**, **`regionId`**, **`roomPointId`**; **`subscribe`** notifies the polygon scene. Mode changes drive both input gating and `RoomScene.setEditorCameraMode`. |
| **`polygonPatchTypes.ts`** | **`RoomPolygonPatch`**: `walkable` \| `propCollider` \| `hotspotPolygon` \| `regionPolygon` \| `roomPoint` \| **`roomSize`** (`{ width, height }`) \| **`scrollBounds`** (`{ x, y, width, height }`). All kinds mirrored in **`benne-editor/src/roomPolygonPatch.ts`** which validates, integer-rounds, and persists to `*.room.json`. |
| **`characterEditorMain.ts`** | Character preview webview: loads **`benne/charPreview/loadCharacter`** (JSON + **`gameSrcWebviewUri`** + **`characterId`**), **`createCharacterPreviewPhaserGame`**, toolbar **Save to JSON** / **Refresh**; save posts **`benne/charPreview/saveCharacter`** with full geometry; **`pickCharacterPreviewIdleTag`** prefers **`IdleD`** then other **`Idle*`** tags. |
| **`createCharacterPreviewGame.ts`** | **`Phaser.Game`** (renderer fields from `getBenneRendererConfigFields()`, **`Scale.RESIZE`**) with boot loader + **`CharacterPreviewScene`**: Aseprite idle, **`PreviewPolygonOverlay`** for **Feet** / **Walk to** / **Talk** labeled handles and **collider** together (prop-style vertex place/drag, double-click edge, Delete, middle pan, wheel zoom). |
| **`characterPreviewPanel.ts`** (extension) | **`CharacterPreviewPanelController`**: webview **`benneCharacterPreview`**, **`applyCharacterGeometryPatch`** (**`characterGeometryPatch.ts`**). Rebuild via **`npm run build:character-preview`** (**`benne-editor.rebuildCharacterPreview`**). |
| **`guiEditorMain.ts`** | GUI preview webview: **`benne/guiPreview/loadGui`** / **`clear`** / **`ready`**; resolves **`fonts/fonts.json`** + **`collectFontLoadsForGui`** for webview font URLs; optional Aseprite PNG/JSON when **`display.aseprite`** (text-only fallback when the sheet fails but **`controls`** still has **`text`** / **`inventoryPanel`** / **`image`**); letterboxed Phaser canvas at **`game-config.json`** **`resolution`**. |
| **`createGuiPreviewGame.ts`** | **`Phaser.Game`** (renderer fields from `getBenneRendererConfigFields()`, **`Scale.FIT`** at internal width/height, black backdrop); boot loads fonts + optional Aseprite; main scene composes **`buildGuiOverlay`** only (visible, sample placeholder for empty **`text`** strings) — sheet art appears only when bound on controls, matching **`RoomScene`**. |
| **`guiPreviewPanel.ts`** (extension) | **`GuiPreviewPanelController`**: webview **`benneGuiPreview`**. Rebuild via **`npm run build:gui-preview`** (**`benne-editor.rebuildGuiPreview`**). |
| **`inventoryEditorMain.ts`** | Inventory preview webview: **`benne/inventoryPreview/loadInventory`** / **`clear`** / **`ready`**; resolves shared or per-item Aseprite JSON via inventory display mode, picks default clip (`defaultAnimation` else `id`), and loads a standalone Phaser preview. |
| **`createInventoryPreviewGame.ts`** | **`Phaser.Game`** (**`Scale.FIT`**, game resolution) that loads the selected inventory Aseprite sheet, plays the chosen animation key, and renders an item/tag label for quick verification. |
| **`inventoryPreviewPanel.ts`** (extension) | **`InventoryPreviewPanelController`**: webview **`benneInventoryPreview`**. Rebuild via **`npm run build:inventory-preview`** (**`benne-editor.rebuildInventoryPreview`**). |

### High-DPI editor overlay

The editor preview uses **`Scale.RESIZE`** (not `Scale.FIT`) so the Phaser canvas always fills the VS Code panel. **Navigate mode** simulates the exact in-game view by computing `scale = min(panelW/gameW, panelH/gameH)` and using `cameras.main.setViewport(centreX, centreY, gameW*scale, gameH*scale)` — the viewport box is letterboxed inside the panel using the game background colour. **Edit mode** expands the viewport to the full panel (`setViewport(0,0,panelW,panelH)`), zooms to fit the room art, and enables mouse-wheel zoom (around the cursor) and middle-mouse pan. Pressing **F** resets to the fit-room zoom. The camera re-applies its mode automatically via `scale.on('resize')`. The DOM overlay canvas is sized to fill the full panel in both modes; all handle drawing uses `worldToCanvasCss(p, cam)` which accounts for the active camera zoom, scroll, and viewport origin (`cam.x`, `cam.y`). **Pointer capture** on the overlay handles drags; **`pointer-events: none`** in Navigate so `RoomScene` receives clicks. **Zoom formula** (Phaser 4-accurate): `scrollX = worldX - originX - (screenX - originX - cam.x) / newZoom` keeps the world point under the cursor fixed across zoom steps.

**Editor UI camera** (`RoomScene.ensureEditorUiCamera`): because the editor main camera uses `setZoom(scale)` while the shipped game keeps `cameras.main.zoom = 1`, Phaser 4's origin-aware zoom math pushes `scrollFactor: 0` overlays off the viewport by `origin × (1 − zoom)` pixels (hundreds of px at typical editor scales) — this is why the first "Show GUIs" attempt produced no visible pixels even with `visible: true` and correct bounds. `RoomScene` creates a second camera (`name: 'editor-ui'`) with the same viewport + zoom as `cameras.main` but `origin = (0, 0)` and `scroll = (0, 0)`, so GUI overlays render at `(x × zoom, y × zoom)` relative to the viewport top-left — matching the runtime placement. `GuiOverlayHandle.gameObjects` enumerates each overlay's top-level objects so the main camera can `ignore` them and the UI camera can `ignore` everything else; a `Phaser.Scenes.Events.ADDED_TO_SCENE` listener keeps the split correct for objects added after scene boot (tween sprites, debug overlays). The UI camera is torn down on `Phaser.Scenes.Events.SHUTDOWN`. The shipped game never calls `setEditorCameraMode`, so this camera is editor-only and has **zero** runtime cost.

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

**Character preview** (same extension, separate panel): **`benne/charPreview/ready`** → host **`loadCharacter`**; **`benne/charPreview/saveCharacter`** → **`characterGeometryPatch.ts`**; **`benne/charPreview/saveCharacterResult`**; **`benne/charPreview/requestRefresh`** re-pushes JSON from the host (unsaved-buffer-aware like room JSON).

**GUI preview**: **`benne/guiPreview/ready`** → host **`loadGui`** (**`gui`**, **`guiId`**, **`gameSrcWebviewUri`**, **`guiJsonUri`**); **`benne/guiPreview/clear`** when focus leaves a GUI.

**Persistence**: **`benne-editor/src/roomPolygonPatch.ts`** — **`applyRoomPolygonPatch`** merges into `*.room.json`, rounds `Point2` to integers; supports **`walkable`** (outer or `holeId`), **`propCollider`**, **`hotspotPolygon`**, **`regionPolygon`**, **`roomPoint`** (`x`/`y`), **`roomSize`** (`width`/`height`), and **`scrollBounds`** (`x`/`y`/`width`/`height`). **`parseRoomPolygonPatch`** validates all payloads from the webview.

### Toolbar UX (tree selection)

A persistent **Show GUIs** checkbox sits in `#benne-preview-topbar` (next to **Refresh**), available in every toolbar mode. When checked, `RoomScene.setGenericGuisVisible(true)` turns on every GUI under `src/game/guis/**` **except** `dialog-text` (that one remains driven by Bennescript `say`). The state is stored via `vscode.setState({ showGuis })` so the webview remembers the last choice across reloads and `loadRoom` cycles; the value is also forwarded through `createRoomPreviewGame.ts` into the `benneRoomSceneGenericGuisVisible` registry key so `RoomScene.create` picks it up on the first frame (no flash of hidden / visible GUIs).

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
- **Two-row** layout, **pinned** documents, tree commands, and companion-script helpers (**`openBenneRoomTypeScript`**, **`openBenneCharacterTypeScript`**, **`openBenneGuiTypeScript`**, **`openBenneInventoryTypeScript`**) remain in **`extension.ts`** / **`roomScriptNavigation.ts`**.

### Data flow (preview save)

```
Toolbar Save → postMessage(polygonPatch) → applyRoomPolygonPatch(uri) → polygonPatchResult(ok, appliedPatch)
     → webview applies appliedPatch to registry room (Phaser game stays alive; no pushPreview)
```

### Preview reload order (why toolbar can run with no `Phaser.Game`)

A full **Refresh** or **`loadRoom`** **destroys** the previous **`Phaser.Game`**, clears **`benne-preview-root`**, then **normalizes** room JSON and **rebuilds the HTML toolbar** (dropdowns, mode, **`polygonEditBridge`** updates). Only after that does the webview **`await buildPreviewManifest`** and **`createRoomPreviewPhaserGame`**. That order keeps **walkable** / **prop** / **hotspot** / **region** / **point** toolbar UI safe when JSON is incomplete, but it means **`polygonEditBridge.notify()`** can fire **while the old `RoomPolygonEditScene` is still subscribed** and **`ScenePlugin.manager`** is already cleared — hence the **manager null guards** in **`RoomPolygonEditScene`** (see table above). **`wireRoomToolbar`** also treats **`walkable.polygons`** defensively when building the **Walkable/Holes** list.

### Runtime walk mesh (engine)

- **`src/engine/walkable.ts`**: **`isPointInWalkablePolygon`** — inside **active** outer, not inside any **active** hole; **`isPointInWalkableArea`** unions polygons; **`clampWalkDestinationTowardClick`** uses holed closest-point logic (used as the goal-clamping step inside pathfinding, and as the fallback when no path is reachable).
- **`RoomScene`** debug **`showWalkable`**: strokes **active** outers and **active** hole rings (distinct colors), and draws the **live player pathfinding polyline** in cyan with small square handles at each waypoint (updated per frame from `currentPlayerPath` while a walk is active).

### Pathfinding (engine)

- **`src/engine/pathfinding.ts`** — `findWalkPath(start, goal, polygons) -> Point2[]` returns an ordered polyline of waypoints (goal last) routing the character around **holes** and **concave** parts of the walkable union. Used by both the player and NPCs.
- **Algorithm**: classical **reduced visibility graph + A\***, the canonical shortest-path approach for *simple polygons with holes* and what most modern 2D adventure engines use under the hood (Adventure Creator, Wintermute-family, PowerQuest polygon mode). Result is the **exact Euclidean shortest path** — a polyline that bends only at polygon corners, giving the classic LucasArts "walk around the obstacle" look.
- **Graph nodes**:
  - **Reflex** outer-ring vertices of each **active** polygon (convex outer corners are never on a shortest path and are omitted).
  - **All** vertices of each **active** hole ring (holes poke into the walkable region, so every hole vertex is reflex as seen from the walk side).
  - Each node is offset **~1 px inward along the interior angle bisector** so waypoints sit just inside the mesh rather than exactly on the boundary pixel. This both matches the classic LucasArts corner-radius feel and keeps segment-midpoint-in-walkable tests numerically robust at vertices.
- **Edges**: two points are connected iff the straight segment between them lies entirely inside the walkable region. Tested by (1) sampling the segment at t = 0.25 / 0.5 / 0.75 and checking each is in the walkable union, plus (2) a proper-crossing test against every ring edge (outer + active hole) that ignores shared-endpoint touches and collinear overlap.
- **Start / goal**:
  - Goal is first clamped to the walkable union (reuses `clampWalkDestinationTowardClick`).
  - If the **start** point is outside the walkable region (spawn / cutscene placement off the mesh), pathfinding is skipped and a **direct line** to the clamped goal is returned — preserves the pre-pathfinding behavior where off-mesh characters glide to the floor.
  - If start and goal are in **disconnected components** of the walkable union, A\* returns no path and the engine falls back to a direct line to the clamped goal.
  - If the straight segment from start to clamped goal is already inside the mesh, `findWalkPath` short-circuits to `[goal]` without running A\* (common case: clicking nearby open floor).
- **Complexity**: O((N+2)²) visibility edges per query, where N is the number of candidate nodes (typically tens for hand-authored rooms). Each visibility test is O(E) across all ring edges. Cheap in practice; invoked once per walk command (click-to-walk, `B.player.walkTo(…)`, or `B.character(id).walkTo(…)`), not per frame. No cross-query caching yet — future work if rooms ever grow to hundreds of vertices.
- **Integration in `RoomScene`**:
  - `walkPlayerToWorldPoint` / `walkCharacterToWorldPoint` (and the empty-space click handler) call `findWalkPath` and then chain **one Phaser tween per path leg** via `beginPlayerWalkLeg` / `beginNpcWalkLeg`. Facing is recomputed per leg with `facingFromWorldDelta` so the sprite turns into each new direction (`Walk` base animation swaps accordingly); `Idle` plays on final leg completion.
  - `PLAYER_WALK_START` fires **once** with the final clamped target; `PLAYER_WALK_STOP` fires **once** on `complete` (final leg) or `interrupted` (new walk pre-empts the chain, scene shuts down, etc.). Leg boundaries themselves do not emit events.
  - `stopPlayerMoveTween(emitStop)` cancels the current leg and clears `currentPlayerPath`; in-flight `onComplete` guards against advancing a superseded chain by comparing tween identity with `playerMoveTween`.


---

## 9. Future Considerations

- **Room transitions**: Loading another room likely means **restarting `RoomScene`** (or a thin orchestrator) with new `RoomSceneStartData`. **Global narrative state** (flags, variables, inventory) already persists across room loads via **`GameStateManager`**; a future transition API should **not** replace that manager unless the game explicitly resets it.
- **Post-processing**: `PostEffects.ts` is ready for **camera filter** composition (CRT, dither, etc.).
- **Audio**: Volume helpers exist; **music loops, voice, and SFX triggers** from events are **future work**.
- **Dialogue / inventory UI**: **`say`** shows the **`dialog-text`** text overlay. **`inventoryPanel`** GUIs render a carried-items grid with optional **paged scroll** (`scrollDirection`, `backButton`, `forwardButton` in **`*.gui.json`**) and **reactive rebuild** on **`gameState:inventoryChanged`** / **`gameState:replaced`** when scroll is configured. **Richer dialogue** (choices, portraits) and **full inventory UX** (drag-reorder, cursor) remain **future work** — **`B.inventory`** is available for wiring.
- **Editor**: VS Code extension + **`build:room-preview`** ship a **live `RoomScene` preview** in a webview with **polygon editing** (walkable, prop colliders, **hotspots**, **regions**, and **room points**) via **`RoomPolygonEditScene`**. **`build:character-preview`** adds a separate webview for **feet** + **click collider** polygons — see **§8**.

---

*This document reflects the repository as of the last update; when behavior changes, prefer updating this file over stale comments scattered in code.*
