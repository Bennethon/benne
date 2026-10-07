import type { CutsceneOptions } from '../../types/cutscene.js';
import type { RoomTransitionContext } from '../../types/roomTransition.js';

type RoomHandler = (ctx: RoomTransitionContext) => void | Promise<void>;
type AnyHandler = (ctx: RoomTransitionContext) => void | Promise<void>;

/**
 * A registered hook plus the {@link CutsceneOptions} it was registered with. Enter / after-fade
 * hooks run inside an automatic cutscene, so **`skippable: false`** on any handler in a batch makes
 * that whole cutscene unskippable (see {@link import('./RoomTransitionOrchestrator.js').RoomTransitionOrchestrator}).
 */
export interface RoomTransitionHookEntry {
  handler: RoomHandler;
  skippable: boolean;
}

/** True when every hook in the batch allows ESC skipping (empty batch counts as skippable). */
export function areHookEntriesSkippable(entries: readonly RoomTransitionHookEntry[]): boolean {
  return entries.every((entry) => entry.skippable);
}

/** Unwraps entries for {@link runRoomHandlersEachSafe} / {@link runRoomHandlersSeq}. */
export function hookEntryHandlers(entries: readonly RoomTransitionHookEntry[]): RoomHandler[] {
  return entries.map((entry) => entry.handler);
}

function toEntry(handler: RoomHandler, options?: CutsceneOptions): RoomTransitionHookEntry {
  return { handler, skippable: options?.skippable !== false };
}

/**
 * All room-transition hooks (per-room and global) live here so {@link import('./RoomTransitionOrchestrator.js').RoomTransitionOrchestrator} can run them in order.
 */
export class RoomTransitionHookRegistry {
  private readonly byRoomLeave = new Map<string, RoomTransitionHookEntry[]>();
  private readonly byRoomLoaded = new Map<string, RoomTransitionHookEntry[]>();
  private readonly byRoomEnter = new Map<string, RoomTransitionHookEntry[]>();
  private readonly byRoomAfterFade = new Map<string, RoomTransitionHookEntry[]>();
  private anyLeave: RoomTransitionHookEntry[] = [];
  private anyLoaded: RoomTransitionHookEntry[] = [];
  private anyEnter: RoomTransitionHookEntry[] = [];
  private anyAfterFade: RoomTransitionHookEntry[] = [];

  registerRoomLeaveRoom(roomId: string, handler: RoomHandler): void {
    this.pushByRoom(this.byRoomLeave, roomId, toEntry(handler));
  }

  registerRoomEnterRoom(roomId: string, handler: RoomHandler, options?: CutsceneOptions): void {
    this.pushByRoom(this.byRoomEnter, roomId, toEntry(handler, options));
  }

  registerRoomLoadedRoom(roomId: string, handler: RoomHandler): void {
    this.pushByRoom(this.byRoomLoaded, roomId, toEntry(handler));
  }

  registerRoomEnterRoomAfterFade(
    roomId: string,
    handler: RoomHandler,
    options?: CutsceneOptions,
  ): void {
    this.pushByRoom(this.byRoomAfterFade, roomId, toEntry(handler, options));
  }

  registerAnyLeaveRoom(handler: AnyHandler): void {
    this.anyLeave.push(toEntry(handler));
  }

  registerAnyLoadedRoom(handler: AnyHandler): void {
    this.anyLoaded.push(toEntry(handler));
  }

  registerAnyEnterRoom(handler: AnyHandler, options?: CutsceneOptions): void {
    this.anyEnter.push(toEntry(handler, options));
  }

  registerAnyEnterRoomAfterFade(handler: AnyHandler, options?: CutsceneOptions): void {
    this.anyAfterFade.push(toEntry(handler, options));
  }

  private pushByRoom(
    m: Map<string, RoomTransitionHookEntry[]>,
    roomId: string,
    entry: RoomTransitionHookEntry,
  ): void {
    const k = String(roomId);
    const a = m.get(k) ?? [];
    a.push(entry);
    m.set(k, a);
  }

  getLeaveHandlersForRoom(roomId: string): readonly RoomTransitionHookEntry[] {
    return this.byRoomLeave.get(String(roomId)) ?? [];
  }

  getEnterHandlersForRoom(roomId: string): readonly RoomTransitionHookEntry[] {
    return this.byRoomEnter.get(String(roomId)) ?? [];
  }

  getLoadedHandlersForRoom(roomId: string): readonly RoomTransitionHookEntry[] {
    return this.byRoomLoaded.get(String(roomId)) ?? [];
  }

  getAfterFadeHandlersForRoom(roomId: string): readonly RoomTransitionHookEntry[] {
    return this.byRoomAfterFade.get(String(roomId)) ?? [];
  }

  getAnyLeave(): readonly RoomTransitionHookEntry[] {
    return this.anyLeave;
  }

  getAnyLoaded(): readonly RoomTransitionHookEntry[] {
    return this.anyLoaded;
  }

  getAnyEnter(): readonly RoomTransitionHookEntry[] {
    return this.anyEnter;
  }

  getAnyAfterFade(): readonly RoomTransitionHookEntry[] {
    return this.anyAfterFade;
  }

  /**
   * Clears per-room hooks so the room's handlers can re-register (each `RoomScene` `create`
   * attaches the room module's handlers again).
   */
  clearPerRoomScriptHooksForRoomId(roomId: string): void {
    const k = String(roomId);
    this.byRoomLeave.delete(k);
    this.byRoomLoaded.delete(k);
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
