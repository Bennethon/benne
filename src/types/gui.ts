/**
 * GUI overlay definition from `src/game/guis/<id>/<id>.gui.json`.
 * Runtime composes optional `controls` in `RoomScene` (screen-space overlays); see `buildGuiOverlay` in `src/engine/gui/`.
 */
export interface GuiDisplayData {
  /**
   * When true, loads `images/guis/<guiId>/<guiId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export type GuiTextAlign = 'left' | 'center' | 'right';

export interface GuiTextControl {
  type: 'text';
  /** Prefer `line` for dialogue body; otherwise the first text control is the primary line. */
  id?: string;
  x: number;
  y: number;
  text?: string;
  /** Key in `src/game/assets/fonts/fonts.json`. */
  font: string;
  fontSize: number;
  color: string;
  align?: GuiTextAlign;
  /** When set, enables word wrap at this width in screen pixels. */
  wordWrapWidth?: number;
}

export type GuiControl = GuiTextControl;

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  display: GuiDisplayData;
  controls?: GuiControl[];
}
