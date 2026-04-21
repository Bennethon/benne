import type { GameConfigVerbEntry, RoomHotspotListEntry, RoomPropEntry } from './gameDiscovery';
import {
    inventoryScriptRegistersVerb,
    characterScriptRegistersVerb,
    readConfiguredVerbIdSet,
    roomScriptRegistersHotspotVerb,
    roomScriptRegistersPropVerb,
    roomScriptRegistersRoomCharacterVerb,
    stripLineAndBlockComments
} from './verbHandlerPresence';

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

function roomPropFallbackEventId(roomId: string, propId: string): string {
    return `verb:room:${roomId}:prop:${propId}:fallback`;
}

function roomHotspotFallbackEventId(roomId: string, hotspotId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:fallback`;
}

function roomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): string {
    return `verb:room:${roomId}:character:${characterId}:${verbId}`;
}

function characterVerbEventId(characterId: string, verbId: string): string {
    return `verb:character:${characterId}:${verbId}`;
}

function inventoryVerbEventId(itemId: string, verbId: string): string {
    return `verb:inventory:${itemId}:${verbId}`;
}

function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
    return `verb:room:${roomId}:prop:${propId}:${verbId}`;
}

function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:${verbId}`;
}

function scriptRegistersPropFallback(source: string, roomId: string, propId: string): boolean {
    const ev = roomPropFallbackEventId(roomId, propId);
    const stripped = stripLineAndBlockComments(source);
    return (
        stripped.includes(`'${ev}'`) ||
        stripped.includes(`"${ev}"`) ||
        stripped.includes('`' + ev + '`')
    );
}

function scriptRegistersHotspotFallback(source: string, roomId: string, hotspotId: string): boolean {
    const ev = roomHotspotFallbackEventId(roomId, hotspotId);
    const stripped = stripLineAndBlockComments(source);
    return (
        stripped.includes(`'${ev}'`) ||
        stripped.includes(`"${ev}"`) ||
        stripped.includes('`' + ev + '`')
    );
}

export function buildPropVerbChips(
    roomId: string,
    prop: RoomPropEntry,
    gameVerbs: readonly GameConfigVerbEntry[],
    configured: ReadonlySet<string>,
    roomScriptText: string
): InspectorVerbChip[] {
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerb = prop.onVerb ?? {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = [];

    for (const v of authorable) {
        const inJson = onVerb[v.id] === true;
        const inTs = roomScriptRegistersPropVerb(roomScriptText, roomId, prop.id, v.id, configured);
        out.push({
            verbId: v.id,
            label: v.label?.trim() ? v.label : v.id,
            defined: inJson || inTs,
            eventId: roomPropVerbEventId(roomId, prop.id, v.id)
        });
    }

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID) {
            continue;
        }
        if (onVerb[verbId] !== true) {
            continue;
        }
        const inTs = roomScriptRegistersPropVerb(roomScriptText, roomId, prop.id, verbId, configured);
        out.push({
            verbId,
            label: verbId,
            defined: onVerb[verbId] === true || inTs,
            eventId: roomPropVerbEventId(roomId, prop.id, verbId)
        });
    }

    if (prop.onVerbFallback === true) {
        const inTs = scriptRegistersPropFallback(roomScriptText, roomId, prop.id);
        out.push({
            verbId: 'fallback',
            label: 'fallback',
            defined: prop.onVerbFallback === true || inTs,
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
    configured: ReadonlySet<string>,
    roomScriptText: string,
    roomPropIds: ReadonlySet<string>
): InspectorVerbChip[] {
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerb = hotspot.onVerb ?? {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = [];

    for (const v of authorable) {
        const inJson = onVerb[v.id] === true;
        const inTs = roomScriptRegistersHotspotVerb(
            roomScriptText,
            roomId,
            hotspot.id,
            v.id,
            configured,
            roomPropIds
        );
        out.push({
            verbId: v.id,
            label: v.label?.trim() ? v.label : v.id,
            defined: inJson || inTs,
            eventId: roomHotspotVerbEventId(roomId, hotspot.id, v.id)
        });
    }

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID) {
            continue;
        }
        if (onVerb[verbId] !== true) {
            continue;
        }
        const inTs = roomScriptRegistersHotspotVerb(
            roomScriptText,
            roomId,
            hotspot.id,
            verbId,
            configured,
            roomPropIds
        );
        out.push({
            verbId,
            label: verbId,
            defined: onVerb[verbId] === true || inTs,
            eventId: roomHotspotVerbEventId(roomId, hotspot.id, verbId)
        });
    }

    if (hotspot.onVerbFallback === true) {
        const inTs = scriptRegistersHotspotFallback(roomScriptText, roomId, hotspot.id);
        out.push({
            verbId: 'fallback',
            label: 'fallback',
            defined: hotspot.onVerbFallback === true || inTs,
            eventId: roomHotspotFallbackEventId(roomId, hotspot.id),
            isFallback: true
        });
    }

    return out;
}

export function buildRoomCharacterVerbChips(
    roomId: string,
    characterId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    configured: ReadonlySet<string>,
    roomScriptText: string,
    characterJsonText: string,
    characterScriptText: string
): InspectorVerbChip[] {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(characterJsonText) as Record<string, unknown>;
    } catch {
        return [];
    }
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerbUnknown = data.onVerb;
    const onVerb =
        onVerbUnknown && typeof onVerbUnknown === 'object' && !Array.isArray(onVerbUnknown)
            ? (onVerbUnknown as Record<string, boolean>)
            : {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = [];

    for (const v of authorable) {
        const inJson = onVerb[v.id] === true;
        const inRoomTs = roomScriptRegistersRoomCharacterVerb(
            roomScriptText,
            roomId,
            characterId,
            v.id,
            configured
        );
        const inCharTs = characterScriptRegistersVerb(characterScriptText, characterId, v.id, configured);
        out.push({
            verbId: v.id,
            label: v.label?.trim() ? v.label : v.id,
            defined: inJson || inRoomTs || inCharTs,
            eventId: roomCharacterVerbEventId(roomId, characterId, v.id)
        });
    }

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID) {
            continue;
        }
        if (onVerb[verbId] !== true) {
            continue;
        }
        const inRoomTs = roomScriptRegistersRoomCharacterVerb(
            roomScriptText,
            roomId,
            characterId,
            verbId,
            configured
        );
        const inCharTs = characterScriptRegistersVerb(characterScriptText, characterId, verbId, configured);
        out.push({
            verbId,
            label: verbId,
            defined: onVerb[verbId] === true || inRoomTs || inCharTs,
            eventId: roomCharacterVerbEventId(roomId, characterId, verbId)
        });
    }

    return out;
}

export function buildCharacterVerbChips(
    characterId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    configured: ReadonlySet<string>,
    characterJsonText: string,
    characterScriptText: string
): InspectorVerbChip[] {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(characterJsonText) as Record<string, unknown>;
    } catch {
        return [];
    }
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerbUnknown = data.onVerb;
    const onVerb =
        onVerbUnknown && typeof onVerbUnknown === 'object' && !Array.isArray(onVerbUnknown)
            ? (onVerbUnknown as Record<string, boolean>)
            : {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = [];

    for (const v of authorable) {
        const inJson = onVerb[v.id] === true;
        const inTs = characterScriptRegistersVerb(characterScriptText, characterId, v.id, configured);
        out.push({
            verbId: v.id,
            label: v.label?.trim() ? v.label : v.id,
            defined: inJson || inTs,
            eventId: characterVerbEventId(characterId, v.id)
        });
    }

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID || onVerb[verbId] !== true) {
            continue;
        }
        const inTs = characterScriptRegistersVerb(characterScriptText, characterId, verbId, configured);
        out.push({
            verbId,
            label: verbId,
            defined: onVerb[verbId] === true || inTs,
            eventId: characterVerbEventId(characterId, verbId)
        });
    }
    return out;
}

export function buildInventoryVerbChips(
    itemId: string,
    gameVerbs: readonly GameConfigVerbEntry[],
    configured: ReadonlySet<string>,
    inventoryJsonText: string,
    inventoryScriptText: string
): InspectorVerbChip[] {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(inventoryJsonText) as Record<string, unknown>;
    } catch {
        return [];
    }
    const authorable = filterAuthorableVerbs(gameVerbs);
    const onVerbUnknown = data.onVerb;
    const onVerb =
        onVerbUnknown && typeof onVerbUnknown === 'object' && !Array.isArray(onVerbUnknown)
            ? (onVerbUnknown as Record<string, boolean>)
            : {};
    const gameVerbIds = new Set(authorable.map((v) => v.id));
    const out: InspectorVerbChip[] = [];

    for (const v of authorable) {
        const inJson = onVerb[v.id] === true;
        const inTs = inventoryScriptRegistersVerb(inventoryScriptText, itemId, v.id, configured);
        out.push({
            verbId: v.id,
            label: v.label?.trim() ? v.label : v.id,
            defined: inJson || inTs,
            eventId: inventoryVerbEventId(itemId, v.id)
        });
    }

    for (const verbId of Object.keys(onVerb).sort()) {
        if (gameVerbIds.has(verbId) || verbId === WALK_TO_VERB_ID || onVerb[verbId] !== true) {
            continue;
        }
        const inTs = inventoryScriptRegistersVerb(inventoryScriptText, itemId, verbId, configured);
        out.push({
            verbId,
            label: verbId,
            defined: onVerb[verbId] === true || inTs,
            eventId: inventoryVerbEventId(itemId, verbId)
        });
    }
    return out;
}
