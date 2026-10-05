import type { SourceMap } from 'magic-string';

export declare const BENNESCRIPT_RUNTIME_MODULE: string;

export interface SpeakerTable {
  readonly byLabel: ReadonlyMap<string, ReadonlySet<string>>;
  readonly labels: ReadonlyArray<{ label: string; normalized: string }>;
}

export declare function isBenneScriptFile(id: string): boolean;
export declare function usesNewBenneScriptApi(code: string): boolean;
export declare function normalizeSpeakerLabel(label: string): string;
export declare function buildSpeakerTable(characters: ReadonlyArray<{ id: string; name?: string }>): SpeakerTable;

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
