import type { Game } from 'phaser';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/characterAseprite';
import { pickCharacterPreviewIdleTag } from '../../game/characterPreviewIdleTag';
import { readAsepriteFrameTagNamesFromRawJson } from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { CharacterData } from '../../types/character';
import {
  createCharacterPreviewPhaserGame,
  type CharacterPreviewGamePayload,
} from './createCharacterPreviewGame';
import { joinGameWebviewUri } from './previewUrls';

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
let game: Game | null = null;
let lastCharacterJsonUri = '';

try {
  vscodeApi = acquireVsCodeApi();
} catch {
  /* not inside a VS Code webview */
}

function setTopbar(html: string): void {
  const el = document.getElementById('benne-char-preview-topbar');
  if (el) {
    el.innerHTML = html;
  }
}

function wireTopbar(characterJsonUri: string): void {
  setTopbar(`
    <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
      <span style="font:12px system-ui,sans-serif;color:#b8bdd0;">Feet — wheel zoom, middle-drag pan, F fit, drag yellow handle ·</span>
      <button type="button" id="benne-char-save-feet" style="background:#3d5a80;color:#e8ecff;border:1px solid #5a7aaa;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Save feet to JSON</button>
      <button type="button" id="benne-char-refresh" style="background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;">Refresh</button>
    </div>
  `);
  document.getElementById('benne-char-save-feet')?.addEventListener('click', () => {
    const readFeet = game?.registry.get('benneCharacterPreviewReadFeet') as (() => { x: number; y: number }) | undefined;
    if (!readFeet || !vscodeApi) {
      return;
    }
    const feet = readFeet();
    vscodeApi.postMessage({
      type: 'benne/charPreview/saveFeet',
      characterJsonUri,
      feet,
    });
  });
  document.getElementById('benne-char-refresh')?.addEventListener('click', () => {
    vscodeApi?.postMessage({
      type: 'benne/charPreview/requestRefresh',
      characterJsonUri,
    });
  });
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function destroyPreviewGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

async function runLoadCharacter(msg: {
  character: CharacterData;
  characterId: string;
  gameSrcWebviewUri: string;
  characterJsonUri: string;
}): Promise<void> {
  lastCharacterJsonUri = msg.characterJsonUri;
  const root = document.getElementById('benne-char-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  if (!usesAsepriteDisplay(msg.character)) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Character preview needs <code>display.aseprite: true</code>.</div>`,
    );
    return;
  }

  const paths = getAsepriteAssetPaths(msg.characterId);
  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
  const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

  let raw: Record<string, unknown>;
  try {
    raw = await fetchJson(jsonUrl);
  } catch (e) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet JSON: ${e instanceof Error ? e.message : String(e)}</div>`,
    );
    return;
  }

  const tags = readAsepriteFrameTagNamesFromRawJson(raw);
  const idleTag = pickCharacterPreviewIdleTag(tags);
  if (!idleTag) {
    setTopbar(
      `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">No Idle* animation tags on this sheet.</div>`,
    );
    return;
  }

  const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
  const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
  const atlasURL = URL.createObjectURL(blob);

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  wireTopbar(msg.characterJsonUri);

  const payload: CharacterPreviewGamePayload = {
    textureKey: getAsepriteTextureKey(msg.characterId),
    textureURL: pngUrl,
    atlasURL,
    character: msg.character,
    idleTag,
    revokeObjectUrls: [atlasURL],
  };

  game = createCharacterPreviewPhaserGame(inner, payload);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string; ok?: boolean; message?: string };
  if (msg?.type === 'benne/charPreview/feetSaveResult') {
    if (msg.ok === false && typeof msg.message === 'string') {
      console.warn('[Benne character preview]', msg.message);
    } else if (msg.ok === true && lastCharacterJsonUri.length > 0) {
      vscodeApi?.postMessage({
        type: 'benne/charPreview/requestRefresh',
        characterJsonUri: lastCharacterJsonUri,
      });
    }
    return;
  }
  if (msg?.type === 'benne/charPreview/loadCharacter') {
    const m = event.data as {
      type: string;
      character: CharacterData;
      characterId: string;
      gameSrcWebviewUri: string;
      characterJsonUri: string;
    };
    void runLoadCharacter(m);
    return;
  }
  if (msg?.type === 'benne/charPreview/clear') {
    destroyPreviewGame();
    setTopbar('');
    const root = document.getElementById('benne-char-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/charPreview/ready' });
