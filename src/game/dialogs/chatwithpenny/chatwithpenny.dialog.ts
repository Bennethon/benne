import { registerDialogScript } from '@engine/scripting';

registerDialogScript('chatwithpenny', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;


  B.whenChoice("door", () => {
    B.say`
      Player: I want to go outside.
      Penny: I want a sandwich.
      `;
      B.wait(0.5);
      B.player.say`Uhh...`;
      B.wait(0.5);
      B.character('penny').say`Make me a sandwich and I'll give you the key.`;
  });

  B.whenChoice("bye", () => {
    B.say`
      Penny: Bye!
    `;
    B.dialog("chatwithpenny").stop();
  });

  B.whenChoice("greeting", () => {
    B.say`
      Penny: Fine.
    `;
  });
}, import.meta.url);
