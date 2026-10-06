import { faceClicked } from '@benne/script';
import { characters } from '@game';

// Henry's handlers in every room he is in. A room script's own `henry.onLook(…)` wins over these.

characters.henry.onLook(() => {
  faceClicked()
  Player: "It looks like my buddy, Henry."
})

characters.henry.onPickUp(() => {
  faceClicked()
  Player: "He's too heavy."
})
