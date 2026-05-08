/**
 * Per-hook context for room leave / enter / enter-after-fade.
 *
 * - **`roomId`**: the room the hook applies to — the **room being left** for leave, the **room being entered** for enter / after-fade.
 * - **`lastRoom`**: previous `GameStateManager` last value at the **start of that transition phase** (useful for enter: where the player came from).
 * - **`isFirstEnter`**: `true` the first time the player **enters** this `roomId` in the current browser session (in-memory; transitions only; on initial boot, the first room is always first enter). Distinct from persisted **`visitCount`** / **`B.room.isFirstVisit`**.
 * - **`visitCount`**: persisted **cumulative** number of times the player has **entered** this `roomId` (including this load). For **leave** hooks, this is the count **after** the last enter (no increment on leave). For **enter** / **after-fade**, this is the count **after** the engine incremented for this entry (starts at **1** on the first-ever enter).
 */
export interface RoomTransitionContext {
  roomId: string;
  lastRoom: string | null;
  isFirstEnter: boolean;
  visitCount: number;
}
