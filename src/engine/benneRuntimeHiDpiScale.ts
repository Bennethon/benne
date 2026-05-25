import * as Phaser from 'phaser';
import { getInternalHeight, getInternalWidth } from '../game/boot/constants.js';

/**
 * PixUI-style hi-DPI canvas sizing (see `https://github.com/skhoroshavin/phaser-pixui/blob/main/example/src/main.ts`):
 * `Scale.NONE`, backing store = **parent CSS size × DPR**, `scale.zoom = 1 / DPR` so the canvas CSS
 * fills the parent. Benne maps the fixed internal resolution with aspect-preserving camera letterbox
 * and a two-phase resize path: cheap live camera/CSS updates during drag, debounced backing-store commits.
 */

/** Registry key for the main-camera zoom used with {@link syncBenneRuntimeHiDpiSceneMainCameras}. */
export const BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY = 'benneRuntimeHiDpiCamZoom';

/** Set by {@link wireBenneRuntimeHiDpiCanvasScale} so previews that share {@link RoomScene} can skip camera sync. */
export const BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY = 'benneRuntimeHiDpiWired';

const MAX_DEVICE_PIXEL_RATIO = 2.5;
const BUFFER_COMMIT_DEBOUNCE_MS = 24;
const STARTUP_COMMIT_MAX_RAF_RETRIES = 12;

type HiDpiRef = { value: string };
type HiDpiLayoutState = {
  lastCanvasStyleSignatureRef: HiDpiRef;
  lastBufferSignatureRef: HiDpiRef;
  lastCameraSignatureRef: HiDpiRef;
};
const hiDpiLayoutStateByGame = new WeakMap<Phaser.Game, HiDpiLayoutState>();

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
    if (p.clientWidth >= 1 && p.clientHeight >= 1) {
      return { w: p.clientWidth, h: p.clientHeight };
    }
  }
  scale.getParentBounds();
  if (scale.parentSize.width >= 1 && scale.parentSize.height >= 1) {
    return { w: scale.parentSize.width, h: scale.parentSize.height };
  }
  // Last-resort startup fallback: avoid getting stuck at internal size when parent bounds are unresolved.
  return {
    w: Math.max(1, typeof window !== 'undefined' ? window.innerWidth || 1 : 1),
    h: Math.max(1, typeof window !== 'undefined' ? window.innerHeight || 1 : 1),
  };
}

function applyBenneRuntimeHiDpiCameras(
  game: Phaser.Game,
  parentW: number,
  parentH: number,
  state: HiDpiLayoutState,
): void {
  const scale = game.scale;
  const bufferW = scale.width;
  const bufferH = scale.height;
  if (bufferW < 1 || bufferH < 1 || parentW < 1 || parentH < 1) {
    return;
  }

  const internalW = getInternalWidth();
  const internalH = getInternalHeight();
  const fitCssScale = Math.min(parentW / internalW, parentH / internalH);
  const targetFrameCssW = internalW * fitCssScale;
  const targetFrameCssH = internalH * fitCssScale;
  const cssToBufferX = bufferW / parentW;
  const cssToBufferY = bufferH / parentH;
  const camZoom = Math.max(
    0.001,
    Math.min((targetFrameCssW * cssToBufferX) / internalW, (targetFrameCssH * cssToBufferY) / internalH),
  );
  const vw = Math.max(1, Math.floor(internalW * camZoom));
  const vh = Math.max(1, Math.floor(internalH * camZoom));
  const vx = Math.floor((bufferW - vw) / 2);
  const vy = Math.floor((bufferH - vh) / 2);
  const activeScenes = game.scene.getScenes(true);
  const sceneKeySignature =
    activeScenes.length > 0 ? activeScenes.map((s) => s.sys.settings.key).join(',') : 'none';
  const cameraSignature = `${bufferW}|${bufferH}|${vx}|${vy}|${vw}|${vh}|${camZoom.toFixed(5)}|${sceneKeySignature}`;
  if (state.lastCameraSignatureRef.value === cameraSignature) {
    return;
  }
  state.lastCameraSignatureRef.value = cameraSignature;
  game.registry.set(BENNE_RUNTIME_HI_DPI_CAM_ZOOM_REGISTRY_KEY, camZoom);

  for (const scene of activeScenes) {
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

type HiDpiLayoutMode = 'visual' | 'commit';

function applyBenneRuntimeHiDpiLayout(
  game: Phaser.Game,
  mode: HiDpiLayoutMode,
  state: HiDpiLayoutState,
): boolean {
  const scale = game.scale;
  const { w: parentW, h: parentH } = readParentCssSize(scale);
  if (parentW < 1 || parentH < 1) {
    return false;
  }

  const dpr = readRuntimeDevicePixelRatio();
  const bufferW = Math.max(1, Math.floor(parentW * dpr));
  const bufferH = Math.max(1, Math.floor(parentH * dpr));

  const targetScaleZoom = 1 / dpr;
  if (scale.zoom !== targetScaleZoom) {
    scale.zoom = targetScaleZoom;
  }

  const targetBufferSignature = `${bufferW}|${bufferH}|${targetScaleZoom.toFixed(5)}`;
  if (mode === 'commit' && state.lastBufferSignatureRef.value !== targetBufferSignature) {
    // Expensive backing-store commit: defer during active drag-resize to reduce visible flashing.
    scale.resize(bufferW, bufferH);
    state.lastBufferSignatureRef.value = targetBufferSignature;
    // Buffer change invalidates camera dedupe because viewport units are in buffer pixels.
    state.lastCameraSignatureRef.value = '';
  }

  const canvas = game.canvas;
  const styleSignature = `${parentW.toFixed(2)}|${parentH.toFixed(2)}`;
  if (state.lastCanvasStyleSignatureRef.value !== styleSignature) {
    canvas.style.width = `${parentW}px`;
    canvas.style.height = `${parentH}px`;
    state.lastCanvasStyleSignatureRef.value = styleSignature;
    scale.updateBounds();
    scale.updateCenter();
  } else if (mode === 'commit') {
    // After a debounced buffer commit, refresh bounds once so pointer mapping follows final CSS/buffer state.
    scale.updateBounds();
    scale.updateCenter();
  }

  applyBenneRuntimeHiDpiCameras(game, parentW, parentH, state);
  return true;
}

function runStartupCommitBurst(
  game: Phaser.Game,
  state: HiDpiLayoutState,
  remainingRafs: number,
): void {
  applyBenneRuntimeHiDpiLayout(
    game,
    'commit',
    state,
  );
  if (remainingRafs > 0) {
    requestAnimationFrame(() => runStartupCommitBurst(game, state, remainingRafs - 1));
  }
}

let windowResizeRaf = 0;
let bufferCommitTimeout = 0;
let boundWindowResize: (() => void) | null = null;
let boundFullscreenResize: (() => void) | null = null;
let parentResizeObserver: ResizeObserver | null = null;

/**
 * Wires PixUI-style canvas sizing (`NONE` + parent×DPR buffer + `zoom: 1/DPR`) and Benne camera
 * letterboxing for the internal resolution from `game-config.json`.
 */
export function wireBenneRuntimeHiDpiCanvasScale(game: Phaser.Game): void {
  game.registry.set(BENNE_RUNTIME_HI_DPI_WIRED_REGISTRY_KEY, true);
  const state: HiDpiLayoutState = {
    lastCanvasStyleSignatureRef: { value: '' },
    lastBufferSignatureRef: { value: '' },
    lastCameraSignatureRef: { value: '' },
  };
  hiDpiLayoutStateByGame.set(game, state);

  const scheduleCommit = (): void => {
    if (bufferCommitTimeout !== 0) {
      window.clearTimeout(bufferCommitTimeout);
    }
    bufferCommitTimeout = window.setTimeout(() => {
      bufferCommitTimeout = 0;
      applyBenneRuntimeHiDpiLayout(
        game,
        'commit',
        state,
      );
    }, BUFFER_COMMIT_DEBOUNCE_MS);
  };

  const schedule = (): void => {
    if (windowResizeRaf !== 0) {
      cancelAnimationFrame(windowResizeRaf);
    }
    windowResizeRaf = requestAnimationFrame(() => {
      windowResizeRaf = 0;
      applyBenneRuntimeHiDpiLayout(
        game,
        'visual',
        state,
      );
      scheduleCommit();
    });
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    runStartupCommitBurst(game, state, STARTUP_COMMIT_MAX_RAF_RETRIES);
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
    if (bufferCommitTimeout !== 0) {
      window.clearTimeout(bufferCommitTimeout);
      bufferCommitTimeout = 0;
    }
    hiDpiLayoutStateByGame.delete(game);
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
  const state = hiDpiLayoutStateByGame.get(game) ?? {
    lastCanvasStyleSignatureRef: { value: '' },
    lastBufferSignatureRef: { value: '' },
    lastCameraSignatureRef: { value: '' },
  };
  // Force a startup commit regardless of prior signatures (scene starts can race with initial size wiring).
  state.lastCanvasStyleSignatureRef.value = '';
  state.lastBufferSignatureRef.value = '';
  state.lastCameraSignatureRef.value = '';
  runStartupCommitBurst(game, state, STARTUP_COMMIT_MAX_RAF_RETRIES);
  requestAnimationFrame(() => runStartupCommitBurst(game, state, STARTUP_COMMIT_MAX_RAF_RETRIES));
}
