---
layout: home
title: BENNE
titleTemplate: Point-and-click adventures in TypeScript
markdownStyles: false
---

<div class="benne-home">
  <section class="hero">
    <div class="pitch">
      <BenneAcronym />
      <p class="tagline">
        Make point-and-click adventure games in TypeScript, with live previews in VS Code.
        Scripts read like a screenplay. Pixels stay crisp.
      </p>
      <div class="actions">
        <a class="btn primary" href="/guide/introduction">Get started</a>
        <a class="btn" href="/guide/bennescript">Learn BenneScript</a>
      </div>
    </div>
    <div class="stage">
      <HomeGame />
    </div>
  </section>

  <section class="features">
    <a class="feature" href="/guide/bennescript">
      <h2>Scripts that read like a screenplay</h2>
      <p>Lines run in the order you write them. No <code>await</code>. Dialogue is just <code>Hank: `Hello!`</code>.</p>
    </a>
    <a class="feature" href="/guide/benne-editor">
      <h2>An editor that lives in VS Code</h2>
      <p>Live room previews, polygon editing, inspectors, scaffolding and “play from this room”.</p>
    </a>
    <a class="feature" href="/guide/game-configuration">
      <h2>Any verbs you like</h2>
      <p>Nine-verb SCUMM bars, two-click minimalism, or something nobody has thought of yet.</p>
    </a>
    <a class="feature" href="/guide/core-concepts">
      <h2>Pixel-perfect by design</h2>
      <p>Aseprite sprites, bitmap fonts and low internal resolutions, scaled crisply.</p>
    </a>
    <a class="feature" href="/guide/sound-voice-and-video">
      <h2>Talkies welcome</h2>
      <p>Music, sound effects, voiced dialogue and video cutscenes, all named and autocompleted.</p>
    </a>
    <a class="feature" href="/guide/publishing-games">
      <h2>Ship it anywhere</h2>
      <p>One command for an itch.io browser build, another for a Windows desktop build.</p>
    </a>
  </section>
</div>

<style>
.benne-home {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px 96px;
}

.benne-home .hero {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 48px;
  align-items: center;
}

.benne-home .pitch {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.benne-home .tagline {
  margin: 0;
  max-width: 34ch;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.benne-home .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.benne-home .btn {
  display: inline-block;
  padding: 10px 20px;
  border: 2px solid var(--vp-c-brand-1);
  border-radius: 8px;
  font-family: var(--benne-font-pixel);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  box-shadow: 3px 3px 0 var(--benne-shadow);
  transition: transform 0.1s, box-shadow 0.1s;
}

.benne-home .btn.primary {
  color: var(--vp-c-white);
  background: var(--vp-c-brand-1);
}

.benne-home .btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--benne-shadow);
}

.benne-home .btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--benne-shadow);
}

.dark .benne-home .btn.primary {
  color: #15111f;
}

.benne-home .features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 72px;
}

.benne-home .feature {
  display: block;
  padding: 20px 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  color: inherit;
  transition: border-color 0.2s, transform 0.2s;
}

.benne-home .feature:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.benne-home .feature h2 {
  margin: 0 0 8px;
  font-family: var(--benne-font-pixel);
  font-size: 1.15rem;
  line-height: 1.3;
  color: var(--vp-c-brand-1);
}

.benne-home .feature p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.benne-home .feature code {
  font-size: 0.85em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
}

@media (max-width: 960px) {
  .benne-home .hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
  .benne-home .features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .benne-home {
    padding: 24px 16px 64px;
  }
  .benne-home .features {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 48px;
  }
}
</style>
