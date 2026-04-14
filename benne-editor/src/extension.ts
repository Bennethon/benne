import * as vscode from 'vscode';
import { ActionsTreeProvider } from './actionsTreeProvider';
import { EditorSelection } from './editorSelection';
import { MainTreeProvider, type MainTreeNode } from './mainTreeProvider';
import { runCreateCharacterWizard, runImportAnimationsFromAsepriteTags } from './characterScaffolding';
import { runCreateGuiWizard } from './guiScaffolding';
import {
    runAddRoomHotspotWizard,
    runAddRoomPointWizard,
    runAddRoomPropWizard,
    runAddRoomRegionWizard,
    runAddRoomSpawnedCharacterWizard,
    runCreateRoomWizard,
    runImportPropsFromAsepriteTags
} from './roomScaffolding';
import { CharacterPreviewPanelController } from './characterPreviewPanel';
import { GuiPreviewPanelController } from './guiPreviewPanel';
import { RoomPreviewPanelController } from './roomPreviewPanel';
import {
    getRoomPreviewBuildOutputChannel,
    resolveGameFolderForRoomPreviewBuild,
    roomPreviewBuildHintUri,
    runCharacterPreviewBuild,
    runGuiPreviewBuild,
    runRoomPreviewBuild
} from './roomPreviewBuild';
import { addCharacterVerbEvent, makeCharacterClickable } from './characterVerbScaffolding';
import { readRoomProps } from './gameDiscovery';
import { addRoomCharacterVerbEvent } from './roomCharacterVerbScaffolding';
import {
    addHotspotVerbEvent,
    addPropVerbEvent,
    makeRoomPropClickable
} from './propVerbScaffolding';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import {
    BENNE_SCRIPT_VIEW_COLUMN,
    openCharacterJsonAndScriptBottomGroup,
    openGuiJsonAndScriptBottomGroup,
    openDocumentPinned,
    openDocumentUri,
    openRoomJsonAndScriptBottomGroup,
    revealEventInDocument,
    revealSourceRangeInDocument
} from './roomScriptNavigation';
import { InspectorWebviewViewProvider } from './inspectorWebviewViewProvider';
import { resolveDeleteTargetFromMainTreeNode } from './delete/deleteTarget';
import {
    applySelectionAfterDelete,
    buildDeleteImpactSummary,
    closeOpenEditorsForTarget,
    deleteGameEntity,
    promptDeleteConfirmation,
    showReferenceHitsPicker
} from './delete/deleteService';

function firstTreeContextArg(arg: MainTreeNode | MainTreeNode[] | undefined): MainTreeNode | undefined {
    if (arg === undefined) {
        return undefined;
    }
    return Array.isArray(arg) ? arg[0] : arg;
}

export function activate(context: vscode.ExtensionContext): void {
    const selection = new EditorSelection();
    const mainProvider = new MainTreeProvider();
    const actionsProvider = new ActionsTreeProvider(selection);

    const mainTreeView = vscode.window.createTreeView('benne-editor.main', {
        treeDataProvider: mainProvider,
        showCollapseAll: true
    });

    const syncMainTreeFilterUi = async (): Promise<void> => {
        const raw = mainProvider.getTreeFilter();
        await vscode.commands.executeCommand('setContext', 'benneEditor.mainTreeFilterActive', raw.length > 0);
        mainTreeView.description = raw.length > 0 ? `filter: ${raw}` : undefined;
        mainTreeView.message = undefined;
    };

    void syncMainTreeFilterUi();

    const actionsTreeView = vscode.window.createTreeView('benne-editor.actions', {
        treeDataProvider: actionsProvider,
        showCollapseAll: false
    });

    const roomPreview = new RoomPreviewPanelController(context.extensionUri, selection);
    const characterPreview = new CharacterPreviewPanelController(context.extensionUri, selection);
    const guiPreview = new GuiPreviewPanelController(context.extensionUri, selection);

    let gameConfigRebuildTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingGameConfigUri: vscode.Uri | undefined;

    const scheduleAutoRoomPreviewRebuild = (uri: vscode.Uri): void => {
        const cfg = vscode.workspace.getConfiguration('benneEditor');
        if (!cfg.get('roomPreview.autoRebuildOnGameConfigChange', true)) {
            return;
        }
        pendingGameConfigUri = uri;
        if (gameConfigRebuildTimer !== undefined) {
            clearTimeout(gameConfigRebuildTimer);
        }
        const msRaw = cfg.get<number>('roomPreview.autoRebuildDebounceMs', 1500);
        const ms = Math.min(60000, Math.max(300, msRaw));
        gameConfigRebuildTimer = setTimeout(() => {
            gameConfigRebuildTimer = undefined;
            const u = pendingGameConfigUri;
            pendingGameConfigUri = undefined;
            void (async () => {
                if (!u) {
                    return;
                }
                const folder = await resolveGameFolderForRoomPreviewBuild(u);
                if (!folder) {
                    return;
                }
                const ch = getRoomPreviewBuildOutputChannel();
                const ok = await runRoomPreviewBuild(folder, ch, {
                    title: 'Auto-rebuilding room preview (game-config.json)'
                });
                if (ok) {
                    roomPreview.reloadRoomPreviewBundle();
                }
            })();
        }, ms);
    };

    context.subscriptions.push(
        new vscode.Disposable(() => {
            if (gameConfigRebuildTimer !== undefined) {
                clearTimeout(gameConfigRebuildTimer);
            }
        })
    );

    context.subscriptions.push(
        roomPreview,
        characterPreview,
        guiPreview,
        mainTreeView,
        actionsTreeView,
        selection,
        mainTreeView.onDidChangeSelection((e) => {
            void onMainTreeSelection(e.selection[0] as MainTreeNode | undefined);
        })
    );

    async function resetBenneEditorSurface(): Promise<void> {
        roomPreview.resetPreviewPanel();
        characterPreview.resetPreviewPanel();
        guiPreview.resetPreviewPanel();
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    async function onMainTreeSelection(node: MainTreeNode | undefined): Promise<void> {
        if (!node) {
            return;
        }
        if (node.kind === 'room') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setRoom(node.uri, node.name);
            await openRoomJsonAndScript(node.uri, node.id);
        } else if (node.kind === 'roomSubGroup') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoom(node.roomJsonUri, node.roomName);

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'prop') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithProp(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.prop
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'hotspot') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithHotspot(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.hotspotId
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'roomPoint') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithRoomPoint(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.pointId
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'region') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithRegion(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.regionId
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'roomCharacter') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithRoomCharacter(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.instanceId,
                node.characterId
            );

            if (!sameRoomContext) {
                await openRoomJsonAndScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'character') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setCharacter(node.uri, node.name);
            await openCharacterJsonAndScript(node.uri, node.id);
        } else if (node.kind === 'gui') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setGui(node.uri, node.name);
            await openGuiJsonAndScript(node.uri, node.id);
        }
    }

    let inspectorProvider!: InspectorWebviewViewProvider;

    const refreshTrees = (): void => {
        mainProvider.refresh();
        actionsProvider.refresh();
        void syncMainTreeFilterUi();
        void inspectorProvider.pushState();
    };

    inspectorProvider = new InspectorWebviewViewProvider(
        context.extensionUri,
        selection,
        roomPreview,
        () => {
            mainProvider.refresh();
            actionsProvider.refresh();
            void syncMainTreeFilterUi();
        }
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('benne-editor.inspector', inspectorProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        }),
        inspectorProvider,
        vscode.commands.registerCommand('benne-editor.filterMainTree', async () => {
            const value = await vscode.window.showInputBox({
                title: 'Filter BENNE tree',
                prompt:
                    'Show only rooms, props, characters, and other entries whose name or id contains this text (case-insensitive). Leave empty and press Enter to clear the filter.',
                value: mainProvider.getTreeFilter()
            });
            if (value === undefined) {
                return;
            }
            mainProvider.setTreeFilter(value);
            await syncMainTreeFilterUi();
        }),
        vscode.commands.registerCommand('benne-editor.clearMainTreeFilter', async () => {
            mainProvider.clearTreeFilter();
            await syncMainTreeFilterUi();
        }),
        vscode.commands.registerCommand(
            'benne-editor.deleteGameEntity',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const fromArg = firstTreeContextArg(arg);
                const fromTree =
                    fromArg ??
                    (mainTreeView.selection.length > 0
                        ? (mainTreeView.selection[0] as MainTreeNode)
                        : undefined);
                const target = resolveDeleteTargetFromMainTreeNode(fromTree);
                if (!target) {
                    void vscode.window.showInformationMessage(
                        'Choose a room, character, GUI, prop, hotspot, point, region, or spawned character in the BENNE tree (or run this from its context menu), then try again.'
                    );
                    return;
                }
                let summary = await buildDeleteImpactSummary(target);
                for (;;) {
                    const choice = await promptDeleteConfirmation(summary);
                    if (choice === 'cancel') {
                        return;
                    }
                    if (choice === 'showReferences') {
                        await showReferenceHitsPicker(summary.referenceHits);
                        summary = await buildDeleteImpactSummary(target);
                        continue;
                    }
                    break;
                }
                try {
                    await closeOpenEditorsForTarget(target);
                    await deleteGameEntity(target);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Delete failed: ${msg}`);
                    return;
                }
                applySelectionAfterDelete(selection, target);
                if (target.type === 'room' || target.type === 'character' || target.type === 'gui') {
                    roomPreview.resetPreviewPanel();
                    characterPreview.resetPreviewPanel();
                    guiPreview.resetPreviewPanel();
                } else if ('roomJsonUri' in target) {
                    roomPreview.onWorkspaceRoomJsonChanged(target.roomJsonUri);
                }
                refreshTrees();
                void inspectorProvider.pushState();
                let kindLabel: string;
                switch (target.type) {
                    case 'room':
                        kindLabel = 'room';
                        break;
                    case 'character':
                        kindLabel = 'character';
                        break;
                    case 'gui':
                        kindLabel = 'GUI';
                        break;
                    case 'spawnedCharacter':
                        kindLabel = 'spawned character';
                        break;
                    default:
                        kindLabel = target.type;
                        break;
                }
                void vscode.window.showInformationMessage(`Deleted ${kindLabel} “${target.displayLabel}”.`);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createRoom',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'roomsGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreateRoomWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createCharacter',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'charsGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreateCharacterWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createGui',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'guisGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreateGuiWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomProp',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomPropWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomHotspot',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomHotspotWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomPoint',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomPointWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomRegion',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomRegionWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomSpawnedCharacter',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomSpawnedCharacterWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.importPropsFromAsepriteTags',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runImportPropsFromAsepriteTags(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.importAnimationsFromAsepriteTags',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runImportAnimationsFromAsepriteTags(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand('benne-editor.rebuildRoomPreview', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game/rooms and npm script build:room-preview).'
                );
                return;
            }
            const ok = await runRoomPreviewBuild(folder, ch);
            if (ok) {
                roomPreview.reloadRoomPreviewBundle();
                void vscode.window.showInformationMessage('Room preview bundle rebuilt.');
            }
        }),
        vscode.commands.registerCommand('benne-editor.rebuildCharacterPreview', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game and npm script build:character-preview).'
                );
                return;
            }
            const ok = await runCharacterPreviewBuild(folder, ch);
            if (ok) {
                characterPreview.reloadCharacterPreviewBundle();
                void vscode.window.showInformationMessage('Character preview bundle rebuilt.');
            }
        }),
        vscode.commands.registerCommand('benne-editor.rebuildGuiPreview', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game and npm script build:gui-preview).'
                );
                return;
            }
            const ok = await runGuiPreviewBuild(folder, ch);
            if (ok) {
                guiPreview.reloadGuiPreviewBundle();
                void vscode.window.showInformationMessage('GUI preview bundle rebuilt.');
            }
        }),
        vscode.commands.registerCommand('benne-editor.rebuildEditorPreviewBundles', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game and preview build scripts).'
                );
                return;
            }

            const roomOk = await runRoomPreviewBuild(folder, ch, {
                title: 'Rebuilding editor preview bundles (1/3: room)'
            });
            if (!roomOk) {
                return;
            }

            const characterOk = await runCharacterPreviewBuild(folder, ch, {
                title: 'Rebuilding editor preview bundles (2/3: character)'
            });
            if (!characterOk) {
                return;
            }

            const guiOk = await runGuiPreviewBuild(folder, ch, {
                title: 'Rebuilding editor preview bundles (3/3: GUI)'
            });
            if (!guiOk) {
                return;
            }

            roomPreview.reloadRoomPreviewBundle();
            characterPreview.reloadCharacterPreviewBundle();
            guiPreview.reloadGuiPreviewBundle();
            void vscode.window.showInformationMessage(
                'Editor preview bundles rebuilt (room, character, GUI).'
            );
        }),
        vscode.commands.registerCommand(
            'benne-editor.openUriPreview',
            async (uriStr?: string, preview?: boolean) => {
                if (typeof uriStr !== 'string') {
                    return;
                }
                await openDocumentUri(vscode.Uri.parse(uriStr), preview === true);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.openRoomScriptPreview',
            async (roomJsonUriStr?: string, roomId?: string) => {
                if (typeof roomJsonUriStr !== 'string' || typeof roomId !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await openDocumentPinned(scriptUri, BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealRegisterRoomScript',
            async (roomJsonUriStr?: string, roomId?: string) => {
                if (typeof roomJsonUriStr !== 'string' || typeof roomId !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await revealEventInDocument(scriptUri, 'registerRoomScript', BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealRoomScriptEvent',
            async (roomJsonUriStr?: string, roomId?: string, eventId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof eventId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addPropVerbEvent',
            async (roomJsonUriStr?: string, roomId?: string, propId?: string, verbId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof propId !== 'string' ||
                    typeof verbId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const r = await addPropVerbEvent(jsonUri, roomId, propId, verbId);
                if (selection.roomPanel.kind === 'prop' && selection.roomPanel.prop.id === propId) {
                    try {
                        const props = await readRoomProps(jsonUri);
                        const next = props.find((p) => p.id === propId);
                        if (next) {
                            selection.setRoomPanelProp(jsonUri, roomId, next);
                        }
                    } catch {
                        /* keep previous selection */
                    }
                }
                refreshTrees();
                if (r.ok) {
                    const eventId = `verb:room:${roomId}:prop:${propId}:${verbId}`;
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                    if (r.insertedStubRange) {
                        await revealSourceRangeInDocument(
                            scriptUri,
                            r.insertedStubRange.start,
                            r.insertedStubRange.end,
                            BENNE_SCRIPT_VIEW_COLUMN
                        );
                    } else {
                        await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
                    }
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.makePropClickable',
            async (roomJsonUriStr?: string, roomId?: string, propId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof propId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                await makeRoomPropClickable(jsonUri, propId);
                if (selection.roomPanel.kind === 'prop' && selection.roomPanel.prop.id === propId) {
                    try {
                        const props = await readRoomProps(jsonUri);
                        const next = props.find((p) => p.id === propId);
                        if (next) {
                            selection.setRoomPanelProp(jsonUri, roomId, next);
                        }
                    } catch {
                        /* keep */
                    }
                }
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addHotspotVerbEvent',
            async (roomJsonUriStr?: string, roomId?: string, hotspotId?: string, verbId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof hotspotId !== 'string' ||
                    typeof verbId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const r = await addHotspotVerbEvent(jsonUri, roomId, hotspotId, verbId);
                refreshTrees();
                if (r.ok) {
                    const eventId = `verb:room:${roomId}:hotspot:${hotspotId}:${verbId}`;
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                    if (r.insertedStubRange) {
                        await revealSourceRangeInDocument(
                            scriptUri,
                            r.insertedStubRange.start,
                            r.insertedStubRange.end,
                            BENNE_SCRIPT_VIEW_COLUMN
                        );
                    } else {
                        await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
                    }
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomCharacterVerbEvent',
            async (roomJsonUriStr?: string, roomId?: string, characterId?: string, verbId?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof characterId !== 'string' ||
                    typeof verbId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const folder = vscode.workspace.getWorkspaceFolder(jsonUri);
                if (!folder) {
                    void vscode.window.showErrorMessage('Could not resolve workspace folder for room JSON.');
                    return;
                }
                const r = await addRoomCharacterVerbEvent(folder.uri, jsonUri, roomId, characterId, verbId);
                refreshTrees();
                if (r.ok) {
                    const eventId = `verb:room:${roomId}:character:${characterId}:${verbId}`;
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                    if (r.insertedStubRange) {
                        await revealSourceRangeInDocument(
                            scriptUri,
                            r.insertedStubRange.start,
                            r.insertedStubRange.end,
                            BENNE_SCRIPT_VIEW_COLUMN
                        );
                    } else {
                        await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
                    }
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.makeCharacterClickable',
            async (characterJsonUriStr?: string, characterId?: string) => {
                if (typeof characterJsonUriStr !== 'string' || typeof characterId !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(characterJsonUriStr);
                await makeCharacterClickable(jsonUri);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addCharacterVerbEvent',
            async (characterJsonUriStr?: string, characterId?: string, verbId?: string) => {
                if (
                    typeof characterJsonUriStr !== 'string' ||
                    typeof characterId !== 'string' ||
                    typeof verbId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(characterJsonUriStr);
                const ok = await addCharacterVerbEvent(jsonUri, characterId, verbId);
                refreshTrees();
                if (ok) {
                    const eventId = `verb:character:${characterId}:${verbId}`;
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${characterId}.character.ts`);
                    await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealCharacterScriptEvent',
            async (characterJsonUriStr?: string, characterId?: string, eventId?: string) => {
                if (
                    typeof characterJsonUriStr !== 'string' ||
                    typeof characterId !== 'string' ||
                    typeof eventId !== 'string'
                ) {
                    return;
                }
                const charJsonUri = vscode.Uri.parse(characterJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(
                    charJsonUri,
                    '..',
                    `${characterId}.character.ts`
                );
                await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
            }
        )
    );

    const gameConfigWatcher = vscode.workspace.createFileSystemWatcher('**/src/game/game-config.json');
    context.subscriptions.push(
        gameConfigWatcher,
        gameConfigWatcher.onDidChange((uri) => {
            scheduleAutoRoomPreviewRebuild(uri);
        }),
        gameConfigWatcher.onDidCreate((uri) => {
            scheduleAutoRoomPreviewRebuild(uri);
        })
    );

    const jsonWatcher = vscode.workspace.createFileSystemWatcher('**/src/game/**/*.json');
    const roomSheetAssetWatcher = vscode.workspace.createFileSystemWatcher(
        '**/src/game/assets/images/rooms/**'
    );
    const characterSheetAssetWatcher = vscode.workspace.createFileSystemWatcher(
        '**/src/game/assets/images/characters/**'
    );
    const guiSheetAssetWatcher = vscode.workspace.createFileSystemWatcher(
        '**/src/game/assets/images/guis/**'
    );
    context.subscriptions.push(
        jsonWatcher,
        jsonWatcher.onDidChange((uri) => {
            refreshTrees();
            roomPreview.onWorkspaceRoomJsonChanged(uri);
        }),
        jsonWatcher.onDidCreate((uri) => {
            refreshTrees();
            roomPreview.onWorkspaceRoomJsonChanged(uri);
        }),
        jsonWatcher.onDidDelete(refreshTrees),
        roomSheetAssetWatcher,
        roomSheetAssetWatcher.onDidChange(refreshTrees),
        roomSheetAssetWatcher.onDidCreate(refreshTrees),
        roomSheetAssetWatcher.onDidDelete(refreshTrees),
        characterSheetAssetWatcher,
        characterSheetAssetWatcher.onDidChange(refreshTrees),
        characterSheetAssetWatcher.onDidCreate(refreshTrees),
        characterSheetAssetWatcher.onDidDelete(refreshTrees),
        guiSheetAssetWatcher,
        guiSheetAssetWatcher.onDidChange(refreshTrees),
        guiSheetAssetWatcher.onDidCreate(refreshTrees),
        guiSheetAssetWatcher.onDidDelete(refreshTrees)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('benne-editor.showSidebar', async () => {
            await vscode.commands.executeCommand('workbench.view.extension.benne-editor');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('benne-editor.openEditor', async () => {
            const panel = vscode.window.createWebviewPanel(
                'benneEditor',
                'BENNE Editor',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = getWebviewContent();

            panel.webview.onDidReceiveMessage(
                async (message: { command?: string }) => {
                    switch (message.command) {
                        case 'createRoom': {
                            await vscode.commands.executeCommand('benne-editor.createRoom');
                            break;
                        }
                        case 'addRoomProp': {
                            await vscode.commands.executeCommand('benne-editor.addRoomProp');
                            break;
                        }
                        case 'createCharacter': {
                            await vscode.commands.executeCommand('benne-editor.createCharacter');
                            break;
                        }
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BENNE Editor</title>
            <style>
                body { 
                    font-family: system-ui, sans-serif; 
                    padding: 20px; 
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    cursor: pointer;
                    border-radius: 4px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h1>BENNE Editor</h1>
            <p>Use the <strong>BENNE</strong> activity bar for the <em>BENNE</em> tree, <em>Actions</em>, and <em>Inspector</em>. Each tree choice resets the editor area, then opens the right layout: rooms, characters, and GUIs use two rows with the live preview on top and the corresponding TypeScript source file on the bottom.</p>
            
            <p>
                <button id="create-room-btn" type="button">Create New Room</button>
                <button id="add-prop-btn" type="button" style="margin-left:8px">Add Prop</button>
                <button id="create-character-btn" type="button" style="margin-left:8px">Create Character</button>
            </p>

            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('create-room-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'createRoom' });
                });
                document.getElementById('add-prop-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'addRoomProp' });
                });
                document.getElementById('create-character-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'createCharacter' });
                });
            </script>
        </body>
        </html>`;
}

export function deactivate(): void {}

async function openRoomJsonAndScript(roomJsonUri: vscode.Uri, roomId: string): Promise<void> {
    await openRoomJsonAndScriptBottomGroup(roomJsonUri, roomId);
}

async function openCharacterJsonAndScript(characterJsonUri: vscode.Uri, characterId: string): Promise<void> {
    await openCharacterJsonAndScriptBottomGroup(characterJsonUri, characterId);
}

async function openGuiJsonAndScript(guiJsonUri: vscode.Uri, guiId: string): Promise<void> {
    await openGuiJsonAndScriptBottomGroup(guiJsonUri, guiId);
}
