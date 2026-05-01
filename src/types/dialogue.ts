export interface DialogueLine {
  speaker?: string;
  text: string;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  choices?: { text: string; nextNodeId: string }[];
}

export interface DialogueTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

/** One line in a SCUMM-style topic / reply list (see `*.dialog.json`). */
export interface DialogOption {
  id: string;
  text: string;
  /** When omitted in JSON, treated as `true`. */
  enabled?: boolean;
  /** When omitted in JSON, treated as `false` (runtime may persist via game state variables). */
  used?: boolean;
  /**
   * When `true` (default), the player speaks {@link text} before the option’s `whenChoice` handler runs.
   * Set to `false` to run the handler without an automatic player line.
   */
  say?: boolean;
}

/**
 * First-class dialog definition (classic SCUMM / AGS-style topic UI).
 * Options may be toggled at runtime via {@link import('../engine/scripting/DialogBenneScript.js').DialogBenneScript}.
 */
export interface Dialog {
  id: string;
  displayName?: string;
  options: DialogOption[];
  /** GUI overlay id; defaults to `"dialog"` when omitted. */
  guiId?: string;
}
