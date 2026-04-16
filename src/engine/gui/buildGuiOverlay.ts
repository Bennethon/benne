/**
 * Composes GUI `BitmapText` overlays. The shipped game uses the **Canvas** renderer (`gameConfig.ts`) so glyphs
 * respect `roundPixels`; Phaser’s **WebGL** `BitmapText` path does not round per character — avoid switching the
 * main game to WebGL without revisiting dialogue crispness.
 */
import * as Phaser from 'phaser';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import { getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/guiAseprite';
import {
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import type { GameBitmapFontDefinition, GameFontsManifest } from '../../types/fonts';
import type { GuiData, GuiTextAlign, GuiTextControl } from '../../types/gui';
import type { InventoryItemData } from '../../types/inventory';
import { getGameSettings } from '../ConfigManager';
import { getInventoryDefinition } from '../inventory/inventoryDefinitionRegistry';
import { resolveGameStateManager } from '../gameState/resolveGameStateManager';

/** Slot stroke for `game-config.json` `debug.showGuiOutlines` (distinct from walkable / prop debug colors). */
const DEBUG_GUI_INVENTORY_SLOT_STROKE = 0x66ccff;

const manifest = gameFontsManifest as GameFontsManifest;

/** Renders above room characters (`CHARACTER_SCENE_DEPTH` is 10_000). */
export const GUI_TEXT_OVERLAY_DEPTH = 25_000;

export interface GuiOverlayHandle {
  /** Updates the dialogue line control (`id: line`) if present, else the first text control. */
  setPrimaryText(text: string): void;
  /**
   * Places the **bottom-center** of the primary line (after word wrap) at `(x, y)` in game-canvas space,
   * then rounds. Restores authored origin/position via {@link resetPrimaryScreenPosition}.
   */
  setPrimaryScreenPositionBottomCenter(x: number, y: number): void;
  /** Restores the primary line to its authored GUI position and display origin. */
  resetPrimaryScreenPosition(): void;
  setControlText(id: string, text: string): void;
  setVisible(visible: boolean): void;
  /** Extra horizontal gap between glyphs (Phaser `BitmapText` letter spacing). */
  setLetterSpacing(spacing: number): void;
  destroy(): void;
}

function originFromAlign(align: GuiTextAlign | undefined): { x: number; y: number } {
  switch (align) {
    case 'center':
      return { x: 0.5, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function hexStringToTint(hex: string): number {
  try {
    return Phaser.Display.Color.HexStringToColor(hex).color;
  } catch {
    return 0xffffff;
  }
}

/**
 * Phaser WebGL `BitmapText` uses unrounded per-glyph positions from `GetBitmapTextSize`; center/right alignment
 * often adds half-pixel offsets. For wrapped text, using an **even** max width makes longest-line metrics more
 * often land on whole pixels (debug: compare `align: left` vs `center` on the same string).
 */
function evenWordWrapWidth(width: number): number {
  const w = Math.floor(width);
  if (w < 2) {
    return 0;
  }
  return w % 2 === 0 ? w : w - 1;
}

function bitmapTextLineAlign(align: GuiTextAlign | undefined): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

/**
 * BMFont XML often uses a negative `info size` (e.g. -8). Phaser scales with `fontSize / fontData.size`; if signs
 * disagree, scale becomes negative and flips/mirrors glyphs. Match the sign of `fontData.size`.
 */
function effectiveBitmapFontRenderSize(scene: Phaser.Scene, fontKey: string, fontSize: number): number {
  const entry = scene.cache.bitmapFont.get(fontKey) as { data?: { size?: number } } | null;
  const dataSize = entry?.data?.size;
  if (dataSize == null || dataSize === 0) {
    return fontSize;
  }
  return dataSize < 0 ? -Math.abs(fontSize) : Math.abs(fontSize);
}

const ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX = '__benneAsepriteAnims:';

/**
 * Registers Aseprite frame-tag clips on the scene animation manager (matches GUI / inventory preview boot).
 * Safe to call repeatedly; runs {@link Phaser.Animations.AnimationManager#createFromAseprite} at most once per
 * texture key per {@link Phaser.Game}.
 */
function ensureAsepriteAnimationsFromAtlas(scene: Phaser.Scene, textureKey: string): void {
  if (!scene.textures.exists(textureKey)) {
    return;
  }
  const flagKey = `${ASEPRITE_ANIMS_FROM_ATLAS_REGISTRY_PREFIX}${textureKey}`;
  if (scene.game.registry.get(flagKey)) {
    return;
  }
  scene.anims.createFromAseprite(textureKey);
  scene.game.registry.set(flagKey, true);
}

function addGuiBitmapLine(
  scene: Phaser.Scene,
  c: GuiTextControl,
  initial: string,
  depth: number,
  startVisible: boolean,
): Phaser.GameObjects.BitmapText | null {
  const fontEntry = manifest[c.font] as GameBitmapFontDefinition | undefined;
  if (!fontEntry) {
    console.warn(`[Benne] Unknown GUI font id "${c.font}" — add it to src/game/assets/fonts/fonts.json.`);
    return null;
  }

  if (!scene.cache.bitmapFont.exists(c.font)) {
    console.warn(`[Benne] Bitmap font "${c.font}" is not in the cache (preload order?).`);
    return null;
  }

  const o = originFromAlign(c.align);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const lineAlign = bitmapTextLineAlign(c.align);
  const renderSize = effectiveBitmapFontRenderSize(scene, c.font, c.fontSize);
  const bt = scene.add.bitmapText(x, y, c.font, initial, renderSize, lineAlign);
  bt.setOrigin(o.x, o.y);
  bt.clearTint();
  bt.setTint(hexStringToTint(c.color));
  if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
    const maxW = evenWordWrapWidth(c.wordWrapWidth);
    if (maxW > 0) {
      bt.setMaxWidth(maxW);
    }
  }
  const letterSpacing = c.letterSpacing ?? fontEntry.defaultLetterSpacing ?? 0;
  if (letterSpacing !== 0) {
    bt.setLetterSpacing(letterSpacing);
  }
  bt.setScrollFactor(0, 0);
  bt.setDepth(depth);
  bt.setVisible(startVisible);
  return bt;
}

export interface BuildGuiOverlayOptions {
  depth?: number;
  /** When true, text starts visible (e.g. VS Code GUI preview). Default false for in-game overlays. */
  startVisible?: boolean;
  /** Shown when a control's `text` is missing or whitespace-only; omit to use empty string. */
  emptyTextPlaceholder?: string;
}

/**
 * Builds screen-space bitmap text controls from `gui.controls`. Non-`text` entries are skipped.
 * Starts hidden unless `startVisible`. Font ids resolve via `fonts/fonts.json` (`load.bitmapFont` keys).
 */
export function buildGuiOverlay(
  scene: Phaser.Scene,
  gui: GuiData,
  options?: BuildGuiOverlayOptions,
): GuiOverlayHandle | null {
  const depth = options?.depth ?? GUI_TEXT_OVERLAY_DEPTH;
  const startVisible = options?.startVisible ?? false;
  const placeholder = options?.emptyTextPlaceholder;
  const showGuiSlotOutlines = getGameSettings().debug?.showGuiOutlines === true;
  const allLines: Phaser.GameObjects.BitmapText[] = [];
  const inventoryPanels: Phaser.GameObjects.Container[] = [];
  const linesById = new Map<string, Phaser.GameObjects.BitmapText>();

  for (const c of gui.controls ?? []) {
    if (c.type === 'inventoryPanel') {

      const panel = scene.add.container(Math.round(c.x), Math.round(c.y));
      panel.setScrollFactor(0, 0);
      /** `zIndex` is a small offset within this overlay, not an absolute scene depth (see `GuiInventoryPanelControl`). */
      panel.setDepth(depth + (c.zIndex ?? 0));

      const panelVisible = c.visible ?? gui.visible ?? startVisible;
      panel.setVisible(panelVisible);

      const spacingX = c.spacingX ?? 0;
      const spacingY = c.spacingY ?? 0;

      const bgTag = c.backgroundTag?.trim();
      const wantsAsepriteBackdrop = Boolean(bgTag && gui.display?.aseprite);
      const guiTextureKey = getAsepriteTextureKey(gui.id);

      if (wantsAsepriteBackdrop && scene.textures.exists(guiTextureKey)) {
        const backdrop = scene.add.sprite(0, 0, guiTextureKey);
        backdrop.setOrigin(0, 0);
        panel.add(backdrop);
      }

      let inventoryItems: ReadonlyArray<{ id: string; quantity: number }> = [];
      try {
        const gameState = resolveGameStateManager(scene.game);
        inventoryItems = gameState.getInventoryItems();
      } catch {
        /* e.g. GUI preview without GameStateManager on game.registry */
      }

      const slotCx = c.slotWidth / 2;
      const slotCy = c.slotHeight / 2;

      for (let row = 0; row < c.rows; row += 1) {
        for (let col = 0; col < c.cols; col += 1) {
          const slotIndex = row * c.cols + col;
          if (slotIndex >= inventoryItems.length && !c.showEmptySlots) {
            continue;
          }

          const slotX = col * (c.slotWidth + spacingX);
          const slotY = row * (c.slotHeight + spacingY);
          const slotContainer = scene.add.container(slotX, slotY);

          if (showGuiSlotOutlines) {
            const slotOutline = scene.add.graphics();
            slotOutline.lineStyle(1, DEBUG_GUI_INVENTORY_SLOT_STROKE, 1);
            slotOutline.strokeRect(0.5, 0.5, c.slotWidth - 1, c.slotHeight - 1);
            slotContainer.add(slotOutline);
          }

          if (slotIndex < inventoryItems.length) {
            const entry = inventoryItems[slotIndex]!;
            const defRaw = getInventoryDefinition(entry.id);
            const def = defRaw as InventoryItemData | undefined;
            const iconTag = def?.defaultAnimation ?? entry.id;

            let iconAdded = false;
            if (usesAsepriteDisplay(gui) && iconTag) {
              const guiKey = getAsepriteTextureKey(gui.id);
              if (scene.textures.exists(guiKey)) {
                const iconSprite = scene
                  .add.sprite(slotCx, slotCy, guiKey, iconTag)
                  .setScale(c.itemScale ?? 1)
                  .setOrigin(0.5, 0.5);
                slotContainer.add(iconSprite);
                iconAdded = true;
              }
            }

            if (
              !iconAdded &&
              def &&
              (usesSharedInventoryAseprite(def) || usesPerItemInventoryAseprite(def))
            ) {
              const texKey = usesSharedInventoryAseprite(def)
                ? sharedInventoryTextureKey
                : getPerItemInventoryTextureKey(entry.id);
              const animKey = inventoryPhaserAnimationKeyForTag(def, iconTag);
              if (scene.textures.exists(texKey)) {
                ensureAsepriteAnimationsFromAtlas(scene, texKey);
                const playKey = scene.anims.exists(animKey)
                  ? animKey
                  : usesSharedInventoryAseprite(def) && scene.anims.exists(iconTag)
                    ? iconTag
                    : null;
                if (playKey) {
                  const iconSprite = scene
                    .add.sprite(slotCx, slotCy, texKey)
                    .setScale(c.itemScale ?? 1)
                    .setOrigin(0.5, 0.5);
                  iconSprite.play(playKey);
                  slotContainer.add(iconSprite);
                  iconAdded = true;
                }
              }
            }

            if (!iconAdded) {
              const label = scene.add
                .text(slotCx, slotCy, entry.id.slice(0, 6), {
                  fontSize: '10px',
                  color: '#e0e0e0',
                })
                .setOrigin(0.5, 0.5);
              slotContainer.add(label);
            }
          }

          panel.add(slotContainer);
        }
      }

      inventoryPanels.push(panel);
      continue;
    }

    if (c.type !== 'text') {
      continue;
    }
    const raw = c.text?.trim() ?? '';
    const initial = raw.length > 0 ? (c.text ?? '') : (placeholder ?? '');
    const line = addGuiBitmapLine(scene, c, initial, depth, startVisible);
    if (!line) {
      continue;
    }
    allLines.push(line);
    if (c.id) {
      linesById.set(c.id, line);
    }
  }

  if (allLines.length === 0 && inventoryPanels.length === 0) {
    return null;
  }

  const primaryLine = linesById.get('line') ?? allLines[0];
  const primaryInitialX = primaryLine?.x ?? 0;
  const primaryInitialY = primaryLine?.y ?? 0;
  const primaryInitialOriginX = primaryLine?.originX ?? 0;
  const primaryInitialOriginY = primaryLine?.originY ?? 0;

  return {
    setPrimaryText(text: string) {
      primaryLine?.setText(text);
    },
    setPrimaryScreenPositionBottomCenter(x: number, y: number) {
      primaryLine?.setOrigin(0.5, 1);
      primaryLine?.setPosition(Math.round(x), Math.round(y));
    },
    resetPrimaryScreenPosition() {
      primaryLine?.setOrigin(primaryInitialOriginX, primaryInitialOriginY);
      primaryLine?.setPosition(primaryInitialX, primaryInitialY);
    },
    setControlText(id: string, text: string) {
      linesById.get(id)?.setText(text);
    },
    setVisible(visible: boolean) {
      for (const line of allLines) {
        line.setVisible(visible);
      }
      for (const panel of inventoryPanels) {
        panel.setVisible(visible);
      }
    },
    setLetterSpacing(spacing: number) {
      for (const line of allLines) {
        line.setLetterSpacing(spacing);
      }
    },
    destroy() {
      for (const line of allLines) {
        line.destroy();
      }
      for (const panel of inventoryPanels) {
        panel.destroy();
      }
      allLines.length = 0;
      inventoryPanels.length = 0;
      linesById.clear();
    },
  };
}

