/** Root manifest shape for data-driven content lists. */
export interface GameManifest {
  version: string;
  rooms: string[];
  items: string[];
  dialogues: string[];
}
