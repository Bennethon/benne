import type { RoomPropInteractPayload } from '../events/propInteractionEvents.js';

/** Payload for whenGive — prop interaction plus the item id from the sugar API. */
export type GivePropInteractPayload = RoomPropInteractPayload & { itemId: string };
