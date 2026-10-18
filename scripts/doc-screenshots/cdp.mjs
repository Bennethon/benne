// @ts-check
/**
 * A small Chrome DevTools Protocol client for driving the VS Code that `rig.mjs` starts, for the
 * screenshots in the website guides (docs/doc-screenshots.md). `run.mjs` connects one and hands it
 * to a step file as `c`.
 *
 * All coordinates are CSS pixels in the 1600×1000 workbench window. Screenshots are taken at 2×, so
 * a point measured on a screenshot is half that in CSS pixels. Measure with `rect`, `rowRect` and
 * `webviewRects` rather than reading positions off an image.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const STATE_DIR = path.join(tmpdir(), 'benne-doc-shots');
export const SHOTS_DIR = path.join(STATE_DIR, 'shots');
export const RENDERER_PORT = 9333;
export const MAIN_PORT = 9334;

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** Opens a CDP websocket and returns a `send(method, params)` for it. */
async function socket(/** @type {string} */ url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let id = 0;
  /** @type {Map<number, (m: any) => void>} */
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
  });
  /** @type {(method: string, params?: object) => Promise<any>} */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { send, close: () => ws.close() };
}

async function evaluate(/** @type {(m: string, p?: object) => Promise<any>} */ send, /** @type {string} */ expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/** Evaluates `expression` in VS Code's Electron main process (started with `--inspect`). */
export async function mainEval(/** @type {string} */ expression) {
  const list = await (await fetch(`http://localhost:${MAIN_PORT}/json/list`)).json();
  const s = await socket(list[0].webSocketDebuggerUrl);
  try {
    // The main process is an ES module, so `require` comes from its main module.
    return await evaluate(s.send, `(async () => { const require = process.mainModule.require; return (${expression}); })()`);
  } finally {
    s.close();
  }
}

/** Resizes the workbench window to 1600×1000 and mutes every page in it. */
export async function resizeAndMute() {
  return mainEval(`(() => {
    const { BrowserWindow, webContents } = require('electron');
    BrowserWindow.getAllWindows()[0]?.setBounds({ x: 0, y: 0, width: 1600, height: 1000 });
    for (const w of webContents.getAllWebContents()) w.setAudioMuted(true);
    return BrowserWindow.getAllWindows()[0]?.getTitle();
  })()`);
}

/**
 * Runs `body`, the source of a function `(doc) => value`, inside each BENNE webview (Inspector,
 * State view, previews, BENNE Play) and returns `{ id, purpose, r }` for each: `id` matches the
 * `id=` in its iframe's `src` in the workbench, and `purpose` is `webviewView` for side-bar views
 * and null for editor tabs.
 */
export async function inWebviews(/** @type {string} */ body) {
  const list = await (await fetch(`http://localhost:${RENDERER_PORT}/json/list`)).json();
  const out = [];
  for (const t of list.filter((/** @type {any} */ t) => t.type === 'iframe' && /extensionId=bennethon/.test(t.url))) {
    const s = await socket(t.webSocketDebuggerUrl);
    try {
      out.push(
        await evaluate(
          s.send,
          `(() => { const doc = document.getElementById('active-frame')?.contentDocument; if (!doc) return null;
            return { id: new URLSearchParams(location.search).get('id'), purpose: new URLSearchParams(location.search).get('purpose'), r: (${body})(doc) }; })()`,
        ),
      );
    } finally {
      s.close();
    }
  }
  return out.filter(Boolean);
}

/** Connects to the workbench page and returns the client step files use. */
export async function connect() {
  const list = await (await fetch(`http://localhost:${RENDERER_PORT}/json/list`)).json();
  const target = list.find((/** @type {any} */ t) => t.type === 'page' && t.url.includes('workbench.html'));
  if (!target) throw new Error('No VS Code workbench found. Start it with `node scripts/doc-screenshots/rig.mjs start`.');
  const { send, close } = await socket(target.webSocketDebuggerUrl);
  /** @type {(js: string) => Promise<any>} */
  const js = (expression) => evaluate(send, expression);

  /** @type {(x: number, y: number, o?: { button?: 'left' | 'middle' | 'right' }) => Promise<void>} */
  const click = async (x, y, { button = 'left' } = {}) => {
    const buttons = { left: 1, right: 2, middle: 4 }[button];
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
  };

  /** @type {(key: string, o?: { code?: string, keyCode?: number, modifiers?: number, text?: string }) => Promise<void>} */
  const key = async (k, { code, keyCode, modifiers = 0, text } = {}) => {
    await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: keyCode, modifiers, text });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode, modifiers });
  };

  const rectJs = (/** @type {string} */ expr) =>
    `(() => { const e = ${expr}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;

  /** Finds the nth visible tree row with this label, in any tree in the window. */
  const rowJs = (/** @type {string} */ label, /** @type {number} */ n) =>
    `[...document.querySelectorAll('.monaco-list-row')].filter((r) => r.querySelector('.label-name, .monaco-highlighted-label')?.textContent.trim() === ${JSON.stringify(label)} && r.getBoundingClientRect().height > 0)[${n}]`;

  const c = {
    send,
    sleep,
    close,
    js,
    click,
    key,
    /** Types text into whatever has focus. */
    type: (/** @type {string} */ text) => send('Input.insertText', { text }),
    move: (/** @type {number} */ x, /** @type {number} */ y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }),
    /** Mouse-wheel at a point: negative `dy` zooms the BENNE previews in. */
    async wheel(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ dy, steps = 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      for (let i = 0; i < steps; i++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy });
        await sleep(250);
      }
    },
    async drag(/** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ x2, /** @type {number} */ y2) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 10; i++) {
        const x = x1 + ((x2 - x1) * i) / 10;
        const y = y1 + ((y2 - y1) * i) / 10;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', buttons: 0, clickCount: 1 });
    },
    /** Runs a command from the Command Palette by its title. */
    async command(/** @type {string} */ title) {
      await key('F1', { code: 'F1', keyCode: 112 });
      await sleep(300);
      await send('Input.insertText', { text: '>' + title });
      await sleep(500);
      await key('Enter', { code: 'Enter', keyCode: 13 });
      await sleep(800);
    },
    /**
     * Saves a PNG to the shots folder (`$TMPDIR/benne-doc-shots/shots/<name>.png`), of the window
     * or of `clip` ({ x, y, w, h } in CSS pixels). Moves the pointer out of the way first unless
     * `keepPointer` is set (BENNE Play draws its own cursor where the pointer last was).
     */
    async shot(/** @type {string} */ name, /** @type {{ x: number, y: number, w: number, h: number } | undefined} */ clip, { keepPointer = false } = {}) {
      if (!keepPointer) {
        await c.move(800, 990);
        await sleep(300);
      }
      const r = await send('Page.captureScreenshot', {
        format: 'png',
        ...(clip ? { clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 } } : {}),
      });
      mkdirSync(SHOTS_DIR, { recursive: true });
      const file = path.join(SHOTS_DIR, `${name}.png`);
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    /** The rect of the nth element matching a CSS selector in the workbench. */
    rect: (/** @type {string} */ sel, n = 0) => js(rectJs(`document.querySelectorAll(${JSON.stringify(sel)})[${n}]`)),
    /** The rects of the editor groups, top to bottom. */
    groups: () => js(`[...document.querySelectorAll('.editor-group-container')].map((p) => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })`),
    /** The rect of a part: 'sidebar', 'auxiliarybar' (the Inspector side) or 'editor'. */
    part: (/** @type {string} */ name) => js(rectJs(`document.getElementById('workbench.parts.${name}')`)),
    /** A tree row's rect, plus `lx`/`lw`: the left edge and width of its label. */
    rowRect: (/** @type {string} */ label, n = 0) =>
      js(`(() => { const e = ${rowJs(label, n)}; if (!e) return null; const r = e.getBoundingClientRect();
        const l = e.querySelector('.monaco-icon-label')?.getBoundingClientRect() || r;
        return { x: r.x, y: r.y, w: r.width, h: r.height, lx: l.x, lw: l.width, expanded: e.getAttribute('aria-expanded') }; })()`),
    /** Expands each row in `path`, a list of labels or [label, n] pairs. */
    async expand(/** @type {(string | [string, number])[]} */ labels) {
      for (const p of labels) {
        const [label, n] = Array.isArray(p) ? p : [p, 0];
        const r = await c.rowRect(label, n);
        if (!r) throw new Error(`No tree row "${label}"`);
        if (r.expanded === 'false') {
          await click(r.lx - 8, r.y + r.h / 2);
          await sleep(500);
        }
      }
    },
    /** Expands the parents in `path`, then selects its last row and waits for the editors to open. */
    async select(/** @type {(string | [string, number])[]} */ labels, wait = 6000) {
      await c.expand(labels.slice(0, -1));
      const last = labels[labels.length - 1];
      const [label, n] = Array.isArray(last) ? last : [last, 0];
      const r = await c.rowRect(label, n);
      if (!r) throw new Error(`No tree row "${label}"`);
      await click(r.lx + r.lw / 2, r.y + r.h / 2);
      await sleep(wait);
    },
    /**
     * Expands or collapses the BENNE side bar's views: panes({ BENNE: true, Actions: false }).
     * `BENNE` is the main tree, the first view, which is titled with the game's name.
     */
    async panes(/** @type {Record<string, boolean>} */ want) {
      for (const [title, expanded] of Object.entries(want)) {
        const h = await js(`(() => { const hs = [...document.querySelectorAll('#workbench\\\\.parts\\\\.sidebar .pane-header')];
          const h = ${JSON.stringify(title)} === 'BENNE' ? hs[0] : hs.find((h) => h.querySelector('.title')?.textContent === ${JSON.stringify(title)});
          if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2, expanded: h.getAttribute('aria-expanded') === 'true' }; })()`);
        if (!h) throw new Error(`No "${title}" view in the side bar. Run c.command('BENNE: Show BENNE Sidebar') first.`);
        if (h.expanded !== expanded) {
          await click(h.x, h.y);
          await sleep(600);
        }
      }
    },
    /** Drags the sash between the two editor groups so the top one (the preview) is `h` tall. */
    async previewHeight(/** @type {number} */ h) {
      const g = await c.groups();
      if (g.length < 2) return;
      await c.drag(g[0].x + 400, g[1].y - 1, g[0].x + 400, g[0].y + h);
      await sleep(800);
    },
    /**
     * Rects, in workbench CSS pixels, of elements inside the BENNE webviews: each entry of `sels`
     * is a CSS selector, or `text:Label` for leaf elements whose text is exactly Label. Returns one
     * object per webview, keyed by selector, with up to six [x, y, w, h] each.
     */
    async webviewRects(/** @type {string[]} */ sels) {
      const frames = await js(`Object.fromEntries([...document.querySelectorAll('iframe.webview')].map((f) => { const r = f.getBoundingClientRect(); return [new URL(f.src).searchParams.get('id'), [r.x, r.y]]; }))`);
      const res = await inWebviews(`(doc) => { const out = {}; for (const s of ${JSON.stringify(sels)}) {
        const els = s.startsWith('text:') ? [...doc.querySelectorAll('*')].filter((e) => e.childElementCount === 0 && e.textContent.trim() === s.slice(5)) : [...doc.querySelectorAll(s)];
        out[s] = els.slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }); }
        return out; }`);
      // Shift each webview's rects by where its iframe sits; a webview whose tab isn't showing has none.
      return res
        .filter(({ id }) => frames[id])
        .map(({ id, purpose, r }) => {
          const [fx, fy] = frames[id];
          const shifted = Object.fromEntries(Object.entries(r).map(([k, list]) => [k, /** @type {number[][]} */ (list).map(([x, y, w, h]) => [x + fx, y + fy, w, h])]));
          return { purpose, at: [fx, fy], ...shifted };
        });
    },
    /** Shows the BENNE side bar at the width the screenshots use, with only the tree open. */
    async setup() {
      await c.command('BENNE: Show BENNE Sidebar');
      await sleep(1500);
      const sb = await c.part('sidebar');
      if (sb && Math.abs(sb.w - 350) > 1) {
        await c.drag(sb.x + sb.w + 2, 500, sb.x + 352, 500);
        await sleep(800);
      }
      await c.panes({ BENNE: true, Actions: false, State: false });
    },
    /**
     * Draws callouts over the window, in the guides' style: each item is { x, y, w, h } in CSS
     * pixels and draws a green outline, with optional `n` (a numbered badge) and `label`.
     * `at` places the badge and label: 'tl' (default), 'tr', 'bl', 'br', 'above', 'below',
     * 'belowRight', 'left', 'right' or 'corner' (on the top-left corner); `dx`/`dy` nudge them.
     * `noBox` draws only the badge and label, at x, y; `pad` (default 3) is the outline's
     * distance from the rect. Remove them with `clearAnnotations()` after the shot.
     */
    annotate: (/** @type {object[]} */ items) =>
      js(`(() => {
        document.getElementById('benne-annot')?.remove();
        const root = document.createElement('div'); root.id = 'benne-annot';
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font:600 13px/1.2 Inter,system-ui,sans-serif';
        document.body.appendChild(root);
        for (const it of ${JSON.stringify(items)}) {
          const pad = it.pad ?? 3;
          if (!it.noBox) {
            const box = document.createElement('div');
            box.style.cssText = 'position:absolute;border:2px solid #3dff6e;border-radius:7px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 14px rgba(61,255,110,.35),inset 0 0 0 1px rgba(0,0,0,.4)';
            Object.assign(box.style, { left: it.x - pad + 'px', top: it.y - pad + 'px', width: it.w + pad * 2 + 'px', height: it.h + pad * 2 + 'px' });
            root.appendChild(box);
          }
          if (it.n == null && !it.label) continue;
          const tag = document.createElement('div');
          tag.style.cssText = 'position:absolute;display:flex;align-items:center;gap:7px;line-height:20px;padding:3px 10px 3px 3px;border-radius:999px;background:#0b1519;color:#e8fff0;border:2px solid #3dff6e;box-shadow:0 2px 10px rgba(0,0,0,.6);white-space:nowrap';
          if (it.n == null) tag.style.padding = '4px 10px';
          if (!it.label) tag.style.padding = '3px';
          if (it.n != null) {
            const b = document.createElement('span'); b.textContent = it.n;
            b.style.cssText = 'display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#3dff6e;color:#04210d;font-weight:800;font-size:12px';
            tag.appendChild(b);
          }
          if (it.label) { const l = document.createElement('span'); l.textContent = it.label; tag.appendChild(l); }
          root.appendChild(tag);
          const r = tag.getBoundingClientRect();
          const at = it.at || 'tl', gap = pad + 8;
          let left = it.x + 8, top = it.y + 8;
          if (at === 'tr') left = it.x + it.w - r.width - 8;
          if (at === 'bl' || at === 'br') top = it.y + it.h - r.height - 8;
          if (at === 'br') left = it.x + it.w - r.width - 8;
          if (at === 'above') { top = it.y - r.height - gap; left = it.x; }
          if (at === 'below') { top = it.y + it.h + gap; left = it.x; }
          if (at === 'belowRight') { top = it.y + it.h + gap; left = it.x + it.w - r.width; }
          if (at === 'left') { left = it.x - r.width - gap; top = it.y + it.h / 2 - r.height / 2; }
          if (at === 'right') { left = it.x + it.w + gap; top = it.y + it.h / 2 - r.height / 2; }
          if (at === 'corner') { left = it.x - pad - r.width / 2 + 1; top = it.y - pad - r.height / 2 + 1; }
          if (it.noBox) { left = it.x; top = it.y; }
          tag.style.left = left + (it.dx || 0) + 'px'; tag.style.top = top + (it.dy || 0) + 'px';
        }
      })()`),
    clearAnnotations: () => js(`document.getElementById('benne-annot')?.remove()`),
  };
  return c;
}
