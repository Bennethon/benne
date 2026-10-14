<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  /** The words to choose from, all starting with the same letter. The first is the one the HTML is built with. */
  words: string[];
  /** The localStorage key that remembers the last word, so the next visit lands on a different one. */
  storageKey: string;
}>();

// The server-built HTML says the first word; after hydration the reel spins to this visit's word.
const word = ref(props.words[0]);
const spinning = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function readLastWord(): string | null {
  try {
    return localStorage.getItem(props.storageKey);
  } catch {
    return null;
  }
}

function rememberWord(w: string) {
  try {
    localStorage.setItem(props.storageKey, w);
  } catch {
    // Private windows and blocked storage just mean the next visit might repeat a word.
  }
}

function pickWord(avoid: string[]): string {
  const choices = props.words.filter((w) => !avoid.includes(w));
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
  <button type="button" class="reel" :class="{ spinning }" title="Click to spin again" @click="spin([word])">
    {{ word[0] }}<span class="rest" aria-live="polite">{{ word.slice(1) }}</span>
  </button>
</template>

<style scoped>
.reel {
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 6px;
  padding: 0 0.15em;
  margin: 0 -0.15em;
  transition: background-color 0.2s;
}

.reel:hover {
  background: var(--vp-c-default-soft);
}

.reel:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.reel.spinning .rest {
  display: inline-block;
  animation: flick 60ms steps(2) infinite;
}

@keyframes flick {
  from { transform: translateY(-0.06em); opacity: 0.75; }
  to { transform: translateY(0.06em); opacity: 1; }
}
</style>
