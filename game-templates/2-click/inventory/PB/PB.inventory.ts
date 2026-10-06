import { items } from '@game';

items.pb.onLook(() => {
  Hank: "It's some peanut butter."
})

// `doNotActivate`: Use opens the jar instead of arming it.
items.pb.onUse.doNotActivate(() => {
  if (items.pb.animation === 'PB') {
    items.pb.animation = 'PB-open'
    Hank: "I opened the jar."
  } else {
    Hank: "It's already open."
  }
})

items.pb.onUseItem(items.knife, () => {
  if (items.pb.animation === 'PB') {
    Hank: "I need to open the jar first."
  } else {
    items.knife.animation = 'Knife-PB'
    items.knife.cursorAnimation = 'Knife-PB'
    Hank: "Mmmm... gooey peanut butter."
  }
})
