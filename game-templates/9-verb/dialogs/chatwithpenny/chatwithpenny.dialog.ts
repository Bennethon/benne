import { wait } from '@benne/script';
import { dialog, options } from './chatwithpenny.ids';

// The player says the option's text first, then the handler runs.

options.greeting.onChoose(() => {
  Penny: `Fine.`
})

options.door.onChoose(() => {
  Player: `I want to go outside.`
  Penny: `I want a sandwich.`
  wait(0.5)
  Player: `Uhh...`
  wait(0.5)
  Penny: `Make me a sandwich and I'll give you the key.`
})

options.bye.onChoose(() => {
  Penny: `Bye!`
  dialog.end()
})
