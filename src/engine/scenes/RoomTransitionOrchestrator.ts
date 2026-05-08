import * as Phaser from 'phaser';
import { loadRoomDataById } from '../../game/loadRoomData.js';
import { SCENE_ROOM } from '../../game/constants.js';
import type { EventBus } from '../events/EventBus.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getAllGuiBenneScriptInstances } from '../scripting/registerGuiScript.js';
import { tryGetGlobalBenneScriptForRoomTransitions, setRoomTransitionInProgress } from './roomTransitionGlobals.js';
import { BENNE_SCREEN_FADE_DEFAULT_COLOR, BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC } from './roomScreenFadeConstants.js';
import { buildRoomSceneStartDataFromRoomData, queueRoomSceneAssetLoads } from './roomSceneBootstrap.js';
import type { RoomSceneStartData } from './BootScene';
import type { RoomScene } from './RoomScene.js';
import {
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
   * Main transition; awaited on the Bennescript interaction chain when not immediate.
   */
  async changeTo(targetRoomId: string, immediate: boolean): Promise<void> {
    const id = String(targetRoomId);
    this.transitionChain = this.transitionChain
      .then(() => this.runChangeToImpl(id, immediate))
      .catch((err) => {
        console.error('[Benne] Room transition failed:', err);
        setRoomTransitionInProgress(this.game, false);
      });
    return this.transitionChain;
  }

  private async runChangeToImpl(targetRoomId: string, immediate: boolean): Promise<void> {
    const fromScene = this.game.scene.getScene(SCENE_ROOM) as RoomScene | null;
    if (!fromScene) {
      console.error('[Benne] Room transition: no active RoomScene.');
      return;
    }
    const fromId = fromScene.getCurrentRoomId();
    if (fromId === targetRoomId) {
      return;
    }

    this.lastChangeImmediate = immediate;
    setRoomTransitionInProgress(this.game, true);
    const manager = resolveGameStateManager(this.game);
    try {
      this.prepareForLeave(fromScene, manager);
      const lastSnap = manager.getLastRoom();
      const leaveCtx: RoomTransitionContext = { roomId: fromId, lastRoom: lastSnap, isFirstEnter: false };
      await runRoomHandlersSeq(
        [...this.hooks.getLeaveHandlersForRoom(fromId), ...this.hooks.getAnyLeave()],
        leaveCtx,
      );

      if (!immediate) {
        await fromScene.queueScreenFadeToAlpha(
          1,
          BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
          BENNE_SCREEN_FADE_DEFAULT_COLOR,
        );
      } else {
        fromScene.screenFadeLayer?.setAlpha(1);
      }

      const room = loadRoomDataById(targetRoomId);
      const startData = buildRoomSceneStartDataFromRoomData(room);
      queueRoomSceneAssetLoads(fromScene, startData);

      await Promise.all([
        this.awaitLoaderComplete(fromScene),
        ensureRoomScriptLoaded(targetRoomId),
      ]);

      manager.setLastRoom(fromId);
      manager.setCurrentRoom(targetRoomId);

      this.game.registry.set(BENNE_ROOM_START_KIND_KEY, 'transition');
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

      const isFirst = !this.sessionEnteredRoomIds.has(roomId);
      if (isFirst) {
        this.sessionEnteredRoomIds.add(roomId);
      }
      const lastForEnter = manager.getLastRoom();
      const enterCtx: RoomTransitionContext = { roomId, lastRoom: lastForEnter, isFirstEnter: isFirst };
      // Enter handlers and the enter-phase queue drain run inside a cutscene block so the room
      // is protected from player input during invisible setup (moveTo, music, etc.).
      roomScene.pushCutscene();
      try {
        await runRoomHandlersEachSafe(
          [...this.hooks.getEnterHandlersForRoom(roomId), ...this.hooks.getAnyEnter()],
          enterCtx,
          'onRoomSceneCreateComplete: room enter',
        );

        if (kind === 'boot' || kind === 'preview') {
          const g = globalThis as { __BENNE_PLAY_FROM_NAME?: unknown };
          const raw = g.__BENNE_PLAY_FROM_NAME;
          const playFromName = typeof raw === 'string' ? raw.trim() : '';
          g.__BENNE_PLAY_FROM_NAME = '';
          if (playFromName.length > 0) {
            const playFromHandler = getPlayFromSetupForRoom(roomId, playFromName);
            if (playFromHandler) {
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
        }

        await roomScene.waitForEnterPhaseBenneScriptQueues();
      } finally {
        roomScene.popCutscene();
      }

      if (skipEnterFadeIn) {
        roomScene.screenFadeLayer?.setAlpha(0);
      } else {
        await roomScene.queueScreenFadeToAlpha(
          0,
          BENNE_SCREEN_FADE_DEFAULT_DURATION_SEC,
          BENNE_SCREEN_FADE_DEFAULT_COLOR,
        );
      }

      const afterCtx: RoomTransitionContext = { roomId, lastRoom: lastForEnter, isFirstEnter: isFirst };
      // After-fade handlers (walk-in animations, visible cutscenes) also run inside a cutscene
      // block so input remains suppressed for their full duration.
      // Handlers are typically synchronous (they queue B.* steps on the interaction tail without
      // awaiting), so we must drain the tail with waitForEnterPhaseBenneScriptQueues() inside the
      // cutscene block — otherwise popCutscene() fires before say/walk/wait steps execute.
      roomScene.pushCutscene();
      try {
        await runRoomHandlersEachSafe(
          [...this.hooks.getAfterFadeHandlersForRoom(roomId), ...this.hooks.getAnyAfterFade()],
          afterCtx,
          'onRoomSceneCreateComplete: after-fade',
        );
        await roomScene.waitForEnterPhaseBenneScriptQueues();
      } finally {
        roomScene.popCutscene();
      }
    } catch (e) {
      console.error('[Benne] onRoomSceneCreateComplete:', e);
    } finally {
      finishDeferred();
      setRoomTransitionInProgress(this.game, false);
    }
  }

  private prepareForLeave(roomScene: RoomScene, mgr: ReturnType<typeof resolveGameStateManager>): void {
    mgr.clearActiveVerb();
    mgr.clearActiveInventoryItem();
    tryGetBenneSoundManager(this.game)?.stopAllSfx();
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
  }
}
