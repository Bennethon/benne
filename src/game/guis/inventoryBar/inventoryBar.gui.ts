import { registerGuiScript } from '@engine/scripting';

registerGuiScript('inventoryBar', ({ B }) => {
  // TODO: Add inventory slot click handling later
  console.log('Inventory GUI script loaded');

  B.whenButtonClick("back", () => {
    console.log("Back button clicked");
  });
});
