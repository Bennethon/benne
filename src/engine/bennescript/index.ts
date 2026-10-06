/**
 * `@benne/script`: the new BenneScript API (docs/bennescript-ergonomics-refactor.md).
 *
 * The handle classes are created by the generated `@game` and `.ids` modules (§7).
 */
import { currentContext } from './interactionContext.js';
import { sayLine } from './actions.js';

export {
  display,
  faceClicked,
  fadeIn,
  fadeOut,
  inventory,
  player,
  say,
  wait,
  waitForClick,
  walkToClicked,
  type FacingOptions,
  type Inventory,
  type ItemRef,
  type WalkTarget,
} from './actions.js';
export { background, cutscene, input, together, withInputDisabled } from './blocks.js';
export { camera } from './camera.js';
export { events, type EngineEventName, type EventName } from './events.js';
export { game, pointer, settings, type PointerHover } from './game.js';
export { onUpdate } from './globalHandlers.js';
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
  withMusicControls,
  withSfxControls,
  withVerbMethods,
  withVideoControls,
  type FallbackTarget,
  type ItemHandlerOptions,
  type FlagSpec,
  type MusicControls,
  type SfxControls,
  type StepHandler,
  type VarValue,
  type VerbSpec,
  type VideoControls,
} from './handles.js';
export { unhandled } from './interactionContext.js';
export { playFrom } from './roomHandlers.js';
export { saves, type SaveInfo, type SaveRef } from './saves.js';
export { Task, type Timed } from './task.js';

/** Used only by code the build transform emits. Not part of the authoring API. */
export const __runtime = {
  ctx: currentContext,
  say: sayLine,
};
