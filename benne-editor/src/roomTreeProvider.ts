import * as vscode from 'vscode';
import { EditorSelection } from './editorSelection';
import { readRoomProps, type RoomPropEntry } from './gameDiscovery';

export type RoomTreeNode =
    | { kind: 'hint'; message: string }
    | { kind: 'characterFocus'; name: string }
    | { kind: 'prop'; prop: RoomPropEntry; roomUri: vscode.Uri };

export class RoomTreeProvider implements vscode.TreeDataProvider<RoomTreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<RoomTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly selection: EditorSelection) {
        selection.onDidChange(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RoomTreeNode): vscode.TreeItem {
        switch (element.kind) {
            case 'hint': {
                const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
                item.id = `room-hint:${element.message}`;
                return item;
            }
            case 'characterFocus': {
                const item = new vscode.TreeItem(
                    `Character: ${element.name}`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'room-character-focus';
                item.description = 'Open a room in Main to edit props';
                item.iconPath = new vscode.ThemeIcon('info');
                return item;
            }
            case 'prop': {
                const label = element.prop.tag ?? element.prop.id;
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.id = `prop:${element.roomUri.toString()}:${element.prop.id}`;
                const desc: string[] = [];
                if (label !== element.prop.id) {
                    desc.push(element.prop.id);
                }
                if (element.prop.zIndex !== undefined) {
                    desc.push(`z:${element.prop.zIndex}`);
                }
                if (element.prop.visible === false) {
                    desc.push('hidden');
                }
                item.description = desc.length > 0 ? desc.join(' · ') : undefined;
                item.iconPath = new vscode.ThemeIcon('symbol-misc');
                item.contextValue = 'benneRoomProp';
                return item;
            }
        }
    }

    async getChildren(): Promise<RoomTreeNode[]> {
        const focus = this.selection.focus;
        if (focus.kind === 'none') {
            return [{ kind: 'hint', message: 'Select a room in Main' }];
        }
        if (focus.kind === 'character') {
            return [{ kind: 'characterFocus', name: focus.label }];
        }
        try {
            const props = await readRoomProps(focus.uri);
            if (props.length === 0) {
                return [{ kind: 'hint', message: '(no props in this room)' }];
            }
            return props.map((prop) => ({ kind: 'prop', prop, roomUri: focus.uri }));
        } catch {
            return [{ kind: 'hint', message: 'Could not read room JSON' }];
        }
    }
}
