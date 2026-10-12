<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

// The homepage game is a separate BENNE project. Its web build (`npm run build:itch`, unzipped)
// goes in website/public/play/. Until it is there, the monitor shows a "coming soon" screen.
const GAME_URL = withBase('/play/index.html');

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
  state.value = 'playing';
}

function fullscreen() {
  frame.value?.requestFullscreen?.();
}
</script>

<template>
  <figure class="monitor">
    <div class="bezel">
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
          <span class="hint">{{ state === 'checking' ? 'Loading' : 'The office is being tidied. A playable intro is on its way.' }}</span>
        </div>
      </div>
    </div>
    <figcaption>
      <span class="led" :class="{ on: state === 'playing' }" aria-hidden="true" />
      <span>BENNE-TRON 3000</span>
      <button v-if="state === 'playing'" type="button" class="fs" @click="fullscreen">⛶ Fullscreen</button>
    </figcaption>
  </figure>
</template>

<style scoped>
.monitor {
  margin: 0;
  width: 100%;
}

.bezel {
  padding: clamp(10px, 2.5vw, 22px);
  border-radius: 18px;
  background: linear-gradient(160deg, var(--benne-bezel-hi), var(--benne-bezel));
  box-shadow:
    inset 0 -4px 0 rgba(0, 0, 0, 0.25),
    0 18px 40px -18px rgba(0, 0, 0, 0.5);
}

.screen {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 10px;
  background: #120d1f;
}

.screen::after {
  /* Scanlines over the idle screens; the iframe sits above them while playing. */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 3px);
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
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 16px;
  text-align: center;
  font-family: var(--benne-font-pixel);
  color: #f4ecff;
  background:
    radial-gradient(ellipse at 50% 35%, rgba(255, 122, 168, 0.28), transparent 60%),
    radial-gradient(ellipse at 50% 110%, rgba(255, 184, 77, 0.3), transparent 55%),
    #1a1230;
}

button.screen-button {
  cursor: pointer;
}

.play {
  font-size: clamp(1.4rem, 4vw, 2.4rem);
  font-weight: 700;
  color: #ffb84d;
  text-shadow: 3px 3px 0 #6b1d3e;
}

button.screen-button:hover .play,
button.screen-button:focus-visible .play {
  animation: blink 0.8s steps(2) infinite;
}

.hint {
  font-size: clamp(0.85rem, 2vw, 1.05rem);
  color: #d9cdf0;
}

.idle .play {
  animation: blink 1.4s steps(2) infinite;
}

@keyframes blink {
  50% { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
  .play { animation: none !important; }
}

figcaption {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 0 6px;
  font-family: var(--benne-font-pixel);
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
}

.led.on {
  background: #4ade80;
  box-shadow: 0 0 6px #4ade80;
}

.fs {
  margin-left: auto;
  font: inherit;
  color: var(--vp-c-brand-1);
  cursor: pointer;
}

.fs:hover {
  text-decoration: underline;
}
</style>
