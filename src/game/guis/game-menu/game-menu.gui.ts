import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `game-menu` — Bennescript entry (`B.raw`, `onGuiBuilt`, `onGuiShow`, …).
 */
registerGuiScript('game-menu', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;

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
});
