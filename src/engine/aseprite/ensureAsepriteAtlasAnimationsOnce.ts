import * as Phaser from 'phaser';
import { applyCharacterAnimationClips } from '../characterAnimationPlayback.js';
import type { CharacterAnimationsConfig } from '../../types/character.js';
import type { InventoryItemData } from '../../types/inventory.js';
import {
  inventoryPhaserAnimationKeyForTag,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite.js';
import {
  getInventoryDefinition,
  getRegisteredInventoryDefinitionIds,
} from '../inventory/inventoryDefinitionRegistry.js';

const INVENTORY_ATLAS_TEXTURE_PREFIX = 'aseprite:inventory:';

/** Matches {@link buildGuiOverlay} / legacy {@link RoomScene} guard keys. */
export const BENNE_ASEPRITE_ATLAS_ANIM_REGISTRY_PREFIX = '__benneAsepriteAnims:';

export function buildInventoryAnimationsPhaserKeyed(def: InventoryItemData): CharacterAnimationsConfig | undefined {
  const raw = def.animations;
  if (!raw) {
    return undefined;
  }
  const out: CharacterAnimationsConfig = {};
  for (const [authorTag, clip] of Object.entries(raw)) {
    const key = inventoryPhaserAnimationKeyForTag(def, authorTag);
    out[key] = { loop: clip.loop, frameDuration: clip.frameDuration };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * When `textureKey` is an inventory atlas (`aseprite:inventory:…`), returns merged JSON clip overrides
 * (`loop`, `frameDuration`) keyed by the Phaser animation keys {@link createFromAseprite} registers.
 */
export function resolveInventoryClipOverridesForTexture(textureKey: string): CharacterAnimationsConfig | undefined {
  if (!textureKey.startsWith(INVENTORY_ATLAS_TEXTURE_PREFIX)) {
    return undefined;
  }
  const rest = textureKey.slice(INVENTORY_ATLAS_TEXTURE_PREFIX.length);
  if (rest === 'shared') {
    const out: CharacterAnimationsConfig = {};
    for (const id of getRegisteredInventoryDefinitionIds()) {
      const def = getInventoryDefinition(id);
      if (!def || !usesSharedInventoryAseprite(def)) {
        continue;
      }
      const m = buildInventoryAnimationsPhaserKeyed(def);
      if (m) {
        Object.assign(out, m);
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  const def = getInventoryDefinition(rest);
  if (!def || !usesPerItemInventoryAseprite(def)) {
    return undefined;
  }
  return buildInventoryAnimationsPhaserKeyed(def);
}

/**
 * Runs {@link Phaser.Animations.AnimationManager#createFromAseprite} at most once per `textureKey` per game,
 * then applies inventory JSON `animations` clip policy when the atlas is an inventory sheet.
 */
export function ensureAsepriteAtlasAnimationsRegisteredOnce(scene: Phaser.Scene, textureKey: string): void {
  if (!scene.textures.exists(textureKey)) {
    return;
  }
  const flagKey = `${BENNE_ASEPRITE_ATLAS_ANIM_REGISTRY_PREFIX}${textureKey}`;
  if (scene.game.registry.get(flagKey)) {
    return;
  }
  const created = scene.anims.createFromAseprite(textureKey) ?? [];
  const invClips = resolveInventoryClipOverridesForTexture(textureKey);
  if (invClips) {
    applyCharacterAnimationClips(created, invClips);
  }
  scene.game.registry.set(flagKey, true);
}
