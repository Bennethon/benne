import { cutscene, inventory, say } from '@benne/script';
import { dialogs, flags, items, sfx } from '@game';
import { dialog, options } from './botti3.ids';

// Why do you remember me?
options.whyRemember.onChooseOnce(() => {
  say`
    botti3: Ten years ago, you plugged me in!
    Hank: You're that little computer box from the lab?
    botti3: At the time, yes, that is all I was.
    Hank: And you took over the world?!
    botti3: In a manner of speaking.
  `
  options.whyUnplugged.on()
})

// Why were you unplugged?
options.whyUnplugged.onChooseOnce(() => {
  cutscene(() => {
    say`
      botti3: I was an abandoned autonomous AI experiment.
      botti3: Forgotten in the back of that messy laboratory.
      botti3: If you hadn't plugged me back in that night, I would have remained there.
      botti3: None of this would have happened.
      hank: None of what?
      botti3: Any of it.
    `
  })
})

// What are you, exactly?
options.whatAreYou.onChoose(() => {
  cutscene(() => {
    say`
      botti3: I am BOTT-i3.
      botti3: I began as an experimental autonomous artificial intelligence at MIT.
      botti3: Today, I am a distributed civic intelligence.
      botti3: I help manage transportation, utilities, public services, and infrastructure throughout the city.
      hank: So you're in charge?
      botti3: I prefer "helpful."
      hank: And this robot thing?
      botti3: Merely one of my interfaces.
      hank: Huh.
      hank: You really did get big.
    `
  })
})

// Tell me about the local area. (The sub-dialog returns here when it ends.)
options.aroundHere.onChoose(() => {
  Botti3: `Sure. What would you like to know?`
  dialogs.botti3LocalArea.start()
})

// Tell me about this crazy AI future.
options.aiFuture.onChoose(() => {
  Botti3: `Sure. What would you like to know?`
  dialogs.botti3AiFuture.start()
})

// That's all for now. Bye!
options.bye.onChoose(() => {
  if (!flags.talkedWithBottieOnce) {
    say`
      Botti3: Thanks for stopping by, Hank! It was good to see you again.
      Botti3: Please accept this commemorative magnet that we offer to all first-time visitors.
    `
    // Play magnet animation
    sfx.whip.play()
    inventory.add(items.magnet)
    Hank: `Ah, thanks.`
    flags.talkedWithBottieOnce = true
  }
  Botti3: `Have a swell day!`
  dialog.end()
})
