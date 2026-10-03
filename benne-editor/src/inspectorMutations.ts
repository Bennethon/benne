import * as vscode from 'vscode';
import {
    enqueueJsonFileWork,
    readInspectorJsonText,
    writeInspectorJsonData
} from './inspectorJsonDocument';
import { readPngDimensions } from './inspectorPngDimensions';

const DEFAULT_W = 352;
const DEFAULT_H = 198;

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

function defaultTriangle(cx: number, cy: number): { x: number; y: number }[] {
    return [
        { x: cx - 24, y: cy + 20 },
        { x: cx + 24, y: cy + 20 },
        { x: cx, y: cy - 28 }
    ];
}

function nextId(prefix: string, existing: Set<string>): string {
    let n = 1;
    while (existing.has(`${prefix}${n}`)) {
        n++;
    }
    return `${prefix}${n}`;
}

async function writeJsonFileUnlocked(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await writeInspectorJsonData(uri, data);
}

export async function writeRoomJson(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await enqueueJsonFileWork(uri, () => writeJsonFileUnlocked(uri, data));
}

export async function writeDataJson(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await enqueueJsonFileWork(uri, () => writeJsonFileUnlocked(uri, data));
}

export async function loadRoomData(uri: vscode.Uri): Promise<Record<string, unknown> | null> {
    try {
        const text = await readInspectorJsonText(uri);
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function applyRoomDisplayName(data: Record<string, unknown>, name: string): void {
    data.name = name;
}

export function applyRoomSize(data: Record<string, unknown>, width: number, height: number): void {
    data.size = { width, height };
}

export function clearRoomSize(data: Record<string, unknown>): void {
    delete data.size;
}

export function applyScrollBounds(
    data: Record<string, unknown>,
    x: number,
    y: number,
    width: number,
    height: number
): void {
    data.scrollBounds = { x, y, width, height };
}

export function clearScrollBounds(data: Record<string, unknown>): void {
    delete data.scrollBounds;
}

export async function applyFitBackground(
    data: Record<string, unknown>,
    roomJsonUri: vscode.Uri
): Promise<{ ok: true } | { ok: false; message: string }> {
    const bg = data.background;
    if (!bg || typeof bg !== 'object') {
        return { ok: false, message: 'No background image in room JSON.' };
    }
    const rel = typeof (bg as { image?: unknown }).image === 'string' ? (bg as { image: string }).image.trim() : '';
    if (!rel) {
        return { ok: false, message: 'No background.image path.' };
    }
    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    if (!folder) {
        return { ok: false, message: 'No workspace folder.' };
    }
    const abs = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', ...rel.split('/'));
    let bytes: Uint8Array;
    try {
        bytes = await vscode.workspace.fs.readFile(abs);
    } catch {
        return { ok: false, message: 'Could not read background image file.' };
    }
    const dim = readPngDimensions(bytes);
    if (!dim) {
        return { ok: false, message: 'Background file is not a PNG or is too small.' };
    }
    data.size = { width: dim.width, height: dim.height };
    return { ok: true };
}

export function setWalkableRowActive(
    data: Record<string, unknown>,
    kind: 'polygon' | 'hole',
    polygonId: string,
    rowId: string,
    active: boolean
): { ok: true } | { ok: false; message: string } {
    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    const poly = polys.find((p) => typeof p.id === 'string' && (p.id as string) === polygonId);
    if (!poly) {
        return { ok: false, message: 'Walkable polygon not found.' };
    }
    if (kind === 'polygon') {
        if (rowId !== polygonId) {
            return { ok: false, message: 'Polygon id mismatch.' };
        }
        if (active) {
            delete poly.active;
        } else {
            poly.active = false;
        }
        return { ok: true };
    }
    const holes = poly.holes;
    if (!Array.isArray(holes)) {
        return { ok: false, message: 'No holes on polygon.' };
    }
    const hole = holes.find((h) => h && typeof h === 'object' && typeof (h as { id?: unknown }).id === 'string' && (h as { id: string }).id === rowId) as
        | Record<string, unknown>
        | undefined;
    if (!hole) {
        return { ok: false, message: 'Hole not found.' };
    }
    if (active) {
        delete hole.active;
    } else {
        hole.active = false;
    }
    return { ok: true };
}

export function addWalkablePolygon(data: Record<string, unknown>): { ok: true; id: string } | { ok: false; message: string } {
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
    const id = nextId('walk-', ids);
    const size = data.size as { width?: number; height?: number } | undefined;
    const cx = typeof size?.width === 'number' ? size.width / 2 : DEFAULT_W / 2;
    const cy = typeof size?.height === 'number' ? size.height / 2 : DEFAULT_H / 2;
    polys.push({
        id,
        active: true,
        points: defaultTriangle(cx, cy)
    });
    return { ok: true, id };
}

export function addWalkableHole(data: Record<string, unknown>, polygonId: string): { ok: true; id: string } | { ok: false; message: string } {
    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    const poly = polys.find((p) => typeof p.id === 'string' && (p.id as string) === polygonId);
    if (!poly) {
        return { ok: false, message: 'Parent polygon not found.' };
    }
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
    const id = nextId('hole-', ids);
    if (!Array.isArray(poly.holes)) {
        poly.holes = [];
    }
    const size = data.size as { width?: number; height?: number } | undefined;
    const cx = typeof size?.width === 'number' ? size.width / 2 : DEFAULT_W / 2;
    const cy = typeof size?.height === 'number' ? size.height / 2 : DEFAULT_H / 2;
    (poly.holes as Record<string, unknown>[]).push({
        id,
        active: true,
        points: defaultTriangle(cx, cy)
    });
    return { ok: true, id };
}

export function deleteWalkablePolygon(data: Record<string, unknown>, polygonId: string): void {
    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    wo.polygons = polys.filter((p) => !(typeof p.id === 'string' && (p.id as string) === polygonId));
}

export function deleteWalkableHole(data: Record<string, unknown>, polygonId: string, holeId: string): void {
    const wo = ensureWalkableRoot(data);
    const polys = wo.polygons as Record<string, unknown>[];
    const poly = polys.find((p) => typeof p.id === 'string' && (p.id as string) === polygonId);
    if (!poly || !Array.isArray(poly.holes)) {
        return;
    }
    poly.holes = (poly.holes as Record<string, unknown>[]).filter(
        (h) => !(h && typeof h.id === 'string' && (h.id as string) === holeId)
    );
}

function propsArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const p = data.props;
    return Array.isArray(p) ? (p as Record<string, unknown>[]) : [];
}

function setPropsArray(data: Record<string, unknown>, arr: Record<string, unknown>[]): void {
    data.props = arr;
}

/**
 * Updates `props[].animations[<animationTag>]` (loop / uniform frame duration).
 * Removes empty `animations` entries when nothing remains configured for that tag.
 */
export function updatePropAnimationFields(
    data: Record<string, unknown>,
    propId: string,
    animationTag: string,
    fields: { loop?: boolean; frameDuration?: number | null }
): { ok: true } | { ok: false; message: string } {
    const tagKey = animationTag.trim();
    if (!tagKey) {
        return { ok: false, message: 'Animation tag cannot be empty.' };
    }
    const props = propsArray(data);
    const prop = props.find((x) => typeof x.id === 'string' && (x.id as string) === propId);
    if (!prop) {
        return { ok: false, message: 'Prop not found.' };
    }

    let animsRaw = prop.animations;
    if (!animsRaw || typeof animsRaw !== 'object' || Array.isArray(animsRaw)) {
        animsRaw = {};
        prop.animations = animsRaw;
    }
    const anims = animsRaw as Record<string, unknown>;
    let clipRaw = anims[tagKey];
    if (!clipRaw || typeof clipRaw !== 'object' || Array.isArray(clipRaw)) {
        clipRaw = {};
        anims[tagKey] = clipRaw;
    }
    const clip = clipRaw as Record<string, unknown>;

    if (fields.loop !== undefined) {
        if (fields.loop) {
            clip.loop = true;
        } else {
            delete clip.loop;
        }
    }
    if (fields.frameDuration !== undefined) {
        if (fields.frameDuration === null || !Number.isFinite(fields.frameDuration) || fields.frameDuration <= 0) {
            delete clip.frameDuration;
        } else {
            clip.frameDuration = fields.frameDuration;
        }
    }

    const hasLoop = clip.loop === true;
    const hasFd = typeof clip.frameDuration === 'number' && Number.isFinite(clip.frameDuration);
    const reserved = new Set(['loop', 'frameDuration']);
    const hasOther = Object.keys(clip).some((k) => !reserved.has(k));

    if (!hasLoop && !hasFd && !hasOther) {
        delete anims[tagKey];
        if (Object.keys(anims).length === 0) {
            delete prop.animations;
        }
    }

    return { ok: true };
}

/**
 * Implicit per-clickable default when `defaultVerb` is omitted in JSON — matches engine
 * `DEFAULT_VERB_FALLBACK`. Writing this value from the Inspector omits the field.
 */
const DEFAULT_VERB_FALLBACK_ID = 'look';

function applyDefaultVerbPatch(target: Record<string, unknown>, verbId: string): void {
    const id = verbId.trim();
    if (id.length === 0 || id === DEFAULT_VERB_FALLBACK_ID) {
        delete target.defaultVerb;
    } else {
        target.defaultVerb = id;
    }
}

export function updatePropFields(
    data: Record<string, unknown>,
    propId: string,
    fields: {
        description?: string;
        visible?: boolean;
        clickable?: boolean;
        zIndex?: number;
        parallaxDepth?: number;
        alpha?: number;
        /** Aseprite frame tag currently shown for this prop. */
        tag?: string;
        /** Optional second root for `<root>-*` clip grouping (empty removes the key). */
        defaultAnimation?: string;
        /** Verb id invoked when an inputProfile slot resolves to `"defaultVerb"`. Empty / `"look"` omits. */
        defaultVerb?: string;
        /** Room-space Y; `null` clears. */
        baseline?: number | null;
        /** Sprite origin in room pixels. */
        x?: number;
        y?: number;
        /** Game cursor sheet tag; empty string removes from JSON. */
        activeCursorOverride?: string;
    }
): { ok: true } | { ok: false; message: string } {
    const props = propsArray(data);
    const prop = props.find((x) => typeof x.id === 'string' && (x.id as string) === propId);
    if (!prop) {
        return { ok: false, message: 'Prop not found.' };
    }
    if (fields.description !== undefined) {
        prop.description = fields.description;
    }
    if (fields.visible !== undefined) {
        prop.visible = fields.visible;
    }
    if (fields.clickable !== undefined) {
        prop.clickable = fields.clickable;
    }
    if (fields.zIndex !== undefined && Number.isFinite(fields.zIndex)) {
        prop.zIndex = fields.zIndex;
    }
    if (fields.parallaxDepth !== undefined && Number.isFinite(fields.parallaxDepth)) {
        prop.parallaxDepth = fields.parallaxDepth;
    }
    if (fields.alpha !== undefined && Number.isFinite(fields.alpha)) {
        prop.alpha = fields.alpha;
    }
    if (fields.tag !== undefined) {
        const t = fields.tag.trim();
        if (t.length === 0) {
            return { ok: false, message: 'Prop tag cannot be empty.' };
        }
        prop.tag = t;
    }
    if (fields.defaultAnimation !== undefined) {
        const d = fields.defaultAnimation.trim();
        if (d.length === 0) {
            delete prop.defaultAnimation;
        } else {
            prop.defaultAnimation = d;
        }
    }
    if (fields.defaultVerb !== undefined) {
        applyDefaultVerbPatch(prop, fields.defaultVerb);
    }
    if (fields.baseline !== undefined) {
        if (fields.baseline === null || !Number.isFinite(fields.baseline)) {
            delete prop.baseline;
        } else {
            prop.baseline = fields.baseline;
        }
    }
    if (fields.x !== undefined && Number.isFinite(fields.x)) {
        prop.x = Math.round(fields.x);
    }
    if (fields.y !== undefined && Number.isFinite(fields.y)) {
        prop.y = Math.round(fields.y);
    }
    if (fields.activeCursorOverride !== undefined) {
        const t = fields.activeCursorOverride.trim();
        if (t.length === 0) {
            delete prop.activeCursorOverride;
        } else {
            prop.activeCursorOverride = t;
        }
    }
    return { ok: true };
}

export function deleteProp(data: Record<string, unknown>, propId: string): void {
    setPropsArray(
        data,
        propsArray(data).filter((p) => !(typeof p.id === 'string' && (p.id as string) === propId))
    );
}

function hotspotsArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const h = data.hotspots;
    return Array.isArray(h) ? (h as Record<string, unknown>[]) : [];
}

export function updateHotspotFields(
    data: Record<string, unknown>,
    hotspotId: string,
    fields: {
        description?: string;
        active?: boolean;
        zIndex?: number;
        defaultVerb?: string;
        /** Room-space Y; `null` clears. */
        baseline?: number | null;
        /** Game cursor sheet tag; empty string removes from JSON. */
        activeCursorOverride?: string;
    }
): { ok: true } | { ok: false; message: string } {
    const list = hotspotsArray(data);
    const hs = list.find((x) => typeof x.id === 'string' && (x.id as string) === hotspotId);
    if (!hs) {
        return { ok: false, message: 'Hotspot not found.' };
    }
    if (fields.description !== undefined) {
        hs.description = fields.description;
    }
    if (fields.active !== undefined) {
        hs.active = fields.active;
    }
    if (fields.zIndex !== undefined && Number.isFinite(fields.zIndex)) {
        hs.zIndex = fields.zIndex;
    }
    if (fields.defaultVerb !== undefined) {
        applyDefaultVerbPatch(hs, fields.defaultVerb);
    }
    if (fields.baseline !== undefined) {
        if (fields.baseline === null || !Number.isFinite(fields.baseline)) {
            delete hs.baseline;
        } else {
            hs.baseline = fields.baseline;
        }
    }
    if (fields.activeCursorOverride !== undefined) {
        const t = fields.activeCursorOverride.trim();
        if (t.length === 0) {
            delete hs.activeCursorOverride;
        } else {
            hs.activeCursorOverride = t;
        }
    }
    return { ok: true };
}

export function deleteHotspot(data: Record<string, unknown>, hotspotId: string): void {
    data.hotspots = hotspotsArray(data).filter((h) => !(typeof h.id === 'string' && (h.id as string) === hotspotId));
}

function charactersArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const c = data.characters;
    return Array.isArray(c) ? (c as Record<string, unknown>[]) : [];
}

export function updateRoomCharacterFields(
    data: Record<string, unknown>,
    instanceId: string,
    fields: {
        x?: number;
        y?: number;
        visible?: boolean;
        zIndex?: number;
        initialFacing?: string;
        initialAnimation?: string;
    }
): { ok: true } | { ok: false; message: string } {
    const list = charactersArray(data);
    const ch = list.find((x) => typeof x.instanceId === 'string' && (x.instanceId as string) === instanceId);
    if (!ch) {
        return { ok: false, message: 'Character instance not found.' };
    }
    if (fields.x !== undefined && Number.isFinite(fields.x)) {
        ch.x = fields.x;
    }
    if (fields.y !== undefined && Number.isFinite(fields.y)) {
        ch.y = fields.y;
    }
    if (fields.visible !== undefined) {
        ch.visible = fields.visible;
    }
    if (fields.zIndex !== undefined && Number.isFinite(fields.zIndex)) {
        ch.zIndex = fields.zIndex;
    }
    if (fields.initialFacing !== undefined) {
        if (fields.initialFacing.length === 0) {
            delete ch.initialFacing;
        } else {
            ch.initialFacing = fields.initialFacing;
        }
    }
    if (fields.initialAnimation !== undefined) {
        if (fields.initialAnimation.length === 0) {
            delete ch.initialAnimation;
        } else {
            ch.initialAnimation = fields.initialAnimation;
        }
    }
    return { ok: true };
}

export function deleteRoomCharacter(data: Record<string, unknown>, instanceId: string): void {
    data.characters = charactersArray(data).filter(
        (c) => !(typeof c.instanceId === 'string' && (c.instanceId as string) === instanceId)
    );
}

function pointsArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const p = data.points;
    return Array.isArray(p) ? (p as Record<string, unknown>[]) : [];
}

export function updatePointFields(
    data: Record<string, unknown>,
    pointId: string,
    x: number,
    y: number
): { ok: true } | { ok: false; message: string } {
    const list = pointsArray(data);
    const pt = list.find((p) => typeof p.id === 'string' && (p.id as string) === pointId);
    if (!pt) {
        return { ok: false, message: 'Point not found.' };
    }
    pt.x = x;
    pt.y = y;
    return { ok: true };
}

export function deletePoint(data: Record<string, unknown>, pointId: string): void {
    if (!Array.isArray(data.points)) {
        return;
    }
    data.points = pointsArray(data).filter((p) => !(typeof p.id === 'string' && (p.id as string) === pointId));
}

function regionsArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const r = data.regions;
    return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
}

export function updateRegionWalkable(
    data: Record<string, unknown>,
    regionId: string,
    walkable: boolean
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    if (walkable) {
        delete reg.walkable;
    } else {
        reg.walkable = false;
    }
    return { ok: true };
}

export function updateRegionActive(
    data: Record<string, unknown>,
    regionId: string,
    active: boolean
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    reg.active = active;
    return { ok: true };
}

export function updateRegionScaleFields(
    data: Record<string, unknown>,
    regionId: string,
    scaleTop: number,
    scaleBottom: number
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    reg.scaleTop = scaleTop;
    reg.scaleBottom = scaleBottom;
    return { ok: true };
}

export function updateRegionScaleEnabled(
    data: Record<string, unknown>,
    regionId: string,
    scaleEnabled: boolean
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    if (scaleEnabled) {
        reg.scaleEnabled = true;
    } else {
        delete reg.scaleEnabled;
    }
    return { ok: true };
}

export function updateRegionScaleWalkSpeed(
    data: Record<string, unknown>,
    regionId: string,
    scaleWalkSpeed: boolean
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    if (scaleWalkSpeed) {
        reg.scaleWalkSpeed = true;
    } else {
        delete reg.scaleWalkSpeed;
    }
    return { ok: true };
}

export function updateRegionTintEnabled(
    data: Record<string, unknown>,
    regionId: string,
    tintEnabled: boolean
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    if (tintEnabled) {
        reg.tintEnabled = true;
    } else {
        delete reg.tintEnabled;
    }
    return { ok: true };
}

export function updateRegionTintFields(
    data: Record<string, unknown>,
    regionId: string,
    tintRaw: string,
    tintAlpha: number
): { ok: true } | { ok: false; message: string } {
    const reg = regionsArray(data).find((x) => typeof x.id === 'string' && (x.id as string) === regionId);
    if (!reg) {
        return { ok: false, message: 'Region not found.' };
    }
    const trimmed = tintRaw.trim();
    if (!trimmed) {
        delete reg.tint;
        delete reg.tintAlpha;
        return { ok: true };
    }
    let hex = trimmed;
    if (!hex.startsWith('#')) {
        hex = `#${hex}`;
    }
    reg.tint = hex.toLowerCase();
    if (!Number.isFinite(tintAlpha)) {
        delete reg.tintAlpha;
        return { ok: true };
    }
    const a = Math.max(0, Math.min(1, tintAlpha));
    if (a >= 1 - 1e-9) {
        delete reg.tintAlpha;
    } else {
        reg.tintAlpha = a;
    }
    return { ok: true };
}

export function deleteRegion(data: Record<string, unknown>, regionId: string): void {
    data.regions = regionsArray(data).filter((r) => !(typeof r.id === 'string' && (r.id as string) === regionId));
}

export function updateCharacterFields(
    data: Record<string, unknown>,
    fields: {
        name?: string;
        walkSpeed?: number;
        clickable?: boolean;
        movable?: boolean;
        description?: string;
        walkToPoint?: { x: number; y: number } | null;
        talkPoint?: { x: number; y: number } | null;
        feet?: { x: number; y: number } | null;
        defaultVerb?: string;
        /** Game cursor sheet tag while hovering this clickable character; empty removes from JSON. */
        activeCursorOverride?: string;
        /** Hex speech colour for speaking-text GUI; empty or default `#ffffff` removes from JSON. */
        speechColor?: string;
    }
): { ok: true } {
    if (fields.name !== undefined) {
        data.name = fields.name;
    }
    if (fields.walkSpeed !== undefined && Number.isFinite(fields.walkSpeed)) {
        data.walkSpeed = fields.walkSpeed;
    }
    if (fields.clickable !== undefined) {
        data.clickable = fields.clickable;
    }
    if (fields.movable !== undefined) {
        if (fields.movable) {
            delete data.movable;
        } else {
            data.movable = false;
        }
    }
    if (fields.description !== undefined) {
        data.description = fields.description;
    }
    if (fields.defaultVerb !== undefined) {
        applyDefaultVerbPatch(data, fields.defaultVerb);
    }
    if (fields.walkToPoint !== undefined) {
        if (fields.walkToPoint) {
            data.walkToPoint = fields.walkToPoint;
        } else {
            delete data.walkToPoint;
        }
    }
    if (fields.talkPoint !== undefined) {
        if (fields.talkPoint) {
            data.talkPoint = fields.talkPoint;
        } else {
            delete data.talkPoint;
        }
    }
    if (fields.feet !== undefined) {
        if (fields.feet) {
            data.feet = fields.feet;
        } else {
            delete data.feet;
        }
    }
    if (fields.activeCursorOverride !== undefined) {
        const t = fields.activeCursorOverride.trim();
        if (t.length === 0) {
            delete data.activeCursorOverride;
        } else {
            data.activeCursorOverride = t;
        }
    }
    if (fields.speechColor !== undefined) {
        const c = fields.speechColor.trim().toLowerCase();
        if (c.length === 0 || c === '#ffffff') {
            delete data.speechColor;
        } else {
            data.speechColor = c;
        }
    }
    return { ok: true };
}

export function updateCharacterAnimationFields(
    data: Record<string, unknown>,
    animationId: string,
    fields: { loop?: boolean; frameDuration?: number | null }
): { ok: true } | { ok: false; message: string } {
    const animationsRaw = data.animations;
    if (!animationsRaw || typeof animationsRaw !== 'object' || Array.isArray(animationsRaw)) {
        return { ok: false, message: 'Character has no animations object.' };
    }
    const animations = animationsRaw as Record<string, unknown>;
    const entryRaw = animations[animationId];
    if (!entryRaw || typeof entryRaw !== 'object' || Array.isArray(entryRaw)) {
        return { ok: false, message: 'Animation entry not found.' };
    }
    const entry = entryRaw as Record<string, unknown>;
    if (fields.loop !== undefined) {
        entry.loop = fields.loop;
    }
    if (fields.frameDuration !== undefined) {
        if (fields.frameDuration === null) {
            delete entry.frameDuration;
        } else if (Number.isFinite(fields.frameDuration)) {
            entry.frameDuration = fields.frameDuration;
        }
    }
    return { ok: true };
}

export function updateGuiFields(
    data: Record<string, unknown>,
    fields: {
        name?: string;
        description?: string;
        rootVisibleAtLoad?: boolean;
        modal?: boolean;
        zIndex?: number;
    }
): { ok: true } {
    if (fields.name !== undefined) {
        data.name = fields.name;
    }
    if (fields.description !== undefined) {
        data.description = fields.description;
    }
    if (fields.rootVisibleAtLoad !== undefined) {
        data.visible = fields.rootVisibleAtLoad;
    }
    if (fields.modal !== undefined) {
        if (fields.modal) {
            data.modal = true;
        } else {
            delete data.modal;
        }
    }
    if (fields.zIndex !== undefined) {
        if (fields.zIndex !== 0) {
            data.zIndex = fields.zIndex;
        } else {
            delete data.zIndex;
        }
    }
    return { ok: true };
}

export function updateGuiControlPayload(
    data: Record<string, unknown>,
    controlIndex: number,
    payload: string
): { ok: true } | { ok: false; message: string } {
    const controls = data.controls;
    if (!Array.isArray(controls)) {
        return { ok: false, message: 'GUI has no controls array.' };
    }
    if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
        return { ok: false, message: 'Control index out of range.' };
    }
    try {
        const parsed = JSON.parse(payload) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, message: 'Control payload must be a JSON object.' };
        }
        controls[controlIndex] = parsed;
        return { ok: true };
    } catch {
        return { ok: false, message: 'Control payload is not valid JSON.' };
    }
}

function pruneEmptyButtonStates(states: Record<string, unknown>): void {
    for (const k of ['hover', 'pressed', 'disabled'] as const) {
        if (states[k] === '' || states[k] === undefined) {
            delete states[k];
        }
    }
}

function mergeSliderStatesPatch(prev: Record<string, unknown>, incoming: Record<string, unknown>): void {
    for (const [sk, sv] of Object.entries(incoming)) {
        if (sv === null) {
            delete prev[sk];
            continue;
        }
        if (typeof sv === 'object' && !Array.isArray(sv)) {
            const sub =
                prev[sk] && typeof prev[sk] === 'object' && !Array.isArray(prev[sk])
                    ? { ...(prev[sk] as Record<string, unknown>) }
                    : {};
            for (const [hk, hv] of Object.entries(sv as Record<string, unknown>)) {
                if (hv === null || hv === '') {
                    delete sub[hk];
                } else {
                    sub[hk] = hv;
                }
            }
            if (Object.keys(sub).length === 0) {
                delete prev[sk];
            } else {
                prev[sk] = sub;
            }
        }
    }
}

function pruneEmptySliderStates(states: Record<string, unknown>): void {
    for (const group of ['hover', 'disabled'] as const) {
        const g = states[group];
        if (g && typeof g === 'object' && !Array.isArray(g)) {
            const sub = g as Record<string, unknown>;
            for (const k of Object.keys(sub)) {
                if (sub[k] === '' || sub[k] === undefined) {
                    delete sub[k];
                }
            }
            if (Object.keys(sub).length === 0) {
                delete states[group];
            }
        }
    }
}

function pruneEmptyCheckboxStates(states: Record<string, unknown>): void {
    for (const k of [
        'uncheckedHover',
        'checked',
        'checkedHover',
        'disabled',
        'disabledChecked'
    ] as const) {
        if (states[k] === '' || states[k] === undefined) {
            delete states[k];
        }
    }
}

const GUI_OUTLINE_SIDES = new Set([
    'allSides',
    'topLeft',
    'top',
    'topRight',
    'left',
    'right',
    'bottomLeft',
    'bottom',
    'bottomRight'
]);

function mergeGuiTextOutlinePatch(row: Record<string, unknown>, incoming: Record<string, unknown>): void {
    const prev =
        row.textOutline && typeof row.textOutline === 'object' && !Array.isArray(row.textOutline)
            ? { ...(row.textOutline as Record<string, unknown>) }
            : {};
    for (const [sk, sv] of Object.entries(incoming)) {
        if (sv === null || sv === undefined) {
            delete prev[sk];
        } else {
            prev[sk] = sv;
        }
    }
    if (Object.keys(prev).length === 0) {
        delete row.textOutline;
    } else {
        row.textOutline = prev;
    }
}

function normalizeGuiTextOutlineOnControlRow(row: Record<string, unknown>): void {
    if (row.type !== 'text' && row.type !== 'button' && row.type !== 'textInput') {
        return;
    }
    const raw = row.textOutline;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return;
    }
    const o = raw as Record<string, unknown>;
    if (o.enabled !== true) {
        o.enabled = false;
        row.textOutline = o;
        return;
    }
    const sides = o.sides;
    if (typeof sides === 'string' && !GUI_OUTLINE_SIDES.has(sides)) {
        delete o.sides;
    } else if (sides === 'allSides') {
        delete o.sides;
    }
    const th = o.thickness;
    if (typeof th === 'number' && Number.isFinite(th)) {
        const ti = Math.max(1, Math.trunc(th));
        if (ti <= 1) {
            delete o.thickness;
        } else {
            o.thickness = ti;
        }
    } else {
        delete o.thickness;
    }
    const al = o.alpha;
    if (typeof al === 'number' && Number.isFinite(al)) {
        const a = Math.min(1, Math.max(0, al));
        if (a >= 1) {
            delete o.alpha;
        } else {
            o.alpha = a;
        }
    } else {
        delete o.alpha;
    }
    if (typeof o.color === 'string' && o.color.trim().length === 0) {
        delete o.color;
    }
    row.textOutline = o;
}

/**
 * Shallow-merge fields into `controls[controlIndex]`. Use `null` as a patch value to remove a key.
 * For `button` controls, `states` is deep-merged the same way.
 */
export function updateGuiControlPatch(
    data: Record<string, unknown>,
    controlIndex: number,
    patch: Record<string, unknown>
): { ok: true } | { ok: false; message: string } {
    const controls = data.controls;
    if (!Array.isArray(controls)) {
        return { ok: false, message: 'GUI has no controls array.' };
    }
    if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
        return { ok: false, message: 'Control index out of range.' };
    }
    const cur = controls[controlIndex];
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
        return { ok: false, message: 'Invalid control entry.' };
    }
    const row = cur as Record<string, unknown>;
    const patchKeys = new Set(Object.keys(patch));

    for (const [k, v] of Object.entries(patch)) {
        if (k === 'states' && v && typeof v === 'object' && !Array.isArray(v)) {
            const prev =
                row.states && typeof row.states === 'object' && !Array.isArray(row.states)
                    ? { ...(row.states as Record<string, unknown>) }
                    : {};
            const incoming = v as Record<string, unknown>;
            for (const [sk, sv] of Object.entries(incoming)) {
                if (sv === null || sv === '') {
                    delete prev[sk];
                } else {
                    prev[sk] = sv;
                }
            }
            if (row.type === 'slider') {
                mergeSliderStatesPatch(prev, incoming);
                pruneEmptySliderStates(prev);
            } else if (row.type === 'checkbox') {
                pruneEmptyCheckboxStates(prev);
            } else {
                pruneEmptyButtonStates(prev);
            }
            if (Object.keys(prev).length === 0) {
                delete row.states;
            } else {
                row.states = prev;
            }
            continue;
        }
        if (k === 'textColorStates' && v && typeof v === 'object' && !Array.isArray(v)) {
            const prev =
                row.textColorStates && typeof row.textColorStates === 'object' && !Array.isArray(row.textColorStates)
                    ? { ...(row.textColorStates as Record<string, unknown>) }
                    : {};
            const incoming = v as Record<string, unknown>;
            for (const [sk, sv] of Object.entries(incoming)) {
                if (sv === null || sv === '') {
                    delete prev[sk];
                } else {
                    prev[sk] = sv;
                }
            }
            pruneEmptyButtonStates(prev);
            if (Object.keys(prev).length === 0) {
                delete row.textColorStates;
            } else {
                row.textColorStates = prev;
            }
            continue;
        }
        if (k === 'backgroundColorStates' && v && typeof v === 'object' && !Array.isArray(v)) {
            const prev =
                row.backgroundColorStates &&
                typeof row.backgroundColorStates === 'object' &&
                !Array.isArray(row.backgroundColorStates)
                    ? { ...(row.backgroundColorStates as Record<string, unknown>) }
                    : {};
            const incoming = v as Record<string, unknown>;
            for (const [sk, sv] of Object.entries(incoming)) {
                if (sv === null || sv === '') {
                    delete prev[sk];
                } else {
                    prev[sk] = sv;
                }
            }
            pruneEmptyButtonStates(prev);
            if (Object.keys(prev).length === 0) {
                delete row.backgroundColorStates;
            } else {
                row.backgroundColorStates = prev;
            }
            continue;
        }
        if (k === 'textOutline' && v && typeof v === 'object' && !Array.isArray(v)) {
            mergeGuiTextOutlinePatch(row, v as Record<string, unknown>);
            continue;
        }
        if (k === 'sliceNames' && v && typeof v === 'object' && !Array.isArray(v)) {
            const prev =
                row.sliceNames && typeof row.sliceNames === 'object' && !Array.isArray(row.sliceNames)
                    ? { ...(row.sliceNames as Record<string, unknown>) }
                    : {};
            const incoming = v as Record<string, unknown>;
            for (const [sk, sv] of Object.entries(incoming)) {
                if (sv === null || sv === '') {
                    delete prev[sk];
                } else {
                    prev[sk] = sv;
                }
            }
            row.sliceNames = prev;
            continue;
        }
        if (v === null) {
            delete row[k];
        } else {
            row[k] = v;
        }
    }

    if (row.type === 'image') {
        const legacy = row.display;
        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
            const d = legacy as Record<string, unknown>;
            if (!patchKeys.has('tag') && typeof d.tag === 'string') {
                row.tag = d.tag;
            }
            if (!patchKeys.has('backgroundAnchor')) {
                const a = d.backgroundAnchor;
                if (a === 'center' || a === 'screen' || a === 'top-left') {
                    row.backgroundAnchor = a;
                }
            }
            delete row.display;
        }
        const t = row.tag;
        if (t === '' || t === undefined) {
            delete row.tag;
        }
        const a = row.backgroundAnchor;
        if (a === '' || a === undefined || a === 'top-left') {
            delete row.backgroundAnchor;
        }
    }

    if (row.type === 'nineSliceImage') {
        const legacy = row.display;
        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
            const d = legacy as Record<string, unknown>;
            if (!patchKeys.has('tag') && typeof d.tag === 'string') {
                row.tag = d.tag;
            }
            if (!patchKeys.has('backgroundAnchor')) {
                const a = d.backgroundAnchor;
                if (a === 'center' || a === 'screen' || a === 'top-left') {
                    row.backgroundAnchor = a;
                }
            }
            delete row.display;
        }
        const t = row.tag;
        if (t === '' || t === undefined) {
            delete row.tag;
        }
        const a = row.backgroundAnchor;
        if (a === '' || a === undefined || a === 'top-left') {
            delete row.backgroundAnchor;
        }
        const w = row.width as number;
        const h = row.height as number;
        if (!Number.isFinite(w) || w < 1) {
            row.width = 1;
        }
        if (!Number.isFinite(h) || h < 1) {
            row.height = 1;
        }
        const sn = row.sliceNames;
        if (!sn || typeof sn !== 'object' || Array.isArray(sn)) {
            row.sliceNames = {};
        }
    }

    if (row.type === 'button') {
        const a = row.backgroundAnchor;
        if (a !== 'center' && a !== 'screen') {
            row.backgroundAnchor = 'top-left';
        }
        if (row.states && typeof row.states === 'object' && !Array.isArray(row.states)) {
            pruneEmptyButtonStates(row.states as Record<string, unknown>);
            if (Object.keys(row.states as Record<string, unknown>).length === 0) {
                delete row.states;
            }
        }
        if (row.textColorStates && typeof row.textColorStates === 'object' && !Array.isArray(row.textColorStates)) {
            pruneEmptyButtonStates(row.textColorStates as Record<string, unknown>);
            if (Object.keys(row.textColorStates as Record<string, unknown>).length === 0) {
                delete row.textColorStates;
            }
        }
        if (typeof row.backgroundColor === 'string' && row.backgroundColor.trim().length === 0) {
            delete row.backgroundColor;
        }
        if (
            row.backgroundColorStates &&
            typeof row.backgroundColorStates === 'object' &&
            !Array.isArray(row.backgroundColorStates)
        ) {
            pruneEmptyButtonStates(row.backgroundColorStates as Record<string, unknown>);
            if (Object.keys(row.backgroundColorStates as Record<string, unknown>).length === 0) {
                delete row.backgroundColorStates;
            }
        }
    }

    if (row.type === 'checkbox') {
        const a = row.backgroundAnchor;
        if (a !== 'center' && a !== 'screen') {
            row.backgroundAnchor = 'top-left';
        }
        if (row.checked === false || row.checked === undefined) {
            delete row.checked;
        }
        if (row.enabled === true || row.enabled === undefined) {
            delete row.enabled;
        }
        if (typeof row.tag === 'string' && row.tag.trim().length === 0) {
            delete row.tag;
        }
        if (row.states && typeof row.states === 'object' && !Array.isArray(row.states)) {
            pruneEmptyCheckboxStates(row.states as Record<string, unknown>);
            if (Object.keys(row.states as Record<string, unknown>).length === 0) {
                delete row.states;
            }
        }
        const w = row.width as number;
        const h = row.height as number;
        if (!Number.isFinite(w) || w < 1) {
            row.width = 1;
        }
        if (!Number.isFinite(h) || h < 1) {
            row.height = 1;
        }
    }

    if (row.type === 'slider') {
        const a = row.backgroundAnchor;
        if (a !== 'center' && a !== 'screen') {
            row.backgroundAnchor = 'top-left';
        }
        if (row.enabled === true || row.enabled === undefined) {
            delete row.enabled;
        }
        if (typeof row.trackTag === 'string' && row.trackTag.trim().length === 0) {
            delete row.trackTag;
        }
        if (typeof row.handleTag === 'string' && row.handleTag.trim().length === 0) {
            delete row.handleTag;
        }
        if (row.states && typeof row.states === 'object' && !Array.isArray(row.states)) {
            pruneEmptySliderStates(row.states as Record<string, unknown>);
            if (Object.keys(row.states as Record<string, unknown>).length === 0) {
                delete row.states;
            }
        }
        const w = row.width as number;
        const h = row.height as number;
        if (!Number.isFinite(w) || w < 1) {
            row.width = 1;
        }
        if (!Number.isFinite(h) || h < 1) {
            row.height = 1;
        }
    }

    if (row.type === 'textInput') {
        if (row.enabled === true || row.enabled === undefined) {
            delete row.enabled;
        }
        if (typeof row.placeholder === 'string' && row.placeholder.trim().length === 0) {
            delete row.placeholder;
        }
        for (const colorKey of [
            'backgroundColor',
            'outlineColor',
            'caretColor',
            'hoverBackgroundColor',
            'focusedOutlineColor'
        ] as const) {
            const v = row[colorKey];
            if (typeof v === 'string' && v.trim().length === 0) {
                delete row[colorKey];
            }
        }
        const ml = row.maxLength;
        if (ml === null || ml === undefined) {
            delete row.maxLength;
        } else if (typeof ml === 'number' && Number.isFinite(ml)) {
            const mli = Math.max(1, Math.trunc(ml));
            row.maxLength = mli;
        }
        const w = row.width as number;
        const h = row.height as number;
        if (!Number.isFinite(w) || w < 1) {
            row.width = 1;
        }
        if (!Number.isFinite(h) || h < 1) {
            row.height = 1;
        }
    }

    if (row.type === 'listBox') {
        if (row.enabled === true || row.enabled === undefined) {
            delete row.enabled;
        }
        const w = row.width as number;
        const h = row.height as number;
        if (!Number.isFinite(w) || w < 1) {
            row.width = 1;
        }
        if (!Number.isFinite(h) || h < 1) {
            row.height = 1;
        }
        const rc = row.rowCount as number;
        if (!Number.isFinite(rc) || rc < 1) {
            row.rowCount = 1;
        } else {
            row.rowCount = Math.trunc(rc);
        }
        if (row.rowHeight === null || row.rowHeight === undefined) {
            delete row.rowHeight;
        } else if (typeof row.rowHeight === 'number' && Number.isFinite(row.rowHeight)) {
            row.rowHeight = Math.max(1, Math.trunc(row.rowHeight));
        } else {
            delete row.rowHeight;
        }
        if (row.rowPadding === null || row.rowPadding === undefined) {
            delete row.rowPadding;
        } else if (typeof row.rowPadding === 'number' && Number.isFinite(row.rowPadding)) {
            row.rowPadding = Math.max(0, Math.trunc(row.rowPadding));
        } else {
            delete row.rowPadding;
        }
    }

    if (row.type === 'trigger') {
        /** `active` defaults to true at runtime; omit when true to keep JSON clean (matches `enabled` on buttons). */
        if (row.active === true || row.active === undefined) {
            delete row.active;
        }
        if (typeof row.name === 'string' && row.name.trim().length === 0) {
            delete row.name;
        }
    }

    if (row.type === 'grid') {
        const rw = row.rows as number;
        const cl = row.columns as number;
        if (!Number.isFinite(rw) || rw < 1) {
            row.rows = 1;
        }
        if (!Number.isFinite(cl) || cl < 1) {
            row.columns = 1;
        }
        if (row.width === null || row.width === undefined) {
            delete row.width;
        }
        if (row.height === null || row.height === undefined) {
            delete row.height;
        }
    }

    if (row.gridPlacement && typeof row.gridPlacement === 'object' && !Array.isArray(row.gridPlacement)) {
        const g = row.gridPlacement as Record<string, unknown>;
        const gid = typeof g.gridControlId === 'string' ? g.gridControlId.trim() : '';
        if (!gid) {
            delete row.gridPlacement;
        } else {
            g.gridControlId = gid;
            if (g.rowspan === 1 || g.rowspan === undefined) {
                delete g.rowspan;
            }
            if (g.colspan === 1 || g.colspan === undefined) {
                delete g.colspan;
            }
            if (g.align === '' || g.align === undefined) {
                delete g.align;
            }
            if (g.offsetX === 0 || g.offsetX === undefined || g.offsetX === null) {
                delete g.offsetX;
            }
            if (g.offsetY === 0 || g.offsetY === undefined || g.offsetY === null) {
                delete g.offsetY;
            }
        }
    }

    if (row.type === 'text' || row.type === 'button' || row.type === 'textInput') {
        normalizeGuiTextOutlineOnControlRow(row);
    }

    return { ok: true };
}

export function updateInventoryFields(
    data: Record<string, unknown>,
    fields: {
        name?: string;
        description?: string;
        stackable?: boolean;
        defaultAnimation?: string;
        cursorAnimation?: string;
        asepriteMode?: true | 'shared';
        defaultVerb?: string;
    }
): { ok: true } {
    if (fields.name !== undefined) {
        data.name = fields.name;
    }
    if (fields.description !== undefined) {
        data.description = fields.description;
    }
    if (fields.stackable !== undefined) {
        data.stackable = fields.stackable;
    }
    if (fields.defaultAnimation !== undefined) {
        if (fields.defaultAnimation.trim().length === 0) {
            delete data.defaultAnimation;
        } else {
            data.defaultAnimation = fields.defaultAnimation.trim();
        }
    }
    if (fields.cursorAnimation !== undefined) {
        if (fields.cursorAnimation.trim().length === 0) {
            delete data.cursorAnimation;
        } else {
            data.cursorAnimation = fields.cursorAnimation.trim();
        }
    }
    if (fields.asepriteMode !== undefined) {
        const display =
            data.display && typeof data.display === 'object' && !Array.isArray(data.display)
                ? (data.display as Record<string, unknown>)
                : {};
        display.aseprite = fields.asepriteMode;
        data.display = display;
    }
    const disp = data.display;
    if (disp && typeof disp === 'object' && !Array.isArray(disp)) {
        delete (disp as Record<string, unknown>).tag;
    }
    if (fields.defaultVerb !== undefined) {
        applyDefaultVerbPatch(data, fields.defaultVerb);
    }
    return { ok: true };
}

export function updateInventoryVerbs(
    data: Record<string, unknown>,
    verbs: string[]
): { ok: true } {
    const onVerb: Record<string, boolean> = {};
    for (const verbId of verbs) {
        const id = verbId.trim();
        if (id.length > 0) {
            onVerb[id] = true;
        }
    }
    data.onVerb = onVerb;
    return { ok: true };
}

export function updateInventoryAnimationFields(
    data: Record<string, unknown>,
    animationId: string,
    fields: { loop?: boolean; frameDuration?: number | null }
): { ok: true } | { ok: false; message: string } {
    if (!animationId.trim()) {
        return { ok: false, message: 'Animation id cannot be empty.' };
    }
    let animationsRaw = data.animations;
    if (!animationsRaw || typeof animationsRaw !== 'object' || Array.isArray(animationsRaw)) {
        animationsRaw = {};
        data.animations = animationsRaw;
    }
    const animations = animationsRaw as Record<string, unknown>;
    let entryRaw = animations[animationId];
    if (!entryRaw || typeof entryRaw !== 'object' || Array.isArray(entryRaw)) {
        entryRaw = {};
        animations[animationId] = entryRaw;
    }
    const entry = entryRaw as Record<string, unknown>;
    if (fields.loop !== undefined) {
        entry.loop = fields.loop;
    }
    if (fields.frameDuration !== undefined) {
        if (fields.frameDuration === null) {
            delete entry.frameDuration;
        } else if (Number.isFinite(fields.frameDuration)) {
            entry.frameDuration = fields.frameDuration;
        }
    }
    return { ok: true };
}

function readDialogOptionsArray(data: Record<string, unknown>): Record<string, unknown>[] {
    const raw = data.options;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((o) => o && typeof o === 'object' && !Array.isArray(o)) as Record<string, unknown>[];
}

export function updateDialogMetaFields(
    data: Record<string, unknown>,
    fields: { displayName?: string; guiId?: string }
): { ok: true } {
    if (fields.displayName !== undefined) {
        if (fields.displayName.trim().length > 0) {
            data.displayName = fields.displayName.trim();
        } else {
            delete data.displayName;
        }
    }
    if (fields.guiId !== undefined) {
        const g = fields.guiId.trim();
        if (g.length === 0 || g === 'dialog') {
            delete data.guiId;
        } else {
            data.guiId = g;
        }
    }
    return { ok: true };
}

export function updateDialogOptionAtIndex(
    data: Record<string, unknown>,
    index: number,
    fields: { id?: string; text?: string; enabled?: boolean; used?: boolean; say?: boolean }
): { ok: true } | { ok: false; message: string } {
    const opts = readDialogOptionsArray(data);
    if (index < 0 || index >= opts.length) {
        return { ok: false, message: 'Invalid option index.' };
    }
    const o = opts[index]!;
    if (fields.id !== undefined) {
        const id = fields.id.trim();
        if (!id) {
            return { ok: false, message: 'Option id cannot be empty.' };
        }
        o.id = id;
    }
    if (fields.text !== undefined) {
        o.text = fields.text;
    }
    if (fields.enabled !== undefined) {
        if (fields.enabled) {
            delete o.enabled;
        } else {
            o.enabled = false;
        }
    }
    if (fields.used !== undefined) {
        if (fields.used) {
            o.used = true;
        } else {
            delete o.used;
        }
    }
    if (fields.say !== undefined) {
        if (fields.say) {
            delete o.say;
        } else {
            o.say = false;
        }
    }
    data.options = opts;
    return { ok: true };
}

export function addDialogOptionRow(data: Record<string, unknown>): { ok: true } {
    const opts = readDialogOptionsArray(data);
    const ids = new Set(opts.map((x) => String(x.id ?? '')));
    const id = nextId('line', ids);
    opts.push({ id, text: 'New line.', enabled: true });
    data.options = opts;
    return { ok: true };
}

/** Move one dialog option from `fromIndex` to `toIndex` (indices in the JSON array before the move). */
export function reorderDialogOptionAtIndex(
    data: Record<string, unknown>,
    fromIndex: number,
    toIndex: number
): { ok: true } | { ok: false; message: string } {
    const opts = readDialogOptionsArray(data);
    const n = opts.length;
    if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) {
        return { ok: false, message: 'Invalid reorder indices.' };
    }
    if (fromIndex === toIndex) {
        return { ok: true };
    }
    const [row] = opts.splice(fromIndex, 1);
    opts.splice(toIndex, 0, row!);
    data.options = opts;
    return { ok: true };
}

export function removeDialogOptionAtIndex(
    data: Record<string, unknown>,
    index: number
): { ok: true } | { ok: false; message: string } {
    const opts = readDialogOptionsArray(data);
    if (index < 0 || index >= opts.length) {
        return { ok: false, message: 'Invalid option index.' };
    }
    if (opts.length <= 1) {
        return { ok: false, message: 'Dialogs need at least one option.' };
    }
    opts.splice(index, 1);
    data.options = opts;
    return { ok: true };
}
