/**
 * Speech lines of a game's scripts with their speaking character, for the voice-ID and
 * localisation tools (docs/bennescript-ergonomics-refactor.md §9). Lines come from the
 * {@link ScriptModel}: `Hank: "…"` labels, `` say`…` `` blocks and `x.say("…")` calls.
 *
 * Speakers resolve like the build transform resolves them (ID or normalised display name; `Player`
 * is the starting player here, since voice files are recorded per character). Method calls resolve
 * through the generated handles (`jensen.say(…)`, `characters.botti3.say(…)`, `player.say(…)`).
 *
 * Pure (no `vscode`).
 */
import * as path from 'node:path';
import type * as TS from 'typescript';
import type { IdsIndex } from './idsIndex';
import { isPlayerPath, parseScriptModel, resolveScriptRef, type SpeechForm } from './scriptModel';
import { PLAYER_SPEAKER, resolveSpeaker, type SpeakerTable } from './speakers';

export const VOICE_MARKER_RE = /^\|(\d+)\|\s*/;

export interface VoiceLineFile {
    /** Path shown to the user and used in exports (relative to the game folder). */
    readonly path: string;
    readonly text: string;
    /** Absolute path, for resolving `./x.ids` imports (defaults to `path`). */
    readonly fileName?: string;
}

export interface VoiceLine {
    readonly path: string;
    readonly form: SpeechForm;
    readonly characterId: string;
    /** Source range of the text, inside the quotes. */
    readonly start: number;
    readonly end: number;
    /** Source text, including any `|12| ` marker. */
    readonly text: string;
    readonly existingId: number | null;
}

export interface SkippedVoiceLine {
    readonly path: string;
    readonly line: number;
    readonly reason: string;
}

export interface VoiceLineScan {
    readonly lines: VoiceLine[];
    readonly skipped: SkippedVoiceLine[];
}

export interface VoiceLineOptions {
    readonly index: IdsIndex;
    readonly speakers: SpeakerTable;
    readonly startingPlayerCharacterId: string;
}

function lineOf(text: string, offset: number): number {
    let n = 1;
    for (let i = 0; i < offset && i < text.length; i++) {
        if (text.charCodeAt(i) === 10) {
            n++;
        }
    }
    return n;
}

export function collectVoiceLines(
    ts: typeof TS,
    files: readonly VoiceLineFile[],
    options: VoiceLineOptions & { gameRoot?: string },
): VoiceLineScan {
    const lines: VoiceLine[] = [];
    const skipped: SkippedVoiceLine[] = [];
    const player = (id: string): string => (id === PLAYER_SPEAKER ? options.startingPlayerCharacterId : id);

    for (const file of files) {
        const fileName = path.resolve(file.fileName ?? file.path);
        const model = parseScriptModel(ts, fileName, file.text);
        const skip = (offset: number, reason: string): void => {
            skipped.push({ path: file.path, line: lineOf(file.text, offset), reason });
        };
        for (const s of model.speech) {
            let characterId: string | undefined;
            if (s.form === 'method') {
                if (isPlayerPath(model, s.receiver)) {
                    characterId = options.startingPlayerCharacterId;
                } else {
                    const ref = resolveScriptRef(model, options.index, s.receiver);
                    if (ref?.kind === 'character') {
                        characterId = ref.id;
                    } else if (ref !== undefined) {
                        continue; // `say` on something that isn't a character
                    } else {
                        const who = s.receiver ? `\`${s.receiver.root}\`` : 'an expression';
                        skip(s.textStart, `the speaker is ${who}, not a character handle`);
                        continue;
                    }
                }
            } else {
                if (s.speakerLabel === undefined) {
                    skip(s.textStart, 'a `say` block line without "Speaker:"');
                    continue;
                }
                if (s.speakerLabel.includes('${')) {
                    skip(s.textStart, 'the speaker is built at runtime');
                    continue;
                }
                const resolved = resolveSpeaker(s.speakerLabel, options.speakers);
                if ('error' in resolved) {
                    if (s.form === 'label' && !s.literal) {
                        continue; // An ordinary label (`outer: for …`), not speech.
                    }
                    skip(s.textStart, resolved.error);
                    continue;
                }
                characterId = player(resolved.id);
            }
            if (!s.literal) {
                skip(s.textStart, 'the text is not a string literal');
                continue;
            }
            const marker = VOICE_MARKER_RE.exec(s.text);
            lines.push({
                path: file.path,
                form: s.form,
                characterId,
                start: s.textStart,
                end: s.textEnd,
                text: s.text,
                existingId: marker ? Number(marker[1]) : null,
            });
        }
    }
    return { lines, skipped };
}
