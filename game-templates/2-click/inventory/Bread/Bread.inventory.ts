import { inventory, pointer } from '@benne/script';
import { items } from '@game';

// Use arms an item for using it on something; that needs no handler here.

items.bread.onLook(() => {
  Hank: `It's some bread.`
})

items.bread.onUseItem(items.knife, () => {
  if (items.knife.animation === 'Knife') {
    Hank: `It won't do any good without something to spread!`
  } else {
    inventory.add(items.sammich)
    inventory.remove(items.bread)
    // This game keeps an item armed after it is used (`dropWhenInventoryUsed`); drop the knife.
    pointer.item = null
    Hank: `This looks delicious!`
  }
})
