---
layout: home
title: BENNE
titleTemplate: Point-and-click adventures in TypeScript
markdownStyles: false
---

<div class="benne-home">
  <section class="hero">
    <h1 class="title">BENNE</h1>
    <BenneAcronym />
    <HomeGame />
    <p class="tagline">
      Point-and-click adventures, built with TypeScript and the web.<br>Built on ideas from the great adventure engines before it, and shared in case it helps you too.
    </p>
    <div class="actions">
      <a class="btn primary" href="/guide/introduction">Get started</a>
      <a class="btn" href="/guide/bennescript">Learn BenneScript</a>
    </div>
  </section>

  <section class="features">
    <a class="feature" href="/guide/introduction">
      <h2>Make your own adventure</h2>
      <p>Everything you need to build a classic point-and-click adventure, powered by modern web technology.</p>
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
  /* The hero spans the window so the monitor can grow; the feature cards keep a 1152px column. */
  padding: 32px 24px 96px;
}

.benne-home .hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
}

/* The monitor's backdrop (stars, dither) spreads behind the title, acronym and tagline. It is
   positioned, so lift the text above it; the monitor itself (.crt) stays in its own layer. */
.benne-home .hero > :not(.crt) {
  position: relative;
  z-index: 1;
}

.benne-home .title {
  /* sysfont has no descenders here, so pull the acronym up into the empty space below the caps. */
  margin: 0 0 -0.22em;
  /* The extrusion runs left, so pad that side to keep the word visually centred. */
  padding-left: 10px;
  font-family: var(--benne-font-pixel);
  font-size: clamp(4.5rem, 17vw, 10rem);
  font-weight: normal;
  line-height: 1;
  color: var(--benne-green);
  text-shadow: -1px 0 0 var(--benne-teal), -2px 0 0 var(--benne-teal), -3px 0 0 var(--benne-teal),
    -4px 0 0 var(--benne-teal), -5px 0 0 var(--benne-teal), -6px 0 0 var(--benne-teal),
    -7px 0 0 var(--benne-teal), -8px 0 0 var(--benne-teal), -9px 0 0 var(--benne-teal),
    -10px 0 0 var(--benne-teal), -11px 0 0 var(--benne-teal), -12px 0 0 var(--benne-teal);
}

/* Light mode: the green word barely shows on white, so it sits on a green strip instead, as wide
   as the feature cards and dithered away at both ends. */
html:not(.dark) .benne-home .title {
  /* Clear the strip's bottom edge. */
  margin-bottom: -0.1em;
  padding-left: 0;
  color: #0b1519;
  text-shadow: none;
}

html:not(.dark) .benne-home .title::before {
  /* The caps run from 0.15em to 0.825em down the line box; the strip adds two font pixels
     (0.075em each) above and below them. */
  content: '';
  position: absolute;
  z-index: -1;
  top: 0;
  left: 50%;
  width: min(100vw - 48px, 1152px);
  height: 0.975em;
  transform: translateX(-50%);
  background: var(--benne-green);
  /* The end images are dither masks, one pixel per 4px cell. Their last cells are solid, so the
     middle overlaps two of them: edges that only meet leave a faint seam off the pixel grid. */
  mask:
    url('/images/title-strip-left.png') left top / 256px 16px repeat-y,
    url('/images/title-strip-right.png') right top / 256px 16px repeat-y,
    linear-gradient(#000, #000) center / calc(100% - 496px) 100% no-repeat;
  image-rendering: pixelated;
}

@media (max-width: 640px) {
  html:not(.dark) .benne-home .title::before {
    width: calc(100vw - 32px);
    mask-size: 128px 8px, 128px 8px, calc(100% - 248px) 100%;
  }
}

.benne-home .tagline {
  margin: 8px 0 0;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.benne-home .actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.benne-home .btn {
  display: inline-block;
  padding: 10px 20px;
  border: 2px solid var(--vp-c-brand-1);
  border-radius: 8px;
  font-family: var(--benne-font-ui);
  font-size: 1.05rem;
  color: var(--vp-c-brand-1);
  box-shadow: 3px 3px 0 var(--benne-shadow);
  transition: transform 0.1s, box-shadow 0.1s;
}

.benne-home .btn.primary {
  border-color: var(--benne-teal);
  color: #000;
  background: var(--benne-green);
}

.benne-home .btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--benne-shadow);
}

.benne-home .btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--benne-shadow);
}

.benne-home .features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  max-width: 1152px;
  margin: 72px auto 0;
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
  font-family: var(--benne-font-ui);
  font-weight: normal;
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
