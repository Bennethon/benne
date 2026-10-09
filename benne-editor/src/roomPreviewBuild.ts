import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import { findBenneGameFolders } from './gameDiscovery';
import { resolvePreviewBundleFileUri } from './previewBundlePaths';

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
        case 'walkable':
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
        | 'build:inventory-preview'
        | 'build:benne-play'
        | 'watch:benne-play',
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

/** Resolves the `watch:benne-play` npm script when present (editor-started Vite watch for BENNE Play). */
export async function getWatchBennePlayNpmScript(gameRoot: vscode.Uri): Promise<string | undefined> {
    return readPackageNpmScript(gameRoot, 'watch:benne-play');
}

type PreviewNpmScript =
    | 'build:room-preview'
    | 'build:character-preview'
    | 'build:gui-preview'
    | 'build:inventory-preview'
    | 'build:benne-play';

/**
 * Runs `npm run <script>` with progress in a notification. Output goes to `channel` but the Panel is only
 * revealed when the build fails (via the error message's **Show Output** button), so routine rebuilds don't
 * shrink the two-row preview/source layout.
 */
async function runNpmBuild(
    cwd: string,
    channel: vscode.OutputChannel,
    args: string[],
    title: string,
    failureMessage: string,
): Promise<boolean> {
    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.appendLine('');
                channel.appendLine(`$ npm ${args.join(' ')}`);
                channel.appendLine(`  (cwd: ${cwd})`);

                const proc = spawn('npm', args, {
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
        void vscode.window.showErrorMessage(failureMessage, 'Show Output').then((choice) => {
            if (choice === 'Show Output') {
                channel.show(true);
            }
        });
        return false;
    }
    return true;
}

async function runPreviewNpmBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    scriptName: PreviewNpmScript,
    title: string,
    failureMessage: string,
    missingScriptMessage = `No npm script "${scriptName}" in this folder's package.json.`,
): Promise<boolean> {
    const script = await readPackageNpmScript(gameFolder.uri, scriptName);
    if (!script) {
        void vscode.window.showErrorMessage(missingScriptMessage);
        return false;
    }
    return runNpmBuild(gameFolder.uri.fsPath, channel, ['run', scriptName], title, failureMessage);
}

export async function runRoomPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string }
): Promise<boolean> {
    return runPreviewNpmBuild(
        gameFolder,
        channel,
        'build:room-preview',
        opts?.title ?? 'Rebuilding room preview bundle',
        'Room preview rebuild failed (non-zero exit).',
        'No npm script "build:room-preview" in this folder\'s package.json. Open the BENNE game repo root (with Vite + src/game).',
    );
}

export async function runCharacterPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    return runPreviewNpmBuild(
        gameFolder,
        channel,
        'build:character-preview',
        opts?.title ?? 'Rebuilding character preview bundle',
        'Character preview rebuild failed (non-zero exit).',
    );
}

export async function runGuiPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    return runPreviewNpmBuild(
        gameFolder,
        channel,
        'build:gui-preview',
        opts?.title ?? 'Rebuilding GUI preview bundle',
        'GUI preview rebuild failed (non-zero exit).',
    );
}

export async function runInventoryPreviewBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    return runPreviewNpmBuild(
        gameFolder,
        channel,
        'build:inventory-preview',
        opts?.title ?? 'Rebuilding inventory preview bundle',
        'Inventory preview rebuild failed (non-zero exit).',
    );
}

export async function runBennePlayBuild(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    return runPreviewNpmBuild(
        gameFolder,
        channel,
        'build:benne-play',
        opts?.title ?? 'Rebuilding BENNE Play bundle',
        'BENNE Play rebuild failed (non-zero exit).',
    );
}

/** True when `npm run compile` can run (monorepo / Extension Development Host with node_modules). */
export async function canRunBenneEditorWebpackCompile(extensionRoot: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(
            vscode.Uri.joinPath(extensionRoot, 'node_modules', 'webpack', 'package.json'),
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensures a workspace-local BENNE Play bundle exists (`.benne/` or monorepo `benne-editor/media/`).
 * The extension's shipped demo bundle is not used — Play must reflect this project's `src/game/`.
 */
export async function ensureBennePlayBundleForGame(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
    opts?: { title?: string },
): Promise<boolean> {
    const existing = await resolvePreviewBundleFileUri(
        gameFolder.uri,
        'benne-play',
        'benne-play.js',
    );
    if (existing) {
        return true;
    }
    return runBennePlayBuild(gameFolder, channel, {
        title: opts?.title ?? 'Building BENNE Play bundle for this project',
    });
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
    if (!(await canRunBenneEditorWebpackCompile(extensionRoot))) {
        channel.appendLine(
            `[skip] Extension webpack compile is unavailable (no webpack under ${path.join(extensionRoot.fsPath, 'node_modules')}).`,
        );
        return true;
    }
    return runNpmBuild(
        extensionRoot.fsPath,
        channel,
        ['run', 'compile'],
        opts?.title ?? 'Rebuilding BENNE editor (webpack)',
        'BENNE editor compile failed (non-zero exit).',
    );
}

let cachedOutputChannel: vscode.OutputChannel | undefined;

export function getRoomPreviewBuildOutputChannel(): vscode.OutputChannel {
    if (!cachedOutputChannel) {
        cachedOutputChannel = getOutputChannel();
    }
    return cachedOutputChannel;
}
