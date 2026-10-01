import './style.css';
import { createBenneGame } from './engine/Game';
import { gameEvents } from './engine/events/EventBus';
import { wireBenneGlobalScripts } from './engine/scripting/wireBenneGlobalScripts';
import { registerGameContent } from './game/boot/registerGameContent';
import { installWebglRecovery } from './engine/webglRecovery';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

const graphicsRecovery = installWebglRecovery(parent);
try {
  registerGameContent();
  const game = createBenneGame(parent);
  graphicsRecovery.attach(game);
  wireBenneGlobalScripts(game, gameEvents);
} catch (error) {
  if (!graphicsRecovery.reportError(error)) throw error;
}
