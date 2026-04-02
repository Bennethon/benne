import * as Phaser from 'phaser';

/** Matches Aseprite frame-tag suffix convention (IdleL, WalkR, …). */
export type CardinalFacing = 'L' | 'R' | 'D' | 'U';

/** 4-way facing from a world movement vector (y+ is down on screen). */
export function facingFromWorldDelta(dx: number, dy: number): CardinalFacing {
  if (dx === 0 && dy === 0) {
    return 'D';
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'R' : 'L';
  }
  return dy > 0 ? 'D' : 'U';
}

export interface DirectionalCharacterSprite extends Phaser.GameObjects.Sprite {
  playDirectionalAnimation(baseName: string, direction: CardinalFacing): void;
}

/**
 * Picks IdleR, else IdleD, else IdleL, else IdleU — first tag that exists on this sprite’s local anims.
 * Aligns with “start facing right or down” when tags exist.
 */
export function resolveInitialIdleFacing(sprite: Phaser.GameObjects.Sprite): CardinalFacing {
  const order: CardinalFacing[] = ['R', 'D', 'L', 'U'];
  for (const dir of order) {
    if (sprite.anims.exists(`Idle${dir}`)) {
      return dir;
    }
  }
  return 'D';
}

/**
 * Plays `<baseName><direction>` (e.g. IdleR). Horizontal mirroring: if R (or L) variant is missing,
 * uses the opposite horizontal tag with `setFlipX`.
 */
export function playDirectionalAnimation(
  sprite: Phaser.GameObjects.Sprite,
  baseName: string,
  direction: CardinalFacing,
): void {
  const tryPlay = (key: string, flipX: boolean): boolean => {
    if (!sprite.anims.exists(key)) {
      return false;
    }
    const anim = sprite.anims.get(key);
    if (!anim || anim.frames.length === 0) {
      console.warn(`[Benne] Animation '${key}' has no frames (check Aseprite JSON / Phaser frame keys).`);
      return false;
    }
    sprite.setFlipX(flipX);
    sprite.play(key);
    sprite.setData('facing', direction);
    sprite.setData('facingBase', baseName);
    return true;
  };

  if (direction === 'D' || direction === 'U') {
    tryPlay(`${baseName}${direction}`, false);
    return;
  }

  if (direction === 'R') {
    if (tryPlay(`${baseName}R`, false)) {
      return;
    }
    tryPlay(`${baseName}L`, true);
    return;
  }

  if (tryPlay(`${baseName}L`, false)) {
    return;
  }
  tryPlay(`${baseName}R`, true);
}

/** Attaches `playDirectionalAnimation` on the sprite instance (local method style). */
export function attachDirectionalAnimationApi(sprite: Phaser.GameObjects.Sprite): DirectionalCharacterSprite {
  const extended = sprite as DirectionalCharacterSprite;
  extended.playDirectionalAnimation = (baseName: string, direction: CardinalFacing): void => {
    playDirectionalAnimation(extended, baseName, direction);
  };
  return extended;
}
