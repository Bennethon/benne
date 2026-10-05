/**
 * `@benne/script`: the new BenneScript API (docs/bennescript-ergonomics-refactor.md).
 *
 * Phase 1 spike: just enough for `src/game/rooms/cafe/cafe.room.ts`. Runs next to the old
 * `register*Script` / `B` API until Phase 6.
 */
import { currentContext } from './interactionContext.js';
import { sayTask } from './actions.js';

export { walkToClicked, faceClicked, wait, inventory, type ItemRef } from './actions.js';
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
export { Task } from './task.js';

/** Used only by code the build transform emits. Not part of the authoring API. */
export const __runtime = {
  ctx: currentContext,
  say: sayTask,
};
