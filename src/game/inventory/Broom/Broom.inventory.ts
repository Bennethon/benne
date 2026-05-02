import { registerInventoryScript } from '@engine/scripting';

registerInventoryScript('Broom', ({ B }) => {
  // Delete this line when you add your first handler.
  void B;

  B.whenLookAt(() => {
    B.player.say('The broom is a broom.');
  });

  B.whenUse(() => {
    
  });

  B.whenVerb("give", () => {
    B.setActiveInventory('Broom');
  });

  B.whenVerb("pickUp", () => {
    B.player.say("I already have the broom.");
  });

  B.whenVerb("talkTo", () => {
    B.player.say("I can't talk to the broom.");
  });

  B.whenVerb("open", () => {
    B.player.say("I can't open the broom.");
  });

  B.whenVerb("close", () => {
    B.player.say("I can't close the broom.");
  });

  B.whenVerb("push", () => {
    B.player.say("I can't push the broom.");
  });

  B.whenVerb("pull", () => {
    B.player.say("I can't pull the broom.");
  });
}, import.meta.url);
