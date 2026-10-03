/**
 * Parse `*.room.ts` source for `B.playFrom` name registrations (editor tooling).
 * Accepts `'Name'`, `"Name"`, and `` `Name` ``.
 * Template literals that contain `${…}` are skipped — the name is not static.
 */
export function readRoomPlayFromNamesFromSource(source: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const needle = /\bB\.playFrom\s*\(/g;
    // Mask comments and string contents while preserving offsets into the original source.
    // A commented example or a quoted code sample must never become a launch target.
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g,
        (text) => ' '.repeat(text.length));
    let m: RegExpExecArray | null;
    while ((m = needle.exec(code)) !== null) {
        let argumentStart = m.index + m[0].length;
        while (/\s/.test(source[argumentStart] ?? '') && argumentStart < source.length) { argumentStart++; }
        const q = source[argumentStart];
        if (q !== "'" && q !== '"' && q !== '`') {
            continue;
        }
        let i = argumentStart + 1;
        let buf = '';
        let closed = false;
        let interpolated = false;
        while (i < source.length) {
            const c = source[i];
            if (c === '\\' && i + 1 < source.length) {
                buf += source[i + 1];
                i += 2;
                continue;
            }
            if (q === '`' && c === '$' && source[i + 1] === '{') {
                interpolated = true;
                break;
            }
            if (c === q) {
                closed = true;
                break;
            }
            buf += c;
            i++;
        }
        if (!closed || interpolated) {
            continue;
        }
        const id = buf.trim();
        if (id.length > 0 && !seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
