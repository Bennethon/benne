// import { registerGuiScript } from '@engine/scripting';

// /**
//  * GUI script for `save-menu` — Bennescript entry (`B.raw`, future onShow/onHide/control hooks on `B`).
//  */
// registerGuiScript('save-menu', ({ B }) => {

//   B.whenButtonClick("back-btn", () => {
//     B.gui('save-menu').hide();
//     B.gui('game-menu').show();
//   });


//   B.whenButtonClick("save-btn", () => {
//     B.state.save(B.gui('save-menu').control('save-name').text);
//   });
// });

import { registerGuiScript } from '@engine/scripting';

/**
 * GUI script for `save-menu`.
 * Uses the named-save surface on B.state + full ControlFacade support on GuiBenneScript.
 */
registerGuiScript('save-menu', ({ B }) => {

  // Back button – return to the main game menu
  B.whenButtonClick('back-btn', () => {
    B.gui('save-menu').hide();
    B.gui('game-menu').show();
  });

  /**
   * Refreshes the saved-list listBox (exactly 5 slots) using setRowText.
   * Auto-selects the first empty slot (or slot 0 if all are full).
   */
  function refreshSaveList() {
    const saves = B.state.getSaveList();
    const listBox = B.gui('save-menu').control('saved-list');
    const maxSlots = 5;

    console.log(saves);

    // Temporary storage so the selection handler can look up the save by index
    (B.gui('save-menu') as any)._currentSaves = saves;

    for (let i = 0; i < maxSlots; i++) {
      const existing = saves.find((s) => s.slot === i);
      const label = existing ? existing.name : `(Empty Slot ${i + 1})`;
      listBox.setRowText(i, label);
    }

    // Auto-select the first empty slot (or slot 0 if none are empty)
    const firstEmpty = Array.from({ length: maxSlots }, (_, i) => i)
      .findIndex((i) => !saves.some((s) => s.slot === i));

    listBox.selectedIndex = firstEmpty !== -1 ? firstEmpty : 0;
  }

  B.onGuiBuilt(() => {
    const gui = B.gui('save-menu');
    const listBox = gui.control('saved-list');
    const nameInput = gui.control('save-name');
    const saveButton = gui.control('save-btn');

    // Initial population + auto-select
    refreshSaveList();

    // When user clicks a save slot → pre-fill the name for easy overwrite
    listBox.whenSelectionChanged((index: number) => {
      const currentSaves = (gui as any)._currentSaves || [];
      const selectedSave = currentSaves.find((s: any) => s.slot === index);

      if (selectedSave) {
        nameInput.textNow(selectedSave.name);
      } else {
        nameInput.textNow('');
      }
    });

    // Dynamic Save button: enabled only when save-name has meaningful text
    nameInput.whenValueChanged((newValue) => {
      const trimmed = String(newValue || '').trim();
      saveButton.enabled = trimmed.length > 0;
    });

    // Initial button state
    saveButton.enabled = false;
  });

  // Save button handler
  B.whenButtonClick('save-btn', () => {
    const nameInput = B.gui('save-menu').control('save-name');
    const name = String(nameInput.text || '').trim();

    if (name.length === 0) return;

    // Direct GUI action
    B.state.save.now(name);

    // Force the manifest to update immediately
    B.state.flush();

    // Refresh the listBox so the new/overwritten save appears right away
    refreshSaveList();
  });
});