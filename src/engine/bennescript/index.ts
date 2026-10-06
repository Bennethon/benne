/**
 * `@benne/script`: the new BenneScript API (docs/bennescript-ergonomics-refactor.md).
 *
 * Runs next to the old `register*Script` / `B` API until Phase 6. The handle classes are created
 * by the generated `@game` and `.ids` modules (§7); Phase 4 completes their API.
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
  FallbacksHandle,
  GuiControlHandle,
  GuiHandle,
  HotspotHandle,
  ItemHandle,
  MusicHandle,
  PointHandle,
  PropHandle,
  RegionHandle,
  RoomHandle,
  SfxHandle,
  VerbHandle,
  VideoHandle,
  WalkableHandle,
  defineFlags,
  defineVars,
  flag,
  withVerbMethods,
  type FallbackTarget,
  type FlagSpec,
  type StepHandler,
  type VarValue,
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
