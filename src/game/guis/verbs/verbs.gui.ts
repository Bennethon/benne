import { pointer } from '@benne/script';
import { guis, verbs } from '@game';
import {
  gui, closeBtn, giveBtn, lookAtBtn, menuBtn, openBtn, pickUpBtn, pullBtn, pushBtn, talkToBtn, useBtn, verbLineText,
} from './verbs.ids';

const buttons = new Map([
  [verbs.give, giveBtn],
  [verbs.pickUp, pickUpBtn],
  [verbs.use, useBtn],
  [verbs.open, openBtn],
  [verbs.look, lookAtBtn],
  [verbs.push, pushBtn],
  [verbs.close, closeBtn],
  [verbs.talkTo, talkToBtn],
  [verbs.pull, pullBtn],
])

// Clicking a verb button makes it the verb for the next click on the room.
for (const [verb, button] of buttons) button.onClick(() => verb.select())

menuBtn.onClick(() => guis.gameMenu.show())

// The verb line ("Use Knife with Bread"), and the hovered thing's default verb lit up.
function refresh() {
  verbLineText.text = pointer.sentence
  const highlighted = pointer.hover?.defaultVerb
  for (const [verb, button] of buttons) {
    button.visualState = verb === highlighted ? 'hover' : 'normal'
  }
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
