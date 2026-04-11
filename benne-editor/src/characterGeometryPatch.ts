import * as vscode from 'vscode';

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

  const raw = await vscode.workspace.fs.readFile(characterJsonUri);
  const text = Buffer.from(raw).toString('utf8');
  const data = JSON.parse(text) as Record<string, unknown>;

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

  const out = `${JSON.stringify(data, null, 2)}\n`;
  const edit = new vscode.WorkspaceEdit();
  const doc = await vscode.workspace.openTextDocument(characterJsonUri);
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  );
  edit.replace(characterJsonUri, fullRange, out);
  const ok = await vscode.workspace.applyEdit(edit);
  if (!ok) {
    throw new Error('Could not apply workspace edit to character JSON.');
  }
  const saved = await doc.save();
  if (!saved) {
    throw new Error('Character geometry was written to the buffer but the file could not be saved to disk.');
  }
}
