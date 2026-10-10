/** Messages between the State view's webview (`stateMain.ts`) and its provider. Types only. */
import type { StateValue } from '../bennescript/stateFile';
import type { StateSectionKind } from '../bennescript/stateNames';

export type { StateSectionKind, StateValue };

export interface StateViewEntry {
    name: string;
    /** False for entries the view can't edit (spreads, values that aren't literals): reveal only. */
    editable: boolean;
    value?: StateValue;
    saveKey?: string;
}

export interface StateViewSection {
    /** Whether `state.ts` has this `defineFlags` / `defineVars` call yet. */
    present: boolean;
    entries: StateViewEntry[];
}

export type StateViewPayload =
    | { status: 'loading' }
    | { status: 'noGame' }
    | {
          status: 'ready';
          /** `src/game/state.ts`, relative to the workspace folder. */
          fileLabel: string;
          fileExists: boolean;
          flags: StateViewSection;
          vars: StateViewSection;
      };

/** Extension → webview. */
export type StateHostMessage = { type: 'benne/state/state'; state: StateViewPayload };

/** Webview → extension. */
export type StateWebviewMessage =
    | { action: 'ready' }
    | { action: 'setValue'; kind: StateSectionKind; name: string; value: StateValue }
    | { action: 'add'; kind: StateSectionKind; name: string; value: StateValue }
    | { action: 'rename'; kind: StateSectionKind; name: string; newName: string }
    | { action: 'delete'; kind: StateSectionKind; name: string }
    | { action: 'reveal'; kind?: StateSectionKind; name?: string };
