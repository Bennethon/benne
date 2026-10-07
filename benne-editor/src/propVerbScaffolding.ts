import * as vscode from 'vscode';
import { formatJson, gameRootContaining, resolveRoomWidthHeight, defaultClickablePropInteractionFields } from './roomScaffolding';
import { handlerSpecFromEventId } from './bennescript/handlerEvents';
import { addHandler, ensureHandler, type AddHandlerResult } from './scriptHandlers';

/** Result of adding (or finding) a room-scoped verb handler in `*.room.ts`. */
export type AddRoomVerbHandlerResult = AddHandlerResult;

function propNeedsDefaultCollider(prop: Record<string, unknown>): boolean {
    const collider = prop.collider as { points?: unknown } | undefined;
    const pts = collider?.points;
    if (!Array.isArray(pts)) {
        return true;
    }
    return pts.length < 3;
}

/** Sets `clickable: true` on a prop and seeds collider + walk/look when none exists (same defaults as new hotspots in the room preview). */
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
    const seededCollider = propNeedsDefaultCollider(prop);
    if (seededCollider) {
        const gameRoot = await gameRootContaining(roomJsonUri);
        if (!gameRoot) {
            void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
            return false;
        }
        const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
        prop.clickable = true;
        Object.assign(prop, defaultClickablePropInteractionFields(roomW, roomH));
    } else {
        prop.clickable = true;
    }
    data.props = props;
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(data));
    void vscode.window.showInformationMessage(
        seededCollider
            ? `Prop "${propId}" is now clickable with a default collider—adjust it in the room preview if needed.`
            : `Prop "${propId}" is now clickable.`
    );
    return true;
}

async function roomJsonHas(roomJsonUri: vscode.Uri, list: 'props' | 'hotspots', id: string): Promise<boolean> {
    try {
        const data = JSON.parse(new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(roomJsonUri))) as Record<
            string,
            unknown
        >;
        const items = data[list];
        return Array.isArray(items) && items.some((p) => (p as { id?: unknown })?.id === id);
    } catch {
        return false;
    }
}

/** Adds `prop.on<Verb>(() => { … })` to the room script (or finds the existing one). */
export async function addPropVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    propId: string,
    verbId: string
): Promise<AddRoomVerbHandlerResult> {
    if (!(await roomJsonHas(roomJsonUri, 'props', propId))) {
        void vscode.window.showErrorMessage(`Prop "${propId}" not found in room JSON.`);
        return { ok: false };
    }
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    return addHandler(
        scriptUri,
        { kind: 'verb', target: { kind: 'prop', roomId, id: propId }, verbId },
        `${verbId} handler for prop "${propId}"`
    );
}

/** Adds `hotspot.on<Verb>(() => { … })` to the room script (or finds the existing one). */
export async function addHotspotVerbEvent(
    roomJsonUri: vscode.Uri,
    roomId: string,
    hotspotId: string,
    verbId: string
): Promise<AddRoomVerbHandlerResult> {
    if (!(await roomJsonHas(roomJsonUri, 'hotspots', hotspotId))) {
        void vscode.window.showErrorMessage(`Hotspot "${hotspotId}" not found in room JSON.`);
        return { ok: false };
    }
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    return addHandler(
        scriptUri,
        { kind: 'verb', target: { kind: 'hotspot', roomId, id: hotspotId }, verbId },
        `${verbId} handler for hotspot "${hotspotId}"`
    );
}

/**
 * Reveal on a room verb chip with no handler yet: inserts the stub (`verb:room:…` event IDs only).
 */
export async function ensureRoomVerbHandlerStubForReveal(
    roomJsonUri: vscode.Uri,
    roomId: string,
    eventId: string
): Promise<{ stubInserted: boolean; insertedStubRange?: { start: number; end: number } }> {
    const spec = handlerSpecFromEventId(eventId);
    if (!spec || spec.kind !== 'verb' || spec.target.kind === 'item' || spec.target.roomId !== roomId) {
        return { stubInserted: false };
    }
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    const r = await ensureHandler(scriptUri, spec);
    return r.status === 'inserted' ? { stubInserted: true, insertedStubRange: r.range } : { stubInserted: false };
}
