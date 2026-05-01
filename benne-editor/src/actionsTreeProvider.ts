import * as path from 'node:path';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import {
    DEFAULT_GAME_VERBS,
    getDialogIdFromDialogJsonUri,
    getGuiIdFromGuiJsonUri,
    getRoomIdFromRoomJsonUri,
    readCharacterHooks,
    readGameConfigVerbs,
    readRoomHotspots,
    readRoomProps,
    type RoomHotspotListEntry,
    type RoomPropEntry
} from './gameDiscovery';
import {
    benneHandlerDescriptionForCharacter,
    benneHandlerDescriptionForHotspot,
    benneHandlerDescriptionForProp,
    benneHandlerDescriptionForRoomCharacter,
    characterScriptRegistersVerb,
    readConfiguredVerbIdSet,
    roomScriptRegistersHotspotVerb,
    roomScriptRegistersPropVerb,
    roomScriptRegistersRoomCharacterVerb
} from './verbHandlerPresence';

function roomPropVerbEventId(roomId: string, propId: string, verbId: string): string {
    return `verb:room:${roomId}:prop:${propId}:${verbId}`;
}

function roomHotspotVerbEventId(roomId: string, hotspotId: string, verbId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:${verbId}`;
}

function roomPropVerbFallbackEventId(roomId: string, propId: string): string {
    return `verb:room:${roomId}:prop:${propId}:fallback`;
}

function roomHotspotVerbFallbackEventId(roomId: string, hotspotId: string): string {
    return `verb:room:${roomId}:hotspot:${hotspotId}:fallback`;
}

function characterVerbEventId(characterId: string, verbId: string): string {
    return `verb:character:${characterId}:${verbId}`;
}

function characterVerbFallbackEventId(characterId: string): string {
    return `verb:character:${characterId}:fallback`;
}

function roomCharacterVerbEventId(roomId: string, characterId: string, verbId: string): string {
    return `verb:room:${roomId}:character:${characterId}:${verbId}`;
}

export type ActionTreeNode =
    | { kind: 'hint'; message: string }
    | {
          kind: 'propVerb';
          verbLabel: string;
          eventId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
          verbHandlerHint: string;
      }
    | {
          kind: 'propVerbAdd';
          verbId: string;
          verbLabel: string;
          propId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
      }
    | {
          kind: 'propMakeClickable';
          propId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
      }
    | {
          kind: 'hotspotVerb';
          verbLabel: string;
          eventId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
          verbHandlerHint: string;
      }
    | {
          kind: 'hotspotVerbAdd';
          verbId: string;
          verbLabel: string;
          hotspotId: string;
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
    | { kind: 'addRoomSpawnedCharacter' }
    | { kind: 'importPropsFromAseprite' }
    | {
          kind: 'charVerb';
          verbLabel: string;
          eventId: string;
          characterJsonUri: vscode.Uri;
          characterId: string;
          verbHandlerHint: string;
      }
    | {
          kind: 'charVerbAdd';
          verbId: string;
          verbLabel: string;
          characterJsonUri: vscode.Uri;
          characterId: string;
      }
    | {
          kind: 'roomCharVerb';
          verbLabel: string;
          eventId: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
          verbHandlerHint: string;
      }
    | {
          kind: 'roomCharVerbAdd';
          verbId: string;
          verbLabel: string;
          roomJsonUri: vscode.Uri;
          roomId: string;
          characterId: string;
      }
    | { kind: 'roomCharMakeClickable'; characterJsonUri: vscode.Uri; characterId: string }
    | { kind: 'charMakeClickable'; characterJsonUri: vscode.Uri; characterId: string }
    | { kind: 'charOpen'; label: string; characterJsonUri: vscode.Uri }
    | { kind: 'importCharAnimationsFromAseprite' }
    | { kind: 'rebuildRoomPreviewBundle' }
    | { kind: 'rebuildCharacterPreviewBundle' }
    | { kind: 'rebuildGuiPreviewBundle' }
    | { kind: 'rebuildInventoryPreviewBundle' }
    | { kind: 'rebuildDialogPreviewBundle' }
    | { kind: 'addInventoryItem' }
    | { kind: 'importInventoryFromAseprite' }
    | { kind: 'addGuiControl'; guiJsonUri: vscode.Uri }
    | { kind: 'guiOpen'; label: string; targetUri: vscode.Uri };

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
                item.description = element.verbHandlerHint;
                item.iconPath = new vscode.ThemeIcon('symbol-event');
                item.contextValue = 'benneActionVerb';
                item.command = {
                    command: 'benne-editor.revealRoomScriptEvent',
                    title: 'Open handler',
                    arguments: [element.roomJsonUri.toString(), element.roomId, element.eventId]
                };
                return item;
            }
            case 'propVerbAdd': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `verb-add:${element.roomJsonUri}:${element.propId}:${element.verbId}`;
                item.description = 'add handler';
                item.iconPath = new vscode.ThemeIcon(
                    'add',
                    new vscode.ThemeColor('testing.iconPassed')
                );
                item.contextValue = 'benneActionVerbAdd';
                item.command = {
                    command: 'benne-editor.addPropVerbEvent',
                    title: 'Add verb handler',
                    arguments: [
                        element.roomJsonUri.toString(),
                        element.roomId,
                        element.propId,
                        element.verbId
                    ]
                };
                return item;
            }
            case 'propMakeClickable': {
                const item = new vscode.TreeItem('Make clickable', vscode.TreeItemCollapsibleState.None);
                item.id = `prop-clickable:${element.roomJsonUri}:${element.propId}`;
                item.description = 'required for verbs';
                item.iconPath = new vscode.ThemeIcon('inspect');
                item.contextValue = 'benneActionPropMakeClickable';
                item.command = {
                    command: 'benne-editor.makePropClickable',
                    title: 'Make prop clickable',
                    arguments: [element.roomJsonUri.toString(), element.roomId, element.propId]
                };
                return item;
            }
            case 'hotspotVerb': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `hotspot-verb:${element.roomJsonUri}:${element.eventId}`;
                item.description = element.verbHandlerHint;
                item.iconPath = new vscode.ThemeIcon('symbol-event');
                item.contextValue = 'benneActionHotspotVerb';
                item.command = {
                    command: 'benne-editor.revealRoomScriptEvent',
                    title: 'Open handler',
                    arguments: [element.roomJsonUri.toString(), element.roomId, element.eventId]
                };
                return item;
            }
            case 'hotspotVerbAdd': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `hotspot-verb-add:${element.roomJsonUri}:${element.hotspotId}:${element.verbId}`;
                item.description = 'add handler';
                item.iconPath = new vscode.ThemeIcon(
                    'add',
                    new vscode.ThemeColor('testing.iconPassed')
                );
                item.contextValue = 'benneActionHotspotVerbAdd';
                item.command = {
                    command: 'benne-editor.addHotspotVerbEvent',
                    title: 'Add hotspot verb handler',
                    arguments: [
                        element.roomJsonUri.toString(),
                        element.roomId,
                        element.hotspotId,
                        element.verbId
                    ]
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
            case 'addRoomSpawnedCharacter': {
                const item = new vscode.TreeItem('Add Spawned Character', vscode.TreeItemCollapsibleState.None);
                item.id = 'action:addRoomSpawnedCharacter';
                item.iconPath = new vscode.ThemeIcon('person-add');
                item.contextValue = 'benneActionAddRoomSpawnedCharacter';
                item.command = {
                    command: 'benne-editor.addRoomSpawnedCharacter',
                    title: 'Add Spawned Character',
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
                item.description = element.verbHandlerHint;
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
            case 'charVerbAdd': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `char-verb-add:${element.characterJsonUri}:${element.verbId}`;
                item.description = 'add handler';
                item.iconPath = new vscode.ThemeIcon(
                    'add',
                    new vscode.ThemeColor('testing.iconPassed')
                );
                item.contextValue = 'benneActionCharVerbAdd';
                item.command = {
                    command: 'benne-editor.addCharacterVerbEvent',
                    title: 'Add character verb handler',
                    arguments: [
                        element.characterJsonUri.toString(),
                        element.characterId,
                        element.verbId
                    ]
                };
                return item;
            }
            case 'roomCharVerb': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `room-char-verb:${element.roomJsonUri}:${element.eventId}`;
                item.description = element.verbHandlerHint;
                item.iconPath = new vscode.ThemeIcon('symbol-event');
                item.contextValue = 'benneActionRoomCharVerb';
                item.command = {
                    command: 'benne-editor.revealRoomScriptEvent',
                    title: 'Open room handler',
                    arguments: [element.roomJsonUri.toString(), element.roomId, element.eventId]
                };
                return item;
            }
            case 'roomCharVerbAdd': {
                const item = new vscode.TreeItem(element.verbLabel, vscode.TreeItemCollapsibleState.None);
                item.id = `room-char-verb-add:${element.roomJsonUri}:${element.characterId}:${element.verbId}`;
                item.description = 'add handler';
                item.iconPath = new vscode.ThemeIcon(
                    'add',
                    new vscode.ThemeColor('testing.iconPassed')
                );
                item.contextValue = 'benneActionRoomCharVerbAdd';
                item.command = {
                    command: 'benne-editor.addRoomCharacterVerbEvent',
                    title: 'Add room-scoped character verb handler',
                    arguments: [
                        element.roomJsonUri.toString(),
                        element.roomId,
                        element.characterId,
                        element.verbId
                    ]
                };
                return item;
            }
            case 'roomCharMakeClickable': {
                const item = new vscode.TreeItem('Make character clickable', vscode.TreeItemCollapsibleState.None);
                item.id = `room-char-clickable:${element.characterJsonUri}`;
                item.description = 'required for verbs';
                item.iconPath = new vscode.ThemeIcon('inspect');
                item.contextValue = 'benneActionRoomCharMakeClickable';
                item.command = {
                    command: 'benne-editor.makeCharacterClickable',
                    title: 'Make character clickable',
                    arguments: [element.characterJsonUri.toString(), element.characterId]
                };
                return item;
            }
            case 'charMakeClickable': {
                const item = new vscode.TreeItem('Make clickable', vscode.TreeItemCollapsibleState.None);
                item.id = `char-clickable:${element.characterJsonUri}`;
                item.description = 'required for verbs';
                item.iconPath = new vscode.ThemeIcon('inspect');
                item.contextValue = 'benneActionCharMakeClickable';
                item.command = {
                    command: 'benne-editor.makeCharacterClickable',
                    title: 'Make character clickable',
                    arguments: [element.characterJsonUri.toString(), element.characterId]
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
            case 'rebuildGuiPreviewBundle': {
                const item = new vscode.TreeItem(
                    'Rebuild GUI preview bundle',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:rebuildGuiPreviewBundle';
                item.iconPath = new vscode.ThemeIcon('sync');
                item.contextValue = 'benneActionRebuildGuiPreview';
                item.description = 'npm run build:gui-preview';
                item.command = {
                    command: 'benne-editor.rebuildGuiPreview',
                    title: 'Rebuild GUI preview bundle',
                    arguments: []
                };
                return item;
            }
            case 'rebuildInventoryPreviewBundle': {
                const item = new vscode.TreeItem(
                    'Rebuild inventory preview bundle',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:rebuildInventoryPreviewBundle';
                item.iconPath = new vscode.ThemeIcon('sync');
                item.contextValue = 'benneActionRebuildInventoryPreview';
                item.description = 'npm run build:inventory-preview';
                item.command = {
                    command: 'benne-editor.rebuildInventoryPreview',
                    title: 'Rebuild inventory preview bundle',
                    arguments: []
                };
                return item;
            }
            case 'rebuildDialogPreviewBundle': {
                const item = new vscode.TreeItem(
                    'Rebuild dialog / Inspector bundle',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:rebuildDialogPreviewBundle';
                item.iconPath = new vscode.ThemeIcon('sync');
                item.contextValue = 'benneActionRebuildDialogPreview';
                item.description = 'Extension webpack (Inspector)';
                item.command = {
                    command: 'benne-editor.rebuildDialogPreview',
                    title: 'Rebuild dialog / Inspector bundle',
                    arguments: []
                };
                return item;
            }
            case 'addInventoryItem': {
                const item = new vscode.TreeItem(
                    'Add Inventory',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:addInventoryItem';
                item.iconPath = new vscode.ThemeIcon('package');
                item.contextValue = 'benneActionAddInventoryItem';
                item.command = {
                    command: 'benne-editor.createInventoryItem',
                    title: 'Add Inventory',
                    arguments: []
                };
                return item;
            }
            case 'importInventoryFromAseprite': {
                const item = new vscode.TreeItem(
                    'Import Inventory from Aseprite',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'action:importInventoryFromAseprite';
                item.iconPath = new vscode.ThemeIcon('cloud-download');
                item.contextValue = 'benneActionImportInventoryFromAseprite';
                item.command = {
                    command: 'benne-editor.importInventoryItemsFromAsepriteTags',
                    title: 'Import Inventory from Aseprite',
                    arguments: []
                };
                return item;
            }
            case 'addGuiControl': {
                const item = new vscode.TreeItem(
                    'Add Control',
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = `action:addGuiControl:${element.guiJsonUri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('add', new vscode.ThemeColor('testing.iconPassed'));
                item.contextValue = 'benneActionAddGuiControl';
                item.command = {
                    command: 'benne-editor.addGuiControl',
                    title: 'Add Control',
                    arguments: []
                };
                return item;
            }
            case 'guiOpen': {
                const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
                item.id = `gui-open:${element.targetUri.toString()}`;
                item.iconPath = new vscode.ThemeIcon('window');
                item.contextValue = 'benneActionGui';
                item.command = {
                    command: 'benne-editor.openUriPreview',
                    title: element.label,
                    arguments: [element.targetUri.toString()]
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
            const roomId = getRoomIdFromRoomJsonUri(main.uri);
            /** Room row or Props/Hotspots/Points/Regions subgroup — not a specific element. */
            const showRoomBulkActions = roomPanel.kind === 'none';

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
                ...(showRoomBulkActions
                    ? [
                          { kind: 'addRoomHotspot' } as const,
                          { kind: 'addRoomPoint' } as const,
                          { kind: 'addRoomRegion' } as const,
                          { kind: 'addRoomProp' } as const,
                          { kind: 'addRoomSpawnedCharacter' } as const,
                          { kind: 'importPropsFromAseprite' } as const
                      ]
                    : [])
            ];

            if (roomPanel.kind === 'prop') {
                return [
                    ...scaffold,
                    ...(await this.propActionNodes(
                        roomPanel.prop,
                        roomPanel.roomJsonUri,
                        roomPanel.roomId
                    ))
                ];
            }

            if (roomPanel.kind === 'hotspot') {
                const hotspots = await readRoomHotspots(roomPanel.roomJsonUri);
                const hotspot = hotspots.find((h) => h.id === roomPanel.hotspotId);
                if (!hotspot) {
                    return [
                        ...scaffold,
                        {
                            kind: 'hint',
                            message: `Hotspot "${roomPanel.hotspotId}" not found in room JSON`
                        }
                    ];
                }
                return [
                    ...scaffold,
                    ...(await this.hotspotActionNodes(
                        hotspot,
                        roomPanel.roomJsonUri,
                        roomPanel.roomId
                    ))
                ];
            }

            if (roomPanel.kind === 'roomCharacter') {
                return [
                    ...scaffold,
                    ...(await this.roomCharacterActionNodes(
                        roomPanel.roomJsonUri,
                        roomPanel.roomId,
                        roomPanel.characterId,
                        roomPanel.instanceId
                    ))
                ];
            }

            return [...scaffold, ...roomOpenNodes];
        }

        if (main.kind === 'character') {
            return [
                { kind: 'rebuildCharacterPreviewBundle' },
                ...(await this.characterActionNodes(main.uri))
            ];
        }

        if (main.kind === 'gui') {
            return this.guiActionNodes(main.uri);
        }

        if (main.kind === 'inventory') {
            return [
                { kind: 'addInventoryItem' },
                { kind: 'importInventoryFromAseprite' },
                { kind: 'rebuildInventoryPreviewBundle' }
            ];
        }

        if (main.kind === 'dialog') {
            const dialogJsonUri = main.uri;
            const dialogId = getDialogIdFromDialogJsonUri(dialogJsonUri);
            const scriptUri = vscode.Uri.joinPath(dialogJsonUri, '..', `${dialogId}.dialog.ts`);
            return [
                { kind: 'rebuildDialogPreviewBundle' },
                { kind: 'guiOpen', label: 'Open dialog JSON', targetUri: dialogJsonUri },
                { kind: 'guiOpen', label: 'Open dialog script', targetUri: scriptUri }
            ];
        }

        return [
            { kind: 'rebuildRoomPreviewBundle' },
            { kind: 'rebuildCharacterPreviewBundle' },
            { kind: 'rebuildGuiPreviewBundle' },
            { kind: 'rebuildInventoryPreviewBundle' },
            { kind: 'rebuildDialogPreviewBundle' },
            {
                kind: 'hint',
                message: 'Select a room, character, GUI, inventory item, dialog, prop, hotspot, or room character in BENNE'
            }
        ];
    }

    private guiActionNodes(guiJsonUri: vscode.Uri): ActionTreeNode[] {
        const guiId = getGuiIdFromGuiJsonUri(guiJsonUri);
        const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
        return [
            { kind: 'addGuiControl', guiJsonUri },
            { kind: 'rebuildGuiPreviewBundle' },
            { kind: 'guiOpen', label: 'Open GUI JSON', targetUri: guiJsonUri },
            { kind: 'guiOpen', label: 'Open GUI script', targetUri: scriptUri }
        ];
    }

    private async propActionNodes(
        prop: RoomPropEntry,
        roomJsonUri: vscode.Uri,
        roomId: string
    ): Promise<ActionTreeNode[]> {
        const out: ActionTreeNode[] = [];
        const title = prop.tag ?? prop.id;

        if (prop.clickable !== true) {
            return [
                {
                    kind: 'propMakeClickable',
                    propId: prop.id,
                    roomJsonUri,
                    roomId
                },
                {
                    kind: 'hint',
                    message: `${title} — set clickable and add a collider before verb handlers`
                }
            ];
        }

        const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
        const gameVerbs = folder ? await readGameConfigVerbs(folder.uri) : DEFAULT_GAME_VERBS;
        const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

        const roomScriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
        let roomScriptText = '';
        try {
            roomScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(roomScriptUri));
        } catch {
            /* no script yet */
        }

        for (const v of gameVerbs) {
            const hasTs = roomScriptRegistersPropVerb(roomScriptText, roomId, prop.id, v.id, configured);
            if (hasTs) {
                out.push({
                    kind: 'propVerb',
                    verbLabel: `${v.id} — ${title}`,
                    eventId: roomPropVerbEventId(roomId, prop.id, v.id),
                    roomJsonUri,
                    roomId,
                    verbHandlerHint: benneHandlerDescriptionForProp(prop.id, v.id, configured)
                });
            } else {
                out.push({
                    kind: 'propVerbAdd',
                    verbId: v.id,
                    verbLabel: `${v.id} — ${title}`,
                    propId: prop.id,
                    roomJsonUri,
                    roomId
                });
            }
        }

        if (prop.onVerbFallback === true) {
            out.push({
                kind: 'propVerb',
                verbLabel: `fallback — ${title}`,
                eventId: roomPropVerbFallbackEventId(roomId, prop.id),
                roomJsonUri,
                roomId,
                verbHandlerHint: 'verb fallback (room script)'
            });
        }

        if (out.length === 0) {
            return [{ kind: 'hint', message: `${title} — no verbs in game-config.json` }];
        }

        return out;
    }

    private async hotspotActionNodes(
        hotspot: RoomHotspotListEntry,
        roomJsonUri: vscode.Uri,
        roomId: string
    ): Promise<ActionTreeNode[]> {
        const out: ActionTreeNode[] = [];
        const title = hotspot.description?.trim() ? hotspot.description : hotspot.id;

        if (hotspot.active === false) {
            out.push({
                kind: 'hint',
                message: `${title} — inactive (not hit-tested)`
            });
        }

        const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
        const gameVerbs = folder ? await readGameConfigVerbs(folder.uri) : DEFAULT_GAME_VERBS;
        const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

        let roomPropIds = new Set<string>();
        try {
            const props = await readRoomProps(roomJsonUri);
            roomPropIds = new Set(props.map((p) => p.id));
        } catch {
            /* ignore */
        }

        const roomScriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
        let roomScriptText = '';
        try {
            roomScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(roomScriptUri));
        } catch {
            /* */
        }

        for (const v of gameVerbs) {
            const hasTs = roomScriptRegistersHotspotVerb(
                roomScriptText,
                roomId,
                hotspot.id,
                v.id,
                configured,
                roomPropIds
            );
            if (hasTs) {
                out.push({
                    kind: 'hotspotVerb',
                    verbLabel: `${v.id} — ${title}`,
                    eventId: roomHotspotVerbEventId(roomId, hotspot.id, v.id),
                    roomJsonUri,
                    roomId,
                    verbHandlerHint: benneHandlerDescriptionForHotspot(hotspot.id, v.id, configured)
                });
            } else {
                out.push({
                    kind: 'hotspotVerbAdd',
                    verbId: v.id,
                    verbLabel: `${v.id} — ${title}`,
                    hotspotId: hotspot.id,
                    roomJsonUri,
                    roomId
                });
            }
        }

        if (hotspot.onVerbFallback === true) {
            out.push({
                kind: 'hotspotVerb',
                verbLabel: `fallback — ${title}`,
                eventId: roomHotspotVerbFallbackEventId(roomId, hotspot.id),
                roomJsonUri,
                roomId,
                verbHandlerHint: 'verb fallback (room script)'
            });
        }

        const hasVerbRows = out.some((n) => n.kind === 'hotspotVerb' || n.kind === 'hotspotVerbAdd');
        if (!hasVerbRows) {
            out.push({
                kind: 'hint',
                message: `${title} — no verbs in game-config.json`
            });
        }

        return out;
    }

    private async roomCharacterActionNodes(
        roomJsonUri: vscode.Uri,
        roomId: string,
        characterId: string,
        instanceId: string
    ): Promise<ActionTreeNode[]> {
        const folder = vscode.workspace.getWorkspaceFolder(roomJsonUri);
        if (!folder) {
            return [{ kind: 'hint', message: 'Could not resolve workspace folder for this room' }];
        }
        const characterJsonUri = vscode.Uri.joinPath(
            folder.uri,
            'src',
            'game',
            'characters',
            characterId,
            `${characterId}.character.json`
        );
        let hooks;
        try {
            await vscode.workspace.fs.stat(characterJsonUri);
            hooks = await readCharacterHooks(characterJsonUri);
        } catch {
            return [
                {
                    kind: 'hint',
                    message: `Character definition not found for "${characterId}" (expected under src/game/characters/)`
                }
            ];
        }

        const title = `${characterId} (${instanceId})`;
        const out: ActionTreeNode[] = [];

        if (hooks.clickable !== true) {
            return [
                {
                    kind: 'roomCharMakeClickable',
                    characterJsonUri,
                    characterId
                },
                {
                    kind: 'hint',
                    message: `${title} — set clickable on the character before room-scoped verb handlers`
                }
            ];
        }

        if (hooks.hasColliderPolygon !== true) {
            out.push({
                kind: 'hint',
                message: `${title} — add a collider (3+ points) in the character preview for precise clicks`
            });
        }

        const gameVerbs = await readGameConfigVerbs(folder.uri);
        const configured = await readConfiguredVerbIdSet(folder.uri);

        const roomScriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
        let roomScriptText = '';
        try {
            roomScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(roomScriptUri));
        } catch {
            /* */
        }

        for (const v of gameVerbs) {
            const hasTs = roomScriptRegistersRoomCharacterVerb(
                roomScriptText,
                roomId,
                characterId,
                v.id,
                configured
            );
            if (hasTs) {
                out.push({
                    kind: 'roomCharVerb',
                    verbLabel: `${v.id} — ${title}`,
                    eventId: roomCharacterVerbEventId(roomId, characterId, v.id),
                    roomJsonUri,
                    roomId,
                    verbHandlerHint: `${benneHandlerDescriptionForRoomCharacter(characterId, v.id, configured)} (in room script)`
                });
            } else {
                out.push({
                    kind: 'roomCharVerbAdd',
                    verbId: v.id,
                    verbLabel: `${v.id} — ${title}`,
                    roomJsonUri,
                    roomId,
                    characterId
                });
            }
        }

        const hasVerbRows = out.some((n) => n.kind === 'roomCharVerb' || n.kind === 'roomCharVerbAdd');
        if (!hasVerbRows) {
            out.push({
                kind: 'hint',
                message: `${title} — no verbs in game-config.json`
            });
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

        if (hooks.clickable !== true) {
            out.push(
                { kind: 'charMakeClickable', characterJsonUri, characterId },
                {
                    kind: 'hint',
                    message: `${characterId} — set clickable before verb handlers`
                }
            );
            return out;
        }

        if (hooks.hasColliderPolygon !== true) {
            out.push({
                kind: 'hint',
                message: `${characterId} — add a collider (3+ points) in the character preview for precise clicks`,
            });
        }

        const folder = vscode.workspace.getWorkspaceFolder(characterJsonUri);
        const gameVerbs = folder ? await readGameConfigVerbs(folder.uri) : DEFAULT_GAME_VERBS;
        const configured = folder ? await readConfiguredVerbIdSet(folder.uri) : new Set<string>();

        const charScriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
        let charScriptText = '';
        try {
            charScriptText = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(charScriptUri));
        } catch {
            /* */
        }

        for (const v of gameVerbs) {
            const hasTs = characterScriptRegistersVerb(charScriptText, characterId, v.id, configured);
            if (hasTs) {
                out.push({
                    kind: 'charVerb',
                    verbLabel: `${v.id} — ${characterId}`,
                    eventId: characterVerbEventId(characterId, v.id),
                    characterJsonUri,
                    characterId,
                    verbHandlerHint: benneHandlerDescriptionForCharacter(characterId, v.id, configured)
                });
            } else {
                out.push({
                    kind: 'charVerbAdd',
                    verbId: v.id,
                    verbLabel: `${v.id} — ${characterId}`,
                    characterJsonUri,
                    characterId
                });
            }
        }

        if (hooks.onVerbFallback === true) {
            out.push({
                kind: 'charVerb',
                verbLabel: `fallback — ${characterId}`,
                eventId: characterVerbFallbackEventId(characterId),
                characterJsonUri,
                characterId,
                verbHandlerHint: 'verb fallback (character script)'
            });
        }

        return out;
    }

    private inferCharacterId(characterJsonUri: vscode.Uri): string {
        return path.basename(path.dirname(characterJsonUri.fsPath));
    }
}
