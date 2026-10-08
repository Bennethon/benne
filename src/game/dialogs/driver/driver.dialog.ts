import { cutscene, wait } from '@benne/script';
import { flags } from '@game';
import { dialog, options } from './driver.ids';

// If I fix your battery, can I have the power regulator?
options.fixBattery.onChoose(() => {
  Driver: `Sure. I guess.`
  Driver: `But only if it works!`
  flags.askedAboutBattery = true
})

// Do you have a 10mm socket wrench?
options.wrench.onChoose(() => {
  Driver: `Yeah. I think it fell under my tool chest over there.`
  Hank: `Oh great.`
  flags.askedAboutWrench = true
})

// Hello good sir!
options.greetDriver.onChooseOnce(() => {
  Driver: `You here to drive a car?`
  Hank: `Huh?`
  Driver: `Damn robots takin' all our cars away.`
  Driver: `Not if I have something to say about it!`
  options.cantDrive.on()
})

// The AI in the future doesn't let you drive?
options.cantDrive.onChooseOnce(() => {
  cutscene(() => {
    Driver: `Well. I mean. Not exactly.`
    Driver: `We can still drive...`
    Driver: `but nobody does anymore!`
    Driver: `People just let the AI drive them around.`
    Driver: `But not ME! NO SIR!`
    Driver: `Do you want to join my club?`
    Driver: `It's called the Human Driver's Club!`
    wait(1)
    Hank: `Um, maybe later.`
  })
})

// That's a nice car you've got there.
options.niceCar.onChoose(() => {
  cutscene(() => {
    Driver: `That, my friend, is a 2001 Ford Focus.`
    Driver: `Manual steering. Manual brakes. Manual windows.`
    Driver: `Four cylinders. Front-wheel drive.`
    Driver: `Two-liter Zetec. Dual overhead cams. Sixteen valves.`
    Driver: `One hundred and thirty horses under the hood. Zero to sixty in 9.1 seconds.`
    Driver: `They don't make 'em like this anymore.`
    Hank: `*whistle*`
    Hank: `Does it run?`
    Driver: `No.`
  })
  options.whyCarBroke.on()
})

// Why doesn't it run?
options.whyCarBroke.onChoose(() => {
  Driver: `It's the darndest thing. I don't know!`
  Driver: `I've been through every inch of this engine. I can't figure it out.`
  Driver: `But as soon as I get this running, I am hitting the open road!`
})

// Never mind. I'll see you later.
options.nevermind.onChoose(() => {
  Driver: `*grunt*`
  dialog.end()
})
