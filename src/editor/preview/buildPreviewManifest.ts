import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import {
    getRoomAsepriteAssetPaths,
    getRoomAsepriteTextureKey,
} from '../../game/roomAseprite';
import {
    hasBundledCursorSheet,
    prefixCursorAsepriteFrameTags,
    prefixGuiAsepriteFrameTags,
    prefixPerItemInventoryAsepriteFrameTags,
    prefixRoomAsepriteFrameTags,
    readAsepriteFrameTagNamesFromRawJson,
    warnIfAnimationConfigKeysMissingFromFrameTags,
} from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import { joinGameWebviewUri } from './previewUrls';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { collectFontIdsReferencedByGuiControls, getAllGuiData } from '../../game/loadGuiData';
import {
    getAsepriteAssetPaths as getGuiAsepriteAssetPaths,
    getAsepriteTextureKey as getGuiAsepriteTextureKey,
    usesAsepriteDisplay as usesGuiAsepriteDisplay,
} from '../../game/guiAseprite';
import {
    getPerItemInventoryAsepritePaths,
    getPerItemInventoryTextureKey,
    sharedInventoryAssetPaths,
    sharedInventoryTextureKey,
    usesPerItemInventoryAseprite,
    usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import {
    getInventoryDefinition,
    getRegisteredInventoryDefinitionIds,
} from '../../engine/inventory/inventoryDefinitionRegistry';
import type { GameFontsManifest } from '../../types/fonts';
import type { GuiData, GuiInventoryPanelControl } from '../../types/gui';
import type { CharacterData } from '../../types/character';
import type { RoomCharacterInstance, RoomData, RoomPropInstance } from '../../types/room';
import type {
    RoomCharacterSpawn,
    RoomPropSpawn,
    RoomSceneStartData,
} from '../../engine/scenes/BootScene';
import { getGameSettings } from '../../engine/ConfigManager';
import { CURSOR_TEXTURE_KEY, getCursorAsepriteAssetPaths, isBenneGameCursorAsepriteEnabled } from '../../game/cursorAseprite';

export type PreviewManifest = {
    loads: PreviewLoadEntry[];
    startData: RoomSceneStartData;
    revokeObjectUrls: string[];
};

export type PreviewLoadEntry =
    | { kind: 'image'; key: string; url: string }
    | { kind: 'aseprite'; key: string; textureURL: string; atlasURL: string }
    | { kind: 'bitmapFont'; key: string; textureURL: string; dataURL: string };

async function fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`GET ${url} → ${res.status}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
}

function assertCharacterDisplay(data: CharacterData): void {
    if (usesAsepriteDisplay(data)) {
        return;
    }
    const img = data.display.defaultImage;
    if (!img || img.length === 0) {
        throw new Error(`Character '${data.id}': set display.aseprite true or display.defaultImage`);
    }
}

async function fetchCharacterData(gameRootUri: string, definitionRelativePath: string): Promise<CharacterData> {
    const normalized = definitionRelativePath.replace(/^\.?\/+/, '').replaceAll('\\', '/');
    const url = joinGameWebviewUri(gameRootUri, 'characters', normalized);
    const raw = await fetchJson(url);
    const data = raw as unknown as CharacterData;
    assertCharacterDisplay(data);
    return data;
}

/**
 * Build loader manifest + RoomScene payload using the same character/prop rules as {@link BootScene},
 * resolving assets via `fetch` against `gameRootWebviewUri` (webview URI for `src/game`).
 */
export async function buildPreviewManifest(
    room: RoomData,
    gameRootWebviewUri: string,
): Promise<PreviewManifest> {
    const revokeObjectUrls: string[] = [];
    const revokeLater = (url: string): string => {
        revokeObjectUrls.push(url);
        return url;
    };

    const assetsBase = joinGameWebviewUri(gameRootWebviewUri, 'assets');
    const loads: PreviewLoadEntry[] = [];

    const backgroundTextureKey = room.background?.image ? `bg:${room.id}` : null;
    if (room.background?.image && backgroundTextureKey) {
        loads.push({
            kind: 'image',
            key: backgroundTextureKey,
            url: joinGameWebviewUri(assetsBase, room.background.image),
        });
    }

    let sheetTagNames: readonly string[] = [];
    let roomPropsTextureKey: string | null = null;

    if (room.props?.length) {
        const paths = getRoomAsepriteAssetPaths(room.id);
        const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
        const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
        const raw = await fetchJson(jsonUrl);
        sheetTagNames = readAsepriteFrameTagNamesFromRawJson(raw);

        if (sheetTagNames.length === 0) {
            console.warn(
                `[Benne preview] Room '${room.id}' lists props but sheet has no meta.frameTags — no props will load.`,
            );
        }

        const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
        prefixRoomAsepriteFrameTags(norm, room.id);
        const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
        const atlasURL = revokeLater(URL.createObjectURL(blob));
        roomPropsTextureKey = getRoomAsepriteTextureKey(room.id);
        loads.push({
            kind: 'aseprite',
            key: roomPropsTextureKey,
            textureURL: pngUrl,
            atlasURL,
        });
    }

    const sheetTagSet = new Set(sheetTagNames);
    const propsWithSheetTags: RoomPropInstance[] =
        room.props?.filter((p) => {
            if (sheetTagSet.has(p.tag)) {
                return true;
            }
            console.warn(
                `[Benne preview] Room '${room.id}' prop '${p.id}' tag '${p.tag}' not on sheet — skipped.`,
            );
            return false;
        }) ?? [];

    for (const p of propsWithSheetTags) {
        warnIfAnimationConfigKeysMissingFromFrameTags(
            `Room '${room.id}' prop '${p.id}'`,
            sheetTagNames,
            p.animations as Record<string, unknown> | undefined,
        );
    }

    const spawns: RoomCharacterSpawn[] = [];
    const loadedAsepriteCharacterIds = new Set<string>();

    for (const inst of room.characters ?? []) {
        await queueCharacterLoads(
            inst,
            spawns,
            loadedAsepriteCharacterIds,
            gameRootWebviewUri,
            assetsBase,
            loads,
            revokeLater,
        );
    }

    const propSpawns: RoomPropSpawn[] =
        propsWithSheetTags.length > 0 && roomPropsTextureKey
            ? propsWithSheetTags.map((p) => ({
                  id: p.id,
                  textureKey: roomPropsTextureKey,
                  tag: p.tag,
                  x: p.x ?? 0,
                  y: p.y ?? 0,
                  data: p,
              }))
            : [];

    // Always queue GUI assets so the "Show GUIs" toolbar toggle can flip them on without needing
    // a preview reload. Fonts / Aseprite loads are small; keeping load-on-toggle symmetric with
    // the shipped game (see `BootScene` which also queues all GUI assets) avoids editor drift.
    const previewGuiAsepriteSheetJsonById = await queueGuiAndInventoryLoads(loads, assetsBase, revokeLater);
    await queueGameCursorLoad(loads, assetsBase, revokeLater);

    const startData: RoomSceneStartData = {
        room,
        backgroundTextureKey,
        characters: spawns,
        props: propSpawns,
        roomPropsTextureKey,
        previewGuiAsepriteSheetJsonById,
    };

    return { loads, startData, revokeObjectUrls };
}

/**
 * Mirrors the GUI / inventory font + Aseprite sheet loads that `BootScene` queues for the shipped
 * game, using fetch + object URLs so the webview can load them via Phaser's loader. Called once
 * per `buildPreviewManifest`; idempotent w.r.t. the caller (dedup happens by key inside the loader).
 */
async function queueGameCursorLoad(
    loads: PreviewLoadEntry[],
    assetsBase: string,
    revokeLater: (url: string) => string,
): Promise<void> {
    if (!isBenneGameCursorAsepriteEnabled(getGameSettings()) || !hasBundledCursorSheet()) {
        return;
    }
    try {
        const paths = getCursorAsepriteAssetPaths();
        const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
        const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
        const raw = await fetchJson(jsonUrl);
        const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
        prefixCursorAsepriteFrameTags(norm);
        const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
        const atlasURL = revokeLater(URL.createObjectURL(blob));
        loads.push({
            kind: 'aseprite',
            key: CURSOR_TEXTURE_KEY,
            textureURL: pngUrl,
            atlasURL,
        });
    } catch (err) {
        console.warn('[Benne preview] Could not queue game cursor Aseprite:', err);
    }
}

async function queueGuiAndInventoryLoads(
    loads: PreviewLoadEntry[],
    assetsBase: string,
    revokeLater: (url: string) => string,
): Promise<Record<string, Record<string, unknown>>> {
    /** Unprefixed on-disk JSON (`meta.slices`, frame tag names) for nine-slice layout in the webview. */
    const guiSheetRawById: Record<string, Record<string, unknown>> = {};
    const guis = getAllGuiData();
    const fontsManifest = gameFontsManifest as GameFontsManifest;

    for (const fontId of collectFontIdsReferencedByGuiControls()) {
        const def = fontsManifest[fontId];
        if (!def) {
            console.warn(
                `[Benne preview] GUI text references unknown font id "${fontId}" — add it to src/game/assets/fonts/fonts.json.`,
            );
            continue;
        }
        loads.push({
            kind: 'bitmapFont',
            key: fontId,
            textureURL: joinGameWebviewUri(assetsBase, `fonts/${def.textureFile}`),
            dataURL: joinGameWebviewUri(assetsBase, `fonts/${def.dataFile}`),
        });
    }

    for (const gui of guis) {
        if (!usesGuiAsepriteDisplay(gui)) {
            continue;
        }
        try {
            const paths = getGuiAsepriteAssetPaths(gui.id);
            const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
            const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
            const raw = await fetchJson(jsonUrl);
            guiSheetRawById[gui.id] = raw;
            const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
            prefixGuiAsepriteFrameTags(norm, gui.id);
            const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
            const atlasURL = revokeLater(URL.createObjectURL(blob));
            loads.push({
                kind: 'aseprite',
                key: getGuiAsepriteTextureKey(gui.id),
                textureURL: pngUrl,
                atlasURL,
            });
        } catch (err) {
            console.warn(`[Benne preview] Could not queue GUI Aseprite for "${gui.id}":`, err);
        }
    }

    if (!guisHaveInventoryPanel(guis)) {
        return guiSheetRawById;
    }

    let queuedSharedInventory = false;
    const queuedPerItemInventoryIds = new Set<string>();

    for (const id of getRegisteredInventoryDefinitionIds()) {
        const def = getInventoryDefinition(id);
        if (!def) {
            continue;
        }
        if (usesSharedInventoryAseprite(def)) {
            if (queuedSharedInventory) {
                continue;
            }
            try {
                const paths = sharedInventoryAssetPaths();
                const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
                const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
                const raw = await fetchJson(jsonUrl);
                const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
                ensureSharedInventoryTagPrefixes(norm);
                const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
                const atlasURL = revokeLater(URL.createObjectURL(blob));
                loads.push({
                    kind: 'aseprite',
                    key: sharedInventoryTextureKey,
                    textureURL: pngUrl,
                    atlasURL,
                });
                queuedSharedInventory = true;
            } catch (err) {
                console.warn(
                    '[Benne preview] Could not queue shared inventory Aseprite; GUI inventory icons may show placeholders.',
                    err,
                );
            }
        } else if (usesPerItemInventoryAseprite(def)) {
            if (queuedPerItemInventoryIds.has(id)) {
                continue;
            }
            queuedPerItemInventoryIds.add(id);
            try {
                const paths = getPerItemInventoryAsepritePaths(id);
                const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
                const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
                const raw = await fetchJson(jsonUrl);
                const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
                prefixPerItemInventoryAsepriteFrameTags(norm, id);
                const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
                const atlasURL = revokeLater(URL.createObjectURL(blob));
                loads.push({
                    kind: 'aseprite',
                    key: getPerItemInventoryTextureKey(id),
                    textureURL: pngUrl,
                    atlasURL,
                });
            } catch (err) {
                console.warn(
                    `[Benne preview] Could not queue per-item inventory Aseprite for "${id}":`,
                    err,
                );
            }
        }
    }

    return guiSheetRawById;
}

function guisHaveInventoryPanel(guis: readonly GuiData[]): boolean {
    for (const gui of guis) {
        for (const c of gui.controls ?? []) {
            if ((c as GuiInventoryPanelControl).type === 'inventoryPanel') {
                return true;
            }
        }
    }
    return false;
}

/**
 * Shared inventory sheet uses unprefixed Aseprite tag names on disk, but the engine plays clips via
 * the `inventory:<tag>` Phaser animation key (see `inventoryPhaserAnimationKeyForTag`). Mirror the
 * normalization step in `guiEditorMain.ts` so `createFromAseprite` registers those prefixed keys.
 */
function ensureSharedInventoryTagPrefixes(normalized: Record<string, unknown>): void {
    const meta = normalized.meta;
    if (!meta || typeof meta !== 'object') {
        return;
    }
    const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
    if (!Array.isArray(frameTags)) {
        return;
    }
    for (const tag of frameTags) {
        if (
            tag &&
            typeof tag.name === 'string' &&
            tag.name.length > 0 &&
            !tag.name.startsWith('inventory:')
        ) {
            tag.name = `inventory:${tag.name}`;
        }
    }
}

async function queueCharacterLoads(
    inst: RoomCharacterInstance,
    spawns: RoomCharacterSpawn[],
    loadedAsepriteCharacterIds: Set<string>,
    gameRootWebviewUri: string,
    assetsBase: string,
    loads: PreviewLoadEntry[],
    revokeLater: (u: string) => string,
): Promise<void> {
    const data = await fetchCharacterData(gameRootWebviewUri, inst.definition);

    if (usesAsepriteDisplay(data)) {
        const textureKey = getAsepriteTextureKey(data.id);
        if (!loadedAsepriteCharacterIds.has(data.id)) {
            const paths = getAsepriteAssetPaths(data.id);
            const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);
            const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
            const raw = await fetchJson(jsonUrl);
            const frameTags = readAsepriteFrameTagNamesFromRawJson(raw);
            warnIfAnimationConfigKeysMissingFromFrameTags(
                `Character '${data.id}'`,
                frameTags,
                data.animations as Record<string, unknown> | undefined,
            );
            const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
            const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
            const atlasURL = revokeLater(URL.createObjectURL(blob));
            loads.push({
                kind: 'aseprite',
                key: textureKey,
                textureURL: pngUrl,
                atlasURL,
            });
            loadedAsepriteCharacterIds.add(data.id);
        }
        spawns.push({
            instanceId: inst.instanceId,
            x: inst.x,
            y: inst.y,
            data,
            loadKind: 'aseprite',
            textureKey,
            initialFacing: inst.initialFacing,
            initialAnimation: inst.initialAnimation,
            visible: inst.visible,
            zIndex: inst.zIndex,
        });
        return;
    }

    const textureKey = `char:${inst.instanceId}`;
    loads.push({
        kind: 'image',
        key: textureKey,
        url: joinGameWebviewUri(assetsBase, data.display.defaultImage!),
    });
    spawns.push({
        instanceId: inst.instanceId,
        x: inst.x,
        y: inst.y,
        data,
        loadKind: 'image',
        textureKey,
        initialFacing: inst.initialFacing,
        initialAnimation: inst.initialAnimation,
        visible: inst.visible,
        zIndex: inst.zIndex,
    });
}
