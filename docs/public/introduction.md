---
title: Introduction
outline: deep
---

# Introduction

BENNE (Bennethon Engine for Nifty Narrative Experiences) is a modern, web-based engine for building point-and-click adventure games. It gives developers a complete, opinionated-but-extensible framework for rooms, characters, inventory, dialogs, and custom interfaces so you can focus on story, puzzles, and atmosphere instead of reinventing input systems, rendering pipelines, or save/load logic.

Built on Phaser 4 with a TypeScript core and Vite-powered workflow, BENNE runs in any modern browser and feels familiar to anyone who has worked with classic adventure tools. It draws direct inspiration from **Adventure Game Studio (AGS)**, **PowerQuest**, and the timeless interaction patterns of LucasArts’ SCUMM engine, while bringing those ideas into a contemporary web stack with live previews, polygon editing, and strong editor integration.

## BENNE is Opinionated

BENNE makes deliberate choices that keep the experience focused and the visual output consistently crisp:

- **Aseprite-only art pipeline** — All characters, props, cursors, and GUI elements are authored as Aseprite sprite sheets with tagged animations. The engine expects and optimizes for this workflow.
- **Bitmap fonts only** — Text is rendered exclusively with bitmap fonts for perfect pixel alignment and authentic retro feel. No TrueType or system fonts appear in gameplay.
- **Low internal resolution focus** — Games are designed around classic resolutions (typically 320×240 up to 640×480) with crisp integer or near-integer scaling. Pixel-perfect rendering is a core priority.
- **Polygon-based world geometry** — Walkable areas, hotspots, regions, and prop colliders are defined with polygons rather than tile maps or grids.
- **Bennescript facade + interaction queue** — Game logic is written against a clean, queue-aware scripting surface that automatically handles ordering of walks, speech, tweens, and sound so common narrative sequences “just work.”
- **Editor-first authoring** — Deep VS Code extension support (live room previews, polygon editing, GUI/character/inventory inspectors, scaffolding commands) is a first-class part of the intended workflow.

These constraints exist so the engine can deliver reliable retro aesthetics and predictable behavior with minimal configuration.

## BENNE is Flexible

Within those boundaries, BENNE is deliberately open and adaptable:

- **Any verb set you want** — Define verbs in `game-config.json`. Classic 9-verb SCUMM bars, two-button minimalist schemes, context-sensitive verbs, or anything in between are all supported.
- **Multiple point-and-click styles** — The same engine comfortably supports LucasArts-style direct control, Sierra-like verb-first interaction, and hybrid approaches through configurable input profiles and GUI layouts.
- **Powerful, fully scriptable GUI system** — Build complex interfaces using a JSON-driven layout system with 9-slice images, grids, buttons, sliders, checkboxes, list boxes, text inputs, and custom controls. Every GUI element can be shown, hidden, animated, and driven from Bennescript.
- **TypeScript at the core** — The entire engine is written in TypeScript. You can extend or replace subsystems, add new control types, custom shaders, or post-processing effects without fighting an opaque black box.
- **Layered scripting model** — Bennescript gives you high-level, safe facades for everyday work while still exposing raw event buses, per-frame `B.onUpdate` hooks, and full access to the underlying Phaser scene when you need more power.
- **Rich narrative and gameplay features** — Built-in support for dialog trees with state tracking, character following, region-based perspective scaling and tinting, dynamic visibility/animation overrides, inventory use-on-target, cutscenes, screen fades, and persistent speech/audio settings.
- **Rapid iteration tooling** — Live room, character, GUI, and inventory previews inside VS Code, polygon editing with real-time feedback, “Play from this room” workflows, and a full-runtime BENNE Play mode let you test ideas without leaving the editor.

BENNE is designed for developers who love the feel of classic point-and-click adventures but want modern tooling, clear architecture, and the freedom to shape the experience to match their vision. Whether you are building a short episodic mystery, a longer narrative-driven game, or experimenting with new interaction styles, the engine stays out of your way while giving you solid ground to stand on.
