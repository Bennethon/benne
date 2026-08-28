import * as vscode from 'vscode';
import type { EditorFocus } from './editorSelection';
import {
    getCharacterIdFromCharacterJsonUri,
    getGuiIdFromGuiJsonUri,
    getRoomIdFromRoomJsonUri
} from './gameDiscovery';
import type { MainTreeNode } from './mainTreeProvider';

export function getRoomAssetsFolderUri(gameRoot: vscode.Uri, roomId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'rooms', roomId);
}

export function getCharacterAssetsFolderUri(gameRoot: vscode.Uri, characterId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'characters', characterId);
}

export function getGuiAssetsFolderUri(gameRoot: vscode.Uri, guiId: string): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'guis', guiId);
}

export function getInventoryAssetsFolderUri(gameRoot: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'src', 'game', 'assets', 'images', 'inventory');
}

export function resolveAssetsFolderUriFromTreeNode(node: MainTreeNode | undefined): vscode.Uri | undefined {
    if (!node) {
        return undefined;
    }
    switch (node.kind) {
        case 'room':
            return getRoomAssetsFolderUri(node.folder.uri, node.id);
        case 'character':
            return getCharacterAssetsFolderUri(node.folder.uri, node.id);
        case 'gui':
            return getGuiAssetsFolderUri(node.folder.uri, node.id);
        case 'inventoryGroup':
            return getInventoryAssetsFolderUri(node.folder.uri);
        default:
            return undefined;
    }
}

export function resolveAssetsFolderUriFromSelection(focus: EditorFocus): vscode.Uri | undefined {
    if (focus.kind === 'inventoryGroup') {
        return getInventoryAssetsFolderUri(focus.folder);
    }
    if (focus.kind !== 'room' && focus.kind !== 'character' && focus.kind !== 'gui') {
        return undefined;
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(focus.uri);
    if (!workspaceFolder) {
        return undefined;
    }
    const gameRoot = workspaceFolder.uri;
    switch (focus.kind) {
        case 'room':
            return getRoomAssetsFolderUri(gameRoot, getRoomIdFromRoomJsonUri(focus.uri));
        case 'character':
            return getCharacterAssetsFolderUri(gameRoot, getCharacterIdFromCharacterJsonUri(focus.uri));
        case 'gui':
            return getGuiAssetsFolderUri(gameRoot, getGuiIdFromGuiJsonUri(focus.uri));
    }
}

export async function revealAssetsFolder(folderUri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.fs.createDirectory(folderUri);
    } catch {
        /* folder may already exist or path may be invalid */
    }
    const opened = await vscode.env.openExternal(folderUri);
    if (!opened) {
        void vscode.window.showErrorMessage(`Could not open assets folder: ${folderUri.fsPath}`);
    }
}
