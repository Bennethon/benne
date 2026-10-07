import * as path from 'node:path';
import * as vscode from 'vscode';
import { findBenneGameFolders } from './gameDiscovery';
import {
    compareSemver,
    copySharedScaffold,
    copyTemplateBoot,
    ensureGameEslintConfig,
    mergeGamePackageJson,
    readBenneProject,
    readScaffoldManifest,
    runNpmScript,
    scanScaffoldUpdate,
    writeBenneProject,
    type BenneProjectFile,
} from './scaffoldPayload';

function getOutputChannel(): vscode.OutputChannel {
    return vscode.window.createOutputChannel('BENNE update engine');
}

async function pickGameFolder(
    preferred?: vscode.WorkspaceFolder,
): Promise<vscode.WorkspaceFolder | undefined> {
    if (preferred) {
        return preferred;
    }
    const folders = await findBenneGameFolders();
    if (folders.length === 0) {
        void vscode.window.showErrorMessage(
            'No BENNE game in the workspace (need a folder with src/game/rooms).',
        );
        return undefined;
    }
    if (folders.length === 1) {
        return folders[0];
    }
    const pick = await vscode.window.showQuickPick(
        folders.map((f) => ({
            label: f.name,
            description: f.uri.fsPath,
            folder: f,
        })),
        { placeHolder: 'Choose a BENNE game to update' },
    );
    return pick?.folder;
}

function formatScanSummary(
    fromVersion: string,
    toVersion: string,
    scan: Awaited<ReturnType<typeof scanScaffoldUpdate>>,
): string {
    return (
        `Update engine ${fromVersion} → ${toVersion}: ` +
        `${scan.unchangedFiles.length} unchanged, ` +
        `${scan.overwriteFiles.length} overwritten, ` +
        `${scan.newFiles.length} new. ` +
        `src/game/ is preserved (except src/game/boot/).`
    );
}

async function confirmVersionGate(
    currentVersion: string,
    targetVersion: string,
): Promise<boolean> {
    const cmp = compareSemver(targetVersion, currentVersion);
    if (cmp > 0) {
        return true;
    }
    if (cmp === 0) {
        const resync = await vscode.window.showInformationMessage(
            `This game is already on engine ${targetVersion}. Re-sync from the extension anyway?`,
            'Re-sync',
            'Cancel',
        );
        return resync === 'Re-sync';
    }
    const downgrade = await vscode.window.showWarningMessage(
        `The installed extension (${targetVersion}) is older than this game's engine (${currentVersion}). Downgrade anyway?`,
        'Downgrade',
        'Cancel',
    );
    return downgrade === 'Downgrade';
}

function buildUpdatedBenneProject(
    existing: BenneProjectFile | undefined,
    gameFolder: vscode.WorkspaceFolder,
    scaffoldVersion: string,
    extensionVersion: string,
): BenneProjectFile {
    const folderName = path.basename(gameFolder.uri.fsPath);
    return {
        scaffoldVersion,
        extensionVersion,
        templateId: existing?.templateId ?? 'unknown',
        projectName: existing?.projectName ?? folderName,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
}

export async function runUpdateEngineWizard(
    extensionPath: string,
    extensionVersion: string,
    preferredFolder?: vscode.WorkspaceFolder,
): Promise<void> {
    const channel = getOutputChannel();

    let manifest;
    try {
        manifest = await readScaffoldManifest(extensionPath);
    } catch (e) {
        void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        return;
    }

    const gameFolder = await pickGameFolder(preferredFolder);
    if (!gameFolder) {
        return;
    }

    const existingProject = await readBenneProject(gameFolder.uri);
    const currentVersion = existingProject?.scaffoldVersion ?? 'unknown';
    const targetVersion = manifest.scaffoldVersion;

    if (!(await confirmVersionGate(currentVersion, targetVersion))) {
        return;
    }

    let scan;
    try {
        scan = await scanScaffoldUpdate(gameFolder.uri, extensionPath, existingProject?.templateId);
    } catch (e) {
        void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        return;
    }

    const summary = formatScanSummary(currentVersion, targetVersion, scan);
    channel.appendLine(summary);
    if (scan.overwriteFiles.length > 0) {
        channel.appendLine('');
        channel.appendLine('Files to overwrite:');
        for (const rel of scan.overwriteFiles.slice(0, 50)) {
            channel.appendLine(`  ${rel}`);
        }
        if (scan.overwriteFiles.length > 50) {
            channel.appendLine(`  … and ${scan.overwriteFiles.length - 50} more`);
        }
    }
    if (scan.newFiles.length > 0) {
        channel.appendLine('');
        channel.appendLine('New files:');
        for (const rel of scan.newFiles.slice(0, 30)) {
            channel.appendLine(`  ${rel}`);
        }
        if (scan.newFiles.length > 30) {
            channel.appendLine(`  … and ${scan.newFiles.length - 30} more`);
        }
    }

    const confirm = await vscode.window.showWarningMessage(summary, 'Update', 'Cancel');
    if (confirm !== 'Update') {
        return;
    }

    const cwd = gameFolder.uri.fsPath;
    const ok = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Updating BENNE engine to ${targetVersion}…`,
            cancellable: false,
        },
        async () => {
            channel.show(true);
            channel.appendLine('');
            channel.appendLine(`Updating engine in ${cwd}`);

            try {
                await copySharedScaffold(gameFolder.uri, extensionPath);
                channel.appendLine('Copied scaffold/shared/ into project root.');
            } catch (e) {
                channel.appendLine(
                    `Copy failed: ${e instanceof Error ? e.message : String(e)}`,
                );
                return false;
            }

            try {
                const bootUpdated = await copyTemplateBoot(
                    gameFolder.uri,
                    extensionPath,
                    existingProject?.templateId,
                );
                channel.appendLine(
                    bootUpdated
                        ? 'Updated src/game/boot/ from the engine scaffold (rest of src/game/ preserved).'
                        : 'No scaffold boot files found; left src/game/boot/ unchanged.',
                );
            } catch (e) {
                channel.appendLine(
                    `Boot update failed: ${e instanceof Error ? e.message : String(e)}`,
                );
                return false;
            }

            try {
                await mergeGamePackageJson(gameFolder.uri);
                channel.appendLine('Merged package.json scripts and dependencies.');
                if (await ensureGameEslintConfig(gameFolder.uri)) {
                    channel.appendLine('Added eslint.config.mjs (BenneScript lint rules; run npm run lint).');
                }
            } catch (e) {
                channel.appendLine(
                    `package.json merge failed: ${e instanceof Error ? e.message : String(e)}`,
                );
                return false;
            }

            const updatedProject = buildUpdatedBenneProject(
                existingProject,
                gameFolder,
                targetVersion,
                extensionVersion,
            );
            try {
                await writeBenneProject(gameFolder.uri, updatedProject);
                channel.appendLine('Updated .benne-project metadata.');
            } catch (e) {
                channel.appendLine(
                    `.benne-project write failed: ${e instanceof Error ? e.message : String(e)}`,
                );
                return false;
            }

            const installOk = await runNpmScript(cwd, channel, ['install'], 'Installing npm dependencies…');
            if (!installOk) {
                return false;
            }
            return runNpmScript(
                cwd,
                channel,
                ['run', 'build:benne-play'],
                'Building BENNE Play bundle…',
            );
        },
    );

    if (!ok) {
        void vscode.window.showErrorMessage(
            'Engine files were updated but npm setup failed. See the "BENNE update engine" output channel. You can retry npm install manually.',
        );
        return;
    }

    void vscode.window.showInformationMessage(
        `BENNE engine updated to ${targetVersion}. If editor previews look stale, run "Rebuild Editor Preview Bundles".`,
    );
}
