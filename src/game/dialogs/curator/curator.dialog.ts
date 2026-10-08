import { cutscene, wait } from '@benne/script';
import { flags } from '@game';
import { dialog, options } from './curator.ids';

// Hello.
options.greetCurator.onChooseOnce(() => {
  Curator: `Hi.`
  options.howsItGoingCurator.on()
})

// How's it going?
options.howsItGoingCurator.onChooseOnce(() => {
  cutscene(() => {
    Curator: `Terrible.`
    Curator: `I'm stuck here, forever cursed to preside over these inhuman atrocities of "art".`
    Curator: `A whole gallery of AI "art". The whole artistic world is a joke now.`
    Curator: `Long gone are the days of human ingenuity and creativity. Now it's all just pushed out by a computer.`
    Curator: `And here I am, tasked to preside over it all.`
    Hank: `Humans can still just, like, make their own art, though, right?`
    wait(1)
    Curator: `That's not the point.`
  })
})

// What's the deal with that canvas and spilled paint?
options.paintSpill.onChoose(() => {
  Curator: `We were just testing out a new PaintBot model and it went haywire.`
  Curator: `The municipal AI authority has yet to send out a cleaning bot.`
  Curator: `Just try not to get any on your shoes.`
})

// What's the deal with that big statue with the glass over there?
options.askAboutLens.onChooseOnce(() => {
  Curator: `Oh, THAT. It's the most recent addition to the "collection".`
  Curator: `An avant-garde take on industrial nostalgia. Very daring. If you're easily impressed.`
  Hank: `I like the shiny glass part.`
  Curator: `Of course you do.`
  options.canHaveLens.on()
})

// I think I can use that lens for something important. Can I have it?
options.canHaveLens.onChoose(() => {
  Curator: `*scoff* Can you have it?`
  Curator: `Can you just deface the newest, showcase piece in the collection?`
  Curator: `Humans don't create art anymore. And until they do, I am not letting you just destroy the little art that we actually have.`
  Curator: `Humans don't do ANYTHING!`
  Curator: `My one wish is to see a human do something productive at all anymore.`
  flags.canCleanPaint = true
})

// Welp. Have a nice day.
options.bye.onChoose(() => {
  Curator: `Bye.`
  dialog.end()
})
