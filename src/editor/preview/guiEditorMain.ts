import type { Game } from 'phaser';
import {
  collectFontLoadsForGui,
  guiHasTextControls,
} from '../../game/collectFontLoadsForGui';
import gameFontsManifest from '../../game/assets/fonts/fonts.json';
import {
  getAsepriteAssetPaths,
  getAsepriteTextureKey,
  usesAsepriteDisplay,
} from '../../game/guiAseprite';
import { pickCharacterPreviewIdleTag } from '../../game/characterPreviewIdleTag';
import { readAsepriteFrameTagNamesFromRawJson } from '../../game/loadAsepriteAtlasData';
import { normalizeAsepriteJsonForPhaser } from '../../game/normalizeAsepriteJson';
import type { GameFontsManifest } from '../../types/fonts';
import type { GuiData } from '../../types/gui';
import {
  createGuiPreviewPhaserGame,
  type GuiPreviewAsepritePayload,
  type GuiPreviewGamePayload,
} from './createGuiPreviewGame';
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

function pickGuiPreviewTag(frameTagNames: readonly string[]): string | null {
  const idle = pickCharacterPreviewIdleTag(frameTagNames);
  if (idle) {
    return idle;
  }
  return frameTagNames.length > 0 ? frameTagNames[0]! : null;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function runLoadGui(msg: {
  gui: GuiData;
  guiId: string;
  gameSrcWebviewUri: string;
  guiJsonUri: string;
}): Promise<void> {
  const root = document.getElementById('benne-gui-preview-root');
  if (!root) {
    return;
  }
  root.innerHTML = '';
  destroyPreviewGame();

  let internalWidth = 352;
  let internalHeight = 198;
  try {
    const configUrl = joinGameWebviewUri(msg.gameSrcWebviewUri, 'game-config.json');
    const cfg = await fetchJson(configUrl);
    const res = cfg.resolution as { width?: unknown; height?: unknown } | undefined;
    if (res && typeof res.width === 'number' && typeof res.height === 'number') {
      internalWidth = res.width;
      internalHeight = res.height;
    }
  } catch {
    /* defaults */
  }

  const hasText = guiHasTextControls(msg.gui);
  const wantsAseprite = usesAsepriteDisplay(msg.gui);

  if (!hasText && !wantsAseprite) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">GUI preview needs <code>display.aseprite: true</code> and/or at least one <code>text</code> control in <code>controls</code>.</div>`;
    return;
  }

  const assetsBase = joinGameWebviewUri(msg.gameSrcWebviewUri, 'assets');
  const manifest = gameFontsManifest as GameFontsManifest;
  const fontLoads = collectFontLoadsForGui(msg.gui, manifest, (rel) =>
    joinGameWebviewUri(assetsBase, rel),
  );

  let aseprite: GuiPreviewAsepritePayload | null = null;
  const revokeObjectUrls: string[] = [];
  let asepriteError: string | null = null;

  if (wantsAseprite) {
    const paths = getAsepriteAssetPaths(msg.guiId);
    const pngUrl = joinGameWebviewUri(assetsBase, paths.png);
    const jsonUrl = joinGameWebviewUri(assetsBase, paths.json);

    try {
      const raw = await fetchJson(jsonUrl);
      const tags = readAsepriteFrameTagNamesFromRawJson(raw);
      const tagToPlay = pickGuiPreviewTag(tags);
      if (!tagToPlay) {
        asepriteError =
          'No frame tags on this sheet — tag at least one animation in Aseprite (or rely on text-only preview).';
      } else {
        const norm = normalizeAsepriteJsonForPhaser(raw) as Record<string, unknown>;
        const blob = new Blob([JSON.stringify(norm)], { type: 'application/json' });
        const atlasURL = URL.createObjectURL(blob);
        revokeObjectUrls.push(atlasURL);
        aseprite = {
          textureKey: getAsepriteTextureKey(msg.guiId),
          textureURL: pngUrl,
          atlasURL,
          tagToPlay,
        };
      }
    } catch (e) {
      asepriteError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!aseprite && !hasText) {
    root.innerHTML = `<div style="padding:10px;font:13px system-ui,sans-serif;color:#e8a090;">Could not load sheet: ${asepriteError ?? 'unknown error'}</div>`;
    return;
  }

  if (wantsAseprite && !aseprite && hasText) {
    console.warn('[BENNE GUI preview] Aseprite sheet unavailable; showing text controls only.', asepriteError);
  }

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;height:100%;min-height:180px;';
  root.appendChild(inner);

  const payload: GuiPreviewGamePayload = {
    guiData: msg.gui,
    fontLoads,
    internalWidth,
    internalHeight,
    revokeObjectUrls,
    aseprite,
  };

  game = createGuiPreviewPhaserGame(inner, payload);
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type?: string };
  if (msg?.type === 'benne/guiPreview/loadGui') {
    const m = event.data as {
      type: string;
      gui: GuiData;
      guiId: string;
      gameSrcWebviewUri: string;
      guiJsonUri: string;
    };
    void runLoadGui(m);
    return;
  }
  if (msg?.type === 'benne/guiPreview/clear') {
    destroyPreviewGame();
    const root = document.getElementById('benne-gui-preview-root');
    if (root) {
      root.innerHTML = '';
    }
  }
});

vscodeApi?.postMessage({ type: 'benne/guiPreview/ready' });
