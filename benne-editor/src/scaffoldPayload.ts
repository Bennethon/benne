import { spawn } from 'node:child_process';
import { cp, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type ScaffoldManifest = {
    scaffoldVersion: string;
    templates: Array<{
        id: string;
        displayName: string;
        description: string;
    }>;
    /** Engine files earlier versions shipped and this one doesn't (`scripts/removed-engine-files.json`). */
    removedFiles?: string[];
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
const MAGIC_STRING_VERSION = '^1.4.2';
const ELECTRON_VERSION = '^44.4.5';
const ELECTRON_BUILDER_VERSION = '^26.15.3';
const ESLINT_VERSION = '^10.12.0';
const TYPESCRIPT_ESLINT_VERSION = '^8.71.0';

export function scaffoldRoot(extensionPath: string): string {
    return path.join(extensionPath, 'scaffold');
}

export function sharedScaffoldPath(extensionPath: string): string {
    return path.join(scaffoldRoot(extensionPath), 'shared');
}

export function templatesScaffoldPath(extensionPath: string): string {
    return path.join(scaffoldRoot(extensionPath), 'templates');
}

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
 * configs, …). `src/game/` (author content) is never written.
 */
export async function scanScaffoldUpdate(
    gameRoot: vscode.Uri,
    extensionPath: string,
): Promise<ScaffoldScanResult> {
    const result: ScaffoldScanResult = {
        newFiles: [],
        unchangedFiles: [],
        overwriteFiles: [],
    };

    const sharedFiles = await listScaffoldSharedFiles(extensionPath);
    await scanSourceTree(sharedFiles, sharedScaffoldPath(extensionPath), gameRoot, '', result);

    result.newFiles.sort();
    result.unchangedFiles.sort();
    result.overwriteFiles.sort();
    return result;
}

/**
 * Whether Update Engine may delete `rel` as an obsolete engine file: a plain relative path,
 * outside `src/game/` (author content). The one exception is `src/game/boot/`, engine code that
 * earlier versions kept there and that now lives in `src/engine/content/`.
 */
const LEGACY_GAME_BOOT_PREFIX = 'src/game/boot/';

export function isRemovableEngineFile(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    return (
        norm.length > 0 &&
        !path.isAbsolute(norm) &&
        !norm.split('/').some((part) => part === '..' || part === '.' || part === '') &&
        (!norm.startsWith('src/game/') || norm.startsWith(LEGACY_GAME_BOOT_PREFIX))
    );
}

/** The obsolete engine files from `removedFiles` that exist in the game. */
export async function findObsoleteEngineFiles(gameRoot: vscode.Uri, removedFiles: readonly string[]): Promise<string[]> {
    const found: string[] = [];
    for (const rel of removedFiles) {
        if (!isRemovableEngineFile(rel)) {
            continue;
        }
        try {
            const st = await vscode.workspace.fs.stat(vscode.Uri.joinPath(gameRoot, ...rel.split('/')));
            if (st.type === vscode.FileType.File) {
                found.push(rel);
            }
        } catch {
            /* not there */
        }
    }
    return found.sort();
}

/**
 * Deletes obsolete engine files (see {@link findObsoleteEngineFiles}) and then any folders they
 * leave empty, up to the game root. A folder that still has other files (the game's own) stays.
 */
export async function removeObsoleteEngineFiles(gameRoot: vscode.Uri, files: readonly string[]): Promise<void> {
    const dirs = new Set<string>();
    for (const rel of files) {
        if (!isRemovableEngineFile(rel)) {
            continue;
        }
        await rm(path.join(gameRoot.fsPath, ...rel.split('/')), { force: true });
        for (let dir = path.posix.dirname(rel); dir !== '.'; dir = path.posix.dirname(dir)) {
            dirs.add(dir);
        }
    }
    // Deepest first, so a parent is only checked once its children are gone.
    for (const dir of [...dirs].sort((a, b) => b.split('/').length - a.split('/').length)) {
        const abs = path.join(gameRoot.fsPath, ...dir.split('/'));
        try {
            if ((await readdir(abs)).length === 0) {
                await rmdir(abs);
            }
        } catch {
            /* already gone */
        }
    }
}

export async function copySharedScaffold(
    gameRoot: vscode.Uri,
    extensionPath: string,
): Promise<void> {
    const src = sharedScaffoldPath(extensionPath);
    await cp(src, gameRoot.fsPath, { recursive: true, force: true });
}

export function scaffoldPackageJsonTemplate(projectName: string): Record<string, unknown> {
    return {
        name: projectName,
        private: true,
        version: '0.0.0',
        type: 'module',
        main: 'electron/main.cjs',
        scripts: {
            'generate:game-ids': 'node scripts/generate-game-ids.mjs',
            predev: 'npm run generate:game-ids',
            dev: 'vite',
            prebuild: 'npm run generate:game-ids',
            build: 'tsc && vite build',
            'build:itch': 'npm run build && node scripts/package-itch.mjs',
            desktop: 'npm run build && electron .',
            'build:windows': 'npm run build && node scripts/prepare-desktop.mjs && electron-builder --config electron-builder.config.cjs --win --x64',
            'test:desktop': 'node --experimental-strip-types --test electron/protocol-path.test.cjs electron/environment.test.mjs',
            'test:desktop:smoke': 'node scripts/run-electron-test.cjs scripts/smoke-desktop.cjs',
            'test:webgl': 'node scripts/run-electron-test.cjs scripts/test-webgl-recovery.cjs && node scripts/run-electron-test.cjs scripts/test-webgl-recovery.cjs --startup-failure',
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
            lint: 'eslint src/game',
        },
        devDependencies: {
            electron: ELECTRON_VERSION,
            'electron-builder': ELECTRON_BUILDER_VERSION,
            eslint: ESLINT_VERSION,
            'magic-string': MAGIC_STRING_VERSION,
            'png-to-ico': '^3.0.2',
            pngjs: '^7.0.0',
            typescript: TYPESCRIPT_VERSION,
            'typescript-eslint': TYPESCRIPT_ESLINT_VERSION,
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

/** A new game's `eslint.config.mjs`: the BenneScript rules, which Update Engine refreshes in `scripts/lib/`. */
export const GAME_ESLINT_CONFIG = `// ESLint for this game (npm run lint). The BenneScript rules live in
// scripts/lib/eslint-plugin-bennescript.mjs, which Update Engine refreshes; add your own blocks below.
import tseslint from 'typescript-eslint';
import { gameScriptsConfig } from './scripts/lib/eslint-plugin-bennescript.mjs';

export default [gameScriptsConfig({ parser: tseslint.parser, tsconfigRootDir: import.meta.dirname })];
`;

/** Writes {@link GAME_ESLINT_CONFIG} unless the game already has an ESLint config (it may be the user's own). */
export async function ensureGameEslintConfig(gameRoot: vscode.Uri): Promise<boolean> {
    for (const name of ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts']) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.joinPath(gameRoot, name));
            return false;
        } catch {
            /* not there */
        }
    }
    await writeFile(path.join(gameRoot.fsPath, 'eslint.config.mjs'), GAME_ESLINT_CONFIG, 'utf8');
    return true;
}

/** Template scripts a game may have its own version of: Update Engine adds them only when missing. */
const GAME_OWNED_SCRIPTS = new Set(['lint']);

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

    const record = (value: unknown): Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown> : {};
    const merged = {
        ...existing,
        ...template,
        name: existing.name ?? template.name,
        private: existing.private ?? template.private,
        version: existing.version ?? template.version,
        type: existing.type ?? template.type,
        scripts: {
            ...record(existing.scripts),
            ...Object.fromEntries(
                Object.entries(record(template.scripts)).filter(
                    ([name]) => !(GAME_OWNED_SCRIPTS.has(name) && name in record(existing.scripts)),
                ),
            ),
        },
        devDependencies: { ...record(existing.devDependencies), ...record(template.devDependencies) },
        dependencies: { ...record(existing.dependencies), ...record(template.dependencies) },
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
