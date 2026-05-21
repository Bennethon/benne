import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `save-menu` — Bennescript entry (`B.raw`, future onShow/onHide/control hooks on `B`).
 */
registerGuiScript('save-menu', ({ B }) => {

  B.whenButtonClick("back-btn", () => {
    B.gui('save-menu').hide();
    B.gui('game-menu').show();
  });


  B.whenButtonClick("save-btn", () => {
    B.state.save(B.gui('save-menu').control('save-name').text);
  });
});
