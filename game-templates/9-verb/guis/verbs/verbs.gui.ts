import { BENNE_VERB_CONTEXT_CHANGED_EVENT, registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `verbs` — wires each verb button to `B.setActiveVerb(<id>)`. The pointer
 * resolver uses the active verb on the next left-click against a clickable target (and clears
 * it on consume), so clicking `OpenBtn` then a prop dispatches `open` on that prop.
 */
registerGuiScript('verbs', ({ B }) => {
  B.onGuiBuilt(() => {
    const line = B.gui('verbs').control('verbLineText');

    function refresh(): void {
      const verb = B.activeVerb;
      const item = B.activeInventory;
      const hover = B.currentHoverDescription;

      let text = verb?.label ?? 'Walk to';
      if (item) {
        const itemName = item.description || item.name || item.id;
        const prep = verb?.preposition ?? 'on';
        text = `${text} ${itemName} ${prep}`;
      }
      if (hover) text += ` ${hover}`;

      line.text = text.trim();
    }

    refresh();
    B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, refresh);
  });

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
