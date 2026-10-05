import { registerDialogScript } from '@engine/scripting';

registerDialogScript('jensen-in-hallway', ({ B }) => {

  // Beginning Branch
  B.whenChoice("greeting", () => {
    B.character(`jensen`).say(`HOW'S IT GOING?!`);
    B.character(`jensen`).say(`The world has been taken over by an evil, totalitarian artificial intelligence and you ask me how's it going?!`);
    B.wait(.75);
    B.character(`jensen`).say(`NOT GREAT!`);
    B.dialog(`jensen-in-hallway`).optionOn(`what about AI`);
    B.dialog(`jensen-in-hallway`).optionOff(`greeting`);
  });

  B.whenChoice("its the future", () => {
    B.wait(1);
    B.character(`jensen`).say(`WHAT ARE YOU TALKING ABOUT?!`);
    B.character(`jensen`).say(`GO AWAY!`);
    B.dialog(`jensen-in-hallway`).stop();
    B.character(`jensen`).face(`U`);
    B.dialog(`jensen-in-hallway`).optionOff(`its the future`);
  });

  B.whenChoice("Whatcha lookin at", () => {
    B.character(`jensen`).say(`I'm looking at society crumble.`);
    B.character(`jensen`).say(`The end of humanity.`);
    B.character(`jensen`).say(`Streets running red with blood!`);
    B.character(`jensen`).say(`DARKNESS FALLING OVER THE LAND!`);
    B.character(`jensen`).say(`AI HAS TAKEN CONTROL AND WE'RE ALL DOOMED!`);
    B.dialog(`jensen-in-hallway`).optionOn(`what about AI`);
    B.dialog(`jensen-in-hallway`).optionOff(`Whatcha lookin at`);
  });

  B.whenChoice("out of the way", () => {
    B.character(`jensen`).say(`You don't want to leave!`);
    B.character(`jensen`).say(`Didn't you know that the world has been taken over by an AI overlord?`);
    B.character(`jensen`).say(`It's safer in here.`);
    B.dialog(`jensen-in-hallway`).optionOff(`out of the way`);
    B.dialog(`jensen-in-hallway`).optionOn(`what about AI`);
  });

  B.whenChoice("what about AI", () => {
    B.character(`jensen`).say(`Where have you been, under a rock?`);
    B.character(`jensen`).say(`AI is EVERYWHERE! You can't escape it!`);
    B.dialog(`jensen-in-hallway`).optionOff(`what about AI`);
    B.dialog(`jensen-in-hallway`).optionOn(`AI problem`);
  });

  // What's the problem with AI?
  B.whenChoice("AI problem", () => {
    B.character(`jensen`).say(`Where do I begin?`);
    B.character(`jensen`).say(`It KILLS human creativity.`);
    B.character(`jensen`).say(`Takes away all our agency!`);
    B.character(`jensen`).say(`No more free will!`);
    B.character(`jensen`).say(`It does EVERYTHING for us.`);
    B.character(`jensen`).say(`No one works.`);
    B.character(`jensen`).say(`It's discovered every scientific breakthrough imaginable.`);
    B.character(`jensen`).say(`TIME SCIENTISTS ARE OBSOLETE!`);
    B.dialog(`jensen-in-hallway`).optionOff(`AI problem`);
    B.dialog(`jensen-in-hallway`).optionOn(`what is a time scientist`);
  });

  // What's a time scientist?
  B.whenChoice("what is a time scientist", () => {
    B.character(`jensen`).say(`My name is Professor Jensen, and I'm the most preeminent time manipulation scientist on the planet!`);
    B.character(`jensen`).say(`OR I WAS!`);
    B.character(`jensen`).say(`Now I am doomed to cower here in this hallway for eternity.`);
    B.wait(1);
    B.player.say(`Oh, pleased to meet you. My name's Hank.`);
    B.dialog(`jensen-in-hallway`).optionOff(`what is a time scientist`);
    B.dialog(`jensen-in-hallway`).optionOn(`time scientist`);
  });

  // You're a time scientist? You can help me get home!
  B.whenChoice("time scientist", () => {
    B.character(`jensen`).say(`Get... home...?`);
    B.wait(.75);
    B.character(`jensen`).walkTo(`hallway-point-2`);
    B.character(`jensen`).face(`R`);
    B.wait(.75);
    B.character(`jensen`).say(`You're... him!`);
    B.character(`jensen`).say(`IT'S YOU!`);
    B.character(`jensen`).say(`The idiot who ruined our only chance at stopping AI ten years ago!`);
    B.player.say(`What are you talking about?`);
    B.character(`jensen`).say(`Yes, I recognize you now.`);
    B.character(`jensen`).say(`My colleagues and I were prepping for our first time jump.`);
    B.character(`jensen`).say(`I was going to go back in time and prevent AI from ever being invented.`);
    B.character(`jensen`).say(`I was going to save the world!`);
    B.player.say(`Err.`);
    B.character(`jensen`).say(`AND YOU RUINED ALL OF IT!`);
    B.player.say(`Uhh.`);
    B.character(`jensen`).say(`Do you know how long it takes Timeonium to synthesize?`);
    B.character(`jensen`).say(`We had been working on it for DECADES!`);
    B.character(`jensen`).say(`And YOU come in and wreck it all!`);
    B.character(`jensen`).say(`Now there's no more Timeonium, and the AI won't let me make more.`);
    B.character(`jensen`).face(`U`);
    B.character(`jensen`).say(`*SOB*`);
    B.state.setFlag(`jensenCrying`, true);
    B.dialog(`jensen-in-hallway`).stop();
  });

  B.whenChoice("bye", () => {
    B.character(`jensen`).say(`Humph!`);
    B.character(`jensen`).face(`U`);
    if (!B.state.getFlag(`spokeWithJensenFirstTime`)) {
      B.state.setFlag(`spokeWithJensenFirstTime`, true);
    }
    B.dialog(`jensen-in-hallway`).stop();
  });


});
