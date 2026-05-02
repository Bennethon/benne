import './configureBennePlayWebviewAssets';
import { createBenneGame } from '../../engine/Game';
import { gameEvents } from '../../engine/events/EventBus';
import { wireBenneGlobalScripts } from '../../engine/scripting/wireBenneGlobalScripts';
import { registerGameContent } from '../../game/registerGameContent';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

registerGameContent();
const game = createBenneGame(parent);
wireBenneGlobalScripts(game, gameEvents);
