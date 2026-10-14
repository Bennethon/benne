<script setup lang="ts">
import { B_WORDS } from '../bWords';
import { N_WORDS } from '../nWords';
import ReelWord from './ReelWord.vue';
</script>

<template>
  <p class="acronym">
    <ReelWord :words="B_WORDS" storage-key="benne-last-b-word" />
    <span class="word">Engine</span>
    <span class="word">for</span>
    <ReelWord :words="N_WORDS" storage-key="benne-last-n-word" />
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
</style>
