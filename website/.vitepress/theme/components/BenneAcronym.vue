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
  <p class="acronym">
    <button type="button" class="word b-word" :class="{ spinning }" title="Click to spin again" @click="spin([word])">
      B<span class="rest" aria-live="polite">{{ word.slice(1) }}</span>
    </button>
    <span class="word">Engine</span>
    <span class="word">for</span>
    <span class="word">Nifty</span>
    <span class="word">Narrative</span>
    <span class="word">Experiences</span>
  </p>
</template>

<style scoped>
.acronym {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 0.15em 0.4em;
  margin: 0;
  font-family: var(--benne-font-pixel);
  font-size: clamp(1.35rem, 3.6vw, 2.25rem);
  line-height: 1.2;
  color: var(--vp-c-text-1);
}

.word {
  white-space: nowrap;
}

.b-word {
  font: inherit;
  cursor: pointer;
  border-radius: 6px;
  padding: 0 0.15em;
  margin: 0 -0.15em;
  transition: background-color 0.2s;
}

.b-word:hover {
  background: var(--vp-c-default-soft);
}

.b-word:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.b-word.spinning .rest {
  display: inline-block;
  animation: flick 60ms steps(2) infinite;
}

@keyframes flick {
  from { transform: translateY(-0.06em); opacity: 0.75; }
  to { transform: translateY(0.06em); opacity: 1; }
}
</style>
