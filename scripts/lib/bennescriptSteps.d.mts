/** Types for `bennescriptSteps.mjs` (which functions are step functions, design doc §5, §6). */
export declare const STEP_BLOCK_APIS: ReadonlySet<string>;
export declare const STEP_METHODS: ReadonlySet<string>;
export declare const NOT_STEP_ON_METHODS: ReadonlySet<string>;
export declare const SCRIPT_FILE: RegExp;
export declare function isBenneScriptFile(id: string): boolean;
