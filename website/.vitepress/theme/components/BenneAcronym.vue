<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { B_WORDS } from '../bWords';

const LAST_WORD_KEY = 'benne-last-b-word';

// The server-built HTML says "Bennethon"; after hydration the reel spins to this visit's word.
const word = ref(B_WORDS[0]);
const spinning = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function readLastWord(): string | null {
  try {
    return localStorage.getItem(LAST_WORD_KEY);
  } catch {
    return null;
  }
}

function rememberWord(w: string) {
  try {
    localStorage.setItem(LAST_WORD_KEY, w);
  } catch {
    // Private windows and blocked storage just mean the next visit might repeat a word.
  }
}

function pickWord(avoid: string[]): string {
  const choices = B_WORDS.filter((w) => !avoid.includes(w));
  return choices[Math.floor(Math.random() * choices.length)];
}

function spin(avoid: string[]) {
  const final = pickWord(avoid);
  rememberWord(final);
  clearTimeout(timer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    word.value = final;
    return;
  }
  // A slot-machine reel: quick flicks that slow down, then the landing word.
  const delays = [40, 45, 50, 55, 60, 70, 80, 95, 115, 140, 175, 220];
  spinning.value = true;
  let step = 0;
  const tick = () => {
    if (step < delays.length) {
      word.value = pickWord([word.value, final]);
      timer = setTimeout(tick, delays[step++]);
    } else {
      word.value = final;
      spinning.value = false;
    }
  };
  tick();
}

onMounted(() => {
  const last = readLastWord();
  spin(last ? [last] : []);
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <h1 class="acronym" aria-label="BENNE">
    <button
      type="button"
      class="line b-line"
      :class="{ spinning }"
      title="Click to spin again"
      @click="spin([word])"
    >
      <span class="initial">B</span><span class="rest" aria-live="polite">{{ word.slice(1) }}</span>
    </button>
    <span class="line"><span class="initial">E</span><span class="rest">ngine</span></span>
    <span class="line small">for</span>
    <span class="line"><span class="initial">N</span><span class="rest">ifty</span></span>
    <span class="line"><span class="initial">N</span><span class="rest">arrative</span></span>
    <span class="line"><span class="initial">E</span><span class="rest">xperiences</span></span>
  </h1>
</template>

<style scoped>
.acronym {
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  margin: 0;
  font-family: var(--benne-font-pixel);
  font-size: clamp(2rem, 7vw, 3.25rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.line {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}

.initial {
  display: inline-block;
  min-width: 0.78em;
  color: var(--vp-c-brand-1);
  text-shadow: 0.08em 0.08em 0 var(--benne-shadow);
}

.rest {
  color: var(--vp-c-text-1);
}

.small {
  padding-left: 0.78em;
  font-size: 0.5em;
  font-weight: 400;
  color: var(--vp-c-text-2);
}

.b-line {
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  margin-left: -0.15em;
  padding: 0 0.15em;
  transition: background-color 0.2s;
}

.b-line .initial,
.b-line .rest {
  color: var(--benne-amber);
}

.b-line:hover {
  background: var(--vp-c-default-soft);
}

.b-line:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.b-line.spinning .rest {
  animation: flick 60ms steps(2) infinite;
}

@keyframes flick {
  from { transform: translateY(-0.06em); opacity: 0.75; }
  to { transform: translateY(0.06em); opacity: 1; }
}
</style>
