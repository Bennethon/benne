import { fadeOut, wait } from '@benne/script';
import { flags, rooms } from '@game';
import { dialog, options } from './jensen-in-plaza.ids';

// With all three parts, the "found" options give way to "found all".
dialog.onStart(() => {
  if (flags.gotLens && flags.gotRegulator && flags.gotRelay) {
    options.foundLens.off()
    options.foundRegulator.off()
    options.foundRelay.off()
    options.foundAll.on()
  }
})

// What do we need to find again?
options.whatDoWeNeed.onChoose(() => {
  Jensen: "We need:"
  Jensen: "A temporal focusing lens."
  Jensen: "A power regulator."
  Jensen: "And a control relay."
  Jensen: "Got it?"
  Hank: "Got it."
  Jensen: "A robot could do this faster than you!"
})

// Hey, I found the lens!
options.foundLens.onChooseOnce(() => {
  Jensen: "Excellent!"
  if (flags.gotRegulator) {
    Jensen: "Now all we need is the control relay."
  } else if (flags.gotRelay) {
    Jensen: "Now all we need is the power regulator."
  } else {
    Jensen: "Now all we need is the power regulator and control relay."
  }
  Jensen: "We don't have all day!"
})

// Hey, I found the power regulator!
options.foundRegulator.onChooseOnce(() => {
  Jensen: "Excellent!"
  if (flags.gotLens) {
    Jensen: "Now all we need is the control relay."
  } else if (flags.gotRelay) {
    Jensen: "Now all we need is the temporal focusing lens."
  } else {
    Jensen: "Now all we need is the temporal focusing lens and control relay."
  }
  Jensen: "We don't have all day!"
})

// Hey, I found the control relay!
options.foundRelay.onChooseOnce(() => {
  Jensen: "Excellent!"
  if (flags.gotLens) {
    Jensen: "Now all we need is the power regulator."
  } else if (flags.gotRegulator) {
    Jensen: "Now all we need is the temporal focusing lens."
  } else {
    Jensen: "Now all we need is the temporal focusing lens and power regulator."
  }
  Jensen: "We don't have all day!"
})

// I think I got all the parts we need!
options.foundAll.onChoose(() => {
  Jensen: "Excellent! Give them to me. Let's go to my lab and repair the time chamber."
  fadeOut()
  wait(0.75)
  flags.allDone = true
  rooms.lab.goTo()
})

// Try to stay calm. I'll be back.
options.bye.onChoose(() => {
  Jensen: "ARGH! Hurry up!"
  Jensen: "I can feel the evil eyes of the computers boring into me!"
  dialog.end()
})
