import * as fs from 'fs';
import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';

type IdContext = 'prop' | 'hotspot' | 'region' | 'mixed';

interface RoomIds {
    props: Set<string>;
    hotspots: Set<string>;
    regions: Set<string>;
    points: Set<string>;
}

interface GameIds {
    signature: string;
    byRoom: Map<string, RoomIds>;
    allProps: Set<string>;
    allHotspots: Set<string>;
    allRegions: Set<string>;
    characters: Set<string>;
}

let cachedIds: GameIds | undefined;

function roomIdFromRoomScriptPath(fileName: string): string | undefined {
    const normalized = fileName.replace(/\\/g, '/');
    const match = normalized.match(/\/src\/game\/rooms\/([^/]+)\/\1\.room\.ts$/i);
    return match?.[1];
}

function detectIdContext(lineBefore: string): IdContext | undefined {
    if (/whenGive\s*\(\s*(['"])[^'"]*\1\s*,\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'prop';
    }
    if (/whenVerb\s*\(\s*(['"])[^'"]*\1\s*,\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'mixed';
    }
    if (/B\.prop\s*\(\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'prop';
    }
    if (/B\.hotspot\s*\(\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'hotspot';
    }
    if (/B\.region\s*\(\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'region';
    }
    if (/when(?:Enter|Exit)Region\s*\(\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'region';
    }
    if (/\.(?:walkTo|moveTo|moveToNow)(?:\.now)?\s*\(\s*(['"])[\w-]*$/.test(lineBefore)) {
        return 'mixed';
    }
    if (
        /when(?:LookAt|Use|PickUp|Push|Pull|Open|Close|TalkTo|InventoryUsedOn)\s*\(\s*(['"])[\w-]*$/.test(
            lineBefore,
        )
    ) {
        return 'mixed';
    }
    return undefined;
}

function idsFromArray(value: unknown): Set<string> {
    const ids = new Set<string>();
    if (!Array.isArray(value)) {
        return ids;
    }
    for (const item of value) {
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
            const id = (item as { id: string }).id;
            if (id.length > 0) {
                ids.add(id);
            }
        }
    }
    return ids;
}

function readRoomIds(roomJsonPath: string): RoomIds {
    try {
        const data = JSON.parse(fs.readFileSync(roomJsonPath, 'utf8')) as {
            props?: unknown;
            hotspots?: unknown;
            regions?: unknown;
            points?: unknown;
        };
        return {
            props: idsFromArray(data.props),
            hotspots: idsFromArray(data.hotspots),
            regions: idsFromArray(data.regions),
            points: idsFromArray(data.points),
        };
    } catch {
        return {
            props: new Set(),
            hotspots: new Set(),
            regions: new Set(),
            points: new Set(),
        };
    }
}

function listCharacterIds(charactersDir: string): { signature: string; ids: Set<string> } {
    const ids = new Set<string>();
    const stamps: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(charactersDir, { withFileTypes: true });
    } catch {
        return { signature: 'characters:missing', ids };
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const jsonPath = path.join(charactersDir, entry.name, `${entry.name}.character.json`);
        try {
            const stat = fs.statSync(jsonPath);
            stamps.push(`${entry.name}:${stat.mtimeMs}`);
            ids.add(entry.name);
        } catch {
            // not a character folder
        }
    }
    return { signature: stamps.join('|'), ids };
}

function loadGameIds(roomScriptPath: string): GameIds | undefined {
    const normalized = roomScriptPath.replace(/\\/g, '/');
    const roomsDirMatch = normalized.match(/^(.*)\/src\/game\/rooms\/[^/]+\/[^/]+\.room\.ts$/i);
    if (!roomsDirMatch) {
        return undefined;
    }
    const roomsDir = roomsDirMatch[1] + '/src/game/rooms';
    const charactersDir = path.join(path.dirname(roomsDir), 'characters');
    let roomEntries: fs.Dirent[];
    try {
        roomEntries = fs.readdirSync(roomsDir, { withFileTypes: true });
    } catch {
        return undefined;
    }
    roomEntries.sort((a, b) => a.name.localeCompare(b.name));
    const stamps: string[] = [];
    const roomJsonPaths: Array<{ id: string; jsonPath: string; mtimeMs: number }> = [];
    for (const entry of roomEntries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const jsonPath = path.join(roomsDir, entry.name, `${entry.name}.room.json`);
        try {
            const stat = fs.statSync(jsonPath);
            stamps.push(`${entry.name}:${stat.mtimeMs}`);
            roomJsonPaths.push({ id: entry.name, jsonPath, mtimeMs: stat.mtimeMs });
        } catch {
            // not a room folder
        }
    }
    const characters = listCharacterIds(charactersDir);
    const signature = `${stamps.join('|')}#${characters.signature}`;
    if (cachedIds && cachedIds.signature === signature) {
        return cachedIds;
    }

    const byRoom = new Map<string, RoomIds>();
    const allProps = new Set<string>();
    const allHotspots = new Set<string>();
    const allRegions = new Set<string>();
    for (const room of roomJsonPaths) {
        const ids = readRoomIds(room.jsonPath);
        byRoom.set(room.id, ids);
        for (const id of ids.props) {
            allProps.add(id);
        }
        for (const id of ids.hotspots) {
            allHotspots.add(id);
        }
        for (const id of ids.regions) {
            allRegions.add(id);
        }
    }
    cachedIds = {
        signature,
        byRoom,
        allProps,
        allHotspots,
        allRegions,
        characters: characters.ids,
    };
    return cachedIds;
}

function literalOf(entry: ts.CompletionEntry): string {
    const raw = entry.insertText ?? entry.name;
    const quoted = raw.match(/^(['"])([\s\S]*)\1$/);
    return quoted ? quoted[2] : raw;
}

function allowLiteral(literal: string, context: IdContext, room: RoomIds, game: GameIds): boolean {
    if (context === 'prop') {
        return room.props.has(literal);
    }
    if (context === 'hotspot') {
        return room.hotspots.has(literal);
    }
    if (context === 'region') {
        return room.regions.has(literal);
    }
    if (room.points.has(literal) || game.characters.has(literal)) {
        return true;
    }
    if (room.props.has(literal) || room.hotspots.has(literal) || room.regions.has(literal)) {
        return true;
    }
    return !(game.allProps.has(literal) || game.allHotspots.has(literal) || game.allRegions.has(literal));
}

function init(modules: { typescript: typeof ts }): { create(info: ts.server.PluginCreateInfo): ts.LanguageService } {
    const typescript = modules.typescript;

    function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
        const proxy: ts.LanguageService = Object.create(null);
        for (const key of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
            const method = info.languageService[key];
            if (typeof method === 'function') {
                (proxy[key] as (...args: unknown[]) => unknown) = (...args: unknown[]) =>
                    (method as (...inner: unknown[]) => unknown).apply(info.languageService, args);
            }
        }

        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);
            const roomId = roomIdFromRoomScriptPath(fileName);
            if (!prior || !roomId) {
                return prior;
            }
            const source = info.languageService.getProgram()?.getSourceFile(fileName);
            if (!source) {
                return prior;
            }
            const before = source.getFullText().slice(0, position);
            const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
            const context = detectIdContext(lineBefore);
            if (!context) {
                return prior;
            }
            const game = loadGameIds(fileName);
            const room = game?.byRoom.get(roomId);
            if (!game || !room) {
                return prior;
            }
            const entries = prior.entries.filter((entry) => {
                if (entry.kind !== typescript.ScriptElementKind.string) {
                    return true;
                }
                return allowLiteral(literalOf(entry), context, room, game);
            });
            return { ...prior, entries };
        };

        return proxy;
    }

    return { create };
}

export = init;
