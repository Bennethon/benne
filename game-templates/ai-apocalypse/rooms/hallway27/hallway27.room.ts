import { faceClicked, player, wait, walkToClicked } from '@benne/script';
import { rooms } from '@game';
import { room, bullitenBoard, cleaningStuff, doorLab, doorOutside } from './hallway27.ids';

room.onEnterAfterFade(() => {
  wait(1)
  player.face('D')
  wait(0.5)
  Hank: "Well, that about does it for the hallway."
  Hank: "Time to clean the lab."
})

doorOutside.onLook(() => {
  faceClicked()
  Hank: "That's the door to outside."
})

doorOutside.onUse(() => {
  walkToClicked()
  Hank: "I'm not done with my rounds. I can't leave!"
})

doorLab.onLook(() => {
  faceClicked()
  Hank: "That's the high tech time lab."
  Hank: "I need to clean in there."
})

doorLab.onUse(() => {
  walkToClicked()
  Hank: "Last room of the night. Let's finish this up and I can go home."
  wait(0.5)
  rooms.lab27.goTo()
})

bullitenBoard.onLook(() => {
  walkToClicked()
  Hank: "I never understand any of this science stuff."
})

cleaningStuff.onLook(() => {
  faceClicked()
  Hank: "Standard issue, janitorial equipment."
})

cleaningStuff.on(['take', 'use'], () => {
  faceClicked()
  Hank: "I don't need any of that right now."
})

cleaningStuff.onClean(() => {
  faceClicked()
  Hank: "Clean the cleaning supplies? That's crazy."
})
