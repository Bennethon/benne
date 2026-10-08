import { walkToClicked, faceClicked, wait, inventory } from '@benne/script';
import { items, dialogs, rooms, sfx, music, flags } from '@game';
import {
  room, barista, customer, dishes, relay, window, coffeemaker, door, menu, cleaningStuff,
} from './cafe.ids';

room.onEnterAfterFade(() => {
  sfx.doorBells.play()
  music.cafe.play()
})

customer.onLook(() => {
  faceClicked()
  Hank: `He looks happy to be here.`
})

barista.onLook(() => {
  faceClicked()
  Hank: `Looks like the owner of the place.`
  Hank: `He isn't doing much.`
})

dishes.onLook(() => {
  faceClicked()
  Hank: `Some previous customer's dishes.`
  Hank: `It looks like no one is bussing this table.`
  dialogs.barista.options.dirtyDishes.on()
})

relay.onLook(() => {
  faceClicked()
  Hank: `It looks like a fancy, high-tech gadget.`
  dialogs.barista.options.highTechThing.on()
})

relay.onTake(() => {
  walkToClicked()
  Hank: `I can't reach it.`
})

dishes.onClean(() => {
  walkToClicked()
  if (!flags.canWork) {
    Hank: `These need to be bussed, but it's not MY job.`
    dialogs.barista.options.dirtyDishes.on()
  } else {
    Hank: `I guess SOMEONE has to work around here.`
    dishes.hide()
    sfx.whip.play()
    inventory.add(items.coffee)
    inventory.add(items.soda)
    dialogs.barista.options.dirtyDishes.off()
  }
})

barista.onTalkTo(() => {
  if (inventory.has(items.relay)) {
    Hank: `I don't want to talk to that guy anymore.`
    return
  }
  walkToClicked()
  dialogs.barista.start()
})

customer.onTalkTo(() => {
  if (!flags.tookOrder) {
    walkToClicked()
    dialogs.customer.start()
  } else if (!flags.deliveredOrder) {
    faceClicked()
    Hank: `I already took his order.`
  } else {
    faceClicked()
    Hank: `I'm gonna leave that guy alone now.`
  }
})

customer.onUseItem(items.coffee, () => {
  if (!flags.tookOrder) {
    faceClicked()
    Hank: `Why would I give him that?`
    return
  }
  if (items.coffee.animation !== 'coffee-full') {
    faceClicked()
    Hank: `I'm not going to serve him an empty cup.`
    return
  }
  walkToClicked()
  Hank: `Here you are, sir.`
  inventory.remove(items.coffee)
  Customer: `I ordered decaf.`
  Hank: `You said black.`
  Customer: `Black decaf.`
  Hank: `You left out a pretty important word.`
  Customer: `Oh, this is fantastic.`
  Hank: `What?`
  Customer: `The misunderstanding. The mild resentment. This is exactly like 2024!`
  flags.deliveredOrder = true
  dialogs.barista.options.helped.on()
  dialogs.barista.options.waitingCustomer.off()
})

window.onLook(() => {
  faceClicked()
  Hank: `It looks like some AI-run café across the way.`
  Hank: `They seem to be doing good business.`
})

coffeemaker.onLook(() => {
  faceClicked()
  Hank: `A fancy, industrial coffee maker.`
  Hank: `It doesn't look like it gets used much.`
})

coffeemaker.onUseItem(items.coffee, () => {
  walkToClicked()
  wait(1)
  sfx.pourCoffee.play()
  items.coffee.animation = 'coffee-full'
  Hank: `The best part of waking up!`
})

door.onLook(() => {
  faceClicked()
  Hank: `The door out.`
})

door.onUse(() => {
  walkToClicked()
  sfx.doorBells.play()
  rooms.plaza.goTo()
})

menu.onLook(() => {
  walkToClicked()
  Hank: `The menu looks... meh.`
})

cleaningStuff.on(['use', 'take', 'clean'], () => {
  faceClicked()
  Hank: `I'm not on the job here.`
})

cleaningStuff.onLook(() => {
  faceClicked()
  Hank: `These don't look like they get much use.`
})
