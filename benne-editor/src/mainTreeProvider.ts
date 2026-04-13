import * as vscode from 'vscode';
import {
    characterAsepriteSheetFilesComplete,
    findBenneGameFolders,
    guiAsepriteSheetFilesComplete,
    listCharacterDefinitions,
    listGuiDefinitions,
    listRoomDefinitions,
    propAsepriteAssetTooltip,
    readCharacterUsesAsepriteDisplay,
    readRoomHotspots,
    readRoomCharacters,
    readRoomPoints,
    readRoomProps,
    readGuiUsesAsepriteDisplay,
    readRoomRegions,
    resolveRoomAsepriteSheetForProps,
    roomAsepriteSheetFilesComplete,
    type RoomPropEntry
} from './gameDiscovery';

export type MainTreeNode =
    | { kind: 'hint'; key: string; message: string }
    | { kind: 'workspace'; folder: vscode.WorkspaceFolder }
    | { kind: 'roomsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'charsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'guisGroup'; folder: vscode.WorkspaceFolder }
    | {
          kind: 'room';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
          /** Missing or incomplete `images/rooms/<id>/<id>.{png,json}` under assets. */
          roomSheetIncomplete?: boolean;
      }
    | {
          kind: 'roomSubGroup';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          subGroup: 'hotspots' | 'props' | 'characters' | 'points' | 'regions';
          itemCount: number;
      }
    | {
          kind: 'prop';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          prop: RoomPropEntry;
          /** When set, prop has no matching sheet export or tag — show warning in tree. */
          propAssetTooltip?: string;
      }
    | {
          kind: 'hotspot';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          hotspotId: string;
          description?: string;
          zIndex?: number;
      }
    | {
          kind: 'roomPoint';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          pointId: string;
      }
    | {
          kind: 'region';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          regionId: string;
      }
    | {
          kind: 'roomCharacter';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          instanceId: string;
          characterId: string;
      }
    | {
          kind: 'character';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
          /** `display.aseprite` is true but PNG/JSON export is missing under assets. */
          characterSheetIncomplete?: boolean;
      }
    | {
          kind: 'gui';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
          /** `display.aseprite` is true but PNG/JSON export is missing under assets. */
          guiSheetIncomplete?: boolean;
      };

const warningIcon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));

function normalizeTreeFilter(raw: string): string {
    return raw.trim().toLowerCase();
}

function textMatches(haystack: string, needle: string): boolean {
    return needle.length === 0 || haystack.toLowerCase().includes(needle);
}

export class MainTreeProvider implements vscode.TreeDataProvider<MainTreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<MainTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** Raw filter text (trimmed for storage); empty means no filter. */
    private treeFilterText = '';

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeFilter(): string {
        return this.treeFilterText;
    }

    setTreeFilter(raw: string): void {
        this.treeFilterText = raw.trim();
        this.refresh();
    }

    clearTreeFilter(): void {
        this.treeFilterText = '';
        this.refresh();
    }

    private filterNeedle(): string {
        return normalizeTreeFilter(this.treeFilterText);
    }

    private isFiltering(): boolean {
        return this.filterNeedle().length > 0;
    }

    private filterRoomItems<T>(
        items: T[],
        itemMatch: (item: T) => boolean,
        roomNameOrIdMatches: boolean
    ): T[] {
        const q = this.filterNeedle();
        if (!q) {
            return items;
        }
        const filtered = items.filter(itemMatch);
        if (filtered.length > 0) {
            return filtered;
        }
        if (roomNameOrIdMatches && items.length > 0) {
            return items;
        }
        return [];
    }

    private async folderHasAnyMatchingRoom(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const rooms = await listRoomDefinitions(folder);
        for (const r of rooms) {
            if (await this.roomDeepMatches(r, q)) {
                return true;
            }
        }
        return false;
    }

    private async folderHasAnyMatchingCharacter(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const chars = await listCharacterDefinitions(folder);
        return chars.some((c) => textMatches(c.name, q) || textMatches(c.id, q));
    }

    private async folderHasAnyMatchingGui(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const guis = await listGuiDefinitions(folder);
        return guis.some((g) => textMatches(g.name, q) || textMatches(g.id, q));
    }

    private async roomDeepMatches(
        room: { uri: vscode.Uri; id: string; name: string },
        q: string
    ): Promise<boolean> {
        if (!q) {
            return true;
        }
        if (textMatches(room.name, q) || textMatches(room.id, q)) {
            return true;
        }
        try {
            const [hotspots, points, regions, props, characters] = await Promise.all([
                readRoomHotspots(room.uri),
                readRoomPoints(room.uri),
                readRoomRegions(room.uri),
                readRoomProps(room.uri),
                readRoomCharacters(room.uri)
            ]);
            for (const h of hotspots) {
                if (textMatches(h.id, q) || textMatches(h.description ?? '', q)) {
                    return true;
                }
            }
            for (const p of points) {
                if (textMatches(p.id, q)) {
                    return true;
                }
            }
            for (const r of regions) {
                if (textMatches(r.id, q)) {
                    return true;
                }
            }
            for (const p of props) {
                if (textMatches(p.id, q) || textMatches(p.tag ?? '', q)) {
                    return true;
                }
            }
            for (const c of characters) {
                if (textMatches(c.instanceId, q) || textMatches(c.characterId, q)) {
                    return true;
                }
            }
        } catch {
            return false;
        }
        return false;
    }

    getTreeItem(element: MainTreeNode): vscode.TreeItem {
        switch (element.kind) {
            case 'hint': {
                const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
                item.id = `hint:${element.key}`;
                return item;
            }
            case 'workspace': {
                const item = new vscode.TreeItem(element.folder.name, vscode.TreeItemCollapsibleState.Expanded);
                item.id = `ws:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('folder');
                item.contextValue = 'benneWorkspace';
                return item;
            }
            case 'roomsGroup': {
                const item = new vscode.TreeItem('Rooms', vscode.TreeItemCollapsibleState.Expanded);
                item.id = `roomsGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('home');
                item.contextValue = 'benneRoomsGroup';
                return item;
            }
            case 'charsGroup': {
                const item = new vscode.TreeItem('Characters', vscode.TreeItemCollapsibleState.Expanded);
                item.id = `charsGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('person');
                item.contextValue = 'benneCharsGroup';
                return item;
            }
            case 'guisGroup': {
                const item = new vscode.TreeItem('GUIs', vscode.TreeItemCollapsibleState.Expanded);
                item.id = `guisGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('window');
                item.contextValue = 'benneGuisGroup';
                return item;
            }
            case 'room': {
                const item = new vscode.TreeItem(
                    element.name,
                    this.isFiltering()
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed
                );
                item.id = `room:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                if (element.roomSheetIncomplete) {
                    item.iconPath = warningIcon;
                    item.tooltip = `Missing room Aseprite export: src/game/assets/images/rooms/${element.id}/${element.id}.png and ${element.id}.json`;
                } else {
                    item.iconPath = new vscode.ThemeIcon('symbol-structure');
                }
                item.contextValue = 'benneRoom';
                return item;
            }
            case 'roomSubGroup': {
                const labels: Record<(typeof element)['subGroup'], string> = {
                    hotspots: 'Hotspots',
                    props: 'Props',
                    characters: 'Characters',
                    points: 'Points',
                    regions: 'Regions'
                };
                const icons: Record<(typeof element)['subGroup'], string> = {
                    hotspots: 'map',
                    props: 'symbol-misc',
                    characters: 'person',
                    points: 'pinned',
                    regions: 'layout-panel'
                };
                const item = new vscode.TreeItem(
                    labels[element.subGroup],
                    this.isFiltering()
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed
                );
                item.description = String(element.itemCount);
                item.id = `roomSubGroup:${element.roomJsonUri.toString()}:${element.subGroup}`;
                item.iconPath = new vscode.ThemeIcon(icons[element.subGroup]);
                const contextBySub: Record<(typeof element)['subGroup'], string> = {
                    hotspots: 'benneRoomSubGroupHotspots',
                    props: 'benneRoomSubGroupProps',
                    characters: 'benneRoomSubGroupCharacters',
                    points: 'benneRoomSubGroupPoints',
                    regions: 'benneRoomSubGroupRegions'
                };
                item.contextValue = contextBySub[element.subGroup];
                return item;
            }
            case 'prop': {
                const label = element.prop.tag ?? element.prop.id;
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.id = `prop:${element.roomJsonUri.toString()}:${element.prop.id}`;
                item.description = element.prop.clickable === true ? 'clickable' : undefined;
                if (element.propAssetTooltip) {
                    item.iconPath = warningIcon;
                    item.tooltip = element.propAssetTooltip;
                } else {
                    item.iconPath = new vscode.ThemeIcon('symbol-misc');
                }
                item.contextValue = 'benneRoomProp';
                return item;
            }
            case 'hotspot': {
                const item = new vscode.TreeItem(element.hotspotId, vscode.TreeItemCollapsibleState.None);
                item.id = `hotspot:${element.roomJsonUri.toString()}:${element.hotspotId}`;
                const desc = element.description?.trim();
                item.description = typeof element.zIndex === 'number' ? `z ${element.zIndex}` : undefined;
                item.tooltip = desc ? `${element.hotspotId} — ${desc}` : element.hotspotId;
                item.iconPath = new vscode.ThemeIcon('map');
                item.contextValue = 'benneRoomHotspot';
                return item;
            }
            case 'roomPoint': {
                const item = new vscode.TreeItem(element.pointId, vscode.TreeItemCollapsibleState.None);
                item.id = `roomPoint:${element.roomJsonUri.toString()}:${element.pointId}`;
                item.description = 'point';
                item.iconPath = new vscode.ThemeIcon('pinned');
                item.contextValue = 'benneRoomPoint';
                return item;
            }
            case 'region': {
                const item = new vscode.TreeItem(element.regionId, vscode.TreeItemCollapsibleState.None);
                item.id = `region:${element.roomJsonUri.toString()}:${element.regionId}`;
                item.description = 'region';
                item.iconPath = new vscode.ThemeIcon('layout-panel');
                item.contextValue = 'benneRoomRegion';
                return item;
            }
            case 'roomCharacter': {
                const item = new vscode.TreeItem(element.characterId, vscode.TreeItemCollapsibleState.None);
                item.id = `roomChar:${element.roomJsonUri.toString()}:${element.instanceId}`;
                item.description = element.instanceId;
                item.tooltip = `${element.characterId} — instance ${element.instanceId}`;
                item.iconPath = new vscode.ThemeIcon('person');
                item.contextValue = 'benneRoomCharacter';
                return item;
            }
            case 'character': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `character:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                if (element.characterSheetIncomplete) {
                    item.iconPath = warningIcon;
                    item.tooltip = `Missing character Aseprite export: src/game/assets/images/characters/${element.id}/${element.id}.png and ${element.id}.json`;
                } else {
                    item.iconPath = new vscode.ThemeIcon('person');
                }
                item.contextValue = 'benneCharacter';
                return item;
            }
            case 'gui': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `gui:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                if (element.guiSheetIncomplete) {
                    item.iconPath = warningIcon;
                    item.tooltip = `Missing GUI Aseprite export: src/game/assets/images/guis/${element.id}/${element.id}.png and ${element.id}.json`;
                } else {
                    item.iconPath = new vscode.ThemeIcon('window');
                }
                item.contextValue = 'benneGui';
                return item;
            }
        }
    }

    async getChildren(element?: MainTreeNode): Promise<MainTreeNode[]> {
        const gameFolders = await findBenneGameFolders();
        if (gameFolders.length === 0) {
            return [
                {
                    kind: 'hint',
                    key: 'no-game',
                    message: 'No BENNE game (src/game/rooms) in this workspace'
                }
            ];
        }

        const fq = this.filterNeedle();

        if (!element) {
            if (gameFolders.length === 1) {
                const f = gameFolders[0];
                const nodes: MainTreeNode[] = [];
                if (!fq || (await this.folderHasAnyMatchingRoom(f, fq))) {
                    nodes.push({ kind: 'roomsGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingCharacter(f, fq))) {
                    nodes.push({ kind: 'charsGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingGui(f, fq))) {
                    nodes.push({ kind: 'guisGroup', folder: f });
                }
                if (fq && nodes.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: 'filter-empty',
                            message: '(no tree items match the filter)'
                        }
                    ];
                }
                return nodes;
            }
            if (fq) {
                const kept: MainTreeNode[] = [];
                for (const folder of gameFolders) {
                    const any =
                        (await this.folderHasAnyMatchingRoom(folder, fq)) ||
                        (await this.folderHasAnyMatchingCharacter(folder, fq)) ||
                        (await this.folderHasAnyMatchingGui(folder, fq));
                    if (any) {
                        kept.push({ kind: 'workspace', folder });
                    }
                }
                if (kept.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: 'filter-empty',
                            message: '(no tree items match the filter)'
                        }
                    ];
                }
                return kept;
            }
            return gameFolders.map((folder) => ({ kind: 'workspace', folder }));
        }

        if (element.kind === 'workspace') {
            const nodes: MainTreeNode[] = [];
            if (!fq || (await this.folderHasAnyMatchingRoom(element.folder, fq))) {
                nodes.push({ kind: 'roomsGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingCharacter(element.folder, fq))) {
                nodes.push({ kind: 'charsGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingGui(element.folder, fq))) {
                nodes.push({ kind: 'guisGroup', folder: element.folder });
            }
            if (fq && nodes.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `filter-empty-ws:${element.folder.uri}`,
                        message: '(no tree items match the filter)'
                    }
                ];
            }
            return nodes;
        }

        if (element.kind === 'roomsGroup') {
            const rooms = await listRoomDefinitions(element.folder);
            let roomList = rooms;
            if (fq) {
                const matched: typeof rooms = [];
                for (const r of rooms) {
                    if (await this.roomDeepMatches(r, fq)) {
                        matched.push(r);
                    }
                }
                roomList = matched;
            }
            if (roomList.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-rooms:${element.folder.uri}`,
                        message: fq ? '(no matching rooms)' : '(no rooms found)'
                    }
                ];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                roomList.map(async (r) => {
                    const sheetOk = await roomAsepriteSheetFilesComplete(gameRoot, r.id);
                    return {
                        kind: 'room' as const,
                        folder: element.folder,
                        id: r.id,
                        name: r.name,
                        uri: r.uri,
                        roomSheetIncomplete: !sheetOk
                    };
                })
            );
        }

        if (element.kind === 'room') {
            try {
                const [hotspots, points, regions, props, characters] = await Promise.all([
                    readRoomHotspots(element.uri),
                    readRoomPoints(element.uri),
                    readRoomRegions(element.uri),
                    readRoomProps(element.uri),
                    readRoomCharacters(element.uri)
                ]);
                const roomNameHit =
                    fq.length > 0 && (textMatches(element.name, fq) || textMatches(element.id, fq));
                const children: MainTreeNode[] = [];
                const base = {
                    folder: element.folder,
                    roomJsonUri: element.uri,
                    roomId: element.id,
                    roomName: element.name
                };
                const hotspotShow = this.filterRoomItems(
                    hotspots,
                    (h) => textMatches(h.id, fq) || textMatches(h.description ?? '', fq),
                    roomNameHit
                );
                if (hotspotShow.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'hotspots',
                        itemCount: hotspotShow.length,
                        ...base
                    });
                }
                const propsShow = this.filterRoomItems(
                    props,
                    (p) => textMatches(p.id, fq) || textMatches(p.tag ?? '', fq),
                    roomNameHit
                );
                if (propsShow.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'props',
                        itemCount: propsShow.length,
                        ...base
                    });
                }
                const charactersShow = this.filterRoomItems(
                    characters,
                    (c) => textMatches(c.instanceId, fq) || textMatches(c.characterId, fq),
                    roomNameHit
                );
                if (charactersShow.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'characters',
                        itemCount: charactersShow.length,
                        ...base
                    });
                }
                const pointsShow = this.filterRoomItems(
                    points,
                    (p) => textMatches(p.id, fq),
                    roomNameHit
                );
                if (pointsShow.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'points',
                        itemCount: pointsShow.length,
                        ...base
                    });
                }
                const regionsShow = this.filterRoomItems(
                    regions,
                    (r) => textMatches(r.id, fq),
                    roomNameHit
                );
                if (regionsShow.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'regions',
                        itemCount: regionsShow.length,
                        ...base
                    });
                }
                if (children.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-room-content:${element.uri}`,
                            message: fq
                                ? '(no matching hotspots, props, characters, points, or regions)'
                                : '(no hotspots, props, characters, points, or regions)'
                        }
                    ];
                }
                return children;
            } catch {
                return [{ kind: 'hint', key: `props-err:${element.uri}`, message: 'Could not read room JSON' }];
            }
        }

        if (element.kind === 'roomSubGroup') {
            try {
                const { folder, roomJsonUri, roomId, roomName, subGroup } = element;
                const roomNameHit =
                    fq.length > 0 && (textMatches(roomName, fq) || textMatches(roomId, fq));
                switch (subGroup) {
                    case 'hotspots': {
                        const hotspots = await readRoomHotspots(roomJsonUri);
                        const list = this.filterRoomItems(
                            hotspots,
                            (h) => textMatches(h.id, fq) || textMatches(h.description ?? '', fq),
                            roomNameHit
                        );
                        return list.map((h) => ({
                            kind: 'hotspot' as const,
                            folder,
                            roomJsonUri,
                            roomId,
                            roomName,
                            hotspotId: h.id,
                            description: h.description,
                            zIndex: h.zIndex
                        }));
                    }
                    case 'points': {
                        const plist = await readRoomPoints(roomJsonUri);
                        const list = this.filterRoomItems(
                            plist,
                            (p) => textMatches(p.id, fq),
                            roomNameHit
                        );
                        return list.map((p) => ({
                            kind: 'roomPoint' as const,
                            folder,
                            roomJsonUri,
                            roomId,
                            roomName,
                            pointId: p.id
                        }));
                    }
                    case 'regions': {
                        const rlist = await readRoomRegions(roomJsonUri);
                        const list = this.filterRoomItems(
                            rlist,
                            (r) => textMatches(r.id, fq),
                            roomNameHit
                        );
                        return list.map((r) => ({
                            kind: 'region' as const,
                            folder,
                            roomJsonUri,
                            roomId,
                            roomName,
                            regionId: r.id
                        }));
                    }
                    case 'props': {
                        const props = await readRoomProps(roomJsonUri);
                        const list = this.filterRoomItems(
                            props,
                            (p) => textMatches(p.id, fq) || textMatches(p.tag ?? '', fq),
                            roomNameHit
                        );
                        const sheet = await resolveRoomAsepriteSheetForProps(folder.uri, roomId);
                        return list.map((prop) => ({
                            kind: 'prop' as const,
                            folder,
                            roomJsonUri,
                            roomId,
                            roomName,
                            prop,
                            propAssetTooltip: propAsepriteAssetTooltip(sheet, prop, roomId)
                        }));
                    }
                    case 'characters': {
                        const list = await readRoomCharacters(roomJsonUri);
                        const filtered = this.filterRoomItems(
                            list,
                            (c) => textMatches(c.instanceId, fq) || textMatches(c.characterId, fq),
                            roomNameHit
                        );
                        return filtered.map((c) => ({
                            kind: 'roomCharacter' as const,
                            folder,
                            roomJsonUri,
                            roomId,
                            roomName,
                            instanceId: c.instanceId,
                            characterId: c.characterId
                        }));
                    }
                }
            } catch {
                return [
                    { kind: 'hint', key: `subgroup-err:${element.roomJsonUri}`, message: 'Could not read room JSON' }
                ];
            }
        }

        if (element.kind === 'charsGroup') {
            const chars = await listCharacterDefinitions(element.folder);
            const charList = fq
                ? chars.filter((c) => textMatches(c.name, fq) || textMatches(c.id, fq))
                : chars;
            if (charList.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-chars:${element.folder.uri}`,
                        message: fq ? '(no matching characters)' : '(no characters found)'
                    }
                ];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                charList.map(async (c) => {
                    const usesAseprite = await readCharacterUsesAsepriteDisplay(c.uri);
                    const sheetOk = usesAseprite
                        ? await characterAsepriteSheetFilesComplete(gameRoot, c.id)
                        : true;
                    return {
                        kind: 'character' as const,
                        folder: element.folder,
                        id: c.id,
                        name: c.name,
                        uri: c.uri,
                        characterSheetIncomplete: usesAseprite && !sheetOk
                    };
                })
            );
        }

        if (element.kind === 'guisGroup') {
            const guis = await listGuiDefinitions(element.folder);
            const guiList = fq
                ? guis.filter((g) => textMatches(g.name, fq) || textMatches(g.id, fq))
                : guis;
            if (guiList.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-guis:${element.folder.uri}`,
                        message: fq ? '(no matching GUIs)' : '(no GUIs found)'
                    }
                ];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                guiList.map(async (g) => {
                    const usesAseprite = await readGuiUsesAsepriteDisplay(g.uri);
                    const sheetOk = usesAseprite
                        ? await guiAsepriteSheetFilesComplete(gameRoot, g.id)
                        : true;
                    return {
                        kind: 'gui' as const,
                        folder: element.folder,
                        id: g.id,
                        name: g.name,
                        uri: g.uri,
                        guiSheetIncomplete: usesAseprite && !sheetOk
                    };
                })
            );
        }

        return [];
    }
}
