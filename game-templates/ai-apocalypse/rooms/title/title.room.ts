import { guis, music } from '@game';
import { room } from './title.ids';

room.onEnter(() => {
  guis.verbs.hide()
  guis.titleButtons.show()
})

room.onEnterAfterFade(() => {
  music.trapped.play()
})
