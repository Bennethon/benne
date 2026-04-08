import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';

/** Default event id for scaffolded `onVerb` entries — opaque string; must stay unique on the game EventBus if handlers should not stack. */
export function defaultVerbEventId(verbId: string, targetId: string): string {
    return `${verbId}:${targetId}`;
}

export function parseRegisterRoomScriptBusParam(source: string): string {
    const m = source.match(/export\s+function\s+registerRoomScript\s*\(\s*(\w+)\s*:/);
    return m?.[1] ?? '_events';
}

function stripLineAndBlockComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
}

function scriptAlreadyRegistersEvent(source: string, eventId: string): boolean {
    const stripped = stripLineAndBlockComments(source);
    const patterns = [`'${eventId}'`, `"${eventId}"`, `\`${eventId}\``];
    return patterns.some((p) => stripped.includes(p));
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

function insertHandlerBeforeRegisterRoomScriptClose(
    source: string,
    eventId: string,
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
                const snippet = `\n  ${eventsVar}.on('${eventId}', (payload: ${payloadType}) => {\n    // TODO\n  });\n`;
                return source.slice(0, i) + snippet + source.slice(i);
            }
        }
    }
    return null;
}

async function appendRoomScriptHandler(
    roomJsonUri: vscode.Uri,
    roomId: string,
    eventId: string,
    payloadType: 'RoomPropInteractPayload' | 'RoomHotspotInteractPayload'
): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let scriptText: string;
    try {
        const scriptRaw = await vscode.workspace.fs.readFile(scriptUri);
        scriptText = new TextDecoder('utf-8').decode(scriptRaw);
    } catch {
        void vscode.window.showWarningMessage(
            `Room JSON was updated; add a handler in ${roomId}.room.ts (script file missing).`
        );
        return;
    }

    if (scriptAlreadyRegistersEvent(scriptText, eventId)) {
        return;
    }

    let next = ensureRoomVerbPayloadImports(scriptText, payloadType);
    const eventsVar = parseRegisterRoomScriptBusParam(next);
    const inserted = insertHandlerBeforeRegisterRoomScriptClose(next, eventId, eventsVar, payloadType);
    if (inserted === null) {
        void vscode.window.showWarningMessage(
            `Room JSON was updated; could not find registerRoomScript in ${roomId}.room.ts — add the handler manually.`
        );
        return;
    }
    await vscode.workspace.fs.writeFile(scriptUri, new TextEncoder().encode(inserted));
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
 * Adds `onVerb[verbId]` to the prop in room JSON and appends a stub in `*.room.ts` when missing.
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

    const eventId = defaultVerbEventId(verbId, propId);
    const existingOnVerb =
        prop.onVerb && typeof prop.onVerb === 'object' && !Array.isArray(prop.onVerb)
            ? { ...(prop.onVerb as Record<string, unknown>) }
            : {};
    if (typeof existingOnVerb[verbId] === 'string' && (existingOnVerb[verbId] as string).length > 0) {
        void vscode.window.showInformationMessage(`Verb "${verbId}" is already mapped for this prop.`);
        return false;
    }
    existingOnVerb[verbId] = eventId;
    prop.onVerb = existingOnVerb;
    data.props = props;
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));

    await appendRoomScriptHandler(roomJsonUri, roomId, eventId, 'RoomPropInteractPayload');

    void vscode.window.showInformationMessage(`Added ${verbId} → ${eventId} for prop "${propId}".`);
    return true;
}

/**
 * Adds `onVerb[verbId]` to a hotspot in room JSON and appends a stub in `*.room.ts` when missing.
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

    const eventId = defaultVerbEventId(verbId, hotspotId);
    const existingOnVerb =
        hotspot.onVerb && typeof hotspot.onVerb === 'object' && !Array.isArray(hotspot.onVerb)
            ? { ...(hotspot.onVerb as Record<string, unknown>) }
            : {};
    if (typeof existingOnVerb[verbId] === 'string' && (existingOnVerb[verbId] as string).length > 0) {
        void vscode.window.showInformationMessage(`Verb "${verbId}" is already mapped for this hotspot.`);
        return false;
    }
    existingOnVerb[verbId] = eventId;
    hotspot.onVerb = existingOnVerb;
    data.hotspots = hotspots;
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));

    await appendRoomScriptHandler(roomJsonUri, roomId, eventId, 'RoomHotspotInteractPayload');

    void vscode.window.showInformationMessage(`Added ${verbId} → ${eventId} for hotspot "${hotspotId}".`);
    return true;
}
