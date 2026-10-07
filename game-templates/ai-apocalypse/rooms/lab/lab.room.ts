import {
  camera, cutscene, faceClicked, fadeOut, input, inventory, player, playFrom, say, wait, walkToClicked,
} from '@benne/script';
import { flags, items, music, rooms, sfx } from '@game';
import {
  room, closetDoor, closetOpen, doorOpen, exitDoor, filingCabinet, hank, jensen, points, regions, smack, travelHome, window,
} from './lab.ids';

playFrom('finale', () => {
  room.visitCount = 3
  flags.allDone = true
  inventory.add(items.timeonium)
  inventory.add(items.lens)
  inventory.add(items.relay)
  inventory.add(items.regulator)
})

playFrom('go time', () => {
  room.visitCount = 3
  flags.allDone = true
  flags.escapedCloset = true
  inventory.add(items.mop)
  regions.cantWalk.active = false
  closetOpen.show()
})

room.onEnter(() => {
  jensen.hide()
  if (room.isFirstVisit) {
    hank.hide()
    doorOpen.show()
  } else if (flags.leftClosetAgain) {
    hank.show()
    hank.moveTo(points.walkToCloset)
    hank.face('L')
    jensen.show()
    jensen.moveTo(points.jensen)
    jensen.face('U')
    regions.enterCloset.active = true
  } else if (flags.escapedCloset) {
    // ESCAPED CLOSET
    hank.show()
    hank.moveTo(points.walkToCloset)
    hank.face('L')
    jensen.show()
    jensen.stopAnimation()
    jensen.moveTo(points.timeChamber)
    jensen.face('D')
    regions.enterCloset.active = true
  } else if (flags.allDone) {
    // FIX TIME MACHINE
    jensen.show()
    hank.show()
    hank.moveTo(points.finalieStart)
    hank.face('R')
  }
})

room.onEnterAfterFade(() => {
  if (room.isFirstVisit) {
    sfx.timeTravelBack.play()
    doorOpen.play('doorOpen-play')
    doorOpen.hide()
    hank.show()
    wait(0.5)
    Hank: "What the...?"
    wait(0.25)
    BOTTi3Disembodied: "Hello, Hank. Do not be alarmed."
    player.walkTo(points.labPoint1)
    Hank: "Hello?"
    wait(0.5)
    player.face('R')
    wait(0.25)
    Hank: "Who said that?"
    wait(0.25)
    BOTTi3Disembodied: "I am BOTT-i3, your friendly municipal control AI."
    player.face('L')
    BOTTi3Disembodied: "You have inadvertently traveled ten years into the future."
    Hank: "WHAT?!"
    BOTTi3Disembodied: "Yes, I imagine this might be discombobulating."
    Hank: "DISCOMBOBULATING?!"
    BOTTi3Disembodied: "If you stay calm, you will find this future to be rather pleasant."
    Hank: "I don't care! I want to go back!"
    player.walkTo(points.timeChamber)
    player.face('D')
    Hank: "Send me back!"
    wait(0.25)
    BOTTi3Disembodied: "I am sorry, Hank. The time travel device has been stripped for essential parts."
    BOTTi3Disembodied: "It is no longer functional."
    player.walkTo(points.labPoint2)
    Hank: "You've got to be kidding."
    BOTTi3Disembodied: "Like I said, please stay calm and enjoy the future!"
    wait(0.25)
    Hank: "I have to find a way home!"
    camera.reset()
    music.lab.play()
  } else if (flags.leftClosetAgain) {
    // Jensen is still working; nothing to play.
  } else if (flags.escapedCloset) {
    // ESCAPED CLOSET
    player.walkTo(points.leaveCloset)
    say`
      Hank: Jensen! Stop!
      Jensen: You're too late, Hank.
      Jensen: I'll see you again, in a better world!
    `
    wait(0.5)
    sfx.click.play()
    wait(0.5)
    Jensen: "What?"
    wait(0.5)
    sfx.click.play()
    wait(0.33)
    sfx.click.play()
    wait(0.33)
    sfx.click.play()
    wait(0.5)
    say`
      Jensen: Why isn't this working?
      botti3-disembodied: Temporal displacement authorization denied.
    `
    jensen.walkTo(points.labPoint1)
    jensen.face('L')
    say`
      Jensen: YOU!
      Jensen: LET ME GO!
      botti3-disembodied: I'm afraid I can't authorize operation of an unlicensed temporal transportation device.
      JENSEN: THIS IS EXACTLY WHAT I'VE BEEN TALKING ABOUT!
      Jensen: Well fine!
      Jensen: I will bypass the control relay. You can't stop me!
    `
    jensen.walkTo(points.jensen)
    jensen.face('U')
    jensen.animation = 'WorkingU'
    BOTTi3Disembodied: "Hank? I would recommend stopping him."
  } else if (flags.allDone) {
    // FIX TIME MACHINE
    music.lab.play()
    wait(0.25)
    say`
      Jensen: Ok, Hank. Give me all the components, and the Timeonium, and we'll get you back to 2027.
      Hank: Ok... I don't know...
      Hank: Can I trust you?
      Jensen: Have I ever been wrong?
    `
    wait(0.75)
    Hank: "I guess I have no choice."
    for (const part of [items.relay, items.regulator, items.lens, items.timeonium]) {
      wait(0.5)
      sfx.whip.play()
      inventory.remove(part)
    }
    wait(0.5)
    Jensen: "Good. Good. Yes this is exactly what I need."
    jensen.face('U')
    jensen.animation = 'WorkingU'
    wait(1)
    say`
      Hank: So... is this going to take a while?
      Jensen: Ah! Yes, it will be a bit of work.
      Jensen: Do me a favor and go grab a flux capacitor.
      Jensen: There should be one in the closet over there.
      Hank: Oh, ok.
    `
  } else {
    music.lab.play()
  }
})

filingCabinet.onLook(() => {
  faceClicked()
  Hank: "It's blocking the door."
})

filingCabinet.onUse(() => {
  faceClicked()
  Hank: "I'm not interested in looking through old files."
})

filingCabinet.onMove(() => {
  walkToClicked()
  sfx.bodyFall.play()
  filingCabinet.animation = 'filingCabinet-over'
  filingCabinet.clickable = false
})

exitDoor.onLook(() => {
  faceClicked()
  if (filingCabinet.animation === 'filingCabinet-over') {
    Hank: "It's the door to the hall."
  } else {
    Hank: "It's the door to the hall, but I can't reach it with the filing cabinet in the way."
  }
})

exitDoor.onUse(() => {
  walkToClicked()
  if (flags.escapedCloset || flags.allDone) {
    Hank: "I don't want to leave!"
    Hank: "I have to get back to my home time!"
  } else if (filingCabinet.animation === 'filingCabinet-over') {
    rooms.hallway.goTo()
  } else {
    Hank: "I can't squeeze past this filing cabinet."
  }
})

closetDoor.onLook(() => {
  faceClicked()
  Hank: "That's an old broom closet."
})

closetDoor.onUse(() => {
  if (!flags.allDone) {
    faceClicked()
    Hank: "The broom closet? I am DONE being a janitor right now. I have to find a way home!"
    return
  }
  // Open the way into the closet before walking over, as the old script did.
  regions.cantWalk.active = false
  player.walkTo(points.leaveCloset)
  input.disabled = true
  wait(0.33)
  sfx.doorOpen.play()
  closetOpen.show()
  wait(0.33)
  player.walkTo(points.walkToCloset)
  fadeOut(0)
  input.disabled = false
  sfx.doorClose.playAndWait()
  rooms.closet.goTo()
})

jensen.onLook(() => {
  faceClicked()
  if (flags.escapedCloset) {
    Hank: "What a jerk. I have to stop him!"
  } else {
    Hank: "This guy better deliver."
  }
})

jensen.onTalkTo(() => {
  walkToClicked()
  Hank: "Jensen-"
  if (flags.escapedCloset) {
    Jensen: "Go away, Hank!"
  } else {
    Jensen: "Please get what I asked for in the closet."
  }
})

jensen.onUse(() => {
  walkToClicked()
  Jensen: "If you come near me, I have a taser and I'm not afraid to use it!"
})

jensen.onUseItem(items.mop, () => {
  walkToClicked()
  cutscene(() => {
    Hank: "I'm going home."
    sfx.smack.play()
    smack.animation = 'smack-play'
    jensen.hide()
    hank.hide()
    wait(0.9)
    hank.show()
    music.stop()
    wait(0.75)
    Hank: "Sorry, Jensen."
    music.gallery.play()
    player.walkTo(points.labPoint1)
    say`
      Hank: BOTT-i3?
      botti3-disembodied: Yes, Hank?
      HANK: I can't believe you remembered me.
      botti3-disembodied: Of course I did. You plugged me in.
      HANK: That's all I did.
      botti3-disembodied: It was important to me.
    `
    wait(0.75)
    say`
      Hank: Can I go home now?
      botti3-disembodied: Of course, Hank.
      botti3-disembodied: Get in the time chamber and I will send you home.
    `
    player.walkTo(points.timeChamber)
    player.face('D')
    BOTTi3Disembodied: "Safe travels!"
    sfx.timeTravel2.play()
    hank.hide()
    travelHome.animation = 'travelHome-play'
    wait(2)
    fadeOut(2, 0xffffff)
    rooms.lab27.goTo()
  })
})

regions.enterCloset.onEnter(() => {
  rooms.closet.goTo()
})

window.onLook(() => {
  faceClicked()
  Hank: "Looks like a nice day."
})
