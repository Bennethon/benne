import * as vscode from 'vscode';
import { tagBelongsToRootSet } from './asepriteTagFamily';
import {
    characterIdFromRoomDefinition,
    DEFAULT_GAME_VERBS,
    getCharacterIdFromCharacterJsonUri,
    getDialogIdFromDialogJsonUri,
    getGuiIdFromGuiJsonUri,
    getInventoryIdFromInventoryJsonUri,
    getRoomIdFromRoomJsonUri,
    readCharacterHooks,
    type GameConfigVerbEntry,
    readGameConfigVerbs,
    resolveGuiAsepriteSheetForTags,
    resolvePerItemInventoryAsepriteSheet,
    resolveRoomAsepriteSheetForProps,
    resolveSharedInventoryAsepriteSheet,
    listInventoryDefinitions,
    readRoomHotspots,
    readRoomProps,
    type RoomHotspotListEntry,
    type RoomPropEntry
} from './gameDiscovery';
import { readPngDimensions } from './inspectorPngDimensions';
import {
    buildInventoryVerbChips,
    buildCharacterVerbChips,
    buildHotspotVerbChips,
    buildPropVerbChips,
    buildRoomCharacterVerbChips,
    type InspectorVerbChip
} from './verbInspectorModel';
import { readConfiguredVerbIdSet } from './verbHandlerPresence';

export type InspectorWalkableRow = {
    kind: 'polygon' | 'hole';
    polygonId: string;
    holeId?: string;
    id: string;
    active: boolean;
};

export type InspectorPropAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

export type InspectorPropCard = {
    id: string;
    tag?: string;
    /** Optional second root for `<root>-*` discovery; empty when unset in JSON. */
    defaultAnimation: string;
    /** Per Aseprite tag on the room sheet (JSON + sheet-derived). */
    animations: InspectorPropAnimationCard[];
    description: string;
    visible: boolean;
    clickable: boolean;
    zIndex: number;
    /** Room-space Y for draw sorting; `null` when omitted in JSON. */
    baseline: number | null;
    parallaxDepth: number;
    alpha: number;
    verbs: InspectorVerbChip[];
    /** Effective defaultVerb (authored; falls back to `"look"` when omitted). */
    defaultVerb: string;
    /** Game-config verbs (minus `walkTo`) available in the Default verb dropdown. */
    availableVerbs: GameConfigVerbEntry[];
};

export type InspectorHotspotCard = {
    id: string;
    description: string;
    active: boolean;
    zIndex: number;
    /** Room-space Y for draw sorting; `null` when omitted in JSON. */
    baseline: number | null;
    verbs: InspectorVerbChip[];
    defaultVerb: string;
    availableVerbs: GameConfigVerbEntry[];
};

export type InspectorCharacterCard = {
    instanceId: string;
    characterId: string;
    definition: string;
    x: number;
    y: number;
    visible: boolean;
    zIndex: number;
    initialFacing?: string;
    initialAnimation?: string;
    characterClickable: boolean;
    characterJsonUri: string;
    verbs: InspectorVerbChip[];
    /**
     * Effective defaultVerb read from the character's own JSON (per-definition). The room-character
     * card surfaces it read-only — edit it from the standalone character Inspector.
     */
    defaultVerb: string;
    availableVerbs: GameConfigVerbEntry[];
};

export type InspectorPointCard = { id: string; x: number; y: number };

export type InspectorRegionCard = {
    id: string;
    active: boolean;
    pointCount: number;
    scaleTop: number;
    scaleBottom: number;
    scaleWalkSpeed: boolean;
};

export type InspectorRoomState = {
    kind: 'room';
    rev: number;
    roomJsonUri: string;
    roomId: string;
    /** Inventory definition ids under `src/game/inventory/` (for Inv scaffold branches). */
    inventoryItemIds: string[];
    displayName: string;
    size: { width: number; height: number } | null;
    scrollBounds: { x: number; y: number; width: number; height: number } | null;
    backgroundImageRelative: string | null;
    canFitBackground: boolean;
    walkableRows: InspectorWalkableRow[];
    props: InspectorPropCard[];
    hotspots: InspectorHotspotCard[];
    characters: InspectorCharacterCard[];
    points: InspectorPointCard[];
    regions: InspectorRegionCard[];
    expanded: { entity: string; id: string } | null;
};

export type InspectorEmptyState = { kind: 'empty'; message: string };

export type InspectorCharacterAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

export type InspectorCharacterState = {
    kind: 'character';
    rev: number;
    characterJsonUri: string;
    characterId: string;
    inventoryItemIds: string[];
    name: string;
    walkSpeed: number;
    clickable: boolean;
    description: string;
    walkToPoint: { x: number; y: number } | null;
    talkPoint: { x: number; y: number } | null;
    feet: { x: number; y: number } | null;
    animations: InspectorCharacterAnimationCard[];
    verbs: InspectorVerbChip[];
    defaultVerb: string;
    availableVerbs: GameConfigVerbEntry[];
};

export type InspectorGuiSpriteAnchor = '' | 'top-left' | 'center' | 'screen';

export type InspectorGuiGridCellAlign =
    | ''
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center-left'
    | 'center'
    | 'center-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

export type InspectorGuiGridPlacement = {
    gridControlId: string;
    row: number;
    col: number;
    rowspan: number | null;
    colspan: number | null;
    align: InspectorGuiGridCellAlign;
};

export type InspectorGuiTextOutlineSides =
    | 'allSides'
    | 'topLeft'
    | 'top'
    | 'topRight'
    | 'left'
    | 'right'
    | 'bottomLeft'
    | 'bottom'
    | 'bottomRight';

export type InspectorGuiTextOutline = {
    enabled: boolean;
    color: string;
    alpha: number;
    thickness: number;
    sides: InspectorGuiTextOutlineSides;
};

const GUI_TEXT_OUTLINE_SIDES_SET = new Set<string>([
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

function parseInspectorGuiTextOutline(o: Record<string, unknown>): InspectorGuiTextOutline {
    const raw = o.textOutline;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            enabled: false,
            color: '#000000',
            alpha: 1,
            thickness: 1,
            sides: 'allSides'
        };
    }
    const t = raw as Record<string, unknown>;
    const sidesRaw = typeof t.sides === 'string' ? t.sides : '';
    const sides: InspectorGuiTextOutlineSides = GUI_TEXT_OUTLINE_SIDES_SET.has(sidesRaw)
        ? (sidesRaw as InspectorGuiTextOutlineSides)
        : 'allSides';
    const thicknessN = guiReadNum(t, 'thickness', 1);
    const alphaN = typeof t.alpha === 'number' && Number.isFinite(t.alpha) ? t.alpha : 1;
    return {
        enabled: t.enabled === true,
        color: typeof t.color === 'string' && t.color.trim().length > 0 ? t.color.trim() : '#000000',
        alpha: Math.min(1, Math.max(0, alphaN)),
        thickness: Math.max(1, Math.trunc(thicknessN)),
        sides
    };
}

export type InspectorGuiControlCard =
    | {
          controlKind: 'text';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          /** '' = inherit (omit `visible` in JSON). */
          visibleMode: '' | 'true' | 'false';
          text: string;
          font: string;
          fontSize: number;
          color: string;
          align: 'left' | 'center' | 'right' | '';
          wordWrapWidth: number | null;
          textOutline: InspectorGuiTextOutline;
          gridPlacement: InspectorGuiGridPlacement | null;
      }
    | {
          controlKind: 'inventoryPanel';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          rows: number;
          cols: number;
          slotWidth: number;
          slotHeight: number;
          spacingX: number | null;
          spacingY: number | null;
          itemScale: number | null;
          showEmptySlots: boolean;
          scrollDirection: 'horizontal' | 'vertical' | '';
          backButton: string;
          forwardButton: string;
          backgroundTag: string;
          backgroundAnchor: InspectorGuiSpriteAnchor;
          backgroundOffsetX: number | null;
          backgroundOffsetY: number | null;
          slotBackgroundTag: string;
          slotBackgroundAnchor: InspectorGuiSpriteAnchor;
          slotBackgroundOffsetX: number | null;
          slotBackgroundOffsetY: number | null;
          highlightTag: string;
          highlightAnchor: InspectorGuiSpriteAnchor;
          highlightOffsetX: number | null;
          highlightOffsetY: number | null;
          gridPlacement: InspectorGuiGridPlacement | null;
      }
    | {
          controlKind: 'image';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          tag: string;
          backgroundAnchor: InspectorGuiSpriteAnchor;
          backgroundOffsetX: number | null;
          backgroundOffsetY: number | null;
          gridPlacement: InspectorGuiGridPlacement | null;
      }
    | {
          controlKind: 'button';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          width: number;
          height: number;
          /** Empty string = default placement (`top-left` in JSON when saved from Inspector). */
          backgroundAnchor: InspectorGuiSpriteAnchor;
          backgroundOffsetX: number | null;
          backgroundOffsetY: number | null;
          text: string;
          font: string;
          fontSize: number;
          textColor: string;
          textAlign: 'left' | 'center' | 'right' | '';
          textOffsetX: number | null;
          textOffsetY: number | null;
          backgroundTag: string;
          statesHover: string;
          statesPressed: string;
          statesDisabled: string;
          enabled: boolean;
          textOutline: InspectorGuiTextOutline;
          gridPlacement: InspectorGuiGridPlacement | null;
      }
    | {
          controlKind: 'trigger';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          name: string;
          x: number;
          y: number;
          width: number;
          height: number;
          visibleMode: '' | 'true' | 'false';
          active: boolean;
          gridPlacement: InspectorGuiGridPlacement | null;
      }
    | {
          controlKind: 'grid';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          x: number;
          y: number;
          zIndex: number | null;
          visibleMode: '' | 'true' | 'false';
          rows: number;
          columns: number;
          width: number | null;
          height: number | null;
      }
    | {
          controlKind: 'unknown';
          key: string;
          index: number;
          summary: string;
          controlId: string;
          typeLabel: string;
          payload: string;
      };

export type InspectorGuiState = {
    kind: 'gui';
    rev: number;
    guiJsonUri: string;
    guiId: string;
    name: string;
    description: string;
    /** Root `visible` (required in schema); absent JSON treated as visible until saved. */
    rootVisibleAtLoad: boolean;
    usesAseprite: boolean;
    guiSheetTags: string[];
    fontIds: string[];
    controls: InspectorGuiControlCard[];
    /** When set, the matching control card opens and scrolls into view (BENNE tree control selection). */
    expanded: { entity: string; id: string } | null;
};

export type InspectorInventoryAnimationCard = {
    id: string;
    loop: boolean;
    frameDuration: number | null;
};

export type InspectorInventoryState = {
    kind: 'inventory';
    rev: number;
    inventoryJsonUri: string;
    inventoryId: string;
    name: string;
    description: string;
    stackable: boolean;
    asepriteMode: true | 'shared';
    defaultAnimation: string;
    /** Aseprite tag on this item’s sheet for custom cursor when item is active (use-on-target); empty = omit in JSON. */
    cursorAnimation: string;
    verbs: InspectorVerbChip[];
    availableVerbs: GameConfigVerbEntry[];
    animations: InspectorInventoryAnimationCard[];
    defaultVerb: string;
};

export type InspectorDialogOptionRow = {
    index: number;
    id: string;
    text: string;
    enabled: boolean;
    used: boolean;
    /** Engine default when omitted in JSON. */
    say: boolean;
};

export type InspectorDialogState = {
    kind: 'dialog';
    rev: number;
    dialogJsonUri: string;
    dialogId: string;
    displayName: string;
    /** Empty string when omitted in JSON (engine default `dialog`). */
    guiId: string;
    options: InspectorDialogOptionRow[];
};

export type InspectorStatePayload =
    | InspectorRoomState
    | InspectorCharacterState
    | InspectorGuiState
    | InspectorInventoryState
    | InspectorDialogState
    | InspectorEmptyState;

/** Built-in walk verb id (mirrors engine `WALK_TO_VERB_ID`); never surfaced in the Inspector. */
const WALK_TO_VERB_ID = 'walkTo';
/** Implicit per-clickable default verb when `defaultVerb` is omitted (mirrors engine fallback). */
const DEFAULT_VERB_FALLBACK = 'look';

function filterSelectableVerbs(gameVerbs: readonly GameConfigVerbEntry[]): GameConfigVerbEntry[] {
    return gameVerbs.filter((v) => v.id !== WALK_TO_VERB_ID);
}

function readDefaultVerbField(o: Record<string, unknown>): string {
    const raw = o.defaultVerb;
    if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim();
    }
    return DEFAULT_VERB_FALLBACK;
}

function readRoomJsonFromBuffer(uri: vscode.Uri): string | undefined {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    return open?.getText();
}

export async function readRoomJsonText(uri: vscode.Uri): Promise<string> {
    const buf = readRoomJsonFromBuffer(uri);
    if (buf !== undefined) {
        return buf;
    }
    const raw = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder('utf-8').decode(raw);
}

function expandedFromRoomPanel(
    roomPanel: import('./editorSelection').RoomPanelFocus
): { entity: string; id: string } | null {
    switch (roomPanel.kind) {
        case 'prop':
            return { entity: 'prop', id: roomPanel.prop.id };
        case 'hotspot':
            return { entity: 'hotspot', id: roomPanel.hotspotId };
        case 'roomCharacter':
            return { entity: 'character', id: roomPanel.instanceId };
        case 'roomPoint':
            return { entity: 'point', id: roomPanel.pointId };
        case 'region':
            return { entity: 'region', id: roomPanel.regionId };
        default:
            return null;
    }
}

function expandedFromGuiPanel(
    guiJsonUri: vscode.Uri,
    guiPanel: import('./editorSelection').GuiPanelFocus
): { entity: string; id: string } | null {
    if (guiPanel.kind !== 'control') {
        return null;
    }
    if (guiPanel.guiJsonUri.toString() !== guiJsonUri.toString()) {
        return null;
    }
    return { entity: 'guiControl', id: guiPanel.controlKey };
}

export async function buildInspectorState(
    jsonUri: vscode.Uri,
    focus: import('./editorSelection').EditorFocus,
    roomPanel: import('./editorSelection').RoomPanelFocus,
    guiPanel: import('./editorSelection').GuiPanelFocus,
    rev: number
): Promise<InspectorStatePayload> {
    if (focus.kind === 'character') {
        return buildCharacterInspectorState(jsonUri, rev);
    }
    if (focus.kind === 'gui') {
        return buildGuiInspectorState(jsonUri, rev, guiPanel);
    }
    if (focus.kind === 'inventory') {
        return buildInventoryInspectorState(jsonUri, rev);
    }
    if (focus.kind === 'dialog') {
        return buildDialogInspectorState(jsonUri, rev);
    }
    return buildRoomInspectorState(jsonUri, roomPanel, rev);
}

async function buildDialogInspectorState(dialogJsonUri: vscode.Uri, rev: number): Promise<InspectorStatePayload> {
    let text: string;
    try {
        text = await readRoomJsonText(dialogJsonUri);
    } catch {
        return { kind: 'empty', message: 'Could not read dialog JSON.' };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { kind: 'empty', message: 'Dialog JSON is not valid JSON.' };
    }

    const dialogId = getDialogIdFromDialogJsonUri(dialogJsonUri);
    const idInFile = typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : dialogId;
    const displayName =
        typeof data.displayName === 'string' && data.displayName.trim().length > 0
            ? data.displayName.trim()
            : idInFile;
    const guiIdRaw = typeof data.guiId === 'string' ? data.guiId.trim() : '';
    const guiId = guiIdRaw;

    const optionsRaw = data.options;
    const options: InspectorDialogOptionRow[] = [];
    if (Array.isArray(optionsRaw)) {
        let idx = 0;
        for (let i = 0; i < optionsRaw.length; i++) {
            const row = optionsRaw[i];
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
                continue;
            }
            const o = row as Record<string, unknown>;
            const id = typeof o.id === 'string' ? o.id : `option${idx}`;
            const textVal = typeof o.text === 'string' ? o.text : '';
            const enabled = o.enabled !== false;
            const used = o.used === true;
            const say = o.say !== false;
            options.push({ index: idx, id, text: textVal, enabled, used, say });
            idx++;
        }
    }

    return {
        kind: 'dialog',
        rev,
        dialogJsonUri: dialogJsonUri.toString(),
        dialogId: idInFile,
        displayName,
        guiId,
        options
    };
}

async function buildRoomInspectorState(
    roomJsonUri: vscode.Uri,
    roomPanel: import('./editorSelection').RoomPanelFocus,
    rev: number
): Promise<InspectorStatePayload> {
    const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
    if (!folder) {
        return { kind: 'empty', message: 'Room JSON is not inside a workspace folder.' };
    }

    const roomId = getRoomIdFromRoomJsonUri(roomJsonUri);
    const inventoryItemIds = (await listInventoryDefinitions(folder)).map((x) => x.id);
    let text: string;
    try {
        text = await readRoomJsonText(roomJsonUri);
    } catch {
        return { kind: 'empty', message: 'Could not read room JSON.' };
    }

    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { kind: 'empty', message: 'Room JSON is not valid JSON.' };
    }

    const displayName = typeof data.name === 'string' ? data.name : roomId;
    const sizeRaw = data.size;
    const size =
        sizeRaw &&
        typeof sizeRaw === 'object' &&
        typeof (sizeRaw as { width?: unknown }).width === 'number' &&
        typeof (sizeRaw as { height?: unknown }).height === 'number'
            ? {
                  width: (sizeRaw as { width: number }).width,
                  height: (sizeRaw as { height: number }).height
              }
            : null;

    const sb = data.scrollBounds;
    const scrollBounds =
        sb &&
        typeof sb === 'object' &&
        typeof (sb as { x?: unknown }).x === 'number' &&
        typeof (sb as { y?: unknown }).y === 'number' &&
        typeof (sb as { width?: unknown }).width === 'number' &&
        typeof (sb as { height?: unknown }).height === 'number'
            ? {
                  x: (sb as { x: number }).x,
                  y: (sb as { y: number }).y,
                  width: (sb as { width: number }).width,
                  height: (sb as { height: number }).height
              }
            : null;

    const bg = data.background;
    let backgroundImageRelative: string | null = null;
    if (bg && typeof bg === 'object' && typeof (bg as { image?: unknown }).image === 'string') {
        backgroundImageRelative = (bg as { image: string }).image.trim() || null;
    }

    let canFitBackground = false;
    if (backgroundImageRelative) {
        const abs = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', ...backgroundImageRelative.split('/'));
        try {
            const imgBytes = await vscode.workspace.fs.readFile(abs);
            canFitBackground = readPngDimensions(imgBytes) !== undefined;
        } catch {
            canFitBackground = false;
        }
    }

    const walkableRows: InspectorWalkableRow[] = [];
    const walk = data.walkable;
    if (walk && typeof walk === 'object') {
        const polysUnknown = (walk as { polygons?: unknown }).polygons;
        if (Array.isArray(polysUnknown)) {
            for (const poly of polysUnknown) {
                if (!poly || typeof poly !== 'object') {
                    continue;
                }
                const p = poly as Record<string, unknown>;
                const pid = typeof p.id === 'string' ? p.id : '';
                if (!pid) {
                    continue;
                }
                walkableRows.push({
                    kind: 'polygon',
                    polygonId: pid,
                    id: pid,
                    active: p.active !== false
                });
                const holes = p.holes;
                if (Array.isArray(holes)) {
                    for (const h of holes) {
                        if (!h || typeof h !== 'object') {
                            continue;
                        }
                        const ho = h as Record<string, unknown>;
                        const hid = typeof ho.id === 'string' ? ho.id : '';
                        if (!hid) {
                            continue;
                        }
                        walkableRows.push({
                            kind: 'hole',
                            polygonId: pid,
                            holeId: hid,
                            id: hid,
                            active: ho.active !== false
                        });
                    }
                }
            }
        }
    }

    const gameVerbs = await readGameConfigVerbs(folder.uri);
    const configured = await readConfiguredVerbIdSet(folder.uri);
    const roomScriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    let roomScriptText = '';
    try {
        roomScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(roomScriptUri));
    } catch {
        /* */
    }

    const propsList = await readRoomProps(roomJsonUri);
    const propIds = new Set(propsList.map((p) => p.id));

    const roomSheet = await resolveRoomAsepriteSheetForProps(folder.uri, roomId);
    const sheetTagList = roomSheet.frameTags ?? [];
    const sheetTagSet = new Set(sheetTagList);

    const propsRaw = data.props;
    const props: InspectorPropCard[] = [];
    if (Array.isArray(propsRaw)) {
        for (const item of propsRaw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            const id = typeof o.id === 'string' ? o.id : '';
            if (!id) {
                continue;
            }
            const entry = propsList.find((p) => p.id === id) ?? ({
                id,
                tag: typeof o.tag === 'string' ? o.tag : undefined,
                defaultAnimation: typeof o.defaultAnimation === 'string' ? o.defaultAnimation : undefined,
                clickable: typeof o.clickable === 'boolean' ? o.clickable : undefined,
                visible: typeof o.visible === 'boolean' ? o.visible : undefined,
                onVerbFallback: typeof o.onVerbFallback === 'boolean' ? o.onVerbFallback : undefined,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : undefined
            } as RoomPropEntry);
            const verbs =
                entry.clickable === true
                    ? buildPropVerbChips(roomId, entry, gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS, configured, roomScriptText)
                    : [];
            const tagStr = typeof o.tag === 'string' ? o.tag.trim() : '';
            const defaultAnimFromFile =
                typeof o.defaultAnimation === 'string' ? o.defaultAnimation.trim() : '';
            const roots = new Set<string>([id]);
            if (defaultAnimFromFile.length > 0) {
                roots.add(defaultAnimFromFile);
            }

            const animationsById = new Map<string, InspectorPropAnimationCard>();
            if (o.animations && typeof o.animations === 'object' && !Array.isArray(o.animations)) {
                for (const [animKey, rawClip] of Object.entries(o.animations as Record<string, unknown>)) {
                    if (!rawClip || typeof rawClip !== 'object' || Array.isArray(rawClip)) {
                        continue;
                    }
                    const c = rawClip as Record<string, unknown>;
                    animationsById.set(animKey, {
                        id: animKey,
                        loop: c.loop === true,
                        frameDuration:
                            typeof c.frameDuration === 'number' && Number.isFinite(c.frameDuration)
                                ? c.frameDuration
                                : null
                    });
                }
            }
            if (sheetTagList.length > 0) {
                for (const tag of sheetTagList) {
                    if (tagBelongsToRootSet(tag, roots) && !animationsById.has(tag)) {
                        animationsById.set(tag, { id: tag, loop: false, frameDuration: null });
                    }
                }
                if (tagStr.length > 0 && sheetTagSet.has(tagStr) && !animationsById.has(tagStr)) {
                    animationsById.set(tagStr, { id: tagStr, loop: false, frameDuration: null });
                }
            }

            const propAnimations = [...animationsById.values()].sort((a, b) => a.id.localeCompare(b.id));
            props.push({
                id,
                tag: typeof o.tag === 'string' ? o.tag : undefined,
                defaultAnimation: defaultAnimFromFile,
                animations: propAnimations,
                description: typeof o.description === 'string' ? o.description : '',
                visible: o.visible !== false,
                clickable: entry.clickable === true,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : 0,
                baseline: typeof o.baseline === 'number' && Number.isFinite(o.baseline) ? o.baseline : null,
                parallaxDepth: typeof o.parallaxDepth === 'number' ? o.parallaxDepth : 1,
                alpha: typeof o.alpha === 'number' ? o.alpha : 1,
                verbs,
                defaultVerb: readDefaultVerbField(o),
                availableVerbs: filterSelectableVerbs(gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS)
            });
        }
    }

    const hotspotsList = await readRoomHotspots(roomJsonUri);
    const hotspots: InspectorHotspotCard[] = [];
    const hsRaw = data.hotspots;
    if (Array.isArray(hsRaw)) {
        for (const item of hsRaw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            const id = typeof o.id === 'string' ? o.id : '';
            if (!id) {
                continue;
            }
            const entry =
                hotspotsList.find((h) => h.id === id) ??
                ({
                    id,
                    description: typeof o.description === 'string' ? o.description : undefined,
                    zIndex: typeof o.zIndex === 'number' ? o.zIndex : undefined,
                    active: typeof o.active === 'boolean' ? o.active : undefined,
                    onVerbFallback: typeof o.onVerbFallback === 'boolean' ? o.onVerbFallback : undefined
                } as RoomHotspotListEntry);
            const verbs = buildHotspotVerbChips(
                roomId,
                entry,
                gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS,
                configured,
                roomScriptText,
                propIds
            );
            hotspots.push({
                id,
                description: typeof o.description === 'string' ? o.description : '',
                active: entry.active !== false,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : 0,
                baseline: typeof o.baseline === 'number' && Number.isFinite(o.baseline) ? o.baseline : null,
                verbs,
                defaultVerb: readDefaultVerbField(o),
                availableVerbs: filterSelectableVerbs(gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS)
            });
        }
    }

    const characters: InspectorCharacterCard[] = [];
    const charsRaw = data.characters;
    if (Array.isArray(charsRaw)) {
        for (const item of charsRaw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            const instanceId = typeof o.instanceId === 'string' ? o.instanceId : '';
            const definition = typeof o.definition === 'string' ? o.definition : '';
            const characterId = characterIdFromRoomDefinition(definition);
            if (!instanceId || !characterId) {
                continue;
            }
            const charJsonUri = vscode.Uri.joinPath(
                folder.uri,
                'src',
                'game',
                'characters',
                characterId,
                `${characterId}.character.json`
            );
            let hooks: {
                clickable?: boolean;
            } = {};
            let charJsonText = '{}';
            let charScriptText = '';
            try {
                hooks = await readCharacterHooks(charJsonUri);
                charJsonText = await readRoomJsonText(charJsonUri);
                const charScriptUri = vscode.Uri.joinPath(charJsonUri, '..', `${characterId}.character.ts`);
                charScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(charScriptUri));
            } catch {
                /* missing definition */
            }
            const verbs =
                hooks.clickable === true
                    ? buildRoomCharacterVerbChips(
                          roomId,
                          characterId,
                          gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS,
                          configured,
                          roomScriptText,
                          charScriptText
                      )
                    : [];
            let charDefaultVerb = DEFAULT_VERB_FALLBACK;
            try {
                const parsed = JSON.parse(charJsonText) as Record<string, unknown>;
                charDefaultVerb = readDefaultVerbField(parsed);
            } catch {
                /* fall back */
            }
            characters.push({
                instanceId,
                characterId,
                definition,
                x: typeof o.x === 'number' ? o.x : 0,
                y: typeof o.y === 'number' ? o.y : 0,
                visible: o.visible !== false,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : 0,
                initialFacing: typeof o.initialFacing === 'string' ? o.initialFacing : undefined,
                initialAnimation: typeof o.initialAnimation === 'string' ? o.initialAnimation : undefined,
                characterClickable: hooks.clickable === true,
                characterJsonUri: charJsonUri.toString(),
                verbs,
                defaultVerb: charDefaultVerb,
                availableVerbs: filterSelectableVerbs(gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS)
            });
        }
    }

    const points: InspectorPointCard[] = [];
    const ptsRaw = data.points;
    if (Array.isArray(ptsRaw)) {
        for (const item of ptsRaw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            const id = typeof o.id === 'string' ? o.id : '';
            if (!id) {
                continue;
            }
            points.push({
                id,
                x: typeof o.x === 'number' ? o.x : 0,
                y: typeof o.y === 'number' ? o.y : 0
            });
        }
    }

    const regions: InspectorRegionCard[] = [];
    const regRaw = data.regions;
    if (Array.isArray(regRaw)) {
        for (const item of regRaw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            const id = typeof o.id === 'string' ? o.id : '';
            if (!id) {
                continue;
            }
            const pts = o.points;
            const pointCount = Array.isArray(pts) ? pts.length : 0;
            const scaleTop = typeof o.scaleTop === 'number' && Number.isFinite(o.scaleTop) ? o.scaleTop : 1;
            const scaleBottom =
                typeof o.scaleBottom === 'number' && Number.isFinite(o.scaleBottom) ? o.scaleBottom : 1;
            regions.push({
                id,
                active: o.active !== false,
                pointCount,
                scaleTop,
                scaleBottom,
                scaleWalkSpeed: o.scaleWalkSpeed === true
            });
        }
    }

    return {
        kind: 'room',
        rev,
        roomJsonUri: roomJsonUri.toString(),
        roomId,
        inventoryItemIds,
        displayName,
        size,
        scrollBounds,
        backgroundImageRelative,
        canFitBackground,
        walkableRows,
        props,
        hotspots,
        characters,
        points,
        regions,
        expanded: expandedFromRoomPanel(roomPanel)
    };
}

async function buildCharacterInspectorState(
    characterJsonUri: vscode.Uri,
    rev: number
): Promise<InspectorStatePayload> {
    let text: string;
    try {
        text = await readRoomJsonText(characterJsonUri);
    } catch {
        return { kind: 'empty', message: 'Could not read character JSON.' };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { kind: 'empty', message: 'Character JSON is not valid JSON.' };
    }

    const characterId = getCharacterIdFromCharacterJsonUri(characterJsonUri);
    const name = typeof data.name === 'string' ? data.name : characterId;
    const walkSpeed = typeof data.walkSpeed === 'number' ? data.walkSpeed : 0;
    const clickable = data.clickable === true;
    const description = typeof data.description === 'string' ? data.description : '';

    const toPoint = (v: unknown): { x: number; y: number } | null => {
        if (!v || typeof v !== 'object') {
            return null;
        }
        const o = v as { x?: unknown; y?: unknown };
        return typeof o.x === 'number' && typeof o.y === 'number' ? { x: o.x, y: o.y } : null;
    };

    const anims: InspectorCharacterAnimationCard[] = [];
    const animationsRaw = data.animations;
    if (animationsRaw && typeof animationsRaw === 'object' && !Array.isArray(animationsRaw)) {
        for (const [id, raw] of Object.entries(animationsRaw as Record<string, unknown>)) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                continue;
            }
            const anim = raw as { loop?: unknown; frameDuration?: unknown };
            anims.push({
                id,
                loop: anim.loop === true,
                frameDuration: typeof anim.frameDuration === 'number' ? anim.frameDuration : null
            });
        }
    }

    let scriptText = '';
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* */
    }
    const folder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
    const gameVerbs = folder ? await readGameConfigVerbs(folder.uri) : DEFAULT_GAME_VERBS;
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
    const verbs = buildCharacterVerbChips(
        characterId,
        gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS,
        configured,
        scriptText
    );

    const invFolder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
    const inventoryItemIds = invFolder ? (await listInventoryDefinitions(invFolder)).map((x) => x.id) : [];

    return {
        kind: 'character',
        rev,
        characterJsonUri: characterJsonUri.toString(),
        characterId,
        inventoryItemIds,
        name,
        walkSpeed,
        clickable,
        description,
        walkToPoint: toPoint(data.walkToPoint),
        talkPoint: toPoint(data.talkPoint),
        feet: toPoint(data.feet),
        animations: anims.sort((a, b) => a.id.localeCompare(b.id)),
        verbs,
        defaultVerb: readDefaultVerbField(data),
        availableVerbs: filterSelectableVerbs(gameVerbs.length > 0 ? gameVerbs : DEFAULT_GAME_VERBS)
    };
}

function guiReadVisibleMode(o: Record<string, unknown>): '' | 'true' | 'false' {
    if (!('visible' in o)) {
        return '';
    }
    return o.visible === true ? 'true' : 'false';
}

function guiReadNumOrNull(o: Record<string, unknown>, key: string): number | null {
    const v = o[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function guiReadNum(o: Record<string, unknown>, key: string, fallback: number): number {
    const v = o[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function guiReadAnchorField(o: Record<string, unknown>, key: string): InspectorGuiSpriteAnchor {
    const v = o[key];
    if (v === 'top-left' || v === 'center' || v === 'screen') {
        return v;
    }
    return '';
}

const GUI_GRID_CELL_ALIGNS = new Set<string>([
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right'
]);

function guiReadGridCellAlignField(o: Record<string, unknown>, key: string): InspectorGuiGridCellAlign {
    const v = o[key];
    if (typeof v === 'string' && GUI_GRID_CELL_ALIGNS.has(v)) {
        return v as InspectorGuiGridCellAlign;
    }
    return '';
}

function parseOptionalGridPlacement(o: Record<string, unknown>): InspectorGuiGridPlacement | null {
    const gp = o.gridPlacement;
    if (!gp || typeof gp !== 'object' || Array.isArray(gp)) {
        return null;
    }
    const g = gp as Record<string, unknown>;
    const gridControlId = typeof g.gridControlId === 'string' ? g.gridControlId.trim() : '';
    if (!gridControlId) {
        return null;
    }
    return {
        gridControlId,
        row: guiReadNum(g, 'row', 0),
        col: guiReadNum(g, 'col', 0),
        rowspan: guiReadNumOrNull(g, 'rowspan'),
        colspan: guiReadNumOrNull(g, 'colspan'),
        align: guiReadGridCellAlignField(g, 'align')
    };
}

async function readBitmapFontIdList(gameRoot: vscode.Uri): Promise<string[]> {
    const uri = vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'fonts', 'fonts.json');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(new TextDecoder('utf-8').decode(raw)) as Record<string, unknown>;
        return Object.keys(parsed)
            .filter((k) => !k.startsWith('$'))
            .sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}

function parseGuiControlCard(o: Record<string, unknown>, index: number): InspectorGuiControlCard {
    const type = typeof o.type === 'string' ? o.type : 'control';
    const id = typeof o.id === 'string' ? o.id : '';
    const summary = id ? `${type} (${id})` : `${type} (#${index + 1})`;
    const key = `${type}:${id}:${index}`;
    const controlId = id;

    if (type === 'text') {
        const alignRaw = o.align;
        const align: 'left' | 'center' | 'right' | '' =
            alignRaw === 'center' || alignRaw === 'right' || alignRaw === 'left' ? alignRaw : '';
        return {
            controlKind: 'text',
            key,
            index,
            summary,
            controlId,
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            zIndex: guiReadNumOrNull(o, 'zIndex'),
            visibleMode: guiReadVisibleMode(o),
            text: typeof o.text === 'string' ? o.text : '',
            font: typeof o.font === 'string' ? o.font : '',
            fontSize: guiReadNum(o, 'fontSize', 8),
            color: typeof o.color === 'string' ? o.color : '#ffffff',
            align,
            wordWrapWidth: guiReadNumOrNull(o, 'wordWrapWidth'),
            textOutline: parseInspectorGuiTextOutline(o),
            gridPlacement: parseOptionalGridPlacement(o)
        };
    }

    if (type === 'inventoryPanel') {
        const sd = o.scrollDirection;
        const scrollDirection: 'horizontal' | 'vertical' | '' =
            sd === 'horizontal' || sd === 'vertical' ? sd : '';
        return {
            controlKind: 'inventoryPanel',
            key,
            index,
            summary,
            controlId,
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            zIndex: guiReadNumOrNull(o, 'zIndex'),
            visibleMode: guiReadVisibleMode(o),
            rows: guiReadNum(o, 'rows', 1),
            cols: guiReadNum(o, 'cols', 1),
            slotWidth: guiReadNum(o, 'slotWidth', 32),
            slotHeight: guiReadNum(o, 'slotHeight', 32),
            spacingX: guiReadNumOrNull(o, 'spacingX'),
            spacingY: guiReadNumOrNull(o, 'spacingY'),
            itemScale: guiReadNumOrNull(o, 'itemScale'),
            showEmptySlots: o.showEmptySlots === true,
            scrollDirection,
            backButton: typeof o.backButton === 'string' ? o.backButton : '',
            forwardButton: typeof o.forwardButton === 'string' ? o.forwardButton : '',
            backgroundTag: typeof o.backgroundTag === 'string' ? o.backgroundTag : '',
            backgroundAnchor: guiReadAnchorField(o, 'backgroundAnchor'),
            backgroundOffsetX: guiReadNumOrNull(o, 'backgroundOffsetX'),
            backgroundOffsetY: guiReadNumOrNull(o, 'backgroundOffsetY'),
            slotBackgroundTag: typeof o.slotBackgroundTag === 'string' ? o.slotBackgroundTag : '',
            slotBackgroundAnchor: guiReadAnchorField(o, 'slotBackgroundAnchor'),
            slotBackgroundOffsetX: guiReadNumOrNull(o, 'slotBackgroundOffsetX'),
            slotBackgroundOffsetY: guiReadNumOrNull(o, 'slotBackgroundOffsetY'),
            highlightTag: typeof o.highlightTag === 'string' ? o.highlightTag : '',
            highlightAnchor: guiReadAnchorField(o, 'highlightAnchor'),
            highlightOffsetX: guiReadNumOrNull(o, 'highlightOffsetX'),
            highlightOffsetY: guiReadNumOrNull(o, 'highlightOffsetY'),
            gridPlacement: parseOptionalGridPlacement(o)
        };
    }

    if (type === 'image') {
        const legacyDisp =
            o.display && typeof o.display === 'object' && !Array.isArray(o.display)
                ? (o.display as Record<string, unknown>)
                : null;
        const tag =
            typeof o.tag === 'string'
                ? o.tag
                : typeof legacyDisp?.tag === 'string'
                  ? legacyDisp.tag
                  : '';
        const anchorSource: Record<string, unknown> = {};
        if (typeof o.backgroundAnchor === 'string' && o.backgroundAnchor.length > 0) {
            anchorSource.backgroundAnchor = o.backgroundAnchor;
        } else if (typeof legacyDisp?.backgroundAnchor === 'string') {
            anchorSource.backgroundAnchor = legacyDisp.backgroundAnchor;
        }
        const backgroundAnchor = guiReadAnchorField(anchorSource, 'backgroundAnchor');
        return {
            controlKind: 'image',
            key,
            index,
            summary,
            controlId,
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            zIndex: guiReadNumOrNull(o, 'zIndex'),
            visibleMode: guiReadVisibleMode(o),
            tag,
            backgroundAnchor,
            backgroundOffsetX: guiReadNumOrNull(o, 'backgroundOffsetX'),
            backgroundOffsetY: guiReadNumOrNull(o, 'backgroundOffsetY'),
            gridPlacement: parseOptionalGridPlacement(o)
        };
    }

    if (type === 'trigger') {
        return {
            controlKind: 'trigger',
            key,
            index,
            summary,
            controlId,
            name: typeof o.name === 'string' ? o.name : '',
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            width: guiReadNum(o, 'width', 64),
            height: guiReadNum(o, 'height', 64),
            visibleMode: guiReadVisibleMode(o),
            active: o.active !== false,
            gridPlacement: parseOptionalGridPlacement(o)
        };
    }

    if (type === 'button') {
        const statesRaw =
            o.states && typeof o.states === 'object' && !Array.isArray(o.states)
                ? (o.states as Record<string, unknown>)
                : {};
        const alignRaw = o.textAlign;
        const textAlign: 'left' | 'center' | 'right' | '' =
            alignRaw === 'center' || alignRaw === 'right' || alignRaw === 'left' ? alignRaw : '';
        return {
            controlKind: 'button',
            key,
            index,
            summary,
            controlId,
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            zIndex: guiReadNumOrNull(o, 'zIndex'),
            visibleMode: guiReadVisibleMode(o),
            width: guiReadNum(o, 'width', 120),
            height: guiReadNum(o, 'height', 32),
            backgroundAnchor: guiReadAnchorField(o, 'backgroundAnchor'),
            backgroundOffsetX: guiReadNumOrNull(o, 'backgroundOffsetX'),
            backgroundOffsetY: guiReadNumOrNull(o, 'backgroundOffsetY'),
            text: typeof o.text === 'string' ? o.text : '',
            font: typeof o.font === 'string' ? o.font : '',
            fontSize: guiReadNum(o, 'fontSize', 16),
            textColor: typeof o.textColor === 'string' ? o.textColor : '#ffffff',
            textAlign,
            textOffsetX: guiReadNumOrNull(o, 'textOffsetX'),
            textOffsetY: guiReadNumOrNull(o, 'textOffsetY'),
            backgroundTag: typeof o.backgroundTag === 'string' ? o.backgroundTag : '',
            statesHover: typeof statesRaw.hover === 'string' ? statesRaw.hover : '',
            statesPressed: typeof statesRaw.pressed === 'string' ? statesRaw.pressed : '',
            statesDisabled: typeof statesRaw.disabled === 'string' ? statesRaw.disabled : '',
            enabled: o.enabled !== false,
            textOutline: parseInspectorGuiTextOutline(o),
            gridPlacement: parseOptionalGridPlacement(o)
        };
    }

    if (type === 'grid') {
        return {
            controlKind: 'grid',
            key,
            index,
            summary,
            controlId,
            x: guiReadNum(o, 'x', 0),
            y: guiReadNum(o, 'y', 0),
            zIndex: guiReadNumOrNull(o, 'zIndex'),
            visibleMode: guiReadVisibleMode(o),
            rows: guiReadNum(o, 'rows', 2),
            columns: guiReadNum(o, 'columns', 2),
            width: guiReadNumOrNull(o, 'width'),
            height: guiReadNumOrNull(o, 'height')
        };
    }

    return {
        controlKind: 'unknown',
        key,
        index,
        summary,
        controlId,
        typeLabel: type,
        payload: JSON.stringify(o, null, 2)
    };
}

async function buildGuiInspectorState(
    guiJsonUri: vscode.Uri,
    rev: number,
    guiPanel: import('./editorSelection').GuiPanelFocus
): Promise<InspectorStatePayload> {
    let text: string;
    try {
        text = await readRoomJsonText(guiJsonUri);
    } catch {
        return { kind: 'empty', message: 'Could not read GUI JSON.' };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { kind: 'empty', message: 'GUI JSON is not valid JSON.' };
    }

    const guiId = getGuiIdFromGuiJsonUri(guiJsonUri);
    const name = typeof data.name === 'string' ? data.name : guiId;
    const description = typeof data.description === 'string' ? data.description : '';
    const displayRaw =
        data.display && typeof data.display === 'object' && !Array.isArray(data.display)
            ? (data.display as Record<string, unknown>)
            : {};
    const usesAseprite = displayRaw.aseprite === true;

    const folder = vscode.workspace.getWorkspaceFolder(guiJsonUri);
    let guiSheetTags: string[] = [];
    let fontIds: string[] = [];
    if (folder) {
        fontIds = await readBitmapFontIdList(folder.uri);
        if (usesAseprite) {
            const sheet = await resolveGuiAsepriteSheetForTags(folder.uri, guiId);
            if (sheet.frameTags && sheet.frameTags.length > 0) {
                guiSheetTags = [...new Set(sheet.frameTags)].sort((a, b) => a.localeCompare(b));
            }
        }
    }

    const controls: InspectorGuiControlCard[] = [];
    const controlsRaw = data.controls;
    if (Array.isArray(controlsRaw)) {
        for (let i = 0; i < controlsRaw.length; i++) {
            const raw = controlsRaw[i];
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            controls.push(parseGuiControlCard(raw as Record<string, unknown>, i));
        }
    }

    return {
        kind: 'gui',
        rev,
        guiJsonUri: guiJsonUri.toString(),
        guiId,
        name,
        description,
        rootVisibleAtLoad: typeof data.visible === 'boolean' ? data.visible : true,
        usesAseprite,
        guiSheetTags,
        fontIds,
        controls,
        expanded: expandedFromGuiPanel(guiJsonUri, guiPanel)
    };
}

async function buildInventoryInspectorState(
    inventoryJsonUri: vscode.Uri,
    rev: number
): Promise<InspectorStatePayload> {
    let text: string;
    try {
        text = await readRoomJsonText(inventoryJsonUri);
    } catch {
        return { kind: 'empty', message: 'Could not read inventory JSON.' };
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { kind: 'empty', message: 'Inventory JSON is not valid JSON.' };
    }

    const inventoryId = getInventoryIdFromInventoryJsonUri(inventoryJsonUri);
    const name = typeof data.name === 'string' ? data.name : inventoryId;
    const description = typeof data.description === 'string' ? data.description : '';
    const stackable = data.stackable === true;

    const displayRaw =
        data.display && typeof data.display === 'object' && !Array.isArray(data.display)
            ? (data.display as Record<string, unknown>)
            : {};
    const asepriteMode = displayRaw.aseprite === true ? true : 'shared';
    const defaultFromFile = typeof data.defaultAnimation === 'string' ? data.defaultAnimation.trim() : '';
    const legacyTag = typeof displayRaw.tag === 'string' ? displayRaw.tag.trim() : '';
    const defaultAnimation = defaultFromFile.length > 0 ? defaultFromFile : legacyTag;
    const cursorAnimation =
        typeof data.cursorAnimation === 'string' ? data.cursorAnimation.trim() : '';

    const animationsRaw =
        data.animations && typeof data.animations === 'object' && !Array.isArray(data.animations)
            ? (data.animations as Record<string, unknown>)
            : {};
    const animationsById = new Map<string, InspectorInventoryAnimationCard>();
    for (const [id, raw] of Object.entries(animationsRaw)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            continue;
        }
        const clip = raw as Record<string, unknown>;
        animationsById.set(id, {
            id,
            loop: clip.loop === true,
            frameDuration: typeof clip.frameDuration === 'number' ? clip.frameDuration : null
        });
    }
    const folder = vscode.workspace.getWorkspaceFolder(inventoryJsonUri);
    if (folder && (asepriteMode === 'shared' || asepriteMode === true)) {
        const sheet =
            asepriteMode === 'shared'
                ? await resolveSharedInventoryAsepriteSheet(folder.uri)
                : await resolvePerItemInventoryAsepriteSheet(folder.uri, inventoryId);
        const tags = sheet.frameTags ?? [];
        const roots = new Set<string>([inventoryId]);
        if (defaultAnimation.length > 0) {
            roots.add(defaultAnimation);
        }
        for (const tag of tags) {
            if (tagBelongsToRootSet(tag, roots) && !animationsById.has(tag)) {
                animationsById.set(tag, { id: tag, loop: false, frameDuration: null });
            }
        }
    }
    if (!animationsById.has(inventoryId)) {
        animationsById.set(inventoryId, { id: inventoryId, loop: false, frameDuration: null });
    }
    const animations = [...animationsById.values()].sort((a, b) => a.id.localeCompare(b.id));

    const availableVerbs = folder
        ? await readGameConfigVerbs(folder.uri)
        : DEFAULT_GAME_VERBS;
    const effectiveVerbs = availableVerbs.length > 0 ? availableVerbs : DEFAULT_GAME_VERBS;
    const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();
    const scriptUri = vscode.Uri.joinPath(inventoryJsonUri, '..', `${inventoryId}.inventory.ts`);
    let scriptText = '';
    try {
        scriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(scriptUri));
    } catch {
        /* */
    }
    const verbs = buildInventoryVerbChips(inventoryId, effectiveVerbs, configured, text, scriptText);

    return {
        kind: 'inventory',
        rev,
        inventoryJsonUri: inventoryJsonUri.toString(),
        inventoryId,
        name,
        description,
        stackable,
        asepriteMode,
        defaultAnimation,
        cursorAnimation,
        verbs,
        availableVerbs: filterSelectableVerbs(effectiveVerbs),
        animations,
        defaultVerb: readDefaultVerbField(data)
    };
}
