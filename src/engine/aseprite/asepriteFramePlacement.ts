import * as Phaser from 'phaser';
import type { GuiSpriteAnchor } from '../../types/gui';

/**
 * Aseprite / TexturePacker-style inset of the **trimmed** bitmap within the logical
 * `sourceSize` cel. Phaser bakes the same values into {@link Phaser.Textures.Frame#x} / `y`
 * when `data.trim` is true; we subtract them from authored coordinates so **control-relative**
 * anchors align to tight pixels instead of the full-cel canvas.
 */
export function getAsepriteSpriteSourceInset(frame: Phaser.Textures.Frame): { x: number; y: number } {
  const d = (frame as unknown as { data: { trim?: boolean; spriteSourceSize?: { x?: number; y?: number } } }).data;
  if (!d.trim) {
    return { x: 0, y: 0 };
  }
  const sx = d.spriteSourceSize?.x ?? 0;
  const sy = d.spriteSourceSize?.y ?? 0;
  return { x: sx, y: sy };
}

/** Visible packed bitmap size, not Phaser's logical `sourceSize` / GameObject width. */
export function getAsepriteVisibleFrameSize(frame: Phaser.Textures.Frame): { w: number; h: number } {
  const fw = (frame as unknown as { cutWidth?: number; width?: number }).cutWidth ?? frame.width;
  const fh = (frame as unknown as { cutHeight?: number; height?: number }).cutHeight ?? frame.height;
  return { w: Math.max(1, Math.round(fw)), h: Math.max(1, Math.round(fh)) };
}

/**
 * - **`screen`**: full-canvas / sheet-canvas placement — Phaser’s frame inset already matches
 *   Aseprite canvas coordinates; keep authored `(x, y)` as the sprite position (after your own
 *   anchor helper sets origin).
 * - **`top-left` | `center`**: control-relative “trim cels” workflow — solve the Phaser sprite
 *   position so authored coordinates refer to the **visible** (trimmed) placement point. Center
 *   origin needs extra compensation because Phaser's object width is the untrimmed `sourceSize`.
 */
export function resolveAuthoredPositionForAsepriteTrim(
  anchor: GuiSpriteAnchor,
  authoredX: number,
  authoredY: number,
  frame: Phaser.Textures.Frame,
): { x: number; y: number } {
  if (anchor === 'screen') {
    return { x: authoredX, y: authoredY };
  }
  const inset = getAsepriteSpriteSourceInset(frame);
  if (anchor === 'center') {
    const d = (frame as unknown as {
      data: {
        sourceSize?: { w?: number; h?: number };
        spriteSourceSize?: { w?: number; h?: number };
      };
    }).data;
    const visible = getAsepriteVisibleFrameSize(frame);
    const sourceW = finiteOr(d.sourceSize?.w, finiteOr(frame.realWidth, visible.w));
    const sourceH = finiteOr(d.sourceSize?.h, finiteOr(frame.realHeight, visible.h));
    const visibleW = finiteOr(d.spriteSourceSize?.w, visible.w);
    const visibleH = finiteOr(d.spriteSourceSize?.h, visible.h);
    return {
      x: authoredX + (sourceW - visibleW) / 2 - inset.x,
      y: authoredY + (sourceH - visibleH) / 2 - inset.y,
    };
  }
  return { x: authoredX - inset.x, y: authoredY - inset.y };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

/**
 * Positions `sprite` from authored coordinates for the given GUI anchor, respecting trimmed
 * Aseprite cels. Call **after** `setFrame` / `play` so `sprite.frame` is correct; set origin
 * separately (e.g. {@link applyGuiSpriteAnchor}).
 */
export function applyAsepriteFramePositioning(
  sprite: Phaser.GameObjects.Sprite,
  anchor: GuiSpriteAnchor,
  authoredX: number,
  authoredY: number,
  devWarnContext?: string,
): void {
  if (import.meta.env.DEV && devWarnContext) {
    warnDevIfAsepriteJsonMissingSpriteSourceSize(sprite.frame, devWarnContext);
  }
  const p = resolveAuthoredPositionForAsepriteTrim(anchor, authoredX, authoredY, sprite.frame);
  sprite.setPosition(Math.round(p.x), Math.round(p.y));
}

const warnedMissingSpriteSourceSize = new Set<string>();

export function warnDevIfAsepriteJsonMissingSpriteSourceSize(
  frame: Phaser.Textures.Frame,
  contextLabel: string,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const raw = (frame as unknown as { customData?: unknown }).customData as
    | { trimmed?: boolean; spriteSourceSize?: unknown }
    | undefined;
  if (raw?.trimmed !== true) {
    return;
  }
  if (raw.spriteSourceSize != null && typeof raw.spriteSourceSize === 'object') {
    return;
  }
  const key = `${frame.texture.key}::${String(frame.name)}::${contextLabel}`;
  if (warnedMissingSpriteSourceSize.has(key)) {
    return;
  }
  warnedMissingSpriteSourceSize.add(key);
  console.warn(
    `[Benne] Aseprite frame "${String(frame.name)}" (${frame.texture.key}) ${contextLabel}: JSON has trimmed=true but no spriteSourceSize — non-standard export.`,
  );
}

/** Reads authored coords from sprite data and reapplies Phaser position (trim-aware). */
export function syncBenneGuiAsepriteAuthoredWorldPosition(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.getData('benneGuiUsesAuthoredAsepritePlacement') !== true) {
    return;
  }
  const ax = sprite.getData('benneGuiAuthoredX') as number | undefined;
  const ay = sprite.getData('benneGuiAuthoredY') as number | undefined;
  const anchor = sprite.getData('benneGuiSpritePlacementAnchor') as GuiSpriteAnchor | undefined;
  if (ax === undefined || ay === undefined || anchor === undefined) {
    return;
  }
  const ox = (sprite.getData('benneGuiAuthoredOffsetX') as number | undefined) ?? 0;
  const oy = (sprite.getData('benneGuiAuthoredOffsetY') as number | undefined) ?? 0;
  const p = resolveAuthoredPositionForAsepriteTrim(anchor, ax + ox, ay + oy, sprite.frame);
  sprite.setPosition(Math.round(p.x), Math.round(p.y));
}

export function wireBenneGuiAsepriteTrimmedPlacementAfterFrameChanges(sprite: Phaser.GameObjects.Sprite): void {
  const sync = (): void => {
    syncBenneGuiAsepriteAuthoredWorldPosition(sprite);
  };
  sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, sync);
  sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, sync);
}

/** Room prop `spritePlacement: "tight"` — reapply after `play` / frame change. */
export function syncBenneRoomPropTightWorldPosition(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.getData('benneRoomPropPlacement') !== 'tight') {
    return;
  }
  const ax = sprite.getData('benneRoomPropAuthoredX') as number | undefined;
  const ay = sprite.getData('benneRoomPropAuthoredY') as number | undefined;
  if (ax === undefined || ay === undefined) {
    return;
  }
  const p = resolveAuthoredPositionForAsepriteTrim('top-left', ax, ay, sprite.frame);
  sprite.setPosition(Math.round(p.x), Math.round(p.y));
}

export function wireBenneRoomPropTightPlacementAfterFrameChanges(sprite: Phaser.GameObjects.Sprite): void {
  const sync = (): void => {
    syncBenneRoomPropTightWorldPosition(sprite);
  };
  sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, sync);
  sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, sync);
}
