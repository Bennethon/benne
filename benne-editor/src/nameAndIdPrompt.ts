import * as vscode from 'vscode';
import { validateSlug } from './roomScaffolding';

/** Slug proposed for the id prompt: lowercase, runs of other characters become `-`, edges trimmed. */
export function proposeIdFromName(name: string, fallback: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : fallback;
}

export type NameAndIdPromptOptions = {
    namePrompt: string;
    namePlaceHolder: string;
    idPrompt: string;
    /** Label used in the id validation message, e.g. `Room id`. */
    idLabel: string;
    /** Proposed id when the name has no usable characters. */
    fallbackId: string;
};

/**
 * Shared first steps of every create wizard: ask for the display name, then the id,
 * pre-filled with {@link proposeIdFromName}. Returns `undefined` if either prompt is cancelled.
 */
export async function promptForNameAndId(
    opts: NameAndIdPromptOptions
): Promise<{ name: string; id: string } | undefined> {
    const rawName = await vscode.window.showInputBox({
        prompt: opts.namePrompt,
        placeHolder: opts.namePlaceHolder,
        validateInput: (v) => {
            if (!v || !v.trim()) {
                return 'Name is required';
            }
            return null;
        }
    });
    if (!rawName) {
        return undefined;
    }
    const name = rawName.trim();

    const rawId = await vscode.window.showInputBox({
        prompt: opts.idPrompt,
        value: proposeIdFromName(name, opts.fallbackId),
        validateInput: (v) => validateSlug(v?.trim() ?? '', opts.idLabel)
    });
    if (!rawId) {
        return undefined;
    }
    return { name, id: rawId.trim() };
}
