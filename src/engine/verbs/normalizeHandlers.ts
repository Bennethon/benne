import type { CharacterData } from '../../types/character';
import type { RoomPropInstance, RoomHotspotData } from '../../types/room';
import type { VerbHandlerMap } from './dispatchVerb';

export function getPropVerbHandlers(prop: RoomPropInstance): VerbHandlerMap {
  return { onVerb: { ...(prop.onVerb ?? {}) }, onVerbFallback: prop.onVerbFallback };
}

export function getHotspotVerbHandlers(hotspot: RoomHotspotData): VerbHandlerMap {
  return { onVerb: { ...(hotspot.onVerb ?? {}) }, onVerbFallback: hotspot.onVerbFallback };
}

export function getCharacterVerbHandlers(character: CharacterData): VerbHandlerMap {
  return { onVerb: { ...(character.onVerb ?? {}) }, onVerbFallback: character.onVerbFallback };
}
