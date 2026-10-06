import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    buildPackageJson,
    copyTreeNonDestructive,
    readScaffoldManifest,
    runNpmScript,
    scaffoldRoot,
    type BenneProjectFile,
    type ScaffoldManifest,
} from './scaffoldPayload';
import { validateSlug } from './roomScaffolding';

function getOutputChannel(): vscode.OutputChannel {
    return vscode.window.createOutputChannel('BENNE create game');
}

function sanitizeProjectFolderName(name: string): string {
    const trimmed = name.trim();
    const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'my-benne-game';
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

## Publish your game

Run \`npm run build:itch\` to create \`releases/${projectName}-itch.zip\` for an itch.io HTML game. Upload it as a browser-playable ZIP. The build uses relative URLs, so it works beneath itch.io's game path.

Run \`npm run build:windows\` to create a portable Windows ZIP in \`releases/windows/\`. Set \`benne.displayName\` in \`package.json\` to control the window and executable name. Optionally add \`src/game/assets/images/icon.png\` for the desktop icon. The build includes an itch desktop launch manifest. You can try the Electron wrapper locally with \`npm run desktop\`.

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
            await copyTreeNonDestructive(sharedSrc, destPath);
            await copyTreeNonDestructive(templateSrc, path.join(destPath, 'src', 'game'));

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
            await writeFile(path.join(destPath, '.gitignore'), 'node_modules/\ndist/\n.benne/\nreleases/\n\n# BenneScript handles generated from src/game/ (npm run generate:game-ids)\nsrc/game/**/*.ids.ts\n', 'utf8');
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
