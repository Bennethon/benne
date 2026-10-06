import * as ts from 'typescript';
import { parseScriptModel, playFromNames } from './bennescript/scriptModel';

/**
 * Play From names registered by a `*.room.ts` (`playFrom('name', () => { … })`, §4.19), in source
 * order without duplicates. Read from the TypeScript AST, so commented or quoted examples never
 * become launch targets, and names built with `${…}` are skipped (they aren't static).
 */
export function readRoomPlayFromNamesFromSource(source: string, fileName = 'room.room.ts'): string[] {
    return playFromNames(parseScriptModel(ts, fileName, source));
}
