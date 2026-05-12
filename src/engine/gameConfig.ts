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

/**
 * Shipped runtime (`Scale.NONE` + hi-DPI canvas): largest integer **n ≥ 1** such that
 * `internal × n` fits in the parent in CSS pixels — same rule as Phaser’s `getMaxZoom()` with a
 * fixed internal game size (the old `Scale.FIT` + `MAX_ZOOM` integer step).
 */
export function computeBenneIntegerCrispScale(
  parentCssWidth: number,
  parentCssHeight: number,
  internalWidth: number,
  internalHeight: number,
): number {
  if (internalWidth <= 0 || internalHeight <= 0 || parentCssWidth <= 0 || parentCssHeight <= 0) {
    return 1;
  }
  const sx = Math.floor(parentCssWidth / internalWidth);
  const sy = Math.floor(parentCssHeight / internalHeight);
  return Math.max(1, Math.min(sx, sy));
}

/**
 * Shipped runtime: largest rectangle that fits inside the parent while keeping the internal
 * resolution’s aspect ratio — same letterboxing footprint Phaser’s `Scale.FIT` uses for the
 * canvas CSS size (before device-pixel backing store is applied separately).
 */
export function computeBenneFitLetterboxCssDisplaySize(
  parentCssWidth: number,
  parentCssHeight: number,
  internalWidth: number,
  internalHeight: number,
): { width: number; height: number } {
  if (parentCssWidth <= 0 || parentCssHeight <= 0 || internalWidth <= 0 || internalHeight <= 0) {
    return { width: 1, height: 1 };
  }
  const aspect = internalWidth / internalHeight;
  let w = parentCssWidth;
  let h = w / aspect;
  if (h > parentCssHeight) {
    h = parentCssHeight;
    w = h * aspect;
  }
  return { width: Math.max(1, Math.floor(w)), height: Math.max(1, Math.floor(h)) };
}

/** Shared Phaser settings (resolution, scale, render) — scenes are added per entrypoint.
 *
 * Shipped scaling uses {@link Phaser.Scale.NONE} plus {@link wireBenneRuntimeHiDpiCanvasScale} in
 * `Game.ts` (PixUI-style: parent×DPR buffer, `zoom: 1/DPR`; internal aspect via main-camera viewport
 * — see `benneRuntimeHiDpiScale.ts`).
 */
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
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
      zoom: 1,
      autoRound: true,
    },
  };
}
