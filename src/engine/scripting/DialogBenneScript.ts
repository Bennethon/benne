import * as Phaser from 'phaser';
import { SCENE_ROOM } from '../../game/boot/constants.js';
import { gameEvents } from '../events/EventBus.js';
import {
  DIALOG_OPTION_ENABLED_CHANGED_EVENT,
  DIALOG_STARTED_EVENT,
  dialogChoiceSyntheticButtonId,
  type DialogOptionEnabledChangedPayload,
  type DialogStartedPayload,
} from '../events/dialogEvents.js';
import { guiButtonClickEventId } from '../events/guiButtonEvents.js';
import { getDialogDefinition } from '../dialog/dialogDefinitionRegistry.js';
import {
  BENNE_ACTIVE_DIALOG_ID_VARIABLE,
  dialogOptionEnabledVariableKey,
} from '../dialog/dialogOptionVariables.js';
import type { CutsceneOptions } from '../../types/cutscene.js';
import type { DialogId, DialogOptionId } from '../../types/generated/benne-game-ids.js';
import type { GameStateManager } from '../gameState/GameStateManager.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { BenneScriptCore, withNow, type BlockingWithNow } from './BenneScriptCore.js';
import type { BenneScriptDialogCommandSurface, BenneScriptPlayerFacade } from './benneScriptFacades.js';
import {
  createBenneScriptGameStateNamespace,
  createBenneScriptInventoryNamespace,
  type BenneScriptGameStateNamespace,
  type BenneScriptInventoryNamespace,
} from './benneScriptGameStateApi.js';
import {
  endDialogSessionIfMatches,
  getActiveDialogBenneScript,
  setActiveDialogBenneScript,
} from './dialogSession.js';
import { getBenneDialogScriptRegistrations } from './registerDialogScript.js';
import type { DialogScriptContext } from './types.js';

const warnedSelfStart = new Set<string>();
const warnedUnknownOption = new Set<string>();

export type BenneScriptDialogInteractionQueue = (factory: () => Promise<unknown>) => void;

function warnSelfStartOnce(dialogId: string): void {
  if (!import.meta.env.DEV || warnedSelfStart.has(dialogId)) {
    return;
  }
  warnedSelfStart.add(dialogId);
  console.warn(
    `[Benne] B.start() inside registerDialogScript("${dialogId}") is a no-op — open the dialog from another script with B.dialog("${dialogId}").start().`,
  );
}

function warnUnknownDialogOptionOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || warnedUnknownOption.has(key)) {
    return;
  }
  warnedUnknownOption.add(key);
  console.warn(`[Benne] ${message}`);
}

/** No-op surface when `B.dialog` is used before the game or dialog id is invalid. */
export function createNoopDialogCommandSurface(): BenneScriptDialogCommandSurface {
  const noop = withNow(
    () => {},
    () => {},
  );
  const noopOpt = withNow(
    (_optionId: DialogOptionId) => {},
    (_optionId: DialogOptionId) => {},
  );
  return {
    start: noop,
    stop: noop,
    optionOn: noopOpt,
    optionOff: noopOpt,
  };
}

function createDialogCommandSurface(params: {
  targetDialogId: string;
  game: Phaser.Game;
  manager: GameStateManager;
  queue: BenneScriptDialogInteractionQueue;
  mode: 'external' | 'self';
}): BenneScriptDialogCommandSurface {
  const { targetDialogId, game, manager, queue, mode } = params;

  const applyOptionEnabled = (optionId: string, enabled: boolean): void => {
    const id = optionId.trim();
    if (!id) {
      return;
    }
    const def = getDialogDefinition(targetDialogId);
    if (!def) {
      warnUnknownDialogOptionOnce(
        `dialog:${targetDialogId}`,
        `B.dialog("${targetDialogId}").option*: unknown dialog id — ignored.`,
      );
      return;
    }
    if (!def.options.some((o) => o.id === id)) {
      warnUnknownDialogOptionOnce(
        `dialog:${targetDialogId}:opt:${id}`,
        `B.dialog("${targetDialogId}").option*("${id}"): unknown option id for this dialog — variable still written.`,
      );
    }
    manager.setVariable(dialogOptionEnabledVariableKey(targetDialogId, id), enabled);
    const payload: DialogOptionEnabledChangedPayload = {
      dialogId: targetDialogId,
      optionId: id,
      enabled,
    };
    gameEvents.emit(DIALOG_OPTION_ENABLED_CHANGED_EVENT, payload);
  };

  const start =
    mode === 'self'
      ? withNow(
          () =>
            queue(() => {
              warnSelfStartOnce(targetDialogId);
              return Promise.resolve();
            }),
          () => warnSelfStartOnce(targetDialogId),
        )
      : withNow(
          () => {
            queue(() => {
              openDialogSessionForId(game, targetDialogId);
              return Promise.resolve();
            });
          },
          () => {
            openDialogSessionForId(game, targetDialogId);
          },
        );

  const stop = withNow(
    () => {
      queue(() => {
        const active = getActiveDialogBenneScript();
        if (active && active.dialogId === targetDialogId) {
          endDialogSessionIfMatches(active);
        }
        return Promise.resolve();
      });
    },
    () => {
      const active = getActiveDialogBenneScript();
      if (active && active.dialogId === targetDialogId) {
        endDialogSessionIfMatches(active);
      }
    },
  );

  const optionOn = withNow(
    (optionId: string) => {
      queue(() => {
        applyOptionEnabled(optionId, true);
        return Promise.resolve();
      });
    },
    (optionId: string) => {
      applyOptionEnabled(optionId, true);
    },
  );

  const optionOff = withNow(
    (optionId: string) => {
      queue(() => {
        applyOptionEnabled(optionId, false);
        return Promise.resolve();
      });
    },
    (optionId: string) => {
      applyOptionEnabled(optionId, false);
    },
  );

  return { start, stop, optionOn, optionOff };
}

/**
 * `B.dialog(id)` — queues session open/close and option visibility on the owning script’s interaction tail.
 */
export function createBenneScriptDialogAccessor(
  manager: GameStateManager,
  game: Phaser.Game,
  queue: BenneScriptDialogInteractionQueue,
): (dialogId: DialogId) => BenneScriptDialogCommandSurface {
  return (dialogId: DialogId) => {
    const id = dialogId.trim();
    if (!id) {
      if (import.meta.env.DEV) {
        console.warn('[Benne] B.dialog: empty id — returning no-op surface.');
      }
      return createNoopDialogCommandSurface();
    }
    return createDialogCommandSurface({
      targetDialogId: id,
      game,
      manager,
      queue,
      mode: 'external',
    });
  };
}

/**
 * Opens a dialog session (used by **`B.dialog(id).start()`** and **`.start.now()`**).
 */
export function openDialogSessionForId(game: Phaser.Game, dialogId: DialogId): void {
  const trimmed = dialogId.trim();
  if (!trimmed) {
    if (import.meta.env.DEV) {
      console.warn('[Benne] openDialogSessionForId: empty dialog id — ignored.');
    }
    return;
  }

  const def = getDialogDefinition(trimmed);
  if (!def) {
    if (import.meta.env.DEV) {
      console.warn(`[Benne] openDialogSessionForId: unknown dialog id "${trimmed}" — ignored.`);
    }
    return;
  }

  const prev = getActiveDialogBenneScript();
  if (prev) {
    endDialogSessionIfMatches(prev);
  }

  const manager = resolveGameStateManager(game);
  const choiceGuiId = def.guiId ?? 'dialog';
  const script = new DialogBenneScript(gameEvents, trimmed, game, choiceGuiId);
  setActiveDialogBenneScript(script);
  manager.setVariable(BENNE_ACTIVE_DIALOG_ID_VARIABLE, trimmed);

  const started: DialogStartedPayload = { dialogId: trimmed, guiId: choiceGuiId };
  gameEvents.emit(DIALOG_STARTED_EVENT, started);

  const ctx: DialogScriptContext = {
    B: script,
    events: gameEvents,
    dialogId: trimmed,
    game,
  };

  for (const { dialogId: rid, registerFn } of getBenneDialogScriptRegistrations()) {
    if (rid !== trimmed) {
      continue;
    }
    if (getActiveDialogBenneScript() !== script) {
      break;
    }
    try {
      registerFn(ctx);
    } catch (err) {
      console.error(`[Benne] Error in registerDialogScript("${trimmed}") callback:`, err);
    }
  }
}

/**
 * Bennescript facade for `*.dialog.ts`: constructed when a dialog session opens.
 */
export class DialogBenneScript extends BenneScriptCore implements BenneScriptDialogCommandSurface {
  readonly dialogId: string;
  /** GUI overlay that receives synthetic `dc__*` choice button ids (from `*.dialog.json` `guiId`). */
  readonly dialogGuiId: string;
  readonly game: Phaser.Game;

  readonly state: BenneScriptGameStateNamespace;
  readonly inventory: BenneScriptInventoryNamespace;

  readonly dialog: (id: string) => BenneScriptDialogCommandSurface;

  readonly start: BlockingWithNow<[]>;
  readonly stop: BlockingWithNow<[]>;
  readonly optionOn: BlockingWithNow<[string]>;
  readonly optionOff: BlockingWithNow<[string]>;

  constructor(events: Phaser.Events.EventEmitter, dialogId: string, game: Phaser.Game, dialogGuiId: string) {
    super(
      events,
      () => {
        const room = game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
        return room?.time ?? null;
      },
      () => game.scene.getScene(SCENE_ROOM) as RoomScene | undefined,
    );
    this.dialogId = dialogId;
    this.dialogGuiId = dialogGuiId.trim() || 'dialog';
    this.game = game;
    const manager = resolveGameStateManager(game);
    this.state = createBenneScriptGameStateNamespace(manager);
    this.inventory = createBenneScriptInventoryNamespace(
      manager,
      () => game.scene.getScene(SCENE_ROOM) as RoomScene | undefined,
      (factory) => this.chain(factory),
    );

    const selfCommands = createDialogCommandSurface({
      targetDialogId: dialogId,
      game,
      manager,
      queue: (factory) => this.chain(factory),
      mode: 'self',
    });
    this.start = selfCommands.start;
    this.stop = selfCommands.stop;
    this.optionOn = selfCommands.optionOn;
    this.optionOff = selfCommands.optionOff;

    this.dialog = createBenneScriptDialogAccessor(manager, game, (factory) => this.chain(factory));
  }

  get player(): BenneScriptPlayerFacade {
    return this.makePlayerFacadeFromScene(() => this.game.scene.getScene(SCENE_ROOM) as RoomScene | undefined);
  }

  /**
   * Runs when the player activates a dialog line whose `optionId` matches (see {@link dialogChoiceSyntheticButtonId}).
   *
   * If the option’s JSON sets `say` to `true` (the default), `B.player.say` is invoked with the option’s `text`
   * **before** this handler runs (skipped when `say` is `false` or `text` is empty/whitespace).
   *
   * While the handler’s synchronous work plus any interaction-tail steps (`say`, `walk`, etc.) run, the
   * dialog choice GUI is hidden so additional options cannot be activated.
   *
   * @param options `{ skippable: false }` makes this branch's cutscene unskippable by ESC (see
   * {@link BenneScriptCore.cutscene}).
   */
  whenChoice(
    optionId: DialogOptionId,
    handler: (() => void) | ((payload: { optionId: string }) => void),
    options?: CutsceneOptions,
  ): void {
    const id = optionId.trim();
    if (!id) {
      return;
    }
    const syn = dialogChoiceSyntheticButtonId(id);
    const eventId = guiButtonClickEventId(this.dialogGuiId, syn);
    const guiId = this.dialogGuiId;
    const dialogScriptId = this.dialogId;

    const wrapped = async (payload: unknown) => {
      const room = this.game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
      room?.suppressDialogChoiceGuiForWhenChoice(guiId);
      // Wrap the entire handler + interaction-tail drain in a cutscene block so additional
      // dialog options and other input are suppressed while the choice plays out.
      room?.pushCutscene(options);

      this.beginInteraction();
      try {
        this.pushVerbWalkContext(payload);
        try {
          const def = getDialogDefinition(dialogScriptId);
          const opt = def?.options.find((o) => o.id === id);
          const shouldAutoSay = opt == null || opt.say !== false;
          const line = (opt?.text ?? '').trim();
          if (shouldAutoSay && line.length > 0) {
            this.player.say(line);
          }
          if (handler.length === 0) {
            (handler as () => void)();
          } else {
            (handler as (p: { optionId: string }) => void)({ optionId: id });
          }
        } finally {
          this.popVerbWalkContext();
        }
        await this.endInteraction();
      } catch (err) {
        console.error(`[Benne] Error in ${eventId} dialog whenChoice handler:`, err);
      } finally {
        room?.popCutscene();
        const rm = this.game.scene.getScene(SCENE_ROOM) as RoomScene | undefined;
        rm?.restoreDialogChoiceGuiAfterWhenChoiceDrain(guiId, dialogScriptId);
      }
    };

    this.events.on(eventId, wrapped);
    this.registerDisposable(() => this.events.off(eventId, wrapped));
  }
}
