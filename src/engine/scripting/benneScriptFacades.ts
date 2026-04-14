import type { CharacterFacingLetter } from '../../types/character.js';
import type { Point2 } from '../../types/room.js';
import type { BenneScriptSayArgs, BlockingWithNow } from './BenneScriptCore.js';

/** Visibility + description overrides for one prop (`BenneScript.prop`). */
export interface BenneScriptPropFacade {
  hide(): void;
  show(): void;
  get visible(): boolean;
  set visible(v: boolean);
  get description(): string;
  set description(v: string);
}

/** Movement + animation + facing for the player. */
export interface BenneScriptPlayerFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}

/** Movement + animation + facing for an NPC. */
export interface BenneScriptCharacterFacade {
  walkTo: BlockingWithNow<[Point2 | string]>;
  playAnimation: BlockingWithNow<[string]>;
  say: BlockingWithNow<BenneScriptSayArgs>;
  face: BlockingWithNow<[CharacterFacingLetter]>;
}
