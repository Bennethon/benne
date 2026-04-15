import * as vscode from 'vscode';
import type { MainTreeNode } from '../mainTreeProvider';
import type { RoomPropEntry } from '../gameDiscovery';

/**
 * Unified delete handle for BENNE game entities (main tree).
 * Each variant carries enough context to patch JSON, update manifests, scan scripts, and close editors.
 * `spawnedCharacter` removes one `characters[]` instance from a room only (not the character definition).
 */
export type DeleteTarget =
    | {
          type: 'room';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          displayLabel: string;
      }
    | {
          type: 'character';
          folder: vscode.WorkspaceFolder;
          characterId: string;
          characterJsonUri: vscode.Uri;
          displayLabel: string;
      }
    | {
          type: 'gui';
          folder: vscode.WorkspaceFolder;
          guiId: string;
          guiJsonUri: vscode.Uri;
          displayLabel: string;
      }
    | {
          type: 'inventory';
          folder: vscode.WorkspaceFolder;
          itemId: string;
          inventoryJsonUri: vscode.Uri;
          displayLabel: string;
      }
    | {
          type: 'prop';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          prop: RoomPropEntry;
          displayLabel: string;
      }
    | {
          type: 'hotspot';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          hotspotId: string;
          displayLabel: string;
      }
    | {
          type: 'point';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          pointId: string;
          displayLabel: string;
      }
    | {
          type: 'region';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          regionId: string;
          displayLabel: string;
      }
    | {
          /** One `characters[]` entry in a room (does not delete the character definition). */
          type: 'spawnedCharacter';
          folder: vscode.WorkspaceFolder;
          roomId: string;
          roomName: string;
          roomJsonUri: vscode.Uri;
          instanceId: string;
          characterId: string;
          displayLabel: string;
      };

/** Argument type for `benne-editor.deleteGameEntity` (tree context menu passes one node). */
export type DeleteCommandTreeArg = MainTreeNode | MainTreeNode[] | undefined;

/**
 * Maps a main-tree node to a delete target. Groups, hints, and room subfolders are not deletable here.
 */
export function resolveDeleteTargetFromMainTreeNode(
    node: MainTreeNode | undefined
): DeleteTarget | undefined {
    if (!node) {
        return undefined;
    }
    switch (node.kind) {
        case 'room':
            return {
                type: 'room',
                folder: node.folder,
                roomId: node.id,
                roomName: node.name,
                roomJsonUri: node.uri,
                displayLabel: node.name
            };
        case 'character':
            return {
                type: 'character',
                folder: node.folder,
                characterId: node.id,
                characterJsonUri: node.uri,
                displayLabel: node.name
            };
        case 'gui':
            return {
                type: 'gui',
                folder: node.folder,
                guiId: node.id,
                guiJsonUri: node.uri,
                displayLabel: node.name
            };
        case 'inventoryItem':
            return {
                type: 'inventory',
                folder: node.folder,
                itemId: node.id,
                inventoryJsonUri: node.uri,
                displayLabel: node.name
            };
        case 'prop':
            return {
                type: 'prop',
                folder: node.folder,
                roomId: node.roomId,
                roomName: node.roomName,
                roomJsonUri: node.roomJsonUri,
                prop: node.prop,
                displayLabel: node.prop.tag ?? node.prop.id
            };
        case 'hotspot':
            return {
                type: 'hotspot',
                folder: node.folder,
                roomId: node.roomId,
                roomName: node.roomName,
                roomJsonUri: node.roomJsonUri,
                hotspotId: node.hotspotId,
                displayLabel: node.hotspotId
            };
        case 'roomPoint':
            return {
                type: 'point',
                folder: node.folder,
                roomId: node.roomId,
                roomName: node.roomName,
                roomJsonUri: node.roomJsonUri,
                pointId: node.pointId,
                displayLabel: node.pointId
            };
        case 'region':
            return {
                type: 'region',
                folder: node.folder,
                roomId: node.roomId,
                roomName: node.roomName,
                roomJsonUri: node.roomJsonUri,
                regionId: node.regionId,
                displayLabel: node.regionId
            };
        case 'roomCharacter':
            return {
                type: 'spawnedCharacter',
                folder: node.folder,
                roomId: node.roomId,
                roomName: node.roomName,
                roomJsonUri: node.roomJsonUri,
                instanceId: node.instanceId,
                characterId: node.characterId,
                displayLabel: `${node.characterId} (${node.instanceId})`
            };
        default:
            return undefined;
    }
}
