import * as path from 'node:path';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { getRoomIdFromRoomJsonUri, readCharacterHooks, type RoomPropEntry } from './gameDiscovery';

export type ActionTreeNode =
    | { kind: 'hint'; message: string }
    | {
          kind: 'propVerb';
          verbLabel: string;
          eventId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
      }
    | {
          kind: 'roomOpen';
          label: string;
          target: 'json' | 'script' | 'registerFn';
          roomJsonUri: vscode.Uri;
          roomId: string;
      }
    | { kind: 'addRoomProp' }
    | { kind: 'addRoomHotspot' }
    | { kind: 'addRoomPoint' }
    | { kind: 'addRoomRegion' }
    | { kind: 'importPropsFromAseprite' }
    | {
          kind: 'charVerb';
          verbLabel: string;
          eventId: string;
          characterJsonUri: vscode.Uri;
          characterId: string;
      }
    | { kind: 'charOpen'; label: string; characterJsonUri: vscode.Uri }
    | { kind: 'importCharAnimationsFromAseprite' }
    | { kind: 'rebuildRoomPreviewBundle' }
    | { kind: 'rebuildCharacterPreviewBundle' };

export class ActionsTreeProvider implements vscode.TreeDataProvider<ActionTreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ActionTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly selection: EditorSelection) {
        selection.onDidChange(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ActionTreeNode): vscode.TreeItem {
        switch (element.kind) {
            case 'hint': {
                const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
                item.id = `action-hint:${element.message.slice(0, 40)}`;
                item.iconPath = new vscode.ThemeIcon('info');
                return item;
            }
            case 'propVerb': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `verb:${element.roomJsonUri}:${element.eventId}`;
                item.description = element.eventId;
                item.iconPath = new vscode.ThemeIcon('symbol-event');
                item.contextValue = 'benneActionVerb';
                item.command = {
                    command: 'benne-editor.revealRoomScriptEvent',
                    title: 'Open handler',
                    arguments: [element.roomJsonUri.toString(), element.roomId, element.eventId]
                };
                return item;
            }
            case 'addRoomProp': {
                const item = new vscode.TreeItem('Add Prop', vscode.TreeItemCollapsibleState.None);
                item.id = 'action:addRoomProp';
                item.iconPath = new vscode.ThemeIcon('symbol-misc');
                item.contextValue = 'benneActionAddProp';
                item.command = {
                    command: 'benne-editor.addRoomProp',
                    title: 'Add Prop',
                    arguments: []
                };
                return item;
            }
            case 'addRoomHotspot': {
                const item = new vscode.TreeItem('Add Hotspot', vscode.TreeItemCollapsibleState.None);
                item.id = 'action:addRoomHotspot';
                item.iconPath = new vscode.ThemeIcon('map');
                item.contextValue = 'benneActionAddHotspot';
                item.command = {
                    command: 'benne-editor.addRoomHotspot',
                    title: 'Add Hotspot',
                    arguments: []
                };
                return item;
            }
            case 'addRoomPoint': {
                const item = new vscode.TreeItem('Add Point', vscode.TreeItemCollapsibleState.None);
                item.id = 'action:addRoomPoint';
                item.iconPath = new vscode.ThemeIcon('pinned');
                item.contextValue = 'benneActionAddPoint';
                item.command = {
                    command: 'benne-editor.addRoomPoint',
                    title: 'Add Point',
                    arguments: []
                };
                return item;
            }
            case 'addRoomRegion': {
                const item = new vscode.TreeItem('Add Region', vscode.TreeItemCollapsibleState.None);
                item.id = 'action:addRoomRegion';
                item.iconPath = new vscode.ThemeIcon('layout-panel');
                item.contextValue = 'benneActionAddRegion';
                item.command = {
                    command: 'benne-editor.addRoomRegion',
                    title: 'Add Region',
                    arguments: []
                };
                return item;
            }
            case 'importPropsFromAseprite': {
                const item = new vscode.TreeItem(
                    'Import Props from Aseprite Tags',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:importPropsFromAseprite';
                item.iconPath = new vscode.ThemeIcon('cloud-download');
                item.contextValue = 'benneActionImportAseprite';
                item.command = {
                    command: 'benne-editor.importPropsFromAsepriteTags',
                    title: 'Import Props from Aseprite Tags',
                    arguments: []
                };
                return item;
            }
            case 'roomOpen': {
                const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                item.id = `room:${element.target}:${element.roomJsonUri}`;
                item.iconPath = new vscode.ThemeIcon(
                    element.target === 'json' ? 'json' : 'symbol-method'
                );
                item.contextValue = 'benneActionRoom';
                const uriStr = element.roomJsonUri.toString();
                item.command = {
                    command:
                        element.target === 'json'
                            ? 'benne-editor.openUriPreview'
                            : element.target === 'script'
                              ? 'benne-editor.openRoomScriptPreview'
                              : 'benne-editor.revealRegisterRoomScript',
                    title: element.label,
                    arguments:
                        element.target === 'json'
                            ? [uriStr]
                            : [uriStr, element.roomId]
                };
                return item;
            }
            case 'charVerb': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `char-verb:${element.characterJsonUri}:${element.eventId}`;
                item.description = element.eventId;
                item.iconPath = new vscode.ThemeIcon('symbol-event');
                item.contextValue = 'benneActionCharVerb';
                item.command = {
                    command: 'benne-editor.revealCharacterScriptEvent',
                    title: 'Open handler',
                    arguments: [
                        element.characterJsonUri.toString(),
                        element.characterId,
                        element.eventId
                    ]
                };
                return item;
            }
            case 'charOpen': {
                const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                item.id = `char-open:${element.characterJsonUri}`;
                item.iconPath = new vscode.ThemeIcon('person');
                item.contextValue = 'benneActionChar';
                item.command = {
                    command: 'benne-editor.openUriPreview',
                    title: element.label,
                    arguments: [element.characterJsonUri.toString()]
                };
                return item;
            }
            case 'importCharAnimationsFromAseprite': {
                const item = new vscode.TreeItem(
                    'Import Animations from Aseprite Tags',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:importCharAnimationsFromAseprite';
                item.iconPath = new vscode.ThemeIcon('cloud-download');
                item.contextValue = 'benneActionImportCharAnimations';
                item.command = {
                    command: 'benne-editor.importAnimationsFromAsepriteTags',
                    title: 'Import Animations from Aseprite Tags',
                    arguments: []
                };
                return item;
            }
            case 'rebuildRoomPreviewBundle': {
                const item = new vscode.TreeItem(
                    'Rebuild room preview bundle',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:rebuildRoomPreviewBundle';
                item.iconPath = new vscode.ThemeIcon('sync');
                item.contextValue = 'benneActionRebuildRoomPreview';
                item.description = 'npm run build:room-preview';
                item.command = {
                    command: 'benne-editor.rebuildRoomPreview',
                    title: 'Rebuild room preview bundle',
                    arguments: []
                };
                return item;
            }
            case 'rebuildCharacterPreviewBundle': {
                const item = new vscode.TreeItem(
                    'Rebuild character preview bundle',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:rebuildCharacterPreviewBundle';
                item.iconPath = new vscode.ThemeIcon('sync');
                item.contextValue = 'benneActionRebuildCharacterPreview';
                item.description = 'npm run build:character-preview';
                item.command = {
                    command: 'benne-editor.rebuildCharacterPreview',
                    title: 'Rebuild character preview bundle',
                    arguments: []
                };
                return item;
            }
        }
    }

    async getChildren(): Promise<ActionTreeNode[]> {
        const main = this.selection.focus;
        const roomPanel = this.selection.roomPanel;

        if (main.kind === 'room') {
            const rebuild: ActionTreeNode = { kind: 'rebuildRoomPreviewBundle' };
            const addHotspot: ActionTreeNode = { kind: 'addRoomHotspot' };
            const addPoint: ActionTreeNode = { kind: 'addRoomPoint' };
            const addRegion: ActionTreeNode = { kind: 'addRoomRegion' };
            const addProp: ActionTreeNode = { kind: 'addRoomProp' };
            const importAseprite: ActionTreeNode = { kind: 'importPropsFromAseprite' };
            const roomId = getRoomIdFromRoomJsonUri(main.uri);

            const roomOpenNodes: ActionTreeNode[] = [
                {
                    kind: 'roomOpen',
                    label: 'Open room JSON',
                    target: 'json',
                    roomJsonUri: main.uri,
                    roomId
                },
                {
                    kind: 'roomOpen',
                    label: 'Open room script',
                    target: 'script',
                    roomJsonUri: main.uri,
                    roomId
                },
                {
                    kind: 'roomOpen',
                    label: 'Go to registerRoomScript',
                    target: 'registerFn',
                    roomJsonUri: main.uri,
                    roomId
                }
            ];

            const scaffold: ActionTreeNode[] = [
                rebuild,
                addHotspot,
                addPoint,
                addRegion,
                addProp,
                importAseprite
            ];

            if (roomPanel.kind === 'prop') {
                return [...scaffold, ...this.propActionNodes(roomPanel.prop, roomPanel.roomJsonUri, roomPanel.roomId)];
            }

            return [...scaffold, ...roomOpenNodes];
        }

        if (main.kind === 'character') {
            return [
                { kind: 'rebuildCharacterPreviewBundle' },
                ...(await this.characterActionNodes(main.uri))
            ];
        }

        return [
            { kind: 'rebuildRoomPreviewBundle' },
            {
                kind: 'hint',
                message: 'Select a room, character, or prop (under a room) in BENNE'
            }
        ];
    }

    private propActionNodes(
        prop: RoomPropEntry,
        roomJsonUri: vscode.Uri,
        roomId: string
    ): ActionTreeNode[] {
        const out: ActionTreeNode[] = [];
        const title = prop.tag ?? prop.id;

        const verbKeys = Object.keys(prop.onVerb ?? {}).sort();
        const hasVerbConfig =
            verbKeys.length > 0 || (prop.onVerbFallback !== undefined && prop.onVerbFallback.length > 0);

        if (prop.clickable === false && !hasVerbConfig) {
            return [{ kind: 'hint', message: `${title} — not clickable` }];
        }

        for (const verbId of verbKeys) {
            const eventId = prop.onVerb![verbId];
            out.push({
                kind: 'propVerb',
                verbLabel: `${verbId} — ${title}`,
                eventId,
                roomJsonUri,
                roomId
            });
        }
        if (prop.onVerbFallback) {
            out.push({
                kind: 'propVerb',
                verbLabel: `fallback — ${title}`,
                eventId: prop.onVerbFallback,
                roomJsonUri,
                roomId
            });
        }

        if (out.length === 0) {
            return [{ kind: 'hint', message: `${title} — no onVerb handlers` }];
        }

        return out;
    }

    private async characterActionNodes(characterJsonUri: vscode.Uri): Promise<ActionTreeNode[]> {
        const hooks = await readCharacterHooks(characterJsonUri);
        const characterId = this.inferCharacterId(characterJsonUri);
        const out: ActionTreeNode[] = [
            { kind: 'importCharAnimationsFromAseprite' },
            { kind: 'charOpen', label: 'Open character JSON', characterJsonUri }
        ];

        const verbKeys = Object.keys(hooks.onVerb ?? {}).sort();
        for (const verbId of verbKeys) {
            const eventId = hooks.onVerb![verbId];
            out.push({
                kind: 'charVerb',
                verbLabel: `${verbId} — ${characterId}`,
                eventId,
                characterJsonUri,
                characterId
            });
        }
        if (hooks.onVerbFallback) {
            out.push({
                kind: 'charVerb',
                verbLabel: `fallback — ${characterId}`,
                eventId: hooks.onVerbFallback,
                characterJsonUri,
                characterId
            });
        }

        return out;
    }

    private inferCharacterId(characterJsonUri: vscode.Uri): string {
        return path.basename(path.dirname(characterJsonUri.fsPath));
    }
}
