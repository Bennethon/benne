# Proposal: format-neutral art import

Status: **proposal**, not implemented. Written 2026-10-08 against the code at `a1b871c`. Direction agreed on 2026-10-08: BENNE gets one format-neutral sprite model, and every art format is an importer into it, with Aseprite as one of them. Sections 9 and 10 list the alternatives and the open questions.

## Summary

Today BENNE loads every animated piece of game art from Aseprite's JSON + PNG export: characters, room props, GUI sheets, inventory icons and the cursor. The goal is to make Aseprite **one of several ways to bring art in**, alongside plain PNG files, grid sprite sheets from asset packs, packed atlases from tools like TexturePacker, and animated GIF, WebP or APNG files.

The plan:

- **One BENNE sprite model.** It is a format-neutral description of an art source: images, named frames and named animations with timing. The engine, the editor previews and the tooling (handle generator, validator, Inspector) read only this model.
- **One importer per format.** Each importer reads one kind of source and produces the model. Aseprite is the first importer and keeps working exactly as today. A new format means writing one more importer; nothing else changes.
- **A small change for authors.** A content file says which format its art uses (`"display": { "art": { "format": "images" } }`). The art still lives in the same folder (`assets/images/<kind>/<id>/`). Animations are still referred to by name, so scripts, saved games and generated handles don't change.

Sections 1 and 2 describe the current pipeline and what BENNE needs from any art source. Section 3 explains the formats, including what grid sheets and atlases are. Section 4 shows what working with each format would be like for a game author. Section 5 is the technical design, and sections 6–8 cover the impact on existing games, the risks and a staged plan.

## 1. How it works today

### 1.1 Where art lives and how it is switched on

Art is found by convention under `src/game/assets/images/`, and each content type has its own opt-in flag:

| Content | Files | Switch | Texture key | Phaser animation key | Animations created |
|---|---|---|---|---|---|
| Character | `characters/<id>/<id>.{png,json}` | `display.aseprite: true` (otherwise `display.defaultImage`, a static image) | `aseprite:<id>` | bare tag (`WalkL`) | per sprite, `sprite.anims.createFromAseprite` |
| Room props | `rooms/<roomId>/<roomId>.{png,json}` | implicit: the room lists `props` | `roomAseprite:<roomId>` | `room:<roomId>:<tag>` | scene-global, at room spawn |
| GUI | `guis/<id>/<id>.{png,json}` | `display.aseprite: true` | `aseprite:gui:<id>` | `gui:<id>:<tag>` | scene-global, once per game |
| Inventory (per item) | `inventory/<id>/<id>.{png,json}` | `display.aseprite: true` | `aseprite:inventory:<id>` | `invitem:<id>:<tag>` | scene-global, once per game |
| Inventory (shared) | `inventory/inventory.{png,json}` | `display.aseprite: "shared"` | `aseprite:inventory:shared` | `inventory:<tag>` | scene-global, once per game |
| Cursor | `cursor/cursor.{png,json}` | `game-config.json` `cursor.display.aseprite` | `CURSOR_TEXTURE_KEY` | `cursor:<tag>` | scene-global |
| Room background | any image path | `room.background.image` | `bg:<roomId>` | (none) | (none) |

Path and key helpers: [characterAseprite.ts](../src/game/boot/characterAseprite.ts), [roomAseprite.ts](../src/game/boot/roomAseprite.ts), [guiAseprite.ts](../src/game/boot/guiAseprite.ts), [inventoryAseprite.ts](../src/game/boot/inventoryAseprite.ts), [cursorAseprite.ts](../src/game/boot/cursorAseprite.ts), [asepritePhaserAnimationKeys.ts](../src/game/boot/asepritePhaserAnimationKeys.ts).

### 1.2 The load pipeline

1. **Discover.** [loadAsepriteAtlasData.ts](../src/game/boot/loadAsepriteAtlasData.ts) eagerly globs every sheet JSON with `import.meta.glob`, one glob per content kind.
2. **Normalise.** [normalizeAsepriteJson.ts](../src/game/boot/normalizeAsepriteJson.ts) renumbers hash-export frame keys (`"hank 0.aseprite"`) to `"0"`, `"1"`, … so that `createFromAseprite` can resolve tag `from`/`to` ranges.
3. **Namespace.** Five near-identical `prefix…AsepriteFrameTags` functions rewrite `meta.frameTags[].name` so that animations on the scene-global `AnimationManager` don't collide.
4. **Queue.** [BootScene.ts](../src/engine/scenes/BootScene.ts) (GUI, inventory, cursor) and `queueRoomSceneAssetLoads` in [roomSceneBootstrap.ts](../src/engine/scenes/roomSceneBootstrap.ts) (room sheet, characters) call `load.aseprite({ textureURL, atlasURL: <normalised object> })`.
5. **Create animations.** `createFromAseprite` registers one Phaser animation per frame tag. For characters this happens on the sprite (`spawnAsepriteCharacter` in [RoomScene.ts](../src/engine/scenes/RoomScene.ts)). Props register on the scene in `spawnRoomProps`. GUI and inventory sheets register once per game through [ensureAsepriteAtlasAnimationsOnce.ts](../src/engine/aseprite/ensureAsepriteAtlasAnimationsOnce.ts), and the cursor registers on the scene.
6. **Apply BENNE policy.** `applyCharacterAnimationClips` in [characterAnimationPlayback.ts](../src/engine/characterAnimationPlayback.ts) sets `repeat` from JSON `animations[tag].loop` (default: play once) and can force a uniform `frameDuration`. Character animations also get frame events.
7. **Play.** These rules are all format-neutral:
   - Characters use `<base><facing>` names with nearest-facing and mirror fallbacks ([directionalCharacterAnimation.ts](../src/engine/directionalCharacterAnimation.ts)).
   - Props have a saved base animation plus timed one-shots.
   - GUI controls use `tryApplyGuiSheetTag` in [buildGuiOverlay.ts](../src/engine/gui/buildGuiOverlay.ts), which plays the animation or falls back to a frame of that name.
   - Saved game state stores animation *names* (`room:<roomId>:prop:<propId>:animation`, `character:<id>:animation`, …).

A character can already avoid Aseprite with `display.defaultImage`, but then it gets one static image and no animation, through a separate spawn path.

### 1.3 Aseprite features BENNE relies on beyond named animations

| Feature | Used by | Truly Aseprite-only? |
|---|---|---|
| Per-frame durations | all animations, unless `frameDuration` overrides | No. GIF, WebP and APNG have them too. |
| Trim data (`trimmed`, `spriteSourceSize`, `sourceSize`) | prop `spritePlacement: "tight"`, GUI anchors ([asepriteFramePlacement.ts](../src/engine/aseprite/asepriteFramePlacement.ts)) | No. This is the standard atlas layout (§3.4). The helpers read Phaser `Frame` data, so only their names say "Aseprite". |
| `meta.slices` | `nineSliceImage` GUI controls ([guiNineSliceImage.ts](../src/engine/gui/guiNineSliceImage.ts)) | Yes. No other common format has named slices. |
| Full-canvas room layers | room props default to `canvas` placement at `(0, 0)` | No. This is a workflow: each prop is a room-sized layer. |

### 1.4 Who else reads Aseprite JSON

- **Generated handles.** `asepriteTags()` in [generateGameHandles.mjs](../scripts/lib/generateGameHandles.mjs) builds the typed animation unions in every `.ids.ts`.
- **Content validation.** [validate-game-content.mjs](../scripts/lib/validate-game-content.mjs) checks `meta.frameTags` ranges.
- **Editor extension.**
  - [gameDiscovery.ts](../benne-editor/src/gameDiscovery.ts) feeds the Inspector's tag dropdowns.
  - Prop and item tag families use [asepriteTagFamily.ts](../benne-editor/src/asepriteTagFamily.ts).
  - The import commands are in [characterScaffolding.ts](../benne-editor/src/characterScaffolding.ts) and [roomScaffolding.ts](../benne-editor/src/roomScaffolding.ts).
  - GUI and inventory scaffolding and both tree providers also read Aseprite JSON.
- **Previews.** [buildPreviewManifest.ts](../src/editor/preview/buildPreviewManifest.ts) fetches the JSON from disk, normalises and prefixes it again, and emits `kind: 'aseprite'` load entries. The character, GUI and inventory preview games each call `createFromAseprite` themselves.

Outside `src/game/boot/` and `src/engine/aseprite/`, over 500 lines in about 30 files mention Aseprite. Once animations exist, playback has nothing Aseprite-specific in it. The coupling is in finding the files, loading them, building animations, trim and slice metadata, and the tooling above.

## 2. What BENNE needs from any art source

1. **Images:** one or more image files.
2. **Frames:** where each frame sits in an image, with optional trim information.
3. **Animations:** named, ordered lists of frames, with a duration per frame. A single still image is a one-frame animation.
4. **Nine-slice borders:** only for GUI `nineSliceImage`.
5. **Animation names without decoding pixels**, from Node, because the handle generator, validator and editor run there.
6. **Two loading paths:** through Vite for the game, and from files on disk in a webview for the editor previews.

## 3. The art formats explained

Every format answers the same two questions: **where is each frame?** and **which frames make which animation, and how fast?** The formats differ in how much of that the files answer themselves and how much the author has to tell BENNE.

### 3.1 Aseprite export (supported today)

Aseprite's "Export Sprite Sheet" writes one PNG holding every frame and one JSON file describing it. The JSON is a standard atlas (§3.4) with three Aseprite additions: a `duration` on every frame, `meta.frameTags` (named frame ranges, which BENNE treats as animations), and `meta.slices` (named rectangles, which BENNE uses for nine-slice GUI art).

```jsonc
{
  "frames": {
    "hank 0.aseprite": { "frame": { "x": 0, "y": 0, "w": 32, "h": 48 }, "duration": 100, /* … */ },
    "hank 1.aseprite": { "frame": { "x": 32, "y": 0, "w": 32, "h": 48 }, "duration": 100 }
  },
  "meta": {
    "frameTags": [ { "name": "WalkL", "from": 0, "to": 7, "direction": "forward" } ],
    "slices": [ /* nine-slice rectangles for GUI sheets */ ]
  }
}
```

**The files answer both questions.** This is why BENNE started here.

### 3.2 PNG files ("images" format)

There is no sheet: each frame is its own PNG file, and file and folder names say which animation it belongs to. Every paint program can produce this, as can "export layers" in Krita, GIMP or Photoshop, and 3D or AI render pipelines.

```text
WalkL/01.png  WalkL/02.png  …  WalkL/08.png   → animation "WalkL", 8 frames
IdleD.png                                      → animation "IdleD", 1 frame
```

**Names come from the files; timing comes from BENNE JSON or a game-wide default.**

### 3.3 Grid sprite sheets

A grid sprite sheet is one PNG cut into **equal-sized cells**. There is no data file. The only thing that says where frames are is the cell size. Cells are numbered from 0, left to right and then top to bottom:

```text
          32px  32px  32px  32px
        ┌─────┬─────┬─────┬─────┐
  48px  │  0  │  1  │  2  │  3  │   row 0: walking down
        ├─────┼─────┼─────┼─────┤
  48px  │  4  │  5  │  6  │  7  │   row 1: walking left
        ├─────┼─────┼─────┼─────┤
  48px  │  8  │  9  │ 10  │ 11  │   row 2: walking right
        ├─────┼─────┼─────┼─────┤
  48px  │ 12  │ 13  │ 14  │ 15  │   row 3: walking up
        └─────┴─────┴─────┴─────┘
```

Some sheets have a **margin** (empty border around the whole sheet) or **spacing** (gap between cells). Those are two more numbers.

This is the most common format for art you **download** rather than draw: itch.io and OpenGameArt asset packs, the Liberated Pixel Cup (LPC) character generator (64×64 cells, one row per direction), RPG-Maker-style character sheets, and the sheet export of most pixel editors (Piskel, Pixelorama, Pyxel Edit, Aseprite itself with "By rows" and no JSON).

**The cell size answers "where"; the author answers "which frames make which animation"**, for example `"WalkL": { "frames": "4-7" }`. Pack authors usually document the rows in a readme or show them in a preview image.

Phaser loads grids natively (`load.spritesheet` with `frameWidth`, `frameHeight`, `margin` and `spacing`), so BENNE needs no image processing for this format, only those numbers.

### 3.4 Atlases (TexturePacker-style)

A **texture atlas** also puts many frames on one PNG, but frames don't share a size. A packing tool fits many separate images onto the sheet as tightly as it can, and writes a JSON file listing every frame by its **original file name** with its rectangle. Packers usually also **trim** transparent borders off each image and record how much they removed, so the engine can put the pixels back where they were on the original canvas:

```jsonc
{
  "frames": {
    "walk_L_0001.png": {
      "frame":            { "x": 2, "y": 2, "w": 18, "h": 40 },  // where the pixels are on the sheet
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 7, "y": 4, "w": 18, "h": 40 },  // where they sat on the original canvas
      "sourceSize":       { "w": 32, "h": 48 }                    // the original canvas size
    },
    "walk_L_0002.png": { /* … */ }
  },
  "meta": { "app": "https://www.codeandweb.com/texturepacker", "image": "hank.png", "size": { "w": 256, "h": 128 } }
}
```

That `frames` block has the same shape as Aseprite's (§3.1): Aseprite's export *is* an atlas, plus durations, tags and slices. Sometimes `frames` is an array with a `filename` field instead of an object (the "array" variant); the content is the same.

Tools that write this format include:
- TexturePacker (commercial);
- Free Texture Packer (free, open source);
- ShoeBox;
- the sprite-sheet exporters of many other engines and tools.

Atlases are what you get when art was drawn as separate files and then packed for performance, or when you bring art over from a project in another engine. Phaser loads them natively (`load.atlas`, `load.multiatlas` for several sheets).

**The JSON answers "where" (including trim); the frame names usually answer "which animation".** `walk_L_0001`, `walk_L_0002`, … obviously belong together, so BENNE can group frames by name with the trailing number removed. The author maps groups to BENNE names where they differ, and timing comes from BENNE JSON. Rotated frames (`"rotated": true`) are a packer option that BENNE would ask authors to turn off.

### 3.5 Animated GIF, WebP and APNG

One file holds one whole animation, with a delay per frame and a loop setting. Every tool can export at least GIF. GIF is limited to 256 colours with on/off transparency and has delays in 10 ms steps. WebP and APNG have full alpha.

**The file answers both questions.** The catch is that Phaser can't play them (WebGL shows only the first frame), and the browser API that gives scripts the frames (WebCodecs `ImageDecoder`) isn't in Safari ([MDN](https://developer.mozilla.org/docs/Web/API/ImageDecoder)). BENNE would decode them **at build time** instead (§5.6). To the author, a GIF is simply one more file type allowed in the "images" format.

### 3.6 Format summary

| Format | Files | "Where are the frames?" | "Which frames, how fast?" | Needs decoding? | Plan stage |
|---|---|---|---|---|---|
| Aseprite | `<id>.png` + `<id>.json` | JSON | JSON (tags, durations) | no | today (stage 0 refactor) |
| Images | PNG files and folders | one frame per file | file names; timing in BENNE JSON | no | 1 |
| Grid | `<id>.png` | cell size in BENNE JSON | frame numbers and timing in BENNE JSON | no | 2 |
| Atlas | `<id>.png` + `<id>.json` | JSON (with trim) | frame names, or BENNE JSON; timing in BENNE JSON | no | 2 |
| GIF / WebP / APNG | inside "images" | the file | the file | yes, at build time | 3 |
| Starling/Sparrow XML (Adobe Animate) | `<id>.png` + `<id>.xml` | XML | frame names | no | if asked |
| Layered `.ora` / PSD room composites | one file | layers | layer names | yes | later |
| Skeletal (Spine, DragonBones) | (n/a) | (n/a) | (n/a) | (n/a) | out of scope |

## 4. The author's experience

### 4.1 What stays the same whatever the format

- **Art lives in the same folders**: `src/game/assets/images/characters/<id>/`, `rooms/<roomId>/`, `guis/<id>/`, `inventory/<id>/`, `cursor/`.
- **Animations are referred to by name** everywhere: prop `tag`, `initialAnimation`, cursor `idleAnimation`, GUI button states, and scripts (`hank.play("Wave")`, `door.animation = "Door-open"`). The format decides only where the names come from.
- **Directional animations** keep the `<base><facing>` convention (`IdleL`, `WalkDR`) and the mirror fallback: ship `WalkL` and BENNE flips it for `WalkR`.
- **Animation settings stay in the content JSON** under `animations`: `loop`, `frameDuration`, frame `events`, plus two new fields that any format can use:
  - `frames`, to build an animation from frame numbers or names;
  - `frameDurations`, for per-frame timing.
- **Feet, collider, walk-to and talk points** are still in frame pixel space, measured from the top-left of the frame canvas.
- **Generated handles stay typed.** `hank.play(…)` autocompletes the names the format provides, and renaming an animation shows up as a TypeScript error in scripts and a validator error in JSON.
- **The editor works the same way.** The Inspector dropdowns and the character preview's Animation dropdown list the animations whatever the source format.

### 4.2 Using PNG files

#### A character

1. **Create the character** with the BENNE Editor's Create Character command and pick **PNG files** as the art format. The editor writes `characters/hank/hank.character.json` with:

   ```json
   "display": { "art": { "format": "images" } }
   ```

   It also creates the empty folder `assets/images/characters/hank/`.

2. **Drop in files.** A file is a one-frame animation. A folder of numbered files is a multi-frame animation, played in natural order (`2` before `10`). The name is the animation name:

   ```text
   assets/images/characters/hank/
     IdleD.png
     IdleL.png
     IdleU.png
     WalkD/01.png … WalkD/08.png
     WalkL/01.png … WalkL/08.png
     WalkU/01.png … WalkU/08.png
     TalkD/01.png … TalkD/04.png
     Wave/01.png … Wave/06.png
   ```

   **Every frame should use the same canvas size**: draw Hank in the same 32×48 box in every file and leave the transparent padding in. That keeps his feet in the same place from frame to frame, as an Aseprite canvas does. The validator warns when frames of one character differ in size. Files starting with `_` are ignored, for work-in-progress files.

3. **Set timing and looping where the default isn't right.** Without settings, each frame shows for `art.defaultFrameDuration` from `game-config.json` (for example 100 ms), and animations play once. The rest goes in the character JSON as it does today:

   ```json
   "animations": {
     "WalkL": { "loop": true, "frameDuration": 80 },
     "WalkD": { "loop": true, "frameDuration": 80 },
     "TalkD": { "loop": true },
     "Wave":  { "frameDurations": [100, 100, 100, 400, 100, 100] }
   }
   ```

4. **Check it** in the character preview: every file and folder appears in the Animation dropdown. Set the feet and collider there as you would today.

5. **Script it** exactly as with Aseprite: `hank.play("Wave")`, `hank.animation = "IdleD"`. No `WalkR` folder is needed, because BENNE mirrors `WalkL`.

Changing the art means saving a PNG. The editor regenerates handles and reloads previews as it does when an Aseprite export changes.

#### A room's props

Props work the same way: one file or folder per prop animation, named like today's Aseprite tags, including the `<root>-*` families the Inspector groups:

```text
assets/images/rooms/apartment/
  Couch.png
  Door.png
  Door-open.png
  Fan/01.png … Fan/04.png
```

The room JSON says `"art": { "format": "images" }` (rooms have no `display` block), and each prop's `tag` names a file. There are two ways to draw props, and both work:

- **Room-sized layers.** Every PNG is the size of the room and mostly transparent; paint each prop in place. This is what "export layers" produces in Krita, GIMP or Photoshop. No `x`/`y` is needed, the same as today's Aseprite room sheets.
- **Cropped images.** Each PNG holds just the prop, and the prop's `x`/`y` in the room JSON places its top-left corner, which the room preview can drag.

At typical BENNE resolutions room-sized layers cost little. For high-resolution rooms with many props, cropped images or the later atlas-packing step (§8) keep memory down.

#### GUI, inventory and cursor

- **GUI**: one file per button state, `Save.png`, `Save-hover.png`, `Save-pressed.png`, named in the control's `states` as today. A `nineSliceImage` takes its borders inline (`"nineSlice": { "left": 4, "right": 4, "top": 4, "bottom": 4 }`), because PNG files have no slices.
- **Inventory**: `assets/images/inventory/key/Key.png`, with the item's `defaultAnimation` defaulting to its id as today. A `KeyCursor.png` can be the item's `cursorAnimation`.
- **Cursor**: `assets/images/cursor/arrow.png`, `hand.png` and `wait/01.png …`, named by `idleAnimation`, `activeAnimation` and `busyAnimation` in `game-config.json`.

#### Animated GIF, WebP and APNG (stage 3)

Once stage 3 lands, a GIF, animated WebP or APNG file can stand in for any animation folder: drop `Wave.gif` next to `IdleD.png` and `Wave` is an animation with the GIF's own frame timing. `loop` and `frameDuration` in the JSON still override it. The decoding happens in the build step that already regenerates handles, so the author doesn't run anything.

### 4.3 Using Aseprite

**Nothing changes for existing projects.** Export as now: `hank.aseprite` → `hank.png` + `hank.json`, with frame tags, as a hash or array, with optional "Trim cels" and, for GUI sheets, slices. `"display": { "aseprite": true }` keeps working. New characters get the equivalent `"display": { "art": { "format": "aseprite" } }`, and the editor can rewrite the old form on request, but nothing forces it.

Tags are animations, Aseprite frame durations are the default timing, and `loop` / `frameDuration` in the JSON still override them. Tight prop placement, trimmed GUI anchors and slice-based nine-slice images all behave as today.

What Aseprite users gain:

- **Animations from untagged cels.** `"Blink": { "frames": [12, 13, 12] }` builds an animation without re-exporting with a new tag, and can repeat frames.
- **Inline nine-slice borders** as an alternative to drawing slices.
- **Neutral wording.** Editor messages and docs talk about "animations" and "art" instead of assuming Aseprite, which matters most for the people who don't use it.
- **Mixed teams.** One character can be an Aseprite export, another a folder of PNGs from a different artist, and a third a downloaded grid sheet, in the same game. Each art folder has one format, and the format can differ from one character, room, GUI or item to the next.

### 4.4 Using a grid sheet from an asset pack

You downloaded `knight.png` from an asset pack: 32×48 cells, rows for down, left, right and up, four frames each (the diagram in §3.3). Put it at `assets/images/characters/knight/knight.png` and tell BENNE the cell size and which cells make which animation:

```json
"display": { "art": { "format": "grid", "frameWidth": 32, "frameHeight": 48 } },
"animations": {
  "IdleD": { "frames": [0] },
  "IdleL": { "frames": [4] },
  "IdleU": { "frames": [12] },
  "WalkD": { "frames": "0-3",   "loop": true, "frameDuration": 120 },
  "WalkL": { "frames": "4-7",   "loop": true, "frameDuration": 120 },
  "WalkU": { "frames": "12-15", "loop": true, "frameDuration": 120 }
}
```

This pack ships a separate right-facing row (`8-11`). You can add `WalkR` for it, or leave it out and let BENNE mirror `WalkL`. Sheets with a border or gaps add `margin` and `spacing`. The character preview shows the sheet with cell numbers overlaid so you can pick frames without counting, and an "Add animation from cells" action could write the `frames` entry for you.

### 4.5 Using an atlas

You packed Hank's separate PNGs with Free Texture Packer, or brought an atlas over from another engine: `hank.png` + `hank.json` (§3.4). Put both in `assets/images/characters/hank/` and set:

```json
"display": { "art": { "format": "atlas" } }
```

BENNE groups frames by name: `WalkL_01.png` … `WalkL_08.png` becomes `WalkL`, and `IdleD.png` becomes `IdleD`. If the frames already follow BENNE's naming, that's all. When they don't (for example `walk_left_0001.png`), map them:

```json
"animations": {
  "WalkL": { "frames": "walk_left_*", "loop": true, "frameDuration": 80 }
}
```

Trimmed atlases keep working with tight prop placement and GUI anchors, because BENNE already handles trim data for Aseprite.

### 4.6 Changing format later

Animations are referred to by name, so a game can start with placeholder PNGs and move to Aseprite later, or the other way round. Re-export the art with the same animation names, change `format`, and the scripts, room JSON and save files don't notice. If a name changes, the generated handles and the validator point at every place that used the old one.

## 5. The design

### 5.1 The model

```ts
/** Format-neutral sprite data for one art folder (a character, a room's props, a GUI sheet, …). */
interface BenneSpriteSheet {
  /** Images to load: a packed sheet (atlas or Aseprite), a grid sheet, or single frame files. */
  textures: { id: string; path: string; kind: 'atlas' | 'grid' | 'image'; atlas?: AtlasJson; grid?: GridSpec }[];
  /** Named frames. `trim` carries spriteSourceSize/sourceSize when the source has it. */
  frames: Record<string, { texture: string; frame?: string | number; trim?: FrameTrim }>;
  /** Named animations in source order; the generated handle unions keep that order. */
  animations: Record<string, { frames: { frame: string; duration?: number }[] }>;
  /** Optional nine-slice borders per animation, from Aseprite slices or BENNE JSON. */
  nineSlice?: Record<string, { left: number; right: number; top: number; bottom: number }>;
}
```

Building the model is one step for every source:
1. Run the format's importer.
2. Merge the author's `animations` config: `frames` adds or replaces animations; `frameDurations`, `frameDuration` and `art.defaultFrameDuration` fill in timing.
3. Validate the result.

### 5.2 Importers

Importers are pure, dependency-free functions registered by format name:
- `aseprite(json)`;
- `atlas(json)`, which groups frames by name;
- `grid(spec)`;
- `images(fileList)`, which reads decoded-animation sidecars for GIF, WebP and APNG.

Each importer also has a cheap `listAnimations` path that reads only JSON and file names, never pixels; the handle generator, the validator and the editor use it. The Vite build, Node scripts, the editor host and the preview webview import the same module. This follows the precedent of [bennescriptTransform.mjs](../scripts/lib/bennescriptTransform.mjs) and its `.d.mts`.

### 5.3 Loading into Phaser

One adapter turns a model into loader calls and Phaser animations:
- **atlas and Aseprite:** `load.atlas` with a generated JSON-hash object, as `load.aseprite` takes an object today;
- **grids:** `load.spritesheet`;
- **single frame files:** `load.image` per file.

The adapter then calls `anims.create({ key, frames: [{ key, frame, duration }], repeat })`, or `sprite.anims.create` for characters, which replaces `createFromAseprite`. A Phaser animation can take frames from several textures, so the images format doesn't need packing.

Namespacing (`room:<roomId>:`, `gui:<guiId>:`, …) is applied once, to model animation names, which replaces the five `prefix…` functions. Texture keys become `art:<kind>:<id>` (plus a frame suffix for single files). They are internal and never saved.

### 5.4 Content JSON

```jsonc
"display": { "art": { "format": "aseprite" } }   // same as "aseprite": true
"display": { "art": { "format": "images" } }
"display": { "art": { "format": "grid", "frameWidth": 32, "frameHeight": 48, "margin": 0, "spacing": 0 } }
"display": { "art": { "format": "atlas" } }
```

- **Shorthand.** `"art": "images"` is allowed when there are no options.
- **Rooms.** Rooms take a top-level `"art"`, defaulting to Aseprite.
- **Cursor.** The cursor uses `game-config.json` `cursor.display.art`.
- **Aliases.** `display.aseprite: true`, `"shared"` and `cursor.display.aseprite` are normalised to the new form when content loads.

The animation config type (`CharacterAnimationClipConfig`, shared by characters, props, cursor and inventory, with a GUI equivalent) gains two fields:

- `frames`: an array of grid indices or frame names, or a shorthand string such as `"4-7"` (grid) or `"walk_left_*"` (atlas).
- `frameDurations`: per-frame timing in milliseconds.

`game-config.json` gains `art.defaultFrameDuration`.

### 5.5 Nine-slice

[guiNineSliceImage.ts](../src/engine/gui/guiNineSliceImage.ts) reads borders from the model's `nineSlice`. These come either from Aseprite slices, as today, or from a new inline `nineSlice` option on the control. The inline option works with every format.

### 5.6 Decoding animated files at build time

Add an art step to the pipeline that `generate:game-ids` already runs (dev, build and the editor run it automatically). For each GIF, animated WebP or APNG in an art folder, the step:

1. Decodes the file once, using `sharp`/libvips. Animated GIF and WebP come out as a vertical strip of frames with `pageHeight`, per-frame `delay` and `loop` ([libvips docs](https://www.libvips.org/API/8.17/multipage-and-animated-images.html)).
2. Writes the strip PNG and a small timing sidecar to a generated, gitignored folder that the asset globs include.
3. Caches the result by content hash.

The images importer then treats a decoded file as a one-animation grid strip with its own durations. The editor previews fetch the same generated files, so no browser ever decodes GIFs and Safari isn't a concern. `sharp` would become a devDependency of game projects; [scaffoldPayload.ts](../benne-editor/src/scaffoldPayload.ts) already adds `pngjs`.

## 6. What changes in the code

**Engine.**
- `src/engine/art/` holds the model, the importer registry and the Phaser adapter. `src/game/boot/` keeps only the Vite globs, a step towards the roadmap item "Remove the engine's dependency on `src/game/boot/`".
- `BootScene` and `queueRoomSceneAssetLoads` call `queueArtLoad` instead of `load.aseprite`.
- `ensureAsepriteAtlasAnimationsOnce`, `spawnRoomProps`, the cursor setup and `spawnAsepriteCharacter` call `createAnimationsFromModel`.
- `display.defaultImage` becomes a one-frame model, so characters have one spawn path instead of two.
- `asepriteFramePlacement.ts` is renamed `framePlacement.ts`; its logic is unchanged.
- `guiNineSliceImage.ts` reads borders from the model.

**Types and validation.**
- `CharacterDisplayData`, `GuiDisplayData`, `InventoryItemData.display`, `GameSettingsCursorDisplay`, `RoomData` and `CharacterAnimationClipConfig` change, and [ConfigManager.ts](../src/engine/ConfigManager.ts) validates them.
- The content validator checks each format: files exist, grid indices are in range, frame sizes are consistent within an images folder, and declared frames exist.

**Handle generator.** `asepriteTags()` becomes `listAnimations(kind, id, art)` through the shared importers.

**Editor.**
- One `resolveArt(kind, id)` replaces the `resolve…AsepriteSheet…` functions in `gameDiscovery.ts`, so the Inspector dropdowns work unchanged.
- The create commands ask for a format and detect files already present.
- "Import animations from Aseprite tags" becomes "Import animations".
- `asepriteTagFamily.ts` is renamed; its logic is already name-only.
- File watchers include `.png` / `.gif` / `.webp` in art folders.

**Previews.** `buildPreviewManifest.ts` builds models through the shared importers. The preview games use the engine adapter instead of calling `createFromAseprite`.

**Docs.**
- [core-concepts.md](public/core-concepts.md) and the other public guides.
- A new "Bringing your own art" guide covering §4.
- `architecture.md`.
- Generated comments such as "Animation tags on this room's Aseprite sheet".

## 7. Compatibility and risks

**Unchanged:** animation names, saved games, BenneScript, generated handle types and every existing `*.json` and Aseprite export.

**Risks:**

| Risk | Mitigation |
|---|---|
| Aseprite parity: per-frame durations, trim placement, slices, timing of `loop` one-shots | Stage 0 refactors Aseprite onto the model before any new format ships, gated on identical template playthroughs and byte-identical `.ids.ts` files |
| Images-format animations switch textures every frame; the character perspective render batch ([benneCharacterPerspectiveBatch.ts](../src/engine/rendering/benneCharacterPerspectiveBatch.ts)) and GUI trim helpers must handle that | Cover it in stage 1 tests; atlas packing (§8) is the fallback |
| Many small files mean many requests and textures at boot | Measure; pack at build time only if it matters (the roadmap's "measure first") |
| A native `sharp` dependency in game projects | Stage 3 only; pure-JS decoders cover GIF and APNG if needed (§10) |

## 8. Plan

Each stage ships on its own and leaves every game working. Sizes are relative.

**Stage 0: groundwork, no behaviour change (L).**
- Add the model, the importer registry, the Aseprite importer, the Phaser adapter and the shared `listAnimations`.
- Move the engine, previews, handle generator, validator and editor discovery onto them.
- Rename the placement helpers and fold `defaultImage` characters into the model.
- Done when the templates play and test unchanged (`test:unit`, `test:e2e`, `test:templates`, the playthroughs; see [testing.md](testing.md)), the generated `.ids.ts` files are byte-identical, and the previews look identical.

**Stage 1: PNG files (M).**
- Add `display.art` / `art` with aliases, the images importer, `frames` and `frameDurations` in animation config, `art.defaultFrameDuration`, inline `nineSlice`, and the frame-size validator check.
- In the editor, add a format choice on create and the format-neutral "Import animations".
- Write the "Bringing your own art" guide.
- Consider converting a small template character to PNG files as a living example.

**Stage 2: grids and atlases (S–M).**
- Add the grid and atlas importers, name grouping, and the `"4-7"` / `"walk_left_*"` shorthands.
- In the character preview, add the cell-number overlay for grids.

**Stage 3: animated GIF, WebP and APNG (M).**
- Add the build-time decode step with caching, wired into the existing generator runs.

**Later, if needed.**
- Pack images-format folders into one atlas at build time, if measurement shows a cost.
- Starling/Sparrow XML.
- Layered `.ora`/PSD room composites.
- An Aseprite live link (already on the [roadmap](roadmap.md)).

## 9. Alternatives considered

- **Convert every format to Aseprite JSON** with an importer script, and leave the engine alone. This is cheap, but every non-Aseprite asset exists twice (source and generated sheet). It also makes Aseprite's schema BENNE's internal format, and it keeps "aseprite" in every field name. Rejected because it works against the goal; it remains a possible stopgap.
- **A separate runtime loader per format**, with no shared model. Every format would need separate readers in the game, the handle generator, the validator and the editor, because those run in Node. Animated GIFs would be decoded in the browser, which fails in Safari. The good part, a registry of formats, is kept in §5.2 as importers.

## 10. Open questions

1. **Naming.** Is `display.art` with formats `aseprite` / `images` / `grid` / `atlas` right? Should docs say "animation" throughout and keep `tag` only as the existing prop field?
2. **Explicit or detected format?** This plan requires `format` and has the editor fill it in. The atlas and Aseprite JSON can be told apart by `meta.app`, so detection is possible, but explicit settings are easier to debug.
3. **Shorthand syntax** for `frames` (`"4-7"`, `"walk_left_*"`): worth it, or arrays only?
4. **Decode cache location.** Where should it live so that both Vite's asset globs and the preview fetch path see it? Should it be gitignored or committed?
5. **`sharp` or pure JS?** `sharp` covers GIF and WebP but is native; pure-JS decoders cover GIF and APNG but not animated WebP.
6. **Shared inventory sheet.** Does `"shared"` need its own format setting, perhaps once in `game-config.json`?
7. **Mixing within one folder.** This plan has one format per art folder, with images folders allowing PNG and GIF side by side. Should an Aseprite character also be able to take an extra PNG or GIF animation?
