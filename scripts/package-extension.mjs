#!/usr/bin/env node
// @ts-check
/**
 * One-command extension release: bump benne-editor/package.json version (and the version named in
 * benne-editor/README.md's release notes), turn the changelog's [Unreleased] section into the new
 * version's, then run
 * `vsce package` (which triggers vscode:prepublish → bundle scaffold, preview builds, webpack).
 *
 * Usage (from repo root):
 *   node scripts/package-extension.mjs [patch|minor|major|--no-bump]
 *
 * Default: patch bump.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_TEMPLATES } from './lib/releaseTemplates.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const EXTENSION_DIR = path.join(REPO_ROOT, 'benne-editor');
const EXTENSION_PKG = path.join(EXTENSION_DIR, 'package.json');
const EXTENSION_README = path.join(EXTENSION_DIR, 'README.md');
const EXTENSION_CHANGELOG = path.join(EXTENSION_DIR, 'CHANGELOG.md');
/** Changes waiting for a release. The heading exists only while there are some. */
const CHANGELOG_UNRELEASED = '## [Unreleased]';
/** The README's "Release notes" line, which names the current version. */
const README_VERSION_LINE = /The current release is \*\*[^*]+\*\*\./;

/** @typedef {'patch' | 'minor' | 'major'} BumpKind */

/**
 * @param {string} version
 * @param {BumpKind} kind
 * @returns {string}
 */
function bumpSemver(version, kind) {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);
    if (!match) {
        throw new Error(`Invalid semver in benne-editor/package.json: ${version}`);
    }
    let major = Number(match[1]);
    let minor = Number(match[2]);
    let patch = Number(match[3]);
    switch (kind) {
        case 'major':
            major += 1;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor += 1;
            patch = 0;
            break;
        case 'patch':
            patch += 1;
            break;
        default:
            throw new Error(`Unknown bump kind: ${kind}`);
    }
    return `${major}.${minor}.${patch}`;
}

/**
 * @param {string[]} argv
 * @returns {{ doBump: boolean; bump: BumpKind }}
 */
function parseArgs(argv) {
    const arg = argv[2];
    if (!arg || arg === 'patch') {
        return { doBump: true, bump: 'patch' };
    }
    if (arg === '--no-bump' || arg === 'no-bump') {
        return { doBump: false, bump: 'patch' };
    }
    if (arg === 'minor' || arg === 'major') {
        return { doBump: true, bump: arg };
    }
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: node scripts/package-extension.mjs [patch|minor|major|--no-bump]');
    process.exit(1);
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {number}
 */
function run(cmd, args, cwd) {
    const result = spawnSync(cmd, args, {
        cwd,
        shell: true,
        stdio: 'inherit',
        env: process.env,
    });
    return result.status ?? 1;
}

async function main() {
    const { doBump, bump } = parseArgs(process.argv);

    // The BENNE Play bundle in media/ is built from src/game and ships in the VSIX, so only a
    // release template may be active (never a development-only one such as ai-apocalypse).
    const gameConfig = JSON.parse(await readFile(path.join(REPO_ROOT, 'src', 'game', 'game-config.json'), 'utf8'));
    const active = /** @type {{ name?: string }} */ (gameConfig).name ?? '';
    if (!Object.hasOwn(RELEASE_TEMPLATES, active)) {
        const releases = Object.keys(RELEASE_TEMPLATES).join(', ');
        console.error(`src/game is template "${active}", which does not ship (release templates: ${releases}).`);
        console.error('Swap one in first, e.g. `npm run set-template:9-verb`, then package.');
        process.exit(1);
    }

    // VS Code loads the TS server plugin from node_modules/benne-room-id-completions in the VSIX, and
    // vsce ships a symlinked dependency elsewhere. benne-editor/.npmrc installs it as a copy; an
    // install from before that is still a symlink.
    if (lstatSync(path.join(EXTENSION_DIR, 'node_modules', 'benne-room-id-completions')).isSymbolicLink()) {
        console.error('benne-editor/node_modules/benne-room-id-completions is a symlink, so the VSIX would lack the TS plugin.');
        console.error('Fix: rm benne-editor/node_modules/benne-room-id-completions && npm --prefix benne-editor install');
        process.exit(1);
    }

    const raw = await readFile(EXTENSION_PKG, 'utf8');
    /** @type {{ version?: string; name?: string }} */
    const pkg = JSON.parse(raw);
    const oldVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';

    if (doBump) {
        const newVersion = bumpSemver(oldVersion, bump);
        pkg.version = newVersion;
        await writeFile(EXTENSION_PKG, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
        console.log(`Version: ${oldVersion} → ${newVersion}`);

        // The README is the extension's Details page; keep its release line on the new version.
        const readme = await readFile(EXTENSION_README, 'utf8');
        if (README_VERSION_LINE.test(readme)) {
            const line = `The current release is **${newVersion}**.`;
            await writeFile(EXTENSION_README, readme.replace(README_VERSION_LINE, line), 'utf8');
        } else {
            console.warn('benne-editor/README.md has no "The current release is **…**." line to update.');
        }

        // The changes collected under [Unreleased] become this release's notes.
        const changelog = await readFile(EXTENSION_CHANGELOG, 'utf8');
        if (changelog.includes(CHANGELOG_UNRELEASED)) {
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
            const heading = `## [${newVersion}] - ${today}`;
            await writeFile(EXTENSION_CHANGELOG, changelog.replace(CHANGELOG_UNRELEASED, heading), 'utf8');
            console.log(`Changelog: [Unreleased] → [${newVersion}] - ${today}`);
        } else {
            console.warn(`benne-editor/CHANGELOG.md has no "${CHANGELOG_UNRELEASED}" section, so ${newVersion} has no release notes.`);
        }
    } else {
        console.log(`Version: ${oldVersion} (unchanged)`);
    }

    const version = typeof pkg.version === 'string' ? pkg.version : oldVersion;
    const vsixName = `benne-editor-${version}.vsix`;

    console.log('');
    console.log('Packaging VSIX…');
    console.log('  1. bundle:scaffold   (engine + templates → benne-editor/scaffold/)');
    console.log('  2. build:previews    (room, character, GUI, inventory, BENNE Play → media/)');
    console.log('  3. webpack package   (extension + Inspector + PDC editor → dist/)');
    console.log('  4. vsce package      (write .vsix)');
    console.log('');

    const exitCode = run('npm', ['exec', '--', '@vscode/vsce', 'package'], EXTENSION_DIR);
    if (exitCode !== 0) {
        if (doBump) {
            console.error('');
            console.error(
                'Packaging failed after the version bump. Fix the error and retry with:',
            );
            console.error('  npm run package:extension:no-bump');
        }
        process.exit(exitCode);
    }

    console.log('');
    console.log(`Done: ${path.join(EXTENSION_DIR, vsixName)}`);
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
