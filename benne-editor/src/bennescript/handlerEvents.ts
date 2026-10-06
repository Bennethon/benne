/**
 * The Inspector and the Actions tree name verb handlers by engine event ID
 * (`verb:room:club:prop:antenna:look`). This maps those IDs to {@link HandlerSpec}s.
 *
 * Pure (no `vscode`).
 */
import type { HandlerSpec, VerbTarget } from './handlerSpecs';

export function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
    return `verb:room:${roomId}:prop:${propId}:${verbId}`;
}

export function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:${verbId}`;
}

export function roomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): string {
    return `verb:room:${roomId}:character:${characterId}:${verbId}`;
}

export function characterVerbEventId(characterId: string, verbId: string): string {
    return `verb:character:${characterId}:${verbId}`;
}

export function inventoryVerbEventId(itemId: string, verbId: string): string {
    return `verb:inventory:${itemId}:${verbId}`;
}

/** Per-object verb fallbacks (`onVerbFallback` in JSON) have no BenneScript handler. */
export function isFallbackEventId(eventId: string): boolean {
    return /:fallback$/.test(eventId);
}

export function verbSpec(target: VerbTarget, verbId: string): HandlerSpec {
    return { kind: 'verb', target, verbId };
}

/** `verb:room:club:hotspot:club-hotspot-battery:look` → `battery.onLook` in `club.room.ts`. */
export function handlerSpecFromEventId(eventId: string): HandlerSpec | undefined {
    if (isFallbackEventId(eventId)) {
        return undefined;
    }
    const room = /^verb:room:([^:]+):(prop|hotspot|character|inventory):([^:]+):([^:]+)$/.exec(eventId);
    if (room) {
        const [, roomId, kind, id, verbId] = room;
        const target: VerbTarget =
            kind === 'inventory'
                ? { kind: 'item', id }
                : kind === 'character'
                  ? { kind: 'character', roomId, id }
                  : { kind: kind as 'prop' | 'hotspot', roomId, id };
        return verbSpec(target, verbId);
    }
    const character = /^verb:character:([^:]+):([^:]+)$/.exec(eventId);
    if (character) {
        return verbSpec({ kind: 'character', roomId: null, id: character[1] }, character[2]);
    }
    const item = /^verb:inventory:([^:]+):([^:]+)$/.exec(eventId);
    if (item) {
        return verbSpec({ kind: 'item', id: item[1] }, item[2]);
    }
    return undefined;
}
