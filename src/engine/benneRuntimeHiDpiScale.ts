import * as Phaser from 'phaser';
import { computeBenneIntegerCrispScale } from './gameConfig.js';
import { getInternalHeight, getInternalWidth } from '../game/constants.js';

/**
 * PixUI-style hi-DPI canvas sizing (see `https://github.com/skhoroshavin/phaser-pixui/blob/main/example/src/main.ts`):
 * `Scale.NONE`, backing store = **parent CSS size × DPR**, `scale.zoom = 1 / DPR` so the canvas CSS
 * fills the parent. Benne then letterboxes the fixed internal resolution inside that buffer via
 * `Camera#setViewport` + `Camera#setZoom` (same approach as RoomScene editor navigate letterboxing).
 */

/** Registry key for the main-camera zoom factor used with {@link syncBenneRuntimeHiDpiSceneMainCameras}. */
export const BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY = 'benneRuntimeHiDpiCamZoom';

/** Set by {@link wireBenneRuntimeHiDpiCanvasScale} so previews that share {@link RoomScene} can skip camera sync. */
export const BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY = 'benneRuntimeHiDpiWired';

const MAX_DEVICE_PIXEL_RATIO = 2.5;

function readRuntimeDevicePixelRatio(): number {
  return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, MAX_DEVICE_PIXEL_RATIO);
}

function readParentCssSize(scale: Phaser.Scale.ScaleManager): { w: number; h: number } {
  const p = scale.parent as HTMLElement | undefined;
  if (p && typeof p.getBoundingClientRect === 'function') {
    const r = p.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) {
      return { w: r.width, h: r.height };
    }
  }
  scale.getParentBounds();
  return { w: scale.parentSize.width, h: scale.parentSize.height };
}

function applyBenneRuntimeHiDpiCameras(game: Phaser.Game): void {
  const scale = game.scale;
  const bufferW = scale.width;
  const bufferH = scale.height;
  if (bufferW < 1 || bufferH < 1) {
    return;
  }

  const internalW = getInternalWidth();
  const internalH = getInternalHeight();
  /**
   * Integer crisp step must be derived from the **same** logical size Phaser uses for the
   * backing store (`baseSize` × `scale.zoom` → `displaySize`), not raw `getBoundingClientRect`.
   * Before {@link applyBenneRuntimeHiDpiLayout} promotes the buffer, the parent can be huge while
   * `scale.width` is still the config internal size — mixing the two produced `vw` ≫ buffer and
   * broken zoom/viewport until a later resize.
   */
  const cssW = scale.displaySize.width;
  const cssH = scale.displaySize.height;
  if (cssW < 1 || cssH < 1) {
    return;
  }

  const crispN = computeBenneIntegerCrispScale(cssW, cssH, internalW, internalH);
  const scaleZoom = scale.zoom > 0 ? scale.zoom : 1;
  const camZoom = crispN / scaleZoom;
  const vw = Math.max(1, Math.floor(internalW * camZoom));
  const vh = Math.max(1, Math.floor((vw * internalH) / internalW));
  const vx = Math.floor((bufferW - vw) / 2);
  const vy = Math.floor((bufferH - vh) / 2);
  game.registry.set(BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY, camZoom);

  for (const scene of game.scene.getScenes(true)) {
    const cam = scene.cameras.main;
    cam.setSize(bufferW, bufferH);
    cam.setViewport(vx, vy, vw, vh);
    cam.setScroll(0, 0);
    cam.setZoom(camZoom);
    (
      scene as Phaser.Scene & {
        syncRuntimeHiDpiUiCameraToMain?: () => void;
      }
    ).syncRuntimeHiDpiUiCameraToMain?.();
  }
}

function applyBenneRuntimeHiDpiLayout(game: Phaser.Game): void {
  const scale = game.scale;
  const { w: parentW, h: parentH } = readParentCssSize(scale);
  if (parentW < 1 || parentH < 1) {
    return;
  }

  const dpr = readRuntimeDevicePixelRatio();
  const bufferW = Math.max(1, Math.floor(parentW * dpr));
  const bufferH = Math.max(1, Math.floor(parentH * dpr));

  // PixUI: assign zoom then resize — never `setZoom()` before resize (stale gameSize refresh).
  // CSS size = buffer × (1/dpr) ≈ parent (Phaser); when dpr===1, resize skips style — force below.
  scale.zoom = 1 / dpr;
  scale.resize(bufferW, bufferH);

  const canvas = game.canvas;
  canvas.style.width = `${parentW}px`;
  canvas.style.height = `${parentH}px`;

  scale.updateBounds();
  scale.updateCenter();

  applyBenneRuntimeHiDpiCameras(game);
}

let windowResizeRaf = 0;
let boundWindowResize: (() => void) | null = null;
let boundFullscreenResize: (() => void) | null = null;
let parentResizeObserver: ResizeObserver | null = null;

/**
 * Wires PixUI-style canvas sizing (`NONE` + parent×DPR buffer + `zoom: 1/DPR`) and Benne camera
 * letterboxing for the internal resolution from `game-config.json`.
 */
export function wireBenneRuntimeHiDpiCanvasScale(game: Phaser.Game): void {
  game.registry.set(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY, true);

  const schedule = (): void => {
    if (windowResizeRaf !== 0) {
      cancelAnimationFrame(windowResizeRaf);
    }
    windowResizeRaf = requestAnimationFrame(() => {
      windowResizeRaf = 0;
      applyBenneRuntimeHiDpiLayout(game);
    });
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    applyBenneRuntimeHiDpiLayout(game);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(schedule);
  });

  boundWindowResize = schedule;
  window.addEventListener('resize', boundWindowResize, false);
  boundFullscreenResize = schedule;
  document.addEventListener('fullscreenchange', boundFullscreenResize, false);

  const parentEl = game.scale.parent as HTMLElement | undefined;
  if (parentEl && typeof ResizeObserver !== 'undefined') {
    parentResizeObserver = new ResizeObserver(() => {
      schedule();
    });
    parentResizeObserver.observe(parentEl);
  }

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    parentResizeObserver?.disconnect();
    parentResizeObserver = null;
    if (boundWindowResize) {
      window.removeEventListener('resize', boundWindowResize, false);
    }
    if (boundFullscreenResize) {
      document.removeEventListener('fullscreenchange', boundFullscreenResize, false);
    }
    boundWindowResize = null;
    boundFullscreenResize = null;
    if (windowResizeRaf !== 0) {
      cancelAnimationFrame(windowResizeRaf);
      windowResizeRaf = 0;
    }
    game.registry.remove(BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY);
    game.registry.remove(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY);
  });
}

/**
 * Re-applies camera viewport + zoom after a new scene starts (Phaser resets camera state).
 */
export function syncBenneRuntimeHiDpiSceneMainCameras(game: Phaser.Game): void {
  if (!game.registry.get(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY)) {
    return;
  }
  // Scene create hooks are a reliable point where the parent element has a settled CSS size.
  // Re-run full hi-DPI layout here (not camera-only) so first paint doesn't depend on resize observers.
  applyBenneRuntimeHiDpiLayout(game);
  requestAnimationFrame(() => {
    applyBenneRuntimeHiDpiLayout(game);
  });
}
