import { dialogs, flags } from '@game';
import { dialog, options } from './customer.ids';

// Is this a nice place?
options.nicePlace.onChoose(() => {
  Customer: `Oh yeah! I love this place. Real authentic human experience.`
  Customer: `Slow service. Messed up orders. It has it all!`
})

// How long have you been waiting here?
options.howLong.onChoose(() => {
  Customer: `Oh about 45 minutes. Isn't it great?`
  Hank: `Sure...`
  dialogs.barista.options.waitingCustomer.on()
})

// Uh, can I take your order?
options.takeOrder.onChoose(() => {
  Customer: `Oh, finally! Ha ha!`
  Customer: `I'll have a black coffee, please.`
  Hank: `Uh, coming right up.`
  Customer: `Take your time!`
  flags.tookOrder = true
  dialogs.barista.options.waitingCustomer.off()
  dialog.end()
})

// Later, man.
options.bye.onChoose(() => {
  Customer: `Have a nice day!`
  dialog.end()
})
