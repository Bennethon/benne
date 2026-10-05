import { registerDialogScript } from '@engine/scripting';

registerDialogScript('botti3-local-area', ({ B }) => {
  // Player picks are handled with B.whenChoice('optionId', () => { … }) — use the Inspector "Script" button per option.
  void B;

  // What’s that fancy looking museum?
  B.whenChoice("gallery", () => {
    B.say`
    botti3: A gallery featuring artwork created entirely by artificial intelligence.
    botti3: Thousands of new works are produced every day.
    jensen: And not one of them means anything.
    botti3: Visitor satisfaction is very high.
    jensen: THAT ISN'T THE POINT.
    `
  });

  // What’s with the Authentic Human Café?
  B.whenChoice("cafe", () => {
    B.say`
    BOTTi3: A historical dining experience.
    HANK: Historical?
    BOTTi3: Customers may wait up to forty-five minutes, receive incorrect orders, and interact with visibly stressed staff.
    HANK: That's pretty accurate.
    `
  });

  // What's going on in that garage over there?
  B.whenChoice("club", () => {
    B.say`
    BOTTi3: The Human Driver's Club preserves traditional manual transportation.
    HANK: You mean driving.
    BOTTi3: Yes.
    HANK: You people made driving a hobby.
    BOTTi3: It already was.
    `
  });

  // That's all I want to know about the area for now.
  B.whenChoice("thats all", () => {
    B.say`botti3: Okay!`
    B.dialog('botti3').start();
  });
});
