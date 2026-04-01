import type * as Phaser from 'phaser';

/**
 * Post-processing hook for Phaser 4’s camera {@link Phaser.GameObjects.Components.FilterList}.
 *
 * Custom full-frame effects use `camera.filters.internal` (and optionally `external`).
 * GLSL snippets are typically registered via {@link Phaser.GameObjects.BaseShader} and composed
 * with {@link Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader} render nodes (see Phaser docs).
 *
 * This module is intentionally a no-op until you add CRT, dither wipes, etc.
 */
export function attachPostProcessingPlaceholder(camera: Phaser.Cameras.Scene2D.Camera): void {
  void camera;
  // Example (disabled): camera.filters.internal.addVignette(0.2, 0.3);
}
