import * as Phaser from 'phaser';
import { gameEvents } from '../events/EventBus.js';
import { guiButtonClickEventId } from '../events/guiButtonEvents.js';
import { guiCheckboxCheckEventId, guiCheckboxUncheckEventId } from '../events/guiCheckboxEvents.js';
import { guiControlMouseEnterEventId, guiControlMouseLeaveEventId } from '../events/guiControlHoverEvents.js';
import { guiListBoxSelectionChangedEventId, type GuiListBoxSelectionChangedPayload } from '../events/guiListBoxEvents.js';
import { guiSliderValueChangedEventId, type GuiSliderValueChangedPayload } from '../events/guiSliderEvents.js';
import { guiTextInputValueChangedEventId, type GuiTextInputValueChangedPayload } from '../events/guiTextInputEvents.js';
import type { ControlFacade, GuiRuntime } from '../scripting/GuiRuntime.js';
import { getGuiBenneScript } from '../scripting/registerGuiScript.js';
import { runDetached, runHandler, warnIfUntransformed } from './interactionContext.js';
import { liveRoomScene } from './scene.js';
import { Task } from './task.js';

/**
 * GUI scripting (§4.15). GUI scripts load once, before any room, so their handlers register at
 * module top level and stay subscribed; the GUIs themselves are rebuilt with every room, and
 * {@link notifyGuiBuilt} runs `gui.onBuilt` each time.
 *
 * Button handlers are sequenced like any handler but don't take the gameplay interaction lock or
 * block saving. Value, selection and hover callbacks run immediately, outside any handler.
 */

type Handler = (...args: never[]) => unknown;

function devWarn(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[Benne] ${message}`);
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

type Lifecycle = 'built' | 'show' | 'hide';

const lifecycle = new Map<string, Handler[]>();

export function registerGuiLifecycleHandler(guiId: string, kind: Lifecycle, handler: Handler): void {
  warnIfUntransformed(`guis ${guiId} on${kind}`, handler);
  const key = `${guiId}:${kind}`;
  const list = lifecycle.get(key) ?? [];
  list.push(handler);
  lifecycle.set(key, list);
}

function runLifecycle(guiId: string, kind: Lifecycle): void {
  for (const handler of lifecycle.get(`${guiId}:${kind}`) ?? []) {
    runDetached(`gui ${guiId} on${kind}`, handler);
  }
}

/** Does `guiId` have new-style lifecycle handlers? `RoomScene` then builds its runtime. */
export function hasGuiHandlers(guiId: string): boolean {
  return (['built', 'show', 'hide'] as const).some((k) => (lifecycle.get(`${guiId}:${k}`)?.length ?? 0) > 0);
}

/** `RoomScene`, after building a GUI overlay and its runtime. */
export function notifyGuiBuilt(guiId: string): void {
  runLifecycle(guiId, 'built');
}

/** Any show / hide of a GUI by script, old or new API. */
export function notifyGuiVisibility(guiId: string, visible: boolean): void {
  runLifecycle(guiId, visible ? 'show' : 'hide');
}

/** Shows or hides a GUI in the active room and tells its scripts (old and new). */
export function setGuiVisible(guiId: string, visible: boolean): void {
  const room = liveRoomScene();
  const handle = room?.tryGetGuiOverlayHandle(guiId);
  if (!handle) {
    devWarn(`guis.${guiId}.${visible ? 'show' : 'hide'}(): this GUI is not in the active room — ignored.`);
    return;
  }
  handle.setVisible(visible);
  const oldScript = getGuiBenneScript(guiId);
  const rt = room?.tryGetGuiRuntime(guiId);
  if (oldScript && rt) {
    if (visible) {
      oldScript.notifyGuiShown(rt);
    } else {
      oldScript.notifyGuiHidden(rt);
    }
  }
  notifyGuiVisibility(guiId, visible);
}

export function guiRuntime(guiId: string): GuiRuntime | null {
  return liveRoomScene()?.tryGetGuiRuntime(guiId) ?? null;
}

// ─── Control events ──────────────────────────────────────────────────────────

/** `x.onClick(…)`: a sequenced handler that doesn't take the gameplay lock (§4.15). */
export function registerGuiClick(guiId: string, controlId: string, handler: Handler): void {
  warnIfUntransformed(`guis ${guiId} ${controlId} onClick`, handler);
  gameEvents.on(guiButtonClickEventId(guiId, controlId), () => {
    void runHandler(`gui ${guiId} ${controlId} click`, liveRoomScene(), null, handler, [], { gameplay: false });
  });
}

/**
 * `x.onChange((value) => …)`: a slider's number, a text input's text, or a checkbox's checked
 * state, whichever this control is. Runs immediately (drags fire many changes).
 */
export function registerGuiChange(guiId: string, controlId: string, handler: Handler): void {
  const label = `gui ${guiId} ${controlId} change`;
  gameEvents.on(guiSliderValueChangedEventId(guiId, controlId), (p: unknown) =>
    runDetached(label, handler, [(p as GuiSliderValueChangedPayload).value]),
  );
  gameEvents.on(guiTextInputValueChangedEventId(guiId, controlId), (p: unknown) =>
    runDetached(label, handler, [(p as GuiTextInputValueChangedPayload).newValue]),
  );
  gameEvents.on(guiCheckboxCheckEventId(guiId, controlId), () => runDetached(label, handler, [true]));
  gameEvents.on(guiCheckboxUncheckEventId(guiId, controlId), () => runDetached(label, handler, [false]));
}

/** `list.onSelect((index) => …)` on a list box. */
export function registerGuiSelect(guiId: string, controlId: string, handler: Handler): void {
  gameEvents.on(guiListBoxSelectionChangedEventId(guiId, controlId), (p: unknown) =>
    runDetached(`gui ${guiId} ${controlId} select`, handler, [(p as GuiListBoxSelectionChangedPayload).newIndex]),
  );
}

/** `x.onMouseEnter` / `onMouseLeave`: immediate, as today. */
export function registerGuiHover(guiId: string, controlId: string, leave: boolean, handler: Handler): void {
  const eventId = leave ? guiControlMouseLeaveEventId(guiId, controlId) : guiControlMouseEnterEventId(guiId, controlId);
  gameEvents.on(eventId, () => runDetached(`gui ${guiId} ${controlId} hover`, handler));
}

// ─── Tweens ──────────────────────────────────────────────────────────────────

/** Tweens a control's game object. Skip and `finishNow` jump to the end values. */
export function tweenControl(
  facade: ControlFacade,
  props: Record<string, number>,
  seconds: number,
  options: { ease?: string; clickToSkip?: boolean } = {},
): Task {
  const go = facade.gameObject as Phaser.GameObjects.GameObject & Record<string, unknown>;
  const scene = go.scene;
  const room = liveRoomScene();
  const applyEnd = () => {
    for (const [key, value] of Object.entries(props)) {
      go[key] = value;
    }
  };
  if (!scene || room?.isCutsceneSkipFastForwarding()) {
    applyEnd();
    return Task.resolved();
  }
  let finish!: (snap: boolean) => void;
  const done = new Promise<void>((resolve) => {
    let completed = false;
    let tween: Phaser.Tweens.Tween | null = null;
    finish = (snap) => {
      if (completed) {
        return;
      }
      completed = true;
      if (tween) {
        tween.stop();
      }
      if (snap) {
        applyEnd();
      }
      if (options.clickToSkip) {
        room?.clearScriptedDialogClickToSkipIf(onClick);
      }
      resolve();
    };
    const onClick = () => finish(true);
    tween = scene.tweens.add({
      targets: go,
      ...props,
      duration: Math.max(0, seconds * 1000),
      ease: options.ease ?? 'Linear',
      onComplete: () => finish(true),
    });
    if (options.clickToSkip) {
      room?.setScriptedDialogClickToSkip(onClick);
    }
  });
  return new Task(done, { finishNow: () => finish(true), cancel: () => finish(false) });
}
