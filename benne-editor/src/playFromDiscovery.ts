/**
 * Parse `*.room.ts` source for `B.playFrom('Name', …)` / `B.playFrom("Name", …)` registrations (editor tooling).
 */
export function readRoomPlayFromNamesFromSource(source: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const needle = /\bB\.playFrom\s*\(\s*/g;
    let m: RegExpExecArray | null;
    while ((m = needle.exec(source)) !== null) {
        const q = source[m.index + m[0].length];
        if (q !== "'" && q !== '"') {
            continue;
        }
        let i = m.index + m[0].length + 1;
        let buf = '';
        while (i < source.length) {
            const c = source[i];
            if (c === '\\' && i + 1 < source.length) {
                buf += source[i + 1];
                i += 2;
                continue;
            }
            if (c === q) {
                break;
            }
            buf += c;
            i++;
        }
        const id = buf.trim();
        if (id.length > 0 && !seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
