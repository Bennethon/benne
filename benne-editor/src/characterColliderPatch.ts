import * as vscode from 'vscode';

export type CharacterColliderPayload = { points: { x: number; y: number }[] };

function roundPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Writes `collider` into `*.character.json` (merges top-level field).
 * Fewer than three points removes `collider` so the engine uses the full sprite hit area.
 */
export async function applyCharacterColliderPatch(
  characterJsonUri: vscode.Uri,
  collider: CharacterColliderPayload,
): Promise<CharacterColliderPayload | null> {
  const raw = await vscode.workspace.fs.readFile(characterJsonUri);
  const text = Buffer.from(raw).toString('utf8');
  const data = JSON.parse(text) as Record<string, unknown>;

  const pts = Array.isArray(collider.points) ? collider.points : [];
  const rounded = pts
    .filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
    .map((p) => roundPoint(p as { x: number; y: number }));

  if (rounded.length >= 3) {
    data.collider = { points: rounded };
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
    throw new Error('Collider was written to the buffer but the file could not be saved to disk.');
  }
  return rounded.length >= 3 ? { points: rounded } : null;
}
