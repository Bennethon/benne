import { wait } from '@benne/script';
import { items } from '@game';

items.lantern.onLook(() => {
  // TODO
})

// `doNotActivate`: Use switches the lantern on or off instead of arming it.
items.lantern.onUse.doNotActivate(() => {
  if (items.lantern.animation === 'Lantern') {
    Hank: "I will turn on the Lantern."
    wait(0.5)
    items.lantern.animation = 'Lantern-glowing'
    wait(0.5)
    Hank: "There we go!"
  } else if (items.lantern.animation === 'Lantern-glowing') {
    Hank: "I will turn off the Lantern."
    wait(0.5)
    items.lantern.animation = 'Lantern'
    wait(0.5)
    Hank: "There we go!"
  }
})
