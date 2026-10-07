export type BenneEnvironment = 'browser' | 'electron';

interface BenneDesktopBridge {
  readonly environment: 'electron';
  quit(): void;
}

declare global {
  interface Window {
    /** Provided only by the isolated Electron preload. */
    readonly benneDesktop?: BenneDesktopBridge;
  }
}

export function getBenneEnvironment(): BenneEnvironment {
  return typeof window !== 'undefined' && window.benneDesktop?.environment === 'electron'
    ? 'electron'
    : 'browser';
}

/** Browser and editor previews deliberately leave their hosting window open. */
export function quitBenneApplication(): void {
  if (getBenneEnvironment() === 'electron') window.benneDesktop?.quit();
}
