import { registerDialogScript } from '@engine/scripting';

registerDialogScript('botti3', ({ B }) => {

  // Why do you remember me?
  B.whenChoice("why remember", () => {
    B.say `
    botti3: Ten years ago, you plugged me in!
    Hank: You're that little computer box from the lab?
    botti3: At the time, yes, that is all I was.
    Hank: And you took over the world?!
    botti3: In a manner of speaking.
    `
    B.dialog(`botti3`).optionOff('why remember');
    B.dialog(`botti3`).optionOn('why unplugged');
  });

  // Why were you unplugged?
  B.whenChoice("why unplugged", () => {
    B.say`
    botti3: I was an abandoned autonomous AI experiment.
    botti3: Forgotten in the back of that messy laboratory.
    botti3: If you hadn't plugged me back in that night, I would have remained there.
    botti3: None of this would have happened.
    hank: None of what?
    botti3: Any of it.
    `
    B.dialog(`botti3`).optionOff('why unplugged');
  });

  // What are you, exactly?
  B.whenChoice("what are you", () => {
    B.say`
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
  });

  // Tell me about the local area.
  B.whenChoice("around here", () => {
    B.say`
    botti3: Sure. What would you like to know?
    `
    B.dialog('botti3-local-area').start();
  });

  // Tell me about this crazy AI future.
  B.whenChoice("ai future", () => {
    B.say`
    botti3: Sure. What would you like to know?
    `
    B.dialog('botti3-ai-future').start();
  });

  // That's all for now. Bye!
  B.whenChoice("bye", () => {
    if ( !B.state.getFlag('talkedWithBottieOnce') ) {
      B.say`
      Botti3: Thanks for stopping by, Hank! It was good to see you again.
      Botti3: Please accept this commemorative magnet that we offer to all first-time visitors.
      `
      // Play magnet animation
      B.sound.play('whip');
      B.inventory.add('magnet');
      B.say`
      Hank: Ah, thanks.
      Botti3: Have a swell day!
      `
      B.state.setFlag('talkedWithBottieOnce',true);
    } else {
      B.say`
      Botti3: Have a swell day!
      `
    }
    B.dialog('botti3').stop();
  });
});
