import { guis } from '@game';
import { gui, load, resume, save, settingsBtn } from './game-menu.ids';

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
