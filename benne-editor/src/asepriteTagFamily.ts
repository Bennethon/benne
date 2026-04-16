/**
 * Soft `<root>-*` convention: a sheet tag belongs to a prop or inventory entry when it equals a root
 * or starts with `root-` (literal hyphen). Used by the inspector and import wizards only.
 */
export function tagBelongsToRootSet(tag: string, roots: ReadonlySet<string>): boolean {
    for (const root of roots) {
        if (root.length === 0) {
            continue;
        }
        if (tag === root || tag.startsWith(`${root}-`)) {
            return true;
        }
    }
    return false;
}

/** Tags on a sheet that belong to one logical `<base>-*` family (includes `base` itself). */
export function tagsInHyphenFamily(base: string, allTags: readonly string[]): string[] {
    return allTags
        .filter((t) => t === base || t.startsWith(`${base}-`))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Tags that can serve as import / grouping roots: not an extension `shorterTag-*` of another tag on the sheet.
 */
export function computeAsepriteTagCandidateBases(tags: readonly string[]): string[] {
    const tagList = [...tags];
    const bases: string[] = [];
    for (const T of tagList) {
        const isExtension = tagList.some((U) => U !== T && T.startsWith(`${U}-`));
        if (!isExtension) {
            bases.push(T);
        }
    }
    return bases.sort((a, b) => a.localeCompare(b));
}
