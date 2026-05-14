import type { GlobalScriptContext } from './types.js';

const benneGlobalScriptRegistrations: Array<(context: GlobalScriptContext) => void> = [];

export function getBenneGlobalScriptRegistrations(): ReadonlyArray<(context: GlobalScriptContext) => void> {
  return benneGlobalScriptRegistrations;
}

/**
 * Call from `globalScript.ts` (side effect) to register global Bennescript handlers.
 * Run after {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts} so `ctx.game` and timers are available.
 * **`B.onUpdate`** is supported here (non-blocking per-frame hook; see `UpdateContext` in `types.ts`).
 */
export function registerGlobalScript(registerFn: (context: GlobalScriptContext) => void): void {
  benneGlobalScriptRegistrations.push(registerFn);
}
