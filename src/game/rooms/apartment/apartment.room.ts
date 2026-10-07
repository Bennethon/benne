import { display, faceClicked, fadeIn, fadeOut, inventory, player, playFrom, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms, sfx } from '@game';
import { room, bread, couch, door, hank, knife, peanutButter, penny, regions, table, windowHotspot } from './apartment.ids';

room.onEnter(() => {
  if (!music.isPlaying) music.myCatIsCrazy.play()
})

room.onEnterAfterFade(() => {
  if (room.cameFrom(rooms.outside)) {
    wait(0.5)
    sfx.doorClose.play()
    door.animation = 'Door'
  }
})

// ── The door ──

// One handler for two verbs.
door.on(['open', 'use'], () => {
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

penny.onTalkTo(() => {
  walkToClicked()
  Hank: "Hey Penny!"
  Penny: "Hi!"
  dialogs.chatwithpenny.start()
})

// Any other item given to Penny falls through to "That doesn't work." in globalScript.ts.
penny.onGiveItem(items.sammich, () => {
  walkToClicked()
  Hank: "Here, Penny! Have a sandwich."
  inventory.remove(items.sammich)
  Penny: "Thank you! Here's the key."
  inventory.add(items.key)
})

penny.onOpen(() => {
  penny.fade(0.5, 1)
})

penny.onClose(() => {
  penny.hide()
})

// Switching who the player controls.
penny.onPush(() => {
  player.switchTo(penny)
  penny.clickable = false
  hank.clickable = true
})

hank.onPush(() => {
  player.switchTo(hank)
  penny.clickable = true
  hank.clickable = false
})

// ── The couch ──

couch.onLook(() => {
  faceClicked()
  Hank: "It's my weird, magical, poorly drawn couch."
})

couch.onPull(() => {
  walkToClicked()
  Player: "It's too heavy."
})

couch.onClose(() => {
  fadeOut(2, 0x00ff00)
  wait(1)
  fadeIn(2, 0x00ff00)
})

couch.onOpen(() => {
  couch.fade(0.5, 1)
})

couch.onTalkTo(() => {
  couch.moveTo({ x: 5, y: 5 })
})

couch.onPush(() => {
  if (windowHotspot.active) {
    windowHotspot.active = false
    Hank: "Goodbye window."
  } else {
    windowHotspot.active = true
    Hank: "Hello window."
  }
})

couch.onUseItem(items.broom, () => {
  player.walkTo(couch)
  faceClicked()
  Player: "I used the broom on the couch."
})

couch.onGiveItem(items.broom, () => {
  player.walkTo(couch)
  player.face('U')
  Player: "Here, couch."
  inventory.remove(items.broom)
})

// ── The table ──

table.onLook(() => {
  // `|1|` is a voice marker: the line's voice file (see the voice-ID export).
  Player: "|1| I like to keep this table here so I can walk around it."
})

table.onUse(() => {
  walkToClicked()
})

table.onUseItem(items.broom, () => {
  walkToClicked()
  sfx.sweeping.playAndWait()
  Player: "I cleaned the table."
})

// ── Sandwich ingredients ──

bread.onLook(() => {
  faceClicked()
  Hank: "It's some bread."
})

bread.onPickUp(() => {
  walkToClicked()
  inventory.add(items.bread)
  bread.hide()
})

bread.onUseItem(items.broom, () => {
  Hank: "I don't need to clean the bread."
})

bread.onGiveItem(items.broom, () => {
  Hank: "I can't give something to bread."
})

knife.onLook(() => {
  faceClicked()
  Hank: "It's a knife."
})

knife.onPickUp(() => {
  walkToClicked()
  inventory.add(items.knife)
  knife.hide()
})

peanutButter.onLook(() => {
  faceClicked()
  Hank: "It's some peanut butter."
})

peanutButter.onPickUp(() => {
  walkToClicked()
  inventory.add(items.pb)
  peanutButter.hide()
})

// ── Regions ──

regions.darkness.onEnter(() => {
  Hank: "It's dark over here."
})

// ── Play From: start the room in a later state (editor dropdown) ──

playFrom('gotKey', () => {
  inventory.add(items.key)
})

playFrom('doorUnlocked', () => {
  flags.unlockedDoor = true
})
