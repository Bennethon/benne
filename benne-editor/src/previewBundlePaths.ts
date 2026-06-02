import * as vscode from 'vscode';

export const BENNE_WORKSPACE_PREVIEW_ROOT = '.benne/preview-bundles';

export type BennePreviewBundleName =
    | 'room-preview'
    | 'character-preview'
    | 'gui-preview'
    | 'inventory-preview'
    | 'benne-play';

function workspacePreviewBundleFile(
    gameRoot: vscode.Uri,
    previewName: BennePreviewBundleName,
    fileName: string,
): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, '.benne', 'preview-bundles', previewName, fileName);
}

function monorepoPreviewBundleFile(
    gameRoot: vscode.Uri,
    previewName: BennePreviewBundleName,
    fileName: string,
): vscode.Uri {
    return vscode.Uri.joinPath(gameRoot, 'benne-editor', 'media', previewName, fileName);
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/** True when the game root is the BENNE monorepo (sibling `benne-editor/` folder). */
export async function isBenneMonorepoGameRoot(gameRoot: vscode.Uri): Promise<boolean> {
    return fileExists(vscode.Uri.joinPath(gameRoot, 'benne-editor'));
}

export function standaloneBennePlayJsRelativePath(): string {
    return `${BENNE_WORKSPACE_PREVIEW_ROOT}/benne-play/benne-play.js`;
}

export function monorepoBennePlayJsRelativePath(): string {
    return 'benne-editor/media/benne-play/benne-play.js';
}

/**
 * Resolves a preview bundle file from the workspace when rebuilt locally,
 * otherwise falls back to the extension's bundled media.
 */
export async function resolvePreviewBundleFileUri(
    gameRoot: vscode.Uri | undefined,
    previewName: BennePreviewBundleName,
    fileName: string,
): Promise<vscode.Uri | undefined> {
    if (gameRoot) {
        const workspaceBundle = workspacePreviewBundleFile(gameRoot, previewName, fileName);
        if (await fileExists(workspaceBundle)) {
            return workspaceBundle;
        }
        const monorepoBundle = monorepoPreviewBundleFile(gameRoot, previewName, fileName);
        if (await fileExists(monorepoBundle)) {
            return monorepoBundle;
        }
    }
    return undefined;
}

export async function resolvePreviewScriptUri(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
    previewName: BennePreviewBundleName,
    fileName: string,
): Promise<vscode.Uri> {
    const workspaceFile = await resolvePreviewBundleFileUri(gameRoot, previewName, fileName);
    if (workspaceFile) {
        return webview.asWebviewUri(workspaceFile);
    }
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', previewName, fileName));
}

/** Directory containing benne-play.js and sibling assets/chunks. */
export async function resolveBennePlayMediaRootUri(
    extensionUri: vscode.Uri,
    gameRoot: vscode.Uri | undefined,
): Promise<vscode.Uri> {
    const workspaceBundle = await resolvePreviewBundleFileUri(
        gameRoot,
        'benne-play',
        'benne-play.js',
    );
    if (workspaceBundle) {
        return vscode.Uri.joinPath(workspaceBundle, '..');
    }
    return vscode.Uri.joinPath(extensionUri, 'media', 'benne-play');
}

/** Relative path (from game root) to watch for benne-play.js rebuilds. */
export async function resolveBennePlayJsWatchPattern(
    gameRoot: vscode.Uri,
): Promise<string> {
    if (await isBenneMonorepoGameRoot(gameRoot)) {
        return monorepoBennePlayJsRelativePath();
    }
    return standaloneBennePlayJsRelativePath();
}
