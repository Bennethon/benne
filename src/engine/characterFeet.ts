import type { CharacterData } from '../types/character';

/** Pixel offset from the top-left of the character texture frame to the ground contact (feet). */
export type CharacterFeetLocal = { x: number; y: number };

const FEET_LOCAL_X = 'feetLocalX';
const FEET_LOCAL_Y = 'feetLocalY';

/**
 * Resolves feet in frame space: explicit `character.feet`, else bottom-centre of the current frame.
 */
export function resolveCharacterFeetLocal(data: CharacterData, sprite: Phaser.GameObjects.Sprite): CharacterFeetLocal {
  if (data.feet) {
    return { x: data.feet.x, y: data.feet.y };
  }
  const f = sprite.frame;
  return { x: f.width * 0.5, y: f.height };
}

/** Top-left sprite position so world feet sit at `(worldFeetX, worldFeetY)` (accounts for `sprite.scale`). */
export function placeSpriteByFeet(
  sprite: Phaser.GameObjects.Sprite,
  feet: CharacterFeetLocal,
  worldFeetX: number,
  worldFeetY: number,
): void {
  sprite.setOrigin(0, 0);
  const sx = sprite.scaleX;
  const sy = sprite.scaleY;
  sprite.setPosition(worldFeetX - feet.x * sx, worldFeetY - feet.y * sy);
  sprite.setData(FEET_LOCAL_X, feet.x);
  sprite.setData(FEET_LOCAL_Y, feet.y);
}

export function getCharacterWorldFeet(sprite: Phaser.GameObjects.Sprite): { x: number; y: number } {
  const lx = sprite.getData(FEET_LOCAL_X) as number | undefined;
  const ly = sprite.getData(FEET_LOCAL_Y) as number | undefined;
  if (typeof lx !== 'number' || typeof ly !== 'number') {
    return { x: sprite.x, y: sprite.y };
  }
  return { x: sprite.x + lx * sprite.scaleX, y: sprite.y + ly * sprite.scaleY };
}

/** Camera `startFollow` offset so the follow target is the feet, not the sprite top-left. */
export function cameraFollowOffsetForFeet(feet: CharacterFeetLocal): { x: number; y: number } {
  return { x: -feet.x, y: -feet.y };
}
