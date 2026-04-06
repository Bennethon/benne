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
import type { RoomData, RoomHotspotData, RoomPropParallax } from '../../types/room';
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

  /**
   * Tracks the current editor camera mode so the camera can be reconfigured when the
   * panel resizes (`Scale.RESIZE` fires a resize event). Null = game runtime (no editor).
   */
  private editorCameraMode: 'navigate' | 'edit' | null = null;

  private playerMoveTween: Phaser.Tweens.Tween | null = null;

  /** Fired once when a walk tween completes successfully (instant walks may call it without a tween). */
  private walkArriveCallback: (() => void) | null = null;

  /** Props that need per-frame position updates for parallax scrolling. */
  private parallaxProps: Array<{
    sprite: Phaser.GameObjects.Sprite;
    baseX: number;
    baseY: number;
    parallax: RoomPropParallax;
  }> = [];

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;
    this.parallaxProps = [];

    attachPostProcessingPlaceholder(this.cameras.main);

    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const roomW = data.room.size?.width ?? vW;
    const roomH = data.room.size?.height ?? vH;

    if (data.backgroundTextureKey) {
      // Render the background at its natural pixel dimensions — room.size controls camera
      // bounds and walkable extent, not how large the art appears.
      this.add.image(0, 0, data.backgroundTextureKey).setOrigin(0, 0);
    }

    this.spawnRoomProps(data);

    const sortedHotspots = [...data.room.hotspots].sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    sortedHotspots.forEach((hotspot) => this.createHotspot(data.room.id, hotspot, roomW, roomH));
    data.characters.forEach((spawn) => this.spawnCharacter(data.room.id, spawn));

    this.setupRoomCamera(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      this.stopPlayerMoveTween(true);
    });
  }

  /** Configures camera bounds and player follow for the current room. */
  private setupRoomCamera(roomW: number, roomH: number): void {
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    const sb = this.roomData.scrollBounds;
    this.cameras.main.setBounds(
      sb?.x ?? 0,
      sb?.y ?? 0,
      sb?.width ?? roomW,
      sb?.height ?? roomH,
    );
    if (this.player && (roomW > vW || roomH > vH)) {
      this.cameras.main.startFollow(this.player, true);
    }
  }

  update(): void {
    this.updateParallaxProps();
  }

  /**
   * Repositions parallax props based on the current camera scroll.
   *
   * The formula blends between the prop's fixed world position (`depth = 1`) and a
   * fully screen-locked position (`depth = 0`):
   *
   *   worldX = depth * baseX + (1 - depth) * (scrollX + screenAnchorX)
   *
   * `screenAnchorX` is derived from `alignX`: -1 = left edge (0), 0 = center (vW/2), 1 = right edge (vW).
   * `screenAnchorY` is derived from `alignY` with the Y-up convention: -1 = bottom (vH), 1 = top (0).
   */
  private updateParallaxProps(): void {
    if (this.parallaxProps.length === 0) {
      return;
    }

    const cam = this.cameras.main;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    const vW = getInternalWidth();
    const vH = getInternalHeight();

    for (const entry of this.parallaxProps) {
      const { sprite, baseX, baseY, parallax } = entry;
      const depth = parallax.depth;
      const alignX = parallax.alignX ?? 0;
      const alignY = parallax.alignY ?? 0;

      // Screen-space anchor: where the prop converges as depth -> 0.
      // alignX: -1 -> left (0), 0 -> center (vW/2), 1 -> right (vW)
      // alignY: -1 -> bottom (vH in Phaser Y-down), 0 -> center, 1 -> top (0)
      const screenAnchorX = vW / 2 * (1 + alignX);
      const screenAnchorY = vH / 2 * (1 - alignY);

      sprite.x = depth * baseX + (1 - depth) * (scrollX + screenAnchorX);
      sprite.y = depth * baseY + (1 - depth) * (scrollY + screenAnchorY);
    }
  }

  /** Re-applies the current editor camera mode when the preview panel is resized. */
  private readonly onScaleResize = (): void => {
    if (this.editorCameraMode !== null) {
      this.setEditorCameraMode(this.editorCameraMode);
    }
  };

  /**
   * Configures the camera for the editor preview panel (called by `RoomPolygonEditScene`).
   * Not used at game runtime.
   *
   * **Navigate mode** — letterboxes the game's virtual resolution (e.g. 352×198) inside the
   * panel using a camera viewport, maintaining the exact in-game look with player follow.
   *
   * **Edit mode** — expands the camera to fill the entire panel and fits the full room art
   * at the largest zoom that shows everything.  The camera viewport covers the whole canvas
   * so the room art is not constrained to the 16:9 frame.
   */
  setEditorCameraMode(mode: 'navigate' | 'edit'): void {
    this.editorCameraMode = mode;

    const panelW = this.scale.width;
    const panelH = this.scale.height;
    if (panelW <= 0 || panelH <= 0) {
      return;
    }

    const gameW = getInternalWidth();   // game's virtual resolution (e.g. 352)
    const gameH = getInternalHeight();  // game's virtual resolution (e.g. 198)
    const roomW = this.roomData.size?.width ?? gameW;
    const roomH = this.roomData.size?.height ?? gameH;
    const cam = this.cameras.main;

    if (mode === 'navigate') {
      // Letterbox: scale the game viewport (gameW × gameH) to fit the panel, centred.
      const scale = Math.min(panelW / gameW, panelH / gameH);
      const viewW = Math.round(gameW * scale);
      const viewH = Math.round(gameH * scale);
      const viewX = Math.round((panelW - viewW) / 2);
      const viewY = Math.round((panelH - viewH) / 2);
      cam.setViewport(viewX, viewY, viewW, viewH);
      cam.setZoom(scale);

      const sb = this.roomData.scrollBounds;
      cam.setBounds(
        sb?.x ?? 0,
        sb?.y ?? 0,
        sb?.width ?? roomW,
        sb?.height ?? roomH,
      );

      if (this.player && (roomW > gameW || roomH > gameH)) {
        cam.startFollow(this.player, true);
      } else {
        cam.stopFollow();
      }
    } else {
      // Edit mode: full panel viewport, fit the room art inside it.
      cam.stopFollow();
      cam.setViewport(0, 0, panelW, panelH);

      const zoom = Math.min(panelW / roomW, panelH / roomH);
      cam.setZoom(zoom);

      // Room bounds — Phaser's clampX/Y will position the room at the canvas top-left.
      cam.setBounds(0, 0, roomW, roomH);
      cam.scrollX = 0;
      cam.scrollY = 0;
    }
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

  private spawnRoomProps(data: RoomSceneStartData): void {
    const textureKey = data.roomPropsTextureKey;
    if (!textureKey || data.props.length === 0) {
      return;
    }

    this.parallaxProps = [];

    const mergedClips = mergeRoomPropAnimationClips(data.props);
    const sorted = [...data.props].sort((a, b) => (a.data.zIndex ?? 0) - (b.data.zIndex ?? 0));

    // Must use the scene AnimationManager (no `target` sprite). Passing a sprite registers clips only on
    // that sprite; other props would never get `play()` and would stay on atlas frame 0 (often untagged).
    const created = this.anims.createFromAseprite(textureKey);
    applyCharacterAnimationClips(created, mergedClips);

    for (const spawn of sorted) {
      // Props render at their natural Aseprite frame dimensions. For full-room composite
      // sheets (the typical BENNE workflow) each frame already covers the full room width
      // and height, so no explicit setDisplaySize is needed.
      const sprite = this.add.sprite(spawn.x, spawn.y, textureKey).setOrigin(0, 0);
      sprite.setVisible(spawn.data.visible !== false);
      sprite.setAlpha(spawn.data.alpha ?? 1);
      sprite.setDepth(spawn.data.zIndex ?? 0);

      if (!this.anims.exists(spawn.tag)) {
        console.warn(`[Benne] Room prop '${spawn.id}' uses unknown Aseprite tag '${spawn.tag}'.`);
      } else {
        sprite.play(spawn.tag);
      }

      if (spawn.data.parallax !== undefined && spawn.data.parallax.depth !== 1) {
        this.parallaxProps.push({
          sprite,
          baseX: spawn.x,
          baseY: spawn.y,
          parallax: spawn.data.parallax,
        });
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

  private createHotspot(roomId: string, hotspot: RoomHotspotData, roomW: number, roomH: number): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    const usePoly = pts !== undefined && pts.length >= 3;

    const depth = 8000 + (hotspot.zIndex ?? 0);

    const emitLook = (): void => {
      if (hotspot.onLook) {
        console.log(`[Benne] LOOK ${hotspot.id} -> ${hotspot.onLook}`);
        gameEvents.emit(hotspot.onLook, { hotspotId: hotspot.id, roomId });
      }
    };

    if (usePoly) {
      const zone = this.add.zone(0, 0, roomW, roomH).setOrigin(0, 0).setDepth(depth);
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
