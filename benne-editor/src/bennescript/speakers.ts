/**
 * Speaker-label resolution for BenneScript (docs/bennescript-ergonomics-refactor.md §4.2, decision 4).
 *
 * A mirror of `scripts/lib/benneSpeakers.mjs`, which the build transform uses. The extension and its
 * TS server plugin are CommonJS bundles and can't import that ES module, so the rules live here too.
 * `tests/unit/editorScriptModel.test.ts` checks that both give the same answers.
 *
 * Pure apart from {@link readCharacterSpeakers}; no `vscode` import (the TS server plugin uses it).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Speaker id for `Player:` labels (the active player). */
export const PLAYER_SPEAKER = 'Player';
const PLAYER_LABEL = 'player';

export interface CharacterSpeaker {
    readonly id: string;
    readonly name?: string;
}

export interface SpeakerTable {
    readonly byLabel: ReadonlyMap<string, ReadonlySet<string>>;
    readonly labels: ReadonlyArray<{ label: string; normalized: string; id: string }>;
}

export type SpeakerResolution = { id: string } | { error: string; ambiguous?: readonly string[] };

/** Letters and digits only, lower case (§4.2). */
export function normalizeSpeakerLabel(label: string): string {
    return String(label).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export function buildSpeakerTable(characters: readonly CharacterSpeaker[]): SpeakerTable {
    const byLabel = new Map<string, Set<string>>();
    const labels: Array<{ label: string; normalized: string; id: string }> = [];
    const add = (label: string, id: string): void => {
        const normalized = normalizeSpeakerLabel(label);
        if (!normalized) {
            return;
        }
        let ids = byLabel.get(normalized);
        if (!ids) {
            ids = new Set();
            byLabel.set(normalized, ids);
        }
        ids.add(id);
        labels.push({ label: String(label).replace(/[^A-Za-z0-9]/g, ''), normalized, id });
    };
    for (const c of characters) {
        // Names first, so "Did you mean" suggests the display name when both are equally close.
        if (c.name) {
            add(c.name, c.id);
        }
        add(c.id, c.id);
    }
    return { byLabel, labels };
}

function levenshtein(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return row[b.length];
}

/** Resolves one label, with the same messages as the build transform. */
export function resolveSpeaker(label: string, table: SpeakerTable): SpeakerResolution {
    const normalized = normalizeSpeakerLabel(label);
    if (normalized === PLAYER_LABEL) {
        return { id: PLAYER_SPEAKER };
    }
    const ids = table.byLabel.get(normalized);
    if (ids && ids.size === 1) {
        return { id: [...ids][0] };
    }
    if (ids && ids.size > 1) {
        const sorted = [...ids].sort();
        return {
            error:
                `Speaker \`${label}\` matches more than one character: ${sorted.join(', ')}. ` +
                'Use the other form of the name, or `characters.<id>.say(…)`.',
            ambiguous: sorted,
        };
    }
    let best: { d: number; label: string } | null = null;
    for (const candidate of [{ label: 'Player', normalized: PLAYER_LABEL }, ...table.labels]) {
        const d = levenshtein(normalized, candidate.normalized);
        if (d <= 2 && (best === null || d < best.d)) {
            best = { d, label: candidate.label };
        }
    }
    return { error: `Unknown speaker \`${label}\`.${best ? ` Did you mean \`${best.label}\`?` : ''}` };
}

/**
 * Labels a script can write for each character, for completions: the display name when it is
 * unambiguous, else the ID; `Player` first.
 */
export function speakerLabelSuggestions(table: SpeakerTable): Array<{ label: string; id: string }> {
    const out: Array<{ label: string; id: string }> = [{ label: 'Player', id: PLAYER_SPEAKER }];
    const seen = new Set<string>([PLAYER_LABEL]);
    for (const entry of table.labels) {
        if (!/^[A-Za-z]/.test(entry.label) || seen.has(entry.normalized)) {
            continue;
        }
        if ((table.byLabel.get(entry.normalized)?.size ?? 0) !== 1) {
            continue;
        }
        // One suggestion per character: the first usable label (the display name when it has one).
        if (out.some((o) => o.id === entry.id)) {
            continue;
        }
        seen.add(entry.normalized);
        out.push({ label: entry.label, id: entry.id });
    }
    return out;
}

/**
 * `{ id, name }` for every `characters/<folder>/*.character.json` under `gameRoot` (`src/game/`).
 * Broken JSON is skipped (validate-content reports it).
 */
export function readCharacterSpeakers(gameRoot: string): CharacterSpeaker[] {
    const charactersDir = path.join(gameRoot, 'characters');
    let dirs: fs.Dirent[];
    try {
        dirs = fs.readdirSync(charactersDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: CharacterSpeaker[] = [];
    for (const dir of dirs) {
        if (!dir.isDirectory()) {
            continue;
        }
        let files: string[];
        try {
            files = fs.readdirSync(path.join(charactersDir, dir.name));
        } catch {
            continue;
        }
        for (const file of files) {
            if (!file.endsWith('.character.json')) {
                continue;
            }
            try {
                const data = JSON.parse(fs.readFileSync(path.join(charactersDir, dir.name, file), 'utf8')) as {
                    id?: unknown;
                    name?: unknown;
                };
                if (typeof data?.id === 'string') {
                    out.push({ id: data.id, name: typeof data.name === 'string' ? data.name : undefined });
                }
            } catch {
                // Speaker labels just won't resolve to it.
            }
        }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Signature of the character JSON files, for caches (folder names + mtimes). */
export function characterSpeakersSignature(gameRoot: string): string {
    const charactersDir = path.join(gameRoot, 'characters');
    const stamps: string[] = [];
    try {
        for (const dir of fs.readdirSync(charactersDir, { withFileTypes: true })) {
            if (!dir.isDirectory()) {
                continue;
            }
            const json = path.join(charactersDir, dir.name, `${dir.name}.character.json`);
            try {
                stamps.push(`${dir.name}:${fs.statSync(json).mtimeMs}`);
            } catch {
                stamps.push(`${dir.name}:-`);
            }
        }
    } catch {
        return 'missing';
    }
    return stamps.sort().join('|');
}

/** `…/src/game` for a file under a BENNE game, else `undefined`. */
export function gameRootOfFile(fileName: string): string | undefined {
    const normalized = fileName.replace(/\\/g, '/');
    const i = normalized.lastIndexOf('/src/game/');
    if (i < 0) {
        return undefined;
    }
    return normalized.slice(0, i + '/src/game'.length);
}
