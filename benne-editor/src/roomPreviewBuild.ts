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

async function readPackageBuildScript(gameRoot: vscode.Uri): Promise<string | undefined> {
    const pkgUri = vscode.Uri.joinPath(gameRoot, 'package.json');
    try {
        const raw = await vscode.workspace.fs.readFile(pkgUri);
        const j = JSON.parse(Buffer.from(raw).toString('utf8')) as { scripts?: Record<string, string> };
        return j.scripts?.['build:room-preview'];
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
    const script = await readPackageBuildScript(gameFolder.uri);
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

let cachedOutputChannel: vscode.OutputChannel | undefined;

export function getRoomPreviewBuildOutputChannel(): vscode.OutputChannel {
    if (!cachedOutputChannel) {
        cachedOutputChannel = getOutputChannel();
    }
    return cachedOutputChannel;
}
