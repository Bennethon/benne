import type * as Phaser from 'phaser';

/** Stored on GUI button hit containers (`buildGuiButton`). */
export const BENNE_GUI_BUTTON_DATA_KEY = 'benneGuiButton';

export const BENNE_GUI_BUTTON_SET_ENABLED_DATA_KEY = 'benneGuiButtonSetEnabled';
export const BENNE_GUI_BUTTON_READ_ENABLED_DATA_KEY = 'benneGuiButtonReadEnabled';

export type BenneGuiButtonSetEnabledFn = (enabled: boolean) => void;

export function benneGuiButtonReadEnabled(
  hitTarget: Phaser.GameObjects.Container,
): boolean | undefined {
  const raw = hitTarget.getData(BENNE_GUI_BUTTON_READ_ENABLED_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => boolean)() : undefined;
}
