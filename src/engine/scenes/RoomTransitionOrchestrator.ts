import * as Phaser from 'phaser';
import { loadRoomDataById } from '../../game/boot/loadRoomData.js';
import { SCENE_ROOM } from '../../game/boot/constants.js';
import type { EventBus } from '../events/EventBus.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getAllGuiBenneScriptInstances } from '../scripting/registerGuiScript.js';
import { tryGetGlobalBenneScriptForRoomTransitions, setRoomTransitionInProgress } from './roomTransitionGlobals.js';
import { clearInteractionActivity } from '../interaction/interactionActivity.js';
import { BENNE_SCREEN_FADE_DEFAULT_COLOR, BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC } from './roomScreenFadeConstants.js';
import { buildRoomSceneStartDataFromRoomData, queueRoomSceneAssetLoads } from './roomSceneBootstrap.js';
import type { RoomSceneStartData } from './BootScene';
import type { RoomScene } from './RoomScene.js';
import {
  areHookEntriesSkippable,
  hookEntryHandlers,
  RoomTransitionHookRegistry,
  runRoomHandlersEachSafe,
  runRoomHandlersSeq,
} from './RoomTransitionHookRegistry.js';
import { getPlayFromSetupForRoom } from '../scripting/devPlayFromRegistry.js';
import { ensureRoomScriptLoaded } from '../scripting/registerRoomScript.js';
import type { RoomTransitionContext } from '../../types/roomTransition.js';
import type { BenneScriptCore } from '../scripting/BenneScriptCore.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';
import { BENNE_ROOM_START_KIND_KEY, type BenneRoomStartKind } from './roomStartKindConstants.js';
import { getRoomVisitCount, incrementRoomVisitCount } from '../gameState/roomVisitState.js';
import { syncBenneRuntimeHiDpiSceneMainCameras } from '../benneRuntimeHiDpiScale.js';

/**
 * **Runtime** service for `B.room.changeTo` — leave → fade → load → create → enter → fade → after-fade.
 */
export class RoomTransitionOrchestrator {
  private readonly game: Phaser.Game;
  private transitionChain: Promise<void> = Promise.resolve();
  private readonly sessionEnteredRoomIds = new Set<string>();
  private deferredRunComplete: (() => void) | null = null;
  /** From the last `changeTo` call; the new `RoomScene` should fade in (unless this is `true`). */
  private lastChangeImmediate = false;
  /** Set by `B.state.reset()`. The next `changeTo` treats the leave as a new game. */
  private pendingFreshStart = false;
  /** True while {@link runChangeToImpl} is still waiting on that room's enter / after-fade scripts. */
  private inRunChangeToImpl = false;
  /**
   * `changeTo` requested from those scripts. Started after the current run finishes so the
   * script queue is not awaiting the same transition that is awaiting the queue.
   */
  private deferredReentrantChange: { id: string; immediate: boolean; freshStart: boolean } | null =
    null;
  private readonly hooks: RoomTransitionHookRegistry;

  constructor(game: Phaser.Game, _events: EventBus, hooks: RoomTransitionHookRegistry) {
    void _events;
    this.game = game;
    this.hooks = hooks;
  }

  getHookRegistry(): RoomTransitionHookRegistry {
    return this.hooks;
  }

  /**
   * Call from the shipped {@link import('./BootScene.js').BootScene} when the start room’s assets have finished loading.
   * Sets `GameStateManager` **lastRoom** to **`null`**, **{@link BENNE_ROOM_START_KIND_KEY}** to **`'boot'`**,
   * and starts **`RoomScene`** so **{@link onRoomSceneCreateComplete}** runs the same **enter → fade in → after-fade**
   * path as in-game transitions (no **leave** hooks — there is no previous room).
   */
  startInitialRoomFromBoot(startData: RoomSceneStartData): void {
    const manager = resolveGameStateManager(this.game);
    manager.setLastRoom(null);
    this.game.registry.set(BENNE_ROOM_START_KIND_KEY, 'boot');
    this.game.scene.start(SCENE_ROOM, startData);
  }

  /**
   * The next {@link changeTo} skips the leave position flush, re-applies the new-game slice after
   * leave hooks, and does not copy the room being left into `lastRoom`.
   */
  armNextChangeAsFreshStart(): void {
    this.pendingFreshStart = true;
  }

  /**
   * Main transition; awaited on the Bennescript interaction chain when not immediate.
   */
  async changeTo(targetRoomId: string, immediate: boolean): Promise<void> {
    const id = String(targetRoomId);
    const freshStart = this.pendingFreshStart;
    this.pendingFreshStart = false;
    if (this.inRunChangeToImpl) {
      // Enter and after-fade scripts run inside this transition, and this run waits until their
      // queue drains. Awaiting another changeTo here would wait on that same run.
      this.deferredReentrantChange = { id, immediate, freshStart };
      return;
    }
    this.enqueueChange(id, immediate, freshStart);
    return this.transitionChain;
  }

  private enqueueChange(id: string, immediate: boolean, freshStart: boolean): void {
    this.transitionChain = this.transitionChain
      .then(() =>
        this.runChangeToImpl(id, immediate, {
          startKind: 'transition',
          forceRestart: freshStart,
          freshStart,
        }),
      )
      .catch((err) => {
        console.error('[Benne] Room transition failed:', err);
        setRoomTransitionInProgress(this.game, false);
      });
  }

  /** Runs a changeTo that was requested from the transition it would otherwise have waited on. */
  private flushDeferredReentrantChange(): void {
    const next = this.deferredReentrantChange;
    if (!next) {
      return;
    }
    this.deferredReentrantChange = null;
    this.enqueueChange(next.id, next.immediate, next.freshStart);
  }

  /**
   * Restart/transition into the room restored by `B.state.load(...)`.
   * Uses a dedicated `'load'` start kind so room scripts can run `B.whenLoadedRoom(...)`.
   */
  async transitionToLoadedRoom(immediate: boolean): Promise<void> {
    const manager = resolveGameStateManager(this.game);
    const targetRoomId = String(manager.getCurrentRoom() ?? '');
    if (targetRoomId.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] load transition: snapshot has no currentRoom; transition skipped.');
      }
      return;
    }
    this.transitionChain = this.transitionChain
      .then(() =>
        this.runChangeToImpl(targetRoomId, immediate, {
          startKind: 'load',
          forceRestart: true,
          preserveRoomContextFromSnapshot: true,
        }),
      )
      .catch((err) => {
        console.error('[Benne] Room load transition failed:', err);
        setRoomTransitionInProgress(this.game, false);
      });
    return this.transitionChain;
  }

  private async runChangeToImpl(
    targetRoomId: string,
    immediate: boolean,
    options: {
      startKind: BenneRoomStartKind;
      forceRestart: boolean;
      preserveRoomContextFromSnapshot?: boolean;
      /** New game: skip the leave flush, then replace state so leave hooks cannot leak. */
      freshStart?: boolean;
    },
  ): Promise<void> {
    this.inRunChangeToImpl = true;
    try {
      await this.runChangeToImplBody(targetRoomId, immediate, options);
    } catch (e) {
      this.deferredReentrantChange = null;
      setRoomTransitionInProgress(this.game, false);
      throw e;
    } finally {
      this.inRunChangeToImpl = false;
    }
    this.flushDeferredReentrantChange();
  }

  private async runChangeToImplBody(
    targetRoomId: string,
    immediate: boolean,
    options: {
      startKind: BenneRoomStartKind;
      forceRestart: boolean;
      preserveRoomContextFromSnapshot?: boolean;
      /** New game: skip the leave flush, then replace state so leave hooks cannot leak. */
      freshStart?: boolean;
    },
  ): Promise<void> {
    const fromScene = this.game.scene.getScene(SCENE_ROOM) as RoomScene | null;
    if (!fromScene) {
      console.error('[Benne] Room transition: no active RoomScene.');
      return;
    }
    const fromId = fromScene.getCurrentRoomId();
    if (!options.forceRestart && fromId === targetRoomId) {
      return;
    }

    this.lastChangeImmediate = immediate;
    setRoomTransitionInProgress(this.game, true);
    const manager = resolveGameStateManager(this.game);
    try {
      this.prepareForLeave(fromScene, manager, {
        preserveSnapshotState:
          options.preserveRoomContextFromSnapshot === true || options.freshStart === true,
      });
      const lastSnap = manager.getLastRoom();
      const leaveVisit = getRoomVisitCount(manager, fromId);
      const leaveCtx: RoomTransitionContext = {
        roomId: fromId,
        lastRoom: lastSnap,
        isFirstEnter: false,
        visitCount: leaveVisit,
      };
      await runRoomHandlersSeq(
        hookEntryHandlers([
          ...this.hooks.getLeaveHandlersForRoom(fromId),
          ...this.hooks.getAnyLeave(),
        ]),
        leaveCtx,
      );

      if (options.freshStart) {
        manager.resetToInitial({
          roomContext: { currentRoom: targetRoomId, lastRoom: null },
        });
        this.sessionEnteredRoomIds.clear();
      }

      if (!immediate) {
        await fromScene.queueScreenFadeToAlpha(
          1,
          BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
          BENNE_SCREEN_FADE_DEFAULT_COLOR,
        );
      } else {
        fromScene.screenFadeLayer?.setAlpha(1);
      }

      // After the fade, so a one-shot queued just before changeTo plays during it.
      this.stopLeavingRoomAudio();

      const room = loadRoomDataById(targetRoomId);
      const startData = buildRoomSceneStartDataFromRoomData(room);
      queueRoomSceneAssetLoads(fromScene, startData);

      await Promise.all([
        this.awaitLoaderComplete(fromScene),
        ensureRoomScriptLoaded(targetRoomId),
      ]);

      if (!options.freshStart && options.preserveRoomContextFromSnapshot !== true) {
        manager.setLastRoom(fromId);
        manager.setCurrentRoom(targetRoomId);
      }

      this.game.registry.set(BENNE_ROOM_START_KIND_KEY, options.startKind);
      const runDone = new Promise<void>((r) => {
        this.deferredRunComplete = r;
      });
      this.game.scene.start(SCENE_ROOM, startData);
      await runDone;
    } catch (e) {
      setRoomTransitionInProgress(this.game, false);
      throw e;
    }
  }

  private awaitLoaderComplete(fromScene: RoomScene): Promise<void> {
    return new Promise<void>((resolve) => {
      const l = fromScene.load;
      let done = false;
      const finish = (): void => {
        if (done) {
          return;
        }
        done = true;
        l.off(Phaser.Loader.Events.COMPLETE, onComplete);
        resolve();
      };
      const onComplete = (): void => {
        finish();
      };
      l.once(Phaser.Loader.Events.COMPLETE, onComplete);
      l.start();
      fromScene.time.delayedCall(0, () => {
        if (!l.isLoading()) {
          finish();
        }
      });
    });
  }

  /**
   * Finishes a transition: enter hooks, fade in, after-fade hooks. Also handles **boot** / **preview** (no `changeTo`).
   */
  async onRoomSceneCreateComplete(roomScene: RoomScene, kind: BenneRoomStartKind): Promise<void> {
    // Boot/preview enter this without `runChangeToImpl`. Hold the same re-entry guard so a
    // `changeTo` in those scripts waits until this pass finishes instead of tearing the room down
    // mid-queue.
    const deferChangeUntilDone = !this.inRunChangeToImpl;
    if (deferChangeUntilDone) {
      this.inRunChangeToImpl = true;
    }
    const roomId = roomScene.getCurrentRoomId();
    const manager = resolveGameStateManager(this.game);
    const finishDeferred = ((): void => {
      this.deferredRunComplete?.();
      this.deferredRunComplete = null;
    });
    const skipEnterFadeIn = this.lastChangeImmediate && kind === 'transition';
    this.lastChangeImmediate = false;
    try {
      if (kind === 'boot' || kind === 'preview') {
        const c = manager.getCurrentRoom();
        if (c == null || c.length === 0) {
          manager.setCurrentRoom(roomId);
        }
      }

      const visitCount = incrementRoomVisitCount(manager, roomId);
      const isFirst = !this.sessionEnteredRoomIds.has(roomId);
      if (isFirst) {
        this.sessionEnteredRoomIds.add(roomId);
      }
      const initialCtx: RoomTransitionContext = {
        roomId,
        lastRoom: manager.getLastRoom(),
        isFirstEnter: isFirst,
        visitCount,
      };
      if (kind === 'load') {
        await runRoomHandlersEachSafe(
          hookEntryHandlers(this.hooks.getAnyLoaded()),
          initialCtx,
          'onRoomSceneCreateComplete: any loaded',
        );
        await runRoomHandlersEachSafe(
          hookEntryHandlers(this.hooks.getLoadedHandlersForRoom(roomId)),
          initialCtx,
          'onRoomSceneCreateComplete: loaded',
        );
      }
      const enterEntries = [
        ...this.hooks.getAnyEnter(),
        ...this.hooks.getEnterHandlersForRoom(roomId),
      ];
      // Enter handlers and the enter-phase queue drain run inside a cutscene block so the room
      // is protected from player input during invisible setup (moveTo, music, etc.).
      roomScene.pushCutscene({ skippable: areHookEntriesSkippable(enterEntries) });
      let enterCtx = initialCtx;
      try {
        if (kind === 'boot' || kind === 'preview') {
          const g = globalThis as { __BENNE_PLAY_FROM_NAME?: unknown };
          const raw = g.__BENNE_PLAY_FROM_NAME;
          const playFromName = typeof raw === 'string' ? raw.trim() : '';
          g.__BENNE_PLAY_FROM_NAME = '';
          let didRunPlayFrom = false;
          if (playFromName.length > 0) {
            const playFromHandler = getPlayFromSetupForRoom(roomId, playFromName);
            if (playFromHandler) {
              didRunPlayFrom = true;
              try {
                await Promise.resolve(playFromHandler());
              } catch (playFromErr) {
                if (import.meta.env.DEV) {
                  console.warn(
                    `[Benne] Play From: setup '${playFromName}' threw an error`,
                    playFromErr,
                  );
                }
              }
            } else if (import.meta.env.DEV) {
              console.warn(
                `[Benne] Play From: no handler named '${playFromName}' for room '${roomId}'`,
              );
            }
          }
          if (didRunPlayFrom) {
            // Play From establishes the simulated prior game state. Drain its queued setup before
            // enter handlers so they observe inventory and other queued mutations as well as
            // immediate flags/room context.
            await roomScene.waitForEnterPhaseBenneScriptQueues();
            enterCtx = {
              roomId,
              lastRoom: manager.getLastRoom(),
              isFirstEnter: isFirst,
              visitCount: getRoomVisitCount(manager, roomId),
            };
          }
        }

        if (kind !== 'load') {
          await runRoomHandlersEachSafe(
            hookEntryHandlers(enterEntries),
            enterCtx,
            'onRoomSceneCreateComplete: room enter',
          );
        }

        await roomScene.waitForEnterPhaseBenneScriptQueues();
      } finally {
        roomScene.popCutscene();
      }

      roomScene.setCharacterFollowBehaviorEnabled(true);

      // Wake the output device before the room is revealed. An entrance SFX scheduled
      // while that device is still opening is heard seconds after the script asked for it.
      const entranceSound = tryGetBenneSoundManager(this.game);
      if (entranceSound && !entranceSound.isAudioRunning()) {
        roomScene.screenFadeLayer?.setAlpha(1);
        await entranceSound.prepareForPlayback();
      }

      if (skipEnterFadeIn) {
        roomScene.screenFadeLayer?.setAlpha(0);
      } else {
        syncBenneRuntimeHiDpiSceneMainCameras(this.game);
        roomScene.syncRuntimeHiDpiUiCameraToMain();
        await new Promise<void>((resolve, reject) => {
          roomScene.time.delayedCall(0, () => {
            void roomScene
              .queueScreenFadeToAlpha(
                0,
                BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
                BENNE_SCREEN_FADE_DEFAULT_COLOR,
              )
              .then(resolve)
              .catch(reject);
          });
        });
      }

      const afterCtx: RoomTransitionContext = {
        roomId,
        lastRoom: enterCtx.lastRoom,
        isFirstEnter: isFirst,
        visitCount: enterCtx.visitCount,
      };
      // After-fade handlers (walk-in animations, visible cutscenes) also run inside a cutscene
      // block so input remains suppressed for their full duration.
      // Handlers are typically synchronous (they queue B.* steps on the interaction tail without
      // awaiting), so we must drain the tail with waitForEnterPhaseBenneScriptQueues() inside the
      // cutscene block — otherwise popCutscene() fires before say/walk/wait steps execute.
      const afterFadeEntries = [
        ...this.hooks.getAnyAfterFade(),
        ...this.hooks.getAfterFadeHandlersForRoom(roomId),
      ];
      roomScene.pushCutscene({ skippable: areHookEntriesSkippable(afterFadeEntries) });
      try {
        if (kind !== 'load') {
          await runRoomHandlersEachSafe(
            hookEntryHandlers(afterFadeEntries),
            afterCtx,
            'onRoomSceneCreateComplete: after-fade',
          );
          await roomScene.waitForEnterPhaseBenneScriptQueues();
        }
      } finally {
        roomScene.popCutscene();
      }
    } catch (e) {
      console.error('[Benne] onRoomSceneCreateComplete:', e);
    } finally {
      finishDeferred();
      setRoomTransitionInProgress(this.game, false);
      if (deferChangeUntilDone) {
        this.inRunChangeToImpl = false;
        this.flushDeferredReentrantChange();
      }
    }
  }

  /** Stop SFX and voice from the room being left. Failures must not abort the transition. */
  private stopLeavingRoomAudio(): void {
    const soundManager = tryGetBenneSoundManager(this.game);
    try {
      soundManager?.stopAllSfx();
      soundManager?.stopAllVoice();
    } catch (err) {
      console.warn('[Benne] Room transition: stopping leave audio failed.', err);
    }
  }

  private prepareForLeave(
    roomScene: RoomScene,
    mgr: ReturnType<typeof resolveGameStateManager>,
    options?: { preserveSnapshotState?: boolean },
  ): void {
    const preserveSnapshotState = options?.preserveSnapshotState === true;
    // Pull live character feet positions and prop authoring positions into game state BEFORE
    // tearing down the scene so the next room (re)load can restore them. See
    // `RoomScene.flushRuntimeStateToGameState` and `gameState/snapshotFlushHooks.ts`.
    if (!preserveSnapshotState) {
      roomScene.flushRuntimeStateToGameState();
      mgr.clearActiveVerb();
      mgr.clearActiveInventoryItem();
    }
    roomScene.clearStateForRoomTransition();
    for (const s of roomScene.getBenneScriptCoresForTransitionReset()) {
      s.resetInteractionTailForEngine();
    }
    const g = tryGetGlobalBenneScriptForRoomTransitions() as
      | (BenneScriptCore & { resetInteractionTailForEngine: () => void })
      | null;
    g?.resetInteractionTailForEngine();
    for (const script of getAllGuiBenneScriptInstances().values()) {
      script.resetInteractionTailForEngine();
    }
    clearInteractionActivity();
  }
}
