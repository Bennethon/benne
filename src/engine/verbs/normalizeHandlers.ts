import type { CharacterData } from '../../types/character';
import type { RoomPropInstance, RoomHotspotData } from '../../types/room';
import type { VerbHandlerMap } from './dispatchVerb';

export function getPropVerbHandlers(prop: RoomPropInstance): VerbHandlerMap {
  return {
    onVerbFallback: prop.onVerbFallback === true,
  };
}

export function getHotspotVerbHandlers(hotspot: RoomHotspotData): VerbHandlerMap {
  return {
    onVerbFallback: hotspot.onVerbFallback === true,
  };
}

export function getCharacterVerbHandlers(character: CharacterData): VerbHandlerMap {
  return {
    onVerbFallback: character.onVerbFallback === true,
  };
}
