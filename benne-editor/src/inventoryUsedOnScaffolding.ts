import * as vscode from 'vscode';
import type { VerbTarget } from './bennescript/handlerSpecs';
import { addHandler, type AddHandlerResult } from './scriptHandlers';

export type AddInventoryUsedOnResult = AddHandlerResult;

/**
 * "Use an item on this" in the Inspector: `target.onAnyItem(() => { … })` (§4.6). Any item handler
 * already there (`onUseItem(items.x, …)`, `onItem`, `onAnyItem`, …) counts as present.
 */
function addAnyItemHandler(scriptUri: vscode.Uri, target: VerbTarget, label: string): Promise<AddInventoryUsedOnResult> {
    return addHandler(scriptUri, { kind: 'anyItem', target }, `item handler for ${label}`);
}

/** In `*.room.ts`, for a prop, hotspot or character of that room. */
export function addRoomInventoryUsedOnStub(
    roomJsonUri: vscode.Uri,
    roomId: string,
    kind: 'prop' | 'hotspot' | 'character',
    targetId: string
): Promise<AddInventoryUsedOnResult> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    return addAnyItemHandler(scriptUri, { kind, roomId, id: targetId }, `${kind} "${targetId}"`);
}

/** In `*.character.ts`: applies wherever the character is spawned. */
export function addCharacterInventoryUsedOnStub(
    characterJsonUri: vscode.Uri,
    characterId: string
): Promise<AddInventoryUsedOnResult> {
    const scriptUri = vscode.Uri.joinPath(characterJsonUri, '..', `${characterId}.character.ts`);
    return addAnyItemHandler(scriptUri, { kind: 'character', roomId: null, id: characterId }, `"${characterId}"`);
}

/** In `*.inventory.ts`: another item used on this one. */
export function addInventoryItemInventoryUsedOnStub(
    inventoryJsonUri: vscode.Uri,
    itemId: string
): Promise<AddInventoryUsedOnResult> {
    const scriptUri = vscode.Uri.joinPath(inventoryJsonUri, '..', `${itemId}.inventory.ts`);
    return addAnyItemHandler(scriptUri, { kind: 'item', id: itemId }, `item "${itemId}"`);
}
