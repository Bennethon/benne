import * as vscode from 'vscode';

export type EditorFocus =
    | { kind: 'none' }
    | { kind: 'room'; uri: vscode.Uri; label: string }
    | { kind: 'character'; uri: vscode.Uri; label: string };

export class EditorSelection {
    private _focus: EditorFocus = { kind: 'none' };
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    readonly onDidChange = this._onDidChange.event;

    get focus(): EditorFocus {
        return this._focus;
    }

    setRoom(uri: vscode.Uri, label: string): void {
        this._focus = { kind: 'room', uri, label };
        this._onDidChange.fire();
    }

    setCharacter(uri: vscode.Uri, label: string): void {
        this._focus = { kind: 'character', uri, label };
        this._onDidChange.fire();
    }

    clearRoomContext(): void {
        if (this._focus.kind === 'room') {
            this._focus = { kind: 'none' };
            this._onDidChange.fire();
        }
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
