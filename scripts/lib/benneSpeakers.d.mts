export interface SpeakerTable {
  readonly byLabel: ReadonlyMap<string, ReadonlySet<string>>;
  readonly labels: ReadonlyArray<{ label: string; normalized: string }>;
}

export declare const PLAYER_SPEAKER: string;
export declare function normalizeSpeakerLabel(label: string): string;
export declare function buildSpeakerTable(characters: ReadonlyArray<{ id: string; name?: string }>): SpeakerTable;
export declare function resolveSpeaker(label: string, table: SpeakerTable): { id: string } | { error: string };
export declare function speakerTableWarnings(table: SpeakerTable): string[];
export declare function readCharacterSpeakers(gameRoot: string): Array<{ id: string; name?: string }>;
