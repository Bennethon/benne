import { back, fwd, gui, hideZone, hoverZone } from './inventoryBar.ids';

// The bar slides down when the pointer reaches the top of the screen, and back up when it leaves.
hoverZone.onMouseEnter(() => {
  gui.root.tweenTo({ y: 0 }, 0.3, 'Sine.easeOut')
})

hideZone.onMouseLeave(() => {
  gui.root.tweenTo({ y: -33 }, 0.25, 'Sine.easeIn')
})

back.onClick(() => {
  console.log('Back button clicked')
})

fwd.onClick(() => {
  console.log('Forward button clicked')
})
