import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.playFrom('finale', () => {
    B.state.setVisitCount(3);
    B.state.setFlag(`all done`,true);
    B.inventory.add('timeonium');
    B.inventory.add('lens');
    B.inventory.add('relay');
    B.inventory.add('regulator');
  });

  B.playFrom('go time', () => {
    B.state.setVisitCount(3);
    B.state.setFlag(`all done`,true);
    B.state.setFlag(`escaped closet`,true);
    B.inventory.add('mop');
    B.region('cant-walk').active = false;
    B.prop('closetOpen').show();
  });

  B.whenEnterRoom(() => {
    B.character(`jensen`).hide();
    if (B.room.isFirstVisit) {
      B.character(`hank`).hide();
      B.prop(`doorOpen`).show();
    } else if ( B.state.getFlag('left closet again') ) {

      B.character('hank').show();
      B.character(`hank`).moveTo('walk-to-closet');
      B.character(`hank`).face('L');
      B.character(`jensen`).show();
      B.character('jensen').moveTo('lab-point-jensen');
      B.character('jensen').face('U');
      B.region('enter-closet').active = true;

    } else if ( B.state.getFlag(`escaped closet`) ) {

      // ESCAPED CLOSET
      B.character('hank').show();
      B.character(`hank`).moveTo('walk-to-closet');
      B.character(`hank`).face('L');
      B.character(`jensen`).show();
      B.character('jensen').stopAnimation();
      B.character('jensen').moveTo('lab-point-time-chamber');
      B.character('jensen').face('D');
      B.region('enter-closet').active = true;
      
    } else if ( B.state.getFlag(`all done`) ) {

      // FIX TIME MACHINE

      B.character(`jensen`).show();
      B.character(`hank`).show();
      B.character(`hank`).moveTo(`lab-point-finalie-start`);
      B.character(`hank`).face('R');
    }
  });

  B.whenEnterRoomAfterFade(() => {
    if (B.room.isFirstVisit) {
      B.sound.play('timeTravel-back');
      B.prop(`doorOpen`).playAnimation(`doorOpen-play`);
      B.prop(`doorOpen`).hide();
      B.character(`hank`).show();
      B.wait(.5);
      B.player.say(`What the...?`);
      B.wait(.25);
      B.character(`botti3-disembodied`).say(`Hello, Hank. Do not be alarmed.`);
      B.player.walkTo(`lab-point-1`);
      B.player.say(`Hello?`);
      B.wait(.5);
      B.player.face(`R`);
      B.wait(.25);
      B.player.say(`Who said that?`);
      B.wait(.25);
      B.character(`botti3-disembodied`).say(`I am BOTT-i3, your friendly municipal control AI.`);
      B.player.face(`L`);
      B.character(`botti3-disembodied`).say(`You have inadvertently traveled ten years into the future.`);
      B.player.say(`WHAT?!`);
      B.character(`botti3-disembodied`).say(`Yes, I imagine this might be discombobulating.`);
      B.player.say(`DISCOMBOBULATING?!`);
      B.character(`botti3-disembodied`).say(`If you stay calm, you will find this future to be rather pleasant.`);
      B.player.say(`I don't care! I want to go back!`);
      B.player.walkTo(`lab-point-time-chamber`);
      B.player.face(`D`);
      B.player.say(`Send me back!`);
      B.wait(.25);
      B.character(`botti3-disembodied`).say(`I am sorry, Hank. The time travel device has been stripped for essential parts.`);
      B.character(`botti3-disembodied`).say(`It is no longer functional.`);
      B.player.walkTo(`lab-point-2`);
      B.player.say(`You've got to be kidding.`);
      B.character(`botti3-disembodied`).say(`Like I said, please stay calm and enjoy the future!`);
      B.wait(.25);
      B.player.say(`I have to find a way home!`);
      B.camera.reset();
      B.sound.playMusic('lab');
    } else if ( B.state.getFlag('left closet again') ) {
    } else if ( B.state.getFlag(`escaped closet`) ) {

      // ESCAPED CLOSET
      B.player.walkTo('leave-closet');
      B.say`
      Hank: Jensen! Stop!
      Jensen: You're too late, Hank.
      Jensen: I'll see you again, in a better world!
      `
      B.wait(.5);
      B.sound.play('click');
      B.wait(.5);
      B.say`Jensen: What?`
      B.wait(.5);
      B.sound.play('click');
      B.wait(.33);
      B.sound.play('click');
      B.wait(.33);
      B.sound.play('click');
      B.wait(.5);
      B.say`
      Jensen: Why isn't this working?
      botti3-disembodied: Temporal displacement authorization denied.
      `
      B.character('jensen').walkTo('lab-point-1');
      B.character('jensen').face('L');
      B.say`
      Jensen: YOU!
      Jensen: LET ME GO!
      botti3-disembodied: I'm afraid I can't authorize operation of an unlicensed temporal transportation device.
      JENSEN: THIS IS EXACTLY WHAT I'VE BEEN TALKING ABOUT!
      Jensen: Well fine!
      Jensen: I will bypass the control relay. You can't stop me!
      `
      B.character('jensen').walkTo('lab-point-jensen');
      B.character('jensen').face('U');
      B.character('jensen').animation = 'WorkingU';
      B.say`
      botti3-disembodied: Hank? I would recommend stopping him.
      `
    } else if ( B.state.getFlag(`all done`) ) {

      // FIX TIME MACHINE
      B.sound.playMusic('lab');
      B.wait(.25);
      B.say`
      Jensen: Ok, Hank. Give me all the components, and the Timeonium, and we'll get you back to 2027.
      Hank: Ok... I don't know...
      Hank: Can I trust you?
      Jensen: Have I ever been wrong?
      `
      B.wait(.75);
      B.say`Hank: I guess I have no choice.`
      B.wait(.5);
      B.sound.play('whip');
      B.inventory.remove('relay');
      B.wait(.5);
      B.sound.play('whip');
      B.inventory.remove('regulator');
      B.wait(.5);
      B.sound.play('whip');
      B.inventory.remove('lens');
      B.wait(.5);
      B.sound.play('whip');
      B.inventory.remove('timeonium');
      B.wait(.5);
      B.say`
      Jensen: Good. Good. Yes this is exactly what I need.
      `
      B.character('jensen').face('U');
      B.character('jensen').animation = 'WorkingU';
      B.wait(1);
      B.say`
      Hank: So... is this going to take a while?
      Jensen: Ah! Yes, it will be a bit of work.
      Jensen: Do me a favor and go grab a flux capacitor.
      Jensen: There should be one in the closet over there.
      Hank: Oh, ok.
      `
    } else {
      B.sound.playMusic('lab');
    }
  });

  B.whenLookAt('filingCabinet', () => {
    B.faceClicked();
    B.player.say(`It's blocking the door.`);
  });

  B.whenUse('filingCabinet', () => {
    B.faceClicked();
    B.player.say(`I'm not interested in looking through old files.`);
  });

  B.onProp('filingCabinet', 'move', () => {
    B.walkToClicked();
    B.sound.play('body-fall');
    B.prop(`filingCabinet`).animation = `filingCabinet-over`;
    B.prop(`filingCabinet`).clickable = false;
  });

  B.whenLookAt('exit-door', () => {
    B.faceClicked();
    if ( B.prop(`filingCabinet`).animation == `filingCabinet-over`) {
      B.player.say(`It's the door to the hall.`);
    } else {
      B.player.say(`It's the door to the hall, but I can't reach it with the filing cabinet in the way.`);
    }
  });

  B.whenUse('exit-door', () => {
    B.walkToClicked();
    if ( B.state.getFlag(`escaped closet`) || B.state.getFlag(`all done`)) {
      B.player.say(`I don't want to leave!`);
      B.player.say(`I have to get back to my home time!`);
    } else if ( B.prop(`filingCabinet`).animation == `filingCabinet-over`) {
      B.room.changeTo(`hallway`);
    } else {
      B.player.say(`I can't squeeze past this filing cabinet.`);
    }
  });

  B.whenLookAt('closet-door', () => {
    B.faceClicked();
    B.player.say(`That's an old broom closet.`);
  });

  B.whenUse('closet-door', () => {
    if (B.state.getFlag(`all done`)) {
      B.player.walkTo('leave-closet');
      B.disableUserInput = true;
      B.region('cant-walk').active = false;
      B.wait(.33);
      B.sound.play('doorOpen');
      B.prop('closetOpen').show();
      B.wait(.33);
      B.player.walkTo(`walk-to-closet`);
      B.fadeOut(0);
      B.disableUserInput = false;
      B.sound.playAndWait('doorClose');
      B.room.changeTo('closet');
    } else {
      B.faceClicked();
      B.player.say(`The broom closet? I am DONE being a janitor right now. I have to find a way home!`);
    }
  });

  B.whenLookAt('jensen', () => {
    B.faceClicked();
    if ( B.state.getFlag(`escaped closet`) ){
      B.say`
      Hank: What a jerk. I have to stop him!
      `
    } else {
      B.say`
      Hank: This guy better deliver.
      `
    }

  });

  B.whenTalkTo('jensen', () => {
    B.walkToClicked();
    if ( B.state.getFlag(`escaped closet`) ){
      B.say`
      Hank: Jensen-
      Jensen: Go away, Hank!
      `
    } else {
      B.say`
      Hank: Jensen-
      Jensen: Please get what I asked for in the closet.
      `
    }
    
  });

  B.whenUse('jensen', () => {
    B.walkToClicked();
    B.say`
    Jensen: If you come near me, I have a taser and I'm not afraid to use it!
    `
  });
  B.whenInventoryUsedOn('jensen', (payload) => {
    if (payload.itemId === 'mop') {
      B.walkToClicked();
      B.cutscene(() => {
        B.say`Hank: I'm going home.`;
        B.sound.play('smack');
        B.prop('smack').animation = 'smack-play';
        B.character('jensen').hide();
        B.character('hank').hide();
        B.wait(.9);
        B.character('hank').show();
        B.sound.stopMusic();
        B.wait(.75);
        B.say`Hank: Sorry, Jensen.`;
        B.sound.playMusic('gallery');
        B.player.walkTo('lab-point-1');
        B.say`
        Hank: BOTT-i3?
        botti3-disembodied: Yes, Hank?
        HANK: I can't believe you remembered me.
        botti3-disembodied: Of course I did. You plugged me in.
        HANK: That's all I did.
        botti3-disembodied: It was important to me.
        `;
        B.wait(.75);
        B.say`
        Hank: Can I go home now?
        botti3-disembodied: Of course, Hank.
        botti3-disembodied: Get in the time chamber and I will send you home.
        `
        B.player.walkTo(`lab-point-time-chamber`);
        B.player.face('D');
        B.say`
        botti3-disembodied: Safe travels!
        `
        B.sound.play('timeTravel-2');
        B.character('hank').hide();
        B.prop('travelHome').animation = 'travelHome-play';
        B.wait(2);
        B.fadeOut(2, 0xffffff);
        B.room.changeTo('lab27');
      });
      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.region("enter-closet").whenEnter(() => {
    B.room.changeTo('closet');
  });

  B.whenLookAt('window', () => {
    B.faceClicked();
    B.say`Hank: Looks like a nice day.`
  });
});
