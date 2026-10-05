import { registerDialogScript } from '@engine/scripting';

registerDialogScript('barista', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;

// Hey. How's it going?
  B.whenChoice("greeting barista", () => {
    B.character(`barista`).say(`Eh, not great ever since AI started providing for all our needs.`);
    B.character(`barista`).say(`Nobody wants to work anymore.`);
    B.player.say(`Well, what are you doing?`);
    B.character(`barista`).say(`I don't want to work anymore either.`);
    B.dialog(`barista`).optionOff(`greeting barista`);
  });

  // Why aren't you serving that guy over there?
  B.whenChoice("waiting customer", () => {
    B.character(`barista`).say(`Ugh! Then I have to walk over there...`);
    B.character(`barista`).say(`TALK to him...`);
    B.character(`barista`).say(`It just seems like a lot of work.`);
  });

  // Did you know there's some dirty dishes on the table over there?
  B.whenChoice("dirty dishes", () => {
    B.character(`barista`).say(`OMG what are you, my mom?`);
    B.character(`barista`).say(`It's such a pain having to clean up after you people!`);
  });

  // What's that high tech looking thing up there?
  B.whenChoice("high tech thing", () => {
    B.character(`barista`).say(`Oh, that's something I scrounged from the old university nearby.`);
    B.character(`barista`).say(`I think it's called a "control relay"?`);
    B.character(`barista`).say(`Don't know what it does, but I think it looks cool.`);
    B.player.say(`Can I have it?`);
    B.character(`barista`).say(`You want me to just GIVE it to you?`);
    B.character(`barista`).say(`I'm a business owner. People need to WORK to earn their keep.`);
    B.state.setFlag(`canWork`, true);
    B.dialog(`customer`).optionOn(`take order`);
  });
  
  // Ok. I bussed your table. I served your customer. Can I have that control relay thing now?
  B.whenChoice("helped", () => {
    B.character(`barista`).say(`Hmm...`);
    B.character(`barista`).face('R');
    B.wait(1);
    B.character(`barista`).face('D');
    B.character(`barista`).say(`Hmm...`);
    B.character(`barista`).say(`Oh ok fine. I'll get it down for you.`);
    B.fadeOut();
    B.sound.play('whip');
    B.inventory.add(`relay`);
    B.prop(`relay`).hide();
    B.fadeIn();
    B.character(`barista`).say(`But don't come around here looking for more free handouts!`);
    B.state.setFlag('gotRelay',true);
    B.dialog('jensen-in-plaza').optionOn('found relay');
    B.dialog(`barista`).stop();
  });

  // I'll be going.
  B.whenChoice("bye", () => {
    B.character(`barista`).say(`Come back soon!`);
    B.dialog(`barista`).stop();
  });
});
