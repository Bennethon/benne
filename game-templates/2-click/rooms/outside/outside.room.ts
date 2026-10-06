import { display, faceClicked, player, wait, walkToClicked } from '@benne/script';
import { flags, music, rooms, sfx } from '@game';
import { room, door, fountainOff, fountainOn, hank, henry, leverPulled, points, rock, rockMoved } from './outside.ids';

room.onEnter(() => {
  if (room.cameFrom(rooms.apartment)) {
    player.moveTo(points.enterFromDoor)
    player.face('R')
  }
})

room.onEnterAfterFade(() => {
  music.halloweenSpooky.play({ fadeSeconds: 5 })
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

door.onUse(() => {
  walkToClicked()
  rooms.apartment.goTo()
})

door.onLook(() => {
  faceClicked()
  Hank: "It's the door."
})

fountainOff.onLook(() => {
  faceClicked()
  Hank: "It's a fountain."
  Hank: "It's not running."
})

fountainOff.onUse(() => {
  walkToClicked()
  wait(0.5)
  Player: "I don't see how to turn it on."
})

fountainOn.onLook(() => {
  faceClicked()
  Hank: "I got it working!."
})

fountainOn.onUse(() => {
  faceClicked()
  Hank: "Cool!."
})

rock.onLook(() => {
  faceClicked()
  Hank: "It's a weird looking, out of place rock."
})

rock.onUse(() => {
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

rockMoved.onUse(() => {
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
