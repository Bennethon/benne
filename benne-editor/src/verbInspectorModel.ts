import type * as vscode from 'vscode';
import type { GameConfigVerbEntry, RoomHotspotListEntry, RoomPropEntry } from './gameDiscovery';
import {
    characterVerbEventId,
    inventoryVerbEventId,
    roomCharacterVerbEventId,
    roomHotspotVerbEventId,
    roomPropVerbEventId,
    verbSpec
} from './bennescript/handlerEvents';
import { handlerQuery } from './scriptHandlers';

/**
 * Built-in universal walk verb id (mirrors `WALK_TO_VERB_ID` in the engine). Never shown as a
 * verb chip in the Inspector and never stored as a per-target `onVerb` entry.
 */
const WALK_TO_VERB_ID = 'walkTo';

/** Drop reserved built-in verb ids from an author-configured `verbs[]` list. */
function filterAuthorableVerbs(gameVerbs: readonly GameConfigVerbEntry[]): GameConfigVerbEntry[] {
    return gameVerbs.filter((v) => v.id !== WALK_TO_VERB_ID);
}

export type InspectorVerbChip = {
    verbId: string;
    label: string;
    defined: boolean;
    eventId: string;
    isFallback?: boolean;
};

/** A script file and its current text (`''` when it doesn't exist). */
export type ScriptSource = { uri: vscode.Uri; text: string };

function roomPropFallbackEventId(roomId: string, propId: string): string {
    return `verb:room:${roomId}:prop:${propId}:fallback`;
}

function roomHotspotFallbackEventId(roomId: string, hotspotId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:fallback`;
}

function chipLabel(v: GameConfigVerbEntry): string {
    return v.label?.trim() ? v.label : v.id;
}

/** Chips for a prop: defined when the room script has `prop.on<Verb>(…)` (or `prop.on([...])`). */
export function buildPropVerbChips(
    roomId: string,
    prop: RoomPropEntry,
    gameVerbs: readonly GameConfigVerbEntry[],
    roomScript: ScriptSource
): InspectorVerbChip[] {
    const has = handlerQuery(roomScript.uri, roomScript.text);
    const target = { kind: 'prop', roomId, id: prop.id } as const;
    const out: InspectorVerbChip[] = filterAuthorableVerbs(gameVerbs).map((v) => ({
        verbId: v.id,
        label: chipLabel(v),
        defined: has(verbSpec(target, v.id)),
        eventId: roomPropVerbEventId(roomId, prop.id, v.id)
    }));
    if (prop.onVerbFallback === true) {
        out.push({
            verbId: 'fallback',
            label: 'fallback',
            defined: true,
            eventId: roomPropFallbackEventId(roomId, prop.id),
            isFallback: true
        });
    }
    return out;
}

export function buildHotspotVerbChips(
    roomId: string,
    hotspot: RoomHotspotListEntry,
    gameVerbs: readonly GameConfigVerbEntry[],
    roomScript: ScriptSource
): InspectorVerbChip[] {
    const has = handlerQuery(roomScript.uri, roomScript.text);
    const target = { kind: 'hotspot', roomId, id: hotspot.id } as const;
    const out: InspectorVerbChip[] = filterAuthorableVerbs(gameVerbs).map((v) => ({
        verbId: v.id,
        label: chipLabel(v),
        defined: has(verbSpec(target, v.id)),
        eventId: roomHotspotVerbEventId(roomId, hotspot.id, v.id)
    }));
    if (hotspot.onVerbFallback === true) {
        out.push({
            verbId: 'fallback',
            label: 'fallback',
            defined: true,
            eventId: roomHotspotFallbackEventId(roomId, hotspot.id),
            isFallback: true
        });
    }
    return out;
}

/** A character in a room: handled in the room script or in the character's own script. */
export function buildRoomCharacterVerbChips(
    roomId: string,
    characterId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    roomScript: ScriptSource,
    characterScript: ScriptSource
): InspectorVerbChip[] {
    const inRoom = handlerQuery(roomScript.uri, roomScript.text);
    const inCharacter = handlerQuery(characterScript.uri, characterScript.text);
    return filterAuthorableVerbs(gameVerbs).map((v) => ({
        verbId: v.id,
        label: chipLabel(v),
        defined:
            inRoom(verbSpec({ kind: 'character', roomId, id: characterId }, v.id)) ||
            inCharacter(verbSpec({ kind: 'character', roomId: null, id: characterId }, v.id)),
        eventId: roomCharacterVerbEventId(roomId, characterId, v.id)
    }));
}

export function buildCharacterVerbChips(
    characterId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    characterScript: ScriptSource
): InspectorVerbChip[] {
    const has = handlerQuery(characterScript.uri, characterScript.text);
    return filterAuthorableVerbs(gameVerbs).map((v) => ({
        verbId: v.id,
        label: chipLabel(v),
        defined: has(verbSpec({ kind: 'character', roomId: null, id: characterId }, v.id)),
        eventId: characterVerbEventId(characterId, v.id)
    }));
}

export function buildInventoryVerbChips(
    itemId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    inventoryJsonText: string,
    inventoryScript: ScriptSource
): InspectorVerbChip[] {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(inventoryJsonText) as Record<string, unknown>;
    } catch {
        return [];
    }
    const has = handlerQuery(inventoryScript.uri, inventoryScript.text);
    const target = { kind: 'item', id: itemId } as const;
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerbUnknown = data.onVerb;
    const onVerb =
        onVerbUnknown && typeof onVerbUnknown === 'object' && !Array.isArray(onVerbUnknown)
            ? (onVerbUnknown as Record<string, boolean>)
            : {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = authorable.map((v) => ({
        verbId: v.id,
        label: chipLabel(v),
        defined: onVerb[v.id] === true || has(verbSpec(target, v.id)),
        eventId: inventoryVerbEventId(itemId, v.id)
    }));

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID || onVerb[verbId] !== true) {
            continue;
        }
        out.push({
            verbId,
            label: verbId,
            defined: true,
            eventId: inventoryVerbEventId(itemId, verbId)
        });
    }
    return out;
}
