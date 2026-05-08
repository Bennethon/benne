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
          type: 'dialog';
          folder: vscode.WorkspaceFolder;
          dialogId: string;
          dialogJsonUri: vscode.Uri;
          displayLabel: string;
      }
    | {
          /** Designer-only puzzle dependency chart (`*.pdc.json`; not shipped with the game). */
          type: 'pdc';
          folder: vscode.WorkspaceFolder;
          pdcId: string;
          pdcJsonUri: vscode.Uri;
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
      }
    | {
          /** One `controls[]` entry inside a GUI JSON (does not delete the GUI itself). */
          type: 'guiControl';
          folder: vscode.WorkspaceFolder;
          guiId: string;
          guiName: string;
          guiJsonUri: vscode.Uri;
          controlIndex: number;
          /** `type:id:index` as used by the Inspector card and main-tree node. */
          controlKey: string;
          /** Raw `type` string from the control JSON (e.g. `button`, `text`). */
          typeLabel: string;
          /** May be empty when the control has no `id`. */
          controlId: string;
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
        case 'dialog':
            return {
                type: 'dialog',
                folder: node.folder,
                dialogId: node.id,
                dialogJsonUri: node.uri,
                displayLabel: node.name
            };
        case 'pdc':
            return {
                type: 'pdc',
                folder: node.folder,
                pdcId: node.id,
                pdcJsonUri: node.uri,
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
        case 'guiControl':
            return {
                type: 'guiControl',
                folder: node.folder,
                guiId: node.guiId,
                guiName: node.guiName,
                guiJsonUri: node.guiUri,
                controlIndex: node.controlIndex,
                controlKey: node.controlKey,
                typeLabel: node.typeLabel,
                controlId: node.controlId,
                displayLabel: node.controlId
                    ? `${node.typeLabel} (${node.controlId})`
                    : `${node.typeLabel} (#${node.controlIndex + 1})`
            };
        default:
            return undefined;
    }
}
