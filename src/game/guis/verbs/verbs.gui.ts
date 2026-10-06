import { pointer } from '@benne/script';
import { guis, verbs } from '@game';
import { gui, cleanBtn, lookAtBtn, menuBtn, moveBtn, takeBtn, talkToBtn, useBtn, verbLineText } from './verbs.ids';

const buttons = new Map([
  [verbs.look, lookAtBtn],
  [verbs.use, useBtn],
  [verbs.take, takeBtn],
  [verbs.talkTo, talkToBtn],
  [verbs.move, moveBtn],
  [verbs.clean, cleanBtn],
])

for (const [verb, button] of buttons) button.onClick(() => verb.select())

menuBtn.onClick(() => guis.gameMenu.show())

// The verb line ("Use Coffee with Coffee maker"), and the hovered thing's default verb lit up.
function refresh() {
  verbLineText.text = pointer.sentence
  const highlighted = pointer.hover?.defaultVerb
  for (const [verb, button] of buttons) {
    button.visualState = verb === highlighted ? 'hover' : 'normal'
  }
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
