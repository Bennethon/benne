/**
 * Speaker-label resolution for BenneScript (docs/bennescript-ergonomics-refactor.md §4.2,
 * decision 4). Shared by the build transform (`Hank: "…"` labels) and the handle generator
 * (which reports ambiguous names up front).
 *
 * A label matches a character by ID or by display name. Both are normalised: drop everything
 * that isn't a letter or digit, then compare case-insensitively. `Player` always means the
 * active player.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Speaker id the transform emits for `Player:` labels (must match `PLAYER_SPEAKER` in the runtime). */
export const PLAYER_SPEAKER = 'Player';
const PLAYER_LABEL = 'player';

/** Letters and digits only, lower case (§4.2). */
export function normalizeSpeakerLabel(label) {
  return String(label).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/**
 * Speaker table from character JSON: normalised ID and display name → character ids.
 * @param {ReadonlyArray<{ id: string, name?: string }>} characters
 */
export function buildSpeakerTable(characters) {
  /** @type {Map<string, Set<string>>} */
  const byLabel = new Map();
  /** @type {Array<{ label: string, normalized: string }>} */
  const labels = [];
  const add = (label, id) => {
    const normalized = normalizeSpeakerLabel(label);
    if (!normalized) return;
    let ids = byLabel.get(normalized);
    if (!ids) {
      ids = new Set();
      byLabel.set(normalized, ids);
    }
    ids.add(id);
    labels.push({ label: String(label).replace(/[^A-Za-z0-9]/g, ''), normalized });
  };
  for (const c of characters) {
    // Names first, so "Did you mean" suggests the display name when both are equally close.
    if (c.name) add(c.name, c.id);
    add(c.id, c.id);
  }
  return { byLabel, labels };
}

function levenshtein(a, b) {
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

/**
 * Resolves one label. Ambiguous and unknown labels return an error message for the build.
 * @returns {{ id: string } | { error: string }}
 */
export function resolveSpeaker(label, table) {
  const normalized = normalizeSpeakerLabel(label);
  if (normalized === PLAYER_LABEL) {
    return { id: PLAYER_SPEAKER };
  }
  const ids = table.byLabel.get(normalized);
  if (ids && ids.size === 1) {
    return { id: [...ids][0] };
  }
  if (ids && ids.size > 1) {
    return {
      error:
        `Speaker \`${label}\` matches more than one character: ${[...ids].sort().join(', ')}. ` +
        'Use the other form of the name, or `characters.<id>.say(…)`.',
    };
  }
  let best = null;
  for (const candidate of [{ label: 'Player', normalized: PLAYER_LABEL }, ...table.labels]) {
    const d = levenshtein(normalized, candidate.normalized);
    if (d <= 2 && (best == null || d < best.d)) best = { d, label: candidate.label };
  }
  return { error: `Unknown speaker \`${label}\`.${best ? ` Did you mean \`${best.label}\`?` : ''}` };
}

/**
 * Labels that can't be used, for the generator to report before anyone writes them: names
 * shared by several characters, and characters whose name or ID normalises to `player`.
 * @param {ReturnType<typeof buildSpeakerTable>} table
 * @returns {string[]}
 */
export function speakerTableWarnings(table) {
  const out = [];
  for (const [normalized, ids] of [...table.byLabel].sort(([a], [b]) => a.localeCompare(b))) {
    if (normalized === PLAYER_LABEL) {
      out.push(
        `Character ${[...ids].sort().join(', ')} is named "player": \`Player:\` always means the active player, ` +
          'so use `characters.<id>.say(…)` for this character.',
      );
    } else if (ids.size > 1) {
      out.push(
        `Speaker label \`${normalized}\` matches more than one character (${[...ids].sort().join(', ')}). ` +
          'Labels using it are build errors; use the other form of the name, or `characters.<id>.say(…)`.',
      );
    }
  }
  return out;
}

/**
 * `{ id, name }` for every `characters/<folder>/*.character.json` under `gameRoot`. Broken JSON is
 * skipped (validate-content reports it).
 * @param {string} gameRoot Absolute path to `src/game/`.
 * @returns {Array<{ id: string, name?: string }>}
 */
export function readCharacterSpeakers(gameRoot) {
  const charactersDir = path.join(gameRoot, 'characters');
  if (!fs.existsSync(charactersDir)) {
    return [];
  }
  const out = [];
  for (const dir of fs.readdirSync(charactersDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(charactersDir, dir.name))) {
      if (!file.endsWith('.character.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(charactersDir, dir.name, file), 'utf8'));
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
