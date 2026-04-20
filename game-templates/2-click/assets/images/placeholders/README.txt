Game art and audio live under src/game/assets/.

Reference them from room JSON with paths relative to this folder, for example:
  images/backgrounds/office.png

Vite bundles these files via import.meta.glob in resolveGameAssetUrl.ts; do not use /game/assets/ URLs.
