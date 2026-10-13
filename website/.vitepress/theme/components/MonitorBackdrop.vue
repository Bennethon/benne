<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

// Behind the homepage monitor: warp-speed pixel stars in dark mode, a 1-bit dithered halo with slowly
// turning beams in light mode. Both come from the middle of the screen, behind the monitor, and
// run to the window's edges. One animation loop draws whichever mode is showing.

const { isDark } = useData();
const backdrop = ref<HTMLDivElement | null>(null);
const starCanvas = ref<HTMLCanvasElement | null>(null);
const ditherCanvas = ref<HTMLCanvasElement | null>(null);

// The backdrop spans the window and overhangs the monitor 30% above and 20% below (see the CSS),
// so the screen's centre (41.5% down the monitor image) is here in its box.
const ORIGIN_X = 0.5;
const ORIGIN_Y = (0.3 + 0.415) / 1.5;

// Both modes draw on the same grid of chunky pixels: one star, or one dither dot, per cell.
const CELL = 4; // CSS pixels

let raf = 0;
let last = 0;
let visible = true;
let reducedMotion = false;
let width = 0;
let height = 0;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;

// ─── Stars (dark mode) ───────────────────────────────────────────────────────

const STAR_COUNT = 260;
const SPEED = 0.09; // depth units per second
const EDGE_FADE = 0.12; // stars fade out over this much of the width before the window's sides
const COLORS = ['255, 255, 255', '61, 255, 110', '120, 230, 228'];

interface Star { x: number; y: number; z: number; color: string }

let stars: Star[] = [];

function spawn(z = 1): Star {
  return {
    // Wide windows get a wider field, so stars reach the side edges as well as the top and bottom.
    x: (Math.random() * 2 - 1) * 1.2 * Math.max(1, width / Math.max(height, 1)),
    y: (Math.random() * 2 - 1) * 0.9,
    z,
    color: Math.random() < 0.7 ? COLORS[0] : COLORS[1 + Math.floor(Math.random() * 2)],
  };
}

function sizeStars() {
  const el = starCanvas.value;
  if (!el) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawStars(dt: number) {
  const ctx = starCanvas.value?.getContext('2d');
  if (!ctx || !width) return;
  ctx.clearRect(0, 0, width, height);
  const cx = width * ORIGIN_X;
  const cy = height * ORIGIN_Y;
  const scale = Math.min(width, height) * 0.22;
  const fadeZone = Math.min(width * EDGE_FADE, 140);
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.z -= SPEED * dt;
    const x = cx + (s.x / s.z) * scale;
    const y = cy + (s.y / s.z) * scale;
    if (s.z <= 0.02 || x < -20 || x > width + 20 || y < -20 || y > height + 20) {
      stars[i] = spawn();
      continue;
    }
    const near = 1 - s.z; // 0 far away, 1 close
    const edge = Math.max(0, Math.min(1, Math.min(x, width - x) / fadeZone));
    if (edge === 0) continue;
    // One chunky pixel, snapped to the grid, so stars hop cell to cell like a 1-bit sprite.
    ctx.fillStyle = `rgba(${s.color}, ${(0.05 + near * 0.3) * edge})`;
    ctx.fillRect(Math.floor(x / CELL) * CELL, Math.floor(y / CELL) * CELL, CELL, CELL);
  }
}

// ─── Dithered halo (light mode) ──────────────────────────────────────────────

const DITHER_FPS = 15; // the shimmer is slow; a low frame rate suits the 1-bit look
const BEAMS = 18;
// Squash the burst vertically (1 = circle): full reach left and right, shorter above and below,
// so fewer beams cross the text over and under the monitor.
const SQUASH = 0.55;
const BEAM_TURN = (Math.PI * 2) / 240; // radians per second: one turn every four minutes
// Two tones of the BENNE green over white: [r, g, b, alpha].
const TONES = [
  [61, 255, 110, 70],
  [61, 255, 110, 150],
];
// 4×4 ordered-dither (Bayer) thresholds.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

let cols = 0;
let rows = 0;
let image: ImageData | null = null;
// Per-cell values that only change on resize.
let falloff = new Float32Array(0);
let angle = new Float32Array(0);
let radius = new Float32Array(0);
let lastDither = -Infinity;

function sizeDither() {
  const el = ditherCanvas.value;
  const ctx = el?.getContext('2d');
  if (!el || !ctx || !width) return;
  cols = Math.ceil(width / CELL);
  rows = Math.ceil(height / CELL);
  el.width = cols;
  el.height = rows;
  el.style.width = `${cols * CELL}px`;
  el.style.height = `${rows * CELL}px`;
  image = ctx.createImageData(cols, rows);
  falloff = new Float32Array(cols * rows);
  angle = new Float32Array(cols * rows);
  radius = new Float32Array(cols * rows);
  const cx = width * ORIGIN_X;
  const cy = height * ORIGIN_Y;
  const reach = Math.min(width * 0.5, 900);
  const fadeX = Math.min(width * 0.08, 120);
  const fadeY = height * 0.18;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      // Measure in squashed space, so the halo, beams and ripple are all a vertically scaled circle.
      const dx = x - cx;
      const dy = (y - cy) / SQUASH;
      const r = Math.hypot(dx, dy) / reach;
      // Fade out towards the backdrop's edges as well as away from the monitor.
      const edge = Math.min(1, Math.min(y, height - y) / fadeY, Math.min(x, width - x) / fadeX);
      const i = row * cols + col;
      falloff[i] = Math.max(0, 1 - r) ** 1.4 * Math.max(0, edge);
      angle[i] = Math.atan2(dy, dx);
      radius[i] = r;
    }
  }
}

function drawDither(seconds: number) {
  const ctx = ditherCanvas.value?.getContext('2d');
  if (!ctx || !image) return;
  const data = image.data;
  const turn = seconds * BEAM_TURN;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const o = i * 4;
      const f = falloff[i];
      if (f <= 0) {
        data[o + 3] = 0;
        continue;
      }
      // Beams: a sharpened cosine around the circle. Shimmer: a slow ripple running outward.
      const b = 0.5 + 0.5 * Math.cos(BEAMS * (angle[i] - turn));
      const beam = b * b * b * b;
      const ripple = 0.07 * Math.sin(radius[i] * 30 - seconds * 1.6);
      const v = f * (0.12 + 0.95 * beam + ripple);
      const level = Math.min(2, Math.floor(v * 2 + BAYER[(row & 3) * 4 + (col & 3)]));
      if (level <= 0) {
        data[o + 3] = 0;
        continue;
      }
      const tone = TONES[level - 1];
      data[o] = tone[0];
      data[o + 1] = tone[1];
      data[o + 2] = tone[2];
      data[o + 3] = tone[3];
    }
  }
  ctx.putImageData(image, 0, 0);
}

// ─── Loop ────────────────────────────────────────────────────────────────────

function drawStill() {
  if (isDark.value) drawStars(0);
  else drawDither(0);
}

function resize() {
  const el = backdrop.value;
  if (!el) return;
  width = el.clientWidth;
  height = el.clientHeight;
  sizeStars();
  sizeDither();
  lastDither = -Infinity;
  if (!raf) drawStill();
}

function frame(t: number) {
  const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
  last = t;
  if (isDark.value) {
    drawStars(dt);
  } else if (t - lastDither >= 1000 / DITHER_FPS) {
    lastDither = t;
    drawDither(t / 1000);
  }
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf || reducedMotion || !visible) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  resizeObserver = new ResizeObserver(resize);
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  if (backdrop.value) {
    resizeObserver.observe(backdrop.value);
    intersectionObserver.observe(backdrop.value);
  }
  resize();
  // Spread the first stars through the whole depth so the field starts full, not as one burst.
  stars = Array.from({ length: STAR_COUNT }, () => spawn(0.05 + Math.random() * 0.95));
  drawStill();
  start();
});

watch(isDark, () => {
  lastDither = -Infinity;
  drawStill();
});

onBeforeUnmount(() => {
  stop();
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<template>
  <div ref="backdrop" class="backdrop" aria-hidden="true">
    <canvas ref="starCanvas" class="stars" />
    <canvas ref="ditherCanvas" class="dither" />
  </div>
</template>

<style scoped>
.backdrop {
  /* The full window width, centred on the monitor, and 30% above / 20% below it. ORIGIN_* in
     the script match. html has overflow-x: clip (custom.css), so this never scrolls the page. */
  position: absolute;
  top: -30%;
  bottom: -20%;
  left: 50%;
  width: 100vw;
  margin-left: -50vw;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.stars {
  display: none;
  width: 100%;
  height: 100%;
  /* Fade out at the top and bottom; the sides fade in the script. */
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 80%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 80%, transparent);
}

html.dark .stars {
  display: block;
}

.dither {
  /* Drawn one canvas pixel per dither cell and scaled up crisply; the script sets its size.
     It fades itself by dithering, so it has no mask. */
  display: block;
  image-rendering: pixelated;
}

html.dark .dither {
  display: none;
}
</style>
