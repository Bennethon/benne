import { registerGuiScript } from '@engine/scripting';

registerGuiScript('settings-menu', ({ B }) => {

  B.onGuiBuilt(() => {
    B.gui('settings-menu').control('sfxVolume').value = B.sound.getSfxVolume() * 100;
    B.gui('settings-menu').control('musicVolume').value = B.sound.getMusicVolume() * 100;
  });

  B.gui('settings-menu').control('sfxVolume').whenValueChanged((newVal) => {
    B.sound.setSfxVolume(newVal / 100);
  });

  B.gui('settings-menu').control('musicVolume').whenValueChanged((newVal) => {
    B.sound.setMusicVolume(newVal / 100);
  });
});
