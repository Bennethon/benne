# BENNE

## Bennethon Engine for Nifty Narrative Experiences

Web-based point-and-click adventure engine (Phaser 4 + TypeScript + Vite). Internal resolution and other bootstrap settings live in **`src/game/game-config.json`** (default **352×198**).

## Scripts

```bash
npm run dev      # Vite dev server
npm run build    # Typecheck + production bundle
npm run preview  # Serve production build locally
npm run snapshot # Pack the engine source into benne-snapshot.md (Repomix) for LLM chats; not tracked
```

## Testing

See [the regression testing guide](docs/testing.md) for setup, suite commands, CI gates, coverage and remaining test priorities. Start with `npm run test:ci`; run browser, extension-host and artifact suites before releases.

## Documentation

- [`docs/architecture.md`](docs/architecture.md): how the engine and editor fit together.
- [`website/guide/`](website/guide/) (served at [benne.games](https://benne.games)) and [`docs/bennescript-api.md`](docs/bennescript-api.md): user guides and the scripting API.
- [`docs/bennescript-ergonomics-refactor.md`](docs/bennescript-ergonomics-refactor.md): the BenneScript design record and its decisions.
- [`docs/roadmap.md`](docs/roadmap.md): open work and ideas.
- [`docs/history/`](docs/history/README.md): dated reviews and logs, kept for background only.

## Conventions

- **TypeScript**: `strict` mode; prefer explicit types for public engine APIs and JSON-backed shapes under `src/types/`.
- **Data-driven content**: Author game JSON and room/character scripts under `src/game/`. Put raw images (and later audio) under `src/game/assets/`. Room JSON references asset paths relative to that folder; `resolveGameAssetUrl()` maps them to Vite URLs for Phaser’s loader.
- **Events**: Use `gameEvents` from `src/engine/events/EventBus.ts` for cross-system interactions (inventory, puzzles, UI). Phaser’s own events remain for input and scene lifecycle.

## Project structure

- `src/game/assets/` game media (`images/backgrounds`, `images/characters`, `audio`, …) — bundled via Vite
- `src/game/` game logic and data: `game-config.json`, `globalScript.ts`, `rooms/`, `characters/`, …
- `src/engine/` reusable systems and scenes; `src/engine/content/` finds and loads the game's content
- `src/types/` JSON and engine contract types

## AI guidance

See `AGENTS.md` for which docs are current, and `.cursor/rules/benne.mdc` for project-wide conventions.

## AI Usage

I built BENNE with the help of AI tools. ChatGPT, Grok, and Claude wrote much of the code, while I provided the architecture, direction, and feature design. I also designed the user experience for the BENNE Editor.

My goal was to spend less time building a game engine and more time doing what I love: making adventure games.

Some of my game artwork is AI-assisted and hand-edited.

## License and contributions

BENNE is released under the [MIT License](LICENSE). Use it, fork it and change it however you like.

Third-party assets keep their own licenses. The fonts in `game-templates/*/assets/fonts/` are CC BY-NC-SA 3.0, which forbids commercial use, so replace them before you sell a game made from a template.

This is my personal engine, shared as-is. Bug reports and questions are welcome as issues. I'm not trying to build a contributor community around it, so pull requests may not be reviewed or merged.
