import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import { findBenneGameFolders } from './gameDiscovery';

const DEBOUNCE_MS = 500;

let outputChannel: vscode.OutputChannel | undefined;
const debounceByFolder = new Map<string, ReturnType<typeof setTimeout>>();
const runningByFolder = new Map<string, Promise<boolean>>();

function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('BENNE game IDs');
    }
    return outputChannel;
}

async function readGenerateGameIdsScript(gameRoot: vscode.Uri): Promise<string | undefined> {
    const pkgUri = vscode.Uri.joinPath(gameRoot, 'package.json');
    try {
        const raw = await vscode.workspace.fs.readFile(pkgUri);
        const j = JSON.parse(Buffer.from(raw).toString('utf8')) as { scripts?: Record<string, string> };
        return j.scripts?.['generate:game-ids'];
    } catch {
        return undefined;
    }
}

function resolveGameFolder(hintUri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
    if (hintUri) {
        const folder = vscode.workspace.getWorkspaceFolder(hintUri);
        if (folder) {
            return folder;
        }
    }
    return undefined;
}

/**
 * Runs `npm run generate:game-ids` in the game folder (updates the
 * BenneScript handle modules, the `.ids.ts` files under `src/game`). A call while a run is in progress waits for it.
 */
export function runGenerateGameIds(
    gameFolder: vscode.WorkspaceFolder,
    opts?: { quiet?: boolean },
): Promise<boolean> {
    const key = gameFolder.uri.fsPath;
    const running = runningByFolder.get(key);
    if (running) {
        return running;
    }
    const run = runGenerateGameIdsNow(gameFolder, opts).finally(() => runningByFolder.delete(key));
    runningByFolder.set(key, run);
    return run;
}

async function runGenerateGameIdsNow(
    gameFolder: vscode.WorkspaceFolder,
    opts?: { quiet?: boolean },
): Promise<boolean> {

    const cwd = gameFolder.uri.fsPath;
    const script = await readGenerateGameIdsScript(gameFolder.uri);
    if (!script) {
        if (!opts?.quiet) {
            void vscode.window.showErrorMessage(
                'No npm script "generate:game-ids" in this folder\'s package.json.',
            );
        }
        return false;
    }

    const channel = getOutputChannel();
    const exitCode = await new Promise<number>((resolve) => {
        if (!opts?.quiet) {
            channel.appendLine('');
            channel.appendLine(`$ npm run generate:game-ids`);
            channel.appendLine(`  (cwd: ${cwd})`);
        }

        const proc = spawn('npm', ['run', 'generate:game-ids'], {
            cwd,
            shell: true,
            env: process.env,
        });

        proc.stdout?.on('data', (d: Buffer) => {
            if (opts?.quiet) {
                return;
            }
            const s = d.toString();
            if (s.trim()) {
                channel.append(s.endsWith('\n') ? s : `${s}\n`);
            }
        });
        proc.stderr?.on('data', (d: Buffer) => {
            if (opts?.quiet) {
                return;
            }
            const s = d.toString();
            if (s.trim()) {
                channel.append(s.endsWith('\n') ? s : `${s}\n`);
            }
        });
        proc.on('error', (e) => {
            if (!opts?.quiet) {
                channel.appendLine(e instanceof Error ? e.message : String(e));
            }
            resolve(1);
        });
        proc.on('close', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0 && !opts?.quiet) {
        channel.show(true);
        void vscode.window.showErrorMessage(
            'Game ID type generation failed. See the "BENNE game IDs" output channel.',
        );
        return false;
    }
    return exitCode === 0;
}

/** Debounced regeneration after Inspector / scaffolding / JSON edits. */
export function scheduleGenerateGameIds(hintUri?: vscode.Uri): void {
    void (async () => {
        let folder = resolveGameFolder(hintUri);
        if (!folder) {
            const games = await findBenneGameFolders();
            folder = games[0];
        }
        if (!folder) {
            return;
        }

        const key = folder.uri.fsPath;
        const existing = debounceByFolder.get(key);
        if (existing !== undefined) {
            clearTimeout(existing);
        }
        debounceByFolder.set(
            key,
            setTimeout(() => {
                debounceByFolder.delete(key);
                void runGenerateGameIds(folder!, { quiet: true });
            }, DEBOUNCE_MS),
        );
    })();
}
