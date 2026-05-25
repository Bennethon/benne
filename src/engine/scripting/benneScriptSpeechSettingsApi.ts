import {
  readEffectiveSpeechSettings,
  writePersistedSpeechClickToSkip,
  writePersistedSpeechDefaultTalkOffset,
  writePersistedSpeechDurationMultiplier,
  writePersistedSpeechMaxDurationMs,
  writePersistedSpeechMinDurationMs,
  writePersistedSpeechMsPerCharacter,
  writePersistedSpeechShowText,
} from '../dialog/speechGameState.js';
import { tryGetActiveGameStateManager } from '../gameState/resolveGameStateManager.js';
import { getSpeechSettingsFromConfig } from '../ConfigManager.js';
import { emitBenneSpeechSettingsChanged } from './benneSpeechSettingsScriptSurface.js';
import type { BenneScriptSpeechSettingsFacade } from './benneScriptFacades.js';

function resolveManager() {
  return tryGetActiveGameStateManager();
}

function readEffectiveOrConfig(): ReturnType<typeof readEffectiveSpeechSettings> {
  const mgr = resolveManager();
  return mgr ? readEffectiveSpeechSettings(mgr) : getSpeechSettingsFromConfig();
}

export function createBenneScriptSpeechSettingsFacade(): BenneScriptSpeechSettingsFacade {
  return {
    get clickToSkip() {
      return readEffectiveOrConfig().clickToSkip;
    },
    set clickToSkip(v: boolean) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechClickToSkip(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get showText() {
      return readEffectiveOrConfig().showText;
    },
    set showText(v: boolean) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechShowText(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get msPerCharacter() {
      return readEffectiveOrConfig().msPerCharacter;
    },
    set msPerCharacter(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechMsPerCharacter(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get durationMultiplier() {
      return readEffectiveOrConfig().durationMultiplier;
    },
    set durationMultiplier(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechDurationMultiplier(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get minDurationMs() {
      return readEffectiveOrConfig().minDurationMs;
    },
    set minDurationMs(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechMinDurationMs(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get maxDurationMs() {
      return readEffectiveOrConfig().maxDurationMs;
    },
    set maxDurationMs(v: number) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechMaxDurationMs(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
    get defaultTalkOffset() {
      const off = readEffectiveOrConfig().defaultTalkOffset;
      return { x: off.x, y: off.y };
    },
    set defaultTalkOffset(v: { x: number; y: number }) {
      const mgr = resolveManager();
      if (mgr) {
        writePersistedSpeechDefaultTalkOffset(mgr, v);
        emitBenneSpeechSettingsChanged();
      }
    },
  };
}
