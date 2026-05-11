import * as Phaser from 'phaser';
import { syncBenneGuiAsepriteAuthoredWorldPosition } from '../aseprite/asepriteFramePlacement';
import {
  BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY,
  BENNE_GUI_BUTTON_VISUAL_SCRIPT_LOCK_DATA_KEY,
  type BenneGuiButtonApplyVisualStateFn,
  parseBenneGuiScriptButtonVisualState,
} from '../gui/guiButtonVisualStateScript.js';
import { syncOutlinedGuiBitmapTextAll, syncOutlinedGuiBitmapTextPositions } from '../gui/guiTextOutline';
import { withNow, type BlockingWithNow } from './BenneScriptCore.js';

export type ControlTweenProps = Partial<Phaser.Types.Tweens.TweenBuilderConfig>;

/**
 * Authoring handle for one control’s live Phaser object; tweens can queue on the owning GUI script’s interaction tail.
 */
export class ControlFacade {
  readonly gameObject: Phaser.GameObjects.GameObject;

  readonly tweenTo: BlockingWithNow<[props: ControlTweenProps, duration?: number, easing?: string]>;

  private readonly scene: Phaser.Scene;

  constructor(
    gameObject: Phaser.GameObjects.GameObject,
    scene: Phaser.Scene,
    queueInteraction: (factory: () => Promise<unknown>) => void,
  ) {
    this.gameObject = gameObject;
    this.scene = scene;

    const runTween = (
      props: ControlTweenProps,
      duration: number | undefined,
      easing: string | undefined,
      resolve?: () => void,
    ): Phaser.Tweens.Tween => {
      const { onComplete: userOnComplete, targets: _ignoreTargets, duration: dProp, ease: easeProp, ...rest } = props;
      const dur = duration ?? dProp ?? 0;
      const ease = easing ?? easeProp ?? 'Linear';
      return this.scene.tweens.add({
        targets: this.gameObject,
        ...rest,
        duration: dur,
        ease,
        onComplete: (tw: Phaser.Tweens.Tween, targets: unknown[]) => {
          userOnComplete?.(tw, targets);
          resolve?.();
        },
      });
    };

    this.tweenTo = withNow(
      (props: ControlTweenProps, duration?: number, easing?: string) => {
        queueInteraction(
          () =>
            new Promise<void>((resolve) => {
              runTween(props, duration, easing, resolve);
            }),
        );
      },
      (props: ControlTweenProps, duration?: number, easing?: string) => {
        runTween(props, duration, easing);
      },
    );
  }

  setX(x: number): void {
    const go = this.gameObject as Phaser.GameObjects.Sprite & {
      getData?: (key: string) => unknown;
      setData?: (key: string, value: unknown) => void;
    };
    if (typeof go.getData === 'function' && go.getData('benneGuiUsesAuthoredAsepritePlacement') === true) {
      go.setData?.('benneGuiAuthoredX', x);
      syncBenneGuiAsepriteAuthoredWorldPosition(go);
      return;
    }
    if (typeof go.setX === 'function') {
      go.setX(x);
    } else if (typeof go.x === 'number') {
      go.x = x;
    }
    if (go instanceof Phaser.GameObjects.BitmapText) {
      syncOutlinedGuiBitmapTextPositions(go);
    }
    /* DOMElement has no outline siblings to sync */
  }

  setY(y: number): void {
    const go = this.gameObject as Phaser.GameObjects.Sprite & {
      getData?: (key: string) => unknown;
      setData?: (key: string, value: unknown) => void;
    };
    if (typeof go.getData === 'function' && go.getData('benneGuiUsesAuthoredAsepritePlacement') === true) {
      go.setData?.('benneGuiAuthoredY', y);
      syncBenneGuiAsepriteAuthoredWorldPosition(go);
      return;
    }
    if (typeof go.setY === 'function') {
      go.setY(y);
    } else if (typeof go.y === 'number') {
      go.y = y;
    }
    if (go instanceof Phaser.GameObjects.BitmapText) {
      syncOutlinedGuiBitmapTextPositions(go);
    }
  }

  setVisible(visible: boolean): void {
    const go = this.gameObject as { setVisible?: (v: boolean) => void; visible?: boolean };
    if (typeof go.setVisible === 'function') {
      go.setVisible(visible);
    } else {
      go.visible = visible;
    }
  }

  setAlpha(alpha: number): void {
    const go = this.gameObject as { setAlpha?: (v: number) => void; alpha?: number };
    if (typeof go.setAlpha === 'function') {
      go.setAlpha(alpha);
    } else {
      go.alpha = alpha;
    }
  }

  private tryGetGuiTextSurface(): Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text | Phaser.GameObjects.DOMElement | null {
    const go = this.gameObject;
    if (
      go instanceof Phaser.GameObjects.BitmapText ||
      go instanceof Phaser.GameObjects.Text ||
      go instanceof Phaser.GameObjects.DOMElement
    ) {
      return go;
    }
    return null;
  }

  /** **`text`** controls (`BitmapText` / `Text` / `DOMElement`). Throws if this control is not text-backed. */
  get text(): string {
    const t = this.tryGetGuiTextSurface();
    if (!t) {
      throw new Error('[Benne] GUI control `.text` requires a BitmapText, Text, or DOMElement game object.');
    }
    if (t instanceof Phaser.GameObjects.DOMElement) {
      return t.node instanceof HTMLElement ? t.node.innerText : '';
    }
    return t.text;
  }

  set text(value: string) {
    const t = this.tryGetGuiTextSurface();
    if (!t) {
      throw new Error('[Benne] GUI control `.text` requires a BitmapText, Text, or DOMElement game object.');
    }
    if (t instanceof Phaser.GameObjects.BitmapText) {
      syncOutlinedGuiBitmapTextAll(t, value);
    } else if (t instanceof Phaser.GameObjects.DOMElement) {
      t.setText(value);
    } else {
      t.setText(value);
    }
  }

  /**
   * Forces the **button** sheet label + background chrome to a named state (same frames / tints pointer
   * interaction would use). **`'normal'`** also releases a script override so pointer hover / press works again.
   * @throws When this control is not a composable **`button`** hit target.
   */
  setVisualState(state: string): void {
    const go = this.gameObject as Phaser.GameObjects.GameObject & {
      getData?: (key: string) => unknown;
      setData?: (key: string, value: unknown) => void;
    };
    const applyRaw =
      typeof go.getData === 'function' ? go.getData(BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY) : undefined;
    if (typeof applyRaw !== 'function') {
      throw new Error('[Benne] GUI control `.setVisualState` is only supported on `button` controls.');
    }
    const apply = applyRaw as BenneGuiButtonApplyVisualStateFn;
    const normalized = parseBenneGuiScriptButtonVisualState(state);
    apply(normalized);
    if (typeof go.setData === 'function') {
      go.setData(BENNE_GUI_BUTTON_VISUAL_SCRIPT_LOCK_DATA_KEY, normalized !== 'normal');
    }
  }
}

/**
 * Forgiving **`B.gui(…).control('missing')`** path: invisible container + **`.text`** no-ops (**`BitmapText`** on real
 * controls still uses the base {@link ControlFacade} **`.text`** implementation).
 */
export class NoopGuiControlFacade extends ControlFacade {
  constructor(scene: Phaser.Scene, queueInteraction: (factory: () => Promise<unknown>) => void) {
    const holder = scene.add.container(0, 0);
    holder.setVisible(false);
    super(holder, scene, queueInteraction);
  }

  override get text(): string {
    return '';
  }

  override set text(_value: string) {
    /* forgiving missing / non-text control */
  }

  override setVisualState(_state: string): void {
    /* forgiving missing control / non-button */
  }
}

export function createBenneNoopGuiControlFacade(
  scene: Phaser.Scene,
  queueInteraction: (factory: () => Promise<unknown>) => void,
): ControlFacade {
  return new NoopGuiControlFacade(scene, queueInteraction);
}

/**
 * When no {@link Phaser.Scene} exists yet (**`GuiBenneScript`** before the game boots). Same authoring surface as
 * {@link ControlFacade}; skips real tween targets.
 */
export function createDetachedBenneNoopGuiControlFacade(
  queueInteraction: (factory: () => Promise<unknown>) => void,
): ControlFacade {
  return new DetachedNoopGuiControlFacade(queueInteraction) as unknown as ControlFacade;
}

class DetachedNoopGuiControlFacade {
  readonly gameObject: Phaser.GameObjects.GameObject;

  readonly tweenTo: BlockingWithNow<[props: ControlTweenProps, duration?: number, easing?: string]>;

  constructor(queueInteraction: (factory: () => Promise<unknown>) => void) {
    this.gameObject = undefined as unknown as Phaser.GameObjects.GameObject;
    this.tweenTo = withNow(
      (_props?: ControlTweenProps, _dur?: number, _ease?: string) => {
        queueInteraction(() => Promise.resolve());
      },
      (_props?: ControlTweenProps, _dur?: number, _ease?: string) => {
        /* immediate */
      },
    );
  }

  setX(_x: number): void {}
  setY(_y: number): void {}
  setVisible(_visible: boolean): void {}
  setAlpha(_alpha: number): void {}

  get text(): string {
    return '';
  }

  set text(_value: string) {}

  setVisualState(_state: string): void {}
}

export interface GuiRuntimeOptions {
  scene: Phaser.Scene;
  guiId: string;
  /** Overlay base depth from {@link buildGuiOverlay} (same as the packed content root). */
  baseDepth: number;
  /**
   * Parent for every **non-fixed** authored control (see **`GuiData.fixedControls`**). Tween {@link GuiRuntime.root}
   * to move that packed subtree; listed fixed controls stay scene-rooted siblings and are not parented here.
   */
  contentRoot: Phaser.GameObjects.Container;
  controlGameObjectsById: ReadonlyMap<string, Phaser.GameObjects.GameObject>;
  queueInteraction: (factory: () => Promise<unknown>) => void;
}

/**
 * Per-overlay GUI behavior surface: whole-GUI {@link GuiRuntime.root} facade and per-control lookup.
 * Constructed after {@link buildGuiOverlay}; call {@link dispose} (or destroy the overlay handle) on room teardown.
 *
 * **Hover events** (pointer enter / leave) for any control with an **`id`** — including the dedicated **`trigger`**
 * control type — are routed through Bennescript (**`B.whenMouseEnter`** / **`B.whenMouseLeave`**), not this class.
 */
export class GuiRuntime {
  readonly guiId: string;
  /** The scene hosting this overlay (scale, tweens, input). */
  readonly scene: Phaser.Scene;
  /**
   * The root container for the **packed** authored GUI: every control **except** those listed in **`fixedControls`**
   * on the GUI JSON (those stay outside this container so they do not move with root-level tweens).
   * Tweening or moving this (via **`tweenTo`**, **`setY`**, …) affects only that subtree — same interaction queue as
   * {@link getControl} facades.
   */
  readonly root: ControlFacade;

  private readonly queueInteraction: (factory: () => Promise<unknown>) => void;
  private readonly controlObjects: ReadonlyMap<string, Phaser.GameObjects.GameObject>;
  private readonly facadeCache = new Map<string, ControlFacade>();
  private disposed = false;

  constructor(options: GuiRuntimeOptions) {
    this.scene = options.scene;
    this.guiId = options.guiId;
    this.controlObjects = options.controlGameObjectsById;
    this.queueInteraction = options.queueInteraction;

    this.root = new ControlFacade(options.contentRoot, options.scene, options.queueInteraction);
  }

  /**
   * Resolves a control by **`id`** from **`*.gui.json`**, or **`null`** if missing / blank / unknown.
   * Use this when a control may legitimately be absent and you will branch (optional UI, feature flags).
   * When the control must exist for the behavior to make sense, prefer {@link getControlOrThrow} so callers get a **`ControlFacade`** without null checks.
   */
  getControl(controlId: string): ControlFacade | null {
    const id = controlId.trim();
    if (!id) {
      return null;
    }
    const existing = this.facadeCache.get(id);
    if (existing) {
      return existing;
    }
    const go = this.controlObjects.get(id);
    if (!go) {
      return null;
    }
    const facade = new ControlFacade(go, this.scene, this.queueInteraction);
    this.facadeCache.set(id, facade);
    return facade;
  }

  /**
   * Same as {@link getControl}, but throws if the control is missing (unknown id, blank string, or not in the overlay).
   * Recommended default for `onGuiBuilt` wiring when a missing control indicates an authoring bug.
   */
  getControlOrThrow(controlId: string): ControlFacade {
    const facade = this.getControl(controlId);
    if (!facade) {
      const id = controlId.trim();
      throw new Error(
        `[Benne] GUI "${this.guiId}" has no control with id "${id.length > 0 ? id : controlId}" (check *.gui.json and buildGuiOverlay control ids).`,
      );
    }
    return facade;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const fac of this.facadeCache.values()) {
      this.scene.tweens.killTweensOf(fac.gameObject);
    }
    this.facadeCache.clear();
    this.scene.tweens.killTweensOf(this.root.gameObject);
  }
}
