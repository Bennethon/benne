import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { buildGuiOverlay, GUI_TEXT_OVERLAY_DEPTH } from '../../engine/gui/buildGuiOverlay';
import type { GuiData } from '../../types/gui';
import type { GuiFontLoadRequest } from '../../game/collectFontLoadsForGui';

const BOOT = 'BenneGuiPreviewBoot';
const PREVIEW = 'BenneGuiPreview';

export type GuiPreviewAsepritePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  tagToPlay: string;
};

export type GuiPreviewGamePayload = {
  guiData: GuiData;
  fontLoads: GuiFontLoadRequest[];
  internalWidth: number;
  internalHeight: number;
  revokeObjectUrls: string[];
  /** When set, loads and plays the Aseprite sheet; otherwise text-only preview. */
  aseprite: GuiPreviewAsepritePayload | null;
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
    for (const f of this.payload.fontLoads) {
      this.load.font(f.fontId, f.url, f.format);
    }
    const a = this.payload.aseprite;
    if (a) {
      this.load.aseprite({
        key: a.textureKey,
        textureURL: a.textureURL,
        atlasURL: a.atlasURL,
      });
    }
  }

  create(): void {
    applyBootAudioSettings(this);
    this.scene.start(PREVIEW, this.payload);
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

const PREVIEW_RESOLUTION_LABEL_DEPTH = 100;
/** Above Aseprite sprite so authored text is readable in the editor. */
const PREVIEW_GUI_TEXT_DEPTH = Math.max(GUI_TEXT_OVERLAY_DEPTH, PREVIEW_RESOLUTION_LABEL_DEPTH + 1);

class GuiPreviewScene extends Phaser.Scene {
  private payload!: GuiPreviewGamePayload;

  constructor() {
    super(PREVIEW);
  }

  init(data: GuiPreviewGamePayload): void {
    this.payload = data;
  }

  create(): void {
    const { internalWidth, internalHeight, guiData, aseprite } = this.payload;
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);

    if (aseprite) {
      const sprite = this.add
        .sprite(internalWidth / 2, internalHeight / 2, aseprite.textureKey)
        .setOrigin(0.5, 0.5);

      if (!this.anims.exists(aseprite.tagToPlay)) {
        this.anims.createFromAseprite(aseprite.textureKey);
      }
      if (this.anims.exists(aseprite.tagToPlay)) {
        sprite.play(aseprite.tagToPlay);
      }
    }

    buildGuiOverlay(this, guiData, {
      depth: PREVIEW_GUI_TEXT_DEPTH,
      startVisible: true,
      emptyTextPlaceholder: 'Lorem ipsum dolor sit amet.',
    });

    this.add
      .text(8, 6, `${internalWidth}×${internalHeight} · game resolution`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8892a8',
      })
      .setScrollFactor(0)
      .setDepth(PREVIEW_RESOLUTION_LABEL_DEPTH);
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
