import {
  clearPersistedDialogChoiceOptionsViewportHeightPx,
  readEffectiveDialogSettings,
  writePersistedDialogChoiceOptionsViewportHeightPx,
  writePersistedDialogClickToSkip,
  writePersistedDialogDefaultTalkOffset,
  writePersistedDialogDurationMultiplier,
  writePersistedDialogMaxDurationMs,
  writePersistedDialogMinDurationMs,
  writePersistedDialogMsPerCharacter,
  writePersistedDialogShowText,
} from '../dialog/dialogGameState.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getDialogSettingsFromConfig } from '../ConfigManager.js';
import { emitBenneDialogSettingsChanged } from './benneDialogSettingsScriptSurface.js';
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
    get clickToSkip() {
      return readEffectiveOrConfig().clickToSkip;
    },
    set clickToSkip(v: boolean) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogClickToSkip(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get showText() {
      return readEffectiveOrConfig().showText;
    },
    set showText(v: boolean) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogShowText(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get msPerCharacter() {
      return readEffectiveOrConfig().msPerCharacter;
    },
    set msPerCharacter(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogMsPerCharacter(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get durationMultiplier() {
      return readEffectiveOrConfig().durationMultiplier;
    },
    set durationMultiplier(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogDurationMultiplier(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get minDurationMs() {
      return readEffectiveOrConfig().minDurationMs;
    },
    set minDurationMs(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogMinDurationMs(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get maxDurationMs() {
      return readEffectiveOrConfig().maxDurationMs;
    },
    set maxDurationMs(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogMaxDurationMs(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
    get defaultTalkOffset() {
      const off = readEffectiveOrConfig().defaultTalkOffset;
      return { x: off.x, y: off.y };
    },
    set defaultTalkOffset(v: { x: number; y: number }) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedDialogDefaultTalkOffset(mgr, v);
        emitBenneDialogSettingsChanged();
      }
    },
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
      emitBenneDialogSettingsChanged();
    },
  };
}
