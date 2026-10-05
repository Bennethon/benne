import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `credits` — Bennescript entry (`B.raw`, future onShow/onHide/control hooks on `B`).
 */
registerGuiScript('credits', ({ B }) => {
  B.onGuiShow((gui) => {
    gui.root.setY(198);
    gui.root.tweenTo({ y: -800 }, 40000, 'Linear');
  });
});
