import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';

/**
 * Renderer / pixel-output fields that **must** stay identical between the shipped game and every
 * VS Code webview preview (room, GUI, character, inventory) and **BENNE Play**. Use
 * `Phaser.WEBGL` so the Tint pipeline applies to `BitmapText` and character sprites without
 * Canvas-only patches; keep `pixelArt`, `roundPixels`, and `antialias: false` for crisp pixel fonts
 * and stable integer placement.
 *
 * **Keep this module side-effect free** — previews import `getBenneRendererConfigFields` from
 * here, and if this file pulls in `BootScene` / `RoomScene` at the top level, Vite's eager
 * `import.meta.glob` calls in the shipped-game boot path (e.g. `resolveGameAssetUrl.ts`) would
 * copy every room / character / inventory PNG into all three preview bundles. Scene imports live
 * in `Game.ts` instead, where they're only pulled in by the shipped runtime entry.
 *
 * Keep this helper — not ad-hoc literals inside each preview entry point — as the single source of
 * truth (see `.cursor/rules/benne-preview-rendering-parity.mdc`).
 */
export function getBenneRendererConfigFields(): Pick<
  Phaser.Types.Core.GameConfig,
  'type' | 'backgroundColor' | 'pixelArt' | 'roundPixels' | 'antialias' | 'render'
> {
  return {
    type: Phaser.WEBGL,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    render: {
      powerPreference: 'high-performance',
    },
  };
}

/**
 * Room (and any other) preview config that shares renderer fields with the shipped game but uses
 * `Scale.RESIZE` so the canvas fills the VS Code panel; letterboxing in navigate mode is handled in
 * `RoomScene.setEditorCameraMode`.
 */
export function getEditorPhaserGameConfig(
  parent: HTMLElement,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    ...getBenneRendererConfigFields(),
    parent,
    scale: {
      parent,
      mode: Phaser.Scale.RESIZE,
    },
  };
}

/** Shared Phaser settings (resolution, scale, render) — scenes are added per entrypoint. */
export function getBennePhaserGameConfigBase(
  parent: HTMLElement | string,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  const { width, height } = getGameSettings().resolution;

  return {
    ...getBenneRendererConfigFields(),
    parent,
    width,
    height,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
  };
}
