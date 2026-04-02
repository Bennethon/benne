import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';

export function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  const { width, height } = getGameSettings().resolution;

  return {
    type: Phaser.WEBGL,
    parent,
    width,
    height,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
    scene: [BootScene, RoomScene],
    render: {
      powerPreference: 'high-performance',
    },
  };
}
