import type { Dialog, DialogOption } from '../../types/dialogue.js';

const definitions = new Map<string, Dialog>();

function normalizeOption(raw: DialogOption): DialogOption {
  return {
    id: raw.id,
    text: raw.text,
    enabled: raw.enabled !== false,
    used: raw.used === true,
  };
}

/** Register a validated dialog definition (from eager-loaded `*.dialog.json`). */
export function registerDialogDefinition(data: Dialog): void {
  const guiId = data.guiId?.trim() || 'dialog';
  definitions.set(data.id, {
    ...data,
    guiId,
    options: data.options.map(normalizeOption),
  });
}

export function getDialogDefinition(dialogId: string): Dialog | undefined {
  return definitions.get(dialogId);
}

export function getRegisteredDialogDefinitionIds(): string[] {
  return [...definitions.keys()].sort((a, b) => a.localeCompare(b));
}

/** GUI overlay ids reserved for the choice-dialog system (`dialog` plus any per-definition `guiId`). */
export function getRegisteredDialogChoiceGuiIds(): string[] {
  const ids = new Set<string>(['dialog']);
  for (const id of getRegisteredDialogDefinitionIds()) {
    const d = definitions.get(id);
    const g = d?.guiId?.trim();
    if (g && g.length > 0) {
      ids.add(g);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}
