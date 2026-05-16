import { BENNE_VERB_CONTEXT_CHANGED_EVENT, registerGuiScript } from '@engine/scripting';

const ROOM_HOVER_TARGET_TYPES = new Set(['prop', 'hotspot', 'character']);

/**
 * GUI script for `hover-text` — shows a label for the room entity under the pointer (props, hotspots,
 * NPCs). Uses the same verb-context hover snapshot as the verb line (`B.currentHoverTarget`).
 */
registerGuiScript('hover-text', ({ B }) => {
  B.onGuiBuilt((gui) => {
    const line = B.gui('hover-text').control('text');

    function refresh(): void {
      const h = B.currentHoverTarget;
      const isRoomEntity =
        h != null &&
        h.targetType != null &&
        ROOM_HOVER_TARGET_TYPES.has(h.targetType);

      if (!isRoomEntity) {
        gui.root.setVisible(false);
        return;
      }

      const fromDesc = h.description?.trim();
      const fromId = h.targetId?.trim();
      const label = (fromDesc && fromDesc.length > 0 ? fromDesc : fromId ?? '').trim();

      if (label.length === 0) {
        gui.root.setVisible(false);
        return;
      }

      line.text = label;
      gui.root.setVisible(true);
    }

    refresh();
    B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, refresh);
  });
});
