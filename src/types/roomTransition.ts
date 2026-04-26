/**
 * Per-hook context for room leave / enter / enter-after-fade.
 *
 * - **`roomId`**: the room the hook applies to — the **room being left** for leave, the **room being entered** for enter / after-fade.
 * - **`lastRoom`**: previous `GameStateManager` last value at the **start of that transition phase** (useful for enter: where the player came from).
 * - **`isFirstEnter`**: `true` the first time the player **enters** this `roomId` in the current play session (transitions only; on initial boot, the first room is always first enter).
 */
export interface RoomTransitionContext {
  roomId: string;
  lastRoom: string | null;
  isFirstEnter: boolean;
}
