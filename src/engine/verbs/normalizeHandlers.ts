import type { CharacterData } from '../../types/character';
import type { RoomPropInstance, RoomHotspotData } from '../../types/room';
import type { VerbHandlerMap } from './dispatchVerb';

function mergeLegacyLookUse(
  onVerb: Record<string, string>,
  onLook: string | undefined,
  onUse: string | undefined,
): void {
  if (onLook !== undefined && onVerb.look === undefined) {
    onVerb.look = onLook;
  }
  if (onUse !== undefined && onVerb.use === undefined) {
    onVerb.use = onUse;
  }
}

export function getPropVerbHandlers(prop: RoomPropInstance): VerbHandlerMap {
  const onVerb: Record<string, string> = { ...(prop.onVerb ?? {}) };
  mergeLegacyLookUse(onVerb, prop.onLook, prop.onUse);
  return { onVerb, onVerbFallback: prop.onVerbFallback };
}

export function getHotspotVerbHandlers(hotspot: RoomHotspotData): VerbHandlerMap {
  const onVerb: Record<string, string> = { ...(hotspot.onVerb ?? {}) };
  mergeLegacyLookUse(onVerb, hotspot.onLook, hotspot.onUse);
  return { onVerb, onVerbFallback: hotspot.onVerbFallback };
}

export function getCharacterVerbHandlers(character: CharacterData): VerbHandlerMap {
  const onVerb: Record<string, string> = { ...(character.onVerb ?? {}) };
  mergeLegacyLookUse(onVerb, character.onLook, character.onUse);
  return { onVerb, onVerbFallback: character.onVerbFallback };
}
