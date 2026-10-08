import { cutscene, fadeIn, fadeOut, inventory, wait } from '@benne/script';
import { dialogs, flags, items, sfx } from '@game';
import { barista, relay } from '../../rooms/cafe/cafe.ids';
import { dialog, options } from './barista.ids';

// Hey. How's it going?
options.greetingBarista.onChooseOnce(() => {
  Barista: `Eh, not great ever since AI started providing for all our needs.`
  Barista: `Nobody wants to work anymore.`
  Hank: `Well, what are you doing?`
  Barista: `I don't want to work anymore either.`
})

// Why aren't you serving that guy over there?
options.waitingCustomer.onChoose(() => {
  Barista: `Ugh! Then I have to walk over there...`
  Barista: `TALK to him...`
  Barista: `It just seems like a lot of work.`
})

// Did you know there's some dirty dishes on the table over there?
options.dirtyDishes.onChoose(() => {
  Barista: `OMG what are you, my mom?`
  Barista: `It's such a pain having to clean up after you people!`
})

// What's that high tech looking thing up there?
options.highTechThing.onChoose(() => {
  cutscene(() => {
    Barista: `Oh, that's something I scrounged from the old university nearby.`
    Barista: `I think it's called a "control relay"?`
    Barista: `Don't know what it does, but I think it looks cool.`
    Hank: `Can I have it?`
    Barista: `You want me to just GIVE it to you?`
    Barista: `I'm a business owner. People need to WORK to earn their keep.`
  })
  flags.canWork = true
  dialogs.customer.options.takeOrder.on()
})

// Ok. I bussed your table. I served your customer. Can I have that control relay thing now?
options.helped.onChoose(() => {
  cutscene(() => {
    Barista: `Hmm...`
    barista.face('R')
    wait(1)
    barista.face('D')
    Barista: `Hmm...`
    Barista: `Oh ok fine. I'll get it down for you.`
    fadeOut()
    sfx.whip.play()
    inventory.add(items.relay)
    relay.hide()
    fadeIn()
    Barista: `But don't come around here looking for more free handouts!`
  })
  flags.gotRelay = true
  dialogs.jensenInPlaza.options.foundRelay.on()
  dialog.end()
})

// I'll be going.
options.bye.onChoose(() => {
  Barista: `Come back soon!`
  dialog.end()
})
