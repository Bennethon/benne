import { spawn, type ChildProcess } from 'node:child_process';
import * as vscode from 'vscode';
import { resolveBennePlayJsWatchPattern } from './previewBundlePaths';
import { getRoomPreviewBuildOutputChannel, getWatchBennePlayNpmScript } from './roomPreviewBuild';

const DEBOUNCE_MS = 400;
const FIRST_BUNDLE_WAIT_MS = 120_000;
const FIRST_BUNDLE_POLL_MS = 250;

async function bennePlayJsUri(gameFolder: vscode.WorkspaceFolder): Promise<vscode.Uri> {
    const rel = await resolveBennePlayJsWatchPattern(gameFolder.uri);
    return vscode.Uri.joinPath(gameFolder.uri, ...rel.split('/'));
}

async function waitForBennePlayJs(
    gameFolder: vscode.WorkspaceFolder,
    channel: vscode.OutputChannel,
): Promise<boolean> {
    const uri = await bennePlayJsUri(gameFolder);
    const rel = await resolveBennePlayJsWatchPattern(gameFolder.uri);
    const deadline = Date.now() + FIRST_BUNDLE_WAIT_MS;
    while (Date.now() < deadline) {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            await new Promise((r) => setTimeout(r, FIRST_BUNDLE_POLL_MS));
        }
    }
    channel.appendLine(
        `[BENNE Play watch] Timed out waiting for ${rel} (${FIRST_BUNDLE_WAIT_MS} ms).`,
    );
    void vscode.window.showWarningMessage(
        'BENNE Play watch did not produce benne-play.js in time. Try "Rebuild BENNE Play" once, then Play again.',
    );
    return false;
}

type WatchEntry = {
    proc: ChildProcess;
    watcher: vscode.FileSystemWatcher;
    debounceTimer: ReturnType<typeof setTimeout> | undefined;
    reload: () => void;
};

/**
 * Runs `npm run watch:benne-play` in the game repo (one process per workspace root) and debounces
 * reload callbacks when `benne-play.js` changes.
 */
export class BennePlayWatchManager implements vscode.Disposable {
    private readonly byCwd = new Map<string, WatchEntry>();

    /**
     * Starts or reuses a Vite watch for this game folder. Updates the debounced reload callback when
     * already running. Returns false only if `watch:benne-play` is missing.
     */
    async ensureStarted(
        gameFolder: vscode.WorkspaceFolder,
        onBundleChanged: () => void,
    ): Promise<boolean> {
        const key = gameFolder.uri.fsPath;
        for (const k of [...this.byCwd.keys()]) {
            if (k !== key) {
                this.stop(k);
            }
        }
        const existing = this.byCwd.get(key);
        if (existing) {
            existing.reload = onBundleChanged;
            return true;
        }

        const channel = getRoomPreviewBuildOutputChannel();
        const script = await getWatchBennePlayNpmScript(gameFolder.uri);
        if (!script) {
            void vscode.window.showWarningMessage(
                'No npm script "watch:benne-play" in this folder\'s package.json — BENNE Play will not auto-rebuild on save.',
            );
            return false;
        }

        const cwd = gameFolder.uri.fsPath;
        channel.appendLine('');
        channel.appendLine(`$ npm run watch:benne-play`);
        channel.appendLine(`  (cwd: ${cwd})`);

        const proc = spawn('npm', ['run', 'watch:benne-play'], {
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
        });
        proc.on('close', (code) => {
            const entry = this.byCwd.get(key);
            if (entry?.proc === proc) {
                this.clearEntry(key, entry);
                channel.appendLine(
                    `[BENNE Play watch] Process exited (${code ?? 'unknown'}). Auto-rebuild stopped for: ${cwd}`,
                );
            }
        });

        const schedule = (entry: WatchEntry): void => {
            if (entry.debounceTimer !== undefined) {
                clearTimeout(entry.debounceTimer);
            }
            entry.debounceTimer = setTimeout(() => {
                entry.debounceTimer = undefined;
                try {
                    entry.reload();
                } catch (e) {
                    channel.appendLine(
                        `[BENNE Play watch] Reload callback error: ${e instanceof Error ? e.message : String(e)}`,
                    );
                }
            }, DEBOUNCE_MS);
        };

        const watchPattern = await resolveBennePlayJsWatchPattern(gameFolder.uri);
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(gameFolder, watchPattern),
        );
        const entry: WatchEntry = {
            proc,
            watcher,
            debounceTimer: undefined,
            reload: onBundleChanged,
        };
        watcher.onDidChange(() => {
            schedule(entry);
        });
        watcher.onDidCreate(() => {
            schedule(entry);
        });

        this.byCwd.set(key, entry);

        // Do not block Play — wait for the first bundle in the background.
        void waitForBennePlayJs(gameFolder, channel).then((ready) => {
            if (!ready) {
                channel.appendLine(
                    '[BENNE Play watch] Still running; save game files or run "Rebuild BENNE Play" if the panel does not update.',
                );
            }
        });

        return true;
    }

    /** Stops the watch process and file watcher for the given game root path. */
    stop(cwdFsPath: string): void {
        const entry = this.byCwd.get(cwdFsPath);
        if (entry) {
            this.clearEntry(cwdFsPath, entry);
        }
    }

    dispose(): void {
        for (const k of [...this.byCwd.keys()]) {
            this.stop(k);
        }
    }

    private clearEntry(key: string, entry: WatchEntry): void {
        if (entry.debounceTimer !== undefined) {
            clearTimeout(entry.debounceTimer);
            entry.debounceTimer = undefined;
        }
        try {
            entry.watcher.dispose();
        } catch {
            /* ignore */
        }
        try {
            entry.proc.kill();
        } catch {
            /* ignore */
        }
        this.byCwd.delete(key);
    }
}
