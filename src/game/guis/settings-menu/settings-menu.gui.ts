import { getGameSettings } from '@engine/ConfigManager';
import { registerGuiScript } from '@engine/scripting';

registerGuiScript('settings-menu', ({ B }) => {

  B.onGuiBuilt(() => {
    const audio = getGameSettings().audio;
    B.gui('settings-menu').control('sfxVolume').value = audio.sfxVolume * 100;
    B.gui('settings-menu').control('musicVolume').value = audio.musicVolume * 100;
  });

  B.gui('settings-menu').control('sfxVolume').whenValueChanged((newVal) => {
    B.sound.setSfxVolume(newVal / 100);
    console.log(newVal);
  });

  B.gui('settings-menu').control('musicVolume').whenValueChanged((newVal) => {
    B.sound.setMusicVolume(newVal / 100);
    console.log(newVal);
  });
});
