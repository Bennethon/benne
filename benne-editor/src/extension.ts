import * as vscode from 'vscode';
import { ActionsTreeProvider } from './actionsTreeProvider';
import { EditorSelection } from './editorSelection';
import { MainTreeProvider, type MainTreeNode } from './mainTreeProvider';
import { runCreateCharacterWizard, runImportAnimationsFromAsepriteTags } from './characterScaffolding';
import { runCreateInventoryItemWizard, runImportInventoryItemsFromAsepriteTags } from './inventoryScaffolding';
import { runAddGuiControlInteractiveWizard, runCreateGuiWizard } from './guiScaffolding';
import { runAddRoomPlayFromWizard } from './playFromScaffolding';
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
import { InventoryPreviewPanelController } from './inventoryPreviewPanel';
import { RoomPreviewPanelController } from './roomPreviewPanel';
import { BennePlayPanelController } from './bennePlayPanel';
import { BennePlayWatchManager } from './bennePlayWatch';
import {
    getRoomPreviewBuildOutputChannel,
    resolveGameFolderForRoomPreviewBuild,
    roomPreviewBuildHintUri,
    canRunBenneEditorWebpackCompile,
    ensureBennePlayBundleForGame,
    runBenneEditorWebpackCompile,
    runBennePlayBuild,
    runCharacterPreviewBuild,
    runGuiPreviewBuild,
    runInventoryPreviewBuild,
    runRoomPreviewBuild
} from './roomPreviewBuild';
import { addCharacterVerbEvent, makeCharacterClickable } from './characterVerbScaffolding';
import { addInventoryVerbEvent } from './inventoryVerbScaffolding';
import {
    getCharacterIdFromCharacterJsonUri,
    getDialogIdFromDialogJsonUri,
    getGuiIdFromGuiJsonUri,
    getPdcIdFromPdcJsonUri,
    getInventoryIdFromInventoryJsonUri,
    getRoomIdFromRoomJsonUri,
    readRoomProps
} from './gameDiscovery';
import { addRoomCharacterVerbEvent } from './roomCharacterVerbScaffolding';
import {
    addCharacterInventoryUsedOnStub,
    addInventoryItemInventoryUsedOnStub,
    addRoomInventoryUsedOnStub
} from './inventoryUsedOnScaffolding';
import {
    addHotspotVerbEvent,
    addPropVerbEvent,
    makeRoomPropClickable
} from './propVerbScaffolding';
import { addRoomRegionHandler } from './regionScriptScaffolding';
import { registerDialogBenneScriptCompletion } from './dialogCompletion';
import { registerBenneScriptIdCompletion } from './benneScriptIdCompletion';
import { scheduleGenerateGameIds } from './gameIdsGenerator';
import { openDialogScriptEditorOnly, runCreateDialogWizard } from './dialogScaffolding';
import { runCreatePdcWizard } from './pdcScaffolding';
import { runCreateGameWizard } from './gameCreationScaffolding';
import { runUpdateEngineWizard } from './engineUpdateScaffolding';
import { PdcEditorPanelController } from './pdcPreviewPanel';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import {
    BENNE_SCRIPT_VIEW_COLUMN,
    openBenneCharacterTypeScript,
    openBenneGuiTypeScript,
    openBenneInventoryTypeScript,
    openDocumentPinned,
    openDocumentUri,
    openBenneRoomTypeScript,
    revealEventInDocument,
    revealRoomRegionHandlerInDocument,
    revealSourceRangeInDocument,
    revealWhenInventoryUsedOnHandlerInDocument
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

function resolveDeleteTargetFromSelectionFocus(
    selection: EditorSelection
): import('./delete/deleteTarget').DeleteTarget | undefined {
    const focus = selection.focus;
    if (focus.kind === 'none') {
        return undefined;
    }
    const folder = vscode.workspace.getWorkspaceFolder(focus.uri);
    if (!folder) {
        return undefined;
    }
    if (focus.kind === 'room') {
        const roomId = getRoomIdFromRoomJsonUri(focus.uri);
        return {
            type: 'room',
            folder,
            roomId,
            roomName: focus.label,
            roomJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    if (focus.kind === 'character') {
        return {
            type: 'character',
            folder,
            characterId: getCharacterIdFromCharacterJsonUri(focus.uri),
            characterJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    if (focus.kind === 'gui') {
        return {
            type: 'gui',
            folder,
            guiId: getGuiIdFromGuiJsonUri(focus.uri),
            guiJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    if (focus.kind === 'inventory') {
        return {
            type: 'inventory',
            folder,
            itemId: getInventoryIdFromInventoryJsonUri(focus.uri),
            inventoryJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    if (focus.kind === 'dialog') {
        return {
            type: 'dialog',
            folder,
            dialogId: getDialogIdFromDialogJsonUri(focus.uri),
            dialogJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    if (focus.kind === 'pdc') {
        return {
            type: 'pdc',
            folder,
            pdcId: getPdcIdFromPdcJsonUri(focus.uri),
            pdcJsonUri: focus.uri,
            displayLabel: focus.label
        };
    }
    return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
    const selection = new EditorSelection();
    const mainProvider = new MainTreeProvider(selection);
    const actionsProvider = new ActionsTreeProvider(selection);

    registerDialogBenneScriptCompletion(context);
    registerBenneScriptIdCompletion(context);

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
    const inventoryPreview = new InventoryPreviewPanelController(context.extensionUri, selection);
    const pdcEditor = new PdcEditorPanelController(context.extensionUri, selection);
    const bennePlay = new BennePlayPanelController(context.extensionUri);
    const bennePlayWatch = new BennePlayWatchManager();

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
        inventoryPreview,
        pdcEditor,
        bennePlay,
        bennePlayWatch,
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
        inventoryPreview.resetPreviewPanel();
        pdcEditor.resetPreviewPanel();
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    async function onMainTreeSelection(node: MainTreeNode | undefined): Promise<void> {
        if (!node) {
            return;
        }
        if (node.kind === 'gameConfig') {
            await resetBenneEditorSurface();
            selection.clearFocus();
            await openDocumentPinned(node.uri);
            return;
        }
        if (node.kind === 'globalScript') {
            await resetBenneEditorSurface();
            selection.clearFocus();
            await openDocumentPinned(node.uri);
            return;
        }
        if (node.kind === 'room') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.uri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoom(node.uri, node.name);
            mainProvider.refresh();
            try {
                await mainTreeView.reveal(node, { expand: true, focus: false });
            } catch {
                /* Room row can be absent when the main tree filter hides it. */
            }

            if (!sameRoomContext) {
                await openBenneRoomTypeScript(node.uri, node.id);
            }
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'walkableAreasRoot') {
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
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'walkablePolygon') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithWalkable(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.polygonId,
                null
            );

            if (!sameRoomContext) {
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'walkableHole') {
            const sameRoomContext =
                selection.focus.kind === 'room' &&
                selection.focus.uri.toString() === node.roomJsonUri.toString();

            if (!sameRoomContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!roomPreview.isRoomPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setRoomWithWalkable(
                node.roomJsonUri,
                node.roomName,
                node.roomId,
                node.polygonId,
                node.holeId
            );

            if (!sameRoomContext) {
                await openBenneRoomTypeScript(node.roomJsonUri, node.roomId);
            }
        } else if (node.kind === 'character') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setCharacter(node.uri, node.name);
            await openBenneCharacterTypeScript(node.uri, node.id);
        } else if (node.kind === 'guiControl') {
            const sameGuiContext =
                selection.focus.kind === 'gui' &&
                selection.focus.uri.toString() === node.guiUri.toString();

            if (!sameGuiContext) {
                await resetBenneEditorSurface();
                await applyBenneTwoRowJsonScriptLayout();
            } else if (!guiPreview.isGuiPreviewActive()) {
                await applyBenneTwoRowJsonScriptLayout();
            }

            selection.setGuiWithControl(node.guiUri, node.guiName, node.controlKey);

            if (!sameGuiContext) {
                await openBenneGuiTypeScript(node.guiUri, node.guiId);
            }
        } else if (node.kind === 'gui') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setGui(node.uri, node.name);
            await openBenneGuiTypeScript(node.uri, node.id);
        } else if (node.kind === 'inventoryItem') {
            await resetBenneEditorSurface();
            await applyBenneTwoRowJsonScriptLayout();
            selection.setInventory(node.uri, node.name);
            await openBenneInventoryTypeScript(node.uri, node.id);
        } else if (node.kind === 'dialog') {
            await resetBenneEditorSurface();
            selection.setDialog(node.uri, node.name);
            await openDialogScriptEditorOnly(node.uri, node.id);
        } else if (node.kind === 'pdc') {
            await resetBenneEditorSurface();
            selection.setPdc(node.uri, node.name);
        }
    }

    let inspectorProvider!: InspectorWebviewViewProvider;

    const refreshTrees = (hintUri?: vscode.Uri): void => {
        mainProvider.refresh();
        actionsProvider.refresh();
        void syncMainTreeFilterUi();
        void inspectorProvider.pushState();
        scheduleGenerateGameIds(hintUri);
    };

    inspectorProvider = new InspectorWebviewViewProvider(
        context.extensionUri,
        selection,
        roomPreview,
        guiPreview,
        () => {
            mainProvider.refresh();
            actionsProvider.refresh();
            void syncMainTreeFilterUi();
        }
    );

    function resolvePlayRoom(
        arg?: MainTreeNode | MainTreeNode[] | string,
        roomIdArg?: string,
        roomNameArg?: string,
        playFromNameArg?: string
    ): { roomJsonUri: vscode.Uri; roomId: string; roomName?: string; playFromName?: string } | undefined {
        if (typeof arg === 'string' && typeof roomIdArg === 'string') {
            const pf =
                typeof playFromNameArg === 'string' && playFromNameArg.trim().length > 0
                    ? playFromNameArg.trim()
                    : undefined;
            return {
                roomJsonUri: vscode.Uri.parse(arg),
                roomId: roomIdArg,
                roomName:
                    typeof roomNameArg === 'string' && roomNameArg.length > 0 ? roomNameArg : undefined,
                playFromName: pf
            };
        }

        const node = firstTreeContextArg(Array.isArray(arg) ? arg : arg && typeof arg !== 'string' ? arg : undefined);
        if (node?.kind === 'room') {
            return { roomJsonUri: node.uri, roomId: node.id, roomName: node.name, playFromName: undefined };
        }
        if (
            node?.kind === 'roomSubGroup' ||
            node?.kind === 'prop' ||
            node?.kind === 'hotspot' ||
            node?.kind === 'roomPoint' ||
            node?.kind === 'region' ||
            node?.kind === 'roomCharacter' ||
            node?.kind === 'walkableAreasRoot' ||
            node?.kind === 'walkablePolygon' ||
            node?.kind === 'walkableHole'
        ) {
            return {
                roomJsonUri: node.roomJsonUri,
                roomId: node.roomId,
                roomName: node.roomName,
                playFromName: undefined
            };
        }

        if (selection.roomPanel.kind !== 'none') {
            return {
                roomJsonUri: selection.roomPanel.roomJsonUri,
                roomId: selection.roomPanel.roomId,
                roomName: selection.focus.kind === 'room' ? selection.focus.label : undefined,
                playFromName: undefined
            };
        }
        if (selection.focus.kind === 'room') {
            return {
                roomJsonUri: selection.focus.uri,
                roomId: getRoomIdFromRoomJsonUri(selection.focus.uri),
                roomName: selection.focus.label,
                playFromName: undefined
            };
        }
        return undefined;
    }

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('benne-editor.inspector', inspectorProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        }),
        inspectorProvider,
        vscode.commands.registerCommand('benne-editor.filterMainTree', async () => {
            const value = await vscode.window.showInputBox({
                title: 'Filter BENNE tree',
                prompt:
                    'Show only rooms, props, characters, GUIs, inventory entries, puzzle charts, dialogs, and other entries whose name or id contains this text (case-insensitive). Leave empty and press Enter to clear the filter.',
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
                const target =
                    resolveDeleteTargetFromMainTreeNode(fromTree) ??
                    resolveDeleteTargetFromSelectionFocus(selection);
                if (!target) {
                    void vscode.window.showInformationMessage(
                        'Choose a room, character, GUI, GUI control, inventory item, dialog, puzzle chart, prop, hotspot, point, region, or spawned character in the BENNE tree (or run this from its context menu), then try again.'
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
                if (
                    target.type === 'room' ||
                    target.type === 'character' ||
                    target.type === 'gui' ||
                    target.type === 'inventory' ||
                    target.type === 'dialog' ||
                    target.type === 'pdc'
                ) {
                    roomPreview.resetPreviewPanel();
                    characterPreview.resetPreviewPanel();
                    guiPreview.resetPreviewPanel();
                    pdcEditor.resetPreviewPanel();
                } else if (target.type === 'guiControl') {
                    guiPreview.onWorkspaceGuiJsonChanged(target.guiJsonUri);
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
                    case 'inventory':
                        kindLabel = 'inventory item';
                        break;
                    case 'dialog':
                        kindLabel = 'dialog';
                        break;
                    case 'pdc':
                        kindLabel = 'puzzle chart';
                        break;
                    case 'spawnedCharacter':
                        kindLabel = 'spawned character';
                        break;
                    case 'guiControl':
                        kindLabel = 'GUI control';
                        break;
                    default:
                        kindLabel = target.type;
                        break;
                }
                void vscode.window.showInformationMessage(`Deleted ${kindLabel} “${target.displayLabel}”.`);
            }
        ),
        vscode.commands.registerCommand('benne-editor.createGame', async () => {
            const version =
                typeof context.extension.packageJSON.version === 'string'
                    ? context.extension.packageJSON.version
                    : '0.0.0';
            await runCreateGameWizard(context.extensionPath, version);
        }),
        vscode.commands.registerCommand(
            'benne-editor.updateEngine',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node && node.kind !== 'hint' && 'folder' in node ? node.folder : undefined;
                const version =
                    typeof context.extension.packageJSON.version === 'string'
                        ? context.extension.packageJSON.version
                        : '0.0.0';
                await runUpdateEngineWizard(context.extensionPath, version, preferredFolder);
            },
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
            'benne-editor.playFromRoom',
            async (
                arg?: MainTreeNode | MainTreeNode[] | string,
                roomIdArg?: string,
                roomNameArg?: string,
                playFromNameArg?: string
            ) => {
                const target = resolvePlayRoom(arg, roomIdArg, roomNameArg, playFromNameArg);
                if (!target) {
                    void vscode.window.showInformationMessage(
                        'Choose a room in the BENNE tree, then run "Play from here".'
                    );
                    return;
                }
                if (!vscode.workspace.getWorkspaceFolder(target.roomJsonUri)) {
                    void vscode.window.showErrorMessage('Could not resolve workspace folder for room JSON.');
                    return;
                }
                const gameFolder = await resolveGameFolderForRoomPreviewBuild(target.roomJsonUri);
                if (gameFolder) {
                    const ch = getRoomPreviewBuildOutputChannel();
                    const bundleOk = await ensureBennePlayBundleForGame(gameFolder, ch);
                    if (!bundleOk) {
                        void vscode.window.showErrorMessage(
                            'Could not build BENNE Play bundle. See the "BENNE rebuild previews" output channel.',
                        );
                        return;
                    }
                    void bennePlayWatch.ensureStarted(gameFolder, () => {
                        bennePlay.reloadWebview();
                    });
                    bennePlay.setPanelDisposeSideEffect(() => {
                        bennePlayWatch.stop(gameFolder.uri.fsPath);
                    });
                } else {
                    bennePlay.setPanelDisposeSideEffect(undefined);
                }
                bennePlay.playFromRoom(
                    target.roomId,
                    target.roomName,
                    target.playFromName,
                    gameFolder?.uri,
                );
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomPlayFromMethod',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddRoomPlayFromWizard(selection, node);
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
            'benne-editor.addGuiControl',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runAddGuiControlInteractiveWizard(selection, node);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createInventoryItem',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'inventoryGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreateInventoryItemWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createDialog',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'dialogsGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreateDialogWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.createPdc',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                const preferredFolder =
                    node?.kind === 'pdcsGroup' || node?.kind === 'workspace' ? node.folder : undefined;
                await runCreatePdcWizard(preferredFolder);
                refreshTrees();
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.importInventoryItemsFromAsepriteTags',
            async (arg?: MainTreeNode | MainTreeNode[]) => {
                const node = firstTreeContextArg(arg);
                await runImportInventoryItemsFromAsepriteTags(selection, node);
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
        vscode.commands.registerCommand('benne-editor.rebuildInventoryPreview', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game and npm script build:inventory-preview).'
                );
                return;
            }
            const ok = await runInventoryPreviewBuild(folder, ch);
            if (ok) {
                inventoryPreview.reloadInventoryPreviewBundle();
                void vscode.window.showInformationMessage('Inventory preview bundle rebuilt.');
            }
        }),
        vscode.commands.registerCommand('benne-editor.rebuildBennePlay', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game and npm script build:benne-play).'
                );
                return;
            }
            const ok = await runBennePlayBuild(folder, ch);
            if (ok) {
                void vscode.window.showInformationMessage('BENNE Play bundle rebuilt.');
            }
        }),
        vscode.commands.registerCommand('benne-editor.rebuildDialogPreview', async () => {
            const ch = getRoomPreviewBuildOutputChannel();
            const folder = await resolveGameFolderForRoomPreviewBuild(roomPreviewBuildHintUri(selection));
            if (!folder) {
                void vscode.window.showErrorMessage(
                    'No BENNE game in the workspace (need a folder with src/game/rooms). Dialog editing uses the Inspector webview — this rebuild recompiles the BENNE extension bundle (webpack).'
                );
                return;
            }
            void folder;
            const ok = await runBenneEditorWebpackCompile(context.extensionUri, ch, {
                title: 'Rebuilding BENNE editor (Inspector + extension)'
            });
            if (ok) {
                void vscode.window.showInformationMessage(
                    'BENNE editor bundle rebuilt (Inspector / extension webpack). Reload the VS Code window if the Inspector does not pick up changes.'
                );
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

            const includeWebpack = await canRunBenneEditorWebpackCompile(context.extensionUri);
            const totalSteps = includeWebpack ? 6 : 5;

            const roomOk = await runRoomPreviewBuild(folder, ch, {
                title: `Rebuilding editor preview bundles (1/${totalSteps}: room)`
            });
            if (!roomOk) {
                return;
            }

            const characterOk = await runCharacterPreviewBuild(folder, ch, {
                title: `Rebuilding editor preview bundles (2/${totalSteps}: character)`
            });
            if (!characterOk) {
                return;
            }

            const guiOk = await runGuiPreviewBuild(folder, ch, {
                title: `Rebuilding editor preview bundles (3/${totalSteps}: GUI)`
            });
            if (!guiOk) {
                return;
            }

            const inventoryOk = await runInventoryPreviewBuild(folder, ch, {
                title: `Rebuilding editor preview bundles (4/${totalSteps}: inventory)`
            });
            if (!inventoryOk) {
                return;
            }

            const playOk = await runBennePlayBuild(folder, ch, {
                title: `Rebuilding editor preview bundles (5/${totalSteps}: BENNE Play)`
            });
            if (!playOk) {
                return;
            }

            if (includeWebpack) {
                const editorOk = await runBenneEditorWebpackCompile(context.extensionUri, ch, {
                    title: `Rebuilding editor preview bundles (6/${totalSteps}: extension webpack / Inspector)`
                });
                if (!editorOk) {
                    return;
                }
            } else {
                ch.appendLine(
                    '[skip] Extension webpack compile skipped (installed extension has no devDependencies).',
                );
            }

            roomPreview.reloadRoomPreviewBundle();
            characterPreview.reloadCharacterPreviewBundle();
            guiPreview.reloadGuiPreviewBundle();
            inventoryPreview.reloadInventoryPreviewBundle();
            void vscode.window.showInformationMessage(
                includeWebpack
                    ? 'Editor preview bundles rebuilt (room, character, GUI, inventory, BENNE Play) and extension webpack (Inspector). Reload the window if the Inspector did not refresh.'
                    : 'Editor preview bundles rebuilt (room, character, GUI, inventory, BENNE Play). Reload preview panels if they do not pick up changes.',
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
            'benne-editor.revealRoomRegionHandler',
            async (
                roomJsonUriStr?: string,
                roomId?: string,
                regionId?: string,
                mode?: 'enter' | 'exit'
            ) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof regionId !== 'string' ||
                    (mode !== 'enter' && mode !== 'exit')
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                await revealRoomRegionHandlerInDocument(scriptUri, roomId, regionId, mode, BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addRoomRegionHandler',
            async (roomJsonUriStr?: string, roomId?: string, regionId?: string, mode?: 'enter' | 'exit') => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomId !== 'string' ||
                    typeof regionId !== 'string' ||
                    (mode !== 'enter' && mode !== 'exit')
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const r = await addRoomRegionHandler(jsonUri, roomId, regionId, mode);
                refreshTrees();
                if (r.ok) {
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomId}.room.ts`);
                    if (r.insertedStubRange) {
                        await revealSourceRangeInDocument(
                            scriptUri,
                            r.insertedStubRange.start,
                            r.insertedStubRange.end,
                            BENNE_SCRIPT_VIEW_COLUMN
                        );
                    } else {
                        await revealRoomRegionHandlerInDocument(
                            scriptUri,
                            roomId,
                            regionId,
                            mode,
                            BENNE_SCRIPT_VIEW_COLUMN
                        );
                    }
                }
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
            'benne-editor.addRoomInventoryUsedOnStub',
            async (
                roomJsonUriStr?: string,
                roomIdArg?: string,
                kindArg?: string,
                targetIdArg?: string
            ) => {
                if (typeof roomJsonUriStr !== 'string' || typeof roomIdArg !== 'string' || typeof targetIdArg !== 'string') {
                    return;
                }
                if (kindArg !== 'prop' && kindArg !== 'hotspot' && kindArg !== 'character') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const r = await addRoomInventoryUsedOnStub(jsonUri, roomIdArg, kindArg, targetIdArg);
                refreshTrees();
                if (r.ok && r.insertedStubRange) {
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomIdArg}.room.ts`);
                    await revealSourceRangeInDocument(
                        scriptUri,
                        r.insertedStubRange.start,
                        r.insertedStubRange.end,
                        BENNE_SCRIPT_VIEW_COLUMN
                    );
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addCharacterInventoryUsedOnStub',
            async (characterJsonUriStr?: string, characterIdArg?: string) => {
                if (typeof characterJsonUriStr !== 'string' || typeof characterIdArg !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(characterJsonUriStr);
                const r = await addCharacterInventoryUsedOnStub(jsonUri, characterIdArg);
                refreshTrees();
                if (r.ok) {
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${characterIdArg}.character.ts`);
                    await revealEventInDocument(scriptUri, 'whenInventoryUsedOn', BENNE_SCRIPT_VIEW_COLUMN);
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.addInventoryItemInventoryUsedOnStub',
            async (inventoryJsonUriStr?: string, itemIdArg?: string) => {
                if (typeof inventoryJsonUriStr !== 'string' || typeof itemIdArg !== 'string') {
                    return;
                }
                const jsonUri = vscode.Uri.parse(inventoryJsonUriStr);
                const r = await addInventoryItemInventoryUsedOnStub(jsonUri, itemIdArg);
                refreshTrees();
                if (r.ok) {
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${itemIdArg}.inventory.ts`);
                    await revealEventInDocument(scriptUri, 'whenInventoryUsedOn', BENNE_SCRIPT_VIEW_COLUMN);
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealRoomInventoryUsedOn',
            async (roomJsonUriStr?: string, roomIdArg?: string, targetIdArg?: string) => {
                if (
                    typeof roomJsonUriStr !== 'string' ||
                    typeof roomIdArg !== 'string' ||
                    typeof targetIdArg !== 'string' ||
                    !targetIdArg
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(roomJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${roomIdArg}.room.ts`);
                await revealWhenInventoryUsedOnHandlerInDocument(scriptUri, targetIdArg, BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealCharacterInventoryUsedOn',
            async (characterJsonUriStr?: string, characterIdArg?: string) => {
                if (typeof characterJsonUriStr !== 'string' || typeof characterIdArg !== 'string' || !characterIdArg) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(characterJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${characterIdArg}.character.ts`);
                await revealWhenInventoryUsedOnHandlerInDocument(scriptUri, characterIdArg, BENNE_SCRIPT_VIEW_COLUMN);
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealInventoryItemInventoryUsedOn',
            async (inventoryJsonUriStr?: string, itemIdArg?: string) => {
                if (typeof inventoryJsonUriStr !== 'string' || typeof itemIdArg !== 'string' || !itemIdArg) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(inventoryJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${itemIdArg}.inventory.ts`);
                await revealWhenInventoryUsedOnHandlerInDocument(scriptUri, itemIdArg, BENNE_SCRIPT_VIEW_COLUMN);
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
        ),
        vscode.commands.registerCommand(
            'benne-editor.addInventoryVerbEvent',
            async (inventoryJsonUriStr?: string, itemId?: string, verbId?: string) => {
                if (
                    typeof inventoryJsonUriStr !== 'string' ||
                    typeof itemId !== 'string' ||
                    typeof verbId !== 'string'
                ) {
                    return;
                }
                const jsonUri = vscode.Uri.parse(inventoryJsonUriStr);
                const ok = await addInventoryVerbEvent(jsonUri, itemId, verbId);
                refreshTrees();
                if (ok) {
                    const eventId = `verb:inventory:${itemId}:${verbId}`;
                    const scriptUri = vscode.Uri.joinPath(jsonUri, '..', `${itemId}.inventory.ts`);
                    await revealEventInDocument(scriptUri, eventId, BENNE_SCRIPT_VIEW_COLUMN);
                }
            }
        ),
        vscode.commands.registerCommand(
            'benne-editor.revealInventoryScriptEvent',
            async (inventoryJsonUriStr?: string, itemId?: string, eventId?: string) => {
                if (
                    typeof inventoryJsonUriStr !== 'string' ||
                    typeof itemId !== 'string' ||
                    typeof eventId !== 'string'
                ) {
                    return;
                }
                const inventoryJsonUri = vscode.Uri.parse(inventoryJsonUriStr);
                const scriptUri = vscode.Uri.joinPath(
                    inventoryJsonUri,
                    '..',
                    `${itemId}.inventory.ts`
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
            refreshTrees(uri);
            roomPreview.onWorkspaceRoomJsonChanged(uri);
            guiPreview.onWorkspaceGuiJsonChanged(uri);
            pdcEditor.onWorkspacePdcJsonChanged(uri);
        }),
        jsonWatcher.onDidCreate((uri) => {
            refreshTrees(uri);
            roomPreview.onWorkspaceRoomJsonChanged(uri);
            guiPreview.onWorkspaceGuiJsonChanged(uri);
            pdcEditor.onWorkspacePdcJsonChanged(uri);
        }),
        jsonWatcher.onDidDelete((uri) => refreshTrees(uri)),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.fsPath.endsWith('.gui.json')) {
                guiPreview.onWorkspaceGuiJsonChanged(e.document.uri);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.uri.fsPath.endsWith('.gui.json')) {
                guiPreview.onWorkspaceGuiJsonChanged(doc.uri);
            }
            if (doc.uri.fsPath.endsWith('.room.ts')) {
                roomPreview.onWorkspaceRoomScriptChanged(doc.uri);
            }
        }),
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
            <p>Use the <strong>BENNE</strong> activity bar for the <em>BENNE</em> tree, <em>Actions</em>, and <em>Inspector</em>. Each tree choice resets the editor area, then opens the right layout: rooms, characters, GUIs, and inventory entries use two rows with the live preview on top and the corresponding TypeScript source file on the bottom.</p>
            
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

