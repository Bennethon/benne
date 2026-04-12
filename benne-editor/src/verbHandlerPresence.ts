/**
 * Detect verb handler registrations in room / character scripts, including
 * {@link registerRoomScript} Bennescript (`B.whenLookAt`, …) and direct
 * `roomPropVerbEventId` / `_events.on` patterns in existing sources. Keep alias
 * resolution aligned with `src/engine/scripting/BenneScript.ts`
 * (`VERB_ALIAS_CANDIDATES` + `resolveVerbId`).
 */

import * as vscode from 'vscode';
import { readGameConfigVerbs } from './gameDiscovery';

/** Mirrors `VERB_ALIAS_CANDIDATES` in `BenneScript.ts` — update both if this map changes. */
const VERB_ALIAS_CANDIDATES: Record<
    'look' | 'use' | 'pickUp' | 'give' | 'talkTo' | 'push' | 'pull' | 'open' | 'close',
    readonly string[]
> = {
    look: ['look', 'examine'],
    use: ['use', 'interact'],
    pickUp: ['pickUp', 'pickup', 'take'],
    give: ['give'],
    talkTo: ['talkTo', 'talk', 'speak'],
    push: ['push'],
    pull: ['pull'],
    open: ['open'],
    close: ['close']
};

const SUGAR_METHOD: Record<keyof typeof VERB_ALIAS_CANDIDATES, string> = {
    look: 'whenLookAt',
    use: 'whenUse',
    pickUp: 'whenPickUp',
    give: 'whenGive',
    talkTo: 'whenTalkTo',
    push: 'whenPush',
    pull: 'whenPull',
    open: 'whenOpen',
    close: 'whenClose'
};

export function stripLineAndBlockComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveVerbIdFromAlias(
    alias: keyof typeof VERB_ALIAS_CANDIDATES,
    configuredVerbIds: ReadonlySet<string>
): string {
    const candidates = VERB_ALIAS_CANDIDATES[alias];
    for (const id of candidates) {
        if (configuredVerbIds.has(id)) {
            return id;
        }
    }
    return alias;
}

/** If `verbId` is what a Bennescript sugar resolves to, return that method name (e.g. `whenLookAt`). */
export function benneSugarMethodForVerbId(
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): keyof typeof VERB_ALIAS_CANDIDATES | undefined {
    for (const alias of Object.keys(VERB_ALIAS_CANDIDATES) as (keyof typeof VERB_ALIAS_CANDIDATES)[]) {
        if (resolveVerbIdFromAlias(alias, configuredVerbIds) === verbId) {
            return alias;
        }
    }
    return undefined;
}

/** Matches a TS string literal for `id` (`'…'`, `"…"`, `` `…` ``). */
function quotedId(id: string): string {
    return `['\`"]${escapeRegex(id)}['\`]`;
}

/** `B.onProp('propId', 'verbId',` or `onProp('propId', 'verbId',` */
function rxOnProp(propId: string, verbId: string): RegExp {
    return new RegExp(
        `(?:B\\.)?onProp\\s*\\(\\s*${quotedId(propId)}\\s*,\\s*${quotedId(verbId)}\\s*,`,
        'm'
    );
}

/** `B.whenVerb('verbId', 'targetId',` */
function rxWhenVerbFirstTarget(verbId: string, targetId: string): RegExp {
    return new RegExp(
        `(?:B\\.)?whenVerb\\s*\\(\\s*${quotedId(verbId)}\\s*,\\s*${quotedId(targetId)}\\s*,`,
        'm'
    );
}

/** `(B.)?whenLookAt('targetId',` — method name inserted for each sugar. */
function rxWhenSugar(method: string, targetId: string): RegExp {
    return new RegExp(`(?:B\\.)?${method}\\s*\\(\\s*${quotedId(targetId)}\\s*,`, 'm');
}

function rxRoomPropVerbEventId(roomId: string, propId: string, verbId: string): RegExp {
    return new RegExp(
        `roomPropVerbEventId\\s*\\(\\s*${quotedId(roomId)}\\s*,\\s*${quotedId(propId)}\\s*,\\s*${quotedId(verbId)}\\s*\\)`,
        'm'
    );
}

function rxRoomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): RegExp {
    return new RegExp(
        `roomHotspotVerbEventId\\s*\\(\\s*${quotedId(roomId)}\\s*,\\s*${quotedId(hotspotId)}\\s*,\\s*${quotedId(verbId)}\\s*\\)`,
        'm'
    );
}

function rxRoomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): RegExp {
    return new RegExp(
        `roomCharacterVerbEventId\\s*\\(\\s*${quotedId(roomId)}\\s*,\\s*${quotedId(characterId)}\\s*,\\s*${quotedId(verbId)}\\s*\\)`,
        'm'
    );
}

function rxCharacterVerbEventId(characterId: string, verbId: string): RegExp {
    return new RegExp(
        `characterVerbEventId\\s*\\(\\s*${quotedId(characterId)}\\s*,\\s*${quotedId(verbId)}\\s*\\)`,
        'm'
    );
}

function firstMatchIndex(text: string, rx: RegExp): number {
    rx.lastIndex = 0;
    const m = rx.exec(text);
    return m?.index ?? -1;
}

function earliestRange(
    text: string,
    patterns: Array<{ rx: RegExp; endGroup?: number }>
): { start: number; end: number } | null {
    let best: { start: number; end: number } | null = null;
    for (const { rx } of patterns) {
        rx.lastIndex = 0;
        const m = rx.exec(text);
        if (m && m.index >= 0) {
            const start = m.index;
            const end = m.index + m[0].length;
            if (!best || start < best.start) {
                best = { start, end };
            }
        }
    }
    return best;
}

export function roomScriptRegistersPropVerb(
    source: string,
    roomId: string,
    propId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): boolean {
    const stripped = stripLineAndBlockComments(source);
    const eventLit = `'verb:room:${roomId}:prop:${propId}:${verbId}'`;
    if (stripped.includes(eventLit) || stripped.includes(`"${eventLit.slice(1, -1)}"`)) {
        return true;
    }
    if (firstMatchIndex(stripped, rxRoomPropVerbEventId(roomId, propId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxOnProp(propId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxWhenVerbFirstTarget(verbId, propId)) >= 0) {
        return true;
    }
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        const method = SUGAR_METHOD[sugar];
        if (firstMatchIndex(stripped, rxWhenSugar(method, propId)) >= 0) {
            return true;
        }
    }
    return false;
}

export function roomScriptRegistersHotspotVerb(
    source: string,
    roomId: string,
    hotspotId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>,
    roomPropIds: ReadonlySet<string>
): boolean {
    const stripped = stripLineAndBlockComments(source);
    const eventLit = `'verb:room:${roomId}:hotspot:${hotspotId}:${verbId}'`;
    if (stripped.includes(eventLit) || stripped.includes(`"verb:room:${roomId}:hotspot:${hotspotId}:${verbId}"`)) {
        return true;
    }
    if (firstMatchIndex(stripped, rxRoomHotspotVerbEventId(roomId, hotspotId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxWhenVerbFirstTarget(verbId, hotspotId)) >= 0) {
        return true;
    }
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        const method = SUGAR_METHOD[sugar];
        if (roomPropIds.has(hotspotId)) {
            return false;
        }
        if (firstMatchIndex(stripped, rxWhenSugar(method, hotspotId)) >= 0) {
            return true;
        }
    }
    return false;
}

export function roomScriptRegistersRoomCharacterVerb(
    source: string,
    roomId: string,
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): boolean {
    const stripped = stripLineAndBlockComments(source);
    const roomEv = `verb:room:${roomId}:character:${characterId}:${verbId}`;
    if (
        stripped.includes(`'${roomEv}'`) ||
        stripped.includes(`"${roomEv}"`) ||
        stripped.includes('`' + roomEv + '`')
    ) {
        return true;
    }
    if (firstMatchIndex(stripped, rxRoomCharacterVerbEventId(roomId, characterId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxCharacterVerbEventId(characterId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxWhenVerbFirstTarget(verbId, characterId)) >= 0) {
        return true;
    }
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        if (firstMatchIndex(stripped, rxWhenSugar(SUGAR_METHOD[sugar], characterId)) >= 0) {
            return true;
        }
    }
    return false;
}

export function characterScriptRegistersVerb(
    source: string,
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): boolean {
    const stripped = stripLineAndBlockComments(source);
    const ev = `verb:character:${characterId}:${verbId}`;
    if (
        stripped.includes(`'${ev}'`) ||
        stripped.includes(`"${ev}"`) ||
        stripped.includes('`' + ev + '`')
    ) {
        return true;
    }
    if (firstMatchIndex(stripped, rxCharacterVerbEventId(characterId, verbId)) >= 0) {
        return true;
    }
    if (firstMatchIndex(stripped, rxWhenVerbFirstTarget(verbId, characterId)) >= 0) {
        return true;
    }
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        if (firstMatchIndex(stripped, rxWhenSugar(SUGAR_METHOD[sugar], characterId)) >= 0) {
            return true;
        }
    }
    return false;
}

export function findRoomPropVerbHandlerRange(
    source: string,
    roomId: string,
    propId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const patterns: Array<{ rx: RegExp }> = [
        { rx: rxOnProp(propId, verbId) },
        { rx: rxWhenVerbFirstTarget(verbId, propId) },
        { rx: rxRoomPropVerbEventId(roomId, propId, verbId) }
    ];
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        patterns.push({ rx: rxWhenSugar(SUGAR_METHOD[sugar], propId) });
    }
    const lit = new RegExp(
        `['\`"]verb:room:${escapeRegex(roomId)}:prop:${escapeRegex(propId)}:${escapeRegex(verbId)}['\`"]`,
        'm'
    );
    patterns.push({ rx: lit });
    return earliestRange(source, patterns);
}

export function findRoomHotspotVerbHandlerRange(
    source: string,
    roomId: string,
    hotspotId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>,
    roomPropIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const patterns: Array<{ rx: RegExp }> = [
        { rx: rxWhenVerbFirstTarget(verbId, hotspotId) },
        { rx: rxRoomHotspotVerbEventId(roomId, hotspotId, verbId) }
    ];
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give' && !roomPropIds.has(hotspotId)) {
        patterns.push({ rx: rxWhenSugar(SUGAR_METHOD[sugar], hotspotId) });
    }
    const lit = new RegExp(
        `['\`"]verb:room:${escapeRegex(roomId)}:hotspot:${escapeRegex(hotspotId)}:${escapeRegex(verbId)}['\`"]`,
        'm'
    );
    patterns.push({ rx: lit });
    return earliestRange(source, patterns);
}

export function findRoomCharacterVerbHandlerRange(
    source: string,
    roomId: string,
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const patterns: Array<{ rx: RegExp }> = [
        { rx: rxWhenVerbFirstTarget(verbId, characterId) },
        { rx: rxRoomCharacterVerbEventId(roomId, characterId, verbId) },
        { rx: rxCharacterVerbEventId(characterId, verbId) }
    ];
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        patterns.push({ rx: rxWhenSugar(SUGAR_METHOD[sugar], characterId) });
    }
    const litRoom = new RegExp(
        `['\`"]verb:room:${escapeRegex(roomId)}:character:${escapeRegex(characterId)}:${escapeRegex(verbId)}['\`"]`,
        'm'
    );
    patterns.push({ rx: litRoom });
    const litChar = new RegExp(
        `['\`"]verb:character:${escapeRegex(characterId)}:${escapeRegex(verbId)}['\`"]`,
        'm'
    );
    patterns.push({ rx: litChar });
    return earliestRange(source, patterns);
}

export function findCharacterScriptVerbHandlerRange(
    source: string,
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const patterns: Array<{ rx: RegExp }> = [
        { rx: rxWhenVerbFirstTarget(verbId, characterId) },
        { rx: rxCharacterVerbEventId(characterId, verbId) }
    ];
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar && sugar !== 'give') {
        patterns.push({ rx: rxWhenSugar(SUGAR_METHOD[sugar], characterId) });
    }
    const litChar = new RegExp(
        `['\`"]verb:character:${escapeRegex(characterId)}:${escapeRegex(verbId)}['\`"]`,
        'm'
    );
    patterns.push({ rx: litChar });
    return earliestRange(source, patterns);
}

/**
 * One-line Bennescript stub for inserting into `registerRoomScript((…) => { … })`.
 * `qualifier` is typically `B.` or `ctx.` (see {@link benneRoomScriptQualifier}).
 */
export function benneStubCallLine(
    kind: 'prop' | 'hotspot' | 'character',
    targetId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>,
    qualifier: string
): string {
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (kind === 'prop') {
        if (sugar === 'give') {
            return `${qualifier}whenVerb('give', '${targetId}', () => {\n    // TODO\n  });`;
        }
        if (sugar) {
            return `${qualifier}${SUGAR_METHOD[sugar]}('${targetId}', () => {\n    // TODO\n  });`;
        }
        return `${qualifier}onProp('${targetId}', '${verbId}', () => {\n    // TODO\n  });`;
    }
    if (sugar === 'give' || !sugar) {
        return `${qualifier}whenVerb('${verbId}', '${targetId}', () => {\n    // TODO\n  });`;
    }
    return `${qualifier}${SUGAR_METHOD[sugar]}('${targetId}', () => {\n    // TODO\n  });`;
}

/** Locate a handler for `verb:room:…` / `verb:character:…` in a room or character script. */
export function findRoomScriptVerbRangeForEventId(
    source: string,
    eventId: string,
    configuredVerbIds: ReadonlySet<string>,
    roomPropIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const roomVerb = eventId.match(/^verb:room:([^:]+):(prop|hotspot|character):([^:]+):([^:]+)$/);
    if (roomVerb) {
        const roomId = roomVerb[1];
        const targetType = roomVerb[2];
        const targetId = roomVerb[3];
        const verbId = roomVerb[4];
        if (targetType === 'prop') {
            return findRoomPropVerbHandlerRange(source, roomId, targetId, verbId, configuredVerbIds);
        }
        if (targetType === 'hotspot') {
            return findRoomHotspotVerbHandlerRange(
                source,
                roomId,
                targetId,
                verbId,
                configuredVerbIds,
                roomPropIds
            );
        }
        return findRoomCharacterVerbHandlerRange(source, roomId, targetId, verbId, configuredVerbIds);
    }
    return null;
}

export function findCharacterScriptVerbRangeForEventId(
    source: string,
    eventId: string,
    configuredVerbIds: ReadonlySet<string>
): { start: number; end: number } | null {
    const m = eventId.match(/^verb:character:([^:]+):([^:]+)$/);
    if (!m) {
        return null;
    }
    return findCharacterScriptVerbHandlerRange(source, m[1], m[2], configuredVerbIds);
}

/** Prefix for Bennescript calls inside `registerRoomScript` (`B.` or `ctx.`). */
export function benneRoomScriptQualifier(source: string): string {
    if (/registerRoomScript\s*\(\s*\(\s*\{\s*[^}]*\bB\b[^}]*\}\s*\)\s*=>/.test(source)) {
        return 'B.';
    }
    const m = source.match(/registerRoomScript\s*\(\s*\(\s*(\w+)\s*\)\s*=>/);
    if (m) {
        return `${m[1]}.`;
    }
    return 'B.';
}

export function benneHandlerDescriptionForProp(
    propId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): string {
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar === 'give') {
        return `B.whenVerb('give', '${propId}')`;
    }
    if (sugar) {
        return `B.${SUGAR_METHOD[sugar]}('${propId}')`;
    }
    return `B.onProp('${propId}', '${verbId}')`;
}

export function benneHandlerDescriptionForHotspot(
    hotspotId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): string {
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar === 'give') {
        return `B.whenVerb('give', '${hotspotId}')`;
    }
    if (sugar) {
        return `B.${SUGAR_METHOD[sugar]}('${hotspotId}')`;
    }
    return `B.whenVerb('${verbId}', '${hotspotId}')`;
}

export function benneHandlerDescriptionForRoomCharacter(
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): string {
    const sugar = benneSugarMethodForVerbId(verbId, configuredVerbIds);
    if (sugar === 'give') {
        return `B.whenVerb('give', '${characterId}')`;
    }
    if (sugar) {
        return `B.${SUGAR_METHOD[sugar]}('${characterId}')`;
    }
    return `B.whenVerb('${verbId}', '${characterId}')`;
}

export function benneHandlerDescriptionForCharacter(
    characterId: string,
    verbId: string,
    configuredVerbIds: ReadonlySet<string>
): string {
    return benneHandlerDescriptionForRoomCharacter(characterId, verbId, configuredVerbIds);
}

export async function readConfiguredVerbIdSet(gameRoot: vscode.Uri): Promise<Set<string>> {
    const verbs = await readGameConfigVerbs(gameRoot);
    return new Set(verbs.map((v) => v.id));
}
