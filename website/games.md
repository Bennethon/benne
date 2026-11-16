---
title: Games made with BENNE
description: Point-and-click adventures built with the BENNE engine.
sidebar: false
aside: false
prev: false
next: false
---

# Games made with BENNE

<div class="benne-games">
  <article class="game">
    <a class="cover" href="https://bennethon.itch.io/ai-apocalypse">
      <img src="/images/games/ai-apocalypse.png" alt="Title screen of Hank Steele and the AI Apocalypse: a janitor with a mop faces a giant robot with glowing red eyes." width="352" height="198">
    </a>
    <div class="details">
      <h2>Hank Steele and the AI Apocalypse</h2>
      <p class="byline">By Bennethon · September 2026 · Made for the $110 Adventure Game Challenge</p>
      <p>He came to clean the lab. He ended up cleaning the future. A retro point-and-click comedy in which a janitor is thrown into a future ruled by AI, and has to survive long enough to fix a broken time machine and get home.</p>
      <p>The first game built with BENNE.</p>
      <a class="play" href="https://bennethon.itch.io/ai-apocalypse">Play it on itch.io</a>
    </div>
  </article>
</div>

<style>
.benne-games {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 32px;
}

.benne-games .game {
  display: grid;
  grid-template-columns: minmax(0, 352px) minmax(0, 1fr);
  gap: 24px;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.benne-games .cover img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  image-rendering: pixelated;
}

.benne-games .details h2 {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: var(--benne-font-ui);
  font-weight: normal;
  font-size: 1.3rem;
  line-height: 1.3;
  color: var(--vp-c-brand-1);
}

.benne-games .details p {
  margin: 10px 0 0;
  line-height: 1.6;
}

.benne-games .byline {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.benne-games .play {
  display: inline-block;
  margin-top: 16px;
  padding: 8px 18px;
  border: 2px solid var(--benne-teal);
  border-radius: 8px;
  font-family: var(--benne-font-ui);
  color: #000;
  background: var(--benne-green);
  text-decoration: none;
  box-shadow: 3px 3px 0 var(--benne-shadow);
  transition: transform 0.1s, box-shadow 0.1s;
}

/* Keep the text black on hover: VitePress turns hovered page links brand green (teal in light
   mode), which vanishes on the green button. */
.benne-games .play:hover {
  color: #000;
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--benne-shadow);
}

@media (max-width: 720px) {
  .benne-games .game {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
