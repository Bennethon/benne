import * as Phaser from 'phaser';
import { GAME_STATE_REPLACED_EVENT } from '../../types/gameState.js';
import type { EventBus } from '../events/EventBus.js';
import { applyPersistedAudioSessionVolumes } from './audioGameState.js';

/**
 * Re-applies persisted SFX/music session volumes when save snapshots load.
 * Call once from {@link import('../Game.js').createBenneGame} after {@link SoundManager} is registered.
 */
export function wireBenneAudioGameState(game: Phaser.Game, events: EventBus): void {
  const onReplaced = (): void => {
    applyPersistedAudioSessionVolumes(game);
  };
  events.on(GAME_STATE_REPLACED_EVENT, onReplaced);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    events.off(GAME_STATE_REPLACED_EVENT, onReplaced);
  });
}
