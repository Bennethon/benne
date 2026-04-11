import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { readRoomProps } from './gameDiscovery';
import {
    benneRoomScriptQualifier,
    benneStubCallLine,
    readConfiguredVerbIdSet,
    roomScriptRegistersHotspotVerb,
    roomScriptRegistersPropVerb
} from './verbHandlerPresence';

function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
    return `verb:room:${roomId}:prop:${propId}:${verbId}`;
}

function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:${verbId}`;
}

export function parseRegisterRoomScriptBusParam(source: string): string {
    const m = source.match(/export\s+function\s+registerRoomScript\s*\(\s*(\w+)\s*:/);
    return m?.[1] ?? '_events';
}

function ensureRoomVerbPayloadImports(
    source: string,
    payloadType: 'RoomPropInteractPayload' | 'RoomHotspotInteractPayload'
): string {
    if (new RegExp(`\\b${payloadType}\\b`).test(source)) {
        return source;
    }
    const existing = source.match(
        /^import type \{([^}]+)\} from ['"]@engine\/events\/propInteractionEvents['"];\s*$/m
    );
    if (existing) {
        const inner = existing[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!inner.includes(payloadType)) {
            inner.push(payloadType);
        }
        return source.replace(
            existing[0],
            `import type { ${inner.join(', ')} } from '@engine/events/propInteractionEvents';`
        );
    }
    const newImport = `import type { ${payloadType} } from '@engine/events/propInteractionEvents';\n`;
    const eventBusImport =
        /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
    if (eventBusImport.test(source)) {
        return source.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
    }
    return newImport + source;
}

function ensureRoomVerbEventHelperImports(
    source: string,
    helperName: 'roomPropVerbEventId' | 'roomHotspotVerbEventId'
): string {
    if (new RegExp(`\\b${helperName}\\b`).test(source)) {
        return source;
    }
    const existing = source.match(
        /^import \{([^}]+)\} from ['"]@engine\/events\/verbInteractionEvents['"];\s*$/m
    );
    if (existing) {
        const inner = existing[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!inner.includes(helperName)) {
            inner.push(helperName);
        }
        return source.replace(
            existing[0],
            `import { ${inner.join(', ')} } from '@engine/events/verbInteractionEvents';`
        );
    }
    const newImport = `import { ${helperName} } from '@engine/events/verbInteractionEvents';\n`;
    const eventBusImport =
        /^import\s+type\s+\{\s*EventBus\s*\}\s+from\s+['"]@engine\/events\/EventBus['"];\s*$/m;
    if (eventBusImport.test(source)) {
        return source.replace(eventBusImport, (line) => `${line}\n${newImport.trimEnd()}`);
    }
    return newImport + source;
}

function insertHandlerBeforeExportRegisterRoomScriptClose(
    source: string,
    eventExpr: string,
    eventsVar: string,
    payloadType: 'RoomPropInteractPayload' | 'RoomHotspotInteractPayload'
): string | null {
    const marker = 'export function registerRoomScript';
    const fnIdx = source.indexOf(marker);
    if (fnIdx < 0) {
        return null;
    }
    const openBrace = source.indexOf('{', fnIdx);
    if (openBrace < 0) {
        return null;
    }
    let depth = 0;
    for (let i = openBrace; i < source.length; i++) {
        const c = source[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                const snippet = `\n  ${eventsVar}.on(${eventExpr}, (payload: ${payloadType}) => {\n    // TODO\n  });\n`;
                return source.slice(0, i) + snippet + source.slice(i);
            }
        }
    }
    return null;
}

/** Inserts lines before the closing `}` of the `registerRoomScript((…) => { … })` callback body. */
export function insertIntoBenneRegisterRoomScript(source: string, indentedSnippet: string): string | null {
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
                return source.slice(0, i) + indentedSnippet + source.slice(i);
            }
        }
    }
    return null;
}

async function appendRoomScriptHandler(
    roomJsonUri: vscode.Uri,
    roomId: string,
    eventId: string,
    payloadType: 'RoomPropInteractPayload' | 'RoomHotspotInteractPayload',
    eventCallExpr: string,
    helperName: 'roomPropVerbEventId' | 'roomHotspotVerbEventId',
    kind: 'prop' | 'hotspot',
    targetId: string,
    verbId: string
): Promise<boolean> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let scriptText: string;
    try {
        const scriptRaw = await vscode.workspace.fs.readFile(scriptUri);
        scriptText = new TextDecoder('utf-8').decode(scriptRaw);
    } catch {
        void vscode.window.showWarningMessage(
            `Room JSON was updated; add a handler in ${roomId}.room.ts (script file missing).`
        );
        return false;
    }

    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
    let roomPropIds = new Set<string>();
    try {
        const props = await readRoomProps(roomJsonUri);
        roomPropIds = new Set(props.map((p) => p.id));
    } catch {
        /* ignore */
    }

    if (kind === 'prop') {
        if (roomScriptRegistersPropVerb(scriptText, roomId, targetId, verbId, configured)) {
            return false;
        }
    } else if (
        roomScriptRegistersHotspotVerb(scriptText, roomId, targetId, verbId, configured, roomPropIds)
    ) {
        return false;
    }

    const qualifier = benneRoomScriptQualifier(scriptText);
    const stub = benneStubCallLine(kind, targetId, verbId, configured, qualifier);
    const benneTry = insertIntoBenneRegisterRoomScript(scriptText, `\n  ${stub}\n`);
    if (benneTry !== null) {
        await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(benneTry));
        return true;
    }

    let next = ensureRoomVerbPayloadImports(scriptText, payloadType);
    next = ensureRoomVerbEventHelperImports(next, helperName);
    const eventsVar = parseRegisterRoomScriptBusParam(next);
    const inserted = insertHandlerBeforeExportRegisterRoomScriptClose(next, eventCallExpr, eventsVar, payloadType);
    if (inserted === null) {
        void vscode.window.showWarningMessage(
            `Room JSON was updated; could not find registerRoomScript in ${roomId}.room.ts — add the handler manually.`
        );
        return false;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted));
    return true;
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
 * Ensures `onVerb[verbId]` on the prop and a stub in `*.room.ts` (Bennescript or legacy EventBus style).
 */
export async function addPropVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    propId: string,
    verbId: string
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

    const eventId = roomPropVerbEventId(roomId, propId, verbId);
    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

    const existingOnVerb =
        prop.onVerb && typeof prop.onVerb === 'object' && !Array.isArray(prop.onVerb)
            ? { ...(prop.onVerb as Record<string, unknown>) }
            : {};
    const jsonAlready = existingOnVerb[verbId] === true;

    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* missing script — appendRoomScriptHandler will warn */
    }
    if (scriptText && roomScriptRegistersPropVerb(scriptText, roomId, propId, verbId, configured)) {
        if (jsonAlready) {
            void vscode.window.showInformationMessage(
                `A ${verbId} handler for prop "${propId}" is already registered in ${roomId}.room.ts.`
            );
            return false;
        }
        existingOnVerb[verbId] = true;
        prop.onVerb = existingOnVerb;
        data.props = props;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in room JSON (handler was already present in ${roomId}.room.ts).`
        );
        return true;
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        prop.onVerb = existingOnVerb;
        data.props = props;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    }

    const appended = await appendRoomScriptHandler(
        roomJsonUri,
        roomId,
        eventId,
        'RoomPropInteractPayload',
        `roomPropVerbEventId('${roomId}', '${propId}', '${verbId}')`,
        'roomPropVerbEventId',
        'prop',
        propId,
        verbId
    );
    if (!appended) {
        void vscode.window.showInformationMessage(
            `Verb "${verbId}" is enabled in JSON but no new handler was added (script layout not recognized). Add a handler manually in ${roomId}.room.ts.`
        );
        return false;
    }

    void vscode.window.showInformationMessage(`Added ${verbId} handler for prop "${propId}" in ${roomId}.room.ts.`);
    return true;
}

/**
 * Ensures `onVerb[verbId]` on the hotspot and a stub in `*.room.ts`.
 */
export async function addHotspotVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    hotspotId: string,
    verbId: string
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
    const listUnknown = data.hotspots;
    if (!Array.isArray(listUnknown)) {
        void vscode.window.showErrorMessage('Room JSON has no hotspots array.');
        return false;
    }
    const hotspots = listUnknown as Record<string, unknown>[];
    const hotspot = hotspots.find((h) => typeof h.id === 'string' && h.id === hotspotId);
    if (!hotspot) {
        void vscode.window.showErrorMessage(`Hotspot "${hotspotId}" not found in room JSON.`);
        return false;
    }

    const eventId = roomHotspotVerbEventId(roomId, hotspotId, verbId);
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
            return false;
        }
        existingOnVerb[verbId] = true;
        hotspot.onVerb = existingOnVerb;
        data.hotspots = hotspots;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
        void vscode.window.showInformationMessage(
            `Enabled "${verbId}" in room JSON (handler was already present in ${roomId}.room.ts).`
        );
        return true;
    }

    if (!jsonAlready) {
        existingOnVerb[verbId] = true;
        hotspot.onVerb = existingOnVerb;
        data.hotspots = hotspots;
        await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    }

    const appended = await appendRoomScriptHandler(
        roomJsonUri,
        roomId,
        eventId,
        'RoomHotspotInteractPayload',
        `roomHotspotVerbEventId('${roomId}', '${hotspotId}', '${verbId}')`,
        'roomHotspotVerbEventId',
        'hotspot',
        hotspotId,
        verbId
    );
    if (!appended) {
        void vscode.window.showInformationMessage(
            `Verb "${verbId}" is enabled in JSON but no new handler was added (script layout not recognized). Add a handler manually in ${roomId}.room.ts.`
        );
        return false;
    }

    void vscode.window.showInformationMessage(
        `Added ${verbId} handler for hotspot "${hotspotId}" in ${roomId}.room.ts.`
    );
    return true;
}
