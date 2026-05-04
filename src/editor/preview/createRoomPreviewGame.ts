import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { gameEvents } from '../../engine/events/EventBus';
import { getBenneRendererConfigFields } from '../../engine/gameConfig';
import { GameStateManager } from '../../engine/gameState/GameStateManager';
import { BENNE_GAME_STATE_REGISTRY_KEY } from '../../engine/gameState/registryKey';
import { RoomScene } from '../../engine/scenes/RoomScene';
import { BENNE_ROOM_START_KIND_KEY } from '../../engine/scenes/roomStartKindConstants';
import { SCENE_ROOM } from '../../game/constants';
import type { PreviewManifest } from './buildPreviewManifest';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { BENNE_POLYGON_EDIT_SCENE, RoomPolygonEditScene } from './RoomPolygonEditScene';

export type RoomPreviewGameOptions = {
    roomJsonUri: string;
    onPolygonPatch: (patch: RoomPolygonPatch) => void;
    /**
     * Initial visibility of non-`speaking-text` GUI overlays. Forwarded to {@link RoomScene} via
     * the `benneRoomSceneGenericGuisVisible` registry key so authors see the stored "Show GUIs"
     * toolbar state without a first-frame flash.
     */
    initialShowGuis: boolean;
};

/**
 * Editor-specific Phaser config.
 *
 * Uses `Scale.RESIZE` so the canvas always fills the preview panel (camera management for
 * navigate-letterbox vs edit-full-panel is handled by `RoomScene.setEditorCameraMode`). This
 * differs from the shipped game (`gameConfig.ts`) which uses `Scale.FIT` with integer zoom —
 * that is the **only** intentional divergence; renderer/pixel-output fields come from the
 * shared helper so `BitmapText` rendering matches the runtime (Phaser 4 WebGL did not render
 * fixed-to-camera `BitmapText` reliably — see `.cursor/rules/benne-preview-rendering-parity.mdc`).
 */
function getEditorPhaserGameConfig(
    parent: HTMLElement,
): Omit<Phaser.Types.Core.GameConfig, 'scene'> {
    return {
        ...getBenneRendererConfigFields(),
        parent,
        scale: {
            parent,
            mode: Phaser.Scale.RESIZE,
        },
    };
}

export function createRoomPreviewPhaserGame(
    parent: HTMLElement,
    manifest: PreviewManifest,
    options: RoomPreviewGameOptions,
): Phaser.Game {
    const manifestRef = manifest;

    class BennePreviewLoader extends Phaser.Scene {
        constructor() {
            super('BennePreviewLoader');
        }

        preload(): void {
            for (const L of manifestRef.loads) {
                if (L.kind === 'image') {
                    this.load.image(L.key, L.url);
                } else if (L.kind === 'aseprite') {
                    this.load.aseprite({
                        key: L.key,
                        textureURL: L.textureURL,
                        atlasURL: L.atlasURL,
                    });
                } else {
                    this.load.bitmapFont(L.key, L.textureURL, L.dataURL);
                }
            }
        }

        create(): void {
            applyBootAudioSettings(this);
            /**
             * Same registry contract as {@link createBenneGame} / the GUI preview boot scene: {@link RoomScene},
             * {@link buildGuiOverlay} (verb lines, inventory), and the custom cursor call
             * {@link resolveGameStateManager} — without this, preview `create` can throw (e.g. custom cursor
             * `refreshCustomCursor` → `tryActiveInventoryCursorClip`) and the canvas stays blank.
             */
            const gameState = new GameStateManager(gameEvents);
            this.game.registry.set(BENNE_GAME_STATE_REGISTRY_KEY, gameState);
            this.game.registry.set(BENNE_ROOM_START_KIND_KEY, 'preview');
            this.scene.start(SCENE_ROOM, manifestRef.startData);
            this.scene.launch(BENNE_POLYGON_EDIT_SCENE);
            for (const u of manifestRef.revokeObjectUrls) {
                URL.revokeObjectURL(u);
            }
        }
    }

    return new Phaser.Game({
        ...getEditorPhaserGameConfig(parent),
        callbacks: {
            preBoot: (game: Phaser.Game) => {
                game.registry.set('bennePreviewRoom', manifestRef.startData.room);
                game.registry.set('bennePreviewRoomJsonUri', options.roomJsonUri);
                game.registry.set('bennePreviewPostPatch', options.onPolygonPatch);
                /**
                 * Read by {@link RoomScene.create}; a boolean value overrides every non-`speaking-text`
                 * GUI overlay's initial visibility (preview "Show GUIs" toolbar toggle).
                 */
                game.registry.set('benneRoomSceneGenericGuisVisible', options.initialShowGuis);
            },
        },
        scene: [BennePreviewLoader, RoomScene, RoomPolygonEditScene],
    });
}
