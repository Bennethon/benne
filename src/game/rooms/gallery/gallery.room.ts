import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.whenVerb('clean', 'gallery-hotspot-paint-spill', () => {
    B.walkToClicked();
    if (B.state.getFlag('canTakeLens')) {
      B.player.say(`I had better not touch it again.`);
    } else if (!B.state.getFlag(`canCleanPaint`)) {
      B.player.say(`Every janitorial bone in my body wants to clean this.`);
      B.player.face('D');
      B.player.say(`But I'm a guest here. I shouldn't touch it without being told.`);
    } else {
      B.player.say(`Well, she wants to see humans be productive.`);
      B.player.say(`The least I can do is clean this up for her.`);
      B.character('hank').hide();
      B.sound.play('cleaningPaint');
      B.prop('mopping').animation = 'mopping-action'; // after hide; does not wait for the clip
      B.wait(1);
      B.character(`curator`).face(`L`);
      B.character('curator').say('WHAT ARE YOU DOING?!');
      B.wait(.5);
      B.character('hank').face('D');
      B.character('hank').show();
      B.prop('mopping').animation = 'mopping-end';
      B.player.face('R');
      B.player.say(`I...`);
      B.player.face('L');
      B.wait(.5);
      B.player.face('R');
      B.player.say(`I was just trying to clean this paint and-`);
      B.player.face('L');
      B.wait(.5);
      B.player.face('R');
      B.player.say(`you startled me and-`);
      B.character('curator').say('STOP!');
      B.character('curator').say('What have you done?');
      B.player.face('L');
      B.wait(1);
      B.character('curator').say('I LOVE IT!');
      B.character('curator').say(`It's so raw... so energetic... so...`);
      B.character('curator').say(`HUMAN.`);
      B.character('curator').say(`This is the first piece of human created art in years!`);
      B.character('curator').say(`This changes everything!`);
      B.character('curator').say(`Take the lens, I don't care anymore!`);
      B.player.face('R');
      B.player.say(`Thanks!`);
      B.dialog(`curator`).optionOff(`can have lens`);
      B.dialog(`curator`).optionOff(`paint spill`);
      B.dialog(`curator`).optionOff(`greet curator`);
      B.dialog(`curator`).optionOff(`hows it going curator`);
      B.state.setFlag(`canTakeLens`, true);
    }
  });

  B.region("gallery-region-leave").whenEnter(() => {
    B.room.changeTo(`plaza`);
  });

  B.whenLookAt('statue', () => {
    B.faceClicked();
    if (B.prop(`statue`).animation === `statue`) {
      B.player.say(`Nice looking glass lens thingie.`);
    } else {
      B.player.say(`Ehh I think it looks better now.`);
    }
  });

  B.whenPickUp('statue', () => {
    B.walkToClicked();
    B.wait(.5);
    if (!B.state.getFlag('canTakeLens')) {
      B.character(`curator`).say(`PLEASE DO NOT TOUCH THE ART!`);
    } else if (B.prop(`statue`).animation === `statue-noLens`) {
      B.player.say('I already got what I need from it.');
    } else {
      B.character('hank').playAnimation('ReachL');
      B.sound.play('whip');
      B.inventory.add(`lens`);
      B.prop(`statue`).animation = "statue-noLens";
      B.player.face(`D`);
      B.player.say('This might work to fix the time machine.');
      B.state.setFlag('gotLens',true);
    B.dialog('jensen-in-plaza').optionOn('found lens');
    }
  });

  B.whenLookAt('curator', () => {
    B.faceClicked();
    B.player.say(`She looks nice.`);
  });

  B.whenLookAt('gallery-hotspot-paint-spill', () => {
    B.walkToClicked();
    if (B.state.getFlag('canTakeLens')) {
      B.player.say(`I had better not touch it again.`);
    } else {
      B.player.say(`Is it an accident, or modern art?`);
    }
  });

  B.whenTalkTo('curator', () => {
    B.walkToClicked();
    B.dialog(`curator`).start();
  });

  B.whenLookAt('gallery-hotspot-canvas', () => {
    B.faceClicked();
    if (B.state.getFlag('canTakeLens')) {
      B.player.say(`I'm the next Jackson Pollock!`);
    } else {
      B.player.say(`The canvas is empty.`);
    }
  });

  B.whenLookAt('exit', () => {
    B.faceClicked();
    B.say`Hank: That's the way back outside.`
  });

  B.whenEnterRoom(() => {
    B.character('hank').moveTo('gallery-point-enter');
  });

  B.whenLookAt('art-1', () => {
    B.walkToClicked();
    B.say`Hank: ooooh...`
  });

  B.whenLookAt('art-2', () => {
    B.walkToClicked();
    B.say`Hank: ahhhh...`
  });

  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('gallery');
  });
});
