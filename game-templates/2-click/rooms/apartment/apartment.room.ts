import { display, faceClicked, inventory, player, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms, sfx } from '@game';
import { room, bread, couch, door, knife, peanutButter, penny, table } from './apartment.ids';

room.onEnter(() => {
  if (!music.isPlaying) {
    music.myCatIsCrazy.play()
  } else {
    music.myCatIsCrazy.play({ fadeSeconds: 5 })
  }
})

room.onEnterAfterFade(() => {
  if (room.cameFrom(rooms.outside)) {
    wait(0.5)
    sfx.doorClose.play()
    door.animation = 'Door'
  }
})

// ── The door ──

door.onLook(() => {
  Player: "It's the door to the outside."
})

door.onUse(() => {
  walkToClicked()
  if (flags.unlockedDoor) {
    door.animation = 'Door-open'
    sfx.doorOpen.playAndWait()
    rooms.outside.goTo()
  } else {
    Hank: "The door is locked."
    display("The door is locked. AHH! I can't get out! HELP ME! HELP ME! SOMEBODY HELP ME! PLEASE HELP ME!")
    display("Ok calm down.")
  }
})

// Any other item used on the door falls through to "That doesn't work." in globalScript.ts.
door.onUseItem(items.key, () => {
  walkToClicked()
  flags.unlockedDoor = true
  inventory.remove(items.key)
  Player: "The door is unlocked."
})

// ── Penny ──

penny.onLook(() => {
  Player: "It's Penny."
})

penny.onUse(() => {
  walkToClicked()
  Player: "Hey Penny!"
  dialogs.chatwithpenny.start()
})

penny.onUseItem(items.sammich, () => {
  walkToClicked()
  Hank: "Here, Penny! Have a sandwich."
  inventory.remove(items.sammich)
  Penny: "Thank you! Here's the key."
  inventory.add(items.key)
})

// ── Furniture ──

couch.onLook(() => {
  faceClicked()
  Hank: "It's my weird, poorly drawn couch."
})

couch.onUseItem(items.broom, () => {
  player.walkTo(couch)
  faceClicked()
  Player: "I used the broom on the couch."
})

table.onLook(() => {
  Player: "I like to keep this table here so I can walk around it."
})

table.onUse(() => {
  walkToClicked()
})

table.onUseItem(items.broom, () => {
  walkToClicked()
  sfx.sweeping.playAndWait()
  Player: "I cleaned the table."
})

// ── Sandwich ingredients: Use picks them up ──

peanutButter.onLook(() => {
  faceClicked()
  Hank: "It's some peanut butter."
})

peanutButter.onUse(() => {
  walkToClicked()
  inventory.add(items.pb)
  peanutButter.hide()
})

knife.onLook(() => {
  faceClicked()
  Hank: "It's a knife."
})

knife.onUse(() => {
  walkToClicked()
  inventory.add(items.knife)
  knife.hide()
})

bread.onLook(() => {
  faceClicked()
  Hank: "It's some bread."
})

bread.onUse(() => {
  walkToClicked()
  inventory.add(items.bread)
  bread.hide()
})
