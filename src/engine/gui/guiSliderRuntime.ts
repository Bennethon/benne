import type * as Phaser from 'phaser';

/** Stored on GUI slider hit containers (`buildGuiSlider`). */
export const BENNE_GUI_SLIDER_DATA_KEY = 'benneGuiSlider';

export const BENNE_GUI_SLIDER_APPLY_VISUAL_DATA_KEY = 'benneGuiSliderApplyVisual';

export const BENNE_GUI_SLIDER_SET_VALUE_DATA_KEY = 'benneGuiSliderSetValue';

export const BENNE_GUI_SLIDER_SET_DISABLED_DATA_KEY = 'benneGuiSliderSetDisabled';

export const BENNE_GUI_SLIDER_READ_VALUE_DATA_KEY = 'benneGuiSliderReadValue';

export const BENNE_GUI_SLIDER_READ_DISABLED_DATA_KEY = 'benneGuiSliderReadDisabled';

export type BenneGuiSliderApplyVisualFn = (hover: boolean) => void;

export type BenneGuiSliderSetValueFn = (value: number) => void;

export type BenneGuiSliderSetDisabledFn = (disabled: boolean) => void;

export function benneGuiSliderReadValue(hitTarget: Phaser.GameObjects.Container): number | undefined {
  const raw = hitTarget.getData(BENNE_GUI_SLIDER_READ_VALUE_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => number)() : undefined;
}

export function benneGuiSliderReadDisabled(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_SLIDER_READ_DISABLED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}
