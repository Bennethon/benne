import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.whenLookAt('customer', () => {
    B.faceClicked();
    B.player.say(`He looks happy to be here.`);
  });

  B.whenLookAt('barista', () => {
    B.faceClicked();
    B.player.say(`Looks like the owner of the place.`);
    B.player.say(`He isn't doing much.`);
  });

  B.whenLookAt('dishes', () => {
    B.faceClicked();
    B.player.say(`Some previous customer's dishes.`);
    B.player.say(`It looks like no one is bussing this table.`);
    B.dialog(`barista`).optionOn(`dirty dishes`);
  });

  B.whenLookAt('relay', () => {
    B.faceClicked();
    B.player.say(`It looks like a fancy, high-tech gadget.`);
    B.dialog(`barista`).optionOn(`high tech thing`);
  });

  B.onProp('dishes', 'clean', () => {
    B.walkToClicked();
    if (!B.state.getFlag(`canWork`)) {
      B.player.say(`These need to be bussed, but it's not MY job.`);
      B.dialog(`barista`).optionOn(`dirty dishes`);
    } else {
      B.player.say(`I guess SOMEONE has to work around here.`);
      B.prop(`dishes`).hide();
      B.sound.play('whip');
      B.inventory.add(`coffee`);
      B.inventory.add(`soda`);
      B.dialog(`barista`).optionOff(`dirty dishes`);
    }
  });

  B.whenTalkTo('barista', () => {
    if (!B.inventory.has(`relay`)) {
      B.walkToClicked();
      B.dialog(`barista`).start();
    } else {
      B.player.say(`I don't want to talk to that guy anymore.`);
    }
  });

  B.whenTalkTo('customer', () => {
    if (!B.state.getFlag(`tookOrder`)) {
      B.walkToClicked();
      B.dialog(`customer`).start();
    } else if (!B.state.getFlag(`deliveredOrder`)) {
      B.faceClicked();
      B.player.say(`I already took his order.`);
    } else {
      B.faceClicked();
      B.player.say(`I'm gonna leave that guy alone now.`);
    }
  });

  B.whenLookAt('cafe-hotspot-window', () => {
    B.faceClicked();
    B.player.say(`It looks like some AI-run café across the way.`);
    B.player.say(`They seem to be doing good business.`);
  });

  B.whenLookAt('cafe-hotspot-coffeemaker', () => {
    B.faceClicked();
    B.player.say(`A fancy, industrial coffee maker.`);
    B.player.say(`It doesn't look like it gets used much.`);
  });


  B.whenInventoryUsedOn('cafe-hotspot-coffeemaker', (payload) => {
    if (payload.itemId === 'coffee') {
      B.walkToClicked();
      B.wait(1);
      B.sound.play('pourCoffee');
      B.inventory(`coffee`).animation = "coffee-full";
      B.player.say(`The best part of waking up!`);
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenInventoryUsedOn('customer', (payload) => {
    if (payload.itemId === 'coffee') {
      if (B.state.getFlag(`tookOrder`)) {
        if (B.inventory(`coffee`).animation === `coffee-full`) {
          // full cup
          B.walkToClicked();
          B.player.say(`Here you are, sir.`);
          B.inventory.remove(`coffee`);
          B.character(`customer`).say(`I ordered decaf.`);
          B.player.say(`You said black.`);
          B.character(`customer`).say(`Black decaf.`);
          B.player.say(`You left out a pretty important word.`);
          B.character(`customer`).say(`Oh, this is fantastic.`);
          B.player.say(`What?`);
          B.character(`customer`).say(`The misunderstanding. The mild resentment. This is exactly like 2024!`);
          B.state.setFlag(`deliveredOrder`,true);
          B.dialog(`barista`).optionOn(`helped`);
          B.dialog(`barista`).optionOff(`waiting customer`);
        } else {
          B.faceClicked();
          B.player.say(`I'm not going to serve him an empty cup.`);
        }
      } else {
        B.faceClicked();
        B.player.say(`Why would I give him that?`);
      }
      
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenLookAt('cafe-hotspot-door', () => {
    B.faceClicked();
    B.player.say(`The door out.`);
  });

  B.whenUse('cafe-hotspot-door', () => {
    B.walkToClicked();
    B.sound.play('doorBells');
    B.room.changeTo(`plaza`);
  });

  B.whenLookAt('menu', () => {
    B.walkToClicked();
    B.say`Hank: The menu looks... meh.`
  });

  B.whenPickUp('relay', () => {
    B.walkToClicked();
    B.say`Hank: I can't reach it.`
  });

  const notMyJob = () => {
    B.faceClicked();
    B.say`Hank: I'm not on the job here.`
  };
  B.whenUse('cleaning-stuff', notMyJob);
  B.whenPickUp('cleaning-stuff', notMyJob);
  B.whenVerb('clean', 'cleaning-stuff', notMyJob);


  B.whenLookAt('cleaning-stuff', () => {
    B.faceClicked();
    B.say`Hank: These don't look like they get much use.`
  });

  B.whenEnterRoomAfterFade(() => {
    B.sound.play('doorBells');
    B.sound.playMusic('cafe');
  });
});
