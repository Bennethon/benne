import { spawn } from 'node:child_process';
import { cp, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type ScaffoldManifest = {
    scaffoldVersion: string;
    templates: Array<{
        id: string;
        displayName: string;
        description: string;
    }>;
};

export type BenneProjectFile = {
    scaffoldVersion: string;
    extensionVersion: string;
    templateId: string;
    projectName: string;
    createdAt: string;
};

export type ScaffoldScanResult = {
    newFiles: string[];
    unchangedFiles: string[];
    overwriteFiles: string[];
};

const PHASER_VERSION = '4.0.0-rc.7';
const TYPESCRIPT_VERSION = '~5.9.3';
const VITE_VERSION = '^8.0.1';

export function scaffoldRoot(extensionPath: string): string {
    return path.join(extensionPath, 'scaffold');
}

export function sharedScaffoldPath(extensionPath: string): string {
    return path.join(scaffoldRoot(extensionPath), 'shared');
}

export function templatesScaffoldPath(extensionPath: string): string {
    return path.join(scaffoldRoot(extensionPath), 'templates');
}

/**
 * The boot layer is the only part of `src/game/` that engine updates may overwrite.
 * It holds shared loader glue (e.g. `resolveGameAssetUrl.ts`) that engine modules import,
 * so a new engine feature can require a new boot export that an existing game would
 * otherwise never receive (the rest of `src/game/` is author content and stays untouched).
 */
const GAME_BOOT_REL = 'src/game/boot';

export async function readScaffoldManifest(extensionPath: string): Promise<ScaffoldManifest> {
    const manifestPath = path.join(scaffoldRoot(extensionPath), 'manifest.json');
    try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(manifestPath));
        const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as ScaffoldManifest;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.templates)) {
            throw new Error('Invalid scaffold manifest shape.');
        }
        return parsed;
    } catch (e) {
        const msg =
            e instanceof Error && e.message.includes('ENOENT')
                ? 'Scaffold payload missing. Run `npm run bundle:scaffold` from the BENNE repo (or rebuild the extension).'
                : e instanceof Error
                  ? e.message
                  : String(e);
        throw new Error(msg);
    }
}

export async function readBenneProject(gameRoot: vscode.Uri): Promise<BenneProjectFile | undefined> {
    const uri = vscode.Uri.joinPath(gameRoot, '.benne-project');
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as BenneProjectFile;
        if (!parsed || typeof parsed !== 'object') {
            return undefined;
        }
        return parsed;
    } catch {
        return undefined;
    }
}

export async function writeBenneProject(gameRoot: vscode.Uri, project: BenneProjectFile): Promise<void> {
    const filePath = path.join(gameRoot.fsPath, '.benne-project');
    await writeFile(filePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
}

/** @returns negative if a < b, 0 if equal, positive if a > b */
export function compareSemver(a: string, b: string): number {
    if (b === 'unknown') {
        return parseSemverTriple(a) ? 1 : 0;
    }
    if (a === 'unknown') {
        return parseSemverTriple(b) ? -1 : 0;
    }
    const pa = parseSemverTriple(a);
    const pb = parseSemverTriple(b);
    if (!pa || !pb) {
        return a.localeCompare(b);
    }
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) {
            return pa[i] - pb[i];
        }
    }
    return 0;
}

function parseSemverTriple(v: string): [number, number, number] | undefined {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    if (!match) {
        return undefined;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function listFilesRecursive(rootUri: vscode.Uri, prefix = ''): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(rootUri);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        const child = vscode.Uri.joinPath(rootUri, name);
        if (type === vscode.FileType.Directory) {
            out.push(...(await listFilesRecursive(child, rel)));
        } else if (type === vscode.FileType.File) {
            out.push(rel.replace(/\\/g, '/'));
        }
    }
    return out.sort();
}

export async function listScaffoldSharedFiles(extensionPath: string): Promise<string[]> {
    const sharedRoot = vscode.Uri.file(sharedScaffoldPath(extensionPath));
    try {
        await vscode.workspace.fs.stat(sharedRoot);
    } catch {
        throw new Error(
            'Scaffold shared payload missing. Rebuild the extension (`npm run bundle:scaffold`).',
        );
    }
    return listFilesRecursive(sharedRoot);
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Resolves the boot directory inside the scaffold payload to use as the update source.
 *
 * Boot files are identical across templates (kept in sync by `sync-boot-down` at package
 * time), so we prefer the project's own `templateId` and fall back to the first template
 * present in the payload when the id is `unknown` or that template was dropped.
 */
export async function resolveScaffoldBootDir(
    extensionPath: string,
    templateId: string | undefined,
): Promise<string | undefined> {
    const templatesRoot = templatesScaffoldPath(extensionPath);
    const candidateIds: string[] = [];
    if (templateId && templateId !== 'unknown') {
        candidateIds.push(templateId);
    }
    try {
        const manifest = await readScaffoldManifest(extensionPath);
        for (const t of manifest.templates) {
            if (!candidateIds.includes(t.id)) {
                candidateIds.push(t.id);
            }
        }
    } catch {
        /* manifest only needed for the fallback ids */
    }
    for (const id of candidateIds) {
        const bootDir = path.join(templatesRoot, id, 'boot');
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(bootDir));
            return bootDir;
        } catch {
            /* try the next candidate */
        }
    }
    return undefined;
}

async function scanSourceTree(
    files: string[],
    srcRootFs: string,
    gameRoot: vscode.Uri,
    destPrefix: string,
    result: ScaffoldScanResult,
): Promise<void> {
    for (const rel of files) {
        const segments = rel.split('/');
        const srcUri = vscode.Uri.file(path.join(srcRootFs, ...segments));
        const displayRel = destPrefix ? `${destPrefix}/${rel}` : rel;
        const destUri = vscode.Uri.joinPath(gameRoot, ...displayRel.split('/'));
        const src = await vscode.workspace.fs.readFile(srcUri);
        try {
            const dest = await vscode.workspace.fs.readFile(destUri);
            if (buffersEqual(src, dest)) {
                result.unchangedFiles.push(displayRel);
            } else {
                result.overwriteFiles.push(displayRel);
            }
        } catch {
            result.newFiles.push(displayRel);
        }
    }
}

/**
 * Scans everything an engine update will write: the shared scaffold (engine/editor/types,
 * configs, …) plus `src/game/boot/`. The rest of `src/game/` (author content) is excluded.
 */
export async function scanScaffoldUpdate(
    gameRoot: vscode.Uri,
    extensionPath: string,
    templateId: string | undefined,
): Promise<ScaffoldScanResult> {
    const result: ScaffoldScanResult = {
        newFiles: [],
        unchangedFiles: [],
        overwriteFiles: [],
    };

    const sharedFiles = await listScaffoldSharedFiles(extensionPath);
    await scanSourceTree(sharedFiles, sharedScaffoldPath(extensionPath), gameRoot, '', result);

    const bootDir = await resolveScaffoldBootDir(extensionPath, templateId);
    if (bootDir) {
        const bootFiles = await listFilesRecursive(vscode.Uri.file(bootDir));
        await scanSourceTree(bootFiles, bootDir, gameRoot, GAME_BOOT_REL, result);
    }

    result.newFiles.sort();
    result.unchangedFiles.sort();
    result.overwriteFiles.sort();
    return result;
}

export async function copySharedScaffold(
    gameRoot: vscode.Uri,
    extensionPath: string,
): Promise<void> {
    const src = sharedScaffoldPath(extensionPath);
    await cp(src, gameRoot.fsPath, { recursive: true, force: true });
}

/**
 * Overwrites `src/game/boot/` with the scaffold's boot layer, leaving the rest of
 * `src/game/` (rooms, characters, assets, scripts) untouched. Returns `false` when the
 * payload has no boot files to copy (older scaffold), so callers can report that.
 */
export async function copyTemplateBoot(
    gameRoot: vscode.Uri,
    extensionPath: string,
    templateId: string | undefined,
): Promise<boolean> {
    const bootDir = await resolveScaffoldBootDir(extensionPath, templateId);
    if (!bootDir) {
        return false;
    }
    const dest = path.join(gameRoot.fsPath, 'src', 'game', 'boot');
    await cp(bootDir, dest, { recursive: true, force: true });
    return true;
}

export function scaffoldPackageJsonTemplate(projectName: string): Record<string, unknown> {
    return {
        name: projectName,
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
            'generate:game-ids': 'node scripts/generate-game-ids.mjs',
            predev: 'npm run generate:game-ids',
            dev: 'vite',
            prebuild: 'npm run generate:game-ids',
            build: 'tsc && vite build',
            'prebuild:room-preview': 'npm run generate:game-ids',
            'build:room-preview': 'tsc && vite build --config vite.room-preview.config.ts',
            'prebuild:character-preview': 'npm run generate:game-ids',
            'build:character-preview': 'tsc && vite build --config vite.character-preview.config.ts',
            'prebuild:gui-preview': 'npm run generate:game-ids',
            'build:gui-preview': 'tsc && vite build --config vite.gui-preview.config.ts',
            'prebuild:inventory-preview': 'npm run generate:game-ids',
            'build:inventory-preview': 'tsc && vite build --config vite.inventory-preview.config.ts',
            'prebuild:benne-play': 'npm run generate:game-ids',
            'build:benne-play': 'tsc && vite build --config vite.benne-play.config.ts',
            'watch:benne-play': 'vite build --watch --config vite.benne-play.config.ts',
            preview: 'vite preview',
        },
        devDependencies: {
            typescript: TYPESCRIPT_VERSION,
            vite: VITE_VERSION,
        },
        dependencies: {
            phaser: PHASER_VERSION,
        },
    };
}

export function buildPackageJson(projectName: string): string {
    return `${JSON.stringify(scaffoldPackageJsonTemplate(projectName), null, 2)}\n`;
}

export async function mergeGamePackageJson(gameRoot: vscode.Uri): Promise<void> {
    const pkgPath = path.join(gameRoot.fsPath, 'package.json');
    let existing: Record<string, unknown> = {};
    try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(pkgPath));
        existing = JSON.parse(Buffer.from(raw).toString('utf8')) as Record<string, unknown>;
    } catch {
        /* no package.json yet */
    }

    const projectName =
        typeof existing.name === 'string' && existing.name.length > 0
            ? existing.name
            : path.basename(gameRoot.fsPath);
    const template = scaffoldPackageJsonTemplate(projectName);

    const merged = {
        ...template,
        name: existing.name ?? template.name,
        private: existing.private ?? template.private,
        version: existing.version ?? template.version,
        type: existing.type ?? template.type,
        scripts: template.scripts,
        devDependencies: template.devDependencies,
        dependencies: template.dependencies,
    };

    await writeFile(pkgPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

export async function runNpmScript(
    cwd: string,
    channel: vscode.OutputChannel,
    args: string[],
    progressTitle: string,
): Promise<boolean> {
    const exitCode = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false,
        },
        () =>
            new Promise<number>((resolve) => {
                channel.show(true);
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
    return exitCode === 0;
}

export async function copyTreeNonDestructive(src: string, dest: string): Promise<void> {
    await cp(src, dest, { recursive: true, force: false });
}
