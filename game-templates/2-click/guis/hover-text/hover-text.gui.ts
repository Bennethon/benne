import { pointer } from '@benne/script';
import { gui, text } from './hover-text.ids';

// Shows the name of the prop, hotspot or character under the pointer: its description, else its id.
function refresh() {
  const hover = pointer.hover
  const inRoom = hover?.kind === 'prop' || hover?.kind === 'hotspot' || hover?.kind === 'character'
  const label = inRoom ? (hover.description?.trim() || hover.id?.trim() || '') : ''
  if (label) text.text = label
  gui.root.visible = label !== ''
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
