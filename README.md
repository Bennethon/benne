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

## Conventions

- **TypeScript**: `strict` mode; prefer explicit types for public engine APIs and JSON-backed shapes under `src/types/`.
- **Data-driven content**: Author game JSON and room/character scripts under `src/game/`. Put raw images (and later audio) under `src/game/assets/`. Room JSON references asset paths relative to that folder; `resolveGameAssetUrl()` maps them to Vite URLs for Phaser’s loader.
- **Events**: Use `gameEvents` from `src/engine/events/EventBus.ts` for cross-system interactions (inventory, puzzles, UI). Phaser’s own events remain for input and scene lifecycle.

## Project structure

- `src/game/assets/` game media (`images/backgrounds`, `images/characters`, `audio`, …) — bundled via Vite
- `src/game/` game logic and data: `game-config.json`, `globalScript.ts`, `boot/` (loaders and registration), `rooms/`, `characters/`, …
- `src/engine/` reusable systems and scenes
- `src/types/` JSON and engine contract types

## Cursor rules

See `.cursor/rules/benne.mdc` for project-wide AI guidance.
