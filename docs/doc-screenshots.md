# Screenshots in the website guides

The BENNE Editor and "Creating content" pages on the website (`website/guide/`) show screenshots of the editor running in VS Code. They were all taken the same way, so they look like one set. When a change to the editor alters what a screenshot shows, retake that screenshot the same way, using the tools in `scripts/doc-screenshots/` and the rules below.

## Taking screenshots

```sh
npm run package:extension:no-bump                 # only if benne-editor changed: the rig installs the newest VSIX
node scripts/doc-screenshots/rig.mjs start        # fresh 9-verb game, VS Code 1.140, 1600×1000 at 2×
node scripts/doc-screenshots/run.mjs -e "await c.select(['Apartment', 'Props', 'Couch']); await c.shot('look')"
# … look at $TMPDIR/benne-doc-shots/shots/look.png, adjust, repeat …
node scripts/doc-screenshots/rig.mjs stop
```

`rig.mjs start` builds a throwaway game folder from `game-templates/9-verb` (named `my-adventure`, which is what the title bar shows), installs the newest `benne-editor/*.vsix` into a fresh VS Code profile, and opens VS Code on its own display: a rootful Xwayland on `:97` under Wayland (sent to workspace 9 on Hyprland), or Xvfb otherwise. It never appears over the user's windows, so don't take screenshots of the desktop, and don't move or resize the user's windows. VS Code is muted, and the game's debug outlines are turned off. `start` always begins again from scratch: anything changed in the previous session is gone.

`run.mjs` runs a step against that VS Code, either inline (`-e`, with the client as `c`) or from a file whose default export is `async (c) => { … }`. The client is in `scripts/doc-screenshots/cdp.mjs`; its comments describe each helper. The ones you'll use most:

| Helper | Does |
|---|---|
| `c.setup()` | Shows the BENNE side bar at 350 px with only the tree open. `start` runs it. |
| `c.select(['Apartment', 'Props', 'Couch'])` | Expands the tree to a node and selects it, then waits for its preview, script and Inspector. |
| `c.panes({ BENNE: false, State: true })` | Expands or collapses the side bar's views. |
| `c.previewHeight(540)` | Sets the height of the top editor group (the preview). |
| `c.rowRect(label)`, `c.part('auxiliarybar')`, `c.rect(css)`, `c.groups()` | Where things are in the workbench. |
| `c.webviewRects(['text:Save', 'summary'])` | Where things are inside the Inspector, State view and previews, in workbench coordinates. |
| `c.click`, `c.drag`, `c.wheel`, `c.key`, `c.type`, `c.command(title)` | Input. |
| `c.annotate([...])`, `c.clearAnnotations()` | Callouts in the guides' style. |
| `c.shot(name, { x, y, w, h })` | Saves a PNG of the window or a crop of it. |

Coordinates are CSS pixels in the 1600×1000 window. Screenshots are twice that, and image viewers often scale them again, so **measure positions with the rect helpers, never by reading them off an image**. Clicks at positions read off an image land in the wrong place: one landed on the dialog Inspector's **Add option** and added an option to the JSON.

Then turn the PNG into lossless WebP, over the file it replaces:

```sh
magick shot.png -define webp:lossless=true -define webp:method=6 website/public/images/guides/room-prop.webp
```

Images for the BENNE Editor page are in `website/public/images/benne-editor/`; the rest are in `website/public/images/guides/`. If the crop's size changed, update the `:width` and `:height` on its `<DocShot>`: they are the crop's size in CSS pixels, half the PNG's. Check the pages with `npm run site:dev` (or `npm run site:build` for a build).

## Rules

**The game.** Always the 9-verb template as it ships, from `rig.mjs start`. Don't screenshot `src/game` or another game. Leave its content as it is, unless a screenshot needs something added; then say so in the caption or here, as the State view's `knocks` var is below.

**The window.** VS Code's default Dark Modern theme, 1600×1000 at 2×, the side bar at 350 px, the Inspector in the Secondary Side Bar, no minimap, sticky scroll or AI features (all set by the rig). Give the preview's editor group a height at which the whole room fits without a horizontal scrollbar: 540 for room previews, 566 for the overview and BENNE Play.

**Crops.** Crop to whole parts of the window: an editor group with its tab, the side bar, the Inspector, or several of them side by side. Don't cut through a control. Keep the mouse pointer out of the shot (`c.shot` moves it away). BENNE Play draws its own cursor where the pointer last was, so before a BENNE Play shot move the pointer onto a plain wall and pass `{ keepPointer: true }`.

**BENNE Play.** Tick **Mute** before pressing **Play**. No outlines: the rig turns off the template's `debug` settings, and the room preview's **Outlines** checkbox is shown only in screenshots about outlines, walkable areas or regions. On the hidden display BENNE Play runs at about one frame a second, so walking and speech take a while: poll with a shot every 10 to 20 seconds. Clicking a verb the first time may only focus the game; check the sentence line says "Talk to Penny" before waiting for the conversation.

**Callouts.** Use `c.annotate`, which draws the guides' style: a green (`#3dff6e`) outline with a dark halo, a numbered badge, and a short label in a pill. Number callouts in reading order. Give a callout a label when it fits inside the crop without covering what it points at; otherwise use a badge alone and explain the numbers with the `<DocShot>`'s `legend`, which draws matching green badges. Don't draw a green box over something already outlined in green, such as a region: use a label beside it. Use as few callouts as make the section clear; whole-window shots get a label per area. Remove the overlay (`c.clearAnnotations()`) after each shot.

**In the page.** Put each screenshot in a `<DocShot>` (`website/.vitepress/theme/components/DocShot.vue`) with an `alt` that says what the image shows, a short `caption`, and a `legend` when it has numbered badges. A screenshot taller than it is wide goes in a column beside its section's text, by wrapping that text in the `<DocShot>`. Don't put a screenshot between a sentence ending in a colon and the list or table it introduces. In attributes, write apostrophes as ’, not `&#39;`.

## The screenshots

Keep this list up to date: when you add, retake or remove a screenshot, change its row. Positions are CSS pixels in the 1600×1000 window, as they were when each was taken; measure again before reusing them. "Preview" is the top editor group.

### BENNE Editor (`website/guide/benne-editor.md`, `images/benne-editor/`)

| File | Section | Set-up | Crop | Callouts |
|---|---|---|---|---|
| `overview` | Overview | Apartment selected; all three side bar views open at their default heights; default editor split. | Whole window. | Labelled boxes 1–6: BENNE tree, Actions, State, Room preview, Room script, Inspector. |
| `tree` | The BENNE tree | Apartment and its Props expanded, Door selected; Actions and State collapsed. | Side bar, 880 tall. | 1 the filter and create buttons in the title bar; 2 a room's groups (Walkable areas to Regions); 3 the selected Door row. |
| `context` | Creating and changing content (also Creating a room §3) | Apartment selected, then right-clicked on its label. | The Apartment row and its menu; the preview's edge behind the menu's right side painted over with the side bar colour. | None. |
| `inspector` | Inspector | Door selected. | The Inspector, full height. | Badges and legend: 1 a ⚡ verb chip, 2 a + verb chip, 3 Save and Open raw JSON. |
| `script` | Writing scripts | Apartment selected; cursor after `items.` in `penny.onGiveItem(items.sammich, …)` (line 54, column 24), then Ctrl+Space. | The script's editor group. | 1 `Hank: \`Hey Penny!\`` and `Penny: \`Hi!\``; 2 the completion list. |
| `state` | State | State open, tree collapsed; a var `knocks` (num, default 0) added in the Vars table's last row; pointer over the first flag row to show its ✕ and ↗. | The State view, 330 tall. | Badges and legend: 1 ↗ and ✕, 2 the new flag row, 3 the var type menu. |
| `preview` | Previews | Door selected; Outlines ticked; preview 566. | The preview. | 1 Play from, Play and Mute; 2 GUIs, Characters and Outlines; 3 Save to JSON; 4 the door's collider and points. |
| `play` | BENNE Play | From the Apartment preview (566 tall): Mute, Play; Give Bread; Talk to Penny; taken while Penny says "Hi!". | The BENNE Play tab, with the room preview's tab beside it. | 1 the Inventory menu and Give button. |
| `actions` | Rebuilding preview bundles | Fresh start, nothing selected; Actions open, tree collapsed. | The Actions view's rows. | None. |

### Creating content (`website/guide/creating-*.md`, `images/guides/`)

| File | Page → section | Set-up | Crop | Callouts |
|---|---|---|---|---|
| `room-prop` | Room → Shaping a clickable prop | Couch selected; preview 540. | The preview. | Labels and legend: 1 the gizmo, 2 the hint line, 3 Save to JSON. |
| `room-walkable` | Room → 4. walkable areas | `walk-1`, then its `hole-1`, selected; Outlines ticked. | Side bar and preview (x 48, w 1252). | 1 the `walk-1` and `hole-1` rows; labels 2 "Walkable area (green)" and 3 "Hole, selected". |
| `room-hotspot` | Room → 5. hotspots | `window` hotspot selected; Outlines off. | Preview and Inspector (x 403, w 1193, h 540). | 1 the orange polygon; 2 the Active checkbox. |
| `room-region` | Room → 7. regions | `darkness` region selected. | The preview. | A label beside the green polygon, no box. |
| `room-region-inspector` | Room → 7. regions (side column) | As above. | The Inspector's scale, tint and script rows. | Badges and legend: 1 scale, 2 tint, 3 onEnter and onExit. |
| `room-character` | Room → 8. characters | Apartment → Characters → `penny`; the Inspector scrolled down to her placement fields. | Preview and Inspector. | 1 the gizmo at her feet; 2 her placement fields. |
| `room-size` | Room → 9. size and scrolling | Outside selected; Room size's **Edit in Preview** clicked. | Preview and Inspector. | 1 the resize handles; 2 Room size; 3 Scroll bounds. |
| `room-hooks` | Room → 11. Test it (side column) | Apartment selected. | Top of the Inspector, 300 tall. | Badges and legend: 1 the room hooks, 2 the Play From chips. |
| `character-preview` | Character → 4. feet, walk-to point, talk point and collider | Hank selected; preview 640; zoomed in with the wheel on Hank. | Preview and Inspector, 620 tall. | Badges and legend: 1 Animation menu, 2 collider, 3 walkToPoint, talkPoint and feet, 4 speech colour. |
| `character-animations` | Character → 3. import the animations (side column) | Hank selected; Inspector scrolled to Animations, WalkL expanded. | The Animations section. | Badges and legend: 1 Import, 2 loop and frameDuration. |
| `inventory-item` | Inventory item → 3. set it up | PB selected; preview 400. | Preview, script and Inspector (h 864). | Labels and legend: 1 the icon, 2 the script tab, 3 the ⚡ open chip, 4 the two animations. |
| `inventory-play` | Inventory item → 4. give it to the player | BENNE Play from the Apartment (Mute); Give Bread. | The BENNE Play webview (x 410, y 66, w 872, h 546). | 1 the inventory panel; 2 the Inventory menu and Give button. |
| `dialog` | Dialog → 2. write the options | ChatWithPenny selected; its `door` option expanded (click the option's row, not Add option). | Script and Inspector (h 820). | Badges and legend 1–6: Add option, text, enabled, say line, Script…, the `door` handler. |
| `dialog-play` | Dialog → How it looks | BENNE Play; Talk to Penny; wait for the choices. | As `inventory-play`. | 1 the list of options. |
| `gui` | GUI → GUI settings | Game Menu selected (its controls show in the tree); preview 540. | Side bar, editors and Inspector (x 48, w 1548, h 724). | Badges and legend 1–5: controls in the tree, preview, visible/modal/zIndex, GUI handler chips, a control handler in the script. |
| `gui-control` | GUI → Arranging controls | Game Menu → `button (resume)` selected. | Preview, script and Inspector (h 882). | Badges and legend 1–5: gizmo, text and font, position and size, grid placement, On Click. |
