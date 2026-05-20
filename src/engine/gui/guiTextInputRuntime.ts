import type * as Phaser from 'phaser';

/** Stored on GUI text input hit containers (`buildGuiTextInput`). */
export const BENNE_GUI_TEXT_INPUT_DATA_KEY = 'benneGuiTextInput';

export const BENNE_GUI_TEXT_INPUT_SET_TEXT_DATA_KEY = 'benneGuiTextInputSetText';
export const BENNE_GUI_TEXT_INPUT_SET_FOCUSED_DATA_KEY = 'benneGuiTextInputSetFocused';
export const BENNE_GUI_TEXT_INPUT_READ_TEXT_DATA_KEY = 'benneGuiTextInputReadText';
export const BENNE_GUI_TEXT_INPUT_READ_FOCUSED_DATA_KEY = 'benneGuiTextInputReadFocused';
export const BENNE_GUI_TEXT_INPUT_SET_ENABLED_DATA_KEY = 'benneGuiTextInputSetEnabled';
export const BENNE_GUI_TEXT_INPUT_READ_ENABLED_DATA_KEY = 'benneGuiTextInputReadEnabled';

export type BenneGuiTextInputSetTextFn = (text: string) => void;
export type BenneGuiTextInputSetFocusedFn = (focused: boolean) => void;
export type BenneGuiTextInputSetEnabledFn = (enabled: boolean) => void;

export function benneGuiTextInputReadText(hitTarget: Phaser.GameObjects.Container): string | undefined {
  const raw = hitTarget.getData(BENNE_GUI_TEXT_INPUT_READ_TEXT_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => string)() : undefined;
}

export function benneGuiTextInputReadFocused(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_TEXT_INPUT_READ_FOCUSED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}

export function benneGuiTextInputReadEnabled(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_TEXT_INPUT_READ_ENABLED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}
