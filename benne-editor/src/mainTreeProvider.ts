import * as vscode from 'vscode';
import {
    characterAsepriteSheetFilesComplete,
    findBenneGameFolders,
    listCharacterDefinitions,
    listRoomDefinitions,
    propAsepriteAssetTooltip,
    readCharacterUsesAsepriteDisplay,
    readRoomHotspots,
    readRoomPoints,
    readRoomProps,
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
          kind: 'character';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
          /** `display.aseprite` is true but PNG/JSON export is missing under assets. */
          characterSheetIncomplete?: boolean;
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
                    { kind: 'charsGroup', folder: f }
                ];
            }
            return gameFolders.map((folder) => ({ kind: 'workspace', folder }));
        }

        if (element.kind === 'workspace') {
            return [
                { kind: 'roomsGroup', folder: element.folder },
                { kind: 'charsGroup', folder: element.folder }
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
                const [hotspots, points, regions, props] = await Promise.all([
                    readRoomHotspots(element.uri),
                    readRoomPoints(element.uri),
                    readRoomRegions(element.uri),
                    readRoomProps(element.uri)
                ]);
                const sheet = await resolveRoomAsepriteSheetForProps(element.folder.uri, element.id);
                const children: MainTreeNode[] = [];
                for (const h of hotspots) {
                    children.push({
                        kind: 'hotspot',
                        folder: element.folder,
                        roomJsonUri: element.uri,
                        roomId: element.id,
                        roomName: element.name,
                        hotspotId: h.id,
                        description: h.description,
                        zIndex: h.zIndex
                    });
                }
                for (const p of points) {
                    children.push({
                        kind: 'roomPoint',
                        folder: element.folder,
                        roomJsonUri: element.uri,
                        roomId: element.id,
                        roomName: element.name,
                        pointId: p.id
                    });
                }
                for (const r of regions) {
                    children.push({
                        kind: 'region',
                        folder: element.folder,
                        roomJsonUri: element.uri,
                        roomId: element.id,
                        roomName: element.name,
                        regionId: r.id
                    });
                }
                for (const prop of props) {
                    const propAssetTooltip = propAsepriteAssetTooltip(sheet, prop, element.id);
                    children.push({
                        kind: 'prop',
                        folder: element.folder,
                        roomJsonUri: element.uri,
                        roomId: element.id,
                        roomName: element.name,
                        prop,
                        propAssetTooltip
                    });
                }
                if (children.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-room-content:${element.uri}`,
                            message: '(no hotspots, points, regions, or props)'
                        }
                    ];
                }
                return children;
            } catch {
                return [{ kind: 'hint', key: `props-err:${element.uri}`, message: 'Could not read room JSON' }];
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

        return [];
    }
}
