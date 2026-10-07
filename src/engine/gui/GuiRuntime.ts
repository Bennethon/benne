import * as Phaser from 'phaser';
import { syncBenneGuiAsepriteAuthoredWorldPosition } from '../aseprite/asepriteFramePlacement.js';
import {
  BENNE_GUI_BUTTON_APPLY_VISUAL_STATE_DATA_KEY,
  BENNE_GUI_BUTTON_VISUAL_SCRIPT_LOCK_DATA_KEY,
  type BenneGuiButtonApplyVisualStateFn,
  parseBenneGuiScriptButtonVisualState,
} from './guiButtonVisualStateScript.js';
import {
  BENNE_GUI_CHECKBOX_DATA_KEY,
  BENNE_GUI_CHECKBOX_SET_CHECKED_DATA_KEY,
  BENNE_GUI_CHECKBOX_SET_DISABLED_DATA_KEY,
  benneGuiCheckboxReadChecked,
  benneGuiCheckboxReadDisabled,
  type BenneGuiCheckboxSetCheckedFn,
  type BenneGuiCheckboxSetDisabledFn,
} from './guiCheckboxRuntime.js';
import {
  BENNE_GUI_SLIDER_DATA_KEY,
  BENNE_GUI_SLIDER_SET_VALUE_DATA_KEY,
  benneGuiSliderReadValue,
  type BenneGuiSliderSetValueFn,
} from './guiSliderRuntime.js';
import {
  BENNE_GUI_BUTTON_DATA_KEY,
  BENNE_GUI_BUTTON_SET_ENABLED_DATA_KEY,
  benneGuiButtonReadEnabled,
  type BenneGuiButtonSetEnabledFn,
} from './guiButtonRuntime.js';
import {
  BENNE_GUI_TEXT_INPUT_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_FOCUSED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_ENABLED_DATA_KEY,
  BENNE_GUI_TEXT_INPUT_SET_TEXT_DATA_KEY,
  benneGuiTextInputReadEnabled,
  benneGuiTextInputReadFocused,
  benneGuiTextInputReadText,
  type BenneGuiTextInputSetEnabledFn,
  type BenneGuiTextInputSetFocusedFn,
  type BenneGuiTextInputSetTextFn,
} from './guiTextInputRuntime.js';
import {
  BENNE_GUI_LIST_BOX_DATA_KEY,
  BENNE_GUI_LIST_BOX_SET_ROW_TEXT_DATA_KEY,
  BENNE_GUI_LIST_BOX_SET_SELECTED_INDEX_DATA_KEY,
  benneGuiListBoxReadRowCount,
  benneGuiListBoxReadSelectedIndex,
  type BenneGuiListBoxSetRowTextFn,
  type BenneGuiListBoxSetSelectedIndexFn,
} from './guiListBoxRuntime.js';
import { syncOutlinedGuiBitmapTextAll, syncOutlinedGuiBitmapTextPositions } from './guiTextOutline.js';

/**
 * One GUI control's live Phaser object, with the operations scripts use on it. Every operation is
 * immediate; timed ones (tweens) live on the BenneScript control handles.
 */
export class ControlFacade {
  readonly gameObject: Phaser.GameObjects.GameObject;

  constructor(gameObject: Phaser.GameObjects.GameObject) {
    this.gameObject = gameObject;
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

  private tryGetGuiTextSurface(): Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text | null {
    const go = this.gameObject;
    if (go instanceof Phaser.GameObjects.BitmapText || go instanceof Phaser.GameObjects.Text) {
      return go;
    }
    return null;
  }

  /** **`text`** controls (`BitmapText` / `Text`). Throws if this control is not text-backed. */
  get text(): string {
    const textInput = this.tryGetTextInputContainer();
    if (textInput) {
      return benneGuiTextInputReadText(textInput) ?? '';
    }
    const t = this.tryGetGuiTextSurface();
    if (!t) {
      throw new Error('[Benne] GUI control `.text` requires a BitmapText or Text game object.');
    }
    return t.text;
  }

  set text(value: string) {
    const textInput = this.tryGetTextInputContainer();
    if (textInput) {
      const setRaw = textInput.getData(BENNE_GUI_TEXT_INPUT_SET_TEXT_DATA_KEY);
      if (typeof setRaw !== 'function') {
        throw new Error('[Benne] GUI text input `.text` setter is unavailable.');
      }
      (setRaw as BenneGuiTextInputSetTextFn)(value);
      return;
    }
    const t = this.tryGetGuiTextSurface();
    if (!t) {
      throw new Error('[Benne] GUI control `.text` requires a BitmapText or Text game object.');
    }
    if (t instanceof Phaser.GameObjects.BitmapText) {
      syncOutlinedGuiBitmapTextAll(t, value);
    } else {
      t.setText(value);
    }
  }

  private tryGetTextInputContainer(): Phaser.GameObjects.Container | null {
    const go = this.gameObject;
    if (!(go instanceof Phaser.GameObjects.Container)) {
      return null;
    }
    if (go.getData(BENNE_GUI_TEXT_INPUT_DATA_KEY) !== true) {
      return null;
    }
    return go;
  }

  get focused(): boolean {
    const input = this.tryGetTextInputContainer();
    if (!input) {
      throw new Error('[Benne] GUI control `.focused` is only supported on `textInput` controls.');
    }
    const focused = benneGuiTextInputReadFocused(input);
    return focused === true;
  }

  set focused(wantFocus: boolean) {
    const input = this.tryGetTextInputContainer();
    if (!input) {
      throw new Error('[Benne] GUI control `.focused` is only supported on `textInput` controls.');
    }
    const setRaw = input.getData(BENNE_GUI_TEXT_INPUT_SET_FOCUSED_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI text input `.focused` setter is unavailable.');
    }
    (setRaw as BenneGuiTextInputSetFocusedFn)(wantFocus);
  }

  private tryGetButtonContainer(): Phaser.GameObjects.Container | null {
    const go = this.gameObject;
    if (!(go instanceof Phaser.GameObjects.Container)) {
      return null;
    }
    if (go.getData(BENNE_GUI_BUTTON_DATA_KEY) !== true) {
      return null;
    }
    return go;
  }

  /**
   * Enabled state for **`button`**, **`textInput`** and **`checkbox`** controls (matches JSON
   * **`enabled`**; toggles hit-testing and disabled visuals at runtime). Does not emit events.
   * @throws When this control is not a composable **`button`**, **`textInput`** or **`checkbox`**.
   */
  get enabled(): boolean {
    const button = this.tryGetButtonContainer();
    if (button) {
      return benneGuiButtonReadEnabled(button) ?? true;
    }
    const input = this.tryGetTextInputContainer();
    if (input) {
      return benneGuiTextInputReadEnabled(input) ?? true;
    }
    if (this.tryGetCheckboxContainer()) {
      return !this.disabled;
    }
    throw new Error('[Benne] GUI control `.enabled` is only supported on `button`, `textInput` and `checkbox` controls.');
  }

  set enabled(value: boolean) {
    const button = this.tryGetButtonContainer();
    if (button) {
      const setRaw = button.getData(BENNE_GUI_BUTTON_SET_ENABLED_DATA_KEY);
      if (typeof setRaw !== 'function') {
        throw new Error('[Benne] GUI button `.enabled` setter is unavailable.');
      }
      (setRaw as BenneGuiButtonSetEnabledFn)(value);
      return;
    }
    const input = this.tryGetTextInputContainer();
    if (input) {
      const setRaw = input.getData(BENNE_GUI_TEXT_INPUT_SET_ENABLED_DATA_KEY);
      if (typeof setRaw !== 'function') {
        throw new Error('[Benne] GUI text input `.enabled` setter is unavailable.');
      }
      (setRaw as BenneGuiTextInputSetEnabledFn)(value);
      return;
    }
    if (this.tryGetCheckboxContainer()) {
      this.disabled = !value;
      return;
    }
    throw new Error('[Benne] GUI control `.enabled` is only supported on `button`, `textInput` and `checkbox` controls.');
  }

  private tryGetListBoxContainer(): Phaser.GameObjects.Container | null {
    const go = this.gameObject;
    if (!(go instanceof Phaser.GameObjects.Container)) {
      return null;
    }
    if (go.getData(BENNE_GUI_LIST_BOX_DATA_KEY) !== true) {
      return null;
    }
    return go;
  }

  get selectedIndex(): number {
    const listBox = this.tryGetListBoxContainer();
    if (!listBox) {
      throw new Error('[Benne] GUI control `.selectedIndex` is only supported on `listBox` controls.');
    }
    return benneGuiListBoxReadSelectedIndex(listBox) ?? -1;
  }

  set selectedIndex(index: number) {
    const listBox = this.tryGetListBoxContainer();
    if (!listBox) {
      throw new Error('[Benne] GUI control `.selectedIndex` is only supported on `listBox` controls.');
    }
    const setRaw = listBox.getData(BENNE_GUI_LIST_BOX_SET_SELECTED_INDEX_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI listBox `.selectedIndex` setter is unavailable.');
    }
    (setRaw as BenneGuiListBoxSetSelectedIndexFn)(index);
  }

  get rowCount(): number {
    const listBox = this.tryGetListBoxContainer();
    if (!listBox) {
      throw new Error('[Benne] GUI control `.rowCount` is only supported on `listBox` controls.');
    }
    return benneGuiListBoxReadRowCount(listBox) ?? 0;
  }

  setRowText(index: number, text: string): void {
    const listBox = this.tryGetListBoxContainer();
    if (!listBox) {
      throw new Error('[Benne] GUI control `.setRowText` is only supported on `listBox` controls.');
    }
    const setRaw = listBox.getData(BENNE_GUI_LIST_BOX_SET_ROW_TEXT_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI listBox `.setRowText` setter is unavailable.');
    }
    (setRaw as BenneGuiListBoxSetRowTextFn)(index, text);
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

  private tryGetCheckboxContainer(): Phaser.GameObjects.Container | null {
    const go = this.gameObject;
    if (!(go instanceof Phaser.GameObjects.Container)) {
      return null;
    }
    if (go.getData(BENNE_GUI_CHECKBOX_DATA_KEY) !== true) {
      return null;
    }
    return go;
  }

  /**
   * Checked state for **`checkbox`** controls. Programmatic updates do not emit
   * {@link import('../events/guiCheckboxEvents.js').guiCheckboxCheckEventId} / uncheck events.
   * @throws When this control is not a composable **`checkbox`** hit target.
   */
  get checked(): boolean {
    const box = this.tryGetCheckboxContainer();
    if (!box) {
      throw new Error('[Benne] GUI control `.checked` is only supported on `checkbox` controls.');
    }
    return benneGuiCheckboxReadChecked(box) ?? false;
  }

  set checked(value: boolean) {
    const box = this.tryGetCheckboxContainer();
    if (!box) {
      throw new Error('[Benne] GUI control `.checked` is only supported on `checkbox` controls.');
    }
    const setRaw = box.getData(BENNE_GUI_CHECKBOX_SET_CHECKED_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI checkbox `.checked` setter is unavailable.');
    }
    (setRaw as BenneGuiCheckboxSetCheckedFn)(value);
  }

  /**
   * Disabled state for **`checkbox`** controls (inverse of JSON **`enabled`**).
   * @throws When this control is not a composable **`checkbox`** hit target.
   */
  get disabled(): boolean {
    const box = this.tryGetCheckboxContainer();
    if (!box) {
      throw new Error('[Benne] GUI control `.disabled` is only supported on `checkbox` controls.');
    }
    return benneGuiCheckboxReadDisabled(box) ?? false;
  }

  set disabled(value: boolean) {
    const box = this.tryGetCheckboxContainer();
    if (!box) {
      throw new Error('[Benne] GUI control `.disabled` is only supported on `checkbox` controls.');
    }
    const setRaw = box.getData(BENNE_GUI_CHECKBOX_SET_DISABLED_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI checkbox `.disabled` setter is unavailable.');
    }
    (setRaw as BenneGuiCheckboxSetDisabledFn)(value);
  }

  private tryGetSliderContainer(): Phaser.GameObjects.Container | null {
    const go = this.gameObject;
    if (!(go instanceof Phaser.GameObjects.Container)) {
      return null;
    }
    if (go.getData(BENNE_GUI_SLIDER_DATA_KEY) !== true) {
      return null;
    }
    return go;
  }

  /**
   * Numeric value for **`slider`** controls. Programmatic updates do not emit a value-changed event.
   * @throws When this control is not a composable **`slider`** hit target.
   */
  get value(): number {
    const slider = this.tryGetSliderContainer();
    if (!slider) {
      throw new Error('[Benne] GUI control `.value` is only supported on `slider` controls.');
    }
    return benneGuiSliderReadValue(slider) ?? 0;
  }

  set value(next: number) {
    this.setValue(next);
  }

  /**
   * Sets a **`slider`** value without emitting a value-changed event.
   * @throws When this control is not a composable **`slider`** hit target.
   */
  setValue(next: number): void {
    const slider = this.tryGetSliderContainer();
    if (!slider) {
      throw new Error('[Benne] GUI control `.setValue` is only supported on `slider` controls.');
    }
    const setRaw = slider.getData(BENNE_GUI_SLIDER_SET_VALUE_DATA_KEY);
    if (typeof setRaw !== 'function') {
      throw new Error('[Benne] GUI slider `.setValue` is unavailable.');
    }
    (setRaw as BenneGuiSliderSetValueFn)(next);
  }
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
}

/**
 * Per-overlay GUI behavior surface: whole-GUI {@link GuiRuntime.root} facade and per-control lookup.
 * Constructed after {@link buildGuiOverlay}; call {@link dispose} (or destroy the overlay handle) on room teardown.
 * BenneScript's `guis.x.controls.y` handles resolve to these facades.
 */
export class GuiRuntime {
  readonly guiId: string;
  /** The scene hosting this overlay (scale, tweens, input). */
  readonly scene: Phaser.Scene;
  /**
   * The root container for the **packed** authored GUI: every control **except** those listed in **`fixedControls`**
   * on the GUI JSON (those stay outside this container so they do not move with root-level tweens).
   */
  readonly root: ControlFacade;

  private readonly controlObjects: ReadonlyMap<string, Phaser.GameObjects.GameObject>;
  private readonly facadeCache = new Map<string, ControlFacade>();
  private disposed = false;

  constructor(options: GuiRuntimeOptions) {
    this.scene = options.scene;
    this.guiId = options.guiId;
    this.controlObjects = options.controlGameObjectsById;
    this.root = new ControlFacade(options.contentRoot);
  }

  /** Resolves a control by **`id`** from **`*.gui.json`**, or **`null`** if missing / blank / unknown. */
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
    const facade = new ControlFacade(go);
    this.facadeCache.set(id, facade);
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
