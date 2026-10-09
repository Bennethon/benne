import './configureBennePlayWebviewAssets';
import { createBenneGame } from '../../engine/Game';
import { gameEvents } from '../../engine/events/EventBus';
import { tryGetActiveGameStateManager } from '../../engine/gameState/resolveGameStateManager';
import { getRegisteredInventoryDefinitionIds } from '../../engine/inventory/inventoryDefinitionRegistry';
import { wireRoomTransitions } from '../../engine/scenes/wireRoomTransitions';
import { registerGameContent } from '../../game/boot/registerGameContent';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

registerGameContent();
const game = createBenneGame(parent);
// Room preview **Mute** beside **Play**. The sound manager's global mute also mutes video.
if ((globalThis as { __BENNE_PLAY_MUTED?: unknown }).__BENNE_PLAY_MUTED === true) {
  game.sound.mute = true;
}
wireRoomTransitions(game, gameEvents);
setupBennePlayInventoryToolbar();
if (import.meta.env.DEV || import.meta.env.VITE_BENNE_TEST_HOOKS === 'true') {
  void import('../../engine/testing/benneTestHooks').then((m) => m.installBenneTestHooks(game));
}

function setupBennePlayInventoryToolbar(): void {
  const select = document.querySelector<HTMLSelectElement>('#benne-play-inventory-select');
  const giveBtn = document.querySelector<HTMLButtonElement>('#benne-play-give-inventory');
  if (!select || !giveBtn) {
    return;
  }

  const ids = getRegisteredInventoryDefinitionIds();
  select.replaceChildren();
  if (ids.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(no inventory items)';
    opt.disabled = true;
    opt.selected = true;
    select.append(opt);
    select.disabled = true;
    giveBtn.disabled = true;
    return;
  }

  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.append(opt);
  }

  giveBtn.addEventListener('click', () => {
    const itemId = select.value;
    if (itemId.length === 0) {
      return;
    }
    const mgr = tryGetActiveGameStateManager();
    if (!mgr) {
      return;
    }
    void mgr.addInventory(itemId, 1);
  });
}
