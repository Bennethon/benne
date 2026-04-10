import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';

const BOOT = 'BenneGuiPreviewBoot';
const PREVIEW = 'BenneGuiPreview';

export type GuiPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  tagToPlay: string;
  internalWidth: number;
  internalHeight: number;
  revokeObjectUrls: string[];
};

function editorGameConfig(
  parent: HTMLElement,
  width: number,
  height: number,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    type: Phaser.WEBGL,
    parent,
    width,
    height,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.FIT,
      width,
      height,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

class BenneGuiPreviewBoot extends Phaser.Scene {
  private readonly payload: GuiPreviewGamePayload;

  constructor(payload: GuiPreviewGamePayload) {
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
    this.scene.start(PREVIEW, {
      textureKey: this.payload.textureKey,
      tagToPlay: this.payload.tagToPlay,
      internalWidth: this.payload.internalWidth,
      internalHeight: this.payload.internalHeight,
    });
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class GuiPreviewScene extends Phaser.Scene {
  private textureKey!: string;
  private tagToPlay!: string;
  private internalWidth = 352;
  private internalHeight = 198;

  constructor() {
    super(PREVIEW);
  }

  init(data: {
    textureKey: string;
    tagToPlay: string;
    internalWidth: number;
    internalHeight: number;
  }): void {
    this.textureKey = data.textureKey;
    this.tagToPlay = data.tagToPlay;
    this.internalWidth = data.internalWidth;
    this.internalHeight = data.internalHeight;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);

    const sprite = this.add.sprite(this.internalWidth / 2, this.internalHeight / 2, this.textureKey).setOrigin(0.5, 0.5);

    if (!this.anims.exists(this.tagToPlay)) {
      this.anims.createFromAseprite(this.textureKey);
    }
    if (this.anims.exists(this.tagToPlay)) {
      sprite.play(this.tagToPlay);
    }

    this.add
      .text(8, 6, `${this.internalWidth}×${this.internalHeight} · game resolution`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8892a8',
      })
      .setScrollFactor(0)
      .setDepth(100);
  }
}

export function createGuiPreviewPhaserGame(
  parent: HTMLElement,
  payload: GuiPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent, payload.internalWidth, payload.internalHeight),
    scene: [new BenneGuiPreviewBoot(payload), GuiPreviewScene],
  });
}
