import * as vscode from 'vscode';
import { enqueueJsonFileWork } from './inspectorJsonDocument';
import { loadRoomData, writeDataJson } from './inspectorMutations';

export type CharacterPointPayload = { x: number; y: number };

export type CharacterGeometryPayload = {
  feet: CharacterPointPayload;
  walkToPoint: CharacterPointPayload;
  talkPoint: CharacterPointPayload;
  collider: { points: CharacterPointPayload[] } | null;
};

function roundPoint(p: CharacterPointPayload): CharacterPointPayload {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function isFinitePoint(p: unknown): p is CharacterPointPayload {
  if (!p || typeof p !== 'object') {
    return false;
  }
  const o = p as Record<string, unknown>;
  return (
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    Number.isFinite(o.x) &&
    Number.isFinite(o.y)
  );
}

/**
 * Writes feet, walkToPoint, talkPoint, and collider into `*.character.json` in one edit.
 * Fewer than three collider vertices removes `collider` (full sprite hit area when clickable).
 *
 * Uses the same disk-then-sync-open-tab path as the Inspector (`writeDataJson`) so an open JSON
 * editor cannot flash new geometry and then be overwritten by a stale buffer or blur-save.
 */
export async function applyCharacterGeometryPatch(
  characterJsonUri: vscode.Uri,
  geometry: CharacterGeometryPayload,
): Promise<void> {
  if (
    !isFinitePoint(geometry.feet) ||
    !isFinitePoint(geometry.walkToPoint) ||
    !isFinitePoint(geometry.talkPoint)
  ) {
    throw new Error('Invalid feet, walkToPoint, or talkPoint coordinates.');
  }

  await enqueueJsonFileWork(characterJsonUri, async () => {
    const data = await loadRoomData(characterJsonUri);
    if (!data) {
      throw new Error('Could not parse character JSON.');
    }

    data.feet = roundPoint(geometry.feet);
    data.walkToPoint = roundPoint(geometry.walkToPoint);
    data.talkPoint = roundPoint(geometry.talkPoint);

    const pts =
      geometry.collider && Array.isArray(geometry.collider.points) ? geometry.collider.points : [];
    const roundedCollider = pts.filter(isFinitePoint).map(roundPoint);

    if (roundedCollider.length >= 3) {
      data.collider = { points: roundedCollider };
    } else {
      delete data.collider;
    }

    await writeDataJson(characterJsonUri, data);
  });
}
