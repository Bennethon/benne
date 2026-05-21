import { registerGuiScript } from '@engine/scripting';

const MAX_SLOTS = 5;

/**
 * GUI script for `save-menu`.
 * Five fixed slots (0–4); `B.state.save(name, slot)` writes the selected slot.
 */
registerGuiScript('save-menu', ({ B }) => {
  B.whenButtonClick('back-btn', () => {
    B.gui('save-menu').hide();
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

  function firstEmptyOrLastSlot(savesBySlot: ReturnType<typeof getSavesBySlot>): number {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (!savesBySlot[i]) return i;
    }
    return MAX_SLOTS - 1;
  }

  function syncNameAndSaveButton(slotIndex: number) {
    const gui = B.gui('save-menu');
    const save = getSavesBySlot()[slotIndex];
    const name = save ? save.name : '';
    gui.control('save-name').textNow(name);
    gui.control('save-btn').enabled = name.trim().length > 0;
  }

  /** Repaint list rows. When `autoSelect` is true, pick the first empty slot or the last slot if full. */
  function refreshSaveList(autoSelect: boolean) {
    const savesBySlot = getSavesBySlot();
    const listBox = B.gui('save-menu').control('saved-list');

    for (let i = 0; i < MAX_SLOTS; i++) {
      const existing = savesBySlot[i];
      listBox.setRowText(i, existing ? existing.name : `(Empty Slot ${i + 1})`);
    }

    if (autoSelect) {
      selectedSlotIndex = firstEmptyOrLastSlot(savesBySlot);
    }

    listBox.selectedIndex = selectedSlotIndex;
  }

  B.onGuiBuilt(() => {
    const gui = B.gui('save-menu');
    const listBox = gui.control('saved-list');
    const nameInput = gui.control('save-name');
    const saveButton = gui.control('save-btn');

    refreshSaveList(true);
    syncNameAndSaveButton(selectedSlotIndex);

    listBox.whenSelectionChanged((index: number) => {
      selectedSlotIndex = index;
      syncNameAndSaveButton(index);
    });

    nameInput.whenValueChanged((newValue) => {
      const trimmed = String(newValue || '').trim();
      saveButton.enabled = trimmed.length > 0;
    });
  });

  B.whenButtonClick('save-btn', () => {
    const gui = B.gui('save-menu');
    const nameInput = gui.control('save-name');
    const name = String(nameInput.text || '').trim();
    if (name.length === 0) return;

    B.state.save.now(name, selectedSlotIndex);
    B.state.flush();

    refreshSaveList(false);
    syncNameAndSaveButton(selectedSlotIndex);

    B.gui('save-menu').hide();
    B.gui('game-menu').show();
  });
});
