import type { Dialog, DialogOption } from '../../types/dialogue.js';
import { registerDialogDefinition } from '../dialog/dialogDefinitionRegistry.js';

function rawJsonFromModule(mod: { default?: unknown } | Record<string, unknown>): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default?: unknown }).default;
  }
  return mod;
}

function isDialogOption(value: unknown): value is DialogOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    return false;
  }
  if (typeof o.text !== 'string') {
    return false;
  }
  if (o.enabled !== undefined && typeof o.enabled !== 'boolean') {
    return false;
  }
  if (o.used !== undefined && typeof o.used !== 'boolean') {
    return false;
  }
  if (o.say !== undefined && typeof o.say !== 'boolean') {
    return false;
  }
  return true;
}

function isDialog(value: unknown): value is Dialog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    return false;
  }
  if (o.displayName !== undefined && typeof o.displayName !== 'string') {
    return false;
  }
  if (o.guiId !== undefined && typeof o.guiId !== 'string') {
    return false;
  }
  if (!Array.isArray(o.options)) {
    return false;
  }
  for (const opt of o.options) {
    if (!isDialogOption(opt)) {
      return false;
    }
  }
  return true;
}

/** Eager-loads dialog JSON modules under `./dialogs/` into the engine registry (before gameplay). */
export function registerDialogDefinitionsFromGame(): void {
  const modules = import.meta.glob('/src/game/dialogs/**/*.dialog.json', {
    eager: true,
  }) as Record<string, { default?: unknown } | Record<string, unknown>>;

  for (const [path, mod] of Object.entries(modules)) {
    const raw = rawJsonFromModule(mod);
    if (!isDialog(raw)) {
      console.error(`[Benne] Invalid dialog JSON shape at ${path}`);
      continue;
    }
    const m = path.match(/\/dialogs\/([^/]+)\//);
    const folderId = m?.[1];
    if (folderId && folderId !== raw.id) {
      console.warn(
        `[Benne] Dialog folder "${folderId}" does not match JSON id "${raw.id}" (${path}) - definition still registered.`,
      );
    }
    registerDialogDefinition(raw);
  }
}
