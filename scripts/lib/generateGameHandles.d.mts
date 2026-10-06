/** First line of every generated handle module. */
export declare const GENERATED_MARKER: string;

/**
 * Generates the BenneScript handle modules for a game (docs/bennescript-ergonomics-refactor.md §7).
 * @param gameRoot Absolute path to `src/game/`.
 * @returns `files` maps paths relative to `gameRoot` to module text.
 */
export declare function generateGameHandles(gameRoot: string): {
  files: Map<string, string>;
  errors: string[];
  warnings: string[];
};
