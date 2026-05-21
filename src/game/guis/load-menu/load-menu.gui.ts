import { registerGuiScript } from '@engine/scripting';

const MAX_SLOTS = 5;

/**
 * GUI script for `load-menu`.
 * Five fixed slots (0–4); `B.state.load(slot)` restores the selected slot.
 */
registerGuiScript('load-menu', ({ B }) => {
  B.whenButtonClick('back-btn', () => {
    B.gui('load-menu').hide();
    B.gui('game-menu').show();
  });

  let selectedSlotIndex = 0;

  /** Map manifest entries onto fixed slot indices (ignores unnamed / out-of-range saves). */
  function getSavesBySlot() {
    const bySlot: Array<{ name: string; slot?: number; timestamp: number } | undefined> =
      Array(MAX_SLOTS);
    for (const save of B.state.getSaveList()) {
      const slot = save.slot;
      if (typeof slot === 'number' && slot >= 0 && slot < MAX_SLOTS) {
        bySlot[slot] = save;
      }
    }
    return bySlot;
  }

  function firstOccupiedOrZero(savesBySlot: ReturnType<typeof getSavesBySlot>): number {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (savesBySlot[i]) return i;
    }
    return 0;
  }

  function syncLoadButton(slotIndex: number) {
    const save = getSavesBySlot()[slotIndex];
    B.gui('load-menu').control('load-btn').enabled = !!save;
  }

  /** Repaint list rows. When `autoSelect` is true, pick the first occupied slot (or 0 if none). */
  function refreshLoadList(autoSelect: boolean) {
    const savesBySlot = getSavesBySlot();
    const listBox = B.gui('load-menu').control('load-list');

    for (let i = 0; i < MAX_SLOTS; i++) {
      const existing = savesBySlot[i];
      listBox.setRowText(i, existing ? existing.name : `(Empty Slot ${i + 1})`);
    }

    if (autoSelect) {
      selectedSlotIndex = firstOccupiedOrZero(savesBySlot);
    }

    listBox.selectedIndex = selectedSlotIndex;
  }

  B.onGuiBuilt(() => {
    const gui = B.gui('load-menu');
    const listBox = gui.control('load-list');

    refreshLoadList(true);
    syncLoadButton(selectedSlotIndex);

    listBox.whenSelectionChanged((index: number) => {
      selectedSlotIndex = index;
      syncLoadButton(index);
    });
  });

  B.whenButtonClick('load-btn', () => {
    if (!getSavesBySlot()[selectedSlotIndex]) return;

    const loaded = B.state.load.now(selectedSlotIndex);
    if (!loaded) return;

    B.gui('load-menu').hide();
    B.gui('game-menu').hide();
  });
});
