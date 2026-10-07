import type { SourceMap } from 'magic-string';

export declare const BENNESCRIPT_RUNTIME_MODULE: string;

import type { SpeakerTable } from './benneSpeakers.mjs';

export type { SpeakerTable };
export { buildSpeakerTable, normalizeSpeakerLabel, resolveSpeaker } from './benneSpeakers.mjs';

export declare function isBenneScriptFile(id: string): boolean;

/** The label of `() => Label: …` when `pos` is its colon (the parse error's position), else `undefined`. */
export declare function arrowSpeechLabelAt(code: string, pos: number): string | undefined;

/** The error that says to put an arrow-body speech line in braces. */
export declare function arrowSpeechMessage(label: string): string;

export declare class BenneScriptTransformError extends Error {
  /** UTF-16 offset in the source. */
  readonly pos: number;
  constructor(message: string, pos: number);
}

/** `null` when the file has no step functions. Throws {@link BenneScriptTransformError} on authoring errors. */
export declare function transformBenneScript(
  code: string,
  options: { filename: string; speakers: SpeakerTable },
): { code: string; map: SourceMap } | null;
