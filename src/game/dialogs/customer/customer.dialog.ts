import { registerDialogScript } from '@engine/scripting';

registerDialogScript('customer', ({ B }) => {

  // Is this a nice place?
  B.whenChoice("nice place", () => {
    B.character(`customer`).say(`Oh yeah! I love this place. Real authentic human experience.`);
    B.character(`customer`).say(`Slow service. Messed up orders. It has it all!`);
  });
  
  // How long have you been waiting here?
  B.whenChoice("how long", () => {
    B.character(`customer`).say(`Oh about 45 minutes. Isn't it great?`);
    B.player.say(`Sure...`);
    B.dialog(`barista`).optionOn(`waiting customer`);
  });
  
  // Uh, can I take your order?
  B.whenChoice("take order", () => {
    B.character(`customer`).say(`Oh, finally! Ha ha!`);
    B.character(`customer`).say(`I'll have a black coffee, please.`);
    B.player.say(`Uh, coming right up.`);
    B.character(`customer`).say(`Take your time!`);
    B.state.setFlag(`tookOrder`, true);
    B.dialog(`barista`).optionOff(`waiting customer`);
    B.dialog(`customer`).stop();
  });
  
  // Later, man.
  B.whenChoice("bye", () => {
    B.character(`customer`).say(`Have a nice day!`);
    B.dialog(`customer`).stop();
  });
});
