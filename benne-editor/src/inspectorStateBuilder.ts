import * as vscode from 'vscode';
import {
    characterIdFromRoomDefinition,
    DEFAULT_GAME_VERBS,
    getRoomIdFromRoomJsonUri,
    readCharacterHooks,
    readGameConfigVerbs,
    readRoomHotspots,
    readRoomProps,
    type RoomHotspotListEntry,
    type RoomPropEntry
} from './gameDiscovery';
import { readPngDimensions } from './inspectorPngDimensions';
import {
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

export type InspectorPropCard = {
    id: string;
    tag?: string;
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

export type InspectorStatePayload = InspectorRoomState | InspectorEmptyState;

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

export async function buildInspectorState(
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
            props.push({
                id,
                tag: typeof o.tag === 'string' ? o.tag : undefined,
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
