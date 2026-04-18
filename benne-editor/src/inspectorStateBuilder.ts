import * as vscode from 'vscode';
import { tagBelongsToRootSet } from './asepriteTagFamily';
import {
    characterIdFromRoomDefinition,
    DEFAULT_GAME_VERBS,
    getCharacterIdFromCharacterJsonUri,
    getGuiIdFromGuiJsonUri,
    getInventoryIdFromInventoryJsonUri,
    getRoomIdFromRoomJsonUri,
    readCharacterHooks,
    readGameConfigVerbs,
    resolveGuiAsepriteSheetForTags,
    resolvePerItemInventoryAsepriteSheet,
    resolveRoomAsepriteSheetForProps,
    resolveSharedInventoryAsepriteSheet,
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
    parallaxDepth: number;
    alpha: number;
    verbs: InspectorVerbChip[];
};

export type InspectorHotspotCard = {
    id: string;
    description: string;
    active: boolean;
    zIndex: number;
    verbs: InspectorVerbChip[];
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
};

export type InspectorPointCard = { id: string; x: number; y: number };

export type InspectorRegionCard = { id: string; active: boolean; pointCount: number };

export type InspectorRoomState = {
    kind: 'room';
    rev: number;
    roomJsonUri: string;
    roomId: string;
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
    name: string;
    walkSpeed: number;
    clickable: boolean;
    description: string;
    walkToPoint: { x: number; y: number } | null;
    talkPoint: { x: number; y: number } | null;
    feet: { x: number; y: number } | null;
    animations: InspectorCharacterAnimationCard[];
    verbs: InspectorVerbChip[];
};

export type InspectorGuiSpriteAnchor = '' | 'top-left' | 'center' | 'screen';

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
          backgroundTag: string;
          backgroundAnchor: InspectorGuiSpriteAnchor;
          slotBackgroundTag: string;
          slotBackgroundAnchor: InspectorGuiSpriteAnchor;
          highlightTag: string;
          highlightAnchor: InspectorGuiSpriteAnchor;
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
    verbs: InspectorVerbChip[];
    availableVerbs: { id: string; label?: string }[];
    animations: InspectorInventoryAnimationCard[];
};

export type InspectorStatePayload =
    | InspectorRoomState
    | InspectorCharacterState
    | InspectorGuiState
    | InspectorInventoryState
    | InspectorEmptyState;

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
    return buildRoomInspectorState(jsonUri, roomPanel, rev);
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
                onVerb:
                    o.onVerb && typeof o.onVerb === 'object' && !Array.isArray(o.onVerb)
                        ? (o.onVerb as Record<string, boolean>)
                        : undefined,
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
                parallaxDepth: typeof o.parallaxDepth === 'number' ? o.parallaxDepth : 1,
                alpha: typeof o.alpha === 'number' ? o.alpha : 1,
                verbs
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
                    onVerb:
                        o.onVerb && typeof o.onVerb === 'object' && !Array.isArray(o.onVerb)
                            ? (o.onVerb as Record<string, boolean>)
                            : undefined,
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
                verbs
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
                onVerb?: Record<string, boolean>;
            } = { onVerb: {} };
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
                          charJsonText,
                          charScriptText
                      )
                    : [];
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
                verbs
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
            regions.push({
                id,
                active: o.active !== false,
                pointCount
            });
        }
    }

    return {
        kind: 'room',
        rev,
        roomJsonUri: roomJsonUri.toString(),
        roomId,
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
        text,
        scriptText
    );

    return {
        kind: 'character',
        rev,
        characterJsonUri: characterJsonUri.toString(),
        characterId,
        name,
        walkSpeed,
        clickable,
        description,
        walkToPoint: toPoint(data.walkToPoint),
        talkPoint: toPoint(data.talkPoint),
        feet: toPoint(data.feet),
        animations: anims.sort((a, b) => a.id.localeCompare(b.id)),
        verbs
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
            wordWrapWidth: guiReadNumOrNull(o, 'wordWrapWidth')
        };
    }

    if (type === 'inventoryPanel') {
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
            backgroundTag: typeof o.backgroundTag === 'string' ? o.backgroundTag : '',
            backgroundAnchor: guiReadAnchorField(o, 'backgroundAnchor'),
            slotBackgroundTag: typeof o.slotBackgroundTag === 'string' ? o.slotBackgroundTag : '',
            slotBackgroundAnchor: guiReadAnchorField(o, 'slotBackgroundAnchor'),
            highlightTag: typeof o.highlightTag === 'string' ? o.highlightTag : '',
            highlightAnchor: guiReadAnchorField(o, 'highlightAnchor')
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
            backgroundAnchor
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
            enabled: o.enabled !== false
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
        verbs,
        availableVerbs: effectiveVerbs,
        animations
    };
}
