import * as vscode from 'vscode';
import { runGenerateGameIds } from './gameIdsGenerator';
import { computeAsepriteTagCandidateBases, tagsInHyphenFamily } from './asepriteTagFamily';
import {
    findBenneGameFolders,
    getRoomIdFromRoomJsonUri,
    listCharacterDefinitions,
    listRoomDefinitions,
    readGameConfigResolution,
    readRoomWalkablePolygons,
    resolveRoomAsepriteSheetForProps
} from './gameDiscovery';
import type { EditorSelection } from './editorSelection';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import type { MainTreeNode } from './mainTreeProvider';
import { openBenneRoomTypeScript } from './roomScriptNavigation';
import { promptForNameAndId, proposeIdFromName } from './nameAndIdPrompt';

const SLUG_RE = /^[a-z0-9_-]+$/i;

export function validateSlug(value: string, label: string): string | null {
    if (!value || !SLUG_RE.test(value)) {
        return `${label} must be non-empty and use only letters, numbers, underscores, or hyphens`;
    }
    return null;
}

export function formatJson(value: unknown): Uint8Array {
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

export async function gameRootContaining(roomJsonUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const folders = await findBenneGameFolders();
    return folders.find((f) => roomJsonUri.fsPath.startsWith(f.uri.fsPath))?.uri;
}

/** Prefer `room.size` when valid; otherwise `game-config.json` resolution. */
export async function resolveRoomWidthHeight(
    data: Record<string, unknown>,
    gameRoot: vscode.Uri
): Promise<{ width: number; height: number }> {
    const sz = data.size;
    if (sz && typeof sz === 'object' && !Array.isArray(sz)) {
        const o = sz as Record<string, unknown>;
        const w = o.width;
        const h = o.height;
        if (
            typeof w === 'number' &&
            typeof h === 'number' &&
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            w >= 1 &&
            h >= 1
        ) {
            return { width: Math.floor(w), height: Math.floor(h) };
        }
    }
    return readGameConfigResolution(gameRoot);
}

function roomCenterFromExtents(width: number, height: number): { cx: number; cy: number } {
    return {
        cx: Math.round(width / 2),
        cy: Math.round(height / 2)
    };
}

/** Axis-aligned square centered in room space (4 vertices). */
function defaultCenteredSquarePoints(
    halfSide: number,
    width: number,
    height: number
): { x: number; y: number }[] {
    const { cx, cy } = roomCenterFromExtents(width, height);
    const s = halfSide;
    return [
        { x: cx - s, y: cy - s },
        { x: cx + s, y: cy - s },
        { x: cx + s, y: cy + s },
        { x: cx - s, y: cy + s }
    ];
}

/**
 * Collider + walk/look seed for new clickable props — matches room-preview `ensureHotspotWalkLook`
 * (centered 48×48 square, walk/look at polygon centroid).
 */
export function defaultClickablePropInteractionFields(roomW: number, roomH: number): {
    collider: { points: { x: number; y: number }[] };
    walkToPoint: { x: number; y: number };
    lookAtPoint: { x: number; y: number };
} {
    const { cx, cy } = roomCenterFromExtents(roomW, roomH);
    const halfSide = 24;
    return {
        collider: { points: defaultCenteredSquarePoints(halfSide, roomW, roomH) },
        walkToPoint: { x: cx, y: cy },
        lookAtPoint: { x: cx + 12, y: cy },
    };
}

/**
 * Create `src/game/rooms/<id>/`, `<id>.room.json`, `<id>.room.ts`, asset folder, and manifest entry.
 * Returns the new room's tree node so the caller can open it as if it were clicked in the tree
 * (preview on top, script below).
 */
export async function runCreateRoomWizard(
    preferredFolder?: vscode.WorkspaceFolder
): Promise<Extract<MainTreeNode, { kind: 'room' }> | undefined> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return undefined;
    }

    const named = await promptForNameAndId({
        namePrompt: 'Room display name (shown in the BENNE tree and in `name` in JSON)',
        namePlaceHolder: 'Kitchen',
        idPrompt: 'Room id (folder name and file prefix)',
        idLabel: 'Room id',
        fallbackId: 'room'
    });
    if (!named) {
        return undefined;
    }
    const { name, id } = named;

    const roomDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'rooms', id);
    const roomJsonUri = vscode.Uri.joinPath(roomDir, `${id}.room.json`);
    const roomTsUri = vscode.Uri.joinPath(roomDir, `${id}.room.ts`);
    const assetsDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', 'images', 'rooms', id);

    try {
        await vscode.workspace.fs.stat(roomDir);
        void vscode.window.showErrorMessage(`Room folder already exists: ${id}`);
        return undefined;
    } catch {
        /* create */
    }

    const { width: roomW, height: roomH } = await readGameConfigResolution(folder.uri);

    const roomJson = {
        id,
        name,
        size: { width: roomW, height: roomH },
        scrollBounds: { x: 0, y: 0, width: roomW, height: roomH },
        walkable: { polygons: [] },
        hotspots: [],
        points: [],
        regions: [],
        props: []
    };

    const roomTs = `import { room } from './${id}.ids';

// ${name}: what happens in this room. Handlers for its props, hotspots, characters and regions go
// here. Select one in the room preview and click a verb in the Inspector to add a handler, or
// write one yourself:
//
//   door.onUse(() => {
//     walkToClicked()
//     rooms.hallway.goTo()
//   })
//
// Things in this room are plain names (\`door\`, \`points.x\`, \`regions.x\`) imported from
// './${id}.ids'; everything else comes from '@game'. Auto-import adds the import lines as you type.

room.onEnter(() => {
  // Runs before the room fades in: set up positions, visibility and flags here.
  // Music, entrances and cutscenes go in room.onEnterAfterFade(() => { … }).
})
`;

    await vscode.workspace.fs.createDirectory(roomDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(roomJsonUri, formatJson(roomJson));
    await vscode.workspace.fs.writeFile(roomTsUri, new TextEncoder().encode(roomTs));

    await appendRoomsManifestEntry(folder.uri, id);
    // The script imports the room's generated handles (`./<id>.ids`).
    await runGenerateGameIds(folder, { quiet: true });

    void vscode.window.showInformationMessage(`Created room "${name}" (${id}).`);
    return { kind: 'room', folder, id, name, uri: roomJsonUri };
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

function nextCharacterZIndex(characters: Record<string, unknown>[]): number {
    let max = -1;
    for (const c of characters) {
        const z = c.zIndex;
        if (typeof z === 'number' && z > max) {
            max = z;
        }
    }
    return max + 1;
}

type RoomTarget = { roomJsonUri: vscode.Uri; roomId: string };

/** Lets add-* wizards target a room when invoked from the Inspector (no tree node). */
export async function mainTreeRoomNodeFromRoomJson(
    roomJsonUri: vscode.Uri,
    roomId: string
): Promise<MainTreeNode | undefined> {
    const folders = await findBenneGameFolders();
    const folder = folders.find((f) => roomJsonUri.fsPath.startsWith(f.uri.fsPath));
    if (!folder) {
        return undefined;
    }
    const rooms = await listRoomDefinitions(folder);
    const match = rooms.find((r) => r.uri.toString() === roomJsonUri.toString());
    const name = match?.name ?? roomId;
    return { kind: 'room', folder, id: roomId, name, uri: roomJsonUri };
}

/** Resolves `{ roomJsonUri, roomId }` for add-* room wizards from tree context or selection. */
export async function resolveRoomTarget(
    node: MainTreeNode | undefined,
    selection: EditorSelection
): Promise<RoomTarget | undefined> {
    if (node?.kind === 'room') {
        return { roomJsonUri: node.uri, roomId: node.id };
    }
    if (node?.kind === 'prop') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'hotspot') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'roomPoint') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'region') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'roomCharacter') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'roomSubGroup') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'walkableAreasRoot') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'walkablePolygon') {
        return { roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'walkableHole') {
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

    const propId = await vscode.window.showInputBox({
        prompt: 'Prop id (unique within this room JSON)',
        value: proposeIdFromName(tagTrimmed, 'prop'),
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

    let clickableSeed: ReturnType<typeof defaultClickablePropInteractionFields> | undefined;
    if (clickable) {
        const gameRoot = await gameRootContaining(target.roomJsonUri);
        if (!gameRoot) {
            void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
            return;
        }
        const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
        clickableSeed = defaultClickablePropInteractionFields(roomW, roomH);
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
        Object.assign(newProp, clickableSeed!);
    }
    props.push(newProp);

    data.props = props;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(
        `Added prop "${id}" (tag "${tagTrimmed}", ${clickable ? 'clickable' : 'not clickable'}) to room ${target.roomId}.`
    );
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

function allocateUniquePropId(tag: string, usedIds: Set<string>): string {
    const base = proposeIdFromName(tag, 'tag');
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
    if (node?.kind === 'hotspot') {
        return { folder: node.folder, roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'roomPoint') {
        return { folder: node.folder, roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'region') {
        return { folder: node.folder, roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'prop') {
        return { folder: node.folder, roomJsonUri: node.roomJsonUri, roomId: node.roomId };
    }
    if (node?.kind === 'roomSubGroup') {
        return { folder: node.folder, roomJsonUri: node.roomJsonUri, roomId: node.roomId };
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

function existingPropFamilyCoversBase(
    props: Record<string, unknown>[],
    base: string,
    allTags: readonly string[]
): boolean {
    const members = new Set(tagsInHyphenFamily(base, allTags));
    for (const p of props) {
        const id = typeof p.id === 'string' ? p.id : '';
        const da = typeof p.defaultAnimation === 'string' ? p.defaultAnimation.trim() : '';
        const t = typeof p.tag === 'string' ? p.tag.trim() : '';
        if (id === base || da === base) {
            return true;
        }
        if (t.length > 0 && members.has(t)) {
            return true;
        }
    }
    return false;
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

    const modePick = await vscode.window.showQuickPick(
        [
            {
                label: 'Grouped by base tag (recommended)',
                description: 'One prop per root; all door, door-open, … clips in one entry',
                value: 'grouped' as const
            },
            {
                label: 'Legacy: one prop per tag',
                description: 'Each selected tag becomes its own prop',
                value: 'legacy' as const
            }
        ],
        { placeHolder: 'Choose how to import props from this room sheet', ignoreFocusOut: true }
    );
    if (!modePick) {
        return;
    }

    if (modePick.value === 'legacy') {
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

        let clickableSeed: ReturnType<typeof defaultClickablePropInteractionFields> | undefined;
        if (clickable) {
            const gameRoot = await gameRootContaining(roomRef.roomJsonUri);
            if (!gameRoot) {
                void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
                return;
            }
            const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
            clickableSeed = defaultClickablePropInteractionFields(roomW, roomH);
        }

        let z = nextPropZIndexFromProps(props);
        for (const tag of toImport) {
            const id = allocateUniquePropId(tag, usedIds);
            const newProp: Record<string, unknown> = {
                id,
                tag,
                zIndex: z,
                visible: true,
                alpha: 1
            };
            if (clickable) {
                newProp.clickable = true;
                Object.assign(newProp, clickableSeed!);
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
        await applyBenneTwoRowJsonScriptLayout();
        await openBenneRoomTypeScript(roomRef.roomJsonUri, roomRef.roomId);
        return;
    }

    const roomSheetTags: readonly string[] = sheet.frameTags;

    const candidateBases = computeAsepriteTagCandidateBases(roomSheetTags);
    if (candidateBases.length === 0) {
        void vscode.window.showErrorMessage('No candidate base tags found on this sheet.');
        return;
    }

    const baseItems: vscode.QuickPickItem[] = candidateBases.map((base) => {
        const covered = existingPropFamilyCoversBase(props, base, roomSheetTags);
        return {
            label: base,
            description: covered ? 'Family may already exist in this room' : undefined,
            picked: !covered
        };
    });

    const chosenBases = await vscode.window.showQuickPick(baseItems, {
        canPickMany: true,
        placeHolder: 'Select base tag(s); each creates one prop with all <base>-* clips on the sheet',
        ignoreFocusOut: true
    });
    if (!chosenBases || chosenBases.length === 0) {
        return;
    }

    const basesToAdd = chosenBases.map((c) => c.label);
    const membersByBase = basesToAdd.map((b) => ({
        base: b,
        members: tagsInHyphenFamily(b, roomSheetTags)
    }));
    const filtered = membersByBase.filter(({ base, members }) => {
        if (members.length === 0) {
            return false;
        }
        if (existingPropFamilyCoversBase(props, base, roomSheetTags)) {
            return false;
        }
        return true;
    });
    if (filtered.length === 0) {
        void vscode.window.showInformationMessage('No new prop families to add (all selected bases already covered).');
        return;
    }

    const clickablePickGrouped = await vscode.window.showQuickPick(
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
            placeHolder: `Clickable for ${filtered.length} imported prop family/families?`,
            ignoreFocusOut: true
        }
    );
    if (!clickablePickGrouped) {
        return;
    }
    const clickableGrouped = clickablePickGrouped.label === 'Yes';

    let clickableSeedGrouped: ReturnType<typeof defaultClickablePropInteractionFields> | undefined;
    if (clickableGrouped) {
        const gameRoot = await gameRootContaining(roomRef.roomJsonUri);
        if (!gameRoot) {
            void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
            return;
        }
        const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
        clickableSeedGrouped = defaultClickablePropInteractionFields(roomW, roomH);
    }

    let z = nextPropZIndexFromProps(props);
    let added = 0;
    for (const { base, members } of filtered) {
        const anims: Record<string, Record<string, unknown>> = {};
        for (const m of members) {
            anims[m] = {};
        }
        let propId: string;
        let defaultAnimation: string | undefined;
        if (!usedIds.has(base) && validateSlug(base, 'Prop id') === null) {
            propId = base;
            usedIds.add(base);
        } else {
            propId = allocateUniquePropId(base, usedIds);
            defaultAnimation = base;
        }
        const displayTag = members.includes(base) ? base : members[0]!;
        const newProp: Record<string, unknown> = {
            id: propId,
            tag: displayTag,
            animations: anims,
            zIndex: z,
            visible: true,
            alpha: 1
        };
        if (defaultAnimation !== undefined) {
            newProp.defaultAnimation = defaultAnimation;
        }
        if (clickableGrouped) {
            newProp.clickable = true;
            Object.assign(newProp, clickableSeedGrouped!);
        }
        props.push(newProp);
        for (const m of members) {
            usedTags.add(m);
        }
        z += 1;
        added += 1;
    }

    data.props = props;
    await vscode.workspace.fs.writeFile(roomRef.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(
        `Imported ${added} prop famil${added === 1 ? 'y' : 'ies'} from Aseprite (grouped by base tag).`
    );
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(roomRef.roomJsonUri, roomRef.roomId);
}

function nextHotspotZIndex(hotspots: Record<string, unknown>[]): number {
    let max = -1;
    for (const h of hotspots) {
        const z = h.zIndex;
        if (typeof z === 'number' && z > max) {
            max = z;
        }
    }
    return max + 1;
}

/**
 * Append a hotspot with a small default square polygon and walk/look hints (editable in the preview).
 */
export async function runAddRoomHotspotWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const hotspotId = await vscode.window.showInputBox({
        prompt: 'Hotspot id (unique in this room JSON)',
        placeHolder: 'door',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Hotspot id')
    });
    if (!hotspotId) {
        return;
    }
    const id = hotspotId.trim();

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add hotspot.');
        return;
    }

    const listUnknown = data.hotspots;
    const hotspots: Record<string, unknown>[] = Array.isArray(listUnknown)
        ? (listUnknown as Record<string, unknown>[])
        : [];
    if (hotspots.some((h) => typeof h.id === 'string' && h.id === id)) {
        void vscode.window.showErrorMessage(`A hotspot with id "${id}" already exists in this room.`);
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);

    const zIndex = nextHotspotZIndex(hotspots);
    const { cx, cy } = roomCenterFromExtents(roomW, roomH);
    const halfSide = 24;
    hotspots.push({
        id,
        active: true,
        description: '',
        zIndex,
        points: defaultCenteredSquarePoints(halfSide, roomW, roomH),
        walkToPoint: {
            x: cx,
            y: Math.min(Math.max(cy + 36, 0), roomH)
        },
        lookAtPoint: { x: cx, y: cy }
    });
    data.hotspots = hotspots;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(`Added hotspot "${id}" to room ${target.roomId}.`);
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

/** Append a room `points[]` entry at the center of the room (`size` or `game-config.json` resolution). */
export async function runAddRoomPointWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const pointId = await vscode.window.showInputBox({
        prompt: 'Point id (unique in this room JSON)',
        placeHolder: 'door-front',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Point id')
    });
    if (!pointId) {
        return;
    }
    const id = pointId.trim();

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add point.');
        return;
    }

    const listUnknown = data.points;
    const points: Record<string, unknown>[] = Array.isArray(listUnknown)
        ? (listUnknown as Record<string, unknown>[])
        : [];
    if (points.some((p) => typeof p.id === 'string' && p.id === id)) {
        void vscode.window.showErrorMessage(`A point with id "${id}" already exists in this room.`);
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
    const { cx, cy } = roomCenterFromExtents(roomW, roomH);
    points.push({ id, x: cx, y: cy });
    data.points = points;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(`Added point "${id}" to room ${target.roomId}.`);
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

/** Append a `regions[]` entry with a small default square polygon (editable in the preview). */
export async function runAddRoomRegionWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const regionId = await vscode.window.showInputBox({
        prompt: 'Region id (unique in this room JSON)',
        placeHolder: 'doorway',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Region id')
    });
    if (!regionId) {
        return;
    }
    const id = regionId.trim();

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add region.');
        return;
    }

    const listUnknown = data.regions;
    const regions: Record<string, unknown>[] = Array.isArray(listUnknown)
        ? (listUnknown as Record<string, unknown>[])
        : [];
    if (regions.some((r) => typeof r.id === 'string' && r.id === id)) {
        void vscode.window.showErrorMessage(`A region with id "${id}" already exists in this room.`);
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);
    regions.push({ id, active: true, points: defaultCenteredSquarePoints(24, roomW, roomH) });
    data.regions = regions;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(`Added region "${id}" to room ${target.roomId}.`);
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

function ensureWalkableRoot(data: Record<string, unknown>): Record<string, unknown> {
    let w = data.walkable;
    if (!w || typeof w !== 'object' || Array.isArray(w)) {
        w = { polygons: [] };
        data.walkable = w;
    }
    const wo = w as Record<string, unknown>;
    if (!Array.isArray(wo.polygons)) {
        wo.polygons = [];
    }
    return wo;
}

function collectWalkableIds(data: Record<string, unknown>): Set<string> {
    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    const ids = new Set<string>();
    for (const p of polys) {
        if (typeof p.id === 'string') {
            ids.add(p.id);
        }
        const holes = p.holes;
        if (Array.isArray(holes)) {
            for (const h of holes) {
                if (h && typeof h === 'object' && typeof (h as { id?: unknown }).id === 'string') {
                    ids.add((h as { id: string }).id);
                }
            }
        }
    }
    return ids;
}

/** Default walkable triangle centered in room space (matches Inspector / polygon editor). */
function defaultWalkableTriangle(width: number, height: number): { x: number; y: number }[] {
    const { cx, cy } = roomCenterFromExtents(width, height);
    return [
        { x: cx - 24, y: cy + 20 },
        { x: cx + 24, y: cy + 20 },
        { x: cx, y: cy - 28 }
    ];
}

async function resolveWalkablePolygonId(
    node: MainTreeNode | undefined,
    roomJsonUri: vscode.Uri
): Promise<string | undefined> {
    if (node?.kind === 'walkablePolygon') {
        return node.polygonId;
    }
    if (node?.kind === 'walkableHole') {
        return node.polygonId;
    }
    const polys = await readRoomWalkablePolygons(roomJsonUri);
    if (polys.length === 0) {
        void vscode.window.showErrorMessage('Add a walkable area first, then add a hole.');
        return undefined;
    }
    if (polys.length === 1) {
        return polys[0]!.id;
    }
    const picked = await vscode.window.showQuickPick(
        polys.map((p) => ({ label: p.id, description: `${p.holes.length} hole(s)`, polygonId: p.id })),
        { placeHolder: 'Choose the walkable area to add a hole to' }
    );
    return picked?.polygonId;
}

/** Append a `walkable.polygons[]` entry with a small default triangle (editable in the preview). */
export async function runAddRoomWalkableAreaWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const polygonId = await vscode.window.showInputBox({
        prompt: 'Walkable area id (unique among walkable polygons and holes in this room)',
        placeHolder: 'floor',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Walkable area id')
    });
    if (!polygonId) {
        return;
    }
    const id = polygonId.trim();

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add walkable area.');
        return;
    }

    const walkableIds = collectWalkableIds(data);
    if (walkableIds.has(id)) {
        void vscode.window.showErrorMessage(
            `An id "${id}" already exists among walkable polygons or holes in this room.`
        );
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);

    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    polys.push({
        id,
        active: true,
        points: defaultWalkableTriangle(roomW, roomH)
    });
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(`Added walkable area "${id}" to room ${target.roomId}.`);
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

/** Append a hole under a walkable polygon (editable in the preview). */
export async function runAddRoomWalkableHoleWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const parentPolygonId = await resolveWalkablePolygonId(node, target.roomJsonUri);
    if (!parentPolygonId) {
        return;
    }

    const holeId = await vscode.window.showInputBox({
        prompt: `Hole id (unique among walkable polygons and holes; parent: ${parentPolygonId})`,
        placeHolder: 'table',
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Hole id')
    });
    if (!holeId) {
        return;
    }
    const id = holeId.trim();

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add hole.');
        return;
    }

    const walkableIds = collectWalkableIds(data);
    if (walkableIds.has(id)) {
        void vscode.window.showErrorMessage(
            `An id "${id}" already exists among walkable polygons or holes in this room.`
        );
        return;
    }

    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    const poly = polys.find((p) => typeof p.id === 'string' && (p.id as string) === parentPolygonId);
    if (!poly) {
        void vscode.window.showErrorMessage(`Walkable area "${parentPolygonId}" was not found in this room.`);
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);

    if (!Array.isArray(poly.holes)) {
        poly.holes = [];
    }
    (poly.holes as Record<string, unknown>[]).push({
        id,
        active: true,
        points: defaultWalkableTriangle(roomW, roomH)
    });
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(
        `Added hole "${id}" to walkable area "${parentPolygonId}" in room ${target.roomId}.`
    );
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}

/** Append a `characters[]` instance referencing an existing character definition. */
export async function runAddRoomSpawnedCharacterWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const target = await resolveRoomTarget(node, selection);
    if (!target) {
        return;
    }

    const folders = await findBenneGameFolders();
    const folder = folders.find((f) => target.roomJsonUri.fsPath.startsWith(f.uri.fsPath));
    if (!folder) {
        void vscode.window.showErrorMessage('No BENNE game folder contains this room.');
        return;
    }

    const defs = await listCharacterDefinitions(folder);
    if (defs.length === 0) {
        void vscode.window.showErrorMessage('No character definitions found. Create a character first.');
        return;
    }

    const picked = await vscode.window.showQuickPick(
        defs.map((d) => ({ label: d.name, description: d.id, char: d })),
        { placeHolder: 'Choose character to place in this room', matchOnDescription: true }
    );
    if (!picked) {
        return;
    }

    const char = picked.char;
    const definition = `${char.id}/${char.id}.character.json`;

    const raw = await vscode.workspace.fs.readFile(target.roomJsonUri);
    const text = new TextDecoder('utf-8').decode(raw);
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('Room JSON is not valid; cannot add character.');
        return;
    }

    const listUnknown = data.characters;
    const characters: Record<string, unknown>[] = Array.isArray(listUnknown)
        ? (listUnknown as Record<string, unknown>[])
        : [];

    let n = 1;
    while (characters.some((c) => typeof c.instanceId === 'string' && (c.instanceId as string) === `${char.id}-${n}`)) {
        n += 1;
    }
    const defaultInstanceId = `${char.id}-${n}`;

    const instanceId = await vscode.window.showInputBox({
        prompt: 'Instance id (unique placement in this room JSON)',
        value: defaultInstanceId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'Instance id')
    });
    if (!instanceId) {
        return;
    }
    const id = instanceId.trim();

    if (characters.some((c) => typeof c.instanceId === 'string' && (c.instanceId as string) === id)) {
        void vscode.window.showErrorMessage(`A character instance with id "${id}" already exists in this room.`);
        return;
    }

    const gameRoot = await gameRootContaining(target.roomJsonUri);
    if (!gameRoot) {
        void vscode.window.showErrorMessage('Could not locate BENNE game root for this room.');
        return;
    }
    const { width: roomW, height: roomH } = await resolveRoomWidthHeight(data, gameRoot);

    const zIndex = nextCharacterZIndex(characters);
    const { cx, cy } = roomCenterFromExtents(roomW, roomH);

    characters.push({
        instanceId: id,
        definition,
        x: cx,
        y: cy,
        initialFacing: 'L',
        initialAnimation: 'Idle',
        visible: true,
        zIndex
    });
    data.characters = characters;
    await vscode.workspace.fs.writeFile(target.roomJsonUri, formatJson(data));

    void vscode.window.showInformationMessage(`Added character instance "${id}" (${char.id}) to room ${target.roomId}.`);
    await applyBenneTwoRowJsonScriptLayout();
    await openBenneRoomTypeScript(target.roomJsonUri, target.roomId);
}
