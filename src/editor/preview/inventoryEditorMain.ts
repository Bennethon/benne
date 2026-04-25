import type { Game } from 'phaser';
import {
  getPerItemInventoryAsepritePaths,
  getPerItemInventoryTextureKey,
  inventoryPhaserAnimationKeyForTag,
  sharedInventoryAssetPaths,
  sharedInventoryTextureKey,
  usesPerItemInventoryAseprite,
  usesSharedInventoryAseprite,
} from '../../game/inventoryAseprite';
import {
  prefixPerItemInventoryAsepriteFrameTags,
  readAsepriteFrameTagNamesFromRawJson,
} from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { InventoryItemData } from '../../types/inventory';
import {
  createInventoryPreviewPhaserGame,
  type InventoryPreviewGamePayload,
} from './createInventoryPreviewGame';
import { joinGameWebviewUri } from './previewUrls';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let game: Game | null = null;

try {
  vscodeApi = acquireVsCodeApi();
} catch {
  /* not inside a VS Code webview */
}

function destroyPreviewGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function ensureSharedInventoryTagPrefixes(normalized: Record<string, unknown>): void {
  const meta = normalized.meta;
  if (!meta || typeof meta !== 'object') {
    return;
  }
  const frameTags = (meta as { frameTags?: { name: string }[] }).frameTags;
  if (!Array.isArray(frameTags)) {
    return;
  }
  for (const tag of frameTags) {
    if (tag && typeof tag.name === 'string' && tag.name.length > 0 && !tag.name.startsWith('inventory:')) {
      tag.name = `inventory:${tag.name}`;
    }
  }
}

function pickInventoryPreviewTagName(data: InventoryItemData, rawTagNames: readonly string[]): string | null {
  const preferred = data.defaultAnimation ?? data.id;
  if (rawTagNames.includes(preferred)) {
    return preferred;
  }
  return rawTagNames.length > 0 ? rawTagNames[0]! : null;
}

async function runLoadInventory(msg: {
  inventory: InventoryItemData;
  inventoryId: string;
  gameSrcWebviewUri: string;
  inventoryJsonUri: string;
}): Promise<void> {
  const root = document.getElementById('benne-inventory-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  const inventory = msg.inventory;
  if (!usesSharedInventoryAseprite(inventory) && !usesPerItemInventoryAseprite(inventory)) {
    root.innerHTML =
      '<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Inventory preview needs <code>display.aseprite: "shared"</code> or <code>display.aseprite: true</code>.</div>';
    return;
  }

  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const paths = usesSharedInventoryAseprite(inventory)
    ? sharedInventoryAssetPaths()
    : getPerItemInventoryAsepritePaths(msg.inventoryId);
  const textureKey = usesSharedInventoryAseprite(inventory)
    ? sharedInventoryTextureKey
    : getPerItemInventoryTextureKey(msg.inventoryId);
  const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
  const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

  let raw: Record<string, unknown>;
  try {
    raw = await fetchJson(jsonUrl);
  } catch (e) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet JSON: ${e instanceof Error ? e.message : String(e)}</div>`;
    return;
  }

  const rawTagNames = readAsepriteFrameTagNamesFromRawJson(raw);
  const tagName = pickInventoryPreviewTagName(inventory, rawTagNames);
  if (!tagName) {
    root.innerHTML =
      '<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">No animation tags on this sheet.</div>';
    return;
  }
  const animationKey = inventoryPhaserAnimationKeyForTag(inventory, tagName);

  const normalized = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
  if (usesSharedInventoryAseprite(inventory)) {
    ensureSharedInventoryTagPrefixes(normalized);
  } else if (usesPerItemInventoryAseprite(inventory)) {
    prefixPerItemInventoryAsepriteFrameTags(normalized, msg.inventoryId);
  }
  const atlasBlob = new Blob([JSON.stringify(normalized)], { type: 'application/json' });
  const atlasURL = URL.createObjectURL(atlasBlob);

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  const payload: InventoryPreviewGamePayload = {
    textureKey,
    textureURL: pngUrl,
    atlasURL,
    inventory,
    animationKey,
    animationTagLabel: tagName,
    revokeObjectUrls: [atlasURL],
  };

  game = createInventoryPreviewPhaserGame(inner, payload);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string };
  if (msg?.type === 'benne/inventoryPreview/loadInventory') {
    const m = event.data as {
      type: string;
      inventory: InventoryItemData;
      inventoryId: string;
      gameSrcWebviewUri: string;
      inventoryJsonUri: string;
    };
    void runLoadInventory(m);
    return;
  }
  if (msg?.type === 'benne/inventoryPreview/clear') {
    destroyPreviewGame();
    const root = document.getElementById('benne-inventory-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/inventoryPreview/ready' });
