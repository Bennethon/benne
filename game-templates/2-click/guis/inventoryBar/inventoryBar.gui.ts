import { registerGuiScript } from '@engine/scripting';

registerGuiScript('inventoryBar', ({ B }) => {
  B.onGuiBuilt((gui) => {
    const root = gui.root;

    B.whenMouseEnter('hoverZone', () => {
      root.tweenTo({ y: 0 }, 300, 'Sine.easeOut');
    });

    B.whenMouseLeave('hideZone', () => {
      root.tweenTo({ y: -33 }, 250, 'Sine.easeIn');
    });
  });

  B.whenButtonClick('back', () => {
    console.log('Back button clicked');
  });

  B.whenButtonClick('Fwd', () => {
    console.log('Forward button clicked');
  });
});
