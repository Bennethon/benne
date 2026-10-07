import { game } from '@benne/script';
import { guis, rooms } from '@game';
import { gui, load, quit, resume, save, settingsBtn, titleScreen } from './game-menu.ids';

// Quit only makes sense in the desktop app.
function syncQuitButton() {
  quit.visible = game.isDesktop
  quit.enabled = game.isDesktop
}

gui.onBuilt(syncQuitButton)
gui.onShow(syncQuitButton)

quit.onClick(() => game.quit())

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

titleScreen.onClick(() => rooms.title.goTo())
