import { game, settings } from '@benne/script';
import { guis, rooms } from '@game';
import { gui, back, musicEnabled, musicVolume, sfxVolume, textSpeedSlider } from './settings-menu.ids';

// The text speed slider runs from slow (0.1) to fast (2), the opposite way to the speech
// duration multiplier, so it maps across the same range.
const TEXT_SPEED_MIN = 0.1
const TEXT_SPEED_MAX = 2

gui.onBuilt(() => {
  sfxVolume.value = settings.sfxVolume * 100
  musicVolume.value = settings.musicVolume * 100
  textSpeedSlider.value = TEXT_SPEED_MIN + TEXT_SPEED_MAX - settings.textSpeed
})

sfxVolume.onChange((v: number) => {
  settings.sfxVolume = v / 100
})

musicVolume.onChange((v: number) => {
  settings.musicVolume = v / 100
})

textSpeedSlider.onChange((v: number) => {
  settings.textSpeed = TEXT_SPEED_MIN + TEXT_SPEED_MAX - v
})

// The checkbox is called "musicEnabled" in the GUI, but it has always switched click-to-skip.
musicEnabled.onChange((checked: boolean) => {
  settings.clickToSkip = checked
})

back.onClick(() => {
  gui.hide()
  if (game.currentRoom !== rooms.title) guis.gameMenu.show()
})
