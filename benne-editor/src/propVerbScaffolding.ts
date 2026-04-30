import * as vscode from 'vscode';
import { saveDirtyTypeScriptBeforeWorkspaceFsRead } from './saveDirtyScriptBeforeFsRead';
import { formatJson } from './roomScaffolding';
import { readRoomProps } from './gameDiscovery';
import {
    benneRoomScriptQualifier,
    benneStubCallLine,
    findRoomScriptVerbRangeForEventIdRobust,
    readConfiguredVerbIdSet,
    roomScriptRegistersHotspotVerb,
    roomScriptRegistersPropVerb,
    roomScriptRegistersRoomCharacterVerb
} from './verbHandlerPresence';

const BENNE_ROOM_SCRIPT_HINT =
    'Use Bennescript: registerRoomScript(({ B }) => { ... }) or registerRoomScript((ctx) => { ... }) so the editor can insert verb stubs.';

/** Result of adding or repairing a room-scoped verb handler in `*.room.ts`. */
export type AddRoomVerbHandlerResult = {
    ok: boolean;
    /** UTF-16 range of a newly inserted stub in `*.room.ts` (omit when only JSON was updated). */
    insertedStubRange?: { start: number; end: number };
};

export type BenneRegisterInsertResult = {
    text: string;
    /** UTF-16 offset where `indentedSnippet` starts in `text`. */
    start: number;
    /** UTF-16 offset past the inserted snippet in `text`. */
    end: number;
};

/** Inserts lines before the closing `}` of the `registerRoomScript((…) => { … })` callback body. */
export function insertIntoBenneRegisterRoomScript(source: string, indentedSnippet: string): BenneRegisterInsertResult | null {
    const needle = 'registerRoomScript(';
    let searchFrom = 0;
    let callIdx = -1;
    while (true) {
        const i = source.indexOf(needle, searchFrom);
        if (i < 0) {
            return null;
        }
        const lineStart = source.lastIndexOf('\n', i) + 1;
        const lineEnd = source.indexOf('\n', i);
        const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
        if (!/^\s*import\s/.test(line)) {
            callIdx = i;
            break;
        }
        searchFrom = i + needle.length;
    }
    const arrowIdx = source.indexOf('=>', callIdx);
    if (arrowIdx < 0) {
        return null;
    }
    const bodyOpen = source.indexOf('{', arrowIdx);
    if (bodyOpen < 0) {
        return null;
    }
    let depth = 0;
    for (let i = bodyOpen; i < source.length; i++) {
        const c = source[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                const insertAt = i;
                const text = source.slice(0, insertAt) + indentedSnippet + source.slice(insertAt);
                return {
                    text,
                    start: insertAt,
                    end: insertAt + indentedSnippet.length
                };
            }
        }
    }
    return null;
}

/** Writes a `benneStubCallLine` into `registerRoomScript`; fails if the file is not Bennescript-shaped. */
async function writeBenneRoomVerbStub(
    scriptUri: vscode.Uri,
    scriptText: string,
    kind: 'prop' | 'hotspot',
    targetId: string,
    verbId: string,
    configured: ReadonlySet<string>,
    roomId: string
): Promise<{ start: number; end: number } | null> {
    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = benneStubCallLine(kind, targetId, verbId, configured, qualifier);
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add a handler to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return null;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    return { start: inserted.start, end: inserted.end };
}

/**
 * Sets `clickable: true` on a prop in room JSON (author must still add a collider in the preview / JSON).
 */
export async function makeRoomPropClickable(
    roomJsonUri: vscode.Uri,
    propId: string
): Promise<boolean> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(roomJsonUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read room JSON.');
        return false;
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid.');
        return false;
    }
    const propsUnknown = data.props;
    if (!Array.isArray(propsUnknown)) {
        void vscode.window.showErrorMessage('Room JSON has no props array.');
        return false;
    }
    const props = propsUnknown as Record<string, unknown>[];
    const prop = props.find((p) => typeof p.id === 'string' && p.id === propId);
    if (!prop) {
        void vscode.window.showErrorMessage(`Prop "${propId}" not found in room JSON.`);
        return false;
    }
    if (prop.clickable === true) {
        void vscode.window.showInformationMessage('This prop is already clickable.');
        return false;
    }
    prop.clickable = true;
    data.props = props;
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    void vscode.window.showInformationMessage(
        `Prop "${propId}" is now clickable. Add a collider (≥3 points) in the room preview or JSON so hit-testing works.`
    );
    return true;
}

/**
 * Ensures `onVerb[verbId]` on the prop and a Bennescript stub in `*.room.ts`.
 * The room script must use `registerRoomScript((…) => { … })`.
 */
export async function addPropVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    propId: string,
    verbId: string
): Promise<AddRoomVerbHandlerResult> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(roomJsonUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read room JSON.');
        return { ok: false };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid.');
        return { ok: false };
    }
    const propsUnknown = data.props;
    if (!Array.isArray(propsUnknown)) {
        void vscode.window.showErrorMessage('Room JSON has no props array.');
        return { ok: false };
    }
    const props = propsUnknown as Record<string, unknown>[];
    const prop = props.find((p) => typeof p.id === 'string' && p.id === propId);
    if (!prop) {
        void vscode.window.showErrorMessage(`Prop "${propId}" not found in room JSON.`);
        return { ok: false };
    }

    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

    const existingOnVerb =
        prop.onVerb && typeof prop.onVerb === 'object' && !Array.isArray(prop.onVerb)
            ? { ...(prop.onVerb as Record<string, unknown>) }
            : {};
    const jsonAlready = existingOnVerb[verbId] === true;

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { ok: false };
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* missing script */
    }
    if (scriptText && roomScriptRegistersPropVerb(scriptText, roomId, propId, verbId, configured)) {
        if (jsonAlready) {
            void vscode.window.showInformationMessage(
                `A ${verbId} handler for prop "${propId}" is already registered in ${roomId}.room.ts.`
            );
            return { ok: false };
        }
        existingOnVerb[verbId] = true;
        prop.onVerb = existingOnVerb;
        data.props = props;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in room JSON (handler was already present in ${roomId}.room.ts).`
        );
        return { ok: true };
    }

    if (!scriptText) {
        void vscode.window.showErrorMessage(
            `${roomId}.room.ts not found. Create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: false };
    }

    const stubRange = await writeBenneRoomVerbStub(
        scriptUri,
        scriptText,
        'prop',
        propId,
        verbId,
        configured,
        roomId
    );
    if (!stubRange) {
        return { ok: false };
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        prop.onVerb = existingOnVerb;
        data.props = props;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    }

    void vscode.window.showInformationMessage(`Added ${verbId} handler for prop "${propId}" in ${roomId}.room.ts.`);
    return { ok: true, insertedStubRange: stubRange };
}

/**
 * Ensures `onVerb[verbId]` on the hotspot and a Bennescript stub in `*.room.ts`.
 * The room script must use `registerRoomScript((…) => { … })`.
 */
export async function addHotspotVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    hotspotId: string,
    verbId: string
): Promise<AddRoomVerbHandlerResult> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(roomJsonUri);
    } catch {
        void vscode.window.showErrorMessage('Could not read room JSON.');
        return { ok: false };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid.');
        return { ok: false };
    }
    const listUnknown = data.hotspots;
    if (!Array.isArray(listUnknown)) {
        void vscode.window.showErrorMessage('Room JSON has no hotspots array.');
        return { ok: false };
    }
    const hotspots = listUnknown as Record<string, unknown>[];
    const hotspot = hotspots.find((h) => typeof h.id === 'string' && h.id === hotspotId);
    if (!hotspot) {
        void vscode.window.showErrorMessage(`Hotspot "${hotspotId}" not found in room JSON.`);
        return { ok: false };
    }

    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
    let roomPropIds = new Set<string>();
    try {
        const pr = await readRoomProps(roomJsonUri);
        roomPropIds = new Set(pr.map((p) => p.id));
    } catch {
        /* ignore */
    }

    const existingOnVerb =
        hotspot.onVerb && typeof hotspot.onVerb === 'object' && !Array.isArray(hotspot.onVerb)
            ? { ...(hotspot.onVerb as Record<string, unknown>) }
            : {};
    const jsonAlready = existingOnVerb[verbId] === true;

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { ok: false };
    }
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* */
    }
    if (
        scriptText &&
        roomScriptRegistersHotspotVerb(scriptText, roomId, hotspotId, verbId, configured, roomPropIds)
    ) {
        if (jsonAlready) {
            void vscode.window.showInformationMessage(
                `A ${verbId} handler for hotspot "${hotspotId}" is already registered in ${roomId}.room.ts.`
            );
            return { ok: false };
        }
        existingOnVerb[verbId] = true;
        hotspot.onVerb = existingOnVerb;
        data.hotspots = hotspots;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in room JSON (handler was already present in ${roomId}.room.ts).`
        );
        return { ok: true };
    }

    if (!scriptText) {
        void vscode.window.showErrorMessage(
            `${roomId}.room.ts not found. Create the room script, then ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { ok: false };
    }

    const stubRange = await writeBenneRoomVerbStub(
        scriptUri,
        scriptText,
        'hotspot',
        hotspotId,
        verbId,
        configured,
        roomId
    );
    if (!stubRange) {
        return { ok: false };
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        hotspot.onVerb = existingOnVerb;
        data.hotspots = hotspots;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    }

    void vscode.window.showInformationMessage(
        `Added ${verbId} handler for hotspot "${hotspotId}" in ${roomId}.room.ts.`
    );
    return { ok: true, insertedStubRange: stubRange };
}

const ROOM_VERB_EVENT_RX = /^verb:room:([^:]+):(prop|hotspot|character):([^:]+):([^:]+)$/;

/**
 * When reveal cannot find a `verb:room:…` handler in `*.room.ts` but room JSON (or character JSON)
 * already expects it, inserts a Bennescript stub. Skips if any registration pattern already matches.
 */
export async function ensureRoomVerbHandlerStubForReveal(
    roomJsonUri: vscode.Uri,
    roomId: string,
    eventId: string
): Promise<{ stubInserted: boolean; insertedStubRange?: { start: number; end: number } }> {
    const m = eventId.match(ROOM_VERB_EVENT_RX);
    if (!m || m[1] !== roomId) {
        return { stubInserted: false };
    }
    const kind = m[2] as 'prop' | 'hotspot' | 'character';
    const targetId = m[3];
    const verbId = m[4];
    if (verbId === 'fallback') {
        return { stubInserted: false };
    }

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    if (!(await saveDirtyTypeScriptBeforeWorkspaceFsRead(scriptUri))) {
        return { stubInserted: false };
    }
    let scriptText: string;
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        return { stubInserted: false };
    }

    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
    let roomPropIds = new Set<string>();
    try {
        const pr = await readRoomProps(roomJsonUri);
        roomPropIds = new Set(pr.map((p) => p.id));
    } catch {
        /* */
    }

    if (findRoomScriptVerbRangeForEventIdRobust(scriptText, eventId, configured, roomPropIds)) {
        return { stubInserted: false };
    }
    if (kind === 'prop' && roomScriptRegistersPropVerb(scriptText, roomId, targetId, verbId, configured)) {
        return { stubInserted: false };
    }
    if (
        kind === 'hotspot' &&
        roomScriptRegistersHotspotVerb(scriptText, roomId, targetId, verbId, configured, roomPropIds)
    ) {
        return { stubInserted: false };
    }
    if (
        kind === 'character' &&
        roomScriptRegistersRoomCharacterVerb(scriptText, roomId, targetId, verbId, configured)
    ) {
        return { stubInserted: false };
    }

    if (kind === 'prop' || kind === 'hotspot') {
        const range = await writeBenneRoomVerbStub(scriptUri, scriptText, kind, targetId, verbId, configured, roomId);
        if (!range) {
            return { stubInserted: false };
        }
        return { stubInserted: true, insertedStubRange: range };
    }

    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = benneStubCallLine('character', targetId, verbId, configured, qualifier);
    const inserted = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (inserted === null) {
        void vscode.window.showErrorMessage(
            `Could not add a handler to ${roomId}.room.ts. ${BENNE_ROOM_SCRIPT_HINT}`
        );
        return { stubInserted: false };
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted.text));
    return { stubInserted: true, insertedStubRange: { start: inserted.start, end: inserted.end } };
}
