import { gui } from './credits.ids';

// The credits scroll up from below the screen.
gui.onShow(() => {
  gui.root.y = 198
  gui.root.tweenTo({ y: -800 }, 40, 'Linear')
})
