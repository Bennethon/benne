import './style.css';
import { createBenneGame } from './engine/Game';

const parent = document.querySelector<HTMLElement>('#game-container');
if (!parent) {
  throw new Error('Missing #game-container');
}

createBenneGame(parent);
