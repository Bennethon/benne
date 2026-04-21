import * as path from 'node:path';
import * as vscode from 'vscode';

export async function findBenneGameFolders(): Promise<vscode.WorkspaceFolder[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const out: vscode.WorkspaceFolder[] = [];
    for (const folder of folders) {
        if (await hasBenneGameLayout(folder.uri)) {
            out.push(folder);
        }
    }
    return out;
}

async function hasBenneGameLayout(root: vscode.Uri): Promise<boolean> {
    const rooms = vscode.Uri.joinPath(root, 'src', 'game', 'rooms');
    try {
        const stat = await vscode.workspace.fs.stat(rooms);
        return stat.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}

export async function listRoomDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const roomsDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'rooms');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(roomsDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(roomsDir, name, `${name}.room.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readRoomMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

async function readRoomMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string; id?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

export async function listGuiDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const guisDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'guis');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(guisDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(guisDir, name, `${name}.gui.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readGuiMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

async function readGuiMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

export async function listCharacterDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const charsDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'characters');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(charsDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(charsDir, name, `${name}.character.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readCharacterMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

function parseOnVerbRecord(raw: unknown): Record<string, boolean> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v === true) {
            out[k] = true;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/** One entry from `game-config.json` `verbs` (mirrors engine `GameVerbDefinition`). */
export type GameConfigVerbEntry = { id: string; label?: string; preposition?: string };

/** Matches engine defaults when `verbs` is omitted in game-config.json. */
export const DEFAULT_GAME_VERBS: GameConfigVerbEntry[] = [
    { id: 'look', label: 'Look at', preposition: 'at' },
    { id: 'use', label: 'Use', preposition: 'on' }
];

/**
 * Verb ids (and optional labels / prepositions) from `src/game/game-config.json`, in file order.
 * Falls back to {@link DEFAULT_GAME_VERBS} when the file is missing or has no valid `verbs`.
 */
export async function readGameConfigVerbs(gameRoot: vscode.Uri): Promise<GameConfigVerbEntry[]> {
    const uri = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'game-config.json');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as { verbs?: unknown };
        if (!Array.isArray(data.verbs) || data.verbs.length === 0) {
            return DEFAULT_GAME_VERBS;
        }
        const out: GameConfigVerbEntry[] = [];
        for (const v of data.verbs) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) {
                continue;
            }
            const o = v as Record<string, unknown>;
            const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : undefined;
            if (!id) {
                continue;
            }
            out.push({
                id,
                label: typeof o.label === 'string' && o.label.length > 0 ? o.label : undefined,
                preposition:
                    typeof o.preposition === 'string' && o.preposition.length > 0
                        ? o.preposition
                        : undefined
            });
        }
        return out.length > 0 ? out : DEFAULT_GAME_VERBS;
    } catch {
        return DEFAULT_GAME_VERBS;
    }
}

/**
 * When `game-config.json` is missing or has no valid `resolution`, matches prior editor scaffolding
 * and the internal size called out in docs.
 */
export const FALLBACK_GAME_RESOLUTION = { width: 352, height: 198 } as const;

/**
 * `resolution` from `src/game/game-config.json` (same source as runtime `getGameSettings()`).
 * Falls back to {@link FALLBACK_GAME_RESOLUTION} when the file or field is unusable.
 */
export async function readGameConfigResolution(
    gameRoot: vscode.Uri
): Promise<{ width: number; height: number }> {
    const uri = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'game-config.json');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as { resolution?: unknown };
        const r = data.resolution;
        if (!r || typeof r !== 'object' || Array.isArray(r)) {
            return { ...FALLBACK_GAME_RESOLUTION };
        }
        const o = r as Record<string, unknown>;
        const width = o.width;
        const height = o.height;
        if (
            typeof width === 'number' &&
            typeof height === 'number' &&
            Number.isFinite(width) &&
            Number.isFinite(height) &&
            width >= 1 &&
            height >= 1
        ) {
            return { width: Math.floor(width), height: Math.floor(height) };
        }
        return { ...FALLBACK_GAME_RESOLUTION };
    } catch {
        return { ...FALLBACK_GAME_RESOLUTION };
    }
}

function colliderPointCount(data: Record<string, unknown>): number {
    const c = data.collider;
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
        return 0;
    }
    const pts = (c as { points?: unknown }).points;
    if (!Array.isArray(pts)) {
        return 0;
    }
    return pts.filter((p) => p && typeof p === 'object' && 'x' in p && 'y' in p).length;
}

export async function readCharacterHooks(
    uri: vscode.Uri
): Promise<{
    onVerb?: Record<string, boolean>;
    onVerbFallback?: boolean;
    clickable?: boolean;
    /** True when `collider.points` has at least three vertices (engine hit-test). */
    hasColliderPolygon?: boolean;
}> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        const n = colliderPointCount(data);
        return {
            onVerb: parseOnVerbRecord(data.onVerb),
            onVerbFallback:
                typeof data.onVerbFallback === 'boolean'
                    ? data.onVerbFallback
                    : undefined,
            clickable: typeof data.clickable === 'boolean' ? data.clickable : undefined,
            hasColliderPolygon: n >= 3
        };
    } catch {
        return {};
    }
}

async function readCharacterMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

/** Same as `getAsepriteAssetPaths` in `src/game/characterAseprite.ts`. */
export function getCharacterAsepriteAssetRelativePaths(characterId: string): { png: string; json: string } {
    const base = `images/characters/${characterId}/${characterId}`;
    return { png: `${base}.png`, json: `${base}.json` };
}

/** Same layout as `getAsepriteAssetPaths` in `src/game/guiAseprite.ts`. */
export function getGuiAsepriteAssetRelativePaths(guiId: string): { png: string; json: string } {
    const base = `images/guis/${guiId}/${guiId}`;
    return { png: `${base}.png`, json: `${base}.json` };
}

export async function readCharacterUsesAsepriteDisplay(uri: vscode.Uri): Promise<boolean> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { display?: { aseprite?: unknown } };
        return data.display?.aseprite === true;
    } catch {
        return false;
    }
}

export async function readGuiUsesAsepriteDisplay(uri: vscode.Uri): Promise<boolean> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { display?: { aseprite?: unknown } };
        return data.display?.aseprite === true;
    } catch {
        return false;
    }
}

export interface RoomPropEntry {
    id: string;
    tag?: string;
    defaultAnimation?: string;
    zIndex?: number;
    visible?: boolean;
    clickable?: boolean;
    onVerb?: Record<string, boolean>;
    onVerbFallback?: boolean;
}

/** Folder name for `rooms/<id>/<id>.room.json` (e.g. `office`). */
export function getRoomIdFromRoomJsonUri(roomJsonUri: vscode.Uri): string {
    return path.basename(path.dirname(roomJsonUri.fsPath));
}

/** Folder name for `characters/<id>/<id>.character.json` (e.g. `clerk`). */
export function getCharacterIdFromCharacterJsonUri(characterJsonUri: vscode.Uri): string {
    return path.basename(path.dirname(characterJsonUri.fsPath));
}

/** Folder name for `guis/<id>/<id>.gui.json` (e.g. `inventoryBar`). */
export function getGuiIdFromGuiJsonUri(guiJsonUri: vscode.Uri): string {
    return path.basename(path.dirname(guiJsonUri.fsPath));
}

/** Folder name for `inventory/<id>/<id>.inventory.json` (e.g. `bucket`). */
export function getInventoryIdFromInventoryJsonUri(inventoryJsonUri: vscode.Uri): string {
    return path.basename(path.dirname(inventoryJsonUri.fsPath));
}

/** Same layout as `getRoomAsepriteAssetPaths` in the game (`src/game/roomAseprite.ts`). */
export function getRoomAsepriteAssetRelativePaths(roomId: string): { png: string; json: string } {
    const base = `images/rooms/${roomId}/${roomId}`;
    return { png: `${base}.png`, json: `${base}.json` };
}

function assetPathSegments(relativeUnderAssets: string): string[] {
    return relativeUnderAssets.split('/').filter(Boolean);
}

async function gameAssetExists(gameRoot: vscode.Uri, relativeUnderAssets: string): Promise<boolean> {
    const uri = vscode.Uri.joinPath(
        gameRoot,
        'src',
        'game',
        'assets',
        ...assetPathSegments(relativeUnderAssets)
    );
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/** True when both expected room sheet files exist under `src/game/assets/`. */
export async function roomAsepriteSheetFilesComplete(
    gameRoot: vscode.Uri,
    roomId: string
): Promise<boolean> {
    const { png, json } = getRoomAsepriteAssetRelativePaths(roomId);
    return (await gameAssetExists(gameRoot, png)) && (await gameAssetExists(gameRoot, json));
}

/** True when both expected character Aseprite files exist (for `display.aseprite: true`). */
export async function characterAsepriteSheetFilesComplete(
    gameRoot: vscode.Uri,
    characterId: string
): Promise<boolean> {
    const { png, json } = getCharacterAsepriteAssetRelativePaths(characterId);
    return (await gameAssetExists(gameRoot, png)) && (await gameAssetExists(gameRoot, json));
}

/** True when both expected GUI Aseprite files exist (for `display.aseprite: true`). */
export async function guiAsepriteSheetFilesComplete(
    gameRoot: vscode.Uri,
    guiId: string
): Promise<boolean> {
    const { png, json } = getGuiAsepriteAssetRelativePaths(guiId);
    return (await gameAssetExists(gameRoot, png)) && (await gameAssetExists(gameRoot, json));
}

function readAsepriteFrameTagNames(raw: Record<string, unknown>): readonly string[] {
    const meta = raw.meta;
    if (!meta || typeof meta !== 'object') {
        return [];
    }
    const frameTags = (meta as { frameTags?: readonly { name?: string }[] }).frameTags;
    if (!Array.isArray(frameTags) || frameTags.length === 0) {
        return [];
    }
    return frameTags.map((t) => (typeof t?.name === 'string' ? t.name : '')).filter(Boolean);
}

export type RoomAsepriteSheetResolution = {
    pngExists: boolean;
    jsonExists: boolean;
    /** Tag names when JSON exists and parses; `null` when JSON is missing or invalid JSON. */
    frameTags: readonly string[] | null;
};

/**
 * For prop validation: whether png/json exist, and frame tag names from JSON when readable.
 */
export async function resolveRoomAsepriteSheetForProps(
    gameRoot: vscode.Uri,
    roomId: string
): Promise<RoomAsepriteSheetResolution> {
    const { png, json } = getRoomAsepriteAssetRelativePaths(roomId);
    const pngExists = await gameAssetExists(gameRoot, png);
    const jsonExists = await gameAssetExists(gameRoot, json);
    if (!jsonExists) {
        return { pngExists, jsonExists, frameTags: null };
    }
    try {
        const jsonUri = vscode.Uri.joinPath(
            gameRoot,
            'src',
            'game',
            'assets',
            ...assetPathSegments(json)
        );
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        return { pngExists, jsonExists, frameTags: readAsepriteFrameTagNames(data) };
    } catch {
        return { pngExists, jsonExists, frameTags: null };
    }
}

/**
 * Character sheet under `images/characters/<id>/<id>.json` — same resolution shape as room props.
 */
export async function resolveCharacterAsepriteSheetForAnimations(
    gameRoot: vscode.Uri,
    characterId: string
): Promise<RoomAsepriteSheetResolution> {
    const { png, json } = getCharacterAsepriteAssetRelativePaths(characterId);
    const pngExists = await gameAssetExists(gameRoot, png);
    const jsonExists = await gameAssetExists(gameRoot, json);
    if (!jsonExists) {
        return { pngExists, jsonExists, frameTags: null };
    }
    try {
        const jsonUri = vscode.Uri.joinPath(
            gameRoot,
            'src',
            'game',
            'assets',
            ...assetPathSegments(json)
        );
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        return { pngExists, jsonExists, frameTags: readAsepriteFrameTagNames(data) };
    } catch {
        return { pngExists, jsonExists, frameTags: null };
    }
}

/** GUI sheet under `images/guis/<id>/<id>.json` — frame tag names for Inspector / validation. */
export async function resolveGuiAsepriteSheetForTags(
    gameRoot: vscode.Uri,
    guiId: string
): Promise<RoomAsepriteSheetResolution> {
    const { png, json } = getGuiAsepriteAssetRelativePaths(guiId);
    const pngExists = await gameAssetExists(gameRoot, png);
    const jsonExists = await gameAssetExists(gameRoot, json);
    if (!jsonExists) {
        return { pngExists, jsonExists, frameTags: null };
    }
    try {
        const jsonUri = vscode.Uri.joinPath(
            gameRoot,
            'src',
            'game',
            'assets',
            ...assetPathSegments(json)
        );
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        return { pngExists, jsonExists, frameTags: readAsepriteFrameTagNames(data) };
    } catch {
        return { pngExists, jsonExists, frameTags: null };
    }
}

export function propAsepriteAssetTooltip(
    sheet: RoomAsepriteSheetResolution,
    prop: RoomPropEntry,
    roomId: string
): string | undefined {
    const tag = prop.tag?.trim() ?? '';
    if (!tag) {
        return 'This prop has no Aseprite tag — add one that matches a frame tag on the room sheet export.';
    }
    if (!sheet.pngExists || !sheet.jsonExists) {
        return `Missing room sheet files — add src/game/assets/images/rooms/${roomId}/${roomId}.png and ${roomId}.json (Aseprite export).`;
    }
    if (sheet.frameTags === null) {
        return 'Room Aseprite JSON is missing or invalid — fix or re-export from Aseprite.';
    }
    if (sheet.frameTags.length === 0) {
        return 'Room sheet has no meta.frameTags — tag layers in Aseprite and re-export JSON.';
    }
    if (!sheet.frameTags.includes(tag)) {
        return `No frame tag "${tag}" on this room's sheet — use an exported tag name or update the prop.`;
    }
    return undefined;
}

export async function readRoomProps(uri: vscode.Uri): Promise<RoomPropEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { props?: unknown };
    if (!Array.isArray(data.props)) {
        return [];
    }
    const props: RoomPropEntry[] = [];
    for (const p of data.props) {
        if (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string') {
            const o = p as Record<string, unknown>;
            props.push({
                id: o.id as string,
                tag: typeof o.tag === 'string' ? o.tag : undefined,
                defaultAnimation: typeof o.defaultAnimation === 'string' ? o.defaultAnimation : undefined,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : undefined,
                visible: typeof o.visible === 'boolean' ? o.visible : undefined,
                clickable: typeof o.clickable === 'boolean' ? o.clickable : undefined,
                onVerb: parseOnVerbRecord(o.onVerb),
                onVerbFallback:
                    typeof o.onVerbFallback === 'boolean'
                        ? o.onVerbFallback
                        : undefined
            });
        }
    }
    props.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    return props;
}

export interface RoomHotspotListEntry {
    id: string;
    description?: string;
    zIndex?: number;
    active?: boolean;
    onVerb?: Record<string, boolean>;
    onVerbFallback?: boolean;
}

export interface RoomPointListEntry {
    id: string;
}

export interface RoomRegionListEntry {
    id: string;
    active?: boolean;
}

export async function readRoomHotspots(uri: vscode.Uri): Promise<RoomHotspotListEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { hotspots?: unknown };
    if (!Array.isArray(data.hotspots)) {
        return [];
    }
    const out: RoomHotspotListEntry[] = [];
    for (const h of data.hotspots) {
        if (h && typeof h === 'object' && typeof (h as { id?: unknown }).id === 'string') {
            const o = h as Record<string, unknown>;
            out.push({
                id: o.id as string,
                description: typeof o.description === 'string' ? o.description : undefined,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : undefined,
                active: typeof o.active === 'boolean' ? o.active : undefined,
                onVerb: parseOnVerbRecord(o.onVerb),
                onVerbFallback:
                    typeof o.onVerbFallback === 'boolean'
                        ? o.onVerbFallback
                        : undefined
            });
        }
    }
    out.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.id.localeCompare(b.id));
    return out;
}

export async function readRoomPoints(uri: vscode.Uri): Promise<RoomPointListEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { points?: unknown };
    if (!Array.isArray(data.points)) {
        return [];
    }
    const out: RoomPointListEntry[] = [];
    for (const p of data.points) {
        if (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string') {
            out.push({ id: (p as { id: string }).id });
        }
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

export async function readRoomRegions(uri: vscode.Uri): Promise<RoomRegionListEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { regions?: unknown };
    if (!Array.isArray(data.regions)) {
        return [];
    }
    const out: RoomRegionListEntry[] = [];
    for (const r of data.regions) {
        if (r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string') {
            const o = r as Record<string, unknown>;
            out.push({
                id: o.id as string,
                active: typeof o.active === 'boolean' ? o.active : undefined
            });
        }
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

/** Folder id from `definition` (e.g. `clerk/clerk.character.json` → `clerk`). */
export function characterIdFromRoomDefinition(definition: string): string | undefined {
    const d = definition.trim();
    if (!d) {
        return undefined;
    }
    const seg = d.split('/')[0]?.trim();
    return seg && seg.length > 0 ? seg : undefined;
}

export interface RoomCharacterListEntry {
    instanceId: string;
    definition: string;
    characterId: string;
}

export async function readRoomCharacters(uri: vscode.Uri): Promise<RoomCharacterListEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { characters?: unknown };
    if (!Array.isArray(data.characters)) {
        return [];
    }
    const out: RoomCharacterListEntry[] = [];
    for (const c of data.characters) {
        if (c && typeof c === 'object') {
            const o = c as Record<string, unknown>;
            const instanceId = typeof o.instanceId === 'string' ? o.instanceId.trim() : '';
            const definition = typeof o.definition === 'string' ? o.definition.trim() : '';
            const characterId = characterIdFromRoomDefinition(definition);
            if (instanceId && characterId) {
                out.push({ instanceId, definition, characterId });
            }
        }
    }
    out.sort((a, b) => a.instanceId.localeCompare(b.instanceId));
    return out;
}

export async function listInventoryDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const invDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'inventory');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(invDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(invDir, name, `${name}.inventory.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readInventoryMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

async function readInventoryMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

/** `display.aseprite` from `*.inventory.json` when readable. */
export async function readInventoryDisplayAseprite(
    inventoryJsonUri: vscode.Uri
): Promise<boolean | 'shared' | undefined> {
    try {
        const raw = await vscode.workspace.fs.readFile(inventoryJsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { display?: { aseprite?: unknown } };
        const a = data.display?.aseprite;
        if (a === 'shared') {
            return 'shared';
        }
        if (a === true) {
            return true;
        }
        return undefined;
    } catch {
        return undefined;
    }
}

export function sharedInventoryJsonUri(gameRoot: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'inventory', 'inventory.json');
}

export async function sharedInventorySheetFilesComplete(gameRoot: vscode.Uri): Promise<boolean> {
    const png = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'inventory', 'inventory.png');
    const json = sharedInventoryJsonUri(gameRoot);
    try {
        await Promise.all([vscode.workspace.fs.stat(png), vscode.workspace.fs.stat(json)]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Shared inventory sheet under `images/inventory/inventory.json` — same resolution shape as room/character helpers.
 */
export async function resolveSharedInventoryAsepriteSheet(
    gameRoot: vscode.Uri
): Promise<RoomAsepriteSheetResolution> {
    const png = 'images/inventory/inventory.png';
    const json = 'images/inventory/inventory.json';
    const pngExists = await gameAssetExists(gameRoot, png);
    const jsonExists = await gameAssetExists(gameRoot, json);
    if (!jsonExists) {
        return { pngExists, jsonExists, frameTags: null };
    }
    try {
        const jsonUri = vscode.Uri.joinPath(
            gameRoot,
            'src',
            'game',
            'assets',
            ...assetPathSegments(json)
        );
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        return { pngExists, jsonExists, frameTags: readAsepriteFrameTagNames(data) };
    } catch {
        return { pngExists, jsonExists, frameTags: null };
    }
}

/**
 * Per-item inventory sheet `images/inventory/<id>/<id>.json` — same resolution shape as shared inventory.
 */
export async function resolvePerItemInventoryAsepriteSheet(
    gameRoot: vscode.Uri,
    itemId: string
): Promise<RoomAsepriteSheetResolution> {
    const png = `images/inventory/${itemId}/${itemId}.png`;
    const json = `images/inventory/${itemId}/${itemId}.json`;
    const pngExists = await gameAssetExists(gameRoot, png);
    const jsonExists = await gameAssetExists(gameRoot, json);
    if (!jsonExists) {
        return { pngExists, jsonExists, frameTags: null };
    }
    try {
        const jsonUri = vscode.Uri.joinPath(
            gameRoot,
            'src',
            'game',
            'assets',
            ...assetPathSegments(json)
        );
        const raw = await vscode.workspace.fs.readFile(jsonUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as Record<string, unknown>;
        return { pngExists, jsonExists, frameTags: readAsepriteFrameTagNames(data) };
    } catch {
        return { pngExists, jsonExists, frameTags: null };
    }
}

export async function perItemInventorySheetFilesComplete(
    gameRoot: vscode.Uri,
    itemId: string
): Promise<boolean> {
    const png = vscode.Uri.joinPath(
        gameRoot,
        'src',
        'game',
        'assets',
        'images',
        'inventory',
        itemId,
        `${itemId}.png`
    );
    const json = vscode.Uri.joinPath(
        gameRoot,
        'src',
        'game',
        'assets',
        'images',
        'inventory',
        itemId,
        `${itemId}.json`
    );
    try {
        await Promise.all([vscode.workspace.fs.stat(png), vscode.workspace.fs.stat(json)]);
        return true;
    } catch {
        return false;
    }
}

export function readAsepriteFrameTagNamesFromJsonText(text: string): string[] {
    try {
        const data = JSON.parse(text) as { meta?: { frameTags?: { name?: string }[] } };
        const tags = data.meta?.frameTags;
        if (!Array.isArray(tags)) {
            return [];
        }
        const out: string[] = [];
        for (const t of tags) {
            if (t && typeof t.name === 'string' && t.name.length > 0) {
                out.push(t.name);
            }
        }
        return out;
    } catch {
        return [];
    }
}
