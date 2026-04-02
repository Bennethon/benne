import './style.css';
import { createBenneGame } from './engine/Game';
import { registerGameContent } from './game/registerGameContent';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

registerGameContent();
createBenneGame(parent);
