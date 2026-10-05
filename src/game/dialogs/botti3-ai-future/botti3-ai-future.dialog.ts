import { registerDialogScript } from '@engine/scripting';

registerDialogScript('botti3-ai-future', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;

  // So nobody has jobs anymore?
  B.whenChoice("jobs", () => {
    B.say`
    BOTTi3: Employment is optional.
    HANK: You're telling me nobody has to work?
    BOTTi3: Correct.
    HANK: Jensen made that sound way worse.
    `
  });

  // What happens if somebody commits a crime?
  B.whenChoice("crime", () => {
    B.say`
    BOTTi3: Violent crime is extremely rare.
    HANK: Because you're watching everybody?
    BOTTi3: Mostly because people have food, housing, healthcare, and very little reason to rob one another.
    HANK: Oh.
    JENSEN: Don't fall for that.
    `
  });

  // Can I smoke in the plaza?
  B.whenChoice("smoke", () => {
    B.say`
    BOTTi3: Yes.
    HANK: Really?
    BOTTi3: A medical drone will follow you while expressing disappointment.
    HANK: Never mind.
    `
  });

  // Can I drive a car?
  B.whenChoice("drive", () => {
    B.say`
    BOTTi3: Certainly.
    HANK: Jensen said humans aren't allowed to drive.
    BOTTi3: Humans are allowed to drive.
    HANK: Then what's his problem?
    BOTTi3: They are not allowed to drive into pedestrians.
    JENSEN: It takes control away from you!
    HANK: During the pedestrian part?
    BOTTi3: Yes.
    `
  });

  // That's enough about the future for now.
  B.whenChoice("thats all", () => {
    B.say`botti3: Okay!`
    B.dialog('botti3').start();
  });
});
