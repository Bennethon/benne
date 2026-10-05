import { registerDialogScript } from '@engine/scripting';

registerDialogScript('jensen-in-plaza', ({ B }) => {

  if (
    B.state.getFlag('gotLens') &&
    B.state.getFlag('gotRegulator') &&
    B.state.getFlag('gotRelay')
  ) {
    const dialog = B.dialog('jensen-in-plaza');
    dialog.optionOff.now('found lens');
    dialog.optionOff.now('found regulator');
    dialog.optionOff.now('found relay');
    dialog.optionOn.now('found all');
  }

  // What do we need to find again?
  B.whenChoice("what do we need", () => {
    B.character('jensen').say(`We need:`);
    B.character('jensen').say(`A temporal focusing lens.`);
    B.character('jensen').say(`A power regulator.`);
    B.character('jensen').say(`And a control relay.`);
    B.character('jensen').say(`Got it?`);
    B.player.say(`Got it.`);
    B.character('jensen').say(`A robot could do this faster than you!`);
  });
  
  // Hey, I found the lens!
  B.whenChoice("found lens", () => {

    B.character('jensen').say(`Excellent!`);
    if ( B.state.getFlag('gotRegulator') ) {
      B.character('jensen').say(`Now all we need is the control relay.`);
    } else if ( B.state.getFlag('gotRelay') ) {
      B.character('jensen').say(`Now all we need is the power regulator.`);
    }  else {
      B.character('jensen').say(`Now all we need is the power regulator and control relay.`);
    }
    B.character('jensen').say(`We don't have all day!`);
    B.dialog('jensen-in-plaza').optionOff('found lens');
    
  });

  // Hey, I found the power regulator!
  B.whenChoice("found regulator", () => {

    B.character('jensen').say(`Excellent!`);
    if ( B.state.getFlag('gotLens') ) {
      B.character('jensen').say(`Now all we need is the control relay.`);
    } else if ( B.state.getFlag('gotRelay') ) {
      B.character('jensen').say(`Now all we need is the temporal focusing lens.`);
    }  else {
      B.character('jensen').say(`Now all we need is the temporal focusing lens and control relay.`);
    }
    B.character('jensen').say(`We don't have all day!`);
    B.dialog('jensen-in-plaza').optionOff('found regulator');

  });

  // Hey, I found the control relay!
  B.whenChoice("found relay", () => {

    B.character('jensen').say(`Excellent!`);
    if ( B.state.getFlag('gotLens') ) {
      B.character('jensen').say(`Now all we need is the power regulator.`);
    } else if ( B.state.getFlag('gotRegulator') ) {
      B.character('jensen').say(`Now all we need is the temporal focusing lens.`);
    }  else {
      B.character('jensen').say(`Now all we need is the temporal focusing lens and power regulator.`);
    }
    B.character('jensen').say(`We don't have all day!`);
    B.dialog('jensen-in-plaza').optionOff('found relay');

  });

  // I think I got all the parts we need!
  B.whenChoice("found all", () => {
    B.character('jensen').say(`Excellent! Give them to me. Let's go to my lab and repair the time chamber.`);
    B.fadeOut();
    B.wait(.75);
    B.state.setFlag(`all done`, true);
    B.room.changeTo('lab');
  });

  // Try to stay calm. I'll be back.
  B.whenChoice("bye", () => {
    B.character('jensen').say(`ARGH! Hurry up!`);
    B.character('jensen').say(`I can feel the evil eyes of the computers boring into me!`);
    B.dialog('jensen-in-plaza').stop();
  });

});
