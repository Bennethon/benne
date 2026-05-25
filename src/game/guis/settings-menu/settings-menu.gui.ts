import { registerGuiScript } from '@engine/scripting';

registerGuiScript('settings-menu', ({ B }) => {

  const TEXT_SPEED_MIN = 0.1;
  const TEXT_SPEED_MAX = 2;

  function sliderToDurationMultiplier(sliderVal: number): number {
    return TEXT_SPEED_MIN + TEXT_SPEED_MAX - sliderVal;
  }

  function durationMultiplierToSlider(mult: number): number {
    return TEXT_SPEED_MIN + TEXT_SPEED_MAX - mult;
  }

  B.onGuiBuilt(() => {
    B.gui('settings-menu').control('sfxVolume').value = B.sound.getSfxVolume() * 100;
    B.gui('settings-menu').control('musicVolume').value = B.sound.getMusicVolume() * 100;

    B.gui('settings-menu').control('text-speed-slider').setValue(durationMultiplierToSlider(B.speechSettings.durationMultiplier));
  });

  B.gui('settings-menu').control('sfxVolume').whenValueChanged((newVal) => {
    B.sound.setSfxVolume(newVal / 100);
  });

  B.gui('settings-menu').control('musicVolume').whenValueChanged((newVal) => {
    B.sound.setMusicVolume(newVal / 100);
  });

  B.whenCheckboxCheck("musicEnabled", () => {
    B.speechSettings.clickToSkip = true;
  });

  B.whenCheckboxUncheck("musicEnabled", () => {
    B.speechSettings.clickToSkip = false;
  });

  B.gui("settings-menu").control("text-speed-slider").whenValueChanged((newVal) => {
    B.speechSettings.durationMultiplier = sliderToDurationMultiplier(newVal);
  });

  B.whenButtonClick("back", () => {
    B.gui('settings-menu').hide();
    B.gui('game-menu').show();
  });
});
