import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `game-menu` — Bennescript entry (`B.raw`, `onGuiBuilt`, `onGuiShow`, …).
 */
registerGuiScript('game-menu', ({ B }) => {
  const syncQuitButton = () => {
    const isDesktop = B.getEnvironment() === 'electron';
    const quitButton = B.gui('game-menu').control('quit');
    quitButton.setVisible(isDesktop);
    quitButton.enabled = isDesktop;
  };

  B.onGuiBuilt(syncQuitButton);
  B.onGuiShow(syncQuitButton);

  B.whenButtonClick('quit', () => {
    B.quit();
  });

  B.whenButtonClick("resume", () => {
    B.gui('game-menu').hide();
  });

  B.whenButtonClick("settings", () => {
    B.gui('settings-menu').show();
    B.gui('game-menu').hide();
  });

  B.whenButtonClick("save", () => {
    B.gui('save-menu').show();
    B.gui('game-menu').hide();
  });

  B.whenButtonClick("load", () => {
    B.gui('load-menu').show();
    B.gui('game-menu').hide();
  });

  B.whenButtonClick("title-screen", () => {
    B.room.changeTo('title');
  });
});
