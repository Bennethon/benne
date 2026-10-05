/**
 * `@benne/script`: the new BenneScript API (docs/bennescript-ergonomics-refactor.md).
 *
 * Runs next to the old `register*Script` / `B` API until Phase 6. Phase 2 adds the full step
 * runtime (§5, §10); the handle API is still only what the café needs (Phase 4 completes it).
 */
import { currentContext } from './interactionContext.js';
import { sayLine } from './actions.js';

export { walkToClicked, faceClicked, wait, inventory, player, type ItemRef, type WalkTarget } from './actions.js';
export { background, cutscene, input, together, withInputDisabled } from './blocks.js';
export {
  CharacterHandle,
  ClickableHandle,
  DialogHandle,
  DialogOptionHandle,
  HotspotHandle,
  ItemHandle,
  MusicHandle,
  PropHandle,
  RoomHandle,
  SfxHandle,
  defineFlags,
  withVerbMethods,
  type StepHandler,
  type VerbSpec,
} from './handles.js';
export { unhandled } from './interactionContext.js';
export { saves, type SaveInfo } from './saves.js';
export { Task, type Timed } from './task.js';

/** Used only by code the build transform emits. Not part of the authoring API. */
export const __runtime = {
  ctx: currentContext,
  say: sayLine,
};
