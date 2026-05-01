import { registerDialogScript } from '@engine/scripting';

registerDialogScript('chatwithpenny', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;

  B.whenChoice("greeting", () => {
    B.say`
      Player: Hello, Penny!
      Penny: Hello, Player!
    `;
  });

  B.whenChoice("door", () => {
    B.say`
      Player: I want to go outside.
      Penny: I want a sandwich.
    `;
  });

  B.whenChoice("bye", () => {
    B.say`
      Player: Bye, Penny!
      Penny: Bye, Player!
    `;
    B.dialog("chatwithpenny").stop();
  });
});
