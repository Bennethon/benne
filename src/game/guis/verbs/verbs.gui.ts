import { BENNE_VERB_CONTEXT_CHANGED_EVENT, registerGuiScript } from '@engine/scripting';
import { DEFAULT_VERB_FALLBACK } from '@engine/verbs/verbConfig';

/**
 * GUI script for `verbs` — wires each verb button to `B.setActiveVerb(<id>)`. The pointer
 * resolver uses the active verb on the next left-click against a clickable target (and clears
 * it on consume), so clicking `OpenBtn` then a prop dispatches `open` on that prop.
 */
registerGuiScript('verbs', ({ B }) => {
  B.onGuiBuilt(() => {
    const line = B.gui('verbs').control('verbLineText');

    const verbButtons = {
      look: B.gui('verbs').control('LookAtBtn'),
      use: B.gui('verbs').control('UseBtn'),
      take: B.gui('verbs').control('TakeBtn'),
      talkTo: B.gui('verbs').control('TalkToBtn'),
      move: B.gui('verbs').control('MoveBtn'),
      clean: B.gui('verbs').control('CleanBtn'),
    } as const;

    function refresh(): void {
      const verb = B.activeVerb;
      const item = B.activeInventory;
      const hoverDescription = B.currentHoverDescription;

      const hover = B.currentHoverTarget;
      const effectiveDefaultVerb =
        hover == null
          ? undefined
          : (hover.defaultVerb?.trim().length ? hover.defaultVerb.trim() : DEFAULT_VERB_FALLBACK);

      // == Verb Line ==
      let text = verb?.label ?? 'Walk to';
      if (item) {
        const itemName = item.description || item.name || item.id;
        const prep = verb?.preposition ?? 'on';
        text = `${text} ${itemName} ${prep}`;
      }
      if (hoverDescription) text += ` ${hoverDescription}`;

      line.text = text.trim();

      // == Default-verb button highlight ==
      // First, reset everything to normal
      Object.values(verbButtons).forEach(btn => {
        btn.setVisualState('normal');
      });

      // Then highlight the matching button if we have a hover default verb
      if ( effectiveDefaultVerb && verbButtons[effectiveDefaultVerb as keyof typeof verbButtons] ) {
        verbButtons[effectiveDefaultVerb as keyof typeof verbButtons].setVisualState('hover');
      }

    }

    refresh();
    B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, refresh);
  });

  B.whenButtonClick('TakeBtn', () => B.setActiveVerb('take'));
  B.whenButtonClick('TalkToBtn', () => B.setActiveVerb('talkTo'));
  B.whenButtonClick('LookAtBtn', () => B.setActiveVerb('look'));
  B.whenButtonClick('UseBtn',    () => B.setActiveVerb('use'));
  B.whenButtonClick('MoveBtn',    () => B.setActiveVerb('move'));
  B.whenButtonClick('CleanBtn',    () => B.setActiveVerb('clean'));

  B.whenButtonClick("MenuBtn", () => {
    B.gui('game-menu').show();
  });
});
