/**
 * Where a piece of content is defined: the JSON file (and the `"id"` inside it) or the asset file
 * behind a generated handle. Go to definition on `battery` lands on the hotspot in
 * `club.room.json` (docs/bennescript-ergonomics-refactor.md §9).
 *
 * Pure apart from `fs`; no `vscode` import (the TS server plugin uses it).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as TS from 'typescript';
import type { ContentRef } from './idsIndex';

export interface ContentLocation {
    fileName: string;
    /** UTF-16 range of the `"id"` value (or the file start for assets). */
    start: number;
    length: number;
}

function readText(file: string): string | undefined {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

/** `<kind>/<id>/<id>.<kind>.json`, else the first `<kind>/*\/*.<kind>.json` whose `"id"` is `id`. */
function definitionFile(gameRoot: string, folder: string, suffix: string, id: string): string | undefined {
    const direct = path.join(gameRoot, folder, id, `${id}${suffix}`);
    if (fs.existsSync(direct)) {
        return direct;
    }
    let dirs: fs.Dirent[];
    try {
        dirs = fs.readdirSync(path.join(gameRoot, folder), { withFileTypes: true });
    } catch {
        return undefined;
    }
    for (const dir of dirs) {
        if (!dir.isDirectory()) {
            continue;
        }
        let files: string[];
        try {
            files = fs.readdirSync(path.join(gameRoot, folder, dir.name));
        } catch {
            continue;
        }
        for (const file of files.filter((f) => f.endsWith(suffix))) {
            const full = path.join(gameRoot, folder, dir.name, file);
            try {
                if ((JSON.parse(readText(full) ?? '') as { id?: unknown }).id === id) {
                    return full;
                }
            } catch {
                // broken JSON
            }
        }
    }
    return undefined;
}

function roomFile(gameRoot: string, roomId: string): string | undefined {
    try {
        const manifest = JSON.parse(readText(path.join(gameRoot, 'rooms', 'rooms.manifest.json')) ?? '') as {
            rooms?: Array<{ id?: unknown; definition?: unknown }>;
        };
        const entry = manifest.rooms?.find((r) => r.id === roomId);
        if (entry && typeof entry.definition === 'string') {
            const file = path.join(gameRoot, 'rooms', entry.definition);
            if (fs.existsSync(file)) {
                return file;
            }
        }
    } catch {
        // fall back to the folder convention
    }
    return definitionFile(gameRoot, 'rooms', '.room.json', roomId);
}

function propertyName(ts: typeof TS, p: TS.ObjectLiteralElementLike): string | undefined {
    return ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) ? p.name.text : undefined;
}

/**
 * The `"id": "<id>"` value inside `text`: only under the top-level property `under` (an array or
 * object, searched at any depth) when given, else anywhere; the top-level object's own `"id"` when
 * `id` is undefined.
 */
function findIdInJson(
    ts: typeof TS,
    fileName: string,
    text: string,
    id: string | undefined,
    under?: readonly string[],
): { start: number; length: number } | undefined {
    const json = ts.parseJsonText(fileName, text);
    const root = json.statements[0]?.expression;
    if (!root || !ts.isObjectLiteralExpression(root)) {
        return undefined;
    }
    const idValue = (obj: TS.ObjectLiteralExpression): TS.StringLiteral | undefined => {
        for (const p of obj.properties) {
            if (propertyName(ts, p) === 'id' && ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) {
                return p.initializer;
            }
        }
        return undefined;
    };
    const span = (lit: TS.StringLiteral) => ({ start: lit.getStart(json), length: lit.getEnd() - lit.getStart(json) });
    if (id === undefined) {
        const own = idValue(root);
        return own ? span(own) : { start: 0, length: 0 };
    }
    let found: TS.StringLiteral | undefined;
    const search = (node: TS.Node): void => {
        if (found) {
            return;
        }
        if (ts.isObjectLiteralExpression(node)) {
            const v = idValue(node);
            if (v && v.text === id) {
                found = v;
                return;
            }
        }
        ts.forEachChild(node, search);
    };
    if (under) {
        for (const p of root.properties) {
            const name = propertyName(ts, p);
            if (name && under.includes(name) && ts.isPropertyAssignment(p)) {
                search(p.initializer);
            }
        }
    } else {
        for (const p of root.properties) {
            if (ts.isPropertyAssignment(p)) {
                search(p.initializer);
            }
        }
    }
    return found ? span(found) : undefined;
}

function inJson(
    ts: typeof TS,
    fileName: string | undefined,
    id: string | undefined,
    under?: readonly string[],
): ContentLocation | undefined {
    if (!fileName) {
        return undefined;
    }
    const text = readText(fileName);
    if (text === undefined) {
        return undefined;
    }
    const hit = findIdInJson(ts, fileName, text, id, under) ?? { start: 0, length: 0 };
    return { fileName, ...hit };
}

/** First file under `dir` (recursive) whose name without extension is `stem`. */
function assetFile(dir: string, stem: string): string | undefined {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return undefined;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            const hit = assetFile(full, stem);
            if (hit) {
                return hit;
            }
        } else if (path.parse(e.name).name === stem) {
            return full;
        }
    }
    return undefined;
}

export function locateContent(ts: typeof TS, gameRoot: string, ref: ContentRef): ContentLocation | undefined {
    switch (ref.kind) {
        case 'room':
            return inJson(ts, roomFile(gameRoot, ref.id), undefined);
        case 'prop':
            return inJson(ts, roomFile(gameRoot, ref.roomId), ref.id, ['props']);
        case 'hotspot':
            return inJson(ts, roomFile(gameRoot, ref.roomId), ref.id, ['hotspots']);
        case 'point':
            return inJson(ts, roomFile(gameRoot, ref.roomId), ref.id, ['points']);
        case 'region':
            return inJson(ts, roomFile(gameRoot, ref.roomId), ref.id, ['regions']);
        case 'walkable':
            return inJson(ts, roomFile(gameRoot, ref.roomId), ref.id, ['walkable', 'walkables', 'walkableAreas']);
        case 'character':
            return inJson(ts, definitionFile(gameRoot, 'characters', '.character.json', ref.id), undefined);
        case 'item':
            return inJson(ts, definitionFile(gameRoot, 'inventory', '.inventory.json', ref.id), undefined);
        case 'dialog':
            return inJson(ts, definitionFile(gameRoot, 'dialogs', '.dialog.json', ref.id), undefined);
        case 'dialogOption':
            return inJson(ts, definitionFile(gameRoot, 'dialogs', '.dialog.json', ref.dialogId), ref.id, ['options']);
        case 'gui':
            return inJson(ts, definitionFile(gameRoot, 'guis', '.gui.json', ref.id), undefined);
        case 'guiControl':
            return inJson(ts, definitionFile(gameRoot, 'guis', '.gui.json', ref.guiId), ref.id);
        case 'verb':
            return inJson(ts, path.join(gameRoot, 'game-config.json'), ref.id, ['verbs']);
        case 'sfx':
        case 'music': {
            const file = assetFile(path.join(gameRoot, 'assets', 'audio', ref.kind), ref.id);
            return file ? { fileName: file, start: 0, length: 0 } : undefined;
        }
        case 'video': {
            const file = assetFile(path.join(gameRoot, 'assets', 'videos'), ref.id);
            return file ? { fileName: file, start: 0, length: 0 } : undefined;
        }
        case 'fallbacks':
            return undefined;
    }
}
