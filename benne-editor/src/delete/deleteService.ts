import * as path from 'node:path';
import * as vscode from 'vscode';
import { stripLineAndBlockComments } from '../verbHandlerPresence';
import { formatJson } from '../roomScaffolding';
import { listRoomDefinitions } from '../gameDiscovery';
import { readRoomJsonText } from '../inspectorStateBuilder';
import type { DeleteTarget } from './deleteTarget';
import type { EditorSelection } from '../editorSelection';

const TRASH = { recursive: true, useTrash: true };

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ScriptReferenceHit = {
    uri: vscode.Uri;
    line: number;
    excerpt: string;
};

export type DeleteImpactSummary = {
    /** Short title for the modal (without the word Delete). */
    modalTitle: string;
    /** Primary sentence above the detail box. */
    message: string;
    /** Multi-line body shown in `MessageOptions.detail`. */
    detailLines: string[];
    referenceHits: ScriptReferenceHit[];
    /** Editors to close before mutating or deleting files. */
    urisToClose: vscode.Uri[];
};

function gameRootUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return folder.uri;
}

function gameConfigUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, 'src', 'game', 'game-config.json');
}

function roomsManifestUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, 'src', 'game', 'rooms', 'rooms.manifest.json');
}

async function readUtf8(uri: vscode.Uri): Promise<string | undefined> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder('utf-8').decode(raw);
    } catch {
        return undefined;
    }
}

async function findScriptScanUris(folder: vscode.WorkspaceFolder): Promise<vscode.Uri[]> {
    const base = folder.uri;
    const roomTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/**/*.room.ts'));
    const charTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/**/*.character.ts'));
    const globalTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/globalScript.ts'));
    const seen = new Set<string>();
    const out: vscode.Uri[] = [];
    for (const u of [...roomTs, ...charTs, ...globalTs]) {
        const k = u.toString();
        if (!seen.has(k)) {
            seen.add(k);
            out.push(u);
        }
    }
    return out;
}

function regexesForDeleteTarget(target: DeleteTarget): RegExp[] {
    switch (target.type) {
        case 'room': {
            const r = escapeRe(target.roomId);
            return [new RegExp(`verb:room:${r}:`), new RegExp(`['\`]${r}['\`]\\s*[,\\)]`)];
        }
        case 'character': {
            const c = escapeRe(target.characterId);
            return [
                new RegExp(`registerCharacterScript\\s*\\(\\s*['\`]${c}['\`]`),
                new RegExp(`verb:character:${c}:`),
                new RegExp(`verb:room:[^'"\`]+:character:${c}:`),
                new RegExp(`B\\.character\\(\\s*['\`]${c}['\`]`)
            ];
        }
        case 'gui': {
            const g = escapeRe(target.guiId);
            return [new RegExp(`registerGuiScript\\s*\\(\\s*['\`]${g}['\`]`)];
        }
        case 'prop': {
            const rr = escapeRe(target.roomId);
            const pr = escapeRe(target.prop.id);
            return [
                new RegExp(`verb:room:${rr}:prop:${pr}:`),
                new RegExp(`verb:room:${rr}:prop:${pr}:fallback`),
                new RegExp(`B\\.prop\\(\\s*['\`]${pr}['\`]`)
            ];
        }
        case 'hotspot': {
            const rr = escapeRe(target.roomId);
            const hr = escapeRe(target.hotspotId);
            return [
                new RegExp(`verb:room:${rr}:hotspot:${hr}:`),
                new RegExp(`verb:room:${rr}:hotspot:${hr}:fallback`)
            ];
        }
        case 'point': {
            const pid = escapeRe(target.pointId);
            return [
                new RegExp(`walkTo\\(\\s*['\`]${pid}['\`]`, 'm'),
                new RegExp(`['\`]${pid}['\`]`)
            ];
        }
        case 'region': {
            const rid = escapeRe(target.regionId);
            return [new RegExp(`['\`]${rid}['\`]`)];
        }
        case 'spawnedCharacter': {
            const rr = escapeRe(target.roomId);
            const cr = escapeRe(target.characterId);
            const ir = escapeRe(target.instanceId);
            return [
                new RegExp(`verb:room:${rr}:character:${cr}:`),
                new RegExp(`verb:room:${rr}:character:${cr}:fallback`),
                new RegExp(`B\\.character\\(\\s*['\`]${cr}['\`]`),
                new RegExp(`['\`]${ir}['\`]`)
            ];
        }
        default:
            return [];
    }
}

function collectHitsInSource(uri: vscode.Uri, source: string, patterns: RegExp[]): ScriptReferenceHit[] {
    if (patterns.length === 0) {
        return [];
    }
    const lines = source.split(/\r?\n/);
    const hits: ScriptReferenceHit[] = [];
    const seenLine = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (rawLine === undefined) {
            continue;
        }
        const lineNo = i + 1;
        const stripped = stripLineAndBlockComments(rawLine);
        if (!stripped.trim()) {
            continue;
        }
        let matched = false;
        for (const re of patterns) {
            re.lastIndex = 0;
            if (re.test(stripped)) {
                matched = true;
                break;
            }
        }
        if (matched && !seenLine.has(lineNo)) {
            seenLine.add(lineNo);
            hits.push({
                uri,
                line: lineNo,
                excerpt: rawLine.trim().slice(0, 140)
            });
        }
    }
    return hits;
}

export async function scanScriptReferences(target: DeleteTarget): Promise<ScriptReferenceHit[]> {
    const patterns = regexesForDeleteTarget(target);
    if (patterns.length === 0) {
        return [];
    }
    const uris = await findScriptScanUris(target.folder);
    const all: ScriptReferenceHit[] = [];
    for (const uri of uris) {
        const text = await readUtf8(uri);
        if (!text) {
            continue;
        }
        all.push(...collectHitsInSource(uri, text, patterns));
    }
    return all;
}

function characterSpawnDefinitionSuffix(characterId: string): string {
    return `${characterId}/${characterId}.character.json`;
}

async function listRoomJsonUrisReferencingCharacter(
    folder: vscode.WorkspaceFolder,
    characterId: string
): Promise<vscode.Uri[]> {
    const suffix = characterSpawnDefinitionSuffix(characterId);
    const rooms = await listRoomDefinitions(folder);
    const out: vscode.Uri[] = [];
    for (const r of rooms) {
        let text: string;
        try {
            text = await readRoomJsonText(r.uri);
        } catch {
            continue;
        }
        try {
            const data = JSON.parse(text) as { characters?: { definition?: string }[] };
            const chars = Array.isArray(data.characters) ? data.characters : [];
            if (chars.some((c) => typeof c.definition === 'string' && c.definition.includes(suffix))) {
                out.push(r.uri);
            }
        } catch {
            /* skip */
        }
    }
    return out;
}

async function gameConfigDependencyLines(folder: vscode.WorkspaceFolder, target: DeleteTarget): Promise<string[]> {
    const uri = gameConfigUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return ['• game-config.json — could not read (skipping dependency check).'];
    }
    const lines: string[] = [];
    try {
        const cfg = JSON.parse(text) as {
            startingRoomId?: unknown;
            startingPlayerCharacter?: unknown;
        };
        if (target.type === 'room' && cfg.startingRoomId === target.roomId) {
            lines.push(`• game-config.json sets startingRoomId to "${target.roomId}" (update after delete).`);
        }
        if (target.type === 'character' && cfg.startingPlayerCharacter === target.characterId) {
            lines.push(
                `• game-config.json sets startingPlayerCharacter to "${target.characterId}" (update after delete).`
            );
        }
        if (target.type === 'gui') {
            if (text.includes(`"${target.guiId}"`) || text.includes(`'${target.guiId}'`)) {
                lines.push(`• game-config.json may reference GUI id "${target.guiId}" (heuristic string match).`);
            }
        }
    } catch {
        lines.push('• game-config.json — invalid JSON; dependency hints skipped.');
    }
    return lines;
}

async function manifestLinesForRoomDelete(folder: vscode.WorkspaceFolder, roomId: string): Promise<string[]> {
    const uri = roomsManifestUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return ['• rooms.manifest.json — could not read.'];
    }
    try {
        const m = JSON.parse(text) as { startRoomId?: string; rooms?: { id: string }[] };
        const rooms = Array.isArray(m.rooms) ? m.rooms : [];
        const has = rooms.some((r) => r.id === roomId);
        const out: string[] = [];
        if (has) {
            out.push(`• rooms.manifest.json lists room "${roomId}" (entry will be removed).`);
        }
        if (m.startRoomId === roomId) {
            out.push(`• rooms.manifest.json startRoomId is "${roomId}" (will be repointed to another room if possible).`);
        }
        return out.length > 0 ? out : ['• rooms.manifest.json — no entry for this room id.'];
    } catch {
        return ['• rooms.manifest.json — invalid JSON.'];
    }
}

function collectUrisToClose(target: DeleteTarget): vscode.Uri[] {
    switch (target.type) {
        case 'room':
            return [
                target.roomJsonUri,
                vscode.Uri.joinPath(target.roomJsonUri, '..', `${target.roomId}.room.ts`)
            ];
        case 'character':
            return [
                target.characterJsonUri,
                vscode.Uri.joinPath(target.characterJsonUri, '..', `${target.characterId}.character.ts`)
            ];
        case 'gui':
            return [
                target.guiJsonUri,
                vscode.Uri.joinPath(target.guiJsonUri, '..', `${target.guiId}.gui.ts`)
            ];
        case 'prop':
        case 'hotspot':
        case 'point':
        case 'region':
        case 'spawnedCharacter':
            return [target.roomJsonUri];
        default:
            return [];
    }
}

function entityKindLabel(target: DeleteTarget): string {
    switch (target.type) {
        case 'room':
            return 'room';
        case 'character':
            return 'character';
        case 'gui':
            return 'GUI';
        case 'prop':
            return 'prop';
        case 'hotspot':
            return 'hotspot';
        case 'point':
            return 'point';
        case 'region':
            return 'region';
        case 'spawnedCharacter':
            return 'spawned character';
        default:
            return 'entity';
    }
}

/**
 * Builds impact copy for the confirmation modal: filesystem scope, manifests / game-config, and script hits.
 */
export async function buildDeleteImpactSummary(target: DeleteTarget): Promise<DeleteImpactSummary> {
    const kind = entityKindLabel(target);
    const modalTitle = `Delete ${kind} “${target.displayLabel}”?`;
    const detailLines: string[] = [];

    detailLines.push('Will remove:');
    switch (target.type) {
        case 'room':
            detailLines.push(`• Room folder src/game/rooms/${target.roomId}/ (JSON + script)`);
            detailLines.push(`• Asset folder src/game/assets/images/rooms/${target.roomId}/ (if present)`);
            detailLines.push(...(await manifestLinesForRoomDelete(target.folder, target.roomId)));
            detailLines.push(...(await gameConfigDependencyLines(target.folder, target)));
            break;
        case 'character':
            detailLines.push(`• Character folder src/game/characters/${target.characterId}/`);
            detailLines.push(`• Asset folder src/game/assets/images/characters/${target.characterId}/ (if present)`);
            detailLines.push(...(await gameConfigDependencyLines(target.folder, target)));
            {
                const refs = await listRoomJsonUrisReferencingCharacter(target.folder, target.characterId);
                if (refs.length > 0) {
                    detailLines.push(
                        `• ${refs.length} room JSON file(s) spawn this character — instances will be removed from those rooms.`
                    );
                }
            }
            break;
        case 'gui':
            detailLines.push(`• GUI folder src/game/guis/${target.guiId}/`);
            detailLines.push(`• Asset folder src/game/assets/images/guis/${target.guiId}/ (if present)`);
            detailLines.push(...(await gameConfigDependencyLines(target.folder, target)));
            detailLines.push(
                '• Script scan below covers *.room.ts, *.character.ts, and globalScript.ts only — search *.gui.ts by hand if unsure.'
            );
            break;
        case 'prop':
            detailLines.push(
                `• Prop “${target.prop.tag ?? target.prop.id}” (${target.prop.id}) from room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            detailLines.push(
                '• Hand-clean verb handlers in the matching *.room.ts if you no longer need them (scan results are hints only).'
            );
            break;
        case 'hotspot':
            detailLines.push(
                `• Hotspot “${target.hotspotId}” from room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            detailLines.push('• Hand-clean matching *.room.ts handlers if needed.');
            break;
        case 'point':
            detailLines.push(
                `• Point “${target.pointId}” from room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            detailLines.push('• Scripts may still mention this id — review scan results.');
            break;
        case 'region':
            detailLines.push(
                `• Region “${target.regionId}” from room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            detailLines.push('• Scripts may still mention this id — review scan results.');
            break;
        case 'spawnedCharacter':
            detailLines.push(
                `• Spawned character “${target.characterId}” (instance ${target.instanceId}) from room “${target.roomName}” (${target.roomId}) in room JSON only — the character definition under src/game/characters/ is not removed.`
            );
            detailLines.push(
                '• Hand-clean room-scoped verb handlers in this room’s *.room.ts if you no longer need them.'
            );
            break;
        default:
            break;
    }

    const referenceHits = await scanScriptReferences(target);
    detailLines.push('');
    detailLines.push(
        referenceHits.length > 0
            ? `Possible script references (heuristic, *.room.ts / *.character.ts / globalScript.ts): ${referenceHits.length} line(s).`
            : 'No obvious script references matched those file patterns (still review manually).'
    );
    detailLines.push('Deletion is not blocked by references — you stay in control of cleanup.');

    const message = `You are about to permanently remove this ${kind} from disk or room data (see detail).`;

    return {
        modalTitle,
        message,
        detailLines,
        referenceHits,
        urisToClose: collectUrisToClose(target)
    };
}

/**
 * Closes editor tabs whose resource matches one of the given URIs (text and diff tabs).
 */
export async function closeOpenEditorsForUris(uris: vscode.Uri[]): Promise<void> {
    if (uris.length === 0) {
        return;
    }
    const want = new Set(uris.map((u) => u.toString()));
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input;
            if (input instanceof vscode.TabInputText && want.has(input.uri.toString())) {
                await vscode.window.tabGroups.close(tab);
            } else if (input instanceof vscode.TabInputTextDiff) {
                if (want.has(input.original.toString()) || want.has(input.modified.toString())) {
                    await vscode.window.tabGroups.close(tab);
                }
            }
        }
    }
}

export async function closeOpenEditorsForTarget(target: DeleteTarget): Promise<void> {
    await closeOpenEditorsForUris(collectUrisToClose(target));
}

/** Modal confirmation; “Show References” returns that choice so the caller can list hits and ask again. */
export async function promptDeleteConfirmation(summary: DeleteImpactSummary): Promise<'delete' | 'cancel' | 'showReferences'> {
    const detail = summary.detailLines.join('\n');
    const picked = await vscode.window.showWarningMessage(
        `${summary.modalTitle}\n\n${summary.message}`,
        { modal: true, detail },
        'Show References',
        'Delete',
        'Cancel'
    );
    if (picked === 'Delete') {
        return 'delete';
    }
    if (picked === 'Show References') {
        return 'showReferences';
    }
    return 'cancel';
}

export async function showReferenceHitsPicker(hits: ScriptReferenceHit[]): Promise<void> {
    if (hits.length === 0) {
        void vscode.window.showInformationMessage('No reference lines to show.');
        return;
    }
    const items = hits.map((h) => ({
        label: `${path.basename(h.uri.fsPath)}:${h.line}`,
        description: h.excerpt,
        hit: h
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: 'Possible script references (heuristic)',
        placeHolder: 'Pick a line to open in the editor'
    });
    if (!picked) {
        return;
    }
    const doc = await vscode.workspace.openTextDocument(picked.hit.uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const line = picked.hit.line - 1;
    const max = doc.lineCount > 0 ? doc.lineCount - 1 : 0;
    const pos = new vscode.Position(Math.min(Math.max(0, line), max), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

async function deleteDirectoryIfPresent(uri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        return;
    }
    await vscode.workspace.fs.delete(uri, TRASH);
}

async function removeRoomFromManifest(folder: vscode.WorkspaceFolder, roomId: string): Promise<void> {
    const uri = roomsManifestUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return;
    }
    try {
        const manifest = JSON.parse(text) as {
            startRoomId?: string;
            rooms?: { id: string; definition: string }[];
        };
        const rooms = Array.isArray(manifest.rooms) ? [...manifest.rooms] : [];
        const nextRooms = rooms.filter((r) => r.id !== roomId);
        let startRoomId =
            typeof manifest.startRoomId === 'string' && manifest.startRoomId.length > 0
                ? manifest.startRoomId
                : undefined;
        if (startRoomId === roomId) {
            startRoomId = nextRooms[0]?.id;
        }
        const next = {
            ...(typeof startRoomId === 'string' && startRoomId.length > 0 ? { startRoomId } : {}),
            rooms: nextRooms
        };
        await vscode.workspace.fs.writeFile(uri, formatJson(next));
    } catch {
        void vscode.window.showWarningMessage('Could not update rooms.manifest.json after room delete.');
    }
}

async function patchGameConfigAfterRoomDelete(folder: vscode.WorkspaceFolder, deletedRoomId: string): Promise<void> {
    const uri = gameConfigUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return;
    }
    try {
        const cfg = JSON.parse(text) as Record<string, unknown>;
        if (cfg.startingRoomId === deletedRoomId) {
            const manifestText = await readUtf8(roomsManifestUri(folder));
            let fallback = '';
            if (manifestText) {
                const m = JSON.parse(manifestText) as { rooms?: { id: string }[] };
                const ids = Array.isArray(m.rooms) ? m.rooms.map((r) => r.id).filter(Boolean) : [];
                fallback = ids[0] ?? '';
            }
            if (fallback) {
                cfg.startingRoomId = fallback;
            } else {
                delete cfg.startingRoomId;
            }
            await vscode.workspace.fs.writeFile(uri, formatJson(cfg));
        }
    } catch {
        void vscode.window.showWarningMessage('Could not adjust game-config.json startingRoomId after room delete.');
    }
}

async function patchGameConfigAfterCharacterDelete(
    folder: vscode.WorkspaceFolder,
    characterId: string
): Promise<void> {
    const uri = gameConfigUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return;
    }
    try {
        const cfg = JSON.parse(text) as Record<string, unknown>;
        if (cfg.startingPlayerCharacter === characterId) {
            delete cfg.startingPlayerCharacter;
            await vscode.workspace.fs.writeFile(uri, formatJson(cfg));
        }
    } catch {
        void vscode.window.showWarningMessage(
            'Could not adjust game-config.json startingPlayerCharacter after character delete.'
        );
    }
}

async function removeCharacterSpawnsFromAllRooms(folder: vscode.WorkspaceFolder, characterId: string): Promise<void> {
    const suffix = characterSpawnDefinitionSuffix(characterId);
    const rooms = await listRoomDefinitions(folder);
    for (const r of rooms) {
        let text: string;
        try {
            text = await readRoomJsonText(r.uri);
        } catch {
            continue;
        }
        try {
            const data = JSON.parse(text) as { characters?: RoomCharacterJson[] };
            const chars = Array.isArray(data.characters) ? data.characters : [];
            const nextChars = chars.filter(
                (c) => !(typeof c.definition === 'string' && c.definition.includes(suffix))
            );
            if (nextChars.length === chars.length) {
                continue;
            }
            data.characters = nextChars;
            await vscode.workspace.fs.writeFile(r.uri, formatJson(data));
        } catch {
            /* skip */
        }
    }
}

type RoomCharacterJson = { definition?: string; instanceId?: string; [key: string]: unknown };

async function readRoomJsonRecord(uri: vscode.Uri): Promise<Record<string, unknown> | undefined> {
    let text: string;
    try {
        text = await readRoomJsonText(uri);
    } catch {
        return undefined;
    }
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

async function writeRoomJson(uri: vscode.Uri, data: Record<string, unknown>): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, formatJson(data));
}

function asObjectArray(key: string, data: Record<string, unknown>): Record<string, unknown>[] {
    const raw = data[key];
    return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function filterById(arr: Record<string, unknown>[], id: string, idKey: string): Record<string, unknown>[] {
    return arr.filter((row) => (row[idKey] as string | undefined) !== id);
}

/**
 * Performs the delete after confirmation. Does not prompt.
 */
export async function deleteGameEntity(target: DeleteTarget): Promise<void> {
    const root = gameRootUri(target.folder);

    switch (target.type) {
        case 'room': {
            await removeRoomFromManifest(target.folder, target.roomId);
            await patchGameConfigAfterRoomDelete(target.folder, target.roomId);
            const roomDir = vscode.Uri.joinPath(root, 'src', 'game', 'rooms', target.roomId);
            const assetsDir = vscode.Uri.joinPath(root, 'src', 'game', 'assets', 'images', 'rooms', target.roomId);
            await deleteDirectoryIfPresent(roomDir);
            await deleteDirectoryIfPresent(assetsDir);
            break;
        }
        case 'character': {
            await removeCharacterSpawnsFromAllRooms(target.folder, target.characterId);
            await patchGameConfigAfterCharacterDelete(target.folder, target.characterId);
            const charDir = vscode.Uri.joinPath(root, 'src', 'game', 'characters', target.characterId);
            const assetsDir = vscode.Uri.joinPath(
                root,
                'src',
                'game',
                'assets',
                'images',
                'characters',
                target.characterId
            );
            await deleteDirectoryIfPresent(charDir);
            await deleteDirectoryIfPresent(assetsDir);
            break;
        }
        case 'gui': {
            const guiDir = vscode.Uri.joinPath(root, 'src', 'game', 'guis', target.guiId);
            const assetsDir = vscode.Uri.joinPath(root, 'src', 'game', 'assets', 'images', 'guis', target.guiId);
            await deleteDirectoryIfPresent(guiDir);
            await deleteDirectoryIfPresent(assetsDir);
            break;
        }
        case 'prop': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            const props = asObjectArray('props', data);
            data.props = filterById(props, target.prop.id, 'id');
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        case 'hotspot': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            const hotspots = asObjectArray('hotspots', data);
            data.hotspots = filterById(hotspots, target.hotspotId, 'id');
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        case 'point': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            const points = asObjectArray('points', data);
            data.points = filterById(points, target.pointId, 'id');
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        case 'region': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            const regions = asObjectArray('regions', data);
            data.regions = filterById(regions, target.regionId, 'id');
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        case 'spawnedCharacter': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            const chars = asObjectArray('characters', data);
            data.characters = chars.filter(
                (row) => (row.instanceId as string | undefined) !== target.instanceId
            );
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        default:
            break;
    }
}

/**
 * Clears editor selection when it pointed at deleted content (main + room panel).
 */
export function applySelectionAfterDelete(selection: EditorSelection, target: DeleteTarget): void {
    switch (target.type) {
        case 'room':
            if (selection.focus.kind === 'room' && selection.focus.uri.toString() === target.roomJsonUri.toString()) {
                selection.clearFocus();
            }
            break;
        case 'character':
            if (
                selection.focus.kind === 'character' &&
                selection.focus.uri.toString() === target.characterJsonUri.toString()
            ) {
                selection.clearFocus();
            }
            break;
        case 'gui':
            if (selection.focus.kind === 'gui' && selection.focus.uri.toString() === target.guiJsonUri.toString()) {
                selection.clearFocus();
            }
            break;
        case 'prop':
            if (
                selection.roomPanel.kind === 'prop' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.prop.id === target.prop.id
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        case 'hotspot':
            if (
                selection.roomPanel.kind === 'hotspot' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.hotspotId === target.hotspotId
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        case 'point':
            if (
                selection.roomPanel.kind === 'roomPoint' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.pointId === target.pointId
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        case 'region':
            if (
                selection.roomPanel.kind === 'region' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.regionId === target.regionId
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        case 'spawnedCharacter':
            if (
                selection.roomPanel.kind === 'roomCharacter' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.instanceId === target.instanceId
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        default:
            break;
    }

    if (target.type === 'character') {
        if (
            selection.focus.kind === 'room' &&
            selection.roomPanel.kind === 'roomCharacter' &&
            selection.roomPanel.characterId === target.characterId
        ) {
            selection.clearRoomPanelFocus();
        }
    }
}
