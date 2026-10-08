import { items } from '@game';

items.coffee.onLook(() => {
  if (items.coffee.animation === 'coffee-full') {
    Hank: `A full cup of black coffee.`
  } else {
    Hank: `An empty coffee cup.`
  }
})
