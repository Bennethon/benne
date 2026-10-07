import { game, saves } from '@benne/script';
import { guis, rooms } from '@game';
import { gui, backBtn, loadBtn, loadList } from './load-menu.ids';

/** Five fixed slots (0–4). */
const SLOTS = 5
let selected = 0

function firstUsedSlot(): number {
  for (let i = 0; i < SLOTS; i++) {
    if (saves.get(i)) return i
  }
  return 0
}

/** Repaints the rows. `autoSelect` picks the first used slot (or 0 if none). */
function refresh(autoSelect: boolean) {
  for (let i = 0; i < SLOTS; i++) {
    loadList.setRowText(i, saves.get(i)?.name ?? `(Empty Slot ${i + 1})`)
  }
  if (autoSelect) selected = firstUsedSlot()
  loadList.selectedIndex = selected
  loadBtn.enabled = saves.get(selected) != null
}

// Built once per room; the saves can change in between, so re-read them whenever it opens.
gui.onBuilt(() => refresh(true))
gui.onShow(() => refresh(false))

loadList.onSelect((i) => {
  selected = i
  loadBtn.enabled = saves.get(i) != null
})

loadBtn.onClick(() => {
  if (!saves.get(selected)) return
  gui.hide()
  guis.gameMenu.hide()
  saves.load(selected)
})

backBtn.onClick(() => {
  gui.hide()
  if (game.currentRoom !== rooms.title) guis.gameMenu.show()
})
