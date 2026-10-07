import * as vscode from 'vscode';
import type { AddRoomVerbHandlerResult } from './propVerbScaffolding';
import { addHandler } from './scriptHandlers';

/** Adds `regions.x.onEnter(() => { … })` / `onExit` to the room script (§4.14), or finds the existing one. */
export async function addRoomRegionHandler(
    roomJsonUri: vscode.Uri,
    roomId: string,
    regionId: string,
    kind: 'enter' | 'exit'
): Promise<AddRoomVerbHandlerResult> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    const hook = kind === 'enter' ? 'onEnter' : 'onExit';
    return addHandler(scriptUri, { kind: 'region', roomId, regionId, hook }, `${hook} handler for region "${regionId}"`);
}
