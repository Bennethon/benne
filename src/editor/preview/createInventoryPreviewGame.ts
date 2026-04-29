import * as Phaser from 'phaser';
import { resolveAuthoredPositionForAsepriteTrim } from '../../engine/aseprite/asepriteFramePlacement';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import type { InventoryItemData } from '../../types/inventory';

const BOOT = 'BenneInventoryPreviewBoot';
const PREVIEW = 'BenneInventoryPreview';

export type InventoryPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  inventory: InventoryItemData;
  animationKey: string;
  animationTagLabel: string;
  revokeObjectUrls: string[];
};

function editorGameConfig(
  parent: HTMLElement,
  width: number,
  height: number,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    /** Keep parity with runtime UI rendering (`getBennePhaserGameConfigBase` in `gameConfig.ts`). */
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
      width,
      height,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: Phaser.Scale.MAX_ZOOM,
      autoRound: true,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

class BenneInventoryPreviewBoot extends Phaser.Scene {
  private readonly payload: InventoryPreviewGamePayload;

  constructor(payload: InventoryPreviewGamePayload) {
    super(BOOT);
    this.payload = payload;
  }

  preload(): void {
    this.load.aseprite({
      key: this.payload.textureKey,
      textureURL: this.payload.textureURL,
      atlasURL: this.payload.atlasURL,
    });
  }

  create(): void {
    applyBootAudioSettings(this);
    this.scene.start(PREVIEW, this.payload);
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class InventoryPreviewScene extends Phaser.Scene {
  private payload!: InventoryPreviewGamePayload;

  constructor() {
    super(PREVIEW);
  }

  init(data: InventoryPreviewGamePayload): void {
    this.payload = data;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);

    const sprite = this.add
      .sprite(cam.width / 2, cam.height / 2, this.payload.textureKey)
      .setOrigin(0.5, 0.5);

    if (!this.anims.exists(this.payload.animationKey)) {
      this.anims.createFromAseprite(this.payload.textureKey);
    }
    if (this.anims.exists(this.payload.animationKey)) {
      sprite.play(this.payload.animationKey);
    }
    const p = resolveAuthoredPositionForAsepriteTrim('center', cam.width / 2, cam.height / 2, sprite.frame);
    sprite.setPosition(p.x, p.y);

    this.add
      .text(8, 6, `${this.payload.inventory.id} · ${this.payload.animationTagLabel}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8892a8',
      })
      .setScrollFactor(0);
  }
}

export function createInventoryPreviewPhaserGame(
  parent: HTMLElement,
  payload: InventoryPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent, 352, 198),
    scene: [new BenneInventoryPreviewBoot(payload), InventoryPreviewScene],
  });
}
