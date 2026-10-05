import { registerDialogScript } from '@engine/scripting';

registerDialogScript('driver', ({ B }) => {

  // If I fix your battery, can I have the power regulator?
  B.whenChoice("fix battery", () => {
    B.character(`driver`).say(`Sure. I guess.`);
    B.character(`driver`).say(`But only if it works!`);
    B.state.setFlag(`askedAboutBattery`,true);
  });

  // Do you have a 10mm socket wrench?
  B.whenChoice("wrench", () => {
    B.character(`driver`).say(`Yeah. I think it fell under my tool chest over there.`);
    B.player.say(`Oh great.`);
    B.state.setFlag(`askedAboutWrench`,true);
  });

  // Hello good sir!
  B.whenChoice("greet driver", () => {
    B.character(`driver`).say(`You here to drive a car?`);
    B.player.say(`Huh?`);
    B.character(`driver`).say(`Damn robots takin' all our cars away.`);
    B.character(`driver`).say(`Not if I have something to say about it!`);
    B.dialog(`driver`).optionOff(`greet driver`);
    B.dialog(`driver`).optionOn(`cant drive`);
  });

  // The AI in the future doesn't let you drive?
  B.whenChoice("cant drive", () => {
    B.character(`driver`).say(`Well. I mean. Not exactly.`);
    B.character(`driver`).say(`We can still drive...`);
    B.character(`driver`).say(`but nobody does anymore!`);
    B.character(`driver`).say(`People just let the AI drive them around.`);
    B.character(`driver`).say(`But not ME! NO SIR!`);
    B.character(`driver`).say(`Do you want to join my club?`);
    B.character(`driver`).say(`It's called the Human Driver's Club!`);
    B.wait(1);
    B.player.say(`Um, maybe later.`);
    B.dialog(`driver`).optionOff(`cant drive`);
  });

  // That's a nice car you've got there.
  B.whenChoice("nice car", () => {
    B.character(`driver`).say(`That, my friend, is a 2001 Ford Focus.`);
    B.character(`driver`).say(`Manual steering. Manual brakes. Manual windows.`);
    B.character(`driver`).say(`Four cylinders. Front-wheel drive.`);
    B.character(`driver`).say(`Two-liter Zetec. Dual overhead cams. Sixteen valves.`);
    B.character(`driver`).say(`One hundred and thirty horses under the hood. Zero to sixty in 9.1 seconds.`);
    B.character(`driver`).say(`They don't make 'em like this anymore.`);
    B.player.say(`*whistle*`);
    B.player.say(`Does it run?`);
    B.character(`driver`).say(`No.`);
    B.dialog(`driver`).optionOn(`why car broke`);
  });
  
  // Why doesn't it run?
  B.whenChoice("why car broke", () => {
    B.character(`driver`).say(`It's the darndest thing. I don't know!`);
    B.character(`driver`).say(`I've been through every inch of this engine. I can't figure it out.`);
    B.character(`driver`).say(`But as soon as I get this running, I am hitting the open road!`);
  });

  // Never mind. I'll see you later.
  B.whenChoice("nevermind", () => {
    B.character(`driver`).say(`*grunt*`);
    B.dialog(`driver`).stop();
  });

});
