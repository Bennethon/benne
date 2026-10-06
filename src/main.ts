import './style.css';
import { createBenneGame } from './engine/Game';
import { gameEvents } from './engine/events/EventBus';
import { wireRoomTransitions } from './engine/scenes/wireRoomTransitions';
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
  wireRoomTransitions(game, gameEvents);
  if (import.meta.env.DEV || import.meta.env.VITE_BENNE_TEST_HOOKS === 'true') {
    void import('./engine/testing/benneTestHooks').then((m) => m.installBenneTestHooks(game));
  }
} catch (error) {
  if (!graphicsRecovery.reportError(error)) throw error;
}
