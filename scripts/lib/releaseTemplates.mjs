// @ts-check
/**
 * The game templates a BENNE release ships (`bundle:scaffold` → the VSIX's New Game picker), with
 * the names and descriptions the picker shows. Any other folder in `game-templates/` (e.g.
 * `ai-apocalypse`, the full game kept as a development baseline) stays in this repo: it can be
 * swapped into `src/game` with `set-template` and is played by the template tests, but is never
 * bundled. Add a template here to ship it.
 *
 * @type {Readonly<Record<string, { displayName: string; description: string }>>}
 */
export const RELEASE_TEMPLATES = {
  '2-click': {
    displayName: '2-Click Adventure',
    description: 'Two-button verb interface (look / use) with inventory bar and menu GUIs.',
  },
  '9-verb': {
    displayName: '9-Verb SCUMM-style',
    description: 'Classic verb wheel with give, pick up, use, open, and more.',
  },
  blank: {
    displayName: 'Blank',
    description: 'An empty game: one empty room, Hank as the player and the look / use verbs.',
  },
};
