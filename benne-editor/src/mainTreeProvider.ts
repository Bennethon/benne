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

export class MainTreeProvider implements vscode.TreeDataProvider<MainTreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<MainTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
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
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
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
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                item.description = String(element.itemCount);
                item.id = `roomSubGroup:${element.roomJsonUri.toString()}:${element.subGroup}`;
                item.iconPath = new vscode.ThemeIcon(icons[element.subGroup]);
                item.contextValue = 'benneRoomSubGroup';
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

        if (!element) {
            if (gameFolders.length === 1) {
                const f = gameFolders[0];
                return [
                    { kind: 'roomsGroup', folder: f },
                    { kind: 'charsGroup', folder: f },
                    { kind: 'guisGroup', folder: f }
                ];
            }
            return gameFolders.map((folder) => ({ kind: 'workspace', folder }));
        }

        if (element.kind === 'workspace') {
            return [
                { kind: 'roomsGroup', folder: element.folder },
                { kind: 'charsGroup', folder: element.folder },
                { kind: 'guisGroup', folder: element.folder }
            ];
        }

        if (element.kind === 'roomsGroup') {
            const rooms = await listRoomDefinitions(element.folder);
            if (rooms.length === 0) {
                return [{ kind: 'hint', key: `no-rooms:${element.folder.uri}`, message: '(no rooms found)' }];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                rooms.map(async (r) => {
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
                const children: MainTreeNode[] = [];
                const base = {
                    folder: element.folder,
                    roomJsonUri: element.uri,
                    roomId: element.id,
                    roomName: element.name
                };
                if (hotspots.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'hotspots',
                        itemCount: hotspots.length,
                        ...base
                    });
                }
                if (props.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'props',
                        itemCount: props.length,
                        ...base
                    });
                }
                if (characters.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'characters',
                        itemCount: characters.length,
                        ...base
                    });
                }
                if (points.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'points',
                        itemCount: points.length,
                        ...base
                    });
                }
                if (regions.length > 0) {
                    children.push({
                        kind: 'roomSubGroup' as const,
                        subGroup: 'regions',
                        itemCount: regions.length,
                        ...base
                    });
                }
                if (children.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-room-content:${element.uri}`,
                            message: '(no hotspots, props, characters, points, or regions)'
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
                switch (subGroup) {
                    case 'hotspots': {
                        const hotspots = await readRoomHotspots(roomJsonUri);
                        return hotspots.map((h) => ({
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
                        return plist.map((p) => ({
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
                        return rlist.map((r) => ({
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
                        const sheet = await resolveRoomAsepriteSheetForProps(folder.uri, roomId);
                        return props.map((prop) => ({
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
                        return list.map((c) => ({
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
            if (chars.length === 0) {
                return [{ kind: 'hint', key: `no-chars:${element.folder.uri}`, message: '(no characters found)' }];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                chars.map(async (c) => {
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
            if (guis.length === 0) {
                return [{ kind: 'hint', key: `no-guis:${element.folder.uri}`, message: '(no GUIs found)' }];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                guis.map(async (g) => {
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
