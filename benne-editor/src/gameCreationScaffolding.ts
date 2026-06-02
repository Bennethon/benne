import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { validateSlug } from './roomScaffolding';

type ScaffoldManifest = {
    scaffoldVersion: string;
    templates: Array<{
        id: string;
        displayName: string;
        description: string;
    }>;
};

type BenneProjectFile = {
    scaffoldVersion: string;
    extensionVersion: string;
    templateId: string;
    projectName: string;
    createdAt: string;
};

const PHASER_VERSION = '4.0.0-rc.7';
const TYPESCRIPT_VERSION = '~5.9.3';
const VITE_VERSION = '^8.0.1';

function getOutputChannel(): vscode.OutputChannel {
    return vscode.window.createOutputChannel('BENNE create game');
}

function scaffoldRoot(extensionPath: string): string {
    return path.join(extensionPath, 'scaffold');
}

async function readScaffoldManifest(extensionPath: string): Promise<ScaffoldManifest> {
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

function sanitizeProjectFolderName(name: string): string {
    const trimmed = name.trim();
    const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'my-benne-game';
}

function buildPackageJson(projectName: string): string {
    const pkg = {
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
    return `${JSON.stringify(pkg, null, 2)}\n`;
}

function buildReadme(projectName: string, templateDisplayName: string): string {
    return `# ${projectName}

BENNE point-and-click adventure game scaffolded from the **${templateDisplayName}** template.

## Getting started

1. Install dependencies (if you have not already):

   \`\`\`bash
   npm install
   \`\`\`

2. Run the game in the browser:

   \`\`\`bash
   npm run dev
   \`\`\`

3. Open this folder in VS Code with the **BENNE Editor** extension installed. Use the BENNE sidebar to author rooms, characters, GUIs, and more.

## Preview rebuilds

The BENNE extension ships default preview bundles. After changing engine-facing preview code, rebuild locally:

- \`npm run build:room-preview\`
- \`npm run build:character-preview\`
- \`npm run build:gui-preview\`
- \`npm run build:inventory-preview\`
- \`npm run build:benne-play\`

Standalone projects write rebuilt bundles to \`.benne/preview-bundles/\`.
`;
}

function buildVscodeSettings(): string {
    const settings = {
        'typescript.tsc.autoDetect': 'off',
    };
    return `${JSON.stringify(settings, null, 2)}\n`;
}

async function isNonEmptyDirectory(dirPath: string): Promise<boolean> {
    try {
        const entries = await readdir(dirPath);
        return entries.length > 0;
    } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
            return false;
        }
        throw e;
    }
}

async function copyTree(src: string, dest: string): Promise<void> {
    await cp(src, dest, { recursive: true, force: false });
}

async function runNpmScript(
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

async function runNpmInstall(cwd: string, channel: vscode.OutputChannel): Promise<boolean> {
    return runNpmScript(cwd, channel, ['install'], 'Installing npm dependencies…');
}

export async function runCreateGameWizard(extensionPath: string, extensionVersion: string): Promise<void> {
    const channel = getOutputChannel();
    let manifest: ScaffoldManifest;
    try {
        manifest = await readScaffoldManifest(extensionPath);
    } catch (e) {
        void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        return;
    }

    if (manifest.templates.length === 0) {
        void vscode.window.showErrorMessage('Scaffold manifest has no templates.');
        return;
    }

    const templatePick = await vscode.window.showQuickPick(
        manifest.templates.map((t) => ({
            label: t.displayName,
            description: t.id,
            detail: t.description,
            template: t,
        })),
        { placeHolder: 'Choose a BENNE game template' },
    );
    if (!templatePick) {
        return;
    }

    const defaultName = sanitizeProjectFolderName(templatePick.template.id);
    const nameInput = await vscode.window.showInputBox({
        prompt: 'Project name (used for folder and package.json name)',
        value: defaultName,
        validateInput: (v) => validateSlug(sanitizeProjectFolderName(v), 'Project name'),
    });
    if (!nameInput) {
        return;
    }
    const projectName = sanitizeProjectFolderName(nameInput);

    const parentUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select parent folder for the new game',
    });
    if (!parentUris || parentUris.length === 0) {
        return;
    }

    const destPath = path.join(parentUris[0].fsPath, projectName);
    if (await isNonEmptyDirectory(destPath)) {
        void vscode.window.showErrorMessage(
            `Target folder already exists and is not empty: ${destPath}`,
        );
        return;
    }

    const root = scaffoldRoot(extensionPath);
    const sharedSrc = path.join(root, 'shared');
    const templateSrc = path.join(root, 'templates', templatePick.template.id);

    try {
        await stat(sharedSrc);
        await stat(templateSrc);
    } catch {
        void vscode.window.showErrorMessage(
            'Scaffold payload incomplete. Rebuild the extension (`npm run bundle:scaffold`).',
        );
        return;
    }

    const ok = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Creating BENNE game "${projectName}"…`,
            cancellable: false,
        },
        async () => {
            await mkdir(destPath, { recursive: true });
            await copyTree(sharedSrc, destPath);
            await copyTree(templateSrc, path.join(destPath, 'src', 'game'));

            const benneProject: BenneProjectFile = {
                scaffoldVersion: manifest.scaffoldVersion,
                extensionVersion,
                templateId: templatePick.template.id,
                projectName,
                createdAt: new Date().toISOString(),
            };

            await writeFile(
                path.join(destPath, '.benne-project'),
                `${JSON.stringify(benneProject, null, 2)}\n`,
                'utf8',
            );
            await writeFile(path.join(destPath, 'package.json'), buildPackageJson(projectName), 'utf8');
            await writeFile(
                path.join(destPath, 'README.md'),
                buildReadme(projectName, templatePick.template.displayName),
                'utf8',
            );
            await mkdir(path.join(destPath, '.vscode'), { recursive: true });
            await writeFile(
                path.join(destPath, '.vscode', 'settings.json'),
                buildVscodeSettings(),
                'utf8',
            );

            channel.appendLine(`Created project at ${destPath}`);
            const installOk = await runNpmInstall(destPath, channel);
            if (!installOk) {
                return false;
            }
            return runNpmScript(
                destPath,
                channel,
                ['run', 'build:benne-play'],
                'Building BENNE Play bundle…',
            );
        },
    );

    if (!ok) {
        void vscode.window.showErrorMessage(
            'Game files were created but setup failed (npm install or BENNE Play build). See the "BENNE create game" output channel.',
        );
        return;
    }

    const open = await vscode.window.showInformationMessage(
        `BENNE game "${projectName}" created.`,
        'Open Folder',
    );
    if (open === 'Open Folder') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(destPath), {
            forceNewWindow: false,
        });
    }
}
