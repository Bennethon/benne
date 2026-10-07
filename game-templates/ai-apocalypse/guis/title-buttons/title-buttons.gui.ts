import { game } from '@benne/script';
import { guis, rooms } from '@game';
import { gui, loadGame, newGame, quit, settingsBtn } from './title-buttons.ids';

// Quit only makes sense in the desktop app.
function syncQuitButton() {
  quit.visible = game.isDesktop
  quit.enabled = game.isDesktop
}

gui.onBuilt(syncQuitButton)
gui.onShow(syncQuitButton)

quit.onClick(() => game.quit())

newGame.onClick(() => game.newGame(rooms.opening))

loadGame.onClick(() => guis.loadMenu.show())

settingsBtn.onClick(() => guis.settingsMenu.show())
