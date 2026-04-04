import * as Phaser from 'phaser';
import { applyBootAudioSettings } from '../../engine/applyAudioFromSettings';
import { getBennePhaserGameConfigBase } from '../../engine/gameConfig';
import { RoomScene } from '../../engine/scenes/RoomScene';
import { SCENE_ROOM } from '../../game/constants';
import type { PreviewManifest } from './buildPreviewManifest';
import type { RoomPolygonPatch } from './polygonPatchTypes';
import { BENNE_POLYGON_EDIT_SCENE, RoomPolygonEditScene } from './RoomPolygonEditScene';

export type RoomPreviewGameOptions = {
    roomJsonUri: string;
    onPolygonPatch: (patch: RoomPolygonPatch) => void;
};

/**
 * Runs the real {@link RoomScene} with the same game config (scale, pixel art, post placeholder) as the player build.
 */
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
                } else {
                    this.load.aseprite({
                        key: L.key,
                        textureURL: L.textureURL,
                        atlasURL: L.atlasURL,
                    });
                }
            }
        }

        create(): void {
            applyBootAudioSettings(this);
            this.scene.start(SCENE_ROOM, manifestRef.startData);
            this.scene.launch(BENNE_POLYGON_EDIT_SCENE);
            for (const u of manifestRef.revokeObjectUrls) {
                URL.revokeObjectURL(u);
            }
        }
    }

    return new Phaser.Game({
        ...getBennePhaserGameConfigBase(parent),
        callbacks: {
            preBoot: (game: Phaser.Game) => {
                game.registry.set('bennePreviewRoom', manifestRef.startData.room);
                game.registry.set('bennePreviewRoomJsonUri', options.roomJsonUri);
                game.registry.set('bennePreviewPostPatch', options.onPolygonPatch);
            },
        },
        scene: [BennePreviewLoader, RoomScene, RoomPolygonEditScene],
    });
}
