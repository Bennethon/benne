import * as vscode from 'vscode';
import type { RoomPropEntry } from './gameDiscovery';

export type EditorFocus =
    | { kind: 'none' }
    | { kind: 'room'; uri: vscode.Uri; label: string }
    | { kind: 'character'; uri: vscode.Uri; label: string }
    | { kind: 'gui'; uri: vscode.Uri; label: string }
    | { kind: 'inventory'; uri: vscode.Uri; label: string }
    | { kind: 'inventoryGroup'; folder: vscode.Uri; label: string }
    | { kind: 'dialog'; uri: vscode.Uri; label: string }
    | { kind: 'pdc'; uri: vscode.Uri; label: string };

/** Control row selected under a GUI in the BENNE tree (drives Inspector scroll / expand). */
export type GuiPanelFocus =
    | { kind: 'none' }
    | { kind: 'control'; guiJsonUri: vscode.Uri; controlKey: string };

/** Prop selected under a room in the BENNE tree (drives Actions). */
export type RoomPanelFocus =
    | { kind: 'none' }
    | { kind: 'prop'; roomJsonUri: vscode.Uri; roomId: string; prop: RoomPropEntry }
    | { kind: 'hotspot'; roomJsonUri: vscode.Uri; roomId: string; hotspotId: string }
    | {
          kind: 'roomCharacter';
          roomJsonUri: vscode.Uri;
          roomId: string;
          instanceId: string;
          characterId: string;
      }
    | { kind: 'roomPoint'; roomJsonUri: vscode.Uri; roomId: string; pointId: string }
    | { kind: 'region'; roomJsonUri: vscode.Uri; roomId: string; regionId: string }
    | {
          kind: 'walkable';
          roomJsonUri: vscode.Uri;
          roomId: string;
          polygonId: string;
          /** `null` = outer walkable ring; otherwise hole id under {@link polygonId}. */
          holeId: string | null;
      };

export class EditorSelection {
    private _main: EditorFocus = { kind: 'none' };
    private _roomPanel: RoomPanelFocus = { kind: 'none' };
    private _guiPanel: GuiPanelFocus = { kind: 'none' };
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    readonly onDidChange = this._onDidChange.event;

    /** Selection from the BENNE tree (room / character). */
    get focus(): EditorFocus {
        return this._main;
    }

    get roomPanel(): RoomPanelFocus {
        return this._roomPanel;
    }

    get guiPanel(): GuiPanelFocus {
        return this._guiPanel;
    }

    setRoom(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'room', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    /** Room + prop in one update (avoids clearing prop between setRoom and setRoomPanelProp). */
    setRoomWithProp(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        prop: RoomPropEntry
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'prop', roomJsonUri, roomId, prop };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomWithHotspot(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        hotspotId: string
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'hotspot', roomJsonUri, roomId, hotspotId };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomWithRoomPoint(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        pointId: string
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'roomPoint', roomJsonUri, roomId, pointId };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomWithRegion(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        regionId: string
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'region', roomJsonUri, roomId, regionId };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomWithWalkable(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        polygonId: string,
        holeId: string | null
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'walkable', roomJsonUri, roomId, polygonId, holeId };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomWithRoomCharacter(
        roomJsonUri: vscode.Uri,
        roomLabel: string,
        roomId: string,
        instanceId: string,
        characterId: string
    ): void {
        this._main = { kind: 'room', uri: roomJsonUri, label: roomLabel };
        this._roomPanel = { kind: 'roomCharacter', roomJsonUri, roomId, instanceId, characterId };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setCharacter(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'character', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setGui(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'gui', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setGuiWithControl(uri: vscode.Uri, label: string, controlKey: string): void {
        this._main = { kind: 'gui', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'control', guiJsonUri: uri, controlKey };
        this._onDidChange.fire();
    }

    setInventory(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'inventory', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setInventoryGroup(folder: vscode.Uri, label: string): void {
        this._main = { kind: 'inventoryGroup', folder, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setDialog(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'dialog', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setPdc(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'pdc', uri, label };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomPanelProp(roomJsonUri: vscode.Uri, roomId: string, prop: RoomPropEntry): void {
        this._roomPanel = { kind: 'prop', roomJsonUri, roomId, prop };
        this._onDidChange.fire();
    }

    setRoomPanelHotspot(roomJsonUri: vscode.Uri, roomId: string, hotspotId: string): void {
        this._roomPanel = { kind: 'hotspot', roomJsonUri, roomId, hotspotId };
        this._onDidChange.fire();
    }

    setRoomPanelRoomPoint(roomJsonUri: vscode.Uri, roomId: string, pointId: string): void {
        this._roomPanel = { kind: 'roomPoint', roomJsonUri, roomId, pointId };
        this._onDidChange.fire();
    }

    setRoomPanelRegion(roomJsonUri: vscode.Uri, roomId: string, regionId: string): void {
        this._roomPanel = { kind: 'region', roomJsonUri, roomId, regionId };
        this._onDidChange.fire();
    }

    setRoomPanelWalkable(roomJsonUri: vscode.Uri, roomId: string, polygonId: string, holeId: string | null): void {
        this._roomPanel = { kind: 'walkable', roomJsonUri, roomId, polygonId, holeId };
        this._onDidChange.fire();
    }

    setRoomPanelRoomCharacter(
        roomJsonUri: vscode.Uri,
        roomId: string,
        instanceId: string,
        characterId: string
    ): void {
        this._roomPanel = { kind: 'roomCharacter', roomJsonUri, roomId, instanceId, characterId };
        this._onDidChange.fire();
    }

    clearRoomPanelProp(): void {
        if (this._roomPanel.kind === 'none') {
            return;
        }
        this._roomPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    clearRoomContext(): void {
        if (this._main.kind === 'room') {
            this._main = { kind: 'none' };
            this._roomPanel = { kind: 'none' };
            this._guiPanel = { kind: 'none' };
            this._onDidChange.fire();
        }
    }

    /** Clears room / character / GUI / inventory / dialog primary focus (e.g. after deleting the active entity). */
    clearFocus(): void {
        if (this._main.kind === 'none' && this._roomPanel.kind === 'none' && this._guiPanel.kind === 'none') {
            return;
        }
        this._main = { kind: 'none' };
        this._roomPanel = { kind: 'none' };
        this._guiPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    /** Clears prop / hotspot / point / region / spawned-character row focus under a room. */
    clearRoomPanelFocus(): void {
        if (this._roomPanel.kind === 'none') {
            return;
        }
        this._roomPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
