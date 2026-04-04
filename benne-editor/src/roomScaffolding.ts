import * as vscode from 'vscode';
import {
    findBenneGameFolders,
    getRoomIdFromRoomJsonUri,
    listRoomDefinitions,
    resolveRoomAsepriteSheetForProps
} from './gameDiscovery';
import type { EditorSelection } from './editorSelection';
import type { MainTreeNode } from './mainTreeProvider';
import { openRoomJsonAndScriptBottomGroup } from './roomScriptNavigation';

const SLUG_RE = /^[a-z0-9_-]+$/i;

export function validateSlug(value: string, label: string): string | null {
    if (!value || !SLUG_RE.test(value)) {
        return `${label} must be non-empty and use only letters, numbers, underscores, or hyphens`;
    }
    return null;
}

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

export async function pickWorkspaceFolder(
    preferred?: vscode.WorkspaceFolder
): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = await findBenneGameFolders();
    if (folders.length === 0) {
        void vscode.window.showErrorMessage('No BENNE game (src/game/rooms) in this workspace.');
        return undefined;
    }
    if (preferred && folders.some((f) => f.uri.toString() === preferred.uri.toString())) {
        return preferred;
    }
    if (folders.length === 1) {
        return folders[0];
    }
    const picked = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f.name, folder: f })),
        { placeHolder: 'Choose workspace folder for this BENNE game' }
    );
    return picked?.folder;
}

/**
 * Create `src/game/rooms/<id>/`, `<id>.room.json`, `<id>.room.ts`, asset folder, and manifest entry.
 */
export async function runCreateRoomWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const roomId = await vscode.window.showInputBox({
        prompt: 'Room id (folder name and file prefix, e.g. kitchen)',
        placeHolder: 'kitchen',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Room id')
    });
    if (!roomId) {
        return;
    }
    const id = roomId.trim();

    const displayName = await vscode.window.showInputBox({
        prompt: 'Display name (shown in the BENNE tree and room JSON `name`)',
        placeHolder: id.charAt(0).toUpperCase() + id.slice(1),
        validateInput: (v) => {
            if (!v || !v.trim()) {
                return 'Display name is required';
            }
            return null;
        }
    });
    if (!displayName) {
        return;
    }
    const name = displayName.trim();

    const roomDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'rooms', id);
    const roomJsonUri = vscode.Uri.joinPath(roomDir, `${id}.room.json`);
    const roomTsUri = vscode.Uri.joinPath(roomDir, `${id}.room.ts`);
    const assetsDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', 'images', 'rooms', id);

    try {
        await vscode.workspace.fs.stat(roomDir);
        void vscode.window.showErrorMessage(`Room folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const roomJson = {
        id,
        name,
        walkable: { polygons: [] },
        hotspots: [],
        props: []
    };

    const roomTs = `import type { EventBus } from '@engine/events/EventBus';

/**
 * Room script for \`${id}\` — keep all handlers for this room here (PowerQuest-style).
 * Export name is fixed so \`registerGameContent\` can discover files via \`*.room.ts\` glob.
 */
export function registerRoomScript(events: EventBus): void {
  // Example: events.on('look:${id}-desk', () => { ... });
}
`;

    await vscode.workspace.fs.createDirectory(roomDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(roomJson));
    await vscode.workspace.fs.writeFile(roomTsUri, new TextEncoder().encode(roomTs));

    await appendRoomsManifestEntry(folder.uri, id);

    void vscode.window.showInformationMessage(`Created room "${name}" (${id}).`);
    await vscode.window.showTextDocument(roomJsonUri, { preview: false });
    await vscode.window.showTextDocument(roomTsUri, { preview: false });
}

async function appendRoomsManifestEntry(gameRoot: vscode.Uri, roomId: string): Promise<void> {
    const manifestUri = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'rooms', 'rooms.manifest.json');
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(manifestUri);
    } catch {
        void vscode.window.showWarningMessage(
            'Could not read rooms.manifest.json — add the new room to the manifest manually.'
        );
        return;
    }
    let manifest: { startRoomId?: string; rooms?: { id: string; definition: string }[] };
    try {
        manifest = JSON.parse(new TextDecoder('utf-8').decode(raw)) as typeof manifest;
    } catch {
        void vscode.window.showErrorMessage('rooms.manifest.json is not valid JSON; manifest not updated.');
        return;
    }
    const rooms = Array.isArray(manifest.rooms) ? [...manifest.rooms] : [];
    if (rooms.some((r) => r.id === roomId)) {
        return;
    }
    rooms.push({ id: roomId, definition: `${roomId}/${roomId}.room.json` });
    rooms.sort((a, b) => a.id.localeCompare(b.id));
    const next = {
        startRoomId:
            typeof manifest.startRoomId === 'string' && manifest.startRoomId.length > 0
                ? manifest.startRoomId
                : roomId,
        rooms
    };
    await vscode.workspace.fs.writeFile(manifestUri, formatJson(next));
}

function nextPropZIndexFromProps(props: Record<string, unknown>[]): number {
    let max = -1;
    for (const p of props) {
        const z = p.zIndex;
        if (typeof z === 'number' && z > max) {
            max = z;
        }
    }
    return max + 1;
}

type RoomTarget = { roomJsonUri: vscode.Uri; roomId: string };

async function resolveRoomTarget(
    node: MainTreeNode | undefined,
    selection: EditorSelection
): Promise<RoomTarget | undefined> {
    if (node?.kind === 'room') {
        return { roomJsonUri: node.uri, roomId: node.id };
    }
    if (node?.kind === 'prop') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }

    if (selection.focus.kind === 'room') {
        const uri = selection.focus.uri;
        const folders = await findBenneGameFolders();
        const wf = folders.find((f) => uri.fsPath.startsWith(f.uri.fsPath));
        if (wf) {
            return { roomJsonUri: uri, roomId: getRoomIdFromRoomJsonUri(uri) };
        }
    }

    const folder = await pickWorkspaceFolder();
    if (!folder) {
        return undefined;
    }
    const rooms = await listRoomDefinitions(folder);
    if (rooms.length === 0) {
        void vscode.window.showErrorMessage('No rooms found. Create a room first.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        rooms.map((r) => ({ label: r.name, description: r.id, room: r })),
        { placeHolder: 'Choose a room to add a prop to' }
    );
    if (!picked) {
        return undefined;
    }
    return { roomJsonUri: picked.room.uri, roomId: picked.room.id };
}

/**
 * Append a prop with the given Aseprite tag to a room JSON (no validation against exported sheet JSON).
 */
export async function runAddRoomPropWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const tag = await vscode.window.showInputBox({
        prompt: 'Aseprite frame tag for this prop (must match a tag on the room sheet when you export)',
        placeHolder: 'Desk',
        validateInput: (v) => {
            if (!v || !v.trim()) {
                return 'Tag is required';
            }
            return null;
        }
    });
    if (!tag) {
        return;
    }
    const tagTrimmed = tag.trim();

    const defaultPropId = `${target.roomId}-prop-${tagTrimmed.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;

    const propId = await vscode.window.showInputBox({
        prompt: 'Prop id (unique within this room JSON)',
        value: defaultPropId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Prop id')
    });
    if (!propId) {
        return;
    }
    const id = propId.trim();

    const clickablePick = await vscode.window.showQuickPick(
        [
            {
                label: 'Yes',
                description: 'Clickable — hit area, walk-to, and look-at can be set in JSON or the room preview editor'
            },
            {
                label: 'No',
                description: 'Decorative only — not hit-tested'
            }
        ],
        {
            placeHolder: 'Should this prop be clickable?',
            ignoreFocusOut: true
        }
    );
    if (!clickablePick) {
        return;
    }
    const clickable = clickablePick.label === 'Yes';

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add prop.');
        return;
    }

    const propsUnknown = data.props;
    const props: Record<string, unknown>[] = Array.isArray(propsUnknown)
        ? (propsUnknown as Record<string, unknown>[])
        : [];

    if (props.some((p) => typeof p.id === 'string' && p.id === id)) {
        void vscode.window.showErrorMessage(`A prop with id "${id}" already exists in this room.`);
        return;
    }

    const zIndex = nextPropZIndexFromProps(props);

    const newProp: Record<string, unknown> = {
        id,
        tag: tagTrimmed,
        zIndex,
        visible: true,
        alpha: 1
    };
    if (clickable) {
        newProp.clickable = true;
    }
    props.push(newProp);

    data.props = props;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(
        `Added prop "${id}" (tag "${tagTrimmed}", ${clickable ? 'clickable' : 'not clickable'}) to room ${target.roomId}.`
    );
    await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
    await openRoomJsonAndScriptBottomGroup(target.roomJsonUri, target.roomId);
}

function defaultPropIdForImportedTag(roomId: string, tag: string): string {
    const slug = tag
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    const safe = slug.length > 0 ? slug : 'tag';
    return `${roomId}-prop-${safe}`;
}

function allocateUniquePropId(roomId: string, tag: string, usedIds: Set<string>): string {
    let base = defaultPropIdForImportedTag(roomId, tag);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
        id = `${base}-${n}`;
        n += 1;
    }
    usedIds.add(id);
    return id;
}

type RoomNodeRef = { folder: vscode.WorkspaceFolder; roomJsonUri: vscode.Uri; roomId: string };

async function resolveRoomNodeForImport(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<RoomNodeRef | undefined> {
    if (node?.kind === 'room') {
        return { folder: node.folder, roomJsonUri: node.uri, roomId: node.id };
    }
    if (selection.focus.kind === 'room') {
        const uri = selection.focus.uri;
        const folders = await findBenneGameFolders();
        const wf = folders.find((f) => uri.fsPath.startsWith(f.uri.fsPath));
        if (wf) {
            return {
                folder: wf,
                roomJsonUri: uri,
                roomId: getRoomIdFromRoomJsonUri(uri)
            };
        }
    }
    const folder = await pickWorkspaceFolder();
    if (!folder) {
        return undefined;
    }
    const rooms = await listRoomDefinitions(folder);
    if (rooms.length === 0) {
        void vscode.window.showErrorMessage('No rooms found.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        rooms.map((r) => ({ label: r.name, description: r.id, room: r })),
        { placeHolder: 'Choose a room to import props into' }
    );
    if (!picked) {
        return undefined;
    }
    return { folder, roomJsonUri: picked.room.uri, roomId: picked.room.id };
}

/**
 * Multi-select Aseprite frame tags and append matching props to the room JSON.
 */
export async function runImportPropsFromAsepriteTags(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const roomRef = await resolveRoomNodeForImport(selection, node);
    if (!roomRef) {
        return;
    }

    const sheet = await resolveRoomAsepriteSheetForProps(roomRef.folder.uri, roomRef.roomId);
    if (!sheet.jsonExists) {
        void vscode.window.showErrorMessage(
            `No Aseprite JSON for this room. Export to src/game/assets/images/rooms/${roomRef.roomId}/${roomRef.roomId}.json`
        );
        return;
    }
    if (sheet.frameTags === null) {
        void vscode.window.showErrorMessage('Could not read the room Aseprite JSON file.');
        return;
    }
    if (sheet.frameTags.length === 0) {
        void vscode.window.showErrorMessage(
            'This sheet has no meta.frameTags. Tag layers in Aseprite and re-export JSON.'
        );
        return;
    }

    const raw = await vscode.workspace.fs.readFile(roomRef.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot import props.');
        return;
    }

    const propsUnknown = data.props;
    const props: Record<string, unknown>[] = Array.isArray(propsUnknown)
        ? (propsUnknown as Record<string, unknown>[])
        : [];

    const usedTags = new Set<string>();
    const usedIds = new Set<string>();
    for (const p of props) {
        if (typeof p.id === 'string') {
            usedIds.add(p.id);
        }
        const t = typeof p.tag === 'string' ? p.tag.trim() : '';
        if (t) {
            usedTags.add(t);
        }
    }

    const items: vscode.QuickPickItem[] = sheet.frameTags.map((tag) => {
        const exists = usedTags.has(tag);
        return {
            label: tag,
            description: exists ? 'Already a prop in this room' : undefined,
            picked: !exists
        };
    });

    const chosen = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select Aseprite tags to import as props (Space to toggle; Enter to confirm)',
        ignoreFocusOut: true
    });
    if (!chosen || chosen.length === 0) {
        return;
    }

    const selectedTags = chosen.map((c) => c.label);
    const toImport = selectedTags.filter((tag) => !usedTags.has(tag));
    const skipped = selectedTags.length - toImport.length;
    if (toImport.length === 0) {
        void vscode.window.showInformationMessage(
            skipped > 0
                ? `No new props to add (${skipped} tag(s) already in room JSON).`
                : 'No tags selected.'
        );
        return;
    }

    const clickablePick = await vscode.window.showQuickPick(
        [
            {
                label: 'No',
                description: 'Decorative only (default for imports)'
            },
            {
                label: 'Yes',
                description: 'Clickable — add walk/collider in JSON or the preview editor'
            }
        ],
        {
            placeHolder: `Clickable for ${toImport.length} imported prop(s)?`,
            ignoreFocusOut: true
        }
    );
    if (!clickablePick) {
        return;
    }
    const clickable = clickablePick.label === 'Yes';

    let z = nextPropZIndexFromProps(props);
    for (const tag of toImport) {
        const id = allocateUniquePropId(roomRef.roomId, tag, usedIds);
        const newProp: Record<string, unknown> = {
            id,
            tag,
            zIndex: z,
            visible: true,
            alpha: 1
        };
        if (clickable) {
            newProp.clickable = true;
        }
        props.push(newProp);
        z += 1;
    }

    data.props = props;
    await vscode.workspace.fs.writeFile(roomRef.roomJsonUri, formatJson(data));

    const parts = [`Imported ${toImport.length} prop(s) from Aseprite tags.`];
    if (skipped > 0) {
        parts.push(`Skipped ${skipped} already in room.`);
    }
    void vscode.window.showInformationMessage(parts.join(' '));
    await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
    await openRoomJsonAndScriptBottomGroup(roomRef.roomJsonUri, roomRef.roomId);
}
