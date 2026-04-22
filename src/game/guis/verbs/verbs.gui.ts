import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `verbs` — wires each verb button to `B.setActiveVerb(<id>)`. The pointer
 * resolver uses the active verb on the next left-click against a clickable target (and clears
 * it on consume), so clicking `OpenBtn` then a prop dispatches `open` on that prop.
 */
registerGuiScript('verbs', ({ B }) => {
  B.whenButtonClick('GiveBtn',   () => B.setActiveVerb('give'));
  B.whenButtonClick('OpenBtn',   () => B.setActiveVerb('open'));
  B.whenButtonClick('CloseBtn',  () => B.setActiveVerb('close'));
  B.whenButtonClick('PickUpBtn', () => B.setActiveVerb('pickUp'));
  B.whenButtonClick('TalkToBtn', () => B.setActiveVerb('talkTo'));
  B.whenButtonClick('LookAtBtn', () => B.setActiveVerb('look'));
  B.whenButtonClick('UseBtn',    () => B.setActiveVerb('use'));
  B.whenButtonClick('PushBtn',   () => B.setActiveVerb('push'));
  B.whenButtonClick('PullBtn',   () => B.setActiveVerb('pull'));
});
