import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.whenEnterRoom(() => {
    B.character('jensen').hide();
  });
  
  B.whenEnterRoomAfterFade(() => {

    if (B.room.isFirstVisit) {
      B.sound.playMusic('trapped');
      B.sound.playMusic('trapped');
      B.say`
      Hank: JENSEN? WHAT THE HECK, MAN?
      Hank: LET ME OUT!
      Jensen: I'm sorry, Hank.
      Jensen: But I can't let you stop me now.
      Jensen: With the Timeonium you brought me, I can finally finish what we started ten years ago.
      Jensen: I'm going back.
      Jensen: I'm going to stop AI before any of this ever happens.
      Hank: WHAT?!
      Hank: But that's my way home!
      Hank: I thought we were friends!
      `
      B.wait(1);
      B.say`Jensen: You really need to get better at reading people.`
      B.wait(.5);
      B.player.face('D');
      B.say`
      Hank: That jerk!
      Hank: I have to get out of here.
      Hank: And I have to stop him before he finishes that machine.
      `
    }
  });

  B.whenLookAt('door', () => {
    B.faceClicked();
    B.say`Hank: Ugh, locked.`
  });

  B.whenUse('door', () => {
    if (B.state.getFlag('escaped closet')){
      B.walkToClicked();
      B.state.setFlag('left closet again',true);
      B.room.changeTo('lab');
    } else {
      B.faceClicked();
      B.say`Hank: Ugh, locked.`
    }
  });

  B.whenTalkTo('door', () => {
    B.faceClicked();
    B.say`
    Hank: JENSEN! LET ME OUT!
    Jensen: I'm ignoring you...
    `
  });

  B.whenLookAt('mop', () => {
    B.faceClicked();
    B.say`Hank: A mop.`
  });

  B.whenPickUp('mop', () => {
    B.walkToClicked();
    B.character('hank').playAnimation('ReachR');
    B.prop('mop').hide();
    B.sound.play('whip');
    B.inventory.add('mop');
    B.say`Hank: A janitor's work is never done.`
  });

  B.whenLookAt('electricalBox', () => {
    B.walkToClicked();
    B.player.face('L');
    if (B.prop('electricalBox').animation === 'electricalBox') {
      B.say`
      Hank: There's a label on here. "Electrical Lock Control"
      HANK: Well, that seems unusually relevant.
      HANK: It's screwed shut.
      `
    } else {
      B.say`
      Hank: The cover is off. There are some wires in there.
      HANK: I might be able to short it out with something metal.
      `
    }
    
  });

  B.whenUse('electricalBox', () => {
    B.walkToClicked();
    B.player.face('L');
    if (B.prop('electricalBox').animation === 'electricalBox') {
      B.say`
      Hank: I can't get this cover off with my bare hands.
      HANK: It's screwed shut.
      `
    } else {
      B.say`
      Hank: I need something besides my bare hands!
      `
    }
  });
  B.whenInventoryUsedOn('electricalBox', (payload) => {
    if (payload.itemId === 'coin') {
      B.walkToClicked();
      B.player.face('L');
      if (B.prop('electricalBox').animation === 'electricalBox') {
        B.say`HANK: Close enough to a screwdriver.`
        B.character('hank').playAnimation('ReachL');
        B.wait(.66);
        B.prop('electricalBox').animation = 'electricalBox-open';
        B.say`HANK: There we go!`
      } else {
        B.say`HANK: Let's see if this works...`
        B.inventory.remove('coin');
        B.character('hank').playAnimation('ReachL');
        B.wait(.66);
        B.sound.play('click');
        B.say`
        HANK: Got it!
        `
        B.player.walkTo('door');
        B.say`
        Hank: It's go time.
        `
        B.state.setFlag('escaped closet',true);
        B.room.changeTo('lab');
      }

      return;
    }
    // No branch matched → global B.whenInventoryOnVerbTargetUnhandled (see globalScript.ts).
    return false;
  });

  B.whenLookAt('shelves', () => {
    B.faceClicked();
    B.say`
    Hank: There's so much JUNK in here!
    Hank: Who is responsible for cleaning up this place?
    `
  });

  const rummage = () => {
    B.walkToClicked();
    if ( B.state.getFlag('escaped closet') || B.inventory.has('coin') ) {
      B.say`Hank: There's nothing else useful in there.`
    } else {
      B.say`Hank: Let's see...`
      B.character('hank').playAnimation('ReachR');
      B.wait(.75);
      B.say`
      HANK: A washer. Some batteries. Half a roll of tape...
      HANK: Oh, hey. A dime.
      `
      B.sound.play('whip');
      B.inventory.add('coin');
    }
  };

  B.whenPickUp('shelves', rummage);
  B.whenVerb('clean', 'shelves', rummage);
});
