import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `dialog-text` — extend with `B.raw` or future GUI lifecycle / control hooks on `B`.
 */
registerGuiScript('dialog-text', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;
}, import.meta.url);
