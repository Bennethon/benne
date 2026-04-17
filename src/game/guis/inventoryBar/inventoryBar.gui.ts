import { registerGuiScript } from '@engine/scripting';

registerGuiScript('inventoryBar', ({ B: _B }) => {
  // TODO: Add inventory slot click handling later
  console.log('Inventory GUI script loaded');

  _B.whenButtonClick("back", () => {
    console.log("Back button clicked");
  });
});
