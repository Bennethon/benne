import * as path from 'node:path';
import * as vscode from 'vscode';

export async function findBenneGameFolders(): Promise<vscode.WorkspaceFolder[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const out: vscode.WorkspaceFolder[] = [];
    for (const folder of folders) {
        if (await hasBenneGameLayout(folder.uri)) {
            out.push(folder);
        }
    }
    return out;
}

async function hasBenneGameLayout(root: vscode.Uri): Promise<boolean> {
    const rooms = vscode.Uri.joinPath(root, 'src', 'game', 'rooms');
    try {
        const stat = await vscode.workspace.fs.stat(rooms);
        return stat.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}

export async function listRoomDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const roomsDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'rooms');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(roomsDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(roomsDir, name, `${name}.room.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readRoomMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

async function readRoomMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string; id?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

export async function listCharacterDefinitions(
    gameFolder: vscode.WorkspaceFolder
): Promise<{ id: string; name: string; uri: vscode.Uri }[]> {
    const charsDir = vscode.Uri.joinPath(gameFolder.uri, 'src', 'game', 'characters');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(charsDir);
    } catch {
        return [];
    }
    const result: { id: string; name: string; uri: vscode.Uri }[] = [];
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.Directory) {
            continue;
        }
        const uri = vscode.Uri.joinPath(charsDir, name, `${name}.character.json`);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            continue;
        }
        const meta = await readCharacterMeta(uri, name);
        result.push({ id: name, name: meta.name, uri });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
}

export async function readCharacterHooks(
    uri: vscode.Uri
): Promise<{ onLook?: string; onUse?: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { onLook?: string; onUse?: string };
        return {
            onLook: typeof data.onLook === 'string' ? data.onLook : undefined,
            onUse: typeof data.onUse === 'string' ? data.onUse : undefined
        };
    } catch {
        return {};
    }
}

async function readCharacterMeta(uri: vscode.Uri, fallbackId: string): Promise<{ name: string }> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(raw);
        const data = JSON.parse(text) as { name?: string };
        const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallbackId;
        return { name };
    } catch {
        return { name: fallbackId };
    }
}

export interface RoomPropEntry {
    id: string;
    tag?: string;
    zIndex?: number;
    visible?: boolean;
    clickable?: boolean;
    onLook?: string;
    onUse?: string;
}

/** Folder name for `rooms/<id>/<id>.room.json` (e.g. `office`). */
export function getRoomIdFromRoomJsonUri(roomJsonUri: vscode.Uri): string {
    return path.basename(path.dirname(roomJsonUri.fsPath));
}

export async function readRoomProps(uri: vscode.Uri): Promise<RoomPropEntry[]> {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(raw);
    const data = JSON.parse(text) as { props?: unknown };
    if (!Array.isArray(data.props)) {
        return [];
    }
    const props: RoomPropEntry[] = [];
    for (const p of data.props) {
        if (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string') {
            const o = p as Record<string, unknown>;
            props.push({
                id: o.id as string,
                tag: typeof o.tag === 'string' ? o.tag : undefined,
                zIndex: typeof o.zIndex === 'number' ? o.zIndex : undefined,
                visible: typeof o.visible === 'boolean' ? o.visible : undefined,
                clickable: typeof o.clickable === 'boolean' ? o.clickable : undefined,
                onLook: typeof o.onLook === 'string' ? o.onLook : undefined,
                onUse: typeof o.onUse === 'string' ? o.onUse : undefined
            });
        }
    }
    props.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    return props;
}
