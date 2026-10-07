import { items } from '@game';

items.pb.onOpen(() => {
  items.pb.animation = 'PB-open'
  Hank: "I opened the jar."
})

items.pb.onUseItem(items.knife, () => {
  if (items.pb.animation === 'PB') {
    Hank: "I need to open the jar first."
  } else {
    items.knife.animation = 'Knife-PB'
    Hank: "Mmmm... gooey peanut butter."
  }
})
