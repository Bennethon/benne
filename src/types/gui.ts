/**
 * GUI overlay definition from `src/game/guis/<id>/<id>.gui.json`.
 * Runtime composition (show/hide, layering, widgets) is not wired yet.
 */
export interface GuiDisplayData {
  /**
   * When true, loads `images/guis/<guiId>/<guiId>.png` and `.json` (Aseprite sheet export).
   */
  aseprite?: boolean;
}

export interface GuiData {
  id: string;
  name: string;
  description?: string;
  display: GuiDisplayData;
}
