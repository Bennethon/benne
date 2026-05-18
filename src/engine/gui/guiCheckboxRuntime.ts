import type * as Phaser from 'phaser';

/** Stored on GUI checkbox hit containers (`buildGuiCheckbox`). */
export const BENNE_GUI_CHECKBOX_DATA_KEY = 'benneGuiCheckbox';

export const BENNE_GUI_CHECKBOX_APPLY_VISUAL_DATA_KEY = 'benneGuiCheckboxApplyVisual';

export const BENNE_GUI_CHECKBOX_SET_CHECKED_DATA_KEY = 'benneGuiCheckboxSetChecked';

export const BENNE_GUI_CHECKBOX_SET_DISABLED_DATA_KEY = 'benneGuiCheckboxSetDisabled';

export const BENNE_GUI_CHECKBOX_READ_CHECKED_DATA_KEY = 'benneGuiCheckboxReadChecked';

export const BENNE_GUI_CHECKBOX_READ_DISABLED_DATA_KEY = 'benneGuiCheckboxReadDisabled';

export type BenneGuiCheckboxApplyVisualFn = (hover: boolean) => void;

export type BenneGuiCheckboxSetCheckedFn = (checked: boolean) => void;

export type BenneGuiCheckboxSetDisabledFn = (disabled: boolean) => void;

export function benneGuiCheckboxReadChecked(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_CHECKBOX_READ_CHECKED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}

export function benneGuiCheckboxReadDisabled(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_CHECKBOX_READ_DISABLED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}
