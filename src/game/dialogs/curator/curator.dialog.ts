import { registerDialogScript } from '@engine/scripting';

registerDialogScript('curator', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;

  // Hello.
  B.whenChoice("greet curator", () => {
    B.character(`curator`).say(`Hi.`);
    B.dialog(`curator`).optionOff(`greet curator`);
    B.dialog(`curator`).optionOn(`hows it going curator`);
  });

  // How's it going?
  B.whenChoice("hows it going curator", () => {
    B.character(`curator`).say(`Terrible.`);
    B.character(`curator`).say(`I'm stuck here, forever cursed to preside over these inhuman atrocities of "art".`);
    B.character(`curator`).say(`A whole gallery of AI "art". The whole artistic world is a joke now.`);
    B.character(`curator`).say(`Long gone are the days of human ingenuity and creativity. Now it's all just pushed out by a computer.`);
    B.character(`curator`).say(`And here I am, tasked to preside over it all.`);
    B.player.say(`Humans can still just, like, make their own art, though, right?`);
    B.wait(1);
    B.character(`curator`).say(`That's not the point.`);
    B.dialog(`curator`).optionOff(`hows it going curator`);
  });

  // What's the deal with that canvas and spilled paint?
  B.whenChoice("paint spill", () => {
    B.character(`curator`).say(`We were just testing out a new PaintBot model and it went haywire.`);
    B.character(`curator`).say(`The municipal AI authority has yet to send out a cleaning bot.`);
    B.character(`curator`).say(`Just try not to get any on your shoes.`);
  });

  // What's the deal with that big statue with the glass over there?
  B.whenChoice("ask about lens", () => {
    B.character(`curator`).say(`Oh, THAT. It's the most recent addition to the "collection".`);
    B.character(`curator`).say(`An avant-garde take on industrial nostalgia. Very daring. If you're easily impressed.`);
    B.player.say(`I like the shiny glass part.`);
    B.character(`curator`).say(`Of course you do.`);
    B.dialog(`curator`).optionOff(`ask about lens`);
    B.dialog(`curator`).optionOn(`can have lens`);
  });

  // I think I can use that lens for something important. Can I have it?
  B.whenChoice("can have lens", () => {
    B.character(`curator`).say(`*scoff* Can you have it?`);
    B.character(`curator`).say(`Can you just deface the newest, showcase piece in the collection?`);
    B.character(`curator`).say(`Humans don't create art anymore. And until they do, I am not letting you just destroy the little art that we actually have.`);
    B.character(`curator`).say(`Humans don't do ANYTHING!`);
    B.character(`curator`).say(`My one wish is to see a human do something productive at all anymore.`);
    B.state.setFlag(`canCleanPaint`,true);
  });

  // Welp. Have a nice day.
  B.whenChoice("bye", () => {
    B.character(`curator`).say(`Bye.`);
    B.dialog(`curator`).stop();
  });

});
