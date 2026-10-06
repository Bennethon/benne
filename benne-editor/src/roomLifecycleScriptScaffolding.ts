import * as vscode from 'vscode';
import type { HandlerSpec } from './bennescript/handlerSpecs';
import { ensureHandler } from './scriptHandlers';

/**
 * Room hooks as the Inspector names them (its message protocol predates BenneScript):
 * `whenLoadedRoom` → `room.onLoaded`, `whenEnterRoom` → `room.onEnter`,
 * `whenEnterRoomAfterFade` → `room.onEnterAfterFade`, `onUpdate` → `onUpdate`.
 */
export type RoomLifecycleHookKind = 'whenLoadedRoom' | 'whenEnterRoom' | 'whenEnterRoomAfterFade' | 'onUpdate';

export type EnsureRoomLifecycleHookResult =
    | { outcome: 'reveal'; range: { start: number; end: number } }
    | { outcome: 'inserted'; insertedStubRange: { start: number; end: number } }
    | { outcome: 'error' };

export function roomLifecycleHandlerSpec(roomId: string, hook: RoomLifecycleHookKind): HandlerSpec {
    switch (hook) {
        case 'whenLoadedRoom':
            return { kind: 'room', roomId, hook: 'onLoaded' };
        case 'whenEnterRoom':
            return { kind: 'room', roomId, hook: 'onEnter' };
        case 'whenEnterRoomAfterFade':
            return { kind: 'room', roomId, hook: 'onEnterAfterFade' };
        case 'onUpdate':
            return { kind: 'update', roomId };
    }
}

/** Reveals the room's handler for `hook`, or adds a stub (`room.onEnter(() => { … })`) to the room script. */
export async function ensureRoomLifecycleHookInRoomScript(
    roomJsonUri: vscode.Uri,
    roomId: string,
    hook: RoomLifecycleHookKind
): Promise<EnsureRoomLifecycleHookResult> {
    const scriptUri = vscode.Uri.joinPath(roomJsonUri, '..', `${roomId}.room.ts`);
    const r = await ensureHandler(scriptUri, roomLifecycleHandlerSpec(roomId, hook));
    if (r.status === 'failed') {
        return { outcome: 'error' };
    }
    if (r.status === 'exists') {
        return { outcome: 'reveal', range: r.range };
    }
    void vscode.window.showInformationMessage(`Added a ${hook === 'onUpdate' ? 'onUpdate' : 'room'} handler in ${roomId}.room.ts.`);
    return { outcome: 'inserted', insertedStubRange: r.range };
}
