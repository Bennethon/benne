import { game } from '@benne/script';
import { fallbacks } from '@game';

// Global fallbacks: a verb used on something with no handler of its own (in the room script, the
// character script or the item script). Put any code here: lines, animations, state changes.
fallbacks.onLook(() => { Player: `Nothing special about that.` })
fallbacks.onUse(() => { Player: `That doesn't work.` })
fallbacks.onPickUp(() => { Player: `I can't take that.` })
fallbacks.onPush(() => { Player: `It won't move.` })
fallbacks.onPull(() => { Player: `It won't move.` })
fallbacks.onOpen(() => { Player: `I can't open that.` })
fallbacks.onClose(() => { Player: `That doesn't need closing.` })
fallbacks.onTalkTo(() => { Player: `I don't have anything to say to that.` })
fallbacks.onGive(() => { Player: `I can't give that.` })

// A verb added to game-config.json later, without a fallback above.
fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine ?? "That doesn't work." })

// An item used on something that has no handler for it.
fallbacks.onItemUnhandled(() => { Player: `That doesn't work.` })

// Optional hooks for every room change:
//   game.onEnterAnyRoom((from) => { … })           before the fade-in: invisible setup
//   game.onEnterAnyRoomAfterFade((from) => { … })  after the fade-in: visible entrances
//   game.onLeaveAnyRoom(() => { … })
// and for per-frame code (not sequenced): onUpdate((dt) => { … })
