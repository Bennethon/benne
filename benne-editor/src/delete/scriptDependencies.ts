/**
 * Where a BenneScript file depends on content that is about to be deleted, for the delete
 * warning: uses of its generated handles, imports of a generated module deleted with it, and
 * speech lines whose speaker is a deleted character (`Jensen: "…"`, `` say`Jensen: …` ``).
 *
 * Pure (no `vscode`).
 */
import * as path from 'node:path';
import type { ContentRef, IdsIndex } from '../bennescript/idsIndex';
import { resolveReference, type ScriptModel } from '../bennescript/scriptModel';
import { resolveSpeaker, type SpeakerTable } from '../bennescript/speakers';

type FileUri = { readonly fsPath: string };

/** The parts of a `DeleteTarget` the scan needs (structural, so this module stays free of `vscode`). */
export type DeletedContent =
    | { type: 'room'; roomId: string; roomJsonUri: FileUri }
    | { type: 'character'; characterId: string; characterJsonUri: FileUri }
    | { type: 'gui'; guiId: string; guiJsonUri: FileUri }
    | { type: 'inventory'; itemId: string }
    | { type: 'dialog'; dialogId: string; dialogJsonUri: FileUri }
    | { type: 'prop'; roomId: string; prop: { id: string } }
    | { type: 'hotspot'; roomId: string; hotspotId: string }
    | { type: 'point'; roomId: string; pointId: string }
    | { type: 'region'; roomId: string; regionId: string }
    | { type: 'spawnedCharacter'; roomId: string; characterId: string }
    | { type: 'guiControl'; guiId: string; controlId: string }
    | { type: 'pdc' | 'walkablePolygon' | 'walkableHole' };

export interface ScriptDependencyQuery {
    /** Whether a resolved handle reference is, or belongs to, the deleted content. */
    refersTo(ref: ContentRef): boolean;
    /** Absolute path of a generated `.ids.ts` module deleted with the content: any import of it breaks. */
    deletedModule?: string;
    /** A deleted character: speaker labels resolve to it the way the build resolves them. */
    character?: { id: string; speakers: SpeakerTable };
}

/** Whether a resolved handle reference points at the content being deleted. */
export function refersToDeleteTarget(ref: ContentRef, target: DeletedContent): boolean {
    const r = ref as { kind: string; id?: string; roomId?: string | null; dialogId?: string; guiId?: string };
    switch (target.type) {
        case 'room':
            // The room, and everything its module exports (props, hotspots, places, spawned characters).
            return (r.kind === 'room' && r.id === target.roomId) || r.roomId === target.roomId;
        case 'character':
            return r.kind === 'character' && r.id === target.characterId;
        case 'gui':
            return (r.kind === 'gui' && r.id === target.guiId) || (r.kind === 'guiControl' && r.guiId === target.guiId);
        case 'inventory':
            return r.kind === 'item' && r.id === target.itemId;
        case 'dialog':
            return (r.kind === 'dialog' && r.id === target.dialogId) || (r.kind === 'dialogOption' && r.dialogId === target.dialogId);
        case 'prop':
            return r.kind === 'prop' && r.roomId === target.roomId && r.id === target.prop.id;
        case 'hotspot':
            return r.kind === 'hotspot' && r.roomId === target.roomId && r.id === target.hotspotId;
        case 'point':
            return r.kind === 'point' && r.roomId === target.roomId && r.id === target.pointId;
        case 'region':
            return r.kind === 'region' && r.roomId === target.roomId && r.id === target.regionId;
        case 'spawnedCharacter':
            return r.kind === 'character' && r.roomId === target.roomId && r.id === target.characterId;
        case 'guiControl':
            return target.controlId !== '' && r.kind === 'guiControl' && r.guiId === target.guiId && r.id === target.controlId;
        default:
            return false;
    }
}

/** The generated `.ids.ts` module deleted along with the target (rooms, characters, GUIs, dialogs). */
export function deletedModuleOf(target: DeletedContent): string | undefined {
    const json =
        target.type === 'room'
            ? target.roomJsonUri
            : target.type === 'character'
              ? target.characterJsonUri
              : target.type === 'gui'
                ? target.guiJsonUri
                : target.type === 'dialog'
                  ? target.dialogJsonUri
                  : undefined;
    if (!json) {
        return undefined;
    }
    const dir = path.dirname(json.fsPath);
    return path.join(dir, `${path.basename(dir)}.ids.ts`);
}

/** What to look for when deleting `target`; `speakers` is the game's speaker table (for characters). */
export function dependencyQuery(target: DeletedContent, speakers?: SpeakerTable): ScriptDependencyQuery {
    return {
        refersTo: (ref) => refersToDeleteTarget(ref, target),
        deletedModule: deletedModuleOf(target),
        character: target.type === 'character' && speakers ? { id: target.characterId, speakers } : undefined,
    };
}

/** Source offsets in `model` that depend on the deleted content, in order. */
export function scriptDependencyOffsets(model: ScriptModel, index: IdsIndex, query: ScriptDependencyQuery): number[] {
    const offsets: number[] = [];
    if (query.deletedModule) {
        const deleted = path.resolve(query.deletedModule);
        for (const decl of model.imports) {
            const resolved = index.resolveSpecifier(model.fileName, decl.module);
            if (resolved !== undefined && path.resolve(resolved) === deleted) {
                offsets.push(decl.start);
            }
        }
    }
    for (const reference of model.references) {
        const ref = resolveReference(model, index, reference.path);
        if (ref && query.refersTo(ref)) {
            offsets.push(reference.start);
        }
    }
    const character = query.character;
    if (character) {
        // Method calls (`jensen.say(…)`) are references above; `Player` is whoever plays, not a character.
        for (const line of model.speech) {
            if (line.speakerLabel === undefined || line.speakerStart === undefined || line.speakerLabel.includes('${')) {
                continue;
            }
            const resolved = resolveSpeaker(line.speakerLabel, character.speakers);
            if ('id' in resolved && resolved.id === character.id) {
                offsets.push(line.speakerStart);
            }
        }
    }
    return offsets.sort((a, b) => a - b);
}
