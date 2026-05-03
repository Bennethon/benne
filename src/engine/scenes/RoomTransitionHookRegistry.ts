import type { RoomTransitionContext } from '../../types/roomTransition.js';

type RoomHandler = (ctx: RoomTransitionContext) => void | Promise<void>;
type AnyHandler = (ctx: RoomTransitionContext) => void | Promise<void>;

/**
 * All room-transition hooks (per-room and global) live here so {@link import('./RoomTransitionOrchestrator.js').RoomTransitionOrchestrator} can run them in order.
 */
export class RoomTransitionHookRegistry {
  private readonly byRoomLeave = new Map<string, RoomHandler[]>();
  private readonly byRoomEnter = new Map<string, RoomHandler[]>();
  private readonly byRoomAfterFade = new Map<string, RoomHandler[]>();
  private anyLeave: AnyHandler[] = [];
  private anyEnter: AnyHandler[] = [];
  private anyAfterFade: AnyHandler[] = [];

  registerRoomLeaveRoom(roomId: string, handler: RoomHandler): void {
    this.pushByRoom(this.byRoomLeave, roomId, handler);
  }

  registerRoomEnterRoom(roomId: string, handler: RoomHandler): void {
    this.pushByRoom(this.byRoomEnter, roomId, handler);
  }

  registerRoomEnterRoomAfterFade(roomId: string, handler: RoomHandler): void {
    this.pushByRoom(this.byRoomAfterFade, roomId, handler);
  }

  whenLeaveAnyRoom(handler: AnyHandler): void {
    this.anyLeave.push(handler);
  }

  whenEnterAnyRoom(handler: AnyHandler): void {
    this.anyEnter.push(handler);
  }

  whenEnterAnyRoomAfterFade(handler: AnyHandler): void {
    this.anyAfterFade.push(handler);
  }

  private pushByRoom(m: Map<string, RoomHandler[]>, roomId: string, h: RoomHandler): void {
    const k = String(roomId);
    const a = m.get(k) ?? [];
    a.push(h);
    m.set(k, a);
  }

  getLeaveHandlersForRoom(roomId: string): readonly RoomHandler[] {
    return this.byRoomLeave.get(String(roomId)) ?? [];
  }

  getEnterHandlersForRoom(roomId: string): readonly RoomHandler[] {
    return this.byRoomEnter.get(String(roomId)) ?? [];
  }

  getAfterFadeHandlersForRoom(roomId: string): readonly RoomHandler[] {
    return this.byRoomAfterFade.get(String(roomId)) ?? [];
  }

  getAnyLeave(): readonly AnyHandler[] {
    return this.anyLeave;
  }

  getAnyEnter(): readonly AnyHandler[] {
    return this.anyEnter;
  }

  getAnyAfterFade(): readonly AnyHandler[] {
    return this.anyAfterFade;
  }

  /**
   * Clears per-room hooks so `registerRoomScript` can re-register (each `RoomScene` `create` runs
   * the same `*.room.ts` again).
   */
  clearPerRoomScriptHooksForRoomId(roomId: string): void {
    const k = String(roomId);
    this.byRoomLeave.delete(k);
    this.byRoomEnter.delete(k);
    this.byRoomAfterFade.delete(k);
  }
}

export async function runRoomHandlersSeq(
  handlers: readonly ((ctx: RoomTransitionContext) => void | Promise<void>)[],
  ctx: RoomTransitionContext,
): Promise<void> {
  for (const h of handlers) {
    await Promise.resolve(h(ctx));
  }
}

/**
 * Invokes each handler in order; an error in one does not skip the rest (used for enter / after-fade hooks).
 */
export async function runRoomHandlersEachSafe(
  handlers: readonly ((ctx: RoomTransitionContext) => void | Promise<void>)[],
  ctx: RoomTransitionContext,
  logLabel: string,
): Promise<void> {
  for (let i = 0; i < handlers.length; i += 1) {
    try {
      await Promise.resolve(handlers[i]!(ctx));
    } catch (e) {
      console.error(`[Benne] ${logLabel} handler #${i} failed:`, e);
    }
  }
}
