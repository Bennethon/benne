<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import MonitorBackdrop from './MonitorBackdrop.vue';

// The homepage game is a separate BENNE project. Its web build (`npm run build:itch`, unzipped)
// goes in website/public/play/. Until it is there, the monitor shows a "coming soon" screen.
const GAME_URL = withBase('/play/index.html');
const MONITOR_URL = withBase('/images/crt-monitor.webp');

const state = ref<'checking' | 'missing' | 'ready' | 'playing'>('checking');
const frame = ref<HTMLIFrameElement | null>(null);

onMounted(async () => {
  try {
    const res = await fetch(GAME_URL, { method: 'HEAD' });
    state.value = res.ok && (res.headers.get('content-type') ?? '').includes('text/html') ? 'ready' : 'missing';
  } catch {
    state.value = 'missing';
  }
});

function play() {
  if (state.value === 'ready') state.value = 'playing';
}

function fullscreen() {
  frame.value?.requestFullscreen?.();
}
</script>

<template>
  <figure class="crt">
    <div class="monitor">
      <MonitorBackdrop />
      <!-- The screen sits under the monitor image, whose screen is cut out; the bezel masks its edges. -->
      <div class="screen">
        <iframe
          v-if="state === 'playing'"
          ref="frame"
          :src="GAME_URL"
          title="BENNE intro game"
          allow="autoplay; fullscreen; gamepad"
          allowfullscreen
        />
        <button v-else-if="state === 'ready'" type="button" class="screen-button" @click="play">
          <span class="play">▶ PLAY</span>
          <span class="hint">Walk around my office. Try the computer.</span>
        </button>
        <div v-else class="screen-button idle">
          <span class="play">PLEASE WAIT…</span>
          <span class="hint">{{ state === 'checking' ? 'Warming up the tube' : 'The office is being tidied. A playable intro is on its way.' }}</span>
        </div>
      </div>
      <span class="floor" aria-hidden="true" />
      <img class="bezel" :src="MONITOR_URL" alt="" width="1448" height="1086" draggable="false" />
      <span class="led" :class="{ on: state === 'playing' }" aria-hidden="true" />
      <button
        type="button"
        class="power"
        :disabled="state !== 'ready'"
        :aria-label="state === 'playing' ? 'Power (on)' : 'Power on and play'"
        :title="state === 'ready' ? 'Power on' : undefined"
        @click="play"
      />
    </div>
    <figcaption v-if="state === 'playing'">
      <button type="button" class="fs" @click="fullscreen">⛶ Fullscreen</button>
    </figcaption>
  </figure>
</template>

<style scoped>
/* Positions are percentages of the 1448×1086 monitor image (public/images/crt-monitor.webp). */
.crt {
  /* As big as the window allows while the whole game screen stays above the fold: the screen's
     bottom edge is 0.533 × the monitor's width below its top, and about 340px of nav, title and
     acronym sit above the monitor. The stand may run below the fold. Never smaller than 960px
     (the window permitting), even if the screen then dips below the fold on short windows. */
  margin: 0 auto;
  width: min(100%, clamp(960px, (100svh - 340px) * 1.875, 1440px));
}

.monitor {
  position: relative;
  aspect-ratio: 1448 / 1086;
}

.screen {
  /* The cut-out spans x 265–1184, y 133–769; this reaches a couple of pixels under the bezel. */
  position: absolute;
  left: 18.16%;
  top: 12.06%;
  width: 63.74%;
  height: 58.93%;
  z-index: 1;
  overflow: hidden;
  background: #000;
}

.screen::after {
  /* Scanlines and a soft vignette, like glass. pointer-events: none keeps the game clickable. */
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.45) 100%),
    repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px);
}

.bezel {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  /* Light and teal-tinted, so it deepens the backdrop's greens instead of greying them. */
  filter: drop-shadow(0 6px 12px rgba(6, 64, 63, 0.2));
}

.floor {
  /* A contact shadow under the stand (x 345–1105, bottom ≈ y 1050) grounds the monitor. */
  position: absolute;
  z-index: 2;
  left: 20%;
  width: 60%;
  top: 92%;
  height: 9%;
  pointer-events: none;
  background: radial-gradient(closest-side, rgba(6, 40, 40, 0.38), rgba(6, 40, 40, 0.12) 60%, transparent);
}

iframe {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.screen-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2%;
  width: 100%;
  height: 100%;
  padding: 6%;
  text-align: center;
  font-family: var(--benne-font-ui);
  color: #e4f4f2;
  background:
    radial-gradient(ellipse at 50% 40%, rgba(16, 144, 142, 0.45), transparent 65%),
    radial-gradient(ellipse at 50% 115%, rgba(61, 255, 110, 0.2), transparent 55%),
    #061317;
}

button.screen-button {
  cursor: pointer;
}

.play {
  padding-left: 4px;
  font-family: var(--benne-font-pixel);
  font-size: clamp(1.25rem, 4.5vw, 2.75rem);
  color: var(--benne-green);
  text-shadow: -1px 0 0 var(--benne-teal), -2px 0 0 var(--benne-teal), -3px 0 0 var(--benne-teal), -4px 0 0 var(--benne-teal);
}

button.screen-button:hover .play,
button.screen-button:focus-visible .play {
  animation: blink 0.8s steps(2) infinite;
}

.hint {
  font-size: clamp(0.7rem, 1.8vw, 1rem);
  color: #b9dcd8;
}

.idle .play {
  animation: blink 1.4s steps(2) infinite;
}

@keyframes blink {
  50% { opacity: 0.35; }
}

.led {
  /* Over the image's LED, centred on (1124, 872). */
  position: absolute;
  z-index: 4;
  left: 77.27%;
  top: 79.83%;
  width: 0.76%;
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  background: var(--benne-green);
  box-shadow: 0 0 6px 2px var(--benne-green);
  transition: opacity 0.3s;
}

.led.on {
  opacity: 1;
}

.power {
  /* Over the image's power button, x 1154–1222, y 842–900. */
  position: absolute;
  z-index: 4;
  left: 79.7%;
  top: 77.53%;
  width: 4.7%;
  height: 5.34%;
  border-radius: 4px;
  cursor: pointer;
}

.power:disabled {
  cursor: default;
}

.power:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .play { animation: none !important; }
}

figcaption {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.fs {
  font-family: var(--benne-font-ui);
  font-size: 0.9rem;
  color: var(--vp-c-brand-1);
  cursor: pointer;
}

.fs:hover {
  text-decoration: underline;
}
</style>
