<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

// Behind the homepage monitor: warp-speed stars in dark mode, a turning green starburst in light
// mode. Both come from the middle of the screen, behind the monitor, and run to the window's edges.

const { isDark } = useData();
const canvas = ref<HTMLCanvasElement | null>(null);

// The backdrop spans the window and overhangs the monitor 30% above and 20% below (see the CSS),
// so the screen's centre (41.5% down the monitor image) is here in its box.
const ORIGIN_X = 0.5;
const ORIGIN_Y = (0.3 + 0.415) / 1.5;

const STAR_COUNT = 260;
const SPEED = 0.09; // depth units per second
const TRAIL = 0.035; // how far back in depth each streak starts
const EDGE_FADE = 0.12; // stars fade out over this much of the width before the window's sides
const COLORS = ['255, 255, 255', '61, 255, 110', '120, 230, 228'];

interface Star { x: number; y: number; z: number; color: string }

let stars: Star[] = [];
let raf = 0;
let last = 0;
let visible = true;
let reducedMotion = false;
let width = 0;
let height = 0;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;

function spawn(star: Partial<Star> = {}, z = 1): Star {
  return {
    // Wide windows get a wider field, so stars reach the side edges as well as the top and bottom.
    x: (Math.random() * 2 - 1) * 1.2 * Math.max(1, width / Math.max(height, 1)),
    y: (Math.random() * 2 - 1) * 0.9,
    z,
    color: Math.random() < 0.7 ? COLORS[0] : COLORS[1 + Math.floor(Math.random() * 2)],
    ...star,
  };
}

function resize() {
  const el = canvas.value;
  if (!el) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  width = el.clientWidth;
  height = el.clientHeight;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!raf) draw(0);
}

function draw(dt: number) {
  const ctx = canvas.value?.getContext('2d');
  if (!ctx || !width) return;
  ctx.clearRect(0, 0, width, height);
  const cx = width * ORIGIN_X;
  const cy = height * ORIGIN_Y;
  const scale = Math.min(width, height) * 0.22;
  const fadeZone = Math.min(width * EDGE_FADE, 140);
  ctx.lineCap = 'round';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.z -= SPEED * dt;
    const x = cx + (s.x / s.z) * scale;
    const y = cy + (s.y / s.z) * scale;
    if (s.z <= 0.02 || x < -20 || x > width + 20 || y < -20 || y > height + 20) {
      stars[i] = spawn();
      continue;
    }
    const tz = s.z + TRAIL;
    const tx = cx + (s.x / tz) * scale;
    const ty = cy + (s.y / tz) * scale;
    const near = 1 - s.z; // 0 far away, 1 close
    const edge = Math.max(0, Math.min(1, Math.min(x, width - x) / fadeZone));
    if (edge === 0) continue;
    ctx.strokeStyle = `rgba(${s.color}, ${(0.05 + near * 0.3) * edge})`;
    ctx.lineWidth = 0.5 + near * 1.3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

function frame(t: number) {
  const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
  last = t;
  draw(dt);
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf || reducedMotion || !visible || !isDark.value) return;
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
  if (canvas.value) resizeObserver.observe(canvas.value);
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  if (canvas.value) intersectionObserver.observe(canvas.value);
  resize();
  // Spread the first stars through the whole depth so the field starts full, not as one burst.
  stars = Array.from({ length: STAR_COUNT }, () => spawn({}, 0.05 + Math.random() * 0.95));
  start();
});

watch(isDark, (dark) => {
  if (dark) {
    resize();
    start();
  } else {
    stop();
  }
});

onBeforeUnmount(() => {
  stop();
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <canvas ref="canvas" class="stars" />
    <div class="burst">
      <div class="glow" />
      <div class="rays long" />
      <div class="rays short" />
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  /* The full window width, centred on the monitor, and 30% above / 20% below it. ORIGIN_* in
     the script match. html has overflow-x: clip (custom.css), so this never scrolls the page. */
  --ox: 50%;
  --oy: 47.67%;
  position: absolute;
  top: -30%;
  bottom: -20%;
  left: 50%;
  width: 100vw;
  margin-left: -50vw;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* Fade out at the top and bottom; the sides run to the window's edges. */
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 80%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 80%, transparent);
}

.stars {
  display: none;
  width: 100%;
  height: 100%;
}

html.dark .stars {
  display: block;
}

.burst {
  position: absolute;
  inset: 0;
}

html.dark .burst {
  display: none;
}

.glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--ox) var(--oy), rgba(61, 255, 110, 0.3), rgba(61, 255, 110, 0.08) 30%, transparent 55%);
}

.rays {
  /* A square centred on the screen, big enough that its corners never show. */
  position: absolute;
  left: var(--ox);
  top: var(--oy);
  width: max(160vw, 1600px);
  aspect-ratio: 1;
  translate: -50% -50%;
}

.rays.long {
  background: repeating-conic-gradient(from 0deg, rgba(61, 255, 110, 0.24) 0deg 8deg, transparent 8deg 20deg);
  -webkit-mask-image: radial-gradient(circle closest-side, #000 8%, rgba(0, 0, 0, 0.5) 35%, transparent 70%);
  mask-image: radial-gradient(circle closest-side, #000 8%, rgba(0, 0, 0, 0.5) 35%, transparent 70%);
  animation: turn 240s linear infinite;
}

.rays.short {
  background: repeating-conic-gradient(from 12deg, rgba(16, 144, 142, 0.14) 0deg 4deg, transparent 4deg 20deg);
  -webkit-mask-image: radial-gradient(circle closest-side, #000 6%, transparent 40%);
  mask-image: radial-gradient(circle closest-side, #000 6%, transparent 40%);
  animation: turn 320s linear infinite reverse;
}

@keyframes turn {
  to { rotate: 360deg; }
}

@media (prefers-reduced-motion: reduce) {
  .rays { animation: none; }
}
</style>
