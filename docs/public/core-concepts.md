---
title: Core Concepts
outline: deep
---

# Core Concepts

This page introduces the fundamental ideas that shape how BENNE games are built and how the engine behaves at runtime. Understanding these concepts will make the rest of the documentation (and the engine itself) much easier to work with.

## Rooms

**Rooms** are the fundamental building blocks of a BENNE game. Almost everything the player experiences happens inside a room.

A room typically contains:

- Background artwork
- Walkable areas (defined as polygons)
- Props, hotspots, characters, and regions
- Its own dedicated script that runs when the room is loaded

Moving the player from one room to another is done with `B.room.changeTo(...)`. The engine automatically handles screen fading, cleanup of the previous room, and running the appropriate enter/leave lifecycle hooks so you don’t have to manage transitions manually.

Rooms are designed to be relatively self-contained. This makes it easier to reason about state, test individual areas, and keep your project organized as it grows.

## Characters and the Player

Every game has one **player character** (configured in `game-config.json`). Other non-player characters can be placed in rooms as needed.

Characters have rich runtime state that you can control from scripts:

- World position and facing direction
- Current animation (with the ability to temporarily override it)
- Visibility and movability flags
- Optional follow or facing behaviors toward other characters

Many of these properties persist automatically when you change rooms or save the game, so characters remember where they were and what they were doing.

## Interaction Model

BENNE uses a classic **verb + target** interaction model, with optional support for an active inventory item (“use X on Y”).

When the player clicks in the world, the engine resolves which verb should be used based on:

- The currently active verb (if any)
- Whether an inventory item is armed
- The `defaultVerb` defined on the target (prop, hotspot, or character)
- The current input profile

This resolution then triggers the appropriate handler in your scripts (`whenLookAt`, `whenUse`, `whenTalkTo`, `whenInventoryUsedOn`, etc.). The system is deliberately flexible — you define exactly which verbs exist and how they behave.

## Bennescript and the Interaction Queue

**Bennescript** is the scripting layer you use to write game logic. It provides different surfaces depending on context:

- Room scripts
- Character scripts
- Inventory item scripts
- Global scripts
- GUI scripts
- Dialog scripts

One of the most important features of Bennescript is the **interaction queue**. Most actions you trigger — walking, speaking, waiting, playing sounds, changing rooms, etc. — are placed on a queue. The next line of your script does not execute until the previous action has finished.

This design lets you write sequences that feel linear and natural:

```ts
// (example shown for illustration only)
B.player.walkTo('door');
B.player.say('I wonder where this leads...');
B.wait(0.5);
B.room.changeTo('hallway');
```

Without the queue, you would have to manually coordinate timing and callbacks. The queue handles that for you.

## Game State

All important persistent information in a BENNE game flows through the **GameStateManager**. This includes:

- Inventory contents
- Custom variables you create
- Character visibility, position, and animation overrides
- Room visit counts and dialog option tracking
- Player settings (volume levels, speech preferences, etc.)

Because the GameStateManager is the single source of truth, changes you make through Bennescript are usually persisted automatically. When the player saves the game, a snapshot of this state is written. Loading a save restores the world to the exact state it was in when saved.

## GUIs and Overlays

**GUIs** are separate visual layers that sit on top of the game world. They are used for:

- Verb bars and inventory panels
- Dialog choice interfaces
- Menus (save/load, settings, etc.)
- Custom narrative overlays or HUD elements

GUIs are defined in JSON and can contain a wide variety of controls (buttons, sliders, checkboxes, list boxes, text inputs, etc.). Each GUI has its own script where you can respond to user interaction.

GUIs can be shown or hidden at any time from Bennescript, and they support modal behavior when you need to pause gameplay input.

## The BENNE Editor

While it is possible to edit JSON files and TypeScript scripts by hand, the recommended way to work with BENNE is through the **BENNE Editor** — a dedicated VS Code extension.

The editor provides:

- Live room previews with real-time polygon editing (walkable areas, hotspots, regions, prop colliders, etc.)
- Inspectors that let you modify properties and automatically scaffold script handlers
- Commands to create new rooms, characters, GUIs, dialogs, and more
- “Play from this room” functionality for rapid testing
- Character, GUI, and inventory preview tools

This tight integration between editor and runtime is one of the biggest productivity advantages when building games with BENNE.

## Content Structure

A BENNE game is primarily **data-driven**:

- Most of your content lives in JSON definition files (`*.room.json`, `*.character.json`, `*.gui.json`, `*.inventory.json`, `*.dialog.json`)
- Light TypeScript scripts provide the behavioral glue
- Art assets are authored in Aseprite (with tagged animations) and bitmap fonts
- Audio is organized by category (SFX vs music)

The engine loads and wires this content together at startup and during room transitions. This separation keeps your project organized and makes it easier for multiple people (or future you) to work on different parts of the game without stepping on each other.

## Putting It All Together

These concepts work together to create a predictable, developer-friendly environment:

- You define **what** exists in JSON.
- You control **how** it behaves in focused Bennescript files.
- The engine handles the complex coordination (queuing, state persistence, rendering, input resolution, transitions).
- The BENNE Editor gives you fast feedback loops while you create.

Once you internalize these ideas, the rest of the documentation — configuration options, editor features, and the full Bennescript API — will feel like natural extensions of this core model rather than a collection of unrelated features.

---

*Next step suggestion: After this page, most readers will be ready for “Installation and New Game Setup” or a deeper dive into Game Configuration.*
