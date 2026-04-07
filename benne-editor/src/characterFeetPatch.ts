import * as vscode from 'vscode';

export type CharacterFeetPayload = { x: number; y: number };

function roundFeet(f: CharacterFeetPayload): CharacterFeetPayload {
  return { x: Math.round(f.x), y: Math.round(f.y) };
}

/**
 * Writes `feet` into `*.character.json` (merges top-level field).
 */
export async function applyCharacterFeetPatch(
  characterJsonUri: vscode.Uri,
  feet: CharacterFeetPayload,
): Promise<CharacterFeetPayload> {
  const rounded = roundFeet(feet);
  const raw = await vscode.workspace.fs.readFile(characterJsonUri);
  const text = Buffer.from(raw).toString('utf8');
  const data = JSON.parse(text) as Record<string, unknown>;
  data.feet = { x: rounded.x, y: rounded.y };
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
    throw new Error('Feet were written to the buffer but the file could not be saved to disk.');
  }
  return rounded;
}
