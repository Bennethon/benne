import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import {
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
  type CharacterFeetLocal,
} from '../../engine/characterFeet';
import type { CharacterData } from '../../types/character';

const BOOT = 'BenneCharacterPreviewBoot';
const PREVIEW = 'BenneCharacterPreview';

/** Padding around the sprite frame in world pixels (matches room editor “fit art” feel). */
const WORLD_PAD = 56;
/** Room-editor-style vertex handle: yellow fill, dark stroke (`RoomPolygonEditScene`). */
const HANDLE_FILL = 0xffee44;
const HANDLE_STROKE = 0x1a1a24;
const HANDLE_RADIUS = 3.5;

export type CharacterPreviewGamePayload = {
  textureKey: string;
  textureURL: string;
  atlasURL: string;
  character: CharacterData;
  idleTag: string;
  revokeObjectUrls: string[];
};

function editorGameConfig(parent: HTMLElement): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
  return {
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    scale: {
      parent,
      mode: Phaser.Scale.RESIZE,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}

class BenneCharacterPreviewBoot extends Phaser.Scene {
  private readonly payload: CharacterPreviewGamePayload;

  constructor(payload: CharacterPreviewGamePayload) {
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
      character: this.payload.character,
      idleTag: this.payload.idleTag,
    });
    for (const u of this.payload.revokeObjectUrls) {
      URL.revokeObjectURL(u);
    }
  }
}

class CharacterPreviewScene extends Phaser.Scene {
  private textureKey!: string;
  private character!: CharacterData;
  private idleTag!: string;
  private sprite!: Phaser.GameObjects.Sprite;
  private marker!: Phaser.GameObjects.Arc;
  private feetLocal!: CharacterFeetLocal;
  private worldW = 0;
  private worldH = 0;
  private isPanning = false;
  private panLastX = 0;
  private panLastY = 0;

  private readonly onCanvasWheel = (e: WheelEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const cam = this.cameras.main;
    const worldPt = this.domPageToWorld(e.pageX, e.pageY);
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      delta *= 40;
    }
    if (e.deltaMode === 2) {
      delta *= 400;
    }
    const zoomFactor = 1 - Math.max(-0.3, Math.min(0.3, delta * 0.001));
    const newZoom = Math.max(0.15, Math.min(48, cam.zoom * zoomFactor));
    if (Math.abs(newZoom - cam.zoom) < 0.0001) {
      return;
    }
    this.game.scale.updateBounds();
    const screenX = this.game.scale.transformX(e.pageX);
    const screenY = this.game.scale.transformY(e.pageY);
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.scrollX = worldPt.x - originX - (screenX - originX - cam.x) / newZoom;
    cam.scrollY = worldPt.y - originY - (screenY - originY - cam.y) / newZoom;
  };

  private readonly onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) {
      return;
    }
    e.preventDefault();
    this.isPanning = true;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
    this.game.canvas.style.cursor = 'grabbing';
    this.game.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onCanvasPointerMove = (e: PointerEvent): void => {
    if (!this.isPanning) {
      return;
    }
    const cam = this.cameras.main;
    const dx = e.clientX - this.panLastX;
    const dy = e.clientY - this.panLastY;
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
  };

  private readonly onCanvasPointerUp = (e: PointerEvent): void => {
    if (e.button !== 1 || !this.isPanning) {
      return;
    }
    this.isPanning = false;
    this.game.canvas.style.cursor = '';
    try {
      this.game.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'f' && e.key !== 'F') {
      return;
    }
    const ae = document.activeElement;
    if (
      ae instanceof HTMLInputElement ||
      ae instanceof HTMLTextAreaElement ||
      ae instanceof HTMLSelectElement
    ) {
      return;
    }
    e.preventDefault();
    this.applyFitCamera();
  };

  private readonly onScaleResize = (): void => {
    this.applyFitCamera();
  };

  constructor() {
    super(PREVIEW);
  }

  init(data: {
    textureKey: string;
    character: CharacterData;
    idleTag: string;
  }): void {
    this.textureKey = data.textureKey;
    this.character = data.character;
    this.idleTag = data.idleTag;
  }

  create(): void {
    this.sprite = this.add.sprite(0, 0, this.textureKey).setOrigin(0, 0);
    if (!this.anims.exists(this.idleTag)) {
      this.anims.createFromAseprite(this.textureKey);
    }
    this.sprite.play(this.idleTag);

    this.feetLocal = { ...resolveCharacterFeetLocal(this.character, this.sprite) };
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    this.worldW = fw + WORLD_PAD * 2;
    this.worldH = fh + WORLD_PAD * 2;

    const feetWx = WORLD_PAD + this.feetLocal.x;
    const feetWy = WORLD_PAD + this.feetLocal.y;
    placeSpriteByFeet(this.sprite, this.feetLocal, feetWx, feetWy);

    this.marker = this.add
      .circle(feetWx, feetWy, HANDLE_RADIUS, HANDLE_FILL, 1)
      .setStrokeStyle(2, HANDLE_STROKE, 0.55)
      .setDepth(100);

    this.marker.setInteractive({ draggable: true });
    this.input.setDraggable(this.marker);
    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (obj !== this.marker) {
          return;
        }
        // Phaser passes world-space drag targets, not deltas (see InputPlugin#processDragMoveEvent).
        this.marker.setPosition(dragX, dragY);
        this.clampMarkerToFrame();
      },
    );

    this.game.registry.set('benneCharacterPreviewReadFeet', () => ({ ...this.feetLocal }));

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);
    cam.setBounds(0, 0, this.worldW, this.worldH);
    this.applyFitCamera();

    const canvas = this.game.canvas;
    canvas.addEventListener('wheel', this.onCanvasWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    window.addEventListener('keydown', this.onWindowKeyDown);
    this.scale.on('resize', this.onScaleResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('wheel', this.onCanvasWheel);
      canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
      canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
      canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
      canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
      window.removeEventListener('keydown', this.onWindowKeyDown);
      this.scale.off('resize', this.onScaleResize);
    });

    this.add
      .text(10, 10, 'Wheel = zoom · middle-drag = pan · F = fit · drag handle = feet', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#c8c8d8',
      })
      .setScrollFactor(0)
      .setDepth(200);
  }

  private domPageToWorld(pageX: number, pageY: number): { x: number; y: number } {
    this.game.scale.updateBounds();
    const px = this.game.scale.transformX(pageX);
    const py = this.game.scale.transformY(pageY);
    return this.cameras.main.getWorldPoint(px, py);
  }

  private applyFitCamera(): void {
    const cam = this.cameras.main;
    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0 || this.worldW <= 0 || this.worldH <= 0) {
      return;
    }
    const zoom = Math.min(panelW / this.worldW, panelH / this.worldH) * 0.92;
    cam.setZoom(zoom);
    cam.centerToBounds();
  }

  private clampMarkerToFrame(): void {
    const fw = this.sprite.frame.width;
    const fh = this.sprite.frame.height;
    let fx = this.marker.x - this.sprite.x;
    let fy = this.marker.y - this.sprite.y;
    fx = Phaser.Math.Clamp(fx, 0, fw);
    fy = Phaser.Math.Clamp(fy, 0, fh);
    this.feetLocal = { x: fx, y: fy };
    this.marker.setPosition(this.sprite.x + fx, this.sprite.y + fy);
  }
}

export function createCharacterPreviewPhaserGame(
  parent: HTMLElement,
  payload: CharacterPreviewGamePayload,
): Phaser.Game {
  return new Phaser.Game({
    ...editorGameConfig(parent),
    scene: [new BenneCharacterPreviewBoot(payload), CharacterPreviewScene],
  });
}
