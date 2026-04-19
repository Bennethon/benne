import { registerGuiScript } from '@engine/scripting';

registerGuiScript('inventoryBar', ({ B }) => {
  B.onGuiBuilt((gui) => {
    const root = gui.root;

    B.whenMouseEnter('hoverZone', () => {
      root.tweenTo({ y: 0 }, 300, 'Sine.easeOut');
      console.log('Mouse entered hover zone');
    });

    B.whenMouseLeave('hoverZone', () => {
      root.tweenTo({ y: -150 }, 250, 'Sine.easeIn');
      console.log('Mouse left hover zone');
    });
  });

  B.whenButtonClick('back', () => {
    console.log('Back button clicked');
  });

  B.whenButtonClick('Fwd', () => {
    console.log('Forward button clicked');
  });
});
