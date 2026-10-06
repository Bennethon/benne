import { roomFor, walkTargetOf, type WalkTarget } from './actions.js';
import { Task, timed } from './task.js';

/**
 * The room camera (§4.11). Moves and zooms wait; `.now` doesn't. `seconds` defaults to the room's
 * configured transition time; `0` is instant.
 */
export const camera = {
  /** Pans to a point, a named point or a thing. Waits. */
  focus: timed((target: WalkTarget, seconds?: number): Task => {
    const scene = roomFor('camera.focus');
    return scene ? new Task(scene.queueCameraFocus(walkTargetOf(target), seconds)) : Task.resolved();
  }),

  /** Zooms to `zoom` (2 = twice as close). Waits. */
  zoom: timed((zoom: number, seconds?: number): Task => {
    const scene = roomFor('camera.zoom');
    return scene ? new Task(scene.queueCameraSetZoom(zoom, seconds)) : Task.resolved();
  }),

  /** Pans to `target` and zooms to `zoom` together. Waits. */
  zoomTo: timed((target: WalkTarget, zoom: number, seconds?: number): Task => {
    const scene = roomFor('camera.zoomTo');
    return scene ? new Task(scene.queueCameraZoomTo(walkTargetOf(target), zoom, seconds)) : Task.resolved();
  }),

  /** Back to following the player at the room's zoom. Waits. */
  reset: timed((seconds?: number): Task => {
    const scene = roomFor('camera.reset');
    return scene ? new Task(scene.queueCameraReset(seconds)) : Task.resolved();
  }),

  /** Back to the room's zoom, keeping the current focus. Waits. */
  resetZoom: timed((seconds?: number): Task => {
    const scene = roomFor('camera.resetZoom');
    return scene ? new Task(scene.queueCameraResetZoom(seconds)) : Task.resolved();
  }),

  /** Shakes the camera. Doesn't wait. */
  shake(intensity?: number, seconds?: number, falloff?: boolean): void {
    roomFor('camera.shake')?.cameraShake(intensity, seconds, falloff);
  },
};
