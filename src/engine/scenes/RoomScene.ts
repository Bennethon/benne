import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  facingFromWorldDelta,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  type CardinalFacing,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation';
import { gameEvents } from '../events/EventBus';
import {
  PLAYER_WALK_START,
  PLAYER_WALK_STOP,
  type PlayerWalkStartPayload,
  type PlayerWalkStopPayload,
} from '../events/playerWalkEvents';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import { isPointInWalkableArea } from '../walkable';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { RoomData, RoomHotspotData } from '../../types/room';
import type { RoomCharacterSpawn, RoomSceneStartData } from './BootScene';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

export class RoomScene extends Phaser.Scene {
  private roomData!: RoomData;

  /** Player Aseprite sprite; null if no matching `startingPlayerCharacter` in the room. */
  player: DirectionalCharacterSprite | null = null;

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;

    attachPostProcessingPlaceholder(this.cameras.main);

    const w = getInternalWidth();
    const h = getInternalHeight();

    this.add.image(0, 0, data.backgroundTextureKey).setOrigin(0, 0).setDisplaySize(w, h);

    data.room.hotspots.forEach((hotspot) => this.createHotspot(data.room.id, hotspot));
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));

    this.input.on('pointerdown', this.handleRoomPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.stopPlayerMoveTween(true);
    });
  }

  private readonly handleRoomPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.leftButtonDown()) {
      return;
    }

    const hits = this.input.hitTestPointer(pointer);
    if (hits.length > 0) {
      return;
    }

    if (!this.player) {
      return;
    }

    const { x: worldX, y: worldY } = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (!isPointInWalkableArea(worldX, worldY, this.roomData.walkable.polygons)) {
      return;
    }

    this.movePlayerToward(worldX, worldY);
  };

  /**
   * Stops the current walk tween if any. When `emitStop` is true, emits {@link PLAYER_WALK_STOP}
   * with reason `interrupted` (used when tearing down the scene).
   */
  private stopPlayerMoveTween(emitStop: boolean): void {
    if (!this.playerMoveTween) {
      return;
    }
    const tween = this.playerMoveTween;
    this.playerMoveTween = null;
    tween.stop();
    if (emitStop && this.player) {
      const facing = (this.player.getData('facing') as CardinalFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
  }

  private movePlayerToward(destX: number, destY: number): void {
    const sprite = this.player;
    if (!sprite) {
      return;
    }

    const walkSpeed = sprite.getData('walkSpeed') as number | undefined;
    const speed = typeof walkSpeed === 'number' && walkSpeed > 0 ? walkSpeed : 88;

    const dx = destX - sprite.x;
    const dy = destY - sprite.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_WALK_DISTANCE_PX) {
      return;
    }

    if (this.playerMoveTween) {
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
    this.stopPlayerMoveTween(false);

    const facing = facingFromWorldDelta(dx, dy);
    playDirectionalAnimation(sprite, 'Walk', facing);

    const durationMs = Math.max(1, Math.round((distance / speed) * 1000));

    gameEvents.emit(PLAYER_WALK_START, {
      roomId: this.roomData.id,
      targetX: destX,
      targetY: destY,
    } satisfies PlayerWalkStartPayload);

    const moveTween = this.tweens.add({
      targets: sprite,
      x: destX,
      y: destY,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => {
        this.onPlayerWalkTweenComplete(moveTween, facing);
      },
      onStop: () => {
        this.onPlayerWalkTweenStopped(moveTween);
      },
    });

    this.playerMoveTween = moveTween;
  }

  private onPlayerWalkTweenComplete(tween: Phaser.Tweens.Tween, facing: CardinalFacing): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
    if (this.player) {
      playDirectionalAnimation(this.player, 'Idle', facing);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'complete',
    } satisfies PlayerWalkStopPayload);
  }

  private onPlayerWalkTweenStopped(tween: Phaser.Tweens.Tween): void {
    if (this.playerMoveTween !== tween) {
      return;
    }
    this.playerMoveTween = null;
    if (this.player) {
      const facing =
        (this.player.getData('facing') as CardinalFacing | undefined) ?? resolveInitialIdleFacing(this.player);
      playDirectionalAnimation(this.player, 'Idle', facing);
    }
    gameEvents.emit(PLAYER_WALK_STOP, {
      roomId: this.roomData.id,
      reason: 'interrupted',
    } satisfies PlayerWalkStopPayload);
  }

  private createHotspot(roomId: string, hotspot: RoomHotspotData): void {
    const centerX = hotspot.x + hotspot.width / 2;
    const centerY = hotspot.y + hotspot.height / 2;
    const zone = this.add
      .zone(centerX, centerY, hotspot.width, hotspot.height)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      if (hotspot.onLook) {
        console.log(`[Benne] LOOK ${hotspot.id} -> ${hotspot.onLook}`);
        gameEvents.emit(hotspot.onLook, { hotspotId: hotspot.id, roomId });
      }
    });
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(spawn.x, spawn.y, spawn.textureKey).setOrigin(0.5, 1);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(spawn.x, spawn.y, spawn.textureKey).setOrigin(0.5, 1);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    const isPlayer = spawn.data.id === getStartingPlayerCharacterId();
    sprite.setData('isPlayer', isPlayer);

    sprite.anims.createFromAseprite(spawn.textureKey);
    attachDirectionalAnimationApi(sprite);

    const facing = resolveInitialIdleFacing(sprite);
    playDirectionalAnimation(sprite, 'Idle', facing);

    this.attachCharacterInteraction(roomId, spawn, sprite);

    if (isPlayer) {
      this.player = sprite as DirectionalCharacterSprite;
    }
  }

  private attachCharacterInteraction(
    roomId: string,
    spawn: RoomCharacterSpawn,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  ): void {
    const onLook = spawn.data.onLook;
    if (!spawn.data.clickable || !onLook) {
      return;
    }

    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      console.log(`[Benne] LOOK character ${spawn.data.id} -> ${onLook}`);
      gameEvents.emit(onLook, {
        characterId: spawn.data.id,
        instanceId: spawn.instanceId,
        roomId,
        description: spawn.data.description,
      });
    });
  }
}
