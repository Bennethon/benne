import { inventory } from '@benne/script';
import { items, sfx } from '@game';

items.antenna.onLook(() => {
  Hank: `An old broken car antenna.`
})

// Magnet on antenna. magnet.inventory.ts has antenna on magnet.
items.antenna.onCombine(items.magnet, () => {
  inventory.remove(items.antenna)
  inventory.remove(items.magnet)
  sfx.whip.play()
  inventory.add(items.magnetStick)
  Hank: `Cool!`
})
