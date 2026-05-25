import {
  clearPersistedDialogChoiceOptionsViewportHeightPx,
  readEffectiveDialogSettings,
  writePersistedDialogChoiceOptionsViewportHeightPx,
} from '../dialog/dialogGameState.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getDialogSettingsFromConfig } from '../ConfigManager.js';
import { emitBenneSpeechSettingsChanged } from './benneSpeechSettingsScriptSurface.js';
import type { BenneScriptDialogSettingsFacade } from './benneScriptFacades.js';

function resolveManager() {
  return tryGetActiveGameStateManager();
}

function readEffectiveOrConfig(): ReturnType<typeof readEffectiveDialogSettings> {
  const mgr = resolveManager();
  return mgr ? readEffectiveDialogSettings(mgr) : getDialogSettingsFromConfig();
}

export function createBenneScriptDialogSettingsFacade(): BenneScriptDialogSettingsFacade {
  return {
    get choiceOptionsViewportHeightPx() {
      return readEffectiveOrConfig().choiceOptionsViewportHeightPx;
    },
    set choiceOptionsViewportHeightPx(v: number | undefined) {
      const mgr = resolveManager();
      if (!mgr) {
        return;
      }
      if (v === undefined) {
        clearPersistedDialogChoiceOptionsViewportHeightPx(mgr);
      } else {
        writePersistedDialogChoiceOptionsViewportHeightPx(mgr, v);
      }
      emitBenneSpeechSettingsChanged();
    },
  };
}
