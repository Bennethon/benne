import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.playFrom('fix battery', () => {
    B.state.setFlag(`askedAboutBattery`, true);
    B.state.setFlag(`batteryClean`, true);
    B.inventory.add('wrench');
    B.hotspot('club-hotspot-battery').active = true;
  });

  B.whenLookAt('driver', () => {
    B.faceClicked();
    B.player.say(`He looks grizzly.`);
  });

  B.whenTalkTo('driver', () => {
    B.walkToClicked();
    B.dialog(`driver`).start();
  });
  
  B.whenLookAt('club-hotspot-battery', () => {
    B.walkToClicked();
    if (B.state.getFlag(`batteryClean`)) {
      B.player.say(`I cleaned off the corrosion. Now to fix the loose cable.`);
      B.player.say(`I need a 10mm socket wrench.`);
      B.dialog(`driver`).optionOn(`wrench`);
    } else {
      B.player.say(`Hmm...`);
      B.player.say(`It looks like one terminal is horribly corroded and the cable is loose.`);
      B.character(`driver`).say(`Huh?!`);
      B.dialog(`driver`).optionOn(`fix battery`);
    }
  });

  B.whenVerb('clean', 'club-hotspot-battery', () => {
    if (B.state.getFlag(`askedAboutBattery`)) {
      B.walkToClicked();
      if (B.state.getFlag(`batteryClean`)) {
        B.player.say(`It's already clean.`);
      } else {
        B.player.say(`I don't think my raw cleaning abilities will work here.`);
        B.player.say(`I need something with more punch.`);
      }
    } else {
      B.faceClicked();
      B.player.say(`Why would I do that?`);
    }
  });

  B.whenLookAt('antenna', () => {
    B.faceClicked();
    B.player.say(`A broken off car antenna.`);
  });

  B.whenPickUp('antenna', () => {
    B.walkToClicked();
    B.character('hank').playAnimation('ReachR');
    B.prop(`antenna`).hide();
    B.sound.play('whip');
    B.inventory.add(`antenna`);
  });

  B.whenLookAt('regulator', () => {
    B.walkToClicked();
    B.player.say(`That's a high tech thing.`);
    B.character(`driver`).say(`That's my ol' power regulator I got from the college over there.`);
    B.character(`driver`).say(`I was havin' trouble with my battery, so I thought this might help.`);
    B.player.say(`Is it helping?`);
    B.character(`driver`).say(`I can't tell.`);
    B.hotspot(`club-hotspot-battery`).active = true;
  });

  B.whenPickUp('regulator', () => {
    B.walkToClicked();
    B.character(`driver`).say(`Hey! Don't touch that!`);
    B.player.say(`Why?`);
    B.character(`driver`).say(`I need it!`);
    B.player.say(`Why?`);
    B.character(`driver`).say(`I don't know.`);
  });

  B.whenInventoryUsedOn('club-hotspot-battery', (payload) => {
    if (B.state.getFlag(`askedAboutBattery`)) {
      if (payload.itemId === `soda`) {
        B.walkToClicked();
        B.player.say(`I hope this works.`);
        B.inventory.remove(`soda`);
        B.sound.play('sodaPour');
        B.wait(.75);
        B.player.say(`Hey! The corrosion is gone.`);
        B.player.say(`Now I need to tighten that cable.`);
        B.player.say(`Just need a 10mm socket wrench.`);
        B.dialog(`driver`).optionOn(`wrench`);
        B.state.setFlag(`batteryClean`, true);
        return;
      } 
    }

    if (B.state.getFlag(`askedAboutBattery`) && B.state.getFlag(`batteryClean`)) {
      if (payload.itemId === `wrench`) {
        B.walkToClicked();
        B.player.say(`Ok I'll tighten 'er up here.`);
        B.inventory.remove(`wrench`);
        B.sound.play('tightening');
        B.wait(.75);
        B.player.say(`Done!`);
        B.state.setFlag(`batteryFixed`, true);
        B.player.say(`Hey man. I fixed your battery.`);
        B.character(`driver`).say(`Well darn tootin'. It looks like you did!`);
        B.character(`driver`).say(`Thanks son! I don't need that power regulator anymore.`);
        B.character(`driver`).say(`You can have it.`);
        B.prop(`regulator`).hide();
        B.sound.play('whip');
        B.inventory.add(`regulator`);
        B.player.say(`Thanks!`);
        B.state.setFlag('gotRegulator',true);
        B.dialog('jensen-in-plaza').optionOn('found regulator');

        B.sound.play('hoodClose');
        B.prop(`car`).animation = `car-fixed`;
        B.character(`driver`).say(`Now stand back. I'm gonna fire her up, and show this AI who can drive!`);
        B.fadeOut();
        B.player.moveTo(`club-point-standBack`);
        B.player.face('D');
        B.character(`driver`).hide();
        B.prop(`car`).hide();
        B.sound.play('crash');
        B.prop(`crash`).animation = `crash-play`;
        B.fadeIn();
        B.wait(2);
        B.player.say(`Ahh!`);
        B.player.walkTo(`club-point-walkout`);
        return;
      } 
    }
    
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenLookAt('club-hotspot-toolChest', () => {
    B.faceClicked();
    if (B.state.getFlag(`askedAboutWrench`)) {
      B.player.say(`Apparently the 10mm socket wrench fell under there.`);
    } else {
      B.player.say(`Nice tool chest.`);
    }
  });

  B.whenVerb('move', 'club-hotspot-toolChest', () => {
    if (B.state.getFlag(`askedAboutWrench`)) {
      B.walkToClicked();
      // TODO: play grunting sound
      B.wait(.5);
      B.player.say(`Ugh, it's too heavy to move.`);
    } else {
      B.faceClicked();
      B.player.say(`I don't need to move it.`);
    }
  });

  B.whenInventoryUsedOn('club-hotspot-toolChest', (payload) => {
    if (payload.itemId === 'magnetStick') {

      if (B.state.getFlag(`askedAboutWrench`)) {
        B.walkToClicked();
        B.sound.play('metalScrape');
        B.wait(.5);
        B.inventory.remove(`magnetStick`);
        B.sound.play('whip');
        B.inventory.add(`wrench`);
        B.player.say(`Ah, got it!`);
      } else {
        B.faceClicked();
        B.player.say(`Why would I do that?`);
      }
      return;
    }
    if (payload.itemId === 'antenna') {

      if (B.state.getFlag(`askedAboutWrench`)) {
        B.walkToClicked();
        B.sound.play('metalScrape');
        B.wait(.5);
        B.player.say(`Hmm. The antenna alone can't fish out the wrench.`);
      } else {
        B.faceClicked();
        B.player.say(`Why would I do that?`);
      }
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.region("club-region-leave").whenEnter(() => {
    B.room.changeTo(`plaza`);
  });

  B.whenUse('club-hotspot-toolChest', () => {
    B.faceClicked();
    B.player.say(`Not without asking.`);
  });

  B.whenLookAt('outside', () => {
    B.faceClicked();
    B.say`Hank: Nice day.`
  });

  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('garage');
  });
});
