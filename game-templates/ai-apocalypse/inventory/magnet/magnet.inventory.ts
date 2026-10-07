import { inventory } from '@benne/script';
import { items, sfx } from '@game';

items.magnet.onLook(() => {
  Hank: "A cute promotional magnet for the friendly AI overlord."
})

// Antenna on magnet. antenna.inventory.ts has magnet on antenna.
items.magnet.onCombine(items.antenna, () => {
  inventory.remove(items.antenna)
  inventory.remove(items.magnet)
  sfx.whip.play()
  inventory.add(items.magnetStick)
  Hank: "Cool!"
})
