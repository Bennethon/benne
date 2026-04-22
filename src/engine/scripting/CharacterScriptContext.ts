import * as Phaser from 'phaser';
import type { CharacterScriptContext } from './types.js';
import { CharacterBenneScript } from './CharacterBenneScript.js';
import type { RoomScene } from '../scenes/RoomScene.js';

export function createCharacterScriptContext(
  events: Phaser.Events.EventEmitter,
  characterId: string,
  roomId: string,
  roomScene: RoomScene,
): CharacterScriptContext {
  const B = new CharacterBenneScript(events, characterId, roomId, roomScene);

  return {
    B,
    events,
    characterId,
    roomId,
    roomScene,
    whenInventoryUsedOn: B.whenInventoryUsedOn,
  };
}
