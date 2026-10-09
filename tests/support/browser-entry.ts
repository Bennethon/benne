// Copied only into an isolated test workspace; never referenced by production entries.
import './style.css';
import { createBenneGame } from './engine/Game';
import { registerGameContent } from './engine/content/registerGameContent';
import { wireRoomTransitions } from './engine/scenes/wireRoomTransitions';
import { gameEvents } from './engine/events/EventBus';
import { resolveGameStateManager } from './engine/gameState/resolveGameStateManager';
import { isRoomTransitionInProgress } from './engine/scenes/roomTransitionGlobals';
import { installWebglRecovery } from './engine/webglRecovery';
import type { RoomScene } from './engine/scenes/RoomScene';
const parent = document.querySelector<HTMLElement>('#game-container')!;
const recovery = installWebglRecovery(parent);
registerGameContent();
const game = createBenneGame(parent);
recovery.attach(game);
wireRoomTransitions(game, gameEvents);
Object.assign(window, { __BENNE_TEST__: {
  layout: () => { const camera = game.scene.getScene('Room').cameras.main; return { width: game.canvas.width, zoom: camera.zoom, viewportWidth: camera.width, inputScale: game.scale.displayScale.x }; },
  snapshot: () => resolveGameStateManager(game).getSnapshot(),
  ready: () => game.scene.isActive('Room') && !isRoomTransitionInProgress(game) && !(game.scene.getScene('Room') as RoomScene).isCutsceneActive(),
  counts: () => ({ listeners: gameEvents.eventNames().reduce((n, e) => n + gameEvents.listenerCount(e), 0), objects: game.scene.getScene('Room').children.length }),
} });
