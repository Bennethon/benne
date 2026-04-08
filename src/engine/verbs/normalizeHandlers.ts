import type { CharacterData } from '../../types/character';
import type { RoomPropInstance, RoomHotspotData } from '../../types/room';
import type { VerbHandlerMap } from './dispatchVerb';

function normalizeVerbSupportMap(raw: Record<string, boolean> | undefined): Record<string, boolean> {
  if (!raw) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [verbId, enabled] of Object.entries(raw)) {
    if (enabled === true) {
      out[verbId] = true;
    }
  }
  return out;
}

export function getPropVerbHandlers(prop: RoomPropInstance): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(prop.onVerb),
    onVerbFallback: prop.onVerbFallback === true,
  };
}

export function getHotspotVerbHandlers(hotspot: RoomHotspotData): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(hotspot.onVerb),
    onVerbFallback: hotspot.onVerbFallback === true,
  };
}

export function getCharacterVerbHandlers(character: CharacterData): VerbHandlerMap {
  return {
    onVerb: normalizeVerbSupportMap(character.onVerb),
    onVerbFallback: character.onVerbFallback === true,
  };
}
