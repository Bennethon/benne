import * as Phaser from 'phaser';
import { applyCharacterEffectiveAnimation, getCharacterAnimationOverrideTag } from '../benneAnimationRuntime.js';
import { computeSpeechLineDurationMs, getSpeechSettings } from '../ConfigManager.js';
import {
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CharacterFacing,
} from '../directionalCharacterAnimation.js';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager.js';
import type { RoomScene } from '../scenes/RoomScene.js';
import { tryGetBenneSoundManager } from '../sound/benneSoundRegistry.js';

/** Per-line options for a scripted speech line. */
export interface ScriptedSayLineOptions {
  clickToSkip?: boolean;
}

export interface BenneSayVoiceMarkerParseResult {
  readonly text: string;
  readonly voiceNumber: string | null;
}

export function parseBenneSayVoiceMarker(line: string): BenneSayVoiceMarkerParseResult {
  const m = /^\|(\d+)\|\s*/.exec(line);
  if (!m) {
    return { text: line, voiceNumber: null };
  }
  return { text: line.slice(m[0].length), voiceNumber: m[1] ?? null };
}

export interface BenneSayRuntimeLine {
  readonly text: string;
  readonly voiceStem: string | null;
}

export function resolveBenneSayRuntimeLine(line: string, talkCharacterDefinitionId: string): BenneSayRuntimeLine {
  const parsed = parseBenneSayVoiceMarker(line);
  return {
    text: parsed.text,
    voiceStem: parsed.voiceNumber == null ? null : `${talkCharacterDefinitionId}${parsed.voiceNumber}`,
  };
}

function applySayLineDirectionalBase(
  scene: RoomScene,
  characterDefinitionId: string,
  baseName: 'Talk' | 'Idle',
): void {
  const sprite = scene.getCharacterSprite(characterDefinitionId);
  if (!sprite || !(sprite instanceof Phaser.GameObjects.Sprite) || !sprite.anims) {
    return;
  }
  if (getCharacterAnimationOverrideTag(sprite)) {
    if (baseName === 'Talk') {
      return;
    }
    applyCharacterEffectiveAnimation(sprite);
    return;
  }
  const facing: CharacterFacing =
    (sprite.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(sprite);
  playDirectionalAnimation(sprite, baseName, facing);
}

/**
 * One scripted dialog line through completion (overlay + input suppression). Shared by the old
 * `B.say` queue and the new BenneScript `say` task.
 */
export function playScriptedSayLine(
  scene: RoomScene,
  line: string,
  talkCharacterDefinitionId: string,
  options?: ScriptedSayLineOptions,
  voiceStem?: string | null,
): Promise<void> {
  // A skipped cutscene plays no lines: no overlay, no voice, no timer — the end state of a
  // say line is simply "line finished".
  if (scene.isCutsceneSkipFastForwarding()) {
    return Promise.resolve();
  }
  const manager = resolveGameStateManager(scene.game);
  const speech = getSpeechSettings(manager);
  const voice = voiceStem ? tryGetBenneSoundManager(scene.game)?.playVoice(voiceStem) ?? null : null;
  const textMs = computeSpeechLineDurationMs(line, manager);
  const ms =
    voice?.durationMs == null
      ? textMs
      : Math.round(Math.min(speech.maxDurationMs, Math.max(speech.minDurationMs, voice.durationMs)));
  const lineOpt = options?.clickToSkip;
  const allowClickToSkip =
    lineOpt === true || (lineOpt !== false && speech.clickToSkip);

  return new Promise<void>((resolve) => {
    let completed = false;
    let timer: Phaser.Time.TimerEvent | null = null;
    let unregisterSkipFinisher: (() => void) | null = null;

    const finish = (): void => {
      if (completed) {
        return;
      }
      completed = true;
      unregisterSkipFinisher?.();
      unregisterSkipFinisher = null;
      voice?.stop();
      timer?.remove(false);
      timer = null;
      scene.clearScriptedDialogClickToSkip();
      applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Idle');
      scene.setDialogTextOverlay({ visible: false });
      scene.popScriptedDialogInputSuppression();
      resolve();
    };

    scene.interruptCharacterWalkForScriptedSpeech(talkCharacterDefinitionId);
    scene.pushScriptedDialogInputSuppression();
    scene.setDialogTextOverlay({
      visible: true,
      text: line,
      talkCharacterDefinitionId,
    });
    applySayLineDirectionalBase(scene, talkCharacterDefinitionId, 'Talk');

    timer = scene.time.delayedCall(ms, finish);
    // ESC ends the line the same way its timer would, whatever the per-line click-to-skip setting.
    unregisterSkipFinisher = scene.registerCutsceneSkipFinisher(finish);

    if (allowClickToSkip) {
      scene.setScriptedDialogClickToSkip(() => {
        timer?.remove(false);
        timer = null;
        finish();
      });
    }
  });
}
