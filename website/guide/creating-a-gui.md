---
title: Creating a GUI
outline: deep
---

# Creating a GUI

A **GUI** is anything drawn over the room that isn't part of it: the verb bar, the inventory, the save menu, the box narration appears in, the list of dialog choices, a title card. Each GUI is a layer of **controls** (text, images, buttons, sliders, an inventory panel and more) described in JSON, with a script that says what the controls do.

The templates come with a complete set, so most games start by restyling those rather than building from nothing:

| GUI | What it does |
|---|---|
| `verbs` | 9-verb: the verb buttons, the inventory panel and the sentence line. See [Verbs](./verbs#verb-bars-and-the-verb-line). |
| `inventoryBar`, `menu-bar`, `hover-text` | 2-click: an inventory bar and a menu button that slide down from the top of the screen, and the name of whatever is under the pointer. |
| `game-menu`, `save-menu`, `load-menu`, `settings-menu` | The in-game menus. |
| `speaking-text` | Shows characters' lines of dialogue. |
| `display-text` | Shows narration from `display("…")`. |
| `dialog` | Shows the choices in a [dialog](./creating-a-dialog). |

::: warning Three GUIs belong to the engine
`speaking-text`, `display-text` and `dialog` are shown and hidden by the engine for speech, narration and conversations. Restyle them as much as you like (fonts, colours, art, positions), but keep their ids and the ids of their controls, which the engine looks for.
:::

## 1. Create the GUI

In the BENNE tree, right-click **GUIs** and choose **Create GUI** (also in the BENNE view's title bar and the Command Palette). Give it a display name and an id, such as `inventory-screen`. The editor creates:

```text
src/game/guis/inventory-screen/inventory-screen.gui.json   ← its controls
src/game/guis/inventory-screen/inventory-screen.gui.ts     ← what they do
src/game/assets/images/guis/inventory-screen/              ← where its art goes
```

In scripts the GUI is `guis.inventoryScreen`. A new GUI is visible from the start; untick **visible** in the Inspector for menus and other GUIs that should only appear when a script shows them.

## 2. Draw its art

A GUI's art is one Aseprite file, `assets/images/guis/<id>/<id>.aseprite`, exported as `<id>.png` and `<id>.json` (see [Exporting from Aseprite](./creating-a-room#exporting-from-aseprite)). Tag each image the GUI uses: a panel background, each button's normal, hover, pressed and disabled looks, a slider's track and handle.

For panels that stretch to any size, draw the panel once and mark its nine parts (four corners, four edges and the middle) with **slices** in Aseprite, then tick **Slices** when exporting. A **9-slice image** control draws those parts at whatever size it is given. The template menus are drawn this way.

GUI art is optional. Text, and buttons with a plain `backgroundColor`, need no sheet at all.

## 3. Add controls

Right-click the GUI in the tree and choose **Add GUI Control**, or click **Add Control** in the Inspector. Pick a type and give the control an id; the id is the control's name in the script, so give anything a script touches a clear one, like `saveBtn` or `musicVolume`.

### Controls

| Control | What it is | Key settings |
|---|---|---|
| **Text** | A line or block of bitmap text. | `text`, `font`, `fontSize`, `color`, `align`, `wordWrapWidth`, `textOutline` |
| **Image** | A tag from the GUI's sheet. | `tag`, `backgroundAnchor` |
| **9-slice image** | A panel that stretches to any size. | `tag`, `width`, `height`, `sliceNames` |
| **Button** | Something to click, with a label and per-state looks. | `width`, `height`, `text`, `font`, `backgroundTag`, `states` (`hover`, `pressed`, `disabled` tags), or `backgroundColor` and `backgroundColorStates`; `textColorStates` |
| **Checkbox** | On or off. | `tag`, `states`, `checked` |
| **Slider** | A value in a range, such as a volume. | `trackTag`, `handleTag`, `min`, `max`, `step`, `defaultValue` |
| **Text Input** | Somewhere to type, such as a save name. | `width`, `height`, font settings |
| **List Box** | A scrolling list to pick from, such as save slots. | `width`, `height`, row and font settings |
| **Inventory Panel** | A grid that shows the player's items and fills itself as they change. | `rows`, `cols`, `slotWidth`, `slotHeight`, `spacingX`, `spacingY`, `backButton` and `forwardButton` (ids of buttons that scroll it), `slotBackgroundTag`, `highlightTag` |
| **Trigger** | An invisible rectangle that reacts to the pointer entering and leaving. | `width`, `height` |
| **Grid** | An invisible layout of rows and columns that other controls sit in. | `rows`, `columns`, `rowHeights`, `colWidths` |

Every control has `x`, `y`, `visible` and `zIndex` (the order within the GUI, higher in front).

### Arranging controls

Select a control in the tree to edit it in the Inspector and drag it in the **GUI preview**, which renders the GUI exactly as the game will. Positions are in game pixels, from the top-left of the screen.

For tidy menus, add a **Grid** and place controls in its cells: give a control a `gridPlacement` naming the grid, a row, a column and an alignment (such as `center` or `center-left`). The template game menu is a one-column grid with a title and five buttons.

### GUI settings

Select the GUI itself to set:

| Setting | What it does |
|---|---|
| `visible` | Whether the GUI is showing when a room loads. |
| `modal` | While the GUI is showing, clicks can't reach the room or any GUI behind it. Use it for menus. |
| `zIndex` | Order among GUIs: higher is in front. The template menus are 100 and above. |
| `x`, `y` | Where the whole GUI starts. A bar can start off screen (`"y": -34`) and slide in from a script. |
| `fixedControls` | Ids of controls that stay put when a script moves the whole GUI. |

## Text and fonts

All text in BENNE is drawn with **bitmap fonts**, so it stays pixel-sharp at any scale. The templates include several retro fonts, among them a LucasArts SCUMM-style font (`lucasarts-scumm-solid`), `lucasfont-alternate`, a Sierra menu font (`sierra-sci-menu-font`) and `PressStart2P-Regular`.

Fonts live in `src/game/assets/fonts/`, listed in `fonts.json`. Each entry's key is the name a control's `font` uses:

```json
{
  "lucasarts-scumm-solid": {
    "textureFile": "lucasarts-scumm-solid_0.png",
    "dataFile": "lucasarts-scumm-solid.xml"
  }
}
```

To add a font, convert it to a bitmap font (a PNG of its letters and an AngelCode BMFont `.xml` file) and add an entry. The templates' fonts folder includes the BMFont settings they were made with, `BENNE bitmap font export.bmfc`.

A `textOutline` draws an outline behind text, which keeps it readable over busy room art. The 2-click hover text uses one.

## 4. Script the GUI

A GUI's script uses its controls by their plain names:

```ts
// guis/game-menu/game-menu.gui.ts
import { guis } from '@game'
import { gui, load, resume, save, settingsBtn } from './game-menu.ids'

resume.onClick(() => gui.hide())

settingsBtn.onClick(() => {
  guis.settingsMenu.show()
  gui.hide()
})

save.onClick(() => {
  guis.saveMenu.show()
  gui.hide()
})

load.onClick(() => {
  guis.loadMenu.show()
  gui.hide()
})
```

(The settings button is `settingsBtn` because `settings` is already a BenneScript name; its JSON has `"scriptName": "settingsBtn"`.)

Other scripts reach a GUI through `guis`: the verb bar's menu button runs `guis.gameMenu.show()`.

Sliders, checkboxes and text inputs report changes as they happen. The settings menu connects its controls to the player's settings:

```ts
// guis/settings-menu/settings-menu.gui.ts
gui.onBuilt(() => {
  sfxVolume.value = settings.sfxVolume * 100
  musicVolume.value = settings.musicVolume * 100
})

sfxVolume.onChange((v: number) => {
  settings.sfxVolume = v / 100
})

musicVolume.onChange((v: number) => {
  settings.musicVolume = v / 100
})
```

| Control | Read and set | Handlers |
|---|---|---|
| Any | `visible`, `alpha`, `x`, `y`, `fadeTo(…)`, `tweenTo(…)` | `onMouseEnter`, `onMouseLeave` |
| Text | `text` | |
| Button | `enabled`, `visualState` | `onClick` |
| Slider | `value` | `onChange((value) => …)` |
| Checkbox | `checked`, `enabled` | `onChange((checked) => …)` |
| Text input | `text`, `enabled`, `focused` | `onChange((text) => …)`, `onSubmit((text) => …)` |
| List box | `selectedIndex`, `setRowText(i, text)`, `rowCount` | `onSelect((i) => …)`, `onActivate((i) => …)` |

The GUI itself has `show()`, `hide()`, `visible`, `fadeIn()`, `fadeOut()`, and the handlers `onBuilt` (each time a room builds it), `onShow`, `onHide` and `onAnyClick`. The Inspector adds handlers for you: select a button and click **On Click**, or a slider, checkbox or text input and click **On Change**, to add its handler (or jump to it), and the GUI's own chips do the same for `onBuilt`, `onShow` and `onHide`.

GUI handlers keep working during cutscenes and while the player character is busy, so a menu can always be opened.

## Patterns

### A menu over the game

Set `visible` off, `modal` on and a high `zIndex`. Show it from a button (`menuBtn.onClick(() => guis.gameMenu.show())`) and hide it from its own **Resume** button. Because it is modal, clicks can't reach the room while it is open.

To keep a button for desktop builds only, set its visibility as the menu opens:

```ts
gui.onShow(() => {
  quit.visible = game.isDesktop
})

quit.onClick(() => game.quit())
```

### A bar that slides in

The 2-click template's menu bar sits mostly off screen (`"y": -17`) and slides down when the pointer reaches the top of the screen. Two **Trigger** controls do the work: `hoverZone`, a thin strip along the top edge, and `hideZone`, which covers the bar when it is open.

```ts
// guis/menu-bar/menu-bar.gui.ts
hoverZone.onMouseEnter(() => {
  gui.root.tweenTo({ y: 0 }, 0.3, 'Sine.easeOut')
})

hideZone.onMouseLeave(() => {
  gui.root.tweenTo({ y: -17 }, 0.25, 'Sine.easeIn')
})

menuBtn.onClick(() => guis.gameMenu.show())
```

`gui.root` is the whole GUI as one control, so moving it moves everything except `fixedControls`.

### Showing what's under the pointer

The 2-click template's hover text follows `pointer.hover`:

```ts
// guis/hover-text/hover-text.gui.ts
function refresh() {
  const hover = pointer.hover
  const inRoom = hover?.kind === 'prop' || hover?.kind === 'hotspot' || hover?.kind === 'character'
  const label = inRoom ? (hover.description?.trim() || hover.id?.trim() || '') : ''
  if (label) text.text = label
  gui.root.visible = label !== ''
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
```

### A title card

A game can open with a few paragraphs of text that fade in and out over music. Make a room with nothing else in it, and a hidden GUI (`title-card`) with one text control, and let the room script drive it:

```ts
const paragraphs = [
  `It was a dark and stormy night.`,
  `Hank had run out of coffee.`,
]

room.onEnterAfterFade(() => {
  music.intro.play()
  const text = guis.titleCard.controls.text
  text.alpha = 0
  guis.titleCard.show()

  cutscene(() => {
    for (const paragraph of paragraphs) {
      text.text = paragraph
      text.fadeTo(1, 1.2, { clickToSkip: true })
      waitForClick({ timeout: 10 })
      text.fadeTo(0, 1.2, { clickToSkip: true })
    }
  })
  rooms.apartment.goTo()
})
```

A room can hide GUIs it doesn't want, such as the verb bar on a title screen, in its `onEnter`: `guis.verbs.hide()`.

## Checklist

- The GUI's art, if any, is exported to `assets/images/guis/<id>/`, with slices for stretchable panels.
- Every control a script uses has a clear id.
- Menus start hidden, are modal, and sit above the HUD with a higher `zIndex`.
- Every menu has a way to close it.
- Text uses fonts listed in `fonts.json`, with an outline where it sits over busy art.
