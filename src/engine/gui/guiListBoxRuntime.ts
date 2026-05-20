import type * as Phaser from 'phaser';

/** Stored on GUI list box hit containers (`buildGuiListBox`). */
export const BENNE_GUI_LIST_BOX_DATA_KEY = 'benneGuiListBox';

export const BENNE_GUI_LIST_BOX_SET_SELECTED_INDEX_DATA_KEY = 'benneGuiListBoxSetSelectedIndex';
export const BENNE_GUI_LIST_BOX_READ_SELECTED_INDEX_DATA_KEY = 'benneGuiListBoxReadSelectedIndex';
export const BENNE_GUI_LIST_BOX_SET_ROW_TEXT_DATA_KEY = 'benneGuiListBoxSetRowText';
export const BENNE_GUI_LIST_BOX_READ_ROW_COUNT_DATA_KEY = 'benneGuiListBoxReadRowCount';

export type BenneGuiListBoxSetSelectedIndexFn = (index: number) => void;
export type BenneGuiListBoxSetRowTextFn = (index: number, text: string) => void;

export function benneGuiListBoxReadSelectedIndex(
  hitTarget: Phaser.GameObjects.Container,
): number | undefined {
  const raw = hitTarget.getData(BENNE_GUI_LIST_BOX_READ_SELECTED_INDEX_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => number)() : undefined;
}

export function benneGuiListBoxReadRowCount(hitTarget: Phaser.GameObjects.Container): number | undefined {
  const raw = hitTarget.getData(BENNE_GUI_LIST_BOX_READ_ROW_COUNT_DATA_KEY);
  return typeof raw === 'function' ? (raw as () => number)() : undefined;
}
