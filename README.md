# Benne

Web-based point-and-click adventure engine (Phaser 4 + TypeScript + Vite). Internal resolution defaults to **352×198** with pixel-art scaling.

## Scripts

```bash
npm run dev      # Vite dev server
npm run build    # Typecheck + production bundle
npm run preview  # Serve production build locally
```

## Conventions

- **TypeScript**: `strict` mode; prefer explicit types for public engine APIs and JSON-backed shapes under `src/types/`.
- **Data-driven content**: Rooms, items, and dialogue should be described in JSON (see `data/` and future `assets/json/`). Code loads manifests and dispatches events — avoid hard-coding room layouts in scene classes when a JSON definition exists.
- **Events**: Use `gameEvents` from `src/engine/events/EventBus.ts` for cross-system interactions (inventory, puzzles, UI). Phaser’s own events remain for input and scene lifecycle.

## Placeholder art

The demo loads `public/assets/images/placeholders/room-bg.png`. Replace it with your own PNG (see `assets/images/placeholders/README.txt`).

## Cursor rules

See `.cursor/rules/benne.mdc` for project-wide AI guidance.
