<script setup lang="ts">
/**
 * A screenshot in the guides, which enlarges in a lightbox when clicked.
 *
 *   <DocShot src="/images/x.webp" alt="…" :width="800" :height="500" caption="…" />
 *
 * `width` and `height` are the size to show it at in CSS pixels; the image itself is twice that,
 * so it stays sharp on high-density screens. `caption` and the `|`-separated `legend` (for numbered
 * badges in the image) take `code` in backticks. With markdown between the tags, the screenshot
 * sits in a column beside it (blank lines around the markdown, as for any component).
 */
import { computed, ref, useSlots } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  legend?: string;
}>();

const slots = useSlots();
const dialog = ref<HTMLDialogElement>();
const url = computed(() => withBase(props.src));

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const format = (s: string) => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const caption = computed(() => (props.caption ? format(props.caption) : ''));
const legend = computed(() => (props.legend ? props.legend.split('|').map((s) => format(s.trim())) : []));

function open() {
  dialog.value?.showModal();
  document.documentElement.classList.add('doc-shot-locked');
}

function close() {
  dialog.value?.close();
}

function closed() {
  document.documentElement.classList.remove('doc-shot-locked');
}
</script>

<template>
  <div :class="slots.default ? 'doc-shot-row' : 'doc-shot-block'">
    <div v-if="slots.default" class="doc-shot-text"><slot /></div>
    <figure class="doc-shot" :style="{ '--doc-shot-width': `${width}px` }">
      <button type="button" class="doc-shot-open" :aria-label="`Enlarge screenshot: ${alt}`" @click="open">
        <img :src="url" :alt="alt" :width="width" :height="height" loading="lazy" decoding="async" />
        <span class="doc-shot-zoom" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
          </svg>
        </span>
      </button>
      <figcaption v-if="caption || legend.length">
        <span v-if="caption" v-html="caption" />
        <ol v-if="legend.length" class="doc-shot-legend">
          <li v-for="(item, i) in legend" :key="i" v-html="item" />
        </ol>
      </figcaption>
    </figure>
    <dialog ref="dialog" class="doc-shot-dialog" :aria-label="alt" @click="close" @close="closed">
      <img :src="url" :alt="alt" :width="width" :height="height" />
      <div v-if="caption || legend.length" class="doc-shot-dialog-caption">
        <span v-if="caption" v-html="caption" />
        <ol v-if="legend.length" class="doc-shot-legend">
          <li v-for="(item, i) in legend" :key="i" v-html="item" />
        </ol>
      </div>
      <button type="button" class="doc-shot-close" aria-label="Close" @click.stop="close">
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </dialog>
  </div>
</template>

<style>
/* Not scoped: the dialog's image and caption sit inside .vp-doc and must beat its rules. */
.doc-shot-block {
  margin: 24px 0;
}

.doc-shot-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 28px;
  align-items: start;
  margin: 16px 0 24px;
}

.doc-shot-text > :first-child {
  margin-top: 0;
}

.doc-shot-text > :last-child {
  margin-bottom: 0;
}

.doc-shot-row .doc-shot {
  margin: 4px 0 0;
}

@media (max-width: 767px) {
  .doc-shot-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .doc-shot-row .doc-shot {
    order: -1;
    max-width: min(100%, 240px);
    margin: 0 auto;
  }
}

.doc-shot {
  margin: 0 auto;
  max-width: min(100%, var(--doc-shot-width));
}

.doc-shot-open {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: zoom-in;
}

.doc-shot-open img,
.vp-doc .doc-shot-open img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: 0 6px 24px var(--benne-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.doc-shot-open:hover img,
.doc-shot-open:focus-visible img {
  transform: translateY(-2px);
  box-shadow: 0 10px 32px var(--benne-shadow);
}

.doc-shot-open:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.doc-shot-zoom {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(8, 16, 20, 0.8);
  color: #3dff6e;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.doc-shot-zoom svg,
.doc-shot-close svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.doc-shot-open:hover .doc-shot-zoom,
.doc-shot-open:focus-visible .doc-shot-zoom {
  opacity: 1;
}

@media (hover: none) {
  .doc-shot-zoom {
    opacity: 0.85;
  }
}

.doc-shot figcaption {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  text-align: center;
}

.doc-shot-row .doc-shot figcaption {
  text-align: left;
}

/* Numbered like the green badges drawn on the screenshots. */
.vp-doc .doc-shot-legend,
.doc-shot-legend {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: doc-shot;
  text-align: left;
}

.vp-doc .doc-shot-legend li,
.doc-shot-legend li {
  position: relative;
  margin: 6px 0 0;
  padding-left: 28px;
  counter-increment: doc-shot;
}

.doc-shot-legend li::before {
  content: counter(doc-shot);
  position: absolute;
  top: 1px;
  left: 0;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3dff6e;
  color: #04210d;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.doc-shot-dialog {
  max-width: 96vw;
  max-height: 96vh;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  cursor: zoom-out;
}

.doc-shot-dialog::backdrop {
  background: rgba(4, 10, 12, 0.88);
  backdrop-filter: blur(3px);
}

.doc-shot-dialog[open] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: doc-shot-in 0.18s ease-out;
}

.doc-shot-dialog img,
.vp-doc .doc-shot-dialog img {
  display: block;
  width: auto;
  height: auto;
  max-width: 96vw;
  max-height: calc(96vh - 96px);
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.doc-shot-dialog-caption {
  max-width: min(96vw, 720px);
  font-size: 14px;
  line-height: 1.5;
  color: #d5e4e8;
  text-align: center;
}

.doc-shot-dialog-caption code {
  color: #e8fff0;
  background: rgba(255, 255, 255, 0.1);
}

.doc-shot-dialog-caption .doc-shot-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 20px;
}

.doc-shot-close {
  position: fixed;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  background: rgba(8, 16, 20, 0.8);
  color: #e8fff0;
  cursor: pointer;
}

.doc-shot-close:hover,
.doc-shot-close:focus-visible {
  border-color: #3dff6e;
  color: #3dff6e;
}

html.doc-shot-locked {
  overflow: hidden;
}

@keyframes doc-shot-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .doc-shot-open img,
  .doc-shot-zoom {
    transition: none;
  }

  .doc-shot-open:hover img,
  .doc-shot-open:focus-visible img {
    transform: none;
  }

  .doc-shot-dialog[open] {
    animation: none;
  }
}
</style>
