import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `menu-bar` — Bennescript entry (`B.raw`, future onShow/onHide/control hooks on `B`).
 */
registerGuiScript('menu-bar', ({ B }) => {

  B.onGuiBuilt((gui) => {
    const root = gui.root;

    B.whenMouseEnter('hoverZone', () => {
      root.tweenTo({ y: 0 }, 300, 'Sine.easeOut');
    });

    B.whenMouseLeave('hideZone', () => {
      root.tweenTo({ y: -17 }, 250, 'Sine.easeIn');
    });
  });

  B.whenButtonClick("MenuBtn", () => {
    B.gui('game-menu').show();
  });
});
