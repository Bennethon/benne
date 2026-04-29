import type * as Phaser from 'phaser';
import { getAsepriteSpriteSourceInset } from '../engine/aseprite/asepriteFramePlacement';
import type { GameSettings, GameSettingsCursor, GameSettingsCursorHotspot } from '../types/game';

/** Phaser texture / animation atlas key for `images/cursor/cursor.{png,json}`. */
export const CURSOR_TEXTURE_KEY = 'aseprite:cursor';

/** Allowed `game-config.json` `cursor.hotspot` string values. */
export const CURSOR_HOTSPOT_PRESETS: readonly GameSettingsCursorHotspot[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'custom',
];

/** @internal Exported for {@link assertCursorSettings} tests of allowed literals. */
export function isValidGameSettingsCursorHotspot(value: string): value is GameSettingsCursorHotspot {
  return (CURSOR_HOTSPOT_PRESETS as readonly string[]).includes(value);
}

/**
 * Places the cursor sprite so the configured hotspot aligns with `pointer` (game / canvas space).
 */
export function applyGameCursorSpriteHotspot(
  sprite: Phaser.GameObjects.Sprite,
  pointer: { x: number; y: number },
  cursor: GameSettingsCursor,
): void {
  const mode = cursor.hotspot ?? 'top-left';
  if (mode === 'custom') {
    const p = cursor.hotspotPixel;
    const hx = p !== undefined && Number.isFinite(p.x) ? p.x : 0;
    const hy = p !== undefined && Number.isFinite(p.y) ? p.y : 0;
    sprite.setOrigin(0, 0);
    const inset = getAsepriteSpriteSourceInset(sprite.frame);
    sprite.setPosition(pointer.x - hx - inset.x, pointer.y - hy - inset.y);
    return;
  }
  let ox = 0;
  let oy = 0;
  switch (mode) {
    case 'top-left':
      ox = 0;
      oy = 0;
      break;
    case 'top-center':
      ox = 0.5;
      oy = 0;
      break;
    case 'top-right':
      ox = 1;
      oy = 0;
      break;
    case 'center-left':
      ox = 0;
      oy = 0.5;
      break;
    case 'center':
      ox = 0.5;
      oy = 0.5;
      break;
    case 'center-right':
      ox = 1;
      oy = 0.5;
      break;
    case 'bottom-left':
      ox = 0;
      oy = 1;
      break;
    case 'bottom-center':
      ox = 0.5;
      oy = 1;
      break;
    case 'bottom-right':
      ox = 1;
      oy = 1;
      break;
    default:
      ox = 0;
      oy = 0;
  }
  sprite.setOrigin(ox, oy);
  const inset = getAsepriteSpriteSourceInset(sprite.frame);
  sprite.setPosition(pointer.x - inset.x, pointer.y - inset.y);
}

export function getCursorAsepriteAssetPaths(): { png: string; json: string } {
  return { png: 'images/cursor/cursor.png', json: 'images/cursor/cursor.json' };
}

/** True when `game-config.json` requests the bundled Aseprite cursor with usable tag names. */
export function isBenneGameCursorAsepriteEnabled(settings: GameSettings): boolean {
  const c = settings.cursor;
  if (!c || c.display?.aseprite !== true) {
    return false;
  }
  return (
    typeof c.idleAnimation === 'string' &&
    c.idleAnimation.trim().length > 0 &&
    typeof c.activeAnimation === 'string' &&
    c.activeAnimation.trim().length > 0
  );
}
