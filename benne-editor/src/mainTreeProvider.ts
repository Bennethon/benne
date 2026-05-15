import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    characterAsepriteSheetFilesComplete,
    findBenneGameFolders,
    guiAsepriteSheetFilesComplete,
    listCharacterDefinitions,
    listGuiDefinitions,
    listDialogDefinitions,
    listInventoryDefinitions,
    listPdcDefinitions,
    listRoomDefinitions,
    propAsepriteAssetTooltip,
    readCharacterUsesAsepriteDisplay,
    readRoomHotspots,
    readRoomCharacters,
    readRoomPoints,
    readRoomProps,
    readGuiUsesAsepriteDisplay,
    readInventoryDisplayAseprite,
    readRoomRegions,
    readRoomWalkablePolygons,
    resolveRoomAsepriteSheetForProps,
    perItemInventorySheetFilesComplete,
    roomAsepriteSheetFilesComplete,
    sharedInventorySheetFilesComplete,
    type RoomPropEntry
} from './gameDiscovery';

function gameConfigJsonUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, 'src', 'game', 'game-config.json');
}

function globalScriptTsUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, 'src', 'game', 'globalScript.ts');
}

export type MainTreeNode =
    | { kind: 'hint'; key: string; message: string }
    | { kind: 'workspace'; folder: vscode.WorkspaceFolder }
    | { kind: 'gameConfig'; folder: vscode.WorkspaceFolder; uri: vscode.Uri }
    | { kind: 'globalScript'; folder: vscode.WorkspaceFolder; uri: vscode.Uri }
    | { kind: 'roomsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'charsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'guisGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'inventoryGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'dialogsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'pdcsGroup'; folder: vscode.WorkspaceFolder }
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
          kind: 'walkableAreasRoot';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
      }
    | {
          kind: 'walkablePolygon';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          polygonId: string;
          holeCount: number;
      }
    | {
          kind: 'walkableHole';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          polygonId: string;
          holeId: string;
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
      }
    | {
          kind: 'guiControl';
          folder: vscode.WorkspaceFolder;
          guiUri: vscode.Uri;
          guiId: string;
          guiName: string;
          controlIndex: number;
          /** Same key as GUI Inspector control cards (`type:id:index`). */
          controlKey: string;
          typeLabel: string;
          controlId: string;
      }
    | {
          kind: 'inventoryItem';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
          /** Shared sheet missing when `display.aseprite` is `"shared"`, or per-item export missing when `true`. */
          inventorySheetIncomplete?: boolean;
      }
    | {
          kind: 'dialog';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
      }
    | {
          kind: 'pdc';
          folder: vscode.WorkspaceFolder;
          id: string;
          name: string;
          uri: vscode.Uri;
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

    constructor(private readonly selection: EditorSelection) {}

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

    private async guiJsonControlsMatchQuery(uri: vscode.Uri, q: string): Promise<boolean> {
        if (!q) {
            return false;
        }
        try {
            const raw = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder('utf-8').decode(raw);
            const data = JSON.parse(text) as Record<string, unknown>;
            const controlsRaw = data.controls;
            if (!Array.isArray(controlsRaw)) {
                return false;
            }
            for (let i = 0; i < controlsRaw.length; i += 1) {
                const row = controlsRaw[i];
                if (!row || typeof row !== 'object' || Array.isArray(row)) {
                    continue;
                }
                const o = row as Record<string, unknown>;
                const type = typeof o.type === 'string' ? o.type : 'control';
                const id = typeof o.id === 'string' ? o.id : '';
                if (textMatches(type, q) || textMatches(id, q)) {
                    return true;
                }
            }
        } catch {
            return false;
        }
        return false;
    }

    private async guiDefinitionMatchesFilter(
        g: { uri: vscode.Uri; id: string; name: string },
        q: string
    ): Promise<boolean> {
        if (!q) {
            return true;
        }
        if (textMatches(g.name, q) || textMatches(g.id, q)) {
            return true;
        }
        return this.guiJsonControlsMatchQuery(g.uri, q);
    }

    private async folderHasAnyMatchingGui(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const guis = await listGuiDefinitions(folder);
        for (const g of guis) {
            if (await this.guiDefinitionMatchesFilter(g, q)) {
                return true;
            }
        }
        return false;
    }

    private async folderHasAnyMatchingInventory(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const items = await listInventoryDefinitions(folder);
        return items.some((it) => textMatches(it.name, q) || textMatches(it.id, q));
    }

    private async folderHasAnyMatchingDialog(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const dialogs = await listDialogDefinitions(folder);
        return dialogs.some((d) => textMatches(d.name, q) || textMatches(d.id, q));
    }

    private async folderHasAnyMatchingPdc(folder: vscode.WorkspaceFolder, q: string): Promise<boolean> {
        if (!q) {
            return true;
        }
        const pdcs = await listPdcDefinitions(folder);
        return pdcs.some((p) => textMatches(p.name, q) || textMatches(p.id, q));
    }

    /** Filter match for the fixed "Game Config" tree row (`src/game/game-config.json`). */
    private gameConfigMatchesFilter(q: string): boolean {
        if (!q) {
            return true;
        }
        return (
            textMatches('game config', q) ||
            textMatches('game-config', q) ||
            textMatches('gameconfig', q) ||
            textMatches('game-config.json', q)
        );
    }

    /** Filter match for the fixed "Global Script" tree row (`src/game/globalScript.ts`). */
    private globalScriptMatchesFilter(q: string): boolean {
        if (!q) {
            return true;
        }
        return (
            textMatches('global script', q) ||
            textMatches('globalscript', q) ||
            textMatches('global-script', q) ||
            textMatches('globalscript.ts', q) ||
            textMatches('global script.ts', q)
        );
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
            const [hotspots, points, regions, props, characters, walkPolys] = await Promise.all([
                readRoomHotspots(room.uri),
                readRoomPoints(room.uri),
                readRoomRegions(room.uri),
                readRoomProps(room.uri),
                readRoomCharacters(room.uri),
                readRoomWalkablePolygons(room.uri)
            ]);
            for (const wp of walkPolys) {
                if (textMatches(wp.id, q)) {
                    return true;
                }
                for (const ho of wp.holes) {
                    if (textMatches(ho.id, q)) {
                        return true;
                    }
                }
            }
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
            case 'gameConfig': {
                const item = new vscode.TreeItem('Game Config', vscode.TreeItemCollapsibleState.None);
                item.id = `gameConfig:${element.folder.uri.toString()}`;
                item.resourceUri = element.uri;
                item.iconPath = new vscode.ThemeIcon('settings-gear');
                item.contextValue = 'benneGameConfig';
                return item;
            }
            case 'globalScript': {
                const item = new vscode.TreeItem('Global Script', vscode.TreeItemCollapsibleState.None);
                item.id = `globalScript:${element.folder.uri.toString()}`;
                item.resourceUri = element.uri;
                item.iconPath = new vscode.ThemeIcon('code');
                item.contextValue = 'benneGlobalScript';
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
            case 'inventoryGroup': {
                const item = new vscode.TreeItem('Inventory', vscode.TreeItemCollapsibleState.Expanded);
                item.id = `inventoryGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('package');
                item.contextValue = 'benneInventoryGroup';
                return item;
            }
            case 'dialogsGroup': {
                const item = new vscode.TreeItem('Dialogs', vscode.TreeItemCollapsibleState.Expanded);
                item.id = `dialogsGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('comment-discussion');
                item.contextValue = 'benneDialogsGroup';
                return item;
            }
            case 'pdcsGroup': {
                const item = new vscode.TreeItem(
                    'Puzzle Dependency Charts',
                    vscode.TreeItemCollapsibleState.Expanded
                );
                item.id = `pdcsGroup:${element.folder.uri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('git-merge');
                item.contextValue = 'bennePdcsGroup';
                return item;
            }
            case 'room': {
                const isFocusedRoom =
                    this.selection.focus.kind === 'room' &&
                    this.selection.focus.uri.toString() === element.uri.toString();
                const roomCollapsible = this.isFiltering()
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : isFocusedRoom
                      ? vscode.TreeItemCollapsibleState.Expanded
                      : vscode.TreeItemCollapsibleState.Collapsed;
                const item = new vscode.TreeItem(element.name, roomCollapsible);
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
            case 'walkableAreasRoot': {
                const item = new vscode.TreeItem(
                    'Walkable areas',
                    this.isFiltering()
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed
                );
                item.id = `walkableRoot:${element.roomJsonUri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('map');
                item.contextValue = 'benneWalkableAreasRoot';
                return item;
            }
            case 'walkablePolygon': {
                const state =
                    element.holeCount > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None;
                const item = new vscode.TreeItem(element.polygonId, state);
                item.id = `walkPoly:${element.roomJsonUri.toString()}:${element.polygonId}`;
                item.description = 'walkable';
                item.iconPath = new vscode.ThemeIcon('symbol-interface');
                item.contextValue = 'benneWalkablePolygon';
                return item;
            }
            case 'walkableHole': {
                const item = new vscode.TreeItem(element.holeId, vscode.TreeItemCollapsibleState.None);
                item.id = `walkHole:${element.roomJsonUri.toString()}:${element.polygonId}:${element.holeId}`;
                item.description = 'hole';
                item.iconPath = new vscode.ThemeIcon('debug-breakpoint-data-unverified');
                item.contextValue = 'benneWalkableHole';
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
                const item = new vscode.TreeItem(
                    element.name,
                    this.isFiltering()
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed
                );
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
            case 'guiControl': {
                const label = element.controlId
                    ? `${element.typeLabel} (${element.controlId})`
                    : `${element.typeLabel} (#${element.controlIndex + 1})`;
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.id = `guiControl:${element.guiUri.toString()}:${element.controlKey}`;
                item.iconPath = new vscode.ThemeIcon('symbol-field');
                item.contextValue = 'benneGuiControl';
                item.tooltip = `${element.guiName} — ${element.controlKey}`;
                return item;
            }
            case 'inventoryItem': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `inventory:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                if (element.inventorySheetIncomplete) {
                    item.iconPath = warningIcon;
                    item.tooltip = `Missing inventory Aseprite export for "${element.id}" (shared or per-item sheet)`;
                } else {
                    item.iconPath = new vscode.ThemeIcon('package');
                }
                item.contextValue = 'benneInventoryItem';
                return item;
            }
            case 'dialog': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `dialog:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                item.iconPath = new vscode.ThemeIcon('comment-discussion');
                item.contextValue = 'benneDialog';
                item.description = element.id;
                return item;
            }
            case 'pdc': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `pdc:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                item.iconPath = new vscode.ThemeIcon('git-merge');
                item.contextValue = 'bennePdc';
                item.description = element.id;
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
                if (!fq || this.gameConfigMatchesFilter(fq)) {
                    nodes.push({ kind: 'gameConfig', folder: f, uri: gameConfigJsonUri(f) });
                }
                if (!fq || this.globalScriptMatchesFilter(fq)) {
                    nodes.push({ kind: 'globalScript', folder: f, uri: globalScriptTsUri(f) });
                }
                if (!fq || (await this.folderHasAnyMatchingRoom(f, fq))) {
                    nodes.push({ kind: 'roomsGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingCharacter(f, fq))) {
                    nodes.push({ kind: 'charsGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingGui(f, fq))) {
                    nodes.push({ kind: 'guisGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingInventory(f, fq))) {
                    nodes.push({ kind: 'inventoryGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingDialog(f, fq))) {
                    nodes.push({ kind: 'dialogsGroup', folder: f });
                }
                if (!fq || (await this.folderHasAnyMatchingPdc(f, fq))) {
                    nodes.push({ kind: 'pdcsGroup', folder: f });
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
                        this.gameConfigMatchesFilter(fq) ||
                        this.globalScriptMatchesFilter(fq) ||
                        (await this.folderHasAnyMatchingRoom(folder, fq)) ||
                        (await this.folderHasAnyMatchingCharacter(folder, fq)) ||
                        (await this.folderHasAnyMatchingGui(folder, fq)) ||
                        (await this.folderHasAnyMatchingInventory(folder, fq)) ||
                        (await this.folderHasAnyMatchingDialog(folder, fq)) ||
                        (await this.folderHasAnyMatchingPdc(folder, fq));
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
            if (!fq || this.gameConfigMatchesFilter(fq)) {
                nodes.push({
                    kind: 'gameConfig',
                    folder: element.folder,
                    uri: gameConfigJsonUri(element.folder)
                });
            }
            if (!fq || this.globalScriptMatchesFilter(fq)) {
                nodes.push({
                    kind: 'globalScript',
                    folder: element.folder,
                    uri: globalScriptTsUri(element.folder)
                });
            }
            if (!fq || (await this.folderHasAnyMatchingRoom(element.folder, fq))) {
                nodes.push({ kind: 'roomsGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingCharacter(element.folder, fq))) {
                nodes.push({ kind: 'charsGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingGui(element.folder, fq))) {
                nodes.push({ kind: 'guisGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingInventory(element.folder, fq))) {
                nodes.push({ kind: 'inventoryGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingDialog(element.folder, fq))) {
                nodes.push({ kind: 'dialogsGroup', folder: element.folder });
            }
            if (!fq || (await this.folderHasAnyMatchingPdc(element.folder, fq))) {
                nodes.push({ kind: 'pdcsGroup', folder: element.folder });
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

        if (element.kind === 'gameConfig') {
            return [];
        }

        if (element.kind === 'globalScript') {
            return [];
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
                const [hotspots, points, regions, props, characters, walkPolys] = await Promise.all([
                    readRoomHotspots(element.uri),
                    readRoomPoints(element.uri),
                    readRoomRegions(element.uri),
                    readRoomProps(element.uri),
                    readRoomCharacters(element.uri),
                    readRoomWalkablePolygons(element.uri)
                ]);
                const roomNameHit =
                    fq.length > 0 && (textMatches(element.name, fq) || textMatches(element.id, fq));
                const base = {
                    folder: element.folder,
                    roomJsonUri: element.uri,
                    roomId: element.id,
                    roomName: element.name
                };
                const children: MainTreeNode[] = [
                    {
                        kind: 'walkableAreasRoot' as const,
                        ...base
                    }
                ];
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
                if (children.length === 1 && !fq) {
                    const walkFilteredEmpty =
                        this.filterRoomItems(
                            walkPolys,
                            (wp) =>
                                textMatches(wp.id, fq) ||
                                wp.holes.some((ho) => textMatches(ho.id, fq)),
                            roomNameHit
                        ).length === 0;
                    if (walkFilteredEmpty) {
                        return [
                            children[0],
                            {
                                kind: 'hint',
                                key: `no-room-content:${element.uri}`,
                                message: '(no hotspots, props, characters, points, or regions)'
                            }
                        ];
                    }
                }
                return children;
            } catch {
                return [{ kind: 'hint', key: `props-err:${element.uri}`, message: 'Could not read room JSON' }];
            }
        }

        if (element.kind === 'walkableAreasRoot') {
            try {
                const { folder, roomJsonUri, roomId, roomName } = element;
                const roomNameHit =
                    fq.length > 0 && (textMatches(roomName, fq) || textMatches(roomId, fq));
                const walkPolys = await readRoomWalkablePolygons(roomJsonUri);
                const list = this.filterRoomItems(
                    walkPolys,
                    (wp) =>
                        textMatches(wp.id, fq) || wp.holes.some((ho) => textMatches(ho.id, fq)),
                    roomNameHit
                );
                if (list.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-walk:${roomJsonUri}`,
                            message: fq ? '(no matching walkable polygons)' : '(no walkable polygons)'
                        }
                    ];
                }
                return list.map((wp) => ({
                    kind: 'walkablePolygon' as const,
                    folder,
                    roomJsonUri,
                    roomId,
                    roomName,
                    polygonId: wp.id,
                    holeCount: wp.holes.length
                }));
            } catch {
                return [
                    { kind: 'hint', key: `walk-err:${element.roomJsonUri}`, message: 'Could not read room JSON' }
                ];
            }
        }

        if (element.kind === 'walkablePolygon') {
            try {
                const walkPolys = await readRoomWalkablePolygons(element.roomJsonUri);
                const poly = walkPolys.find((p) => p.id === element.polygonId);
                if (!poly || poly.holes.length === 0) {
                    return [];
                }
                const { folder, roomJsonUri, roomId, roomName, polygonId } = element;
                const roomNameHit =
                    fq.length > 0 && (textMatches(roomName, fq) || textMatches(roomId, fq));
                const holes = this.filterRoomItems(
                    poly.holes,
                    (ho) => textMatches(ho.id, fq),
                    roomNameHit
                );
                return holes.map((ho) => ({
                    kind: 'walkableHole' as const,
                    folder,
                    roomJsonUri,
                    roomId,
                    roomName,
                    polygonId,
                    holeId: ho.id
                }));
            } catch {
                return [];
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
            let guiList = guis;
            if (fq) {
                const matched: typeof guis = [];
                for (const g of guis) {
                    if (await this.guiDefinitionMatchesFilter(g, fq)) {
                        matched.push(g);
                    }
                }
                guiList = matched;
            }
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

        if (element.kind === 'gui') {
            try {
                const raw = await vscode.workspace.fs.readFile(element.uri);
                const text = new TextDecoder('utf-8').decode(raw);
                const data = JSON.parse(text) as Record<string, unknown>;
                const controlsRaw = data.controls;
                if (!Array.isArray(controlsRaw) || controlsRaw.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-gui-controls:${element.uri}`,
                            message: fq ? '(no matching controls)' : '(no controls in this GUI)'
                        }
                    ];
                }
                const guiNameHit = fq.length > 0 && (textMatches(element.name, fq) || textMatches(element.id, fq));
                const all: MainTreeNode[] = [];
                for (let i = 0; i < controlsRaw.length; i += 1) {
                    const row = controlsRaw[i];
                    if (!row || typeof row !== 'object' || Array.isArray(row)) {
                        continue;
                    }
                    const o = row as Record<string, unknown>;
                    const type = typeof o.type === 'string' ? o.type : 'control';
                    const id = typeof o.id === 'string' ? o.id : '';
                    const controlKey = `${type}:${id}:${i}`;
                    all.push({
                        kind: 'guiControl' as const,
                        folder: element.folder,
                        guiUri: element.uri,
                        guiId: element.id,
                        guiName: element.name,
                        controlIndex: i,
                        controlKey,
                        typeLabel: type,
                        controlId: id
                    });
                }
                if (all.length === 0) {
                    return [
                        {
                            kind: 'hint',
                            key: `no-gui-controls:${element.uri}`,
                            message: fq ? '(no matching controls)' : '(no controls in this GUI)'
                        }
                    ];
                }
                if (!fq) {
                    return all;
                }
                const matched = all.filter(
                    (n) =>
                        n.kind === 'guiControl' &&
                        (guiNameHit || textMatches(n.typeLabel, fq) || textMatches(n.controlId, fq))
                );
                if (matched.length > 0) {
                    return matched;
                }
                if (guiNameHit) {
                    return all;
                }
                return [
                    {
                        kind: 'hint',
                        key: `no-gui-controls-filter:${element.uri}`,
                        message: '(no matching controls)'
                    }
                ];
            } catch {
                return [{ kind: 'hint', key: `gui-ctrl-err:${element.uri}`, message: 'Could not read GUI JSON' }];
            }
        }

        if (element.kind === 'inventoryGroup') {
            const items = await listInventoryDefinitions(element.folder);
            const itemList = fq
                ? items.filter((it) => textMatches(it.name, fq) || textMatches(it.id, fq))
                : items;
            if (itemList.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-inventory:${element.folder.uri}`,
                        message: fq ? '(no matching inventory entries)' : '(no inventory entries found)'
                    }
                ];
            }
            const gameRoot = element.folder.uri;
            return Promise.all(
                itemList.map(async (it) => {
                    const mode = await readInventoryDisplayAseprite(it.uri);
                    let sheetOk = true;
                    if (mode === 'shared') {
                        sheetOk = await sharedInventorySheetFilesComplete(gameRoot);
                    } else if (mode === true) {
                        sheetOk = await perItemInventorySheetFilesComplete(gameRoot, it.id);
                    }
                    return {
                        kind: 'inventoryItem' as const,
                        folder: element.folder,
                        id: it.id,
                        name: it.name,
                        uri: it.uri,
                        inventorySheetIncomplete: mode !== undefined && !sheetOk
                    };
                })
            );
        }

        if (element.kind === 'dialogsGroup') {
            const dialogs = await listDialogDefinitions(element.folder);
            const dialogList = fq
                ? dialogs.filter((d) => textMatches(d.name, fq) || textMatches(d.id, fq))
                : dialogs;
            if (dialogList.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-dialogs:${element.folder.uri}`,
                        message: fq ? '(no matching dialogs)' : '(no dialogs found)'
                    }
                ];
            }
            return dialogList.map((d) => ({
                kind: 'dialog' as const,
                folder: element.folder,
                id: d.id,
                name: d.name,
                uri: d.uri
            }));
        }

        if (element.kind === 'pdcsGroup') {
            const pdcs = await listPdcDefinitions(element.folder);
            const list = fq ? pdcs.filter((p) => textMatches(p.name, fq) || textMatches(p.id, fq)) : pdcs;
            if (list.length === 0) {
                return [
                    {
                        kind: 'hint',
                        key: `no-pdcs:${element.folder.uri}`,
                        message: fq ? '(no matching puzzle charts)' : '(no puzzle charts found)'
                    }
                ];
            }
            return list.map((p) => ({
                kind: 'pdc' as const,
                folder: element.folder,
                id: p.id,
                name: p.name,
                uri: p.uri
            }));
        }

        return [];
    }
}
