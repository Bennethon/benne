import { faceClicked, inventory, player, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms, sfx } from '@game';
import {
  room, art1, art2, canvas, curator, exit, hank, mopping, paintSpill, points, regions, statue,
} from './gallery.ids';

room.onEnter(() => {
  hank.moveTo(points.enter)
})

room.onEnterAfterFade(() => {
  music.gallery.play()
})

paintSpill.onClean(() => {
  walkToClicked()
  if (flags.canTakeLens) {
    Hank: "I had better not touch it again."
  } else if (!flags.canCleanPaint) {
    Hank: "Every janitorial bone in my body wants to clean this."
    player.face('D')
    Hank: "But I'm a guest here. I shouldn't touch it without being told."
  } else {
    Hank: "Well, she wants to see humans be productive."
    Hank: "The least I can do is clean this up for her."
    hank.hide()
    sfx.cleaningPaint.play()
    mopping.animation = 'mopping-action' // after hide; does not wait for the clip
    wait(1)
    curator.face('L')
    Curator: "WHAT ARE YOU DOING?!"
    wait(0.5)
    hank.face('D')
    hank.show()
    mopping.animation = 'mopping-end'
    player.face('R')
    Hank: "I..."
    player.face('L')
    wait(0.5)
    player.face('R')
    Hank: "I was just trying to clean this paint and-"
    player.face('L')
    wait(0.5)
    player.face('R')
    Hank: "you startled me and-"
    Curator: "STOP!"
    Curator: "What have you done?"
    player.face('L')
    wait(1)
    Curator: "I LOVE IT!"
    Curator: "It's so raw... so energetic... so..."
    Curator: "HUMAN."
    Curator: "This is the first piece of human created art in years!"
    Curator: "This changes everything!"
    Curator: "Take the lens, I don't care anymore!"
    player.face('R')
    Hank: "Thanks!"
    const options = dialogs.curator.options
    options.canHaveLens.off()
    options.paintSpill.off()
    options.greetCurator.off()
    options.howsItGoingCurator.off()
    flags.canTakeLens = true
  }
})

paintSpill.onLook(() => {
  walkToClicked()
  if (flags.canTakeLens) {
    Hank: "I had better not touch it again."
  } else {
    Hank: "Is it an accident, or modern art?"
  }
})

regions.leave.onEnter(() => {
  rooms.plaza.goTo()
})

statue.onLook(() => {
  faceClicked()
  if (statue.animation === 'statue') {
    Hank: "Nice looking glass lens thingie."
  } else {
    Hank: "Ehh I think it looks better now."
  }
})

statue.onTake(() => {
  walkToClicked()
  wait(0.5)
  if (!flags.canTakeLens) {
    Curator: "PLEASE DO NOT TOUCH THE ART!"
  } else if (statue.animation === 'statue-noLens') {
    Hank: "I already got what I need from it."
  } else {
    hank.play('ReachL')
    sfx.whip.play()
    inventory.add(items.lens)
    statue.animation = 'statue-noLens'
    player.face('D')
    Hank: "This might work to fix the time machine."
    flags.gotLens = true
    dialogs.jensenInPlaza.options.foundLens.on()
  }
})

curator.onLook(() => {
  faceClicked()
  Hank: "She looks nice."
})

curator.onTalkTo(() => {
  walkToClicked()
  dialogs.curator.start()
})

canvas.onLook(() => {
  faceClicked()
  if (flags.canTakeLens) {
    Hank: "I'm the next Jackson Pollock!"
  } else {
    Hank: "The canvas is empty."
  }
})

exit.onLook(() => {
  faceClicked()
  Hank: "That's the way back outside."
})

art1.onLook(() => {
  walkToClicked()
  Hank: "ooooh..."
})

art2.onLook(() => {
  walkToClicked()
  Hank: "ahhhh..."
})
