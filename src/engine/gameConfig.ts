import * as Phaser from 'phaser';
import { getGameSettings } from './ConfigManager';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';

/** Shared Phaser settings (resolution, scale, render) — scenes are added per entrypoint. */
export function getBennePhaserGameConfigBase(
  parent: HTMLElement | string,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  const { width, height } = getGameSettings().resolution;

  return {
    /**
     * Canvas (not WebGL): matches the VS Code GUI preview and rounds `BitmapText` glyph draws when `roundPixels`
     * is on; Phaser’s WebGL `BitmapText` path does not, which showed as uneven pixels on wrapped dialogue.
     */
    type: Phaser.CANVAS,
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
    render: {
      powerPreference: 'high-performance',
    },
  };
}

export function createGameConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    ...getBennePhaserGameConfigBase(parent),
    scene: [BootScene, RoomScene],
  };
}
