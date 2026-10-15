---
title: Creating a Room
outline: deep
---

# Creating a Room

A **room** is one scene of your game: the apartment, the street outside, the park down the road. Most of what the player does happens in a room, so a room brings a lot together: its art, where characters can walk, the things the player can click, the characters who are there, and a script that says what happens.

This page builds a room from nothing, in the order you would usually work. The examples come from the 9-verb template, whose apartment and street you can open alongside.

| Part | What it is | In scripts |
|---|---|---|
| [Props](#3-add-the-props) | Pieces of the room's art: the background, furniture, a door that opens, a knife you can pick up | `door`, `knife` |
| [Walkable areas](#4-mark-where-characters-can-walk) | Polygons of floor that characters can walk on, with holes for obstacles | `walkables.walk1` |
| [Hotspots](#5-add-hotspots) | Clickable shapes with no art of their own: a window, a sign, an exit | `windowHotspot` |
| [Points](#6-add-points) | Named spots: where the player appears, where someone walks to | `points.enterFromDoor` |
| [Regions](#7-add-regions) | Areas of floor that react to characters: triggers, perspective scaling, shadows | `regions.darkness` |
| [Characters](#8-put-characters-in-the-room) | Characters placed in the room, including the player | `hank`, `penny` |

## 1. Create the room

In the BENNE tree, right-click **Rooms** and choose **Create New Room**. The same command is in the BENNE view's title bar and, as **BENNE: Create New Room**, in the Command Palette. You are asked for two things:

- A **display name**, such as `Kitchen`. It is shown in the BENNE tree.
- An **id**, such as `kitchen`. It names the folder and files, and in scripts the room becomes `rooms.kitchen`.

The editor creates:

```text
src/game/rooms/kitchen/kitchen.room.json   ← what's in the room
src/game/rooms/kitchen/kitchen.room.ts     ← what happens in it
src/game/assets/images/rooms/kitchen/      ← where its art goes
```

and adds the room to `src/game/rooms/rooms.manifest.json`. The new room is the size of your game's resolution and empty. Selecting it in the tree opens its live preview with the room script underneath, and its settings in the Inspector.

The game starts in the room named by `startingRoomId` in `game-config.json`.

## 2. Draw the room

All of a room's art lives in one Aseprite file: `src/game/assets/images/rooms/kitchen/kitchen.aseprite`, exported next to it as `kitchen.png` and `kitchen.json`.

A room's sheet is organised like this:

- **The canvas is the size of the room.** For a single-screen room in a 352×198 game, that's 352×198. A scrolling room is wider or taller.
- **Each tag is a prop.** A prop is any piece of the room that BENNE draws, shows, hides or animates on its own. Draw each prop on its own frame, in place on the full-size canvas, and tag that frame with the prop's name.
- **An animated prop is a tag that spans several frames.** The apartment's ceiling fan is the `Fan` tag over five frames.
- **Other looks of a prop are more tags named after it.** The apartment door is `Door` (closed) and `Door-open`.
- **Frames without a tag aren't used** by the game.

The 9-verb apartment's sheet has the tags `BG`, `Couch`, `Door`, `Door-open`, `Pillar`, `Fan`, `Table`, `Bread`, `PeanutButter` and `Knife`. Layers are yours to organise however you like; the export flattens each frame.

### Exporting from Aseprite

Rooms, characters, inventory items, GUIs and the cursor all use the same export:

1. In Aseprite, choose **File → Export Sprite Sheet**.
2. On the **Output** tab, tick **Output File** and **JSON Data**, and save them next to the `.aseprite` file with the same name (`kitchen.png`, `kitchen.json`).
3. Choose **Hash** for the JSON format, and tick **Tags** under **Meta**. Tick **Slices** too for GUI sheets that use nine-slice images.

Re-export whenever you change the art: the game and the previews use the exported files, not the `.aseprite` file.

## 3. Add the props

Right-click the room in the BENNE tree and choose **Import Props from Aseprite Tags**. BENNE reads the tags on the room's sheet and asks how to import them:

- **Grouped by base tag (recommended)** makes one prop per thing, with all its looks: `Door` and `Door-open` become a single prop `Door` that can switch between the two.
- **Legacy: one prop per tag** makes a separate prop for every tag you pick.

Then pick the tags, and say whether the new props should be clickable. You can import again later, after adding tags to the sheet; tags that are already props are marked.

<DocShot src="/images/benne-editor/context.webp" alt="The right-click menu on a room: Play from here, then Add Hole, Hotspot, Play From method, Point, Prop, Region, Spawned Character and Walkable Area, Import Props from Aseprite Tags, Open Assets Folder, and Delete." :width="368" :height="342" caption="Right-clicking a room. The steps below all start here." />

**Add Prop** adds one prop at a time instead: you give it the Aseprite tag, an id and whether it is clickable.

Select a prop in the tree to edit it in the Inspector and the preview. Its settings:

| Setting | What it does |
|---|---|
| `tag` | The animation the prop starts with. |
| `animations` | Its other tags, each with optional `loop` and `frameDuration` (milliseconds per frame). The fan's `Fan` tag has `"loop": true`. |
| `zIndex` | Drawing order among props. Higher numbers are drawn in front. |
| `baseline` | A horizontal line for walking around the prop. Characters whose feet are below the line are drawn in front of the prop, and behind it above the line. |
| `visible`, `alpha` | Whether it starts visible, and its opacity (0 to 1). |
| `clickable` | Whether the player can point at it and click it. |
| `collider` | The clickable shape. A clickable prop needs one. |
| `walkToPoint`, `lookAtPoint` | Where the player stands to use the prop, and the point they turn to face. `walkToClicked()` uses both. |
| `description` | The prop's name on screen: "Look at **couch**". |
| `defaultVerb` | The verb a "default verb" click does on it. See [Verbs](./verbs#default-verbs). |
| `activeCursorOverride` | A cursor animation to show while the pointer is over it. |
| `parallaxDepth` | For scrolling rooms. Below 1, the prop scrolls slower than the camera and looks far away; above 1, faster, like foreground. The street's sky is 0.75 and its trees 0.9. |
| `x`, `y` | Moves the art away from where it was drawn on the canvas. |

### Shaping a clickable prop

When you select a clickable prop, the preview shows:

- a **magenta** polygon: the collider, the shape the player clicks;
- a **cyan** handle: *Walk to*, where the player stands;
- an **amber** handle: *Look at*, what the player faces;
- a **red and green** gizmo that moves the whole prop.

<DocShot src="/images/guides/room-prop.webp" alt="The apartment couch selected in the room preview: a magenta collider around it, cyan Walk to and amber Look at handles in front of it, the red and green gizmo at its top-left corner, and the toolbar with Save to JSON and a hint line." :width="896" :height="540" caption="The couch selected. Its magenta collider, cyan walk-to point and amber look-at point are ready to drag." legend="The gizmo moves the whole prop.|The hint line says what you can do with the selection.|Nothing is written to the room until you click Save to JSON." />

To draw a new collider, click three times to place the first points. Double-click an edge to add a point, drag points to reshape it, and press **Delete** to remove the selected point. When you're happy, click **Save to JSON** in the preview's toolbar. Nothing is written to the room until you save.

A prop that isn't clickable shows only its **baseline**, a cyan line you drag up or down.

::: info Depth: zIndex and baseline
Props are stacked by `zIndex`. Characters walk among them: a character is drawn in front of a prop when their feet are lower on the screen than the prop's `baseline`. Give a table a baseline along its front edge, and the player walks behind it at the back and in front of it at the front. A prop with no baseline is ordered by `zIndex` alone, so a background (`BG`, `zIndex` 0) stays behind everything.
:::

## 4. Mark where characters can walk

Right-click the room and choose **Add Walkable Area**. Select it under **Walkable areas** in the tree, click three times in the preview to place the first points, then double-click edges to add more and drag points to fit the floor. **Save to JSON** when you're done.

Trace the floor where characters' feet can go, not the whole visible floor: feet near the back wall should stop short of it. Characters can't walk outside a walkable area. A click outside one walks the player as close as they can get.

**Holes** cut obstacles out of a walkable area. Right-click a walkable area and choose **Add Hole**, then shape it the same way. The street outside the apartment has two holes, around the fountain and the rock, and the apartment one around its table.

<DocShot src="/images/guides/room-walkable.webp" alt="The apartment’s walk-1 walkable area and its hole-1 in the BENNE tree, and in the preview the walkable area outlined in green around the floor with the hole around the table selected for editing." :width="1252" :height="540" caption="The apartment’s floor (green, with Outlines on) and the hole around its table, selected for editing." />

A room can have several walkable areas, and scripts can switch them on and off: `walkables.walk1.active = false`.

## 5. Add hotspots

A **hotspot** is a clickable shape with no art of its own, for things painted into the background: a window, a sign, a crack in the wall, the edge of the screen that leads somewhere else. Right-click the room, choose **Add Hotspot** and give it an id. In the preview, a hotspot is an **orange** polygon with the same *Walk to* and *Look at* handles as a prop, edited the same way.

<DocShot src="/images/guides/room-hotspot.webp" alt="The apartment window hotspot selected: an orange polygon over the painted window with Walk to and Look at handles, and the Inspector showing its Active checkbox, zIndex, baseline, description and default verb." :width="1193" :height="540" caption="The apartment’s window hotspot, and its settings in the Inspector." />

Hotspots have a `description`, `defaultVerb`, `zIndex`, `baseline` and `activeCursorOverride` like props, and an `active` switch instead of `visible`: `windowHotspot.active = false` stops the window being clickable.

**Prop or hotspot?** Use a prop when the thing changes on screen: it disappears when picked up, opens, or animates. Use a hotspot when it is part of the painted background and stays the same.

::: tip When a name is taken
The apartment's window hotspot has the id `window`, but `window` is also a browser global, so its JSON has `"scriptName": "windowHotspot"` and scripts call it `windowHotspot`. Anything in a room can have a `scriptName` when its generated name clashes or reads badly.
:::

## 6. Add points

A **point** is a named spot in the room for scripts: where the player appears when they come in through each door, or where a character walks to. Right-click the room, choose **Add Point**, drag it into place with the gizmo and **Save to JSON**.

The street outside the apartment has `enter-from-door` and `henry-fountain`. In its script they are `points.enterFromDoor` and `points.henryFountain`:

```ts
room.onEnter(() => {
  player.moveTo(points.enterFromDoor)
  player.face('R')
})
```

## 7. Add regions

<DocShot src="/images/guides/room-region.webp" alt="The apartment’s darkness region selected in the room preview: a green four-point polygon on the floor around Hank, by the door." :width="896" :height="540" caption="The apartment’s `darkness` region, which darkens anyone standing by the door." />

A **region** is a polygon on the floor that does something when characters stand in it. Right-click the room, choose **Add Region**, and shape it in the preview (a **green** polygon). One region can do any of these:

<DocShot src="/images/guides/room-region-inspector.webp" alt="The darkness region in the Inspector: Active and Walkable checkboxes, Scale, Scale top, Scale bottom and Scale walk speed, Tint, Character tint set to black and Tint alpha 0.75, and onEnter and onExit script chips." :width="270" :height="404" legend="Perspective scaling.|Tint: black at 0.75 for `darkness`.|⚡ jumps to a handler, + adds one.">

**Run script when someone walks in or out.** The Inspector's **onEnter** and **onExit** chips add the handlers to the room script:

```ts
regions.darkness.onEnter(() => {
  Hank: `It's dark over here.`
})
```

Regions fire for every character, so check who it was when it matters: `regions.distance.onEnter((who) => { if (who.isPlayer) music.halloweenSpooky.play() })`.

**Scale characters for perspective**, so they shrink as they walk away from the camera. Turn on `scaleEnabled` and set `scaleTop` and `scaleBottom`: the size at the region's top and bottom edges, where 1 is full size. The street's `distance` region goes from 0 at the top to 1 at the bottom, and `perspective.minWalkScale` in `game-config.json` keeps characters from shrinking to nothing. `scaleWalkSpeed` slows characters down as they shrink.

**Tint characters**, for shadows or coloured light. Turn on `tintEnabled` and set a `tint` colour and `tintAlpha` (strength, 0 to 1). The apartment's `darkness` region darkens anyone in it with black at 0.75.

**Block walking** with `"walkable": false`, which treats the region as a hole in the floor.

</DocShot>

A region can be switched off from a script: `regions.darkness.active = false`.

## 8. Put characters in the room

Right-click the room, choose **Add Spawned Character** and pick a character (see [Creating a character](./creating-a-character)). Drag the gizmo at their feet to place them and **Save to JSON**. In the Inspector you can set which way they face at the start (`initialFacing`), their starting animation, whether they are visible, and their `zIndex`.

::: warning Place the player in every room they walk around in
The player character only appears in a room that places them. Add your player to every room where they walk around; a title screen or credits room doesn't need them. Scripts then move the player to the right spot as they come in, with `player.moveTo(points.x)` in `room.onEnter`.
:::

A character placed in a room is a plain name in its script (`penny`). You can hide one until they're needed (`"visible": false` in the room, then `penny.show()`).

<DocShot src="/images/guides/room-character.webp" alt="Penny selected in the apartment’s room preview with a red and green gizmo at her feet, and the Inspector showing her placement: X 60, Y 135, Visible, Clickable, zIndex 42, Facing R and Animation Idle." :width="1193" :height="540" caption="Penny as placed in the apartment. Each room she is in has its own copy of these settings." />

## 9. Size and scrolling

A room larger than the game's resolution scrolls, and the camera follows the player. The street outside is 600 pixels wide in a 352-pixel-wide game.

Select the room and set its **Room size** in the Inspector, or click **Edit in Preview** and drag the cyan handles. **Scroll bounds** limit where the camera can go inside the room (orange handles), which is useful when the edges of the art are only there to look good. Characters can still walk beyond the scroll bounds. Press **F** in the preview to fit the room back into view.

<DocShot src="/images/guides/room-size.webp" alt="The street outside in the room preview after Edit in Preview: the 600-pixel-wide room outlined in cyan with yellow handles on its right and bottom edges, and the Inspector’s Room size and Scroll bounds fields." :width="1193" :height="540" caption="Resizing the street outside, which is 600 pixels wide in a 352-pixel-wide game." />

For a sense of depth in a scrolling room, give distant props a `parallaxDepth` below 1 (see [props](#3-add-the-props)).

## 10. Script the room

The room's script, `kitchen.room.ts`, says what happens in it: what each verb does on each thing, what happens as the player comes in, and when they leave. You don't register anything; you write handlers at the top level of the file, using the room's things by name.

The two 9-verb rooms are connected by a door. In the apartment:

```ts
// apartment.room.ts
door.on(['open', 'use'], () => {
  walkToClicked()
  if (flags.unlockedDoor) {
    door.animation = 'Door-open'
    sfx.doorOpen.playAndWait()
    rooms.outside.goTo()
  } else {
    Hank: `The door is locked.`
  }
})

door.onUseItem(items.key, () => {
  walkToClicked()
  flags.unlockedDoor = true
  inventory.remove(items.key)
  Player: `The door is unlocked.`
})
```

And on the street, where the player arrives:

```ts
// outside.room.ts
room.onEnter(() => {               // before the fade-in: set the scene up
  player.moveTo(points.enterFromDoor)
  player.face('R')
})

room.onEnterAfterFade(() => {      // after the fade-in: things the player sees happen
  sfx.doorClose.play()
  if (room.isFirstVisit) {
    Henry: `Hey, Hank!`
    Henry: `Come here!`
    player.walkTo(henry)
  }
})

door.on(['open', 'use'], () => {
  walkToClicked()
  rooms.apartment.goTo()
})
```

Selecting a prop, hotspot or character shows its [verb chips](./verbs#verbs-in-the-editor) in the Inspector: click a **+** chip to add a handler for that verb to the room script. [BenneScript](./bennescript#rooms) covers the room hooks in full, and [Verbs](./verbs) covers handlers.

## 11. Test it

The preview's top bar has **Play** and **Play from** on the left:

- **Play** starts the whole game in BENNE Play, from the starting room.
- **Play from** starts the game in this room, optionally from a prepared state.

<DocShot src="/images/guides/room-hooks.webp" alt="The top of the apartment’s Inspector: chips for room.onLoaded, room.onEnter, room.onEnterAfterFade and onUpdate, then playFrom(’gotKey’), playFrom(’doorUnlocked’) and + playFrom." :width="292" :height="300" legend="The room’s hooks.|Its Play From setups, and + playFrom to add one.">

A **Play From** setup gets a room into the state you want to test, such as "the player already has the key", without playing up to it. Click **+ playFrom** in the room's Inspector (or right-click the room and choose **Add Play From method**), name it, and fill in the setup in the room script:

```ts
playFrom('gotKey', () => {
  inventory.add(items.key)
})

playFrom('doorUnlocked', () => {
  flags.unlockedDoor = true
})
```

Each one appears in the **Play from** menu. On the right of the top bar, the **Outlines** checkbox shows the walkable areas, regions and colliders while you play, and **GUIs** and **Characters** hide those layers in the preview. These only change the preview, never the room.

</DocShot>

## Checklist

- The room's sheet is exported to `assets/images/rooms/<id>/` as `<id>.png` and `<id>.json`, with tags.
- Props are imported, with sensible `zIndex` values and baselines on anything characters walk around.
- Clickable props and hotspots have a collider or polygon, a walk-to point, a look-at point and a description.
- The floor has a walkable area, with holes for obstacles.
- The player character is placed in the room, and `onEnter` moves them to the right spot for each way in.
- Every exit has a handler that calls `rooms.x.goTo()`.
- A Play From setup exists for each puzzle in the room.
