import type { Game } from 'phaser';
import { getAsepriteAssetPaths, getAsepriteTextureKey, usesAsepriteDisplay } from '../../game/boot/characterAseprite';
import { pickCharacterPreviewIdleTag } from '../../game/boot/characterPreviewIdleTag';
import { readAsepriteFrameTagNamesFromRawJson } from '../../game/boot/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/boot/normalizeAsepriteJson';
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
/** Toolbar Animation selection, kept across Save / Refresh reloads of the same character. */
let selectedAnimation: { characterJsonUri: string; tag: string } | null = null;

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
const SELECT_STYLE =
  'font-size:12px;min-width:120px;max-width:200px;padding:3px 6px;border-radius:4px;border:1px solid #5a5a70;background:#1a1a28;color:#e8ecff;';
const BTN_IDLE =
  'background:#3a3a52;color:#e8ecff;border:1px solid #5a5a70;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function animationOptionsHtml(tags: readonly string[], character: CharacterData, selected: string): string {
  return tags
    .map((tag) => {
      const once = character.animations?.[tag]?.loop === true ? '' : ' (once)';
      const sel = tag === selected ? ' selected' : '';
      return `<option value="${escapeHtml(tag)}"${sel}>${escapeHtml(tag + once)}</option>`;
    })
    .join('');
}

function wireTopbar(
  characterJsonUri: string,
  game: Game | null,
  tags: readonly string[],
  character: CharacterData,
  animationTag: string,
): void {
  setTopbar(`
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #2e2e44;background:#222230;">
      <label for="benne-char-animation" style="font:12px system-ui,sans-serif;color:#c8d0e0;white-space:nowrap;">Animation</label>
      <select id="benne-char-animation" title="Aseprite tag to play in the preview. (once) clips don't loop in the game; the preview loops them." style="${SELECT_STYLE}">${animationOptionsHtml(tags, character, animationTag)}</select>
      <div aria-hidden="true" style="align-self:stretch;width:1px;background:#3a3a52;"></div>
      <button type="button" id="benne-char-save" style="${BTN_PRIMARY}">Save to JSON</button>
      <button type="button" id="benne-char-refresh" style="${BTN_IDLE}">Refresh</button>
      <span style="font:12px system-ui,sans-serif;color:#8892a8;">Wheel zoom · middle-drag pan · F fit</span>
    </div>
    <div style="font:11px system-ui,sans-serif;color:#8a92a8;padding:4px 12px 8px;background:#1e1e2a;">Drag labeled handles (Feet on-cel; Walk to / Talk may be off-sprite) and the magenta collider. Collider: 3+ points; double-click an edge to add a vertex; Delete removes a selected vertex. Fewer than three points on save removes the custom collider.</div>
  `);

  const animationSelect = document.getElementById('benne-char-animation') as HTMLSelectElement | null;
  animationSelect?.addEventListener('change', () => {
    const tag = animationSelect.value;
    selectedAnimation = { characterJsonUri, tag };
    const play = game?.registry.get('benneCharacterPreviewPlayAnimation') as ((tag: string) => void) | undefined;
    play?.(tag);
  });

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

  const kept =
    selectedAnimation?.characterJsonUri === msg.characterJsonUri && tags.includes(selectedAnimation.tag)
      ? selectedAnimation.tag
      : null;
  const animationTag = kept ?? idleTag;

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
    animationTag,
    revokeObjectUrls: [atlasURL],
  };

  game = createCharacterPreviewPhaserGame(inner, payload);
  wireTopbar(msg.characterJsonUri, game, tags, msg.character, animationTag);
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
