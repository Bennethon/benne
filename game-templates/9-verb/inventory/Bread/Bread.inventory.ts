import { inventory } from '@benne/script';
import { items } from '@game';

// Use and Give arm an item for using it on something; that needs no handler here.

items.bread.onUseItem(items.knife, () => {
  if (items.knife.animation === 'Knife') {
    Hank: "It won't do any good without something to spread!"
  } else {
    inventory.add(items.sammich)
    inventory.remove(items.bread)
    Hank: "This looks delicious!"
  }
})
