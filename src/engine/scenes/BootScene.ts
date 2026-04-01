import * as Phaser from 'phaser';
import { SCENE_BOOT, SCENE_DEMO_ROOM } from '../../game/constants';

const ROOM_BG_URL = '/assets/images/placeholders/room-bg.png';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT);
  }

  preload(): void {
    this.load.image('roomBg', ROOM_BG_URL);
  }

  create(): void {
    this.scene.start(SCENE_DEMO_ROOM);
  }
}
