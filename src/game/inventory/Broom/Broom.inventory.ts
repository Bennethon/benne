import { items } from '@game';

// Use and Give still arm the broom for using it on something: no handler needed for that.

items.broom.onLook(() => {
  Player: `The broom is a broom.`
})

items.broom.onPickUp(() => {
  Player: `I already have the broom.`
})

items.broom.onTalkTo(() => {
  Player: `I can't talk to the broom.`
})

items.broom.onOpen(() => {
  Player: `I can't open the broom.`
})

items.broom.onClose(() => {
  Player: `I can't close the broom.`
})

items.broom.onPush(() => {
  Player: `I can't push the broom.`
})

items.broom.onPull(() => {
  Player: `I can't pull the broom.`
})
