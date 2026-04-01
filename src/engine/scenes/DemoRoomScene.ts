import * as Phaser from 'phaser';
import { gameEvents } from '../events/EventBus';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, SCENE_DEMO_ROOM } from '../../game/constants';

export class DemoRoomScene extends Phaser.Scene {
  constructor() {
    super(SCENE_DEMO_ROOM);
  }

  create(): void {
    attachPostProcessingPlaceholder(this.cameras.main);

    const bg = this.add
      .image(0, 0, 'roomBg')
      .setOrigin(0, 0)
      .setDisplaySize(INTERNAL_WIDTH, INTERNAL_HEIGHT);

    void bg;

    const cx = Math.floor(INTERNAL_WIDTH * 0.62);
    const cy = Math.floor(INTERNAL_HEIGHT * 0.45);
    const zone = this.add.zone(cx, cy, 72, 40).setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      console.log('[Benne] Hotspot clicked: demo-door');
      gameEvents.emit('interaction:demo-door');
    });
  }
}
