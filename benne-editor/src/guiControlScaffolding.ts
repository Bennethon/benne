import * as vscode from 'vscode';
import { applyBenneTwoRowJsonScriptLayout } from './benneEditorLayout';
import type { ControlHook } from './bennescript/handlerSpecs';
import { readGuiContentId } from './guiLifecycleScriptScaffolding';
import { BENNE_SCRIPT_VIEW_COLUMN } from './roomScriptNavigation';
import { ensureAndRevealHandler } from './scriptHandlers';

/**
 * Inspector "Script" buttons on GUI controls: reveal the control's handler in the sibling
 * `*.gui.ts`, or add a stub (`saveBtn.onClick(() => { … })`, §4.15).
 */
async function ensureControlHandler(
    guiJsonUri: vscode.Uri,
    guiId: string,
    controlId: string,
    hook: ControlHook,
    valueProperty?: string
): Promise<void> {
    const scriptUri = vscode.Uri.joinPath(guiJsonUri, '..', `${guiId}.gui.ts`);
    const contentId = await readGuiContentId(guiJsonUri, guiId);
    const r = await ensureAndRevealHandler(
        scriptUri,
        { kind: 'control', guiId: contentId, controlId, hook, valueProperty },
        BENNE_SCRIPT_VIEW_COLUMN
    );
    await applyBenneTwoRowJsonScriptLayout();
    if (r.status === 'inserted') {
        void vscode.window.showInformationMessage(`Added a ${hook} handler for "${controlId}" in ${guiId}.gui.ts.`);
    }
}

export function ensureGuiButtonClickHandlerAndReveal(guiJsonUri: vscode.Uri, guiId: string, buttonId: string): Promise<void> {
    return ensureControlHandler(guiJsonUri, guiId, buttonId, 'onClick');
}

/** Checkboxes have one handler for both states: `x.onChange((checked) => …)`. */
export function ensureGuiCheckboxHandlerAndReveal(guiJsonUri: vscode.Uri, guiId: string, checkboxId: string): Promise<void> {
    return ensureControlHandler(guiJsonUri, guiId, checkboxId, 'onChange', 'checked');
}

export function ensureGuiSliderValueChangedHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    sliderId: string
): Promise<void> {
    return ensureControlHandler(guiJsonUri, guiId, sliderId, 'onChange', 'value');
}

export function ensureGuiTextInputValueChangedHandlerAndReveal(
    guiJsonUri: vscode.Uri,
    guiId: string,
    textInputId: string
): Promise<void> {
    return ensureControlHandler(guiJsonUri, guiId, textInputId, 'onChange', 'text');
}

export function ensureGuiListBoxSelectHandlerAndReveal(guiJsonUri: vscode.Uri, guiId: string, listId: string): Promise<void> {
    return ensureControlHandler(guiJsonUri, guiId, listId, 'onSelect');
}
