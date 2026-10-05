import { registerGuiScript } from '@engine/scripting';

/**
 * Title screen actions and desktop-only Quit button.
 */
registerGuiScript('title-buttons', ({ B }) => {
  const syncQuitButton = () => {
    const isDesktop = B.getEnvironment() === 'electron';
    const quitButton = B.gui('title-buttons').control('quit');
    quitButton.setVisible(isDesktop);
    quitButton.enabled = isDesktop;
  };

  B.onGuiBuilt(syncQuitButton);
  B.onGuiShow(syncQuitButton);

  B.whenButtonClick('quit', () => {
    B.quit();
  });

  B.whenButtonClick("new-game", () => {
    B.state.reset();
    B.room.changeTo('opening');
  });

  B.whenButtonClick("load-game", () => {
    B.gui('load-menu').show();
  });

  B.whenButtonClick("settings", () => {
    B.gui('settings-menu').show();
  });

});
