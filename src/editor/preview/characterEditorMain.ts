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

const BTN_PRIMARY =
  'background:#3d5a80;color:#e8ecff;border:1px solid #5a7aaa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';
const BTN_IDLE =
  'background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';

function wireTopbar(characterJsonUri: string, game: Game | null): void {
  setTopbar(`
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
      <button type="button" id="benne-char-save" style="${BTN_PRIMARY}">Save to JSON</button>
      <button type="button" id="benne-char-refresh" style="${BTN_IDLE}">Refresh</button>
      <span style="font:12px system-ui,sans-serif;color:#8892a8;">Wheel zoom · middle-drag pan · F fit</span>
    </div>
    <div style="font:11px system-ui,sans-serif;color:#8a92a8;padding:4px 12px 8px;background:#1e1e2a;">Drag labeled handles (Feet on-cel; Walk to / Talk may be off-sprite) and the magenta collider. Collider: 3+ points; double-click an edge to add a vertex; Delete removes a selected vertex. Fewer than three points on save removes the custom collider.</div>
  `);

  document.getElementById('benne-char-save')?.addEventListener('click', () => {
    const readGeometry = game?.registry.get('benneCharacterPreviewReadGeometry') as
      | (() => {
          feet: { x: number; y: number };
          walkToPoint: { x: number; y: number };
          talkPoint: { x: number; y: number };
          collider: { points: { x: number; y: number }[] } | null;
        })
      | undefined;
    if (!readGeometry || !vscodeApi) {
      return;
    }
    const geometry = readGeometry();
    vscodeApi.postMessage({
      type: 'benne/charPreview/saveCharacter',
      characterJsonUri,
      geometry,
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

  const payload: CharacterPreviewGamePayload = {
    textureKey: getAsepriteTextureKey(msg.characterId),
    textureURL: pngUrl,
    atlasURL,
    character: msg.character,
    idleTag,
    revokeObjectUrls: [atlasURL],
  };

  game = createCharacterPreviewPhaserGame(inner, payload);
  wireTopbar(msg.characterJsonUri, game);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string; ok?: boolean; message?: string };
  if (msg?.type === 'benne/charPreview/saveCharacterResult') {
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
