import { game } from '@benne/script';
import { fallbacks } from '@game';

// Global fallbacks: a verb used on something with no handler of its own.
fallbacks.onLook(() => { Player: `Nothing special about that.` })
fallbacks.onUse(() => { Player: `That doesn't work.` })
fallbacks.onTake(() => { Player: `I can't take that.` })
fallbacks.onTalkTo(() => { Player: `I don't have anything to say to that.` })
fallbacks.onClean(() => { Player: `I don't need to clean that.` })
fallbacks.onMove(() => { Player: `It doesn't move.` })

// A verb added to game-config.json later, without a fallback above.
fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine ?? "That doesn't work." })

// An item used on something that has no handler for it.
fallbacks.onItemUnhandled(() => { Player: `That doesn't work.` })
