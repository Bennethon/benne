import { camera, cutscene, faceClicked, fadeOut, input, inventory, player, playFrom, wait, walkToClicked } from '@benne/script';
import { flags, guis, items, music, rooms, sfx } from '@game';
import {
  room, banana, botti327, cord, door, hank, points, regions, scientists, slip, timeonium, timeTravelFinal,
} from './lab27.ids';

playFrom('ending', () => {
  flags.escapedCloset = true
})

room.onEnter(() => {
  if (!flags.escapedCloset) {
    return
  }
  // GAME END
  hank.show()
  timeonium.hide()
  banana.hide()
  cord.animation = 'cord'
  botti327.face('D')
  hank.moveTo(points.endingStartWalk)
  hank.face('L')
  camera.zoomTo(points.endingZoom, 1, 0)
  regions.bananaGuard.active = false
  guis.verbs.hide()
})

room.onEnterAfterFade(() => {
  if (flags.escapedCloset) {
    // GAME END
    player.walkTo(banana)
    player.face('U')
    Hank: "*sigh*"

    // Plug in BOTT-i3
    player.walkTo(points.endingStopWalk)
    Hank: "Oh how did this get unplugged again?"
    player.walkTo(points.walkCord)
    player.face('U')
    wait(0.5)
    hank.play('ReachU')
    cord.animation = 'cord-plugged'
    Hank: "There we go."
    wait(0.5)
    botti327.face('R')
    Botti327: "Thanks Hank!"
    Hank: "No problem, BOTT-i3!"
    player.walkTo(door)
    fadeOut(1.5)
    wait(0.33)
    Scientists: "Hey! Where's the Timeonium?"
    rooms.credits.goTo()
  }

  // GAME START
  player.walkTo(points.walkIn)
  Hank: "Hey guys. Working late?"
  wait(0.5)
  Scientists: "*grunt*"
  wait(0.75)
  Hank: "Welp! I'll be out of your hair in a second."
  wait(0.5)
  Scientists: "Jensen, hold still!"
  wait(0.25)
  Scientists: "We're not done calibrating the sensors."
  wait(0.5)
})

banana.onLook(() => {
  faceClicked()
  Hank: "Ugh, these scientists are slobs."
})

// Heading for the banana walks into the scientists' guard region.
banana.on(['clean', 'take'], () => {
  walkToClicked()
})

regions.bananaGuard.onEnter((who) => {
  if (!who.isPlayer) {
    return
  }
  player.stopWalking()
  player.stopAnimation()
  if (!flags.firstBanana) {
    Scientists: "HEY BUDDY! CAN YOU GIVE US A HAND?"
    player.face('U')
    Hank: "Yeah, what's up?"
    Scientists: "Go grab the Timeonium canister from the desk over there."
    Scientists: "We're almost done here and we need it to power the machine."
    Hank: "Uh, ok."
    flags.firstBanana = true
    flags.scientistRequest = true
  } else {
    Scientists: "HEY MAN! HOW ABOUT THAT CANISTER?"
    player.face('U')
    Hank: "Oh yeah."
  }
  player.walkTo(points.walkBack)
})

timeonium.onLook(() => {
  faceClicked()
  Hank: "It's a high tech canister of some blue stuff."
})

timeonium.onTake(() => {
  if (!flags.scientistRequest) {
    faceClicked()
    Hank: "I don't know what I'd do with that."
    return
  }
  // Off before any walking: the walks below must not trip the scientists again.
  regions.bananaGuard.active = false
  walkToClicked()

  input.disabled = true
  wait(1)

  // Pick up the Timeonium
  player.face('R')
  Hank: "HEY GUYS! WHERE DO YOU WANT THIS?"
  Scientists: "PUT IT OVER BY THE TIME CHAMBER."
  Hank: "k"
  player.face('L')
  hank.play('ReachL')
  timeonium.hide()
  sfx.whip.play()
  inventory.add(items.timeonium)

  // Plug in BOTT-i3
  wait(0.5)
  Hank: "Oh, huh. Did I unplug this?"
  player.walkTo(points.walkCord)
  player.face('U')
  wait(0.5)
  hank.play('ReachU')
  cord.animation = 'cord-plugged'
  Hank: "There we go."
  wait(0.5)
  botti327.face('R')
  Botti327: "Thanks!"
  Hank: "Uh, you're welcome."

  // Slip on peel
  player.walkTo(banana)
  cutscene(() => {
    music.stop()
    music.slip.play({ loop: false })
    hank.hide()
    banana.hide()
    scientists.face('R')
    camera.zoomTo.now(points.cameraPan, 1, 2)
    slip.show()
    sfx.timeTravel.play()
    slip.play('slip')
    timeTravelFinal.show()
    slip.hide()
    Scientists: "WHAT THE-"
    fadeOut(2, 0xffffff)
    input.disabled = false
    rooms.lab.goTo()
  })
})

botti327.onLook(() => {
  faceClicked()
  Hank: "Looks like some sort of computer box."
})

botti327.onUse(() => {
  faceClicked()
  Hank: "I'm not into computers."
})

door.onLook(() => {
  faceClicked()
  Hank: "The door back to the hallway."
})

door.onUse(() => {
  faceClicked()
  Hank: "I'm done cleaning out there. I need to finish in here."
})
