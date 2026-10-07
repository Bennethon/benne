import { saves } from '@benne/script';
import { guis } from '@game';
import { gui, backBtn, saveBtn, saveName, savedList } from './save-menu.ids';

/** Five fixed slots (0–4). */
const SLOTS = 5
let selected = 0

function firstEmptySlot(): number {
  for (let i = 0; i < SLOTS; i++) {
    if (!saves.get(i)) return i
  }
  return SLOTS - 1
}

function syncSaveButton(name: string) {
  saveBtn.enabled = saves.canSaveNow && name.trim() !== ''
}

/** Shows the slot's save name, ready to overwrite. */
function showSlot(slot: number) {
  saveName.text = saves.get(slot)?.name ?? ''
  syncSaveButton(saveName.text)
}

/** Repaints the rows. `autoSelect` picks the first empty slot, or the last one when all are used. */
function refresh(autoSelect: boolean) {
  for (let i = 0; i < SLOTS; i++) {
    savedList.setRowText(i, saves.get(i)?.name ?? `(Empty Slot ${i + 1})`)
  }
  if (autoSelect) selected = firstEmptySlot()
  savedList.selectedIndex = selected
  showSlot(selected)
}

gui.onBuilt(() => refresh(true))
gui.onShow(() => refresh(false))

savedList.onSelect((i) => {
  selected = i
  showSlot(i)
})

saveName.onChange((text: string) => syncSaveButton(text))

saveBtn.onClick(() => {
  const name = saveName.text.trim()
  if (!name) return
  saves.save(selected, name)
  gui.hide()
  guis.gameMenu.show()
})

backBtn.onClick(() => {
  gui.hide()
  guis.gameMenu.show()
})
