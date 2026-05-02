import type { GlobalScriptContext } from './types.js';

const benneGlobalScriptRegistrations = new Map<string, (context: GlobalScriptContext) => void>();
let fallbackModuleKeyCounter = 0;
let warnedMissingModuleKey = false;

function resolveModuleKey(moduleKey: string | undefined): string {
  const trimmed = moduleKey?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  if (import.meta.env.DEV && !warnedMissingModuleKey) {
    warnedMissingModuleKey = true;
    console.warn(
      '[Benne] registerGlobalScript called without moduleKey. Pass import.meta.url as the second argument to keep HMR registrations stable.',
    );
  }
  fallbackModuleKeyCounter += 1;
  return `global:legacy:${fallbackModuleKeyCounter}`;
}

export function getBenneGlobalScriptRegistrations(): ReadonlyArray<(context: GlobalScriptContext) => void> {
  return [...benneGlobalScriptRegistrations.values()];
}

/**
 * Call from `globalScript.ts` (side effect) to register global Bennescript handlers.
 * Run after {@link import('./wireBenneGlobalScripts.js').wireBenneGlobalScripts} so `ctx.game` and timers are available.
 */
export function registerGlobalScript(
  registerFn: (context: GlobalScriptContext) => void,
  moduleKey?: string,
): void {
  const resolvedKey = resolveModuleKey(moduleKey);
  benneGlobalScriptRegistrations.set(resolvedKey, registerFn);
}
