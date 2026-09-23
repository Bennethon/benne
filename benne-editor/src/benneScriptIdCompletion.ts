import * as vscode from 'vscode';
import {
    findBenneGameFolders,
    listCharacterDefinitions,
    listDialogDefinitions,
    listGuiDefinitions,
    listInventoryDefinitions,
    listRoomDefinitions,
    readGameConfigVerbs,
    readRoomCharacters,
    readRoomHotspots,
    readRoomPoints,
    readRoomProps,
    readRoomRegions,
} from './gameDiscovery';

const SCRIPT_SELECTOR: vscode.DocumentSelector = [
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/rooms/**/*.room.ts' },
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/characters/**/*.character.ts' },
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/inventory/**/*.inventory.ts' },
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/guis/**/*.gui.ts' },
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/dialogs/**/*.dialog.ts' },
    { scheme: 'file', language: 'typescript', pattern: '**/src/game/globalScript.ts' },
];

type IdKind =
    | 'character'
    | 'prop'
    | 'dialog'
    | 'gui'
    | 'inventory'
    | 'room'
    | 'region'
    | 'hotspot'
    | 'resolvable'
    | 'verbTarget'
    | 'dialogOption'
    | 'verb';

interface IdMatch {
    kind: IdKind;
    partial: string;
    quote: '"' | "'";
    roomId?: string;
    dialogId?: string;
}

interface IdSuggestion {
    id: string;
    label?: string;
    detail?: string;
    description?: string;
}

function roomIdFromRoomScriptUri(uri: vscode.Uri): string | undefined {
    const normalized = uri.fsPath.replace(/\\/g, '/');
    const m = normalized.match(/\/src\/game\/rooms\/([^/]+)\/\1\.room\.ts$/i);
    return m?.[1];
}

function dialogIdFromDialogScriptUri(uri: vscode.Uri): string | undefined {
    const normalized = uri.fsPath.replace(/\\/g, '/');
    const m = normalized.match(/\/src\/game\/dialogs\/([^/]+)\/\1\.dialog\.ts$/i);
    return m?.[1];
}

async function resolveGameFolder(document: vscode.TextDocument): Promise<vscode.WorkspaceFolder | undefined> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (folder) {
        const rooms = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'rooms');
        try {
            const stat = await vscode.workspace.fs.stat(rooms);
            if (stat.type === vscode.FileType.Directory) {
                return folder;
            }
        } catch {
            // not a BENNE root
        }
    }
    const games = await findBenneGameFolders();
    return games[0];
}

function detectIdContext(document: vscode.TextDocument, position: vscode.Position): IdMatch | undefined {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const roomId = roomIdFromRoomScriptUri(document.uri);
    const dialogId = dialogIdFromDialogScriptUri(document.uri);

    const tryMatch = (
        re: RegExp,
        kind: IdKind,
        roomScoped?: boolean,
        dialogScoped?: boolean,
    ): IdMatch | undefined => {
        const m = before.match(re);
        if (!m) {
            return undefined;
        }
        const quote = m[1] as '"' | "'";
        const partial = m[2] ?? '';
        return {
            kind,
            partial,
            quote,
            roomId: roomScoped ? roomId : undefined,
            dialogId: dialogScoped ? dialogId : undefined,
        };
    };

    const giveSecond = before.match(/whenGive\s*\(\s*(['"])([^'"]*)\1\s*,\s*(['"])([\w-]*)$/);
    if (giveSecond) {
        return {
            kind: 'prop',
            partial: giveSecond[4] ?? '',
            quote: giveSecond[3] as '"' | "'",
            roomId,
        };
    }

    const verbSecond = before.match(/whenVerb\s*\(\s*(['"])([^'"]*)\1\s*,\s*(['"])([\w-]*)$/);
    if (verbSecond) {
        return {
            kind: 'verbTarget',
            partial: verbSecond[4] ?? '',
            quote: verbSecond[3] as '"' | "'",
            roomId,
        };
    }

    return (
        tryMatch(/whenVerb\s*\(\s*(['"])([\w-]*)$/, 'verb') ??
        tryMatch(/whenChoice\s*\(\s*(['"])([\w-]*)$/, 'dialogOption', false, true) ??
        tryMatch(/\.option(?:On|Off)(?:\.now)?\s*\(\s*(['"])([\w-]*)$/, 'dialogOption', false, true) ??
        tryMatch(/\.(?:walkTo|moveTo|moveToNow)(?:\.now)?\s*\(\s*(['"])([\w-]*)$/, 'resolvable', true) ??
        tryMatch(/B\.player\.switchTo(?:\.now)?\s*\(\s*(['"])([\w-]*)$/, 'character') ??
        tryMatch(/B\.state\.setActivePlayerCharacterId\s*\(\s*(['"])([\w-]*)$/, 'character') ??
        tryMatch(/B\.room\.changeTo(?:\.now)?\s*\(\s*(['"])([\w-]*)$/, 'room') ??
        tryMatch(/B\.character\s*\(\s*(['"])([\w-]*)$/, 'character') ??
        tryMatch(/B\.prop\s*\(\s*(['"])([\w-]*)$/, 'prop') ??
        tryMatch(/B\.dialog\s*\(\s*(['"])([\w-]*)$/, 'dialog') ??
        tryMatch(/B\.gui\s*\(\s*(['"])([\w-]*)$/, 'gui') ??
        tryMatch(/B\.character\s*\([^)]*\)\.inventory(?:\.(?:add|remove|has|quantityOf))?\s*\(\s*(['"])([\w-]*)$/, 'inventory') ??
        tryMatch(/B\.inventory(?:\.(?:add|remove|has|quantityOf))?\s*\(\s*(['"])([\w-]*)$/, 'inventory') ??
        tryMatch(/B\.region\s*\(\s*(['"])([\w-]*)$/, 'region', true) ??
        tryMatch(/B\.hotspot\s*\(\s*(['"])([\w-]*)$/, 'hotspot', true) ??
        tryMatch(/whenEnterRegion\s*\(\s*(['"])([\w-]*)$/, 'region', true) ??
        tryMatch(/whenExitRegion\s*\(\s*(['"])([\w-]*)$/, 'region', true) ??
        tryMatch(
            /when(?:LookAt|Use|PickUp|Push|Pull|Open|Close|TalkTo|InventoryUsedOn)\s*\(\s*(['"])([\w-]*)$/,
            'verbTarget',
            true,
        ) ??
        tryMatch(/whenGive\s*\(\s*(['"])([\w-]*)$/, 'inventory')
    );
}

function uniqueSuggestions(items: IdSuggestion[]): IdSuggestion[] {
    const byId = new Map<string, IdSuggestion>();
    for (const item of items) {
        if (!byId.has(item.id)) {
            byId.set(item.id, item);
        }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function allRoomPropSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const rooms = await listRoomDefinitions(gameFolder);
    const byId = new Map<string, IdSuggestion>();
    for (const room of rooms) {
        const props = await readRoomProps(room.uri);
        for (const p of props) {
            if (!byId.has(p.id)) {
                byId.set(p.id, {
                    id: p.id,
                    label: p.id,
                    detail: p.tag ? `tag: ${p.tag}` : undefined,
                    description: `prop (${room.id})`,
                });
            }
        }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function allRoomHotspotSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const rooms = await listRoomDefinitions(gameFolder);
    const items: IdSuggestion[] = [];
    for (const room of rooms) {
        const hotspots = await readRoomHotspots(room.uri);
        for (const h of hotspots) {
            items.push({
                id: h.id,
                label: h.id,
                detail: h.description,
                description: `hotspot (${room.id})`,
            });
        }
    }
    return uniqueSuggestions(items);
}

async function allRoomRegionSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const rooms = await listRoomDefinitions(gameFolder);
    const items: IdSuggestion[] = [];
    for (const room of rooms) {
        const regions = await readRoomRegions(room.uri);
        for (const r of regions) {
            items.push({
                id: r.id,
                label: r.id,
                description: `region (${room.id})`,
            });
        }
    }
    return uniqueSuggestions(items);
}

async function allRoomPointSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const rooms = await listRoomDefinitions(gameFolder);
    const items: IdSuggestion[] = [];
    for (const room of rooms) {
        const points = await readRoomPoints(room.uri);
        for (const p of points) {
            items.push({
                id: p.id,
                label: p.id,
                description: `point (${room.id})`,
            });
        }
    }
    return uniqueSuggestions(items);
}

async function dialogOptionSuggestions(
    gameFolder: vscode.WorkspaceFolder,
    dialogId: string,
): Promise<IdSuggestion[]> {
    const uri = vscode.Uri.joinPath(
        gameFolder.uri,
        'src',
        'game',
        'dialogs',
        dialogId,
        `${dialogId}.dialog.json`,
    );
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(new TextDecoder('utf-8').decode(raw)) as {
            options?: { id?: string; text?: string }[];
        };
        if (!Array.isArray(data.options)) {
            return [];
        }
        return data.options
            .filter((o) => typeof o.id === 'string' && o.id.length > 0)
            .map((o) => ({
                id: o.id as string,
                label: o.id as string,
                detail: typeof o.text === 'string' ? o.text : undefined,
                description: `dialog option (${dialogId})`,
            }));
    } catch {
        return [];
    }
}

async function allDialogOptionSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const dialogs = await listDialogDefinitions(gameFolder);
    const items: IdSuggestion[] = [];
    for (const dialog of dialogs) {
        items.push(...(await dialogOptionSuggestions(gameFolder, dialog.id)));
    }
    return uniqueSuggestions(items);
}

async function allRoomSpawnedCharacterSuggestions(gameFolder: vscode.WorkspaceFolder): Promise<IdSuggestion[]> {
    const rooms = await listRoomDefinitions(gameFolder);
    const items: IdSuggestion[] = [];
    for (const room of rooms) {
        const chars = await readRoomCharacters(room.uri);
        for (const c of chars) {
            items.push({
                id: c.characterId,
                label: c.characterId,
                description: `character (${room.id})`,
            });
        }
    }
    return uniqueSuggestions(items);
}

async function roomPropSuggestions(
    gameFolder: vscode.WorkspaceFolder,
    roomId: string,
): Promise<IdSuggestion[]> {
    const uri = await roomJsonUri(gameFolder, roomId);
    if (!uri) {
        return [];
    }
    const props = await readRoomProps(uri);
    return props
        .map((p) => ({
            id: p.id,
            label: p.id,
            detail: p.tag ? `tag: ${p.tag}` : undefined,
            description: 'prop',
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

async function roomJsonUri(gameFolder: vscode.WorkspaceFolder, roomId: string): Promise<vscode.Uri | undefined> {
    const uri = vscode.Uri.joinPath(
        gameFolder.uri,
        'src',
        'game',
        'rooms',
        roomId,
        `${roomId}.room.json`,
    );
    try {
        await vscode.workspace.fs.stat(uri);
        return uri;
    } catch {
        return undefined;
    }
}

async function loadSuggestions(
    gameFolder: vscode.WorkspaceFolder,
    match: IdMatch,
): Promise<IdSuggestion[]> {
    switch (match.kind) {
        case 'character': {
            const chars = await listCharacterDefinitions(gameFolder);
            return chars.map((c) => ({
                id: c.id,
                label: c.id,
                detail: c.name,
                description: 'character',
            }));
        }
        case 'dialog': {
            const dialogs = await listDialogDefinitions(gameFolder);
            return dialogs.map((d) => ({
                id: d.id,
                label: d.id,
                detail: d.name,
                description: 'dialog',
            }));
        }
        case 'gui': {
            const guis = await listGuiDefinitions(gameFolder);
            return guis.map((g) => ({
                id: g.id,
                label: g.id,
                detail: g.name,
                description: 'gui',
            }));
        }
        case 'inventory': {
            const items = await listInventoryDefinitions(gameFolder);
            return items.map((i) => ({
                id: i.id,
                label: i.id,
                detail: i.name,
                description: 'inventory item',
            }));
        }
        case 'room': {
            const rooms = await listRoomDefinitions(gameFolder);
            return rooms.map((r) => ({
                id: r.id,
                label: r.id,
                detail: r.name,
                description: 'room',
            }));
        }
        case 'verb': {
            const verbs = await readGameConfigVerbs(gameFolder.uri);
            return verbs.map((v) => ({
                id: v.id,
                label: v.id,
                detail: v.label,
                description: 'verb',
            }));
        }
        case 'prop':
            return match.roomId
                ? roomPropSuggestions(gameFolder, match.roomId)
                : allRoomPropSuggestions(gameFolder);
        case 'hotspot':
        case 'region': {
            if (!match.roomId) {
                return match.kind === 'hotspot'
                    ? allRoomHotspotSuggestions(gameFolder)
                    : allRoomRegionSuggestions(gameFolder);
            }
            const uri = await roomJsonUri(gameFolder, match.roomId);
            if (!uri) {
                return [];
            }
            if (match.kind === 'hotspot') {
                const hotspots = await readRoomHotspots(uri);
                return hotspots.map((h) => ({
                    id: h.id,
                    label: h.id,
                    detail: h.description,
                    description: 'hotspot',
                }));
            }
            const regions = await readRoomRegions(uri);
            return regions.map((r) => ({
                id: r.id,
                label: r.id,
                description: 'region',
            }));
        }
        case 'verbTarget': {
            if (!match.roomId) {
                const props = await allRoomPropSuggestions(gameFolder);
                const hotspots = await allRoomHotspotSuggestions(gameFolder);
                const chars = await allRoomSpawnedCharacterSuggestions(gameFolder);
                return [...props, ...hotspots, ...chars].sort((a, b) => a.id.localeCompare(b.id));
            }
            const uri = await roomJsonUri(gameFolder, match.roomId);
            if (!uri) {
                return [];
            }
            const props = await readRoomProps(uri);
            const hotspots = await readRoomHotspots(uri);
            const chars = await readRoomCharacters(uri);
            const out: IdSuggestion[] = [];
            for (const p of props) {
                out.push({ id: p.id, label: p.id, description: 'prop' });
            }
            for (const h of hotspots) {
                out.push({ id: h.id, label: h.id, description: 'hotspot' });
            }
            for (const c of chars) {
                out.push({ id: c.characterId, label: c.characterId, description: 'character' });
            }
            out.sort((a, b) => a.id.localeCompare(b.id));
            return out;
        }
        case 'resolvable': {
            const appendUnique = (out: IdSuggestion[], extra: IdSuggestion[]): void => {
                for (const item of extra) {
                    if (!out.some((s) => s.id === item.id)) {
                        out.push(item);
                    }
                }
            };
            if (!match.roomId) {
                const out = [...(await allRoomPropSuggestions(gameFolder))];
                appendUnique(out, await allRoomHotspotSuggestions(gameFolder));
                appendUnique(out, await allRoomSpawnedCharacterSuggestions(gameFolder));
                appendUnique(out, await allRoomPointSuggestions(gameFolder));
                out.sort((a, b) => a.id.localeCompare(b.id));
                return out;
            }
            const uri = await roomJsonUri(gameFolder, match.roomId);
            if (!uri) {
                return [];
            }
            const props = await readRoomProps(uri);
            const hotspots = await readRoomHotspots(uri);
            const points = await readRoomPoints(uri);
            const chars = await readRoomCharacters(uri);
            const out: IdSuggestion[] = props.map((p) => ({
                id: p.id,
                label: p.id,
                detail: p.tag ? `tag: ${p.tag}` : undefined,
                description: 'prop',
            }));
            appendUnique(
                out,
                hotspots.map((h) => ({ id: h.id, label: h.id, description: 'hotspot' })),
            );
            appendUnique(
                out,
                chars.map((c) => ({ id: c.characterId, label: c.characterId, description: 'character' })),
            );
            appendUnique(
                out,
                points.map((p) => ({ id: p.id, label: p.id, description: 'point' })),
            );
            out.sort((a, b) => a.id.localeCompare(b.id));
            return out;
        }
        case 'dialogOption': {
            if (match.dialogId) {
                return dialogOptionSuggestions(gameFolder, match.dialogId);
            }
            return allDialogOptionSuggestions(gameFolder);
        }
        default:
            return [];
    }
}

function filterSuggestions(items: IdSuggestion[], partial: string): IdSuggestion[] {
    if (!partial) {
        return items;
    }
    const lower = partial.toLowerCase();
    return items.filter((s) => s.id.toLowerCase().startsWith(lower));
}

function toCompletionItems(match: IdMatch, suggestions: IdSuggestion[]): vscode.CompletionItem[] {
    return filterSuggestions(suggestions, match.partial).map((s) => {
        const item = new vscode.CompletionItem(s.id, vscode.CompletionItemKind.Value);
        item.sortText = `\u0000${s.id}`;
        if (s.detail) {
            item.detail = s.detail;
        }
        if (s.description) {
            item.documentation = new vscode.MarkdownString(
                `**${s.description}**${s.detail ? ` — ${s.detail}` : ''}`,
            );
        }
        return item;
    });
}

function stringLiteralAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
): { text: string; quoteIndex: number } | undefined {
    const line = document.lineAt(position.line).text;
    const ch = position.character;

    let quoteIndex = ch - 1;
    while (quoteIndex >= 0 && line[quoteIndex] !== '"' && line[quoteIndex] !== "'") {
        quoteIndex--;
    }
    if (quoteIndex < 0) {
        return undefined;
    }
    const quote = line[quoteIndex];
    let end = quoteIndex + 1;
    while (end < line.length) {
        if (line[end] === quote && line[end - 1] !== '\\') {
            break;
        }
        end++;
    }
    if (end >= line.length || line[end] !== quote) {
        return undefined;
    }
    if (ch - 1 <= quoteIndex || ch - 1 >= end) {
        return undefined;
    }
    return { text: line.slice(quoteIndex + 1, end), quoteIndex };
}

function detectHoverContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    quoteIndex: number,
): IdMatch | undefined {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, quoteIndex + 1);
    const roomId = roomIdFromRoomScriptUri(document.uri);
    const dialogId = dialogIdFromDialogScriptUri(document.uri);

    const patterns: Array<{ re: RegExp; kind: IdKind; roomScoped?: boolean; dialogScoped?: boolean }> = [
        { re: /whenGive\s*\(\s*(['"])[^'"]*\1\s*,\s*(['"])$/, kind: 'prop', roomScoped: true },
        { re: /whenVerb\s*\(\s*(['"])[^'"]*\1\s*,\s*(['"])$/, kind: 'verbTarget', roomScoped: true },
        { re: /whenVerb\s*\(\s*(['"])$/, kind: 'verb' },
        { re: /whenChoice\s*\(\s*(['"])$/, kind: 'dialogOption', dialogScoped: true },
        { re: /\.option(?:On|Off)(?:\.now)?\s*\(\s*(['"])$/, kind: 'dialogOption', dialogScoped: true },
        { re: /\.(?:walkTo|moveTo|moveToNow)(?:\.now)?\s*\(\s*(['"])$/, kind: 'resolvable', roomScoped: true },
        { re: /B\.player\.switchTo(?:\.now)?\s*\(\s*(['"])$/, kind: 'character' },
        { re: /B\.state\.setActivePlayerCharacterId\s*\(\s*(['"])$/, kind: 'character' },
        { re: /B\.room\.changeTo(?:\.now)?\s*\(\s*(['"])$/, kind: 'room' },
        { re: /B\.character\s*\(\s*(['"])$/, kind: 'character' },
        { re: /B\.prop\s*\(\s*(['"])$/, kind: 'prop' },
        { re: /B\.dialog\s*\(\s*(['"])$/, kind: 'dialog' },
        { re: /B\.gui\s*\(\s*(['"])$/, kind: 'gui' },
        { re: /B\.character\s*\([^)]*\)\.inventory(?:\.(?:add|remove|has|quantityOf))?\s*\(\s*(['"])$/, kind: 'inventory' },
        { re: /B\.inventory(?:\.(?:add|remove|has|quantityOf))?\s*\(\s*(['"])$/, kind: 'inventory' },
        { re: /B\.region\s*\(\s*(['"])$/, kind: 'region', roomScoped: true },
        { re: /B\.hotspot\s*\(\s*(['"])$/, kind: 'hotspot', roomScoped: true },
        { re: /whenEnterRegion\s*\(\s*(['"])$/, kind: 'region', roomScoped: true },
        { re: /whenExitRegion\s*\(\s*(['"])$/, kind: 'region', roomScoped: true },
        {
            re: /when(?:LookAt|Use|PickUp|Push|Pull|Open|Close|TalkTo|InventoryUsedOn)\s*\(\s*(['"])$/,
            kind: 'verbTarget',
            roomScoped: true,
        },
        { re: /whenGive\s*\(\s*(['"])$/, kind: 'inventory' },
    ];

    for (const { re, kind, roomScoped, dialogScoped } of patterns) {
        const m = before.match(re);
        if (m) {
            return {
                kind,
                partial: '',
                quote: (m[m.length - 1] ?? '"') as '"' | "'",
                roomId: roomScoped ? roomId : undefined,
                dialogId: dialogScoped ? dialogId : undefined,
            };
        }
    }
    return undefined;
}

export function registerBenneScriptIdCompletion(context: vscode.ExtensionContext): void {
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        SCRIPT_SELECTOR,
        {
            async provideCompletionItems(document, position) {
                const match = detectIdContext(document, position);
                if (!match) {
                    return undefined;
                }
                const gameFolder = await resolveGameFolder(document);
                if (!gameFolder) {
                    return undefined;
                }
                const suggestions = await loadSuggestions(gameFolder, match);
                return toCompletionItems(match, suggestions);
            },
        },
        "'",
        '"',
    );

    const hoverProvider = vscode.languages.registerHoverProvider(SCRIPT_SELECTOR, {
        async provideHover(document, position) {
            const literal = stringLiteralAtPosition(document, position);
            if (!literal || !literal.text) {
                return undefined;
            }
            const match = detectHoverContext(document, position, literal.quoteIndex);
            if (!match) {
                return undefined;
            }
            const gameFolder = await resolveGameFolder(document);
            if (!gameFolder) {
                return undefined;
            }
            const suggestions = await loadSuggestions(gameFolder, match);
            const hit = suggestions.find((s) => s.id === literal.text);
            if (!hit) {
                return undefined;
            }
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**${hit.label ?? hit.id}**`);
            const body = [hit.description, hit.detail].filter(Boolean).join(' — ');
            if (body) {
                md.appendMarkdown(`\n\n${body}`);
            }
            md.appendMarkdown(`\n\n\`${match.kind}\` id`);
            return new vscode.Hover(md);
        },
    });

    context.subscriptions.push(completionProvider, hoverProvider);
}
