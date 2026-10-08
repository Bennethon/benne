import { faceClicked, fadeIn, fadeOut, inventory, player, playFrom, unhandled, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms, sfx } from '@game';
import {
  room, antenna, battery, car, crash, driver, hank, outside, points, regions, regulator, toolChest,
} from './club.ids';

playFrom('fix battery', () => {
  flags.askedAboutBattery = true
  flags.batteryClean = true
  inventory.add(items.wrench)
  battery.active = true
})

room.onEnterAfterFade(() => {
  music.garage.play()
})

regions.leave.onEnter(() => {
  rooms.plaza.goTo()
})

outside.onLook(() => {
  faceClicked()
  Hank: `Nice day.`
})

// ─── The driver ──────────────────────────────────────────────────────────────

driver.onLook(() => {
  faceClicked()
  Hank: `He looks grizzly.`
})

driver.onTalkTo(() => {
  walkToClicked()
  dialogs.driver.start()
})

// ─── The battery ─────────────────────────────────────────────────────────────

battery.onLook(() => {
  walkToClicked()
  if (flags.batteryClean) {
    Hank: `I cleaned off the corrosion. Now to fix the loose cable.`
    Hank: `I need a 10mm socket wrench.`
    dialogs.driver.options.wrench.on()
  } else {
    Hank: `Hmm...`
    Hank: `It looks like one terminal is horribly corroded and the cable is loose.`
    Driver: `Huh?!`
    dialogs.driver.options.fixBattery.on()
  }
})

battery.onClean(() => {
  if (!flags.askedAboutBattery) {
    faceClicked()
    Hank: `Why would I do that?`
    return
  }
  walkToClicked()
  if (flags.batteryClean) {
    Hank: `It's already clean.`
  } else {
    Hank: `I don't think my raw cleaning abilities will work here.`
    Hank: `I need something with more punch.`
  }
})

battery.onUseItem(items.soda, () => {
  if (!flags.askedAboutBattery) unhandled()
  walkToClicked()
  Hank: `I hope this works.`
  inventory.remove(items.soda)
  sfx.sodaPour.play()
  wait(0.75)
  Hank: `Hey! The corrosion is gone.`
  Hank: `Now I need to tighten that cable.`
  Hank: `Just need a 10mm socket wrench.`
  dialogs.driver.options.wrench.on()
  flags.batteryClean = true
})

battery.onUseItem(items.wrench, () => {
  if (!flags.askedAboutBattery || !flags.batteryClean) unhandled()
  walkToClicked()
  Hank: `Ok I'll tighten 'er up here.`
  inventory.remove(items.wrench)
  sfx.tightening.play()
  wait(0.75)
  Hank: `Done!`
  flags.batteryFixed = true
  Hank: `Hey man. I fixed your battery.`
  Driver: `Well darn tootin'. It looks like you did!`
  Driver: `Thanks son! I don't need that power regulator anymore.`
  Driver: `You can have it.`
  regulator.hide()
  sfx.whip.play()
  inventory.add(items.regulator)
  Hank: `Thanks!`
  flags.gotRegulator = true
  dialogs.jensenInPlaza.options.foundRegulator.on()

  sfx.hoodClose.play()
  car.animation = 'car-fixed'
  Driver: `Now stand back. I'm gonna fire her up, and show this AI who can drive!`
  fadeOut()
  player.moveTo(points.standBack)
  player.face('D')
  driver.hide()
  car.hide()
  sfx.crash.play()
  crash.animation = 'crash-play'
  fadeIn()
  wait(2)
  Hank: `Ahh!`
  // Walks into the exit region, which leaves for the plaza.
  player.walkTo(points.walkout)
})

// ─── Antenna and regulator ───────────────────────────────────────────────────

antenna.onLook(() => {
  faceClicked()
  Hank: `A broken off car antenna.`
})

antenna.onTake(() => {
  walkToClicked()
  hank.play('ReachR')
  antenna.hide()
  sfx.whip.play()
  inventory.add(items.antenna)
})

regulator.onLook(() => {
  walkToClicked()
  Hank: `That's a high tech thing.`
  Driver: `That's my ol' power regulator I got from the college over there.`
  Driver: `I was havin' trouble with my battery, so I thought this might help.`
  Hank: `Is it helping?`
  Driver: `I can't tell.`
  battery.active = true
})

regulator.onTake(() => {
  walkToClicked()
  Driver: `Hey! Don't touch that!`
  Hank: `Why?`
  Driver: `I need it!`
  Hank: `Why?`
  Driver: `I don't know.`
})

// ─── The tool chest ──────────────────────────────────────────────────────────

toolChest.onLook(() => {
  faceClicked()
  if (flags.askedAboutWrench) {
    Hank: `Apparently the 10mm socket wrench fell under there.`
  } else {
    Hank: `Nice tool chest.`
  }
})

toolChest.onUse(() => {
  faceClicked()
  Hank: `Not without asking.`
})

toolChest.onMove(() => {
  if (!flags.askedAboutWrench) {
    faceClicked()
    Hank: `I don't need to move it.`
    return
  }
  walkToClicked()
  // TODO: play grunting sound
  wait(0.5)
  Hank: `Ugh, it's too heavy to move.`
})

toolChest.onUseItem(items.magnetStick, () => {
  if (!flags.askedAboutWrench) {
    faceClicked()
    Hank: `Why would I do that?`
    return
  }
  walkToClicked()
  sfx.metalScrape.play()
  wait(0.5)
  inventory.remove(items.magnetStick)
  sfx.whip.play()
  inventory.add(items.wrench)
  Hank: `Ah, got it!`
})

toolChest.onUseItem(items.antenna, () => {
  if (!flags.askedAboutWrench) {
    faceClicked()
    Hank: `Why would I do that?`
    return
  }
  walkToClicked()
  sfx.metalScrape.play()
  wait(0.5)
  Hank: `Hmm. The antenna alone can't fish out the wrench.`
})
