import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.playFrom('talkedToJensen', () => {
    B.state.setVisitCount(3);
    B.state.setFlag(`jensenCrying`, false);
    B.state.setFlag(`jensenBlockingDoor`, false);
    B.state.setFlag('got mission', true);
    B.inventory.add('timeonium');
  });

  B.playFrom('fromPlaza', () => {
    B.state.setVisitCount(2);
    B.state.setLastRoom('plaza');
  });

  B.whenEnterRoom(() => {
    if (B.room.isFirstVisit) {
      B.state.setFlag(`jensenBlockingDoor`,true);
      B.character('jensen').show();
    } else if (B.state.getLastRoom() == 'plaza') {
      B.sound.playMusic('lab');
      B.character('jensen').hide();
      B.state.setFlag(`jensenCrying`,false);
      B.state.setFlag(`jensenBlockingDoor`,false);
      B.player.moveTo('enter-from-plaza');
      B.player.face('D');
    }

    if (!B.state.getFlag('left MIT first time')) {
      B.character('jensen').show();
    }
  });

  B.whenEnterRoomAfterFade(() => {

    if (B.room.isFirstVisit) {
      B.character(`jensen`).say(`*mumble* ... *grumble*`);
      B.character(`jensen`).say(`AI ... *grumble*`);
      B.character(`jensen`).say(`kill us all...`);
    }

  });
  
  B.whenLookAt('jensen', () => {
    B.faceClicked();
    B.say`Hank: He looks agitated.`
  });

  B.whenTalkTo('jensen', () => {
    B.player.walkTo(`hallway-point-1`);
    B.player.face(`L`);
    B.player.say(`Hey buddy!`)!
    if (B.state.getFlag(`jensenCrying`)) {
      B.character(`jensen`).say(`*SOB*`);
    } else if ( B.state.getFlag('got mission') ) {
      B.character(`jensen`).say(`What are you waiting for?`);
      B.character(`jensen`).say(`Let's go find those time machine parts!`);
    } else {
      B.character(`jensen`).face(`D`);
      if (!B.state.getFlag(`spokeWithJensenFirstTime`)) {
        B.character(`jensen`).say(`AHH!`);
      } else {
        B.character(`jensen`).say(`WHAT?!`);
      }
      B.dialog(`jensen-in-hallway`).start();
    }
  });

  B.whenUse('hallway-hotspot-exit', () => {
    if (B.state.getFlag(`jensenCrying`)) {
      B.walkToClicked();
      B.wait(1);
      B.player.face(`D`);
      B.player.say(`I feel bad leaving the smelly man crying.`);
      B.character('jensen').say(`*SOB*`);
    } else if (B.state.getFlag(`jensenBlockingDoor`)) {
      B.faceClicked();
      B.player.say(`I can't get past that smelly man.`);
    } else {
      B.walkToClicked();
      B.room.changeTo(`plaza`);
    }
  });

  B.whenInventoryUsedOn('jensen', (payload) => {
    if (payload.itemId === 'timeonium') {
      if (!B.state.getFlag(`jensenCrying`)) {
        B.faceClicked();
        B.player.say(`This stuff might be my ticket home. I don't want to just give it away!`)
      } else {
        B.player.walkTo(`hallway-point-1`);
        B.player.face(`L`);
        B.player.say(`Mr. Jensen? Is this that Timeonium stuff you were talking about?`);
        B.character('jensen').face(`R`);
        B.character('jensen').say(`*sniff* ...wha?`);
        B.wait(.75);
        B.character('jensen').say(`YES! YOU STILL HAVE IT!`);
        B.character('jensen').say(`This changes everything.`);
        B.character('jensen').say(`It looks like there's just enough for one more jump...`);
        B.character(`jensen`).face(`L`);
        B.character('jensen').say(`Yes... with this I can finally complete my mission!`);
        B.player.say(`Hey now, wait a minute! I need to use this to get back home.`);
        B.character(`jensen`).face(`R`);
        B.character('jensen').say(`WHAT? Fool! Don't you see this horrible future?`);
        B.character('jensen').say(`I need to go back in time and prevent AI from ever being invented!`);
        B.player.say(`I don't care. I want to go home. I'm not going to let you have it.`);
        B.character(`jensen`).face(`L`);
        B.character('jensen').say(`Idiot!`);
        B.character('jensen').say(`Unless...`);
        B.character(`jensen`).face(`R`);
        B.character('jensen').say(`Yes! Hank, I will help you.`);
        B.character('jensen').say(`The time machine can work again. It has just been stripped of a few essential parts over the years.`);
        B.character('jensen').say(`We need a temporal focusing lens,`);
        B.character('jensen').say(`a power regulator,`);
        B.character('jensen').say(`and a control relay.`);
        B.character('jensen').say(`Get those for me and we'll get you back to where you came from.`);
        B.character('jensen').say(`*heh heh*`);
        B.player.say(`Why can't you get them?`);
        B.character('jensen').say(`You want me to get the parts AND fix the time machine?`);
        B.character('jensen').say(`You have to put in some effort here, pal.`);
        B.character('jensen').say(`I'm sure you can scrounge up that stuff from somewhere nearby.`);
        B.state.setFlag(`jensenBlockingDoor`,false);
        B.state.setFlag(`jensenCrying`,false);
        B.state.setFlag('got mission', true);
      }
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenLookAt('hallway-hotspot-bulliten-board', () => {
    B.walkToClicked();
    B.say`Hank: Not a lot going on these days.`
  });

  B.whenLookAt('cleanBot', () => {
    B.faceClicked();
    B.say`Hank: Is that some kind of cleaning robot?`;
    B.say`Hank: It looks like it's doing a good job.`;
  });

  B.whenLookAt('door-to-lab', () => {
    B.faceClicked();
    B.say`Hank: That's the door back to the lab.`
  });

  B.whenUse('door-to-lab', () => {
    B.walkToClicked();
    B.room.changeTo('lab');
  });

  B.whenLookAt('hallway-hotspot-exit', () => {
    B.faceClicked();
    B.say`Hank: It's the door to the outside world!`
  });
});
