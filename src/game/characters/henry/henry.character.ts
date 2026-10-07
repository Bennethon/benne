import { faceClicked } from '@benne/script';
import { henry } from './henry.ids';

// Henry's handlers in every room he is in. A room script's own `henry.onLook(…)` wins over these.

henry.onLook(() => {
  faceClicked()
  Player: "It looks like my buddy, Henry."
})

henry.onPickUp(() => {
  faceClicked()
  Player: "He's too heavy."
})
