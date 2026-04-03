import * as vscode from 'vscode';
import {
    findBenneGameFolders,
    listCharacterDefinitions,
    listRoomDefinitions,
    readRoomProps,
    type RoomPropEntry
} from './gameDiscovery';

export type MainTreeNode =
    | { kind: 'hint'; key: string; message: string }
    | { kind: 'workspace'; folder: vscode.WorkspaceFolder }
    | { kind: 'roomsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'charsGroup'; folder: vscode.WorkspaceFolder }
    | { kind: 'room'; folder: vscode.WorkspaceFolder; id: string; name: string; uri: vscode.Uri }
    | {
          kind: 'prop';
          folder: vscode.WorkspaceFolder;
          roomJsonUri: vscode.Uri;
          roomId: string;
          roomName: string;
          prop: RoomPropEntry;
      }
    | { kind: 'character'; folder: vscode.WorkspaceFolder; id: string; name: string; uri: vscode.Uri };

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
                item.iconPath = new vscode.ThemeIcon('symbol-structure');
                item.contextValue = 'benneRoom';
                return item;
            }
            case 'prop': {
                const label = element.prop.tag ?? element.prop.id;
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.id = `prop:${element.roomJsonUri.toString()}:${element.prop.id}`;
                item.description = element.prop.clickable === true ? 'clickable' : undefined;
                item.iconPath = new vscode.ThemeIcon('symbol-misc');
                item.contextValue = 'benneRoomProp';
                return item;
            }
            case 'character': {
                const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
                item.id = `character:${element.uri.toString()}`;
                item.resourceUri = element.uri;
                item.iconPath = new vscode.ThemeIcon('person');
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
            return rooms.map((r) => ({
                kind: 'room',
                folder: element.folder,
                id: r.id,
                name: r.name,
                uri: r.uri
            }));
        }

        if (element.kind === 'room') {
            try {
                const props = await readRoomProps(element.uri);
                if (props.length === 0) {
                    return [{ kind: 'hint', key: `no-props:${element.uri}`, message: '(no props)' }];
                }
                return props.map((prop) => ({
                    kind: 'prop',
                    folder: element.folder,
                    roomJsonUri: element.uri,
                    roomId: element.id,
                    roomName: element.name,
                    prop
                }));
            } catch {
                return [{ kind: 'hint', key: `props-err:${element.uri}`, message: 'Could not read room JSON' }];
            }
        }

        if (element.kind === 'charsGroup') {
            const chars = await listCharacterDefinitions(element.folder);
            if (chars.length === 0) {
                return [{ kind: 'hint', key: `no-chars:${element.folder.uri}`, message: '(no characters found)' }];
            }
            return chars.map((c) => ({
                kind: 'character',
                folder: element.folder,
                id: c.id,
                name: c.name,
                uri: c.uri
            }));
        }

        return [];
    }
}
