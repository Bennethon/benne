import * as fs from 'fs';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { IdsIndex } from './bennescript/idsIndex';
import {
    explainArrowSpeechErrors,
    inStringLiteral,
    isBenneScriptFile,
    otherRoomCompletionEntries,
    otherRoomEntryDetails,
    promoteStringLiteralEntries,
    redirectDefinitionsToContent,
    speakerCompletionEntries,
    speakerDiagnostics
} from './bennescript/tsPluginFeatures';
import {
    buildSpeakerTable,
    characterSpeakersSignature,
    gameRootOfFile,
    readCharacterSpeakers,
    type SpeakerTable
} from './bennescript/speakers';

/*
 * TypeScript server plugin for BENNE games (docs/bennescript-ergonomics-refactor.md §9).
 *
 * BenneScript: speaker completions and diagnostics, string-union completions that insert their
 * quotes, other rooms' handles whose names are taken (`outside.door`), and go to definition from
 * generated handles to their JSON (`./bennescript/tsPluginFeatures`).
 */

export function init(modules: { typescript: typeof ts }): { create(info: ts.server.PluginCreateInfo): ts.LanguageService } {
    const typescript = modules.typescript;

    function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
        const proxy: ts.LanguageService = Object.create(null);
        for (const key of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
            const method = info.languageService[key];
            if (typeof method === 'function') {
                (proxy[key] as (...args: unknown[]) => unknown) = (...args: unknown[]) =>
                    (method as (...inner: unknown[]) => unknown).apply(info.languageService, args);
            }
        }

        const log = (message: string): void => {
            info.project?.projectService?.logger?.info(message);
        };
        const speakerTables = new Map<string, { signature: string; table: SpeakerTable }>();
        const speakerTable = (gameRoot: string): SpeakerTable => {
            const signature = characterSpeakersSignature(gameRoot);
            const cached = speakerTables.get(gameRoot);
            if (cached && cached.signature === signature) {
                return cached.table;
            }
            const table = buildSpeakerTable(readCharacterSpeakers(gameRoot));
            speakerTables.set(gameRoot, { signature, table });
            return table;
        };
        const indexes = new Map<string, IdsIndex>();
        const idsIndex = (gameRoot: string): IdsIndex => {
            let index = indexes.get(gameRoot);
            if (!index) {
                index = new IdsIndex(typescript, gameRoot, (file) => {
                    const open = info.languageService.getProgram()?.getSourceFile(file);
                    if (open) {
                        return open.text;
                    }
                    try {
                        return fs.readFileSync(file, 'utf8');
                    } catch {
                        return undefined;
                    }
                });
                indexes.set(gameRoot, index);
            }
            return index;
        };
        const scriptSource = (fileName: string): ts.SourceFile | undefined => {
            if (!isBenneScriptFile(fileName) || !gameRootOfFile(fileName)) {
                return undefined;
            }
            return info.languageService.getProgram()?.getSourceFile(fileName);
        };

        proxy.getSyntacticDiagnostics = (fileName) => {
            const prior = info.languageService.getSyntacticDiagnostics(fileName);
            const sf = scriptSource(fileName);
            return sf && prior.length ? explainArrowSpeechErrors(sf, prior) : prior;
        };

        proxy.getSemanticDiagnostics = (fileName) => {
            const prior = info.languageService.getSemanticDiagnostics(fileName);
            const sf = scriptSource(fileName);
            const gameRoot = gameRootOfFile(fileName);
            if (!sf || !gameRoot || !isBenneScriptFile(fileName)) {
                return prior;
            }
            try {
                return [...prior, ...speakerDiagnostics(typescript, sf, speakerTable(gameRoot))];
            } catch (err) {
                log(`[benne] speaker diagnostics failed: ${String(err)}`);
                return prior;
            }
        };

        const definitionsFor = (definitions: readonly ts.DefinitionInfo[] | undefined): ts.DefinitionInfo[] | undefined => {
            if (!definitions || definitions.length === 0) {
                return undefined;
            }
            try {
                return redirectDefinitionsToContent(
                    typescript,
                    info.languageService.getProgram(),
                    definitions,
                    idsIndex,
                    gameRootOfFile
                );
            } catch (err) {
                log(`[benne] definition redirect failed: ${String(err)}`);
                return undefined;
            }
        };

        proxy.getDefinitionAndBoundSpan = (fileName, position) => {
            const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position);
            const redirected = definitionsFor(prior?.definitions);
            return prior && redirected ? { ...prior, definitions: redirected } : prior;
        };

        proxy.getDefinitionAtPosition = (fileName, position) => {
            const prior = info.languageService.getDefinitionAtPosition(fileName, position);
            return definitionsFor(prior) ?? prior;
        };

        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            const result = info.languageService.getCompletionsAtPosition(fileName, position, options);
            const sf = scriptSource(fileName);
            const gameRoot = gameRootOfFile(fileName);
            if (!sf || !gameRoot || !isBenneScriptFile(fileName)) {
                return result;
            }
            try {
                if (inStringLiteral(typescript, sf, position)) {
                    return result;
                }
                const invoked = options?.triggerKind === 1 /* CompletionTriggerKind.Invoked */;
                const speakers = speakerCompletionEntries(typescript, sf, position, speakerTable(gameRoot), invoked);
                const otherRooms = result ? otherRoomCompletionEntries(typescript, sf, position, result, idsIndex(gameRoot)) : [];
                const base = result ? promoteStringLiteralEntries(typescript, result) : undefined;
                if (speakers.length === 0 && otherRooms.length === 0) {
                    return base;
                }
                return base
                    ? { ...base, entries: [...speakers, ...base.entries, ...otherRooms] }
                    : { isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: true, entries: speakers };
            } catch (err) {
                log(`[benne] completions failed: ${String(err)}`);
                return result;
            }
        };

        proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
            const sf = scriptSource(fileName);
            const gameRoot = gameRootOfFile(fileName);
            if (sf && gameRoot) {
                try {
                    const ours = otherRoomEntryDetails(typescript, info.languageService, sf, entryName, source, idsIndex(gameRoot));
                    if (ours) {
                        return ours;
                    }
                } catch (err) {
                    log(`[benne] completion details failed: ${String(err)}`);
                }
            }
            return info.languageService.getCompletionEntryDetails(fileName, position, entryName, formatOptions, source, preferences, data);
        };

        return proxy;
    }

    return { create };
}
