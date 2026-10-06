import type { SourceMap } from 'magic-string';

export declare const BENNESCRIPT_RUNTIME_MODULE: string;

import type { SpeakerTable } from './benneSpeakers.mjs';

export type { SpeakerTable };
export { buildSpeakerTable, normalizeSpeakerLabel, resolveSpeaker } from './benneSpeakers.mjs';

export declare function isBenneScriptFile(id: string): boolean;

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
