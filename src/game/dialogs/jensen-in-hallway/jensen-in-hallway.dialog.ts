import { cutscene, wait } from '@benne/script';
import { flags } from '@game';
import { jensen, points } from '../../rooms/hallway/hallway.ids';
import { dialog, options } from './jensen-in-hallway.ids';

// Beginning branch
options.greeting.onChooseOnce(() => {
  Jensen: "HOW'S IT GOING?!"
  Jensen: "The world has been taken over by an evil, totalitarian artificial intelligence and you ask me how's it going?!"
  wait(0.75)
  Jensen: "NOT GREAT!"
  options.whatAboutAI.on()
})

options.itsTheFuture.onChooseOnce(() => {
  wait(1)
  Jensen: "WHAT ARE YOU TALKING ABOUT?!"
  Jensen: "GO AWAY!"
  jensen.face('U')
  dialog.end()
})

options.whatchaLookinAt.onChooseOnce(() => {
  Jensen: "I'm looking at society crumble."
  Jensen: "The end of humanity."
  Jensen: "Streets running red with blood!"
  Jensen: "DARKNESS FALLING OVER THE LAND!"
  Jensen: "AI HAS TAKEN CONTROL AND WE'RE ALL DOOMED!"
  options.whatAboutAI.on()
})

options.outOfTheWay.onChooseOnce(() => {
  Jensen: "You don't want to leave!"
  Jensen: "Didn't you know that the world has been taken over by an AI overlord?"
  Jensen: "It's safer in here."
  options.whatAboutAI.on()
})

options.whatAboutAI.onChooseOnce(() => {
  Jensen: "Where have you been, under a rock?"
  Jensen: "AI is EVERYWHERE! You can't escape it!"
  options.aiProblem.on()
})

// What's the problem with AI?
options.aiProblem.onChooseOnce(() => {
  cutscene(() => {
    Jensen: "Where do I begin?"
    Jensen: "It KILLS human creativity."
    Jensen: "Takes away all our agency!"
    Jensen: "No more free will!"
    Jensen: "It does EVERYTHING for us."
    Jensen: "No one works."
    Jensen: "It's discovered every scientific breakthrough imaginable."
    Jensen: "TIME SCIENTISTS ARE OBSOLETE!"
  })
  options.whatIsATimeScientist.on()
})

// What's a time scientist?
options.whatIsATimeScientist.onChooseOnce(() => {
  Jensen: "My name is Professor Jensen, and I'm the most preeminent time manipulation scientist on the planet!"
  Jensen: "OR I WAS!"
  Jensen: "Now I am doomed to cower here in this hallway for eternity."
  wait(1)
  Hank: "Oh, pleased to meet you. My name's Hank."
  options.timeScientist.on()
})

// You're a time scientist? You can help me get home!
options.timeScientist.onChoose(() => {
  cutscene(() => {
    Jensen: "Get... home...?"
    wait(0.75)
    jensen.walkTo(points.hallwayPoint2)
    jensen.face('R')
    wait(0.75)
    Jensen: "You're... him!"
    Jensen: "IT'S YOU!"
    Jensen: "The idiot who ruined our only chance at stopping AI ten years ago!"
    Hank: "What are you talking about?"
    Jensen: "Yes, I recognize you now."
    Jensen: "My colleagues and I were prepping for our first time jump."
    Jensen: "I was going to go back in time and prevent AI from ever being invented."
    Jensen: "I was going to save the world!"
    Hank: "Err."
    Jensen: "AND YOU RUINED ALL OF IT!"
    Hank: "Uhh."
    Jensen: "Do you know how long it takes Timeonium to synthesize?"
    Jensen: "We had been working on it for DECADES!"
    Jensen: "And YOU come in and wreck it all!"
    Jensen: "Now there's no more Timeonium, and the AI won't let me make more."
    jensen.face('U')
    Jensen: "*SOB*"
  })
  flags.jensenCrying = true
  dialog.end()
})

options.bye.onChoose(() => {
  Jensen: "Humph!"
  jensen.face('U')
  flags.spokeWithJensenFirstTime = true
  dialog.end()
})
