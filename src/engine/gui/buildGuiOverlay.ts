import * as Phaser from 'phaser';
import type { GuiData, GuiTextAlign, GuiTextControl } from '../../types/gui';

/** Renders above room characters (`CHARACTER_SCENE_DEPTH` is 10_000). */
export const GUI_TEXT_OVERLAY_DEPTH = 25_000;

export interface GuiOverlayHandle {
  /** Updates the dialogue line control (`id: line`) if present, else the first text control. */
  setPrimaryText(text: string): void;
  setControlText(id: string, text: string): void;
  setVisible(visible: boolean): void;
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

function textStyleForControl(c: GuiTextControl): Phaser.Types.GameObjects.Text.TextStyle {
  const align = c.align ?? 'left';
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: c.font,
    fontSize: `${c.fontSize}px`,
    color: c.color,
    align: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
  };
  if (c.wordWrapWidth != null && c.wordWrapWidth > 0) {
    style.wordWrap = { width: c.wordWrapWidth };
  }
  return style;
}

export interface BuildGuiOverlayOptions {
  depth?: number;
  /** When true, text starts visible (e.g. VS Code GUI preview). Default false for in-game overlays. */
  startVisible?: boolean;
  /** Shown when a control's `text` is missing or whitespace-only; omit to use empty string. */
  emptyTextPlaceholder?: string;
}

/**
 * Builds screen-space text controls from `gui.controls`. Non-`text` entries are skipped.
 * Starts hidden unless `startVisible`. Uses `fontFamily` equal to Phaser `load.font` keys from `fonts/fonts.json`.
 */
export function buildGuiOverlay(
  scene: Phaser.Scene,
  gui: GuiData,
  options?: BuildGuiOverlayOptions,
): GuiOverlayHandle | null {
  const depth = options?.depth ?? GUI_TEXT_OVERLAY_DEPTH;
  const startVisible = options?.startVisible ?? false;
  const placeholder = options?.emptyTextPlaceholder;
  const allTexts: Phaser.GameObjects.Text[] = [];
  const textsById = new Map<string, Phaser.GameObjects.Text>();

  for (const c of gui.controls ?? []) {
    if (c.type !== 'text') {
      continue;
    }
    const raw = c.text?.trim() ?? '';
    const initial = raw.length > 0 ? (c.text ?? '') : (placeholder ?? '');
    const t = scene.add.text(c.x, c.y, initial, textStyleForControl(c));
    const o = originFromAlign(c.align);
    t.setOrigin(o.x, o.y);
    t.setScrollFactor(0, 0);
    t.setDepth(depth);
    t.setVisible(startVisible);
    allTexts.push(t);
    if (c.id) {
      textsById.set(c.id, t);
    }
  }

  if (allTexts.length === 0) {
    return null;
  }

  const primaryText: Phaser.GameObjects.Text = textsById.get('line') ?? allTexts[0]!;

  return {
    setPrimaryText(text: string) {
      primaryText.setText(text);
    },
    setControlText(id: string, text: string) {
      textsById.get(id)?.setText(text);
    },
    setVisible(visible: boolean) {
      for (const t of allTexts) {
        t.setVisible(visible);
      }
    },
    destroy() {
      for (const t of allTexts) {
        t.destroy();
      }
      allTexts.length = 0;
      textsById.clear();
    },
  };
}
