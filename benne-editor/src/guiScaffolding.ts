import * as vscode from 'vscode';
import type { EditorSelection } from './editorSelection';
import type { MainTreeNode } from './mainTreeProvider';
import { pickWorkspaceFolder, validateSlug } from './roomScaffolding';
import { openBenneGuiTypeScript } from './roomScriptNavigation';
import {
    findBenneGameFolders,
    getGuiIdFromGuiJsonUri,
    listGuiDefinitions
} from './gameDiscovery';

export type GuiControlKind =
    | 'text'
    | 'inventoryPanel'
    | 'image'
    | 'nineSliceImage'
    | 'button'
    | 'checkbox'
    | 'slider'
    | 'trigger'
    | 'grid';

function formatJson(value: unknown): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function defaultGuiIdFromDisplayName(displayName: string): string {
    const slug = displayName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'gui';
}

/**
 * Create `src/game/guis/<id>/`, `<id>.gui.json`, `<id>.gui.ts`, and asset folder under `images/guis/<id>/`.
 */
export async function runCreateGuiWizard(preferredFolder?: vscode.WorkspaceFolder): Promise<void> {
    const folder = await pickWorkspaceFolder(preferredFolder);
    if (!folder) {
        return;
    }

    const displayName = await vscode.window.showInputBox({
        prompt: 'GUI display name (shown in the BENNE tree and in `name` in JSON)',
        placeHolder: 'Inventory bar',
        validateInput: (v) => {
            if (!v || !v.trim()) {
                return 'Name is required';
            }
            return null;
        }
    });
    if (!displayName) {
        return;
    }
    const name = displayName.trim();

    const defaultId = defaultGuiIdFromDisplayName(name);

    const guiId = await vscode.window.showInputBox({
        prompt: 'GUI id (folder name and file prefix)',
        value: defaultId,
        validateInput: (v) => validateSlug(v?.trim() ?? '', 'GUI id')
    });
    if (!guiId) {
        return;
    }
    const id = guiId.trim();

    const guiDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'guis', id);
    const guiJsonUri = vscode.Uri.joinPath(guiDir, `${id}.gui.json`);
    const guiTsUri = vscode.Uri.joinPath(guiDir, `${id}.gui.ts`);
    const assetsDir = vscode.Uri.joinPath(folder.uri, 'src', 'game', 'assets', 'images', 'guis', id);

    try {
        await vscode.workspace.fs.stat(guiDir);
        void vscode.window.showErrorMessage(`GUI folder already exists: ${id}`);
        return;
    } catch {
        /* create */
    }

    const guiJson = {
        id,
        name,
        description: '',
        visible: true,
        display: {
            aseprite: true
        }
    };

    const guiTs = `import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for \`${id}\` — Bennescript entry (\`B.raw\`, future onShow/onHide/control hooks on \`B\`).
 */
registerGuiScript('${id}', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
});
`;

    await vscode.workspace.fs.createDirectory(guiDir);
    await vscode.workspace.fs.createDirectory(assetsDir);
    await vscode.workspace.fs.writeFile(guiJsonUri, formatJson(guiJson));
    await vscode.workspace.fs.writeFile(guiTsUri, new TextEncoder().encode(guiTs));

    void vscode.window.showInformationMessage(
        `Created GUI "${name}" (${id}). Export Aseprite to assets/images/guis/${id}/ when ready.`
    );
    await openBenneGuiTypeScript(guiJsonUri, id);
}

function guiControlKindLabel(kind: GuiControlKind): string {
    switch (kind) {
        case 'text':
            return 'text';
        case 'inventoryPanel':
            return 'inventory panel';
        case 'image':
            return 'image';
        case 'nineSliceImage':
            return '9-slice image';
        case 'button':
            return 'button';
        case 'checkbox':
            return 'checkbox';
        case 'slider':
            return 'slider';
        case 'trigger':
            return 'trigger';
        case 'grid':
            return 'grid';
    }
}

function collectExistingControlIds(controls: Record<string, unknown>[]): Set<string> {
    const ids = new Set<string>();
    for (const c of controls) {
        if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
            const id = ((c as { id: string }).id).trim();
            if (id) {
                ids.add(id);
            }
        }
    }
    return ids;
}

function allocateControlId(base: string, existing: Set<string>): string {
    if (!existing.has(base)) {
        return base;
    }
    let n = 2;
    while (existing.has(`${base}${n}`)) {
        n++;
    }
    return `${base}${n}`;
}

function makeDefaultControl(kind: GuiControlKind, id: string): Record<string, unknown> {
    switch (kind) {
        case 'text':
            return {
                type: 'text',
                id,
                x: 0,
                y: 0,
                text: 'Sample text',
                font: '',
                fontSize: 8,
                color: '#ffffff'
            };
        case 'inventoryPanel':
            return {
                type: 'inventoryPanel',
                id,
                x: 0,
                y: 0,
                rows: 1,
                cols: 6,
                slotWidth: 32,
                slotHeight: 32,
                showEmptySlots: true
            };
        case 'image':
            return {
                type: 'image',
                id,
                x: 0,
                y: 0
            };
        case 'nineSliceImage':
            return {
                type: 'nineSliceImage',
                id,
                x: 0,
                y: 0,
                width: 120,
                height: 48,
                tag: '',
                sliceNames: {
                    topLeft: 'TopLeft',
                    topCenter: 'TopMid',
                    topRight: 'TopRight',
                    middleLeft: 'MidLeft',
                    center: 'Mid',
                    middleRight: 'MidRight',
                    bottomLeft: 'BottomLeft',
                    bottomCenter: 'BottomMid',
                    bottomRight: 'BottomRight'
                }
            };
        case 'button':
            return {
                type: 'button',
                id,
                x: 0,
                y: 0,
                width: 120,
                height: 32,
                backgroundAnchor: 'top-left',
                text: 'Button',
                font: '',
                fontSize: 16,
                textColor: '#ffffff',
                textAlign: 'center',
                textOffsetX: 0,
                textOffsetY: 0,
                backgroundTag: ''
            };
        case 'checkbox':
            return {
                type: 'checkbox',
                id,
                x: 0,
                y: 0,
                width: 30,
                height: 20,
                backgroundAnchor: 'top-left',
                tag: 'checkbox',
                checked: false,
                enabled: true,
                states: {
                    uncheckedHover: 'checkbox-hover',
                    checked: 'checkbox-checked',
                    checkedHover: 'checkbox-checked-hover',
                    disabled: 'checkbox-disabled',
                    disabledChecked: 'checkbox-checked-disabled'
                }
            };
        case 'slider':
            return {
                type: 'slider',
                id,
                x: 0,
                y: 0,
                width: 80,
                height: 20,
                backgroundAnchor: 'top-left',
                trackTag: 'slider-track',
                handleTag: 'slider-handle',
                min: 0,
                max: 100,
                defaultValue: 100,
                step: 1,
                enabled: true,
                states: {
                    hover: { handle: 'slider-handle-hover' },
                    disabled: {
                        track: 'slider-track-disabled',
                        handle: 'slider-handle-disabled'
                    }
                }
            };
        case 'trigger':
            return {
                type: 'trigger',
                id,
                name: '',
                x: 0,
                y: 0,
                width: 64,
                height: 64,
                active: true
            };
        case 'grid':
            return {
                type: 'grid',
                id,
                x: 0,
                y: 0,
                width: 160,
                height: 96,
                rows: 2,
                columns: 2
            };
    }
}

/**
 * Append a new control (`text` / `inventoryPanel` / `image` / `button` / …) to a GUI's `controls[]` array.
 * Prompts for an optional control id; uses a kind-based default (`<kind>1`, `<kind>2`, …) when empty.
 * Mirrors the `runAddRoom*Wizard` pattern used by the room Inspector's Add buttons.
 */
export async function runAddGuiControlWizard(
    guiJsonUri: vscode.Uri,
    kind: GuiControlKind
): Promise<void> {
    let text: string;
    try {
        text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(guiJsonUri));
    } catch {
        void vscode.window.showErrorMessage('Could not read GUI JSON.');
        return;
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text) as Record<string, unknown>;
    } catch {
        void vscode.window.showErrorMessage('GUI JSON is not valid; cannot add control.');
        return;
    }

    const controlsRaw = data.controls;
    const controls: Record<string, unknown>[] = Array.isArray(controlsRaw)
        ? (controlsRaw as Record<string, unknown>[])
        : [];
    const existing = collectExistingControlIds(controls);
    const defaultId = allocateControlId(kind, existing);

    const promptedId = await vscode.window.showInputBox({
        prompt: `Control id for new ${guiControlKindLabel(kind)} (leave blank to omit)`,
        value: defaultId,
        validateInput: (v) => {
            const s = (v ?? '').trim();
            if (kind === 'button' && s.length === 0) {
                return 'Button controls require an id (B.whenButtonClick, Inspector tree).';
            }
            if (kind === 'checkbox' && s.length === 0) {
                return 'Checkbox controls require an id (B.whenCheckboxCheck, Inspector tree).';
            }
            if (kind === 'slider' && s.length === 0) {
                return 'Slider controls require an id (control().whenValueChanged, Inspector tree).';
            }
            if (kind === 'trigger' && s.length === 0) {
                return 'Trigger controls require an id (B.whenMouseEnter / whenMouseLeave).';
            }
            if (kind === 'grid' && s.length === 0) {
                return 'Grid controls require an id (gridPlacement.gridControlId references it).';
            }
            if (s.length === 0) {
                return null;
            }
            const slugErr = validateSlug(s, 'Control id');
            if (slugErr) {
                return slugErr;
            }
            if (existing.has(s)) {
                return `A control with id "${s}" already exists in this GUI.`;
            }
            return null;
        }
    });
    if (promptedId === undefined) {
        return;
    }
    const id = promptedId.trim();

    const newControl = makeDefaultControl(kind, id);
    if (!id) {
        delete newControl.id;
    }
    controls.push(newControl);
    data.controls = controls;

    await vscode.workspace.fs.writeFile(guiJsonUri, formatJson(data));

    const guiId = getGuiIdFromGuiJsonUri(guiJsonUri);
    void vscode.window.showInformationMessage(
        `Added ${guiControlKindLabel(kind)} control${id ? ` "${id}"` : ''} to GUI ${guiId}.`
    );
}

async function resolveGuiJsonUri(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<vscode.Uri | undefined> {
    if (node?.kind === 'gui') {
        return node.uri;
    }
    if (node?.kind === 'guiControl') {
        return node.guiUri;
    }

    if (selection.focus.kind === 'gui') {
        return selection.focus.uri;
    }

    const folders = await findBenneGameFolders();
    if (folders.length === 0) {
        void vscode.window.showErrorMessage('No BENNE game folder found in this workspace.');
        return undefined;
    }
    const folder =
        folders.length === 1
            ? folders[0]
            : await pickWorkspaceFolder();
    if (!folder) {
        return undefined;
    }
    const guis = await listGuiDefinitions(folder);
    if (guis.length === 0) {
        void vscode.window.showErrorMessage('No GUIs found. Create a GUI first.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        guis.map((g) => ({ label: g.name, description: g.id, gui: g })),
        { placeHolder: 'Choose a GUI to add a control to' }
    );
    if (!picked) {
        return undefined;
    }
    return picked.gui.uri;
}

/**
 * Top-level entry for the **Add GUI Control** command (Actions panel + tree right-click + Command Palette).
 * Resolves the GUI JSON URI from the right-click `node`, then the current selection focus, then a Quick Pick
 * over discovered GUIs. Always prompts for the control kind, then defers to {@link runAddGuiControlWizard}.
 *
 * Mirrors the message handler in `inspectorWebviewViewProvider.ts`'s `addGuiControl` action so the entry-points
 * stay in sync.
 */
export async function runAddGuiControlInteractiveWizard(
    selection: EditorSelection,
    node?: MainTreeNode
): Promise<void> {
    const guiJsonUri = await resolveGuiJsonUri(selection, node);
    if (!guiJsonUri) {
        return;
    }

    type GuiControlPickItem = vscode.QuickPickItem & { controlKind: GuiControlKind };
    const items: GuiControlPickItem[] = [
        {
            label: 'Text',
            description: 'BitmapText overlay',
            controlKind: 'text'
        },
        {
            label: 'Inventory Panel',
            description: 'Player inventory grid',
            controlKind: 'inventoryPanel'
        },
        {
            label: 'Image',
            description: 'Aseprite tag / animation from this GUI sheet',
            controlKind: 'image'
        },
        {
            label: '9-slice image',
            description: 'Scalable panel from Aseprite slices + meta.slices',
            controlKind: 'nineSliceImage'
        },
        {
            label: 'Button',
            description: 'Sheet-backed label + click target (B.whenButtonClick)',
            controlKind: 'button'
        },
        {
            label: 'Checkbox',
            description: 'Sheet-backed toggle (B.whenCheckboxCheck / whenCheckboxUncheck)',
            controlKind: 'checkbox'
        },
        {
            label: 'Slider',
            description: 'Sheet-backed range (control().whenValueChanged)',
            controlKind: 'slider'
        },
        {
            label: 'Trigger',
            description: 'Invisible hit zone for B.whenMouseEnter / whenMouseLeave',
            controlKind: 'trigger'
        },
        {
            label: 'Grid',
            description: 'Layout container; place other controls with gridPlacement',
            controlKind: 'grid'
        }
    ];
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select control type to add'
    });
    if (!picked) {
        return;
    }
    await runAddGuiControlWizard(guiJsonUri, picked.controlKind);
}
