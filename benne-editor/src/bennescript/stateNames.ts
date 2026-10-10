/**
 * Names for flags and vars in `state.ts`. No imports, so the State webview bundle can check names
 * as the author types.
 */

export type StateSectionKind = 'flags' | 'vars';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const RESERVED = new Set(
    (
        'break case catch class const continue debugger default delete do else enum export extends false ' +
        'finally for function if import in instanceof new null return super switch this throw true try ' +
        'typeof var void while with implements interface let package private protected public static yield ' +
        'await __proto__'
    ).split(' '),
);

/** Whether `key` can be written without quotes in an object literal. */
export function isIdentifierName(key: string): boolean {
    return IDENTIFIER.test(key);
}

/**
 * Why `name` can't be a new flag or var, or undefined when it can. `names` are the section's
 * current names; `except` is the entry being renamed.
 */
export function validateStateName(
    name: string,
    kind: StateSectionKind,
    names: readonly string[],
    except?: string,
): string | undefined {
    if (name.length === 0) {
        return 'Enter a name.';
    }
    if (!IDENTIFIER.test(name)) {
        return 'Use letters, digits, _ and $, not starting with a digit (e.g. gotKey).';
    }
    if (RESERVED.has(name)) {
        return `"${name}" is a reserved word.`;
    }
    if (name !== except && names.includes(name)) {
        return `There is already a ${kind === 'flags' ? 'flag' : 'var'} called "${name}".`;
    }
    return undefined;
}
