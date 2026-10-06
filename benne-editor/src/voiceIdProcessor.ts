import * as path from 'node:path';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import type { IdsIndex } from './bennescript/idsIndex';
import { buildSpeakerTable, readCharacterSpeakers, type SpeakerTable } from './bennescript/speakers';
import { collectVoiceLines, VOICE_MARKER_RE, type VoiceLineFile } from './bennescript/voiceLines';
import { findBenneGameFolders } from './gameDiscovery';
import { runGenerateGameIds } from './gameIdsGenerator';
import { idsIndexForGameRoot, invalidateGeneratedModules } from './scriptHandlers';

type VoiceIdMode = 'preserve' | 'overwrite';

/** A script file: `path` relative to the game folder; `fileName` absolute (resolves `./x.ids` imports). */
export type VoiceIdTextFileInput = VoiceLineFile;

/** How speech lines find their character (§4.2): speaker labels, generated handles, the starting player. */
export interface VoiceIdScanOptions {
    readonly startingPlayerCharacterId: string;
    readonly speakers: SpeakerTable;
    readonly index: IdsIndex;
}

export interface VoiceIdTextFileChange {
    readonly path: string;
    readonly originalText: string;
    readonly proposedText: string;
}

export interface VoiceIdPlanResult {
    readonly changes: VoiceIdTextFileChange[];
    readonly sidecar: Record<string, number>;
    readonly assignedCount: number;
    readonly strippedCount: number;
    readonly preservedCount: number;
    readonly skippedCount: number;
}

export interface SpeakingTextCsvRow {
    readonly character: string;
    readonly id: string;
    readonly script: string;
    readonly line: string;
}

export interface SpeakingTextExportResult {
    readonly rows: SpeakingTextCsvRow[];
    readonly skippedCount: number;
}

interface Replacement {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

interface DialoguePart {
    readonly start: number;
    readonly end: number;
    readonly text: string;
    readonly characterId: string | null;
    readonly hasMarker: boolean;
    readonly existingId: number | null;
}

interface ScanResult {
    readonly parts: DialoguePart[];
    readonly skippedCount: number;
}

const VOICE_ID_DIFF_SCHEME = 'benne-voice-id-preview';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const previewDocuments = new Map<string, string>();
let previewProviderRegistered = false;

class VoiceIdPreviewDocumentProvider implements vscode.TextDocumentContentProvider {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return previewDocuments.get(uri.toString()) ?? '';
    }

    update(uri: vscode.Uri, text: string): void {
        previewDocuments.set(uri.toString(), text);
        this._onDidChange.fire(uri);
    }
}

const previewProvider = new VoiceIdPreviewDocumentProvider();

function ensurePreviewProvider(context: vscode.ExtensionContext): void {
    if (previewProviderRegistered) {
        return;
    }
    previewProviderRegistered = true;
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(VOICE_ID_DIFF_SCHEME, previewProvider),
    );
}

function previewUri(kind: string, label: string): vscode.Uri {
    return vscode.Uri.parse(
        `${VOICE_ID_DIFF_SCHEME}:/${kind}/${encodeURIComponent(label.replace(/\\/g, '/'))}`,
    );
}

function formatSidecar(data: Record<string, number>): string {
    const sorted: Record<string, number> = {};
    for (const key of Object.keys(data).sort((a, b) => a.localeCompare(b))) {
        sorted[key] = data[key];
    }
    return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** Speech lines of the files (labels, `say` blocks, `x.say(…)`), via the ScriptModel. */
function scanFiles(files: readonly VoiceIdTextFileInput[], options: VoiceIdScanOptions): Map<string, ScanResult> {
    const scan = collectVoiceLines(ts, files, options);
    const out = new Map<string, ScanResult>();
    for (const file of files) {
        out.set(file.path, { parts: [], skippedCount: 0 });
    }
    for (const line of scan.lines) {
        out.get(line.path)!.parts.push({
            start: line.start,
            end: line.end,
            text: line.text,
            characterId: line.characterId,
            hasMarker: line.existingId !== null,
            existingId: line.existingId,
        });
    }
    for (const skipped of scan.skipped) {
        (out.get(skipped.path) as { skippedCount: number }).skippedCount += 1;
    }
    return out;
}

function applyReplacements(text: string, replacements: Replacement[]): string {
    if (replacements.length === 0) {
        return text;
    }
    const sorted = [...replacements].sort((a, b) => a.start - b.start);
    let out = '';
    let cursor = 0;
    for (const replacement of sorted) {
        out += text.slice(cursor, replacement.start);
        out += replacement.text;
        cursor = replacement.end;
    }
    out += text.slice(cursor);
    return out;
}

function cloneSidecar(sidecar: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(sidecar)) {
        if (Number.isInteger(value) && value > 0) {
            out[key] = value;
        }
    }
    return out;
}

function nextUnused(used: Set<number>): number {
    let id = 1;
    while (used.has(id)) {
        id += 1;
    }
    return id;
}

export function planVoiceIdsForFiles(
    files: readonly VoiceIdTextFileInput[],
    existingSidecar: Record<string, number>,
    options: VoiceIdScanOptions & { mode: VoiceIdMode },
): VoiceIdPlanResult {
    const scanned = scanFiles(files, options);
    const scans = files.map((file) => ({ file, scan: scanned.get(file.path)! }));
    const usedByCharacter = new Map<string, Set<number>>();
    const sidecar = options.mode === 'preserve' ? cloneSidecar(existingSidecar) : {};
    let assignedCount = 0;
    let strippedCount = 0;
    let preservedCount = 0;
    let skippedCount = scans.reduce((sum, item) => sum + item.scan.skippedCount, 0);

    const ensureUsed = (characterId: string): Set<number> => {
        let used = usedByCharacter.get(characterId);
        if (!used) {
            used = new Set<number>();
            usedByCharacter.set(characterId, used);
        }
        return used;
    };

    if (options.mode === 'preserve') {
        for (const [characterId, highest] of Object.entries(existingSidecar)) {
            if (Number.isInteger(highest) && highest > 0) {
                const used = ensureUsed(characterId);
                for (let id = 1; id <= highest; id += 1) {
                    used.add(id);
                }
            }
        }
        for (const { scan } of scans) {
            for (const part of scan.parts) {
                if (part.characterId && part.existingId !== null) {
                    ensureUsed(part.characterId).add(part.existingId);
                }
            }
        }
    }

    const changes: VoiceIdTextFileChange[] = [];

    for (const { file, scan } of scans) {
        const replacements: Replacement[] = [];
        for (const part of scan.parts) {
            if (!part.characterId) {
                skippedCount += 1;
                continue;
            }
            const existingMarker = VOICE_MARKER_RE.exec(part.text);
            if (options.mode === 'preserve' && existingMarker) {
                preservedCount += 1;
                const existingId = Number(existingMarker[1]);
                if (existingId > (sidecar[part.characterId] ?? 0)) {
                    sidecar[part.characterId] = existingId;
                }
                continue;
            }

            const stripped = existingMarker ? part.text.slice(existingMarker[0].length) : part.text;
            if (existingMarker) {
                strippedCount += 1;
            }
            const used = ensureUsed(part.characterId);
            const id = options.mode === 'preserve' ? nextUnused(used) : (sidecar[part.characterId] ?? 0) + 1;
            used.add(id);
            sidecar[part.characterId] = Math.max(sidecar[part.characterId] ?? 0, id);
            replacements.push({
                start: part.start,
                end: part.end,
                text: `|${id}| ${stripped}`,
            });
            assignedCount += 1;
        }
        const proposedText = applyReplacements(file.text, replacements);
        if (proposedText !== file.text) {
            changes.push({ path: file.path, originalText: file.text, proposedText });
        }
    }

    return { changes, sidecar, assignedCount, strippedCount, preservedCount, skippedCount };
}

export function exportSpeakingTextRowsForFiles(
    files: readonly VoiceIdTextFileInput[],
    options: VoiceIdScanOptions,
): SpeakingTextExportResult {
    const scanned = scanFiles(files, options);
    const rows: SpeakingTextCsvRow[] = [];
    let skippedCount = 0;

    for (const file of files) {
        const scan = scanned.get(file.path)!;
        skippedCount += scan.skippedCount;
        for (const part of scan.parts) {
            if (!part.characterId) {
                skippedCount += 1;
                continue;
            }
            const marker = VOICE_MARKER_RE.exec(part.text);
            rows.push({
                character: part.characterId,
                id: marker ? marker[1] : '',
                script: path.basename(file.path),
                line: marker ? part.text.slice(marker[0].length) : part.text,
            });
        }
    }

    return { rows, skippedCount };
}

function csvCell(value: string): string {
    if (!/[",\r\n]/.test(value)) {
        return value;
    }
    return `"${value.replace(/"/g, '""')}"`;
}

export function serializeSpeakingTextRowsAsCsv(rows: readonly SpeakingTextCsvRow[]): string {
    const lines = [
        ['Character', 'ID', 'Script', 'Line'],
        ...rows.map((row) => [row.character, row.id, row.script, row.line]),
    ];
    return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function asWorkspaceFolderPick(folder: vscode.WorkspaceFolder): vscode.QuickPickItem & { folder: vscode.WorkspaceFolder } {
    return { label: folder.name, description: folder.uri.fsPath, folder };
}

async function pickGameFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = await findBenneGameFolders();
    if (folders.length === 0) {
        void vscode.window.showErrorMessage('No BENNE game in the workspace (need a folder with src/game/rooms).');
        return undefined;
    }
    if (folders.length === 1) {
        return folders[0];
    }
    const picked = await vscode.window.showQuickPick(folders.map(asWorkspaceFolderPick), {
        title: 'Process Game Voice IDs',
        placeHolder: 'Choose a BENNE game to process',
        ignoreFocusOut: true,
    });
    return picked?.folder;
}

async function pickYesNo(title: string, yesDescription: string, noDescription: string): Promise<boolean | undefined> {
    const picked = await vscode.window.showQuickPick(
        [
            { label: 'Yes', description: yesDescription, value: true },
            { label: 'No', description: noDescription, value: false },
        ],
        { title, placeHolder: title, ignoreFocusOut: true },
    );
    return picked?.value;
}

function isUnderGameScripts(gameFolder: vscode.WorkspaceFolder, uri: vscode.Uri): boolean {
    const relative = path.relative(path.join(gameFolder.uri.fsPath, 'src', 'game'), uri.fsPath);
    return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function confirmDirtyTypeScriptDocuments(
    gameFolder: vscode.WorkspaceFolder,
    actionDescription: string,
    cancelledAction: string,
): Promise<boolean> {
    const dirtyDocs = vscode.workspace.textDocuments.filter(
        (doc) =>
            doc.isDirty &&
            doc.uri.scheme === 'file' &&
            doc.uri.fsPath.toLowerCase().endsWith('.ts') &&
            isUnderGameScripts(gameFolder, doc.uri),
    );
    if (dirtyDocs.length === 0) {
        return true;
    }

    const choice = await vscode.window.showWarningMessage(
        `There ${dirtyDocs.length === 1 ? 'is' : 'are'} ${dirtyDocs.length} unsaved TypeScript ${
            dirtyDocs.length === 1 ? 'file' : 'files'
        } under src/game. Save before ${actionDescription}?`,
        { modal: true },
        'Save and Continue',
        'Continue Anyway',
        'Cancel',
    );
    if (choice === 'Cancel' || choice === undefined) {
        return false;
    }
    if (choice === 'Save and Continue') {
        for (const doc of dirtyDocs) {
            if (!(await doc.save())) {
                void vscode.window.showErrorMessage(`Could not save ${doc.uri.fsPath}. ${cancelledAction} cancelled.`);
                return false;
            }
        }
    }
    return true;
}

async function readStartingPlayerCharacterId(gameFolder: vscode.WorkspaceFolder): Promise<string> {
    const uri = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'game-config.json');
    try {
        const data = JSON.parse(decoder.decode(await vscode.workspace.fs.readFile(uri))) as {
            startingPlayerCharacter?: unknown;
        };
        if (typeof data.startingPlayerCharacter === 'string' && data.startingPlayerCharacter.trim().length > 0) {
            return data.startingPlayerCharacter.trim();
        }
    } catch {
        /* Fall through to conservative default. */
    }
    return 'player';
}

/** Speaker table and handle index for the game's scripts; regenerates the handles first. */
async function readScanContext(gameFolder: vscode.WorkspaceFolder): Promise<{ speakers: SpeakerTable; index: IdsIndex }> {
    await runGenerateGameIds(gameFolder, { quiet: true });
    invalidateGeneratedModules();
    const gameRoot = path.join(gameFolder.uri.fsPath, 'src', 'game');
    return { speakers: buildSpeakerTable(readCharacterSpeakers(gameRoot)), index: idsIndexForGameRoot(gameRoot) };
}

async function readSidecar(gameFolder: vscode.WorkspaceFolder): Promise<Record<string, number>> {
    const uri = vscode.Uri.joinPath(gameFolder.uri, '.benne', 'voice-ids.json');
    try {
        const parsed = JSON.parse(decoder.decode(await vscode.workspace.fs.readFile(uri))) as Record<string, unknown>;
        const out: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
                out[key] = value;
            }
        }
        return out;
    } catch {
        return {};
    }
}

async function readProcessableFiles(gameFolder: vscode.WorkspaceFolder): Promise<VoiceIdTextFileInput[]> {
    const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(gameFolder, 'src/game/**/*.ts'), '**/*.ids.ts');
    uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    const files: VoiceIdTextFileInput[] = [];
    for (const uri of uris) {
        const relative = path.relative(gameFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        files.push({ path: relative, fileName: uri.fsPath, text: decoder.decode(await vscode.workspace.fs.readFile(uri)) });
    }
    return files;
}

function fullDocumentRange(text: string): vscode.Range {
    const lines = text.split(/\r?\n/);
    return new vscode.Range(0, 0, lines.length - 1, lines[lines.length - 1].length);
}

async function ensureBenneDirectory(gameFolder: vscode.WorkspaceFolder): Promise<void> {
    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(gameFolder.uri, '.benne'));
    } catch {
        /* createDirectory is recursive; ignore races with another writer. */
    }
}

async function applyVoiceIdPlan(gameFolder: vscode.WorkspaceFolder, plan: VoiceIdPlanResult): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    for (const change of plan.changes) {
        const uri = vscode.Uri.joinPath(gameFolder.uri, ...change.path.split('/'));
        edit.replace(uri, fullDocumentRange(change.originalText), change.proposedText);
    }
    const ok = await vscode.workspace.applyEdit(edit);
    if (!ok) {
        throw new Error('VS Code rejected the workspace edit.');
    }
    await ensureBenneDirectory(gameFolder);
    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(gameFolder.uri, '.benne', 'voice-ids.json'),
        encoder.encode(formatSidecar(plan.sidecar)),
    );
}

async function openReviewDiffs(
    context: vscode.ExtensionContext,
    gameFolder: vscode.WorkspaceFolder,
    plan: VoiceIdPlanResult,
    sidecarOriginal: string,
): Promise<void> {
    ensurePreviewProvider(context);
    for (const change of plan.changes) {
        const left = vscode.Uri.joinPath(gameFolder.uri, ...change.path.split('/'));
        const right = previewUri('proposed', `${gameFolder.name}/${change.path}`);
        previewProvider.update(right, change.proposedText);
        await vscode.commands.executeCommand(
            'vscode.diff',
            left,
            right,
            `Voice IDs: ${path.basename(change.path)}`,
        );
    }

    const sidecarUri = vscode.Uri.joinPath(gameFolder.uri, '.benne', 'voice-ids.json');
    const proposedSidecar = formatSidecar(plan.sidecar);
    if (proposedSidecar !== sidecarOriginal) {
        let left = sidecarUri;
        try {
            await vscode.workspace.fs.stat(sidecarUri);
        } catch {
            left = previewUri('original', `${gameFolder.name}/.benne/voice-ids.json`);
            previewProvider.update(left, sidecarOriginal);
        }
        const right = previewUri('proposed', `${gameFolder.name}/.benne/voice-ids.json`);
        previewProvider.update(right, proposedSidecar);
        await vscode.commands.executeCommand('vscode.diff', left, right, 'Voice IDs: voice-ids.json');
    }
}

function completionMessage(plan: VoiceIdPlanResult): string {
    const changedFiles = plan.changes.length;
    const parts = [
        `Processed voice IDs: ${plan.assignedCount} assigned`,
        `${changedFiles} ${changedFiles === 1 ? 'file' : 'files'} changed`,
    ];
    if (plan.preservedCount > 0) {
        parts.push(`${plan.preservedCount} existing preserved`);
    }
    if (plan.strippedCount > 0) {
        parts.push(`${plan.strippedCount} existing reassigned`);
    }
    if (plan.skippedCount > 0) {
        parts.push(`${plan.skippedCount} skipped`);
    }
    return `${parts.join(', ')}.`;
}

export async function runProcessGameVoiceIdsCommand(context: vscode.ExtensionContext): Promise<void> {
    const gameFolder = await pickGameFolder();
    if (!gameFolder) {
        return;
    }

    const preserve = await pickYesNo(
        'Preserve existing voice IDs?',
        'Default: only add missing markers',
        'Strip existing markers and assign fresh numbers',
    );
    if (preserve === undefined) {
        return;
    }

    const review = await pickYesNo(
        'Review changes first?',
        'Default: open VS Code diffs before applying',
        'Apply immediately without review',
    );
    if (review === undefined) {
        return;
    }

    if (!(await confirmDirtyTypeScriptDocuments(gameFolder, 'processing voice IDs', 'Voice ID processing'))) {
        return;
    }

    const [startingPlayerCharacterId, scanContext, sidecar, files] = await Promise.all([
        readStartingPlayerCharacterId(gameFolder),
        readScanContext(gameFolder),
        readSidecar(gameFolder),
        readProcessableFiles(gameFolder),
    ]);
    const sidecarOriginal = formatSidecar(sidecar);
    const plan = planVoiceIdsForFiles(files, sidecar, {
        mode: preserve ? 'preserve' : 'overwrite',
        startingPlayerCharacterId,
        ...scanContext,
    });

    if (plan.changes.length === 0 && formatSidecar(plan.sidecar) === sidecarOriginal) {
        void vscode.window.showInformationMessage(
            plan.skippedCount > 0
                ? `No voice ID changes needed. ${plan.skippedCount} dialogue ${plan.skippedCount === 1 ? 'line was' : 'lines were'} skipped.`
                : 'No voice ID changes needed.',
        );
        return;
    }

    if (review) {
        await openReviewDiffs(context, gameFolder, plan, sidecarOriginal);
        const choice = await vscode.window.showWarningMessage(
            `${completionMessage(plan)} Apply these voice ID changes?`,
            { modal: true },
            'Apply Voice IDs',
            'Cancel',
        );
        if (choice !== 'Apply Voice IDs') {
            return;
        }
    }

    try {
        await applyVoiceIdPlan(gameFolder, plan);
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Process Game Voice IDs failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }

    void vscode.window.showInformationMessage(completionMessage(plan));
}

export async function runExportSpeakingTextCsvCommand(): Promise<void> {
    const gameFolder = await pickGameFolder();
    if (!gameFolder) {
        return;
    }

    if (!(await confirmDirtyTypeScriptDocuments(gameFolder, 'exporting speaking text', 'Speaking text export'))) {
        return;
    }

    const [startingPlayerCharacterId, scanContext, files] = await Promise.all([
        readStartingPlayerCharacterId(gameFolder),
        readScanContext(gameFolder),
        readProcessableFiles(gameFolder),
    ]);
    const exportResult = exportSpeakingTextRowsForFiles(files, {
        startingPlayerCharacterId,
        ...scanContext,
    });

    if (exportResult.rows.length === 0) {
        void vscode.window.showInformationMessage(
            exportResult.skippedCount > 0
                ? `No exportable speaking text found. ${exportResult.skippedCount} dialogue ${
                      exportResult.skippedCount === 1 ? 'line was' : 'lines were'
                  } skipped.`
                : 'No speaking text found.',
        );
        return;
    }

    const dest = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(gameFolder.uri, 'benne-speaking-text.csv'),
        filters: { 'CSV Files': ['csv'] },
        saveLabel: 'Export Speaking Text',
        title: 'Export Speaking Text as CSV',
    });
    if (!dest) {
        return;
    }

    try {
        await vscode.workspace.fs.writeFile(dest, encoder.encode(serializeSpeakingTextRowsAsCsv(exportResult.rows)));
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Export Speaking Text as CSV failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }

    const skippedSuffix =
        exportResult.skippedCount > 0
            ? ` ${exportResult.skippedCount} dialogue ${exportResult.skippedCount === 1 ? 'line was' : 'lines were'} skipped.`
            : '';
    void vscode.window.showInformationMessage(
        `Exported ${exportResult.rows.length} speaking text ${
            exportResult.rows.length === 1 ? 'line' : 'lines'
        } to ${vscode.workspace.asRelativePath(dest)}.${skippedSuffix}`,
    );
}
