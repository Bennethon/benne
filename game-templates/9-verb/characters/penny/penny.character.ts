import { characters } from '@game';

// Penny's handlers in every room she is in. The apartment's own `penny.onLook(…)` wins over this one.

characters.penny.onLook(() => {
  Player: "It's Penny."
})
