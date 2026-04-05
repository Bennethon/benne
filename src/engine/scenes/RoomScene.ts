import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  facingFromWorldDelta,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  resolveSpawnIdleFacing,
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
import { applyCharacterAnimationClips, setupCharacterAsepritePlayback } from '../characterAnimationPlayback';
import { getGameSettings } from '../ConfigManager';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import { clampWalkDestinationTowardClick } from '../walkable';
import type { RoomPropInteractPayload } from '../events/propInteractionEvents';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { RoomData, RoomHotspotData } from '../../types/room';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/** Props use `zIndex`; characters render above this baseline. */
const CHARACTER_SCENE_DEPTH = 10_000;

/** Walkable / prop debug strokes render above characters. */
const DEBUG_OVERLAY_DEPTH = 20_000;

/** Outline color for `debug.showWalkable` (green). */
const DEBUG_WALKABLE_STROKE = 0x33dd66;
/** Hole rings under an active walkable polygon (debug). */
const DEBUG_WALKABLE_HOLE_STROKE = 0x229955;
/** Outline color for `debug.showPropOutlines` (magenta). */
const DEBUG_PROP_COLLIDER_STROKE = 0xff44cc;

function mergeRoomPropAnimationClips(spawns: readonly RoomPropSpawn[]): CharacterAnimationsConfig {
  const out: CharacterAnimationsConfig = {};
  for (const s of spawns) {
    if (s.data.animations) {
      Object.assign(out, s.data.animations);
    }
  }
  return out;
}

export class RoomScene extends Phaser.Scene {
  private roomData!: RoomData;

  /** Player Aseprite sprite; null if no matching `startingPlayerCharacter` in the room. */
  player: DirectionalCharacterSprite | null = null;

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;

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

    if (data.backgroundTextureKey) {
      this.add.image(0, 0, data.backgroundTextureKey).setOrigin(0, 0).setDisplaySize(w, h);
    }

    this.spawnRoomProps(data, w, h);

    const sortedHotspots = [...data.room.hotspots].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    sortedHotspots.forEach((hotspot) => this.createHotspot(data.room.id, hotspot));
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));

    this.drawRoomDebugOverlays(data);

    this.input.mouse?.disableContextMenu();

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

    const dest = clampWalkDestinationTowardClick(
      this.player.x,
      this.player.y,
      worldX,
      worldY,
      this.roomData.walkable.polygons,
    );
    if (!dest) {
      return;
    }

    this.movePlayerToward(dest.x, dest.y);
  };

  /**
   * Stops the current walk tween if any. When `emitStop` is true, emits {@link PLAYER_WALK_STOP}
   * with reason `interrupted` (used when tearing down the scene).
   */
  private stopPlayerMoveTween(emitStop: boolean): void {
    this.walkArriveCallback = null;
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

  private movePlayerToward(destX: number, destY: number, onArrive?: () => void): void {
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
      onArrive?.();
      return;
    }

    if (this.playerMoveTween) {
      gameEvents.emit(PLAYER_WALK_STOP, {
        roomId: this.roomData.id,
        reason: 'interrupted',
      } satisfies PlayerWalkStopPayload);
    }
    this.stopPlayerMoveTween(false);

    this.walkArriveCallback = onArrive ?? null;

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
    const arrive = this.walkArriveCallback;
    this.walkArriveCallback = null;
    arrive?.();
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

  private drawRoomDebugOverlays(data: RoomSceneStartData): void {
    const debug = getGameSettings().debug;
    if (!debug?.showWalkable && !debug?.showPropOutlines) {
      return;
    }

    const lineWidth = 1;

    if (debug.showWalkable) {
      const gOuter = this.add.graphics();
      const gHoles = this.add.graphics();
      gOuter.lineStyle(lineWidth, DEBUG_WALKABLE_STROKE, 1);
      gHoles.lineStyle(lineWidth, DEBUG_WALKABLE_HOLE_STROKE, 1);
      for (const poly of this.roomData.walkable.polygons) {
        if (poly.active === false || poly.points.length < 3) {
          continue;
        }
        const vecs = poly.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        gOuter.strokePoints(vecs, true);
        for (const h of poly.holes ?? []) {
          if (h.active === false || h.points.length < 3) {
            continue;
          }
          const hv = h.points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
          gHoles.strokePoints(hv, true);
        }
      }
      gOuter.setDepth(DEBUG_OVERLAY_DEPTH);
      gHoles.setDepth(DEBUG_OVERLAY_DEPTH);
    }

    if (debug.showPropOutlines) {
      const g = this.add.graphics();
      g.lineStyle(lineWidth, DEBUG_PROP_COLLIDER_STROKE, 1);
      for (const spawn of data.props) {
        const pts = spawn.data.collider?.points;
        if (!pts || pts.length < 3) {
          continue;
        }
        const vecs = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
        g.strokePoints(vecs, true);
      }
      g.setDepth(DEBUG_OVERLAY_DEPTH + 1);
    }
  }

  private spawnRoomProps(data: RoomSceneStartData, w: number, h: number): void {
    const textureKey = data.roomPropsTextureKey;
    if (!textureKey || data.props.length === 0) {
      return;
    }

    const mergedClips = mergeRoomPropAnimationClips(data.props);
    const sorted = [...data.props].sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));

    // Must use the scene AnimationManager (no `target` sprite). Passing a sprite registers clips only on
    // that sprite; other props would never get `play()` and would stay on atlas frame 0 (often untagged).
    const created = this.anims.createFromAseprite(textureKey);
    applyCharacterAnimationClips(created, mergedClips);

    for (const spawn of sorted) {
      const sprite = this.add.sprite(spawn.x, spawn.y, textureKey).setOrigin(0, 0);
      sprite.setDisplaySize(w, h);
      sprite.setVisible(spawn.data.visible !== false);
      sprite.setAlpha(spawn.data.alpha ?? 1);
      sprite.setDepth(spawn.data.zIndex ?? 0);

      if (!this.anims.exists(spawn.tag)) {
        console.warn(`[Benne] Room prop '${spawn.id}' uses unknown Aseprite tag '${spawn.tag}'.`);
      } else {
        sprite.play(spawn.tag);
      }

      this.setupRoomProp(data.room.id, spawn, sprite);
    }
  }

  private setupRoomProp(roomId: string, spawn: RoomPropSpawn, sprite: Phaser.GameObjects.Sprite): void {
    const d = spawn.data;
    if (!d.clickable) {
      return;
    }
    if (d.visible === false) {
      return;
    }

    const pts = d.collider?.points;
    if (!pts || pts.length < 3) {
      console.warn(`[Benne] Clickable prop '${spawn.id}' needs a collider polygon (at least 3 points).`);
      return;
    }
    if (!d.walkToPoint || !d.lookAtPoint) {
      console.warn(`[Benne] Clickable prop '${spawn.id}' needs walkToPoint and lookAtPoint.`);
      return;
    }

    const flat = pts.flatMap((p) => [p.x - spawn.x, p.y - spawn.y]);
    const poly = new Phaser.Geom.Polygon(flat);
    sprite.setInteractive({
      hitArea: poly,
      hitAreaCallback: Phaser.Geom.Polygon.Contains,
      useHandCursor: true,
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && spawn.data.onLook) {
        this.beginPropInteraction(roomId, spawn, spawn.data.onLook, 'look');
        return;
      }
      if (pointer.rightButtonDown() && spawn.data.onUse) {
        this.beginPropInteraction(roomId, spawn, spawn.data.onUse, 'use');
      }
    });
  }

  /**
   * Walks the player to the prop’s `walkToPoint`, faces `lookAtPoint`, then emits the given event id.
   * Use from room scripts when triggering the same path as a click.
   */
  tryBeginPropLook(roomId: string, spawn: RoomPropSpawn): void {
    const ev = spawn.data.onLook;
    if (!ev) {
      return;
    }
    this.beginPropInteraction(roomId, spawn, ev, 'look');
  }

  private beginPropInteraction(
    roomId: string,
    spawn: RoomPropSpawn,
    eventId: string,
    kind: 'look' | 'use',
  ): void {
    const player = this.player;
    if (!player || !spawn.data.clickable) {
      return;
    }

    const walk = spawn.data.walkToPoint;
    const look = spawn.data.lookAtPoint;
    if (!walk || !look) {
      return;
    }

    const dest = clampWalkDestinationTowardClick(
      player.x,
      player.y,
      walk.x,
      walk.y,
      this.roomData.walkable.polygons,
    );
    if (!dest) {
      return;
    }

    const runArrival = (): void => {
      this.finishPropInteractionAfterWalk(roomId, spawn, look.x, look.y, eventId, kind);
    };

    this.movePlayerToward(dest.x, dest.y, runArrival);
  }

  private finishPropInteractionAfterWalk(
    roomId: string,
    spawn: RoomPropSpawn,
    lookAtX: number,
    lookAtY: number,
    eventId: string,
    kind: 'look' | 'use',
  ): void {
    const player = this.player;
    if (!player) {
      return;
    }

    const facing = facingFromWorldDelta(lookAtX - player.x, lookAtY - player.y);
    playDirectionalAnimation(player, 'Idle', facing);

    const label = kind === 'use' ? 'USE' : 'LOOK';
    console.log(`[Benne] ${label} prop ${spawn.id} -> ${eventId}`);
    gameEvents.emit(eventId, {
      propId: spawn.id,
      roomId,
      tag: spawn.tag,
      description: spawn.data.description,
      kind,
    } satisfies RoomPropInteractPayload);
  }

  private createHotspot(roomId: string, hotspot: RoomHotspotData): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    const usePoly = pts !== undefined && pts.length >= 3;

    const w = getInternalWidth();
    const h = getInternalHeight();
    const depth = 8000 + (hotspot.zIndex ?? 0);

    const emitLook = (): void => {
      if (hotspot.onLook) {
        console.log(`[Benne] LOOK ${hotspot.id} -> ${hotspot.onLook}`);
        gameEvents.emit(hotspot.onLook, { hotspotId: hotspot.id, roomId });
      }
    };

    if (usePoly) {
      const zone = this.add.zone(0, 0, w, h).setOrigin(0, 0).setDepth(depth);
      const flat: number[] = [];
      for (const p of pts) {
        flat.push(p.x, p.y);
      }
      const geom = new Phaser.Geom.Polygon(flat);
      zone.setInteractive(geom, Phaser.Geom.Polygon.Contains);
      zone.input!.cursor = 'pointer';
      zone.on('pointerdown', emitLook);
      return;
    }

    const x = hotspot.x ?? 0;
    const y = hotspot.y ?? 0;
    const bw = hotspot.width ?? 0;
    const bh = hotspot.height ?? 0;
    if (bw <= 0 || bh <= 0) {
      return;
    }
    const zone = this.add
      .zone(x + bw / 2, y + bh / 2, bw, bh)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', emitLook);
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(spawn.x, spawn.y, spawn.textureKey).setOrigin(0.5, 1);
    sprite.setDepth(CHARACTER_SCENE_DEPTH + (spawn.zIndex ?? 0));
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    this.attachCharacterInteraction(roomId, spawn, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(spawn.x, spawn.y, spawn.textureKey).setOrigin(0.5, 1);
    sprite.setDepth(CHARACTER_SCENE_DEPTH + (spawn.zIndex ?? 0));
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    const isPlayer = spawn.data.id === getStartingPlayerCharacterId();
    sprite.setData('isPlayer', isPlayer);

    const createdAnims = sprite.anims.createFromAseprite(spawn.textureKey);
    setupCharacterAsepritePlayback(sprite, spawn.data, createdAnims);
    attachDirectionalAnimationApi(sprite);

    const animBase = spawn.initialAnimation ?? 'Idle';
    const facing = resolveSpawnIdleFacing(sprite, spawn.initialFacing);
    playDirectionalAnimation(sprite, animBase, facing);

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
    if (spawn.visible === false) {
      return;
    }
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
