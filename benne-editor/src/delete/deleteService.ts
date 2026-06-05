import * as path from 'node:path';
import * as vscode from 'vscode';
import { stripLineAndBlockComments } from '../verbHandlerPresence';
import { formatJson } from '../roomScaffolding';
import { listRoomDefinitions } from '../gameDiscovery';
import { readRoomJsonText } from '../inspectorStateBuilder';
import { deleteWalkableHole, deleteWalkablePolygon } from '../inspectorMutations';
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
    const invTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/**/*.inventory.ts'));
    const dialogTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/**/*.dialog.ts'));
    const globalTs = await vscode.workspace.findFiles(new vscode.RelativePattern(base, 'src/game/globalScript.ts'));
    const seen = new Set<string>();
    const out: vscode.Uri[] = [];
    for (const u of [...roomTs, ...charTs, ...invTs, ...dialogTs, ...globalTs]) {
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
        case 'inventory': {
            const i = escapeRe(target.itemId);
            return [
                new RegExp(`registerInventoryScript\\s*\\(\\s*['\`]${i}['\`]`),
                new RegExp(`verb:room:[^'"\`]+:inventory:${i}:`),
                new RegExp(`verb:inventory:${i}:`)
            ];
        }
        case 'dialog': {
            const d = escapeRe(target.dialogId);
            return [
                new RegExp(`registerDialogScript\\s*\\(\\s*['\`]${d}['\`]`),
                new RegExp(`B\\.dialog\\s*\\(\\s*['\`]${d}['\`]`)
            ];
        }
        case 'pdc':
            return [];
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
        case 'guiControl': {
            if (!target.controlId) {
                return [];
            }
            const g = escapeRe(target.guiId);
            const c = escapeRe(target.controlId);
            return [
                new RegExp(`B\\.whenButtonClick\\(\\s*['\`]${c}['\`]`),
                new RegExp(`whenButtonClick\\(\\s*['\`]${c}['\`]`),
                new RegExp(`B\\.whenCheckboxCheck\\(\\s*['\`]${c}['\`]`),
                new RegExp(`whenCheckboxCheck\\(\\s*['\`]${c}['\`]`),
                new RegExp(`B\\.whenCheckboxUncheck\\(\\s*['\`]${c}['\`]`),
                new RegExp(`whenCheckboxUncheck\\(\\s*['\`]${c}['\`]`)
            ];
        }
        case 'walkablePolygon':
        case 'walkableHole':
            return [];
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
        if (target.type === 'inventory') {
            if (text.includes(`"${target.itemId}"`) || text.includes(`'${target.itemId}'`)) {
                lines.push(
                    `• game-config.json may list "${target.itemId}" under initialGameState.inventory (will be stripped on delete).`
                );
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
        case 'inventory':
            return [
                target.inventoryJsonUri,
                vscode.Uri.joinPath(target.inventoryJsonUri, '..', `${target.itemId}.inventory.ts`)
            ];
        case 'dialog':
            return [
                target.dialogJsonUri,
                vscode.Uri.joinPath(target.dialogJsonUri, '..', `${target.dialogId}.dialog.ts`)
            ];
        case 'pdc':
            return [target.pdcJsonUri];
        case 'prop':
        case 'hotspot':
        case 'point':
        case 'region':
        case 'spawnedCharacter':
        case 'walkablePolygon':
        case 'walkableHole':
            return [target.roomJsonUri];
        case 'guiControl':
            return [target.guiJsonUri];
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
        case 'inventory':
            return 'inventory item';
        case 'dialog':
            return 'dialog';
        case 'pdc':
            return 'puzzle chart';
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
        case 'guiControl':
            return 'GUI control';
        case 'walkablePolygon':
            return 'walkable area';
        case 'walkableHole':
            return 'hole';
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
        case 'inventory':
            detailLines.push(`• Inventory folder src/game/inventory/${target.itemId}/`);
            detailLines.push(
                `• Per-item asset folder src/game/assets/images/inventory/${target.itemId}/ (if present; ignored when using the shared sheet)`
            );
            detailLines.push(...(await gameConfigDependencyLines(target.folder, target)));
            break;
        case 'dialog':
            detailLines.push(`• Dialog folder src/game/dialogs/${target.dialogId}/ (JSON + script)`);
            detailLines.push(
                '• Script scan lists references in *.room.ts, *.character.ts, *.dialog.ts, *.inventory.ts, and globalScript.ts — search other files by hand if unsure.'
            );
            break;
        case 'pdc':
            detailLines.push(`• Puzzle chart folder src/game/pdcs/${target.pdcId}/ (JSON only — editor tooling)`);
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
        case 'guiControl':
            detailLines.push(
                `• Control “${target.displayLabel}” from GUI “${target.guiName}” (${target.guiId}) in GUI JSON only — the GUI definition is not removed.`
            );
            if (target.controlId) {
                detailLines.push(
                    `• Script scan below covers *.gui.ts for B.whenButtonClick / whenCheckboxCheck / whenCheckboxUncheck('${target.controlId}') — review any matches before confirming.`
                );
            } else {
                detailLines.push(
                    '• Control has no id — no script scan performed (scripts can only reference controls by id).'
                );
            }
            break;
        case 'walkablePolygon':
            detailLines.push(
                `• Walkable area “${target.polygonId}” (and any holes under it) from room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            break;
        case 'walkableHole':
            detailLines.push(
                `• Hole “${target.holeId}” from walkable area “${target.polygonId}” in room “${target.roomName}” (${target.roomId}) in room JSON`
            );
            break;
        default:
            break;
    }

    const referenceHits = await scanScriptReferences(target);
    detailLines.push('');
    detailLines.push(
        referenceHits.length > 0
            ? `Possible script references (heuristic, *.room.ts / *.character.ts / *.inventory.ts / globalScript.ts): ${referenceHits.length} line(s).`
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
    const tabsToClose: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input;
            if (input instanceof vscode.TabInputText && want.has(input.uri.toString())) {
                tabsToClose.push(tab);
            } else if (input instanceof vscode.TabInputTextDiff) {
                if (want.has(input.original.toString()) || want.has(input.modified.toString())) {
                    tabsToClose.push(tab);
                }
            }
        }
    }
    for (const tab of tabsToClose) {
        try {
            await vscode.window.tabGroups.close(tab);
        } catch (err) {
            // VS Code may invalidate tab handles while other tabs are closing.
            // Ignore this specific race so entity deletion can continue.
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('Invalid tab') && !msg.includes('not found')) {
                throw err;
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

async function patchGameConfigAfterInventoryDelete(folder: vscode.WorkspaceFolder, itemId: string): Promise<void> {
    const uri = gameConfigUri(folder);
    const text = await readUtf8(uri);
    if (!text) {
        return;
    }
    try {
        const cfg = JSON.parse(text) as Record<string, unknown>;
        const init = cfg.initialGameState;
        if (!init || typeof init !== 'object' || Array.isArray(init)) {
            return;
        }
        const initObj = init as Record<string, unknown>;
        const inv = initObj.inventory;
        let changed = false;
        if (Array.isArray(inv)) {
            const next = inv.filter((x) => x !== itemId);
            if (next.length !== inv.length) {
                initObj.inventory = next;
                changed = true;
            }
        } else if (inv && typeof inv === 'object' && !Array.isArray(inv)) {
            const rec = { ...(inv as Record<string, unknown>) };
            if (Object.prototype.hasOwnProperty.call(rec, itemId)) {
                delete rec[itemId];
                initObj.inventory = rec;
                changed = true;
            }
        }
        if (changed) {
            await vscode.workspace.fs.writeFile(uri, formatJson(cfg));
        }
    } catch {
        void vscode.window.showWarningMessage(
            'Could not adjust game-config.json initialGameState.inventory after inventory delete.'
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
        case 'inventory': {
            await patchGameConfigAfterInventoryDelete(target.folder, target.itemId);
            const invDir = vscode.Uri.joinPath(root, 'src', 'game', 'inventory', target.itemId);
            const assetsDir = vscode.Uri.joinPath(
                root,
                'src',
                'game',
                'assets',
                'images',
                'inventory',
                target.itemId
            );
            await deleteDirectoryIfPresent(invDir);
            await deleteDirectoryIfPresent(assetsDir);
            break;
        }
        case 'dialog': {
            const dialogDir = vscode.Uri.joinPath(root, 'src', 'game', 'dialogs', target.dialogId);
            await deleteDirectoryIfPresent(dialogDir);
            break;
        }
        case 'pdc': {
            const pdcDir = vscode.Uri.joinPath(root, 'src', 'game', 'pdcs', target.pdcId);
            await deleteDirectoryIfPresent(pdcDir);
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
        case 'guiControl': {
            const data = await readRoomJsonRecord(target.guiJsonUri);
            if (!data) {
                throw new Error('GUI JSON could not be read');
            }
            const controls = asObjectArray('controls', data);
            // Resolve by index first, then validate type/id so we don't drop the wrong
            // control if the list was edited between tree refresh and confirmation.
            const at = controls[target.controlIndex];
            const typeAtIndex = at && typeof at.type === 'string' ? (at.type as string) : undefined;
            const idAtIndex = at && typeof at.id === 'string' ? (at.id as string) : '';
            const matchesAtIndex =
                at !== undefined &&
                typeAtIndex === target.typeLabel &&
                idAtIndex === target.controlId;
            if (matchesAtIndex) {
                data.controls = controls.filter((_, i) => i !== target.controlIndex);
            } else if (target.controlId) {
                const fallbackIndex = controls.findIndex(
                    (row) =>
                        typeof row.type === 'string' &&
                        (row.type as string) === target.typeLabel &&
                        typeof row.id === 'string' &&
                        (row.id as string) === target.controlId
                );
                if (fallbackIndex < 0) {
                    throw new Error(
                        `Control "${target.displayLabel}" was not found in ${target.guiId}.gui.json (it may have been removed already).`
                    );
                }
                data.controls = controls.filter((_, i) => i !== fallbackIndex);
            } else {
                throw new Error(
                    `Control "${target.displayLabel}" could not be located in ${target.guiId}.gui.json — open raw JSON and remove by hand.`
                );
            }
            await writeRoomJson(target.guiJsonUri, data);
            break;
        }
        case 'walkablePolygon': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            deleteWalkablePolygon(data, target.polygonId);
            await writeRoomJson(target.roomJsonUri, data);
            break;
        }
        case 'walkableHole': {
            const data = await readRoomJsonRecord(target.roomJsonUri);
            if (!data) {
                throw new Error('Room JSON could not be read');
            }
            deleteWalkableHole(data, target.polygonId, target.holeId);
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
        case 'inventory':
            if (
                selection.focus.kind === 'inventory' &&
                selection.focus.uri.toString() === target.inventoryJsonUri.toString()
            ) {
                selection.clearFocus();
            }
            break;
        case 'dialog':
            if (
                selection.focus.kind === 'dialog' &&
                selection.focus.uri.toString() === target.dialogJsonUri.toString()
            ) {
                selection.clearFocus();
            }
            break;
        case 'pdc':
            if (
                selection.focus.kind === 'pdc' &&
                selection.focus.uri.toString() === target.pdcJsonUri.toString()
            ) {
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
        case 'guiControl':
            if (
                selection.guiPanel.kind === 'control' &&
                selection.guiPanel.guiJsonUri.toString() === target.guiJsonUri.toString() &&
                selection.guiPanel.controlKey === target.controlKey
            ) {
                // Reset to plain GUI focus so the Inspector stays on the right card list.
                selection.setGui(target.guiJsonUri, target.guiName);
            }
            break;
        case 'walkablePolygon':
            if (
                selection.roomPanel.kind === 'walkable' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.polygonId === target.polygonId
            ) {
                selection.clearRoomPanelFocus();
            }
            break;
        case 'walkableHole':
            if (
                selection.roomPanel.kind === 'walkable' &&
                selection.roomPanel.roomJsonUri.toString() === target.roomJsonUri.toString() &&
                selection.roomPanel.polygonId === target.polygonId &&
                selection.roomPanel.holeId === target.holeId
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
