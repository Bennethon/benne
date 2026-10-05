import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.playFrom('ending', () => {
    B.state.setFlag('escaped closet',true);
  });

  B.whenEnterRoom(() => {
    if (B.state.getFlag('escaped closet')) {
      // GAME END
      B.character('hank').show();
      B.prop('timeonium').hide();
      B.prop('banana').hide();
      B.prop(`cord`).animation = `cord`;
      B.character(`botti3-27`).face(`D`);
      B.character('hank').moveTo('lab27-point-ending-startWalk');
      B.character('hank').face('L');
      B.camera.zoomTo('lab27-point-ending-zoom',1,0);
      B.region('bananaGuard').active = false;
      B.gui('verbs').hide();
    }
  });

  B.whenEnterRoomAfterFade(() => {
    if (B.state.getFlag('escaped closet')) {

      // GAME END
      B.player.walkTo('banana');
      B.player.face('U');
      B.say`Hank: *sigh*`;

      // Plug in BOTT-i3
      B.player.walkTo('lab27-point-ending-stopWalk');
      B.player.say(`Oh how did this get unplugged again?`);
      B.player.walkTo(`walk-cord`);
      B.player.face(`U`);
      B.wait(.5);
      B.character('hank').playAnimation('ReachU');
      B.prop(`cord`).animation = `cord-plugged`;
      B.player.say(`There we go.`);
      B.wait(.5);
      B.character(`botti3-27`).face(`R`);
      B.character(`botti3-27`).say(`Thanks Hank!`);
      B.player.say(`No problem, BOTT-i3!`);
      B.player.walkTo('lab27-hotspot-door');
      B.fadeOut(1.5);
      B.wait(.33);
      B.say`Scientists: Hey! Where's the Timeonium?`
      B.room.changeTo('credits');

    } else {

      // GAME START
      B.player.walkTo('walk-in');
      B.player.say(`Hey guys. Working late?`);
      B.wait(.5);
      B.character('scientists').say(`*grunt*`);
      B.wait(.75);
      B.player.say(`Welp! I'll be out of your hair in a second.`);
      B.wait(.5);
      B.character('scientists').say(`Jensen, hold still!`);
      B.wait(.25);
      B.character('scientists').say(`We're not done calibrating the sensors.`);
      B.wait(.5);
    }
  });

  B.whenLookAt('banana', () => {
    B.faceClicked();
    B.player.say(`Ugh, these scientists are slobs.`);
  });

  const bananaTakeOrClean = () => {
    B.walkToClicked();
  };

  B.onProp('banana', 'clean', bananaTakeOrClean);
  B.whenPickUp('banana', bananaTakeOrClean);

  B.region("bananaGuard").whenEnter((ctx) => {
    if (!ctx.isPlayer) return;

    if (!B.state.getFlag(`firstBanana`)) {
      B.player.moveTo.now({ x: ctx.feetX, y: ctx.feetY });
      B.player.stopAnimation();
      B.character('scientists').say(`HEY BUDDY! CAN YOU GIVE US A HAND?`);
      B.player.face(`U`);
      B.player.say(`Yeah, what's up?`);
      B.character('scientists').say(`Go grab the Timeonium canister from the desk over there.`);
      B.character('scientists').say(`We're almost done here and we need it to power the machine.`);
      B.player.say(`Uh, ok.`);
      B.state.setFlag('firstBanana', true);
      B.state.setFlag('scientistRequest', true);
      B.player.walkTo(`walk-back`);
    } else {
      B.player.moveTo.now({ x: ctx.feetX, y: ctx.feetY });
      B.player.stopAnimation();
      B.character('scientists').say(`HEY MAN! HOW ABOUT THAT CANISTER?`);
      B.player.face(`U`);
      B.player.say(`Oh yeah.`);
      B.player.walkTo(`walk-back`);
    }
    
  });

  B.whenLookAt('timeonium', () => {
    B.faceClicked();
    B.player.say(`It's a high tech canister of some blue stuff.`);
  });

  B.whenPickUp('timeonium', () => {
    if ( !B.state.getFlag('scientistRequest') ) {
      B.faceClicked();
      B.player.say(`I don't know what I'd do with that.`);
    }
    else {
      B.walkToClicked();

      B.disableUserInput = true;
      B.wait(1);
      
      // Pick up the Timeonium
      B.player.face(`R`);
      B.player.say(`HEY GUYS! WHERE DO YOU WANT THIS?`);
      B.character(`scientists`).say(`PUT IT OVER BY THE TIME CHAMBER.`);
      B.player.say(`k`);
      B.player.face(`L`);
      B.character('hank').playAnimation('ReachL');
      B.prop(`timeonium`).hide();
      B.sound.play('whip');
      B.inventory.add(`timeonium`);
      
      // Plug in BOTT-i3
      B.wait(.5);
      B.player.say(`Oh, huh. Did I unplug this?`);
      B.player.walkTo(`walk-cord`);
      B.player.face(`U`);
      B.wait(.5);
      B.character('hank').playAnimation('ReachU');
      B.prop(`cord`).animation = `cord-plugged`;
      B.player.say(`There we go.`);
      B.wait(.5);
      B.character(`botti3-27`).face(`R`);
      B.character(`botti3-27`).say(`Thanks!`);
      B.player.say(`Uh, you're welcome.`);

      // Slip on peel
      B.region(`bananaGuard`).active = false;
      B.player.walkTo(`banana`);
      B.cutscene(() => {
        B.sound.stopMusic();
        B.sound.playMusic('slip', { loop: false });
        B.character('hank').hide();
        B.prop(`banana`).hide();
        B.character(`scientists`).face(`R`);
        B.camera.zoomTo.now(`camera-pan`,1, 2);
        B.prop('slip').show();
        B.sound.play('timeTravel');
        B.prop('slip').playAnimation('slip');
        B.prop(`time-travel-final`).show();
        B.prop('slip').hide();
        B.character(`scientists`).say(`WHAT THE-`);
        B.fadeOut(2, 0xffffff);
        B.disableUserInput = false;
        B.cutscene(() => {
          B.room.changeTo.now('lab');
        });    
      });
    }
  });

  B.whenLookAt('botti3-27', () => {
    B.faceClicked();
    B.player.say(`Looks like some sort of computer box.`);
  });

  B.whenUse('botti3-27', () => {
    B.faceClicked();
    B.player.say(`I'm not into computers.`);
  });


  B.whenLookAt('lab27-hotspot-door', () => {
    B.faceClicked();
    B.player.say(`The door back to the hallway.`);
  });

  B.whenUse('lab27-hotspot-door', () => {
    B.faceClicked();
    B.player.say(`I'm done cleaning out there. I need to finish in here.`);
  });
});
