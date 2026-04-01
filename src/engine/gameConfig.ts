import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { DemoRoomScene } from './scenes/DemoRoomScene';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../game/constants';

export function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent,
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: INTERNAL_WIDTH,
      height: INTERNAL_HEIGHT,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
    scene: [BootScene, DemoRoomScene],
    render: {
      powerPreference: 'high-performance',
    },
  };
}
