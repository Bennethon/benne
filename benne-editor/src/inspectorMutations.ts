import * as vscode from 'vscode';
import { formatJson } from './roomScaffolding';
import { readPngDimensions } from './inspectorPngDimensions';
import { readRoomJsonText } from './inspectorStateBuilder';

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

export async function writeRoomJson(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, formatJson(data));
}

export async function writeDataJson(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, formatJson(data));
}

export async function loadRoomData(uri: vscode.Uri): Promise<Record<string, unknown> | null> {
    try {
        const text = await readRoomJsonText(uri);
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
    fields: { description?: string; active?: boolean; zIndex?: number; defaultVerb?: string }
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

export function deleteRegion(data: Record<string, unknown>, regionId: string): void {
    data.regions = regionsArray(data).filter((r) => !(typeof r.id === 'string' && (r.id as string) === regionId));
}

export function updateCharacterFields(
    data: Record<string, unknown>,
    fields: {
        name?: string;
        walkSpeed?: number;
        clickable?: boolean;
        description?: string;
        walkToPoint?: { x: number; y: number } | null;
        talkPoint?: { x: number; y: number } | null;
        feet?: { x: number; y: number } | null;
        defaultVerb?: string;
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
    fields: { name?: string; description?: string; rootVisibleAtLoad?: boolean }
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
            pruneEmptyButtonStates(prev);
            if (Object.keys(prev).length === 0) {
                delete row.states;
            } else {
                row.states = prev;
            }
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
