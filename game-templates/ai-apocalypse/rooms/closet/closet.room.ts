import { faceClicked, inventory, player, say, wait, walkToClicked } from '@benne/script';
import { flags, items, music, rooms, sfx } from '@game';
import { room, door, electricalBox, hank, jensen, mop, shelves } from './closet.ids';

room.onEnter(() => {
  jensen.hide()
})

room.onEnterAfterFade(() => {
  if (!room.isFirstVisit) {
    return
  }
  music.trapped.play()
  say`
    Hank: JENSEN? WHAT THE HECK, MAN?
    Hank: LET ME OUT!
    Jensen: I'm sorry, Hank.
    Jensen: But I can't let you stop me now.
    Jensen: With the Timeonium you brought me, I can finally finish what we started ten years ago.
    Jensen: I'm going back.
    Jensen: I'm going to stop AI before any of this ever happens.
    Hank: WHAT?!
    Hank: But that's my way home!
    Hank: I thought we were friends!
  `
  wait(1)
  Jensen: `You really need to get better at reading people.`
  wait(0.5)
  player.face('D')
  say`
    Hank: That jerk!
    Hank: I have to get out of here.
    Hank: And I have to stop him before he finishes that machine.
  `
})

door.onLook(() => {
  faceClicked()
  Hank: `Ugh, locked.`
})

door.onUse(() => {
  if (!flags.escapedCloset) {
    faceClicked()
    Hank: `Ugh, locked.`
    return
  }
  walkToClicked()
  flags.leftClosetAgain = true
  rooms.lab.goTo()
})

door.onTalkTo(() => {
  faceClicked()
  say`
    Hank: JENSEN! LET ME OUT!
    Jensen: I'm ignoring you...
  `
})

mop.onLook(() => {
  faceClicked()
  Hank: `A mop.`
})

mop.onTake(() => {
  walkToClicked()
  hank.play('ReachR')
  mop.hide()
  sfx.whip.play()
  inventory.add(items.mop)
  Hank: `A janitor's work is never done.`
})

electricalBox.onLook(() => {
  walkToClicked()
  player.face('L')
  if (electricalBox.animation === 'electricalBox') {
    say`
      Hank: There's a label on here. "Electrical Lock Control"
      HANK: Well, that seems unusually relevant.
      HANK: It's screwed shut.
    `
  } else {
    say`
      Hank: The cover is off. There are some wires in there.
      HANK: I might be able to short it out with something metal.
    `
  }
})

electricalBox.onUse(() => {
  walkToClicked()
  player.face('L')
  if (electricalBox.animation === 'electricalBox') {
    say`
      Hank: I can't get this cover off with my bare hands.
      HANK: It's screwed shut.
    `
  } else {
    Hank: `I need something besides my bare hands!`
  }
})

electricalBox.onUseItem(items.coin, () => {
  walkToClicked()
  player.face('L')
  if (electricalBox.animation === 'electricalBox') {
    Hank: `Close enough to a screwdriver.`
    hank.play('ReachL')
    wait(0.66)
    electricalBox.animation = 'electricalBox-open'
    Hank: `There we go!`
    return
  }
  Hank: `Let's see if this works...`
  inventory.remove(items.coin)
  hank.play('ReachL')
  wait(0.66)
  sfx.click.play()
  Hank: `Got it!`
  player.walkTo(door)
  Hank: `It's go time.`
  flags.escapedCloset = true
  rooms.lab.goTo()
})

shelves.onLook(() => {
  faceClicked()
  say`
    Hank: There's so much JUNK in here!
    Hank: Who is responsible for cleaning up this place?
  `
})

shelves.on(['take', 'clean'], () => {
  walkToClicked()
  if (flags.escapedCloset || inventory.has(items.coin)) {
    Hank: `There's nothing else useful in there.`
    return
  }
  Hank: `Let's see...`
  hank.play('ReachR')
  wait(0.75)
  say`
    HANK: A washer. Some batteries. Half a roll of tape...
    HANK: Oh, hey. A dime.
  `
  sfx.whip.play()
  inventory.add(items.coin)
})
