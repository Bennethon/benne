import { items } from '@game';

items.sammich.onLook(() => {
  Player: `It looks delicious!`
})

// `doNotActivate`: Use says a line instead of arming the sandwich. Give still arms it.
items.sammich.onUse.doNotActivate(() => {
  Player: `I am not hungry right now.`
})
