import type { RoomId } from '../../types/generated/benne-game-ids.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getRoomVisitCount } from '../gameState/roomVisitState.js';
import { tryGetRoomTransitionOrchestrator } from '../scenes/roomTransitionGlobals.js';
import type { BenneScriptRoomFacade } from './benneScriptFacades.js';
import { withNow } from './BenneScriptCore.js';

type ChainFn = (factory: () => Promise<unknown>) => void;

/**
 * Shared **`B.room`** object for all Bennescript facades. Uses the active {@link import('../scenes/RoomTransitionOrchestrator.js').RoomTransitionOrchestrator} for transitions.
 */
export function createBenneScriptRoomFacade(
  chain: ChainFn,
  changeToNowImpl: (roomId: RoomId) => void,
): BenneScriptRoomFacade {
  const makeChangeTo = (): BenneScriptRoomFacade['changeTo'] =>
    withNow(
      (roomId: RoomId) => {
        const orch = tryGetRoomTransitionOrchestrator();
        if (!orch) {
          if (import.meta.env.DEV) {
            console.warn('[Benne] B.room.changeTo: no room transition orchestrator — no-op (preview?).');
          }
          return;
        }
        chain(() => orch.changeTo(String(roomId), false));
      },
      (roomId: RoomId) => {
        changeToNowImpl(String(roomId));
      },
    );

  return {
    get current(): string {
      return tryGetActiveGameStateManager()?.getCurrentRoom() ?? '';
    },
    get last(): string | null {
      return tryGetActiveGameStateManager()?.getLastRoom() ?? null;
    },
    get visitCount(): number {
      const m = tryGetActiveGameStateManager();
      const roomId = m?.getCurrentRoom() ?? '';
      if (roomId.length === 0 || !m) {
        return 0;
      }
      return getRoomVisitCount(m, roomId);
    },
    get isFirstVisit(): boolean {
      return this.visitCount === 1;
    },
    changeTo: makeChangeTo(),
    changeToNow: (roomId: RoomId) => {
      changeToNowImpl(String(roomId));
    },
  };
}

/**
 * `changeTo.now` and {@link createBenneScriptRoomFacade} `.changeToNow` use this when a subclass has no
 * interaction queue of its own.
 */
export function defaultRoomChangeToNow(this: void, roomId: RoomId): void {
  const orch = tryGetRoomTransitionOrchestrator();
  if (!orch) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] B.room.changeToNow: no room transition orchestrator — no-op (preview?).');
    }
    return;
  }
  void orch.changeTo(roomId, true);
}

/**
 * Binds the room facade to a {@link BenneScriptCore} subclass: **`changeTo`** uses its interaction
 * tail; **`changeToNow`** is fire-and-forget.
 */
export function bindRoomFacadeForBenneScriptCore(chain: ChainFn): BenneScriptRoomFacade {
  return createBenneScriptRoomFacade(chain, defaultRoomChangeToNow);
}
