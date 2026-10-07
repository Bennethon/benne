import { camera, display, faceClicked, player, wait, walkToClicked } from '@benne/script';
import { flags, rooms, sfx } from '@game';
import { room, door, fountainOff, fountainOn, hank, henry, leverPulled, points, rock, rockMoved } from './outside.ids';

room.onEnter(() => {
  player.moveTo(points.enterFromDoor)
  player.face('R')
})

room.onEnterAfterFade(() => {
  sfx.doorClose.play()
  if (room.isFirstVisit) {
    Henry: "Hey, Hank!"
    Henry: "Come here!"
    player.walkTo(henry)
    Player: "What's up?"
    henry.walkTo(points.henryFountain)
    henry.face('L')
    Henry: "Check out this fountain!"
    player.walkTo(fountainOff)
    player.face('R')
    wait(1)
    Player: "What about it?"
    Henry: "I need you to turn it on. It's really important."
    Player: "Uh, ok."
    henry.startFacing(hank)
  }
})

door.on(['open', 'use'], () => {
  walkToClicked()
  rooms.apartment.goTo()
})

door.onLook(() => {
  faceClicked()
  Hank: "It's the door to the apartment."
})

fountainOff.onLook(() => {
  faceClicked()
  camera.zoomTo(fountainOff, 1.5, 0.6)
  Hank: "It's a fountain."
  Hank: "It's not running."
  camera.reset()
})

fountainOn.onLook(() => {
  faceClicked()
  Hank: "I got it working!."
})

rock.onLook(() => {
  faceClicked()
  Hank: "It's a weird looking, out of place rock."
})

rock.onPush(() => {
  walkToClicked()
  Player: "I think I can move it."
  rock.hide()
  rockMoved.show()
  Player: "Huh, some weird lever hidden under the rock."
})

rockMoved.onLook(() => {
  faceClicked()
  Hank: "I wonder what this lever does..."
})

rockMoved.on(['pull', 'push'], () => {
  walkToClicked()
  Hank: "Let's see what this does..."
  rockMoved.hide()
  leverPulled.show()
  fountainOff.hide()
  fountainOn.show()
  flags.turnedOnFountain = true
  Henry: "WOO HOO! IT'S WORKING!"
  display("You won!")
})
