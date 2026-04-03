import * as vscode from 'vscode';
import type { RoomPropEntry } from './gameDiscovery';

export type EditorFocus =
    | { kind: 'none' }
    | { kind: 'room'; uri: vscode.Uri; label: string }
    | { kind: 'character'; uri: vscode.Uri; label: string };

/** Prop selected under a room in the BENNE tree (drives Actions). */
export type RoomPanelFocus =
    | { kind: 'none' }
    | { kind: 'prop'; roomJsonUri: vscode.Uri; roomId: string; prop: RoomPropEntry };

export class EditorSelection {
    private _main: EditorFocus = { kind: 'none' };
    private _roomPanel: RoomPanelFocus = { kind: 'none' };
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    readonly onDidChange = this._onDidChange.event;

    /** Selection from the BENNE tree (room / character). */
    get focus(): EditorFocus {
        return this._main;
    }

    get roomPanel(): RoomPanelFocus {
        return this._roomPanel;
    }

    setRoom(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'room', uri, label };
        this._roomPanel = { kind: 'none' };
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
        this._onDidChange.fire();
    }

    setCharacter(uri: vscode.Uri, label: string): void {
        this._main = { kind: 'character', uri, label };
        this._roomPanel = { kind: 'none' };
        this._onDidChange.fire();
    }

    setRoomPanelProp(roomJsonUri: vscode.Uri, roomId: string, prop: RoomPropEntry): void {
        this._roomPanel = { kind: 'prop', roomJsonUri, roomId, prop };
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
            this._onDidChange.fire();
        }
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
