import { wait } from '@benne/script';
import { guis, rooms } from '@game';
import { room } from './credits.ids';

room.onEnter(() => {
  guis.verbs.hide()
})

room.onEnterAfterFade(() => {
  guis.credits.show()
  wait(24)
  rooms.title.goTo()
})
