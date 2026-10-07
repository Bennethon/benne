import { penny } from './penny.ids';

// Penny's handlers in every room she is in. The apartment's own `penny.onLook(…)` wins over this one.

penny.onLook(() => {
  Player: `It's Penny.`
})
