import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { findBenneGameFolders } from './gameDiscovery';

function getOutputChannel(): vscode.OutputChannel {
    return vscode.window.createOutputChannel('BENNE room preview build');
}

/** URI that implies which workspace folder contains the BENNE game root (has src/game/rooms). */
export function roomPreviewBuildHintUri(selection: EditorSelection): vscode.Uri | undefined {
    const main = selection.focus;
    const roomPanel = selection.roomPanel;
    switch (roomPanel.kind) {
        case 'prop':
        case 'hotspot':
        case 'roomPoint':
        case 'region':
            return roomPanel.roomJsonUri;
        default:
            break;
    }
    if (main.kind === 'room') {
        return main.uri;
    }
    if (main.kind === 'character') {
        return main.uri;
    }
    if (main.kind === 'gui') {
        return main.uri;
    }
    if (main.kind === 'dialog') {
        return main.uri;
    }
    return undefined;
}

async function hasBenneGameLayout(root: vscode.Uri): Promise<boolean> {
    const rooms = vscode.Uri.joinPath(root, 'src', 'game', 'rooms');
    try {
        const stat = await vscode.workspace.fs.stat(rooms);
        return stat.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}

export async function resolveGameFolderForRoomPreviewBuild(
    hintUri?: vscode.Uri
): Promise<vscode.WorkspaceFolder | undefined> {
    if (hintUri) {
        const folder = vscode.workspace.getWorkspaceFolder(hintUri);
        if (folder && (await hasBenneGameLayout(folder.uri))) {
            return folder;
        }
    }
    const games = await findBenneGameFolders();
    return games[0];
}

async function readPackageNpmScript(
    gameRoot: vscode.Uri,
    scriptName:
        | 'build:room-preview'
        | 'build:character-preview'
        | 'build:gui-preview'
        | 'build:inventory-preview',
): Promise<string | undefined> {
    const pkgUri = vscode.Uri.joinPath(gameRoot, 'package.json');
    try {
        const raw = await vscode.workspace.fs.readFile(pkgUri);
        const j = JSON.parse(Buffer.from(raw).toString('utf8')) as { scripts?: Record<string, string> };
        return j.scripts?.[scriptName];
    } catch {
        return undefined;
    }
}

export async function runRoomPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string }
): Promise<boolean> {
    const cwd = gameFolder.uri.fsPath;
    const script = await readPackageNpmScript(gameFolder.uri, 'build:room-preview');
    if (!script) {
        void vscode.window.showErrorMessage(
            'No npm script "build:room-preview" in this folder\'s package.json. Open the BENNE game repo root (with Vite + src/game).'
        );
        return false;
    }

    const title = opts?.title ?? 'Rebuilding room preview bundle';

    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
                channel.appendLine('');
                channel.appendLine(`$ npm run build:room-preview`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', ['run', 'build:room-preview'], {
                    cwd,
                    shell: true,
                    env: process.env,
                });

                proc.stdout?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.stderr?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.on('error', (e) => {
                    channel.appendLine(e instanceof Error ? e.message : String(e));
                    resolve(1);
                });
                proc.on('close', (code) => resolve(code ?? 1));
            })
    );

    if (exitCode !== 0) {
        void vscode.window.showErrorMessage(
            'Room preview rebuild failed (non-zero exit). See the "BENNE room preview build" output channel.'
        );
        return false;
    }
    return true;
}

export async function runCharacterPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    const cwd = gameFolder.uri.fsPath;
    const script = await readPackageNpmScript(gameFolder.uri, 'build:character-preview');
    if (!script) {
        void vscode.window.showErrorMessage(
            'No npm script "build:character-preview" in this folder\'s package.json.',
        );
        return false;
    }

    const title = opts?.title ?? 'Rebuilding character preview bundle';

    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
                channel.appendLine('');
                channel.appendLine(`$ npm run build:character-preview`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', ['run', 'build:character-preview'], {
                    cwd,
                    shell: true,
                    env: process.env,
                });

                proc.stdout?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.stderr?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.on('error', (e) => {
                    channel.appendLine(e instanceof Error ? e.message : String(e));
                    resolve(1);
                });
                proc.on('close', (code) => resolve(code ?? 1));
            }),
    );

    if (exitCode !== 0) {
        void vscode.window.showErrorMessage(
            'Character preview rebuild failed (non-zero exit). See the "BENNE room preview build" output channel.',
        );
        return false;
    }
    return true;
}

export async function runGuiPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    const cwd = gameFolder.uri.fsPath;
    const script = await readPackageNpmScript(gameFolder.uri, 'build:gui-preview');
    if (!script) {
        void vscode.window.showErrorMessage(
            'No npm script "build:gui-preview" in this folder\'s package.json.',
        );
        return false;
    }

    const title = opts?.title ?? 'Rebuilding GUI preview bundle';

    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
                channel.appendLine('');
                channel.appendLine(`$ npm run build:gui-preview`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', ['run', 'build:gui-preview'], {
                    cwd,
                    shell: true,
                    env: process.env,
                });

                proc.stdout?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.stderr?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.on('error', (e) => {
                    channel.appendLine(e instanceof Error ? e.message : String(e));
                    resolve(1);
                });
                proc.on('close', (code) => resolve(code ?? 1));
            }),
    );

    if (exitCode !== 0) {
        void vscode.window.showErrorMessage(
            'GUI preview rebuild failed (non-zero exit). See the "BENNE room preview build" output channel.',
        );
        return false;
    }
    return true;
}

export async function runInventoryPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    const cwd = gameFolder.uri.fsPath;
    const script = await readPackageNpmScript(gameFolder.uri, 'build:inventory-preview');
    if (!script) {
        void vscode.window.showErrorMessage(
            'No npm script "build:inventory-preview" in this folder\'s package.json.',
        );
        return false;
    }

    const title = opts?.title ?? 'Rebuilding inventory preview bundle';

    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
                channel.appendLine('');
                channel.appendLine(`$ npm run build:inventory-preview`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', ['run', 'build:inventory-preview'], {
                    cwd,
                    shell: true,
                    env: process.env,
                });

                proc.stdout?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.stderr?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.on('error', (e) => {
                    channel.appendLine(e instanceof Error ? e.message : String(e));
                    resolve(1);
                });
                proc.on('close', (code) => resolve(code ?? 1));
            }),
    );

    if (exitCode !== 0) {
        void vscode.window.showErrorMessage(
            'Inventory preview rebuild failed (non-zero exit). See the "BENNE room preview build" output channel.',
        );
        return false;
    }
    return true;
}

/**
 * Rebuilds the BENNE VS Code extension webpack output (`benne-editor` package), including the Inspector bundle.
 * Used for the **Rebuild Dialog Inspector** command (dialogs have no Phaser preview webview).
 */
export async function runBenneEditorWebpackCompile(
    extensionRoot: vscode.Uri,
    channel: vscode.OutputChannel,
    opts?: { title?: string }
): Promise<boolean> {
    const cwd = extensionRoot.fsPath;
    const title = opts?.title ?? 'Rebuilding BENNE editor (webpack)';

    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
                channel.appendLine('');
                channel.appendLine(`$ npm run compile`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', ['run', 'compile'], {
                    cwd,
                    shell: true,
                    env: process.env,
                });

                proc.stdout?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.stderr?.on('data', (d: Buffer) => {
                    const s = d.toString();
                    if (s.trim()) {
                        channel.append(s.endsWith('\n') ? s : `${s}\n`);
                    }
                });
                proc.on('error', (e) => {
                    channel.appendLine(e instanceof Error ? e.message : String(e));
                    resolve(1);
                });
                proc.on('close', (code) => resolve(code ?? 1));
            }),
    );

    if (exitCode !== 0) {
        void vscode.window.showErrorMessage(
            'BENNE editor compile failed (non-zero exit). See the "BENNE room preview build" output channel.',
        );
        return false;
    }
    return true;
}

let cachedOutputChannel: vscode.OutputChannel | undefined;

export function getRoomPreviewBuildOutputChannel(): vscode.OutputChannel {
    if (!cachedOutputChannel) {
        cachedOutputChannel = getOutputChannel();
    }
    return cachedOutputChannel;
}
