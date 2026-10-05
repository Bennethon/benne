import { registerRoomScript } from '@engine/scripting';


registerRoomScript(({ B }) => {

  B.playFrom('firstVisit', () => {
    B.state.setLastRoom('hallway');
  });

  B.playFrom('got lens', () => {
    B.state.setVisitCount(2);
    B.inventory.add('lens');
    B.state.setFlag('gotLens',true);
    B.dialog('jensen-in-plaza').optionOn('found lens');
  });

  B.playFrom('got lens and relay', () => {
    B.state.setVisitCount(2);

    B.inventory.add('lens');
    B.state.setFlag('gotLens',true);
    B.dialog('jensen-in-plaza').optionOn('found lens');

    B.inventory.add('relay');
    B.state.setFlag('gotRelay',true);
    B.dialog('jensen-in-plaza').optionOn('found relay');
  });

  B.playFrom('got everything', () => {
    B.state.setVisitCount(2);

    B.inventory.add('lens');
    B.state.setFlag('gotLens',true);
    B.dialog('jensen-in-plaza').optionOn('found lens');

    B.inventory.add('relay');
    B.state.setFlag('gotRelay',true);
    B.dialog('jensen-in-plaza').optionOn('found relay');

    B.inventory.add('regulator');
    B.state.setFlag('gotRegulator',true);
    B.dialog('jensen-in-plaza').optionOn('found regulator');
  });

  B.whenEnterRoom(() => {
    if (B.room.last === 'hallway' && B.room.isFirstVisit) {
      B.state.setFlag('left MIT first time', true);
      B.character('hank').moveToNow('plaza-point-enter-from-hall');
      B.character('jensen').moveToNow('plaza-point-enter-from-hall-jensen');
    } else if (B.room.last === 'hallway') {
      B.character('hank').moveToNow('plaza-point-enter-from-hall');
    } else if (B.room.last === 'gallery') {
      B.character('hank').moveTo('plaza-point-enter-from-gallery');
      B.player.face('D');
    } else if (B.room.last === 'cafe') {
      B.character('hank').moveTo('plaza-point-enter-from-cafe');
      B.player.face('D');
    } else if (B.room.last === 'club') {
      B.character('hank').moveTo('plaza-point-enter-from-garage');
      B.player.face('L');
    }
    B.character('jensen').show();
  });

  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('plaza');
    if (B.room.isFirstVisit) {
      B.player.walkTo(`plaza-point-first-visit`);
      B.character(`jensen`).walkTo.now(`plaza-point-first-visit-jensen`);
      B.wait(.5);
      B.player.face('L');
      B.player.say(`Hey, the future looks pretty nice!`);
      B.character(`jensen`).say(`Nice? Are you kidding??`);
      B.character(`jensen`).say(`Just look around! There's AI influencing everything!`);
      B.player.face('R');
      B.wait(.75);
      B.player.face('L');
      B.wait(.75);
      B.player.face('R');
      B.wait(.75);
      B.player.face('D');
      B.player.say(`Uh, whatever.`);
    }
  });


  B.whenLookAt('plaza-hotspot-gallery', () => {
    B.faceClicked();
    B.say`
    Hank: Looks like a fancy futuristic museum or something.
    Jensen: It's an AI art gallery. All the art created by robots!
    Hank: Looks nice.
    Jensen: Of course it looks nice. That's how they get you.
    `;
  });

  B.whenLookAt('plaza-hotspot-mit', () => {
    B.faceClicked();
    B.say`
    Hank: The university where I work.
    Jensen: Worked.
    Hank: Right.
    Jensen: Now it's mostly archives, museums, and machines congratulating themselves.
    `;
  });

  B.whenLookAt('plaza-hotspot-cafe', () => {
    B.faceClicked();
    B.say`
    Hank: "The Authentic Human Café"
    Hank: I remember when you could get this kind of service anywhere.
    Jensen: Now people pay for the privilege of waiting twenty minutes for the wrong sandwich.
    Hank: So basically nothing’s changed.
    `;
  });

  B.whenLookAt('plaza-hotspot-club', () => {
    B.faceClicked();
    B.say`
    Hank: A dirty looking garage with a sign that says "Human Driver's Club".
    Jensen: One of the last places in the city where a human being will still operate a two-ton machine by himself.
    Hank: That sounded worse when you said it out loud.
    `;
  });

  B.region("plaza-region-gallery-exit").whenEnter(() => {
    B.room.changeTo(`gallery`);
  });

  B.region("plaza-region-cafe-exit").whenEnter(() => {
    B.room.changeTo(`cafe`);
  });

  B.region("plaza-region-garage-exit").whenEnter(() => {
    if (B.state.getFlag('gotRegulator') ) {
      B.say`Hank: I don't think I want to go back in there.`;
    } else {
      B.room.changeTo(`club`);
    }
  });

  B.region("plaza-region-mit-exit").whenEnter(() => {
    B.room.changeTo(`hallway`);
  });

  B.whenLookAt('jensen', () => {
    B.faceClicked();
    B.say`
    Hank: He looks agitated to be outside.
    Jensen: I can hear you, Hank.
    Hank: Still true.
    `;
  });

  B.whenTalkTo('jensen', () => {
    B.walkToClicked();
    B.character('jensen').say(`Well? Do you have the components yet??`);
    B.dialog('jensen-in-plaza').start();
  });

  B.whenInventoryUsedOn('jensen', () => {
    B.faceClicked();
    B.player.say(`I don't want to give anything to him yet.`);
  });

  B.whenLookAt('botti3', () => {
    B.faceClicked();
    B.say`
    Hank: A friendly looking robot kiosk.
    Jensen: Do not call it friendly.
    BOTTi3: Hello!
    Jensen: See?
    Hank: Not really.
    `;
  });

  B.region("jensen-move-right").whenEnter((ctx) => {
    if (ctx.characterId === 'hank') {
      B.character('jensen').walkTo('plaza-point-jensen-right-side');
    }
  });

  B.region("jensen-move-left").whenEnter((ctx) => {
    if (ctx.characterId === 'hank') {
      B.character('jensen').walkTo('plaza-point-first-visit-jensen');
    }
  });

  B.whenTalkTo('botti3', () => {
    B.walkToClicked();

    if (!B.state.getFlag('talkedWithBottieOnce')) {
      B.say`
      Hank: Hello, Mr. Robot!
      BOTTi3: Good morning! Welcome to Cambridge Civic Plaza.
      Jensen: DON'T TALK TO IT!
      Hank: I just have a few questions.
      BOTTi3: That's okay!
      BOTTi3: It is very nice to see you again, Hank.
      Hank: Again?
      Hank: Have we met before?
      BOTTi3: Yes.
      Hank: When?
      BOTTi3: Ten years ago.
      Hank: I think I'd remember meeting a six-foot computer.
      BOTTi3: I was smaller.
      `
    }
    B.dialog('botti3').start();
    
  });
});
