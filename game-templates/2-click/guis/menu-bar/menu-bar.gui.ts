import { guis } from '@game';
import { gui, hideZone, hoverZone, menuBtn } from './menu-bar.ids';

// The bar slides down when the pointer reaches the top of the screen, and back up when it leaves.
hoverZone.onMouseEnter(() => {
  gui.root.tweenTo({ y: 0 }, 0.3, 'Sine.easeOut')
})

hideZone.onMouseLeave(() => {
  gui.root.tweenTo({ y: -17 }, 0.25, 'Sine.easeIn')
})

menuBtn.onClick(() => guis.gameMenu.show())
