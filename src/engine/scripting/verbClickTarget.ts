import * as Phaser from 'phaser';
import type { ResolvableTargetId } from '../../types/generated/benne-game-ids.js';
import type { Point2 } from '../../types/room.js';
import { getCharacterWorldFeet } from '../characterFeet.js';
import type { VerbInteractTarget } from '../events/verbInteractionEvents.js';
import type { RoomScene } from '../scenes/RoomScene.js';

/*
 * Where "the clicked thing" is, read from a verb / inventory-on-target event payload. Shared by
 * the old `B.walkToClicked` / `B.faceClicked` and the new BenneScript runtime.
 */

/**
 * Resolves the string id (or explicit `{ x, y }`) to pass to {@link RoomScene.walkPlayerTo} for
 * **`walkToClicked`** / **`walkToClicked.now`**, from the event payload of a verb handler.
 *
 * Returns **`null`** when the interaction is not tied to a room hit target (e.g. inventory-row
 * verbs from {@link import('../events/inventoryVerbEvents.js').dispatchInventoryVerbInteraction},
 * or use-on-another-inventory-item).
 */
export function resolveWalkToClickedTargetFromPayload(payload: unknown): Point2 | ResolvableTargetId | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  const p = payload as Record<string, unknown>;

  if ('target' in p && p.target && typeof p.target === 'object' && 'type' in (p.target as object)) {
    const t = p.target as VerbInteractTarget;
    if (t.type === 'prop') return t.propId;
    if (t.type === 'hotspot') return t.hotspotId;
    if (t.type === 'character') return t.characterId;
    if (t.type === 'inventoryItem') return null;
  }

  if (typeof p.propId === 'string') return p.propId;
  if (typeof p.hotspotId === 'string') return p.hotspotId;
  if (typeof p.characterId === 'string') return p.characterId;

  if (p.targetType === 'inventoryItem') {
    return null;
  }

  // `InventoryVerbInteractPayload` — look/use on a row in the inventory UI only.
  if (
    typeof p.itemId === 'string' &&
    typeof p.roomId === 'string' &&
    typeof p.verbId === 'string' &&
    !('targetType' in p) &&
    !('instanceId' in p) &&
    !('propId' in p) &&
    !('hotspotId' in p) &&
    !('characterId' in p) &&
    !('tag' in p)
  ) {
    return null;
  }

  return null;
}

function readPayloadLookAtPoint(payload: Record<string, unknown>): Point2 | null {
  const lp = payload.lookAtPoint;
  if (lp && typeof lp === 'object' && typeof (lp as Point2).x === 'number' && typeof (lp as Point2).y === 'number') {
    return { x: (lp as Point2).x, y: (lp as Point2).y };
  }
  return null;
}

/**
 * World / room pixel point the player should face for **`faceClicked`**: payload **`lookAtPoint`**
 * when present, else the clicked **character’s feet** (no `lookAtPoint` on characters in data).
 */
export function resolveFaceLookWorldFromPayload(payload: unknown, scene: RoomScene): Point2 | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }
  const p = payload as Record<string, unknown>;

  const fromLookAt = readPayloadLookAtPoint(p);
  if (fromLookAt) {
    return fromLookAt;
  }

  // Character verbs / inventory-on-character: face the NPC’s feet (not talkPoint).
  if (typeof p.characterId === 'string' && typeof p.propId !== 'string') {
    const sprite = scene.getCharacterSprite(p.characterId);
    if (sprite) {
      return getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
    }
    return null;
  }

  if ('target' in p && p.target && typeof p.target === 'object' && 'type' in (p.target as object)) {
    const t = p.target as VerbInteractTarget;
    if (t.type === 'prop' && t.lookAtPoint) {
      return { x: t.lookAtPoint.x, y: t.lookAtPoint.y };
    }
    if (t.type === 'hotspot' && t.lookAtPoint) {
      return { x: t.lookAtPoint.x, y: t.lookAtPoint.y };
    }
    if (t.type === 'character') {
      const sprite = scene.getCharacterSprite(t.characterId);
      if (sprite) {
        return getCharacterWorldFeet(sprite as Phaser.GameObjects.Sprite);
      }
    }
    if (t.type === 'inventoryItem') {
      return null;
    }
  }

  return null;
}
