import * as Phaser from 'phaser';
import {
  attachDirectionalAnimationApi,
  facingFromWorldDelta,
  playDirectionalAnimation,
  resolveInitialIdleFacing,
  resolveSpawnIdleFacing,
  type CharacterFacing,
  type DirectionalCharacterSprite,
} from '../directionalCharacterAnimation';
import { gameEvents } from '../events/EventBus';
import {
  CHARACTER_SAY_REQUESTED_EVENT,
  type CharacterSayRequestedPayload,
} from '../scripting/scriptingEvents';
import { computeSpeechDurationMs } from '../speechTiming';
import { BENNE_SPEECH_FONT_CACHE_KEY } from '../speechFontKey';
import {
  PLAYER_WALK_START,
  PLAYER_WALK_STOP,
  type PlayerWalkStartPayload,
  type PlayerWalkStopPayload,
} from '../events/playerWalkEvents';
import { applyCharacterAnimationClips, setupCharacterAsepritePlayback } from '../characterAnimationPlayback';
import { getGameSettings } from '../ConfigManager';
import { attachPostProcessingPlaceholder } from '../postfx/PostEffects';
import {
  cameraFollowOffsetForFeet,
  getCharacterWorldFeet,
  placeSpriteByFeet,
  resolveCharacterFeetLocal,
} from '../characterFeet';
import { clampWalkDestinationTowardClick } from '../walkable';
import { dispatchVerbInteraction } from '../verbs/dispatchVerb';
import {
  getCharacterVerbHandlers,
  getHotspotVerbHandlers,
  getPropVerbHandlers,
} from '../verbs/normalizeHandlers';
import { getEffectiveTwoVerbProfile } from '../verbs/verbConfig';
import { resolveVerbIdFromPointer } from '../verbs/resolvePointerVerb';
import { getInternalHeight, getInternalWidth, getStartingPlayerCharacterId, SCENE_ROOM } from '../../game/constants';
import type { CharacterAnimationsConfig } from '../../types/character';
import type { CharacterData } from '../../types/character';
import type { RoomData, RoomHotspotData } from '../../types/room';
import type { RoomCharacterSpawn, RoomPropSpawn, RoomSceneStartData } from './BootScene';

/** Overhead subtitles sit above character sprites but below debug overlays. */
const SPEECH_SUBTITLE_DEPTH = 15_000;

/** Ignore walk clicks when already within this many pixels of the target. */
const MIN_WALK_DISTANCE_PX = 6;

/** Props use `zIndex`; characters render above this baseline. */
const CHARACTER_SCENE_DEPTH = 10_000;

/** Walkable / prop debug strokes render above characters. */
const DEBUG_OVERLAY_DEPTH = 20_000;

/** `startFollow` offset so the camera tracks {@link getCharacterWorldFeet}, not the sprite top-left. */
function getFeetFollowOffset(player: Phaser.GameObjects.Sprite): { x: number; y: number } {
  const lx = player.getData('feetLocalX') as number | undefined;
  const ly = player.getData('feetLocalY') as number | undefined;
  if (typeof lx === 'number' && typeof ly === 'number') {
    return cameraFollowOffsetForFeet({ x: lx, y: ly });
  }
  const data = player.getData('character') as CharacterData | undefined;
  const feet = data ? resolveCharacterFeetLocal(data, player) : { x: player.frame.width * 0.5, y: player.frame.height };
  return cameraFollowOffsetForFeet(feet);
}

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
    parallaxDepth: number;
  }> = [];

  /**
   * Last spawned sprite per `CharacterData.id` (same id twice → last wins).
   * Used by {@link CHARACTER_SAY_REQUESTED_EVENT}.
   */
  private readonly characterSpritesByCharacterId = new Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
  >();

  private speechFontLoaded = false;

  private activeSpeechLine: {
    subtitle: Phaser.GameObjects.Text;
    target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    facing: CharacterFacing;
    complete: () => void;
    endTimer: Phaser.Time.TimerEvent;
  } | null = null;

  constructor() {
    super(SCENE_ROOM);
  }

  create(data: RoomSceneStartData): void {
    this.roomData = data.room;
    this.player = null;
    this.playerMoveTween = null;
    this.parallaxProps = [];
    this.characterSpritesByCharacterId.clear();
    this.speechFontLoaded = data.speechFontLoaded === true;
    this.activeSpeechLine = null;

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
    this.applyPlayerCameraFollow(roomW, roomH);
    this.drawRoomDebugOverlays(data);

    this.input.mouse?.disableContextMenu();

    this.scale.on('resize', this.onScaleResize, this);
    this.input.on('pointerdown', this.handleRoomPointerDown);
    gameEvents.on(CHARACTER_SAY_REQUESTED_EVENT, this.onCharacterSayRequested, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onScaleResize, this);
      this.input.off('pointerdown', this.handleRoomPointerDown);
      gameEvents.off(CHARACTER_SAY_REQUESTED_EVENT, this.onCharacterSayRequested, this);
      this.teardownActiveSpeechLine(true);
      this.stopPlayerMoveTween(true);
    });
  }

  /** Configures camera bounds and player follow for the current room. */
  private setupRoomCamera(roomW: number, roomH: number): void {
    const sb = this.roomData.scrollBounds;
    this.cameras.main.setBounds(
      sb?.x ?? 0,
      sb?.y ?? 0,
      sb?.width ?? roomW,
      sb?.height ?? roomH,
    );
  }

  /** Starts follow on the player’s feet (see `CharacterData.feet`). */
  private applyPlayerCameraFollow(roomW: number, roomH: number): void {
    const vW = getInternalWidth();
    const vH = getInternalHeight();
    if (!this.player || (roomW <= vW && roomH <= vH)) {
      return;
    }
    const feet = getFeetFollowOffset(this.player);
    this.cameras.main.startFollow(this.player, true, 1, 1, feet.x, feet.y);
  }

  update(): void {
    this.updateParallaxProps();
    this.updateSpeechSubtitlePosition();
  }

  private canPlayDirectionalCharacter(
    go: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ): go is DirectionalCharacterSprite {
    return (
      go instanceof Phaser.GameObjects.Sprite &&
      typeof (go as DirectionalCharacterSprite).playDirectionalAnimation === 'function'
    );
  }

  private resolveSpeechFacing(
    go: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ): CharacterFacing {
    const fromData = go.getData('facing') as CharacterFacing | undefined;
    if (fromData !== undefined) {
      return fromData;
    }
    if (this.canPlayDirectionalCharacter(go)) {
      return resolveInitialIdleFacing(go);
    }
    return 'D';
  }

  private updateSpeechSubtitlePosition(): void {
    const line = this.activeSpeechLine;
    if (!line) {
      return;
    }
    const { subtitle, target } = line;
    if (!subtitle.active || !target.active) {
      return;
    }
    const cx = target.x + target.displayWidth * 0.5;
    const cy = target.y - 4;
    subtitle.setPosition(cx, cy);
  }

  private readonly onCharacterSayRequested = (payload: CharacterSayRequestedPayload): void => {
    const target = this.characterSpritesByCharacterId.get(payload.characterId);
    if (!target) {
      console.warn(`[Benne] say(): no character '${payload.characterId}' in this room.`);
      payload.complete();
      return;
    }

    this.replaceOrFinishPriorSpeechLine(target);

    if (
      payload.characterId === getStartingPlayerCharacterId() &&
      this.player &&
      target === this.player
    ) {
      this.stopPlayerMoveTween(true);
    }

    const facing = this.resolveSpeechFacing(target);
    if (this.canPlayDirectionalCharacter(target)) {
      playDirectionalAnimation(target, 'Talk', facing);
    }

    const speechCfg = getGameSettings().speech;
    const fontSize = speechCfg?.fontSize ?? 9;
    const maxWidth = speechCfg?.maxWidth ?? 220;
    const scale = speechCfg?.lineDurationScale ?? 1;
    const durationMs = computeSpeechDurationMs(payload.text, scale);

    const subtitle = this.add.text(0, 0, payload.text, {
      fontFamily: this.speechFontLoaded ? BENNE_SPEECH_FONT_CACHE_KEY : 'monospace',
      fontSize: `${fontSize}px`,
      color: '#f5f5f5',
      align: 'center',
      stroke: '#0a0a0a',
      strokeThickness: 4,
      wordWrap: { width: maxWidth, useAdvancedWrap: true },
    });
    subtitle.setOrigin(0.5, 1);
    subtitle.setDepth(SPEECH_SUBTITLE_DEPTH);
    subtitle.setScrollFactor(1);
    this.updateSpeechSubtitlePosition();

    const endTimer = this.time.delayedCall(durationMs, () => {
      this.finishSpeechLineNaturally();
    });

    this.activeSpeechLine = {
      subtitle,
      target,
      facing,
      complete: payload.complete,
      endTimer,
    };
  };

  /**
   * Completes a prior `say()` promise, removes UI, and returns the previous speaker to `Idle`
   * when the new line is spoken by someone else.
   */
  private replaceOrFinishPriorSpeechLine(nextTarget: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): void {
    const cur = this.activeSpeechLine;
    if (!cur) {
      return;
    }
    cur.endTimer.remove(false);
    cur.subtitle.destroy();
    this.activeSpeechLine = null;
    const sameSpeaker = cur.target === nextTarget;
    if (!sameSpeaker && this.canPlayDirectionalCharacter(cur.target)) {
      playDirectionalAnimation(cur.target, 'Idle', cur.facing);
    }
    cur.complete();
  }

  private finishSpeechLineNaturally(): void {
    const cur = this.activeSpeechLine;
    if (!cur) {
      return;
    }
    this.activeSpeechLine = null;
    cur.subtitle.destroy();
    if (this.canPlayDirectionalCharacter(cur.target)) {
      playDirectionalAnimation(cur.target, 'Idle', cur.facing);
    }
    cur.complete();
  }

  /** Scene shutdown: dismiss line without restoring Idle (scene is leaving). */
  private teardownActiveSpeechLine(callComplete: boolean): void {
    const cur = this.activeSpeechLine;
    if (!cur) {
      return;
    }
    cur.endTimer.remove(false);
    cur.subtitle.destroy();
    this.activeSpeechLine = null;
    if (callComplete) {
      cur.complete();
    }
  }

  /**
   * Repositions parallax props: blends authored world `(x,y)` with the top-left of the visible
   * world rect (`camera.worldView`). Using `scrollX`/`scrollY` is wrong when zoom ≠ 1 (e.g. editor
   * navigate mode letterboxes with `setZoom(scale)`); `worldView` matches what the player sees and
   * stays stable when only the preview panel size changes.
   */
  private updateParallaxProps(): void {
    if (this.parallaxProps.length === 0) {
      return;
    }

    const cam = this.cameras.main;
    const anchorX = cam.worldView.x;
    const anchorY = cam.worldView.y;

    for (const entry of this.parallaxProps) {
      const { sprite, baseX, baseY, parallaxDepth: d } = entry;
      sprite.x = d * baseX + (1 - d) * anchorX;
      sprite.y = d * baseY + (1 - d) * anchorY;
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
        const feet = getFeetFollowOffset(this.player);
        cam.startFollow(this.player, true, 1, 1, feet.x, feet.y);
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

    const feet = getCharacterWorldFeet(this.player);
    const dest = clampWalkDestinationTowardClick(
      feet.x,
      feet.y,
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
      const facing = (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
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

    let lx = sprite.getData('feetLocalX') as number | undefined;
    let ly = sprite.getData('feetLocalY') as number | undefined;
    if (typeof lx !== 'number' || typeof ly !== 'number') {
      const data = sprite.getData('character') as CharacterData | undefined;
      const resolved = data
        ? resolveCharacterFeetLocal(data, sprite)
        : { x: sprite.frame.width * 0.5, y: sprite.frame.height };
      lx = resolved.x;
      ly = resolved.y;
      sprite.setData('feetLocalX', lx);
      sprite.setData('feetLocalY', ly);
    }

    const feetNow = getCharacterWorldFeet(sprite);
    const dx = destX - feetNow.x;
    const dy = destY - feetNow.y;
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
      x: destX - lx,
      y: destY - ly,
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

  private onPlayerWalkTweenComplete(tween: Phaser.Tweens.Tween, facing: CharacterFacing): void {
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
        (this.player.getData('facing') as CharacterFacing | undefined) ?? resolveInitialIdleFacing(this.player);
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

      const pd = spawn.data.parallaxDepth;
      if (pd !== undefined && pd !== 1) {
        this.parallaxProps.push({
          sprite,
          baseX: spawn.x,
          baseY: spawn.y,
          parallaxDepth: pd,
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

    const flat = pts.flatMap((p) => [p.x - spawn.x, p.y - spawn.y]);
    const poly = new Phaser.Geom.Polygon(flat);
    sprite.setInteractive({
      hitArea: poly,
      hitAreaCallback: Phaser.Geom.Polygon.Contains,
      useHandCursor: true,
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      this.emitPropVerbInteraction(roomId, spawn, verbId);
    });
  }

  /**
   * Dispatches the **look** verb on this prop (same as a primary-button look click). Does not move or rotate the player.
   */
  tryBeginPropLook(roomId: string, spawn: RoomPropSpawn): void {
    this.emitPropVerbInteraction(roomId, spawn, 'look');
  }

  private emitPropVerbInteraction(roomId: string, spawn: RoomPropSpawn, verbId: string): void {
    console.log(`[Benne] verb "${verbId}" prop ${spawn.id}`);
    dispatchVerbInteraction(gameEvents, verbId, getPropVerbHandlers(spawn.data), {
      type: 'prop',
      propId: spawn.id,
      tag: spawn.tag,
      roomId,
      description: spawn.data.description,
      walkToPoint: spawn.data.walkToPoint,
      lookAtPoint: spawn.data.lookAtPoint,
    });
  }

  private createHotspot(roomId: string, hotspot: RoomHotspotData, roomW: number, roomH: number): void {
    if (hotspot.active === false) {
      return;
    }

    const pts = hotspot.points;
    if (!pts || pts.length < 3) {
      return;
    }

    const depth = 8000 + (hotspot.zIndex ?? 0);

    const onHotspotPointer = (pointer: Phaser.Input.Pointer): void => {
      const handlers = getHotspotVerbHandlers(hotspot);
      if (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined) {
        return;
      }
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      console.log(`[Benne] verb "${verbId}" hotspot ${hotspot.id}`);
      dispatchVerbInteraction(gameEvents, verbId, handlers, {
        type: 'hotspot',
        hotspotId: hotspot.id,
        roomId,
        description: hotspot.description,
      });
    };

    const zone = this.add.zone(0, 0, roomW, roomH).setOrigin(0, 0).setDepth(depth);
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(p.x, p.y);
    }
    const geom = new Phaser.Geom.Polygon(flat);
    zone.setInteractive(geom, Phaser.Geom.Polygon.Contains);
    zone.input!.cursor = 'pointer';
    zone.on('pointerdown', onHotspotPointer);
  }

  private spawnCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    if (spawn.loadKind === 'aseprite') {
      this.spawnAsepriteCharacter(roomId, spawn);
      return;
    }

    const sprite = this.add.image(0, 0, spawn.textureKey);
    const feet = resolveCharacterFeetLocal(spawn.data, sprite as Phaser.GameObjects.Sprite);
    placeSpriteByFeet(sprite as Phaser.GameObjects.Sprite, feet, spawn.x, spawn.y);
    sprite.setDepth(CHARACTER_SCENE_DEPTH + (spawn.zIndex ?? 0));
    sprite.setVisible(spawn.visible !== false);
    sprite.setData('character', spawn.data);
    sprite.setData('walkSpeed', spawn.data.walkSpeed);
    sprite.setData('instanceId', spawn.instanceId);
    this.attachCharacterInteraction(roomId, spawn, sprite);
    this.characterSpritesByCharacterId.set(spawn.data.id, sprite);
  }

  private spawnAsepriteCharacter(roomId: string, spawn: RoomCharacterSpawn): void {
    const sprite = this.add.sprite(0, 0, spawn.textureKey);
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

    const feet = resolveCharacterFeetLocal(spawn.data, sprite);
    placeSpriteByFeet(sprite, feet, spawn.x, spawn.y);

    this.attachCharacterInteraction(roomId, spawn, sprite);

    if (isPlayer) {
      this.player = sprite as DirectionalCharacterSprite;
    }

    this.characterSpritesByCharacterId.set(spawn.data.id, sprite);
  }

  private attachCharacterInteraction(
    roomId: string,
    spawn: RoomCharacterSpawn,
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  ): void {
    if (spawn.visible === false) {
      return;
    }
    const handlers = getCharacterVerbHandlers(spawn.data);
    if (
      !spawn.data.clickable ||
      (Object.keys(handlers.onVerb).length === 0 && handlers.onVerbFallback === undefined)
    ) {
      return;
    }

    const colliderPts = spawn.data.collider?.points;
    if (colliderPts && colliderPts.length >= 3) {
      const flat = colliderPts.flatMap((p) => [p.x, p.y]);
      const poly = new Phaser.Geom.Polygon(flat);
      sprite.setInteractive({
        hitArea: poly,
        hitAreaCallback: Phaser.Geom.Polygon.Contains,
        useHandCursor: true,
      });
    } else {
      sprite.setInteractive({ useHandCursor: true });
    }
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const profile = getEffectiveTwoVerbProfile(getGameSettings());
      const verbId = resolveVerbIdFromPointer(pointer, profile);
      if (!verbId) {
        return;
      }
      console.log(`[Benne] verb "${verbId}" character ${spawn.data.id}`);
      dispatchVerbInteraction(gameEvents, verbId, handlers, {
        type: 'character',
        characterId: spawn.data.id,
        instanceId: spawn.instanceId,
        roomId,
        description: spawn.data.description,
      });
    });
  }
}
