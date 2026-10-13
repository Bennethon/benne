---
title: Puzzle Dependency Charts
outline: deep
---

# Puzzle Dependency Charts

The **puzzle chart editor** is a whiteboard for designing your game's puzzles, built into the BENNE Editor. You draw each step of a puzzle as a box, and an arrow from one box to another for "this has to happen first". It's a convenience for you and anyone you make the game with: a way to see, plan and argue about the shape of your game before and while you build it.

::: info A chart never changes your game
Charts are saved with your game's content, in `src/game/pdcs/`, so they're versioned and shared along with everything else. But nothing in the game reads them. The engine doesn't load them, the build doesn't include them, they have no script, and nothing in BenneScript refers to them. Draw, rearrange and delete as much as you like: the game plays exactly the same.

The other side of that is that a chart doesn't know about your game either. It can't tell when the chart and the code disagree, so keep it up to date as the design changes.
:::

## What a puzzle dependency chart is

Adventure games are chains of things the player has to do in order. You can't open the door without the key; Penny won't hand over the key without a sandwich; you can't make a sandwich without bread, a knife and peanut butter. A **puzzle dependency chart** (PDC) draws those chains. It's a long-standing adventure game design technique, and once a game has more than a handful of puzzles, it's the clearest way to see the whole thing at once.

- Each **box** is something the player does or gets: "Get knife", "Use key on door".
- An **arrow** from one box to another means the first has to happen before the second is possible.
- Boxes with no arrows coming in are things the player can do straight away. The last box is the goal.

This is the chart that comes with the 9-verb template, for the sandwich puzzle its two rooms are built around:

<figure class="pdc-figure">
<svg viewBox="0 0 480 622" role="img" aria-labelledby="pdc-demo-title">
  <title id="pdc-demo-title">The 9-verb template's puzzle chart. In the apartment: get the peanut butter, then open it; with the knife, use the knife on the peanut butter; with the bread, use the knife on the bread to make a sandwich; give the sandwich to Penny to get the key; use the key on the door. Outside: push over the rock, pull the lever, and win.</title>
  <defs>
    <marker id="pdc-demo-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
      <path class="pdc-arrowhead" d="M0,0 L10,5 L0,10 z" />
    </marker>
  </defs>
  <rect class="pdc-group" x="8" y="8" width="464" height="402" rx="6" />
  <text class="pdc-group-label" x="20" y="30">Apartment</text>
  <rect class="pdc-group" x="8" y="426" width="464" height="188" rx="6" />
  <text class="pdc-group-label" x="20" y="448">Outside</text>
  <g class="pdc-edges">
    <line x1="92" y1="78" x2="92" y2="104" />
    <line x1="92" y1="138" x2="170" y2="164" />
    <line x1="236" y1="78" x2="230" y2="164" />
    <line x1="200" y1="198" x2="250" y2="224" />
    <line x1="388" y1="78" x2="330" y2="224" />
    <line x1="282" y1="258" x2="282" y2="284" />
    <line x1="282" y1="318" x2="282" y2="344" />
    <line x1="282" y1="378" x2="282" y2="460" />
    <line x1="282" y1="494" x2="282" y2="514" />
    <line x1="282" y1="548" x2="282" y2="568" />
  </g>
  <g class="pdc-nodes">
    <rect x="24" y="44" width="136" height="34" rx="5" /><text x="92" y="66">Get peanut butter</text>
    <rect x="176" y="44" width="120" height="34" rx="5" /><text x="236" y="66">Get knife</text>
    <rect x="320" y="44" width="136" height="34" rx="5" /><text x="388" y="66">Get bread</text>
    <rect x="24" y="104" width="136" height="34" rx="5" /><text x="92" y="126">Open peanut butter</text>
    <rect x="100" y="164" width="200" height="34" rx="5" /><text x="200" y="186">Use knife on peanut butter</text>
    <rect x="150" y="224" width="264" height="34" rx="5" /><text x="282" y="246">Use knife on bread to make sammich</text>
    <rect x="150" y="284" width="264" height="34" rx="5" /><text x="282" y="306">Give sammich to Penny to get key</text>
    <rect x="192" y="344" width="180" height="34" rx="5" /><text x="282" y="366">Use key on door</text>
    <rect x="192" y="460" width="180" height="34" rx="5" /><text x="282" y="482">Push over rock</text>
    <rect x="192" y="514" width="180" height="34" rx="5" /><text x="282" y="536">Pull lever</text>
    <rect class="pdc-goal" x="222" y="568" width="120" height="34" rx="5" /><text x="282" y="590">Win!</text>
  </g>
</svg>
<figcaption>The <code>demo</code> chart in the 9-verb template, with its boxes grouped by room.</figcaption>
</figure>

Reading it from the top: the player can pick up the peanut butter, the knife and the bread in any order. The chain narrows to a single path at the sandwich, and from there each step unlocks exactly one more until the fountain runs.

## Why draw one

A chart shows things about your game that are hard to see in the code, or in your head:

- **Where the player has choices.** Several boxes open at once means the player always has something to try. A chart that is one long line means a player stuck on one step is stuck on the whole game.
- **Bottlenecks.** A box with many arrows coming in, like the sandwich above, is where the threads come together. That's where players get stuck, so the clues for it matter most.
- **Dead ends and loose ends.** An item with no arrow going out is never used. A box that needs something no box provides can't be solved.
- **How the rooms fit together.** Grouping boxes by room shows how much back-and-forth a puzzle asks for, and which rooms carry too much.
- **A shared picture.** Writers, artists and programmers can talk about the same chart. Export it as an image to send to people without the editor.

Charts are useful for more than puzzles, too. A high-level **game flow**, from the intro through each chapter to the finale, or a **room map** showing how the locations connect, are quick to draw and handy to keep next to the puzzle charts.

### Tips for designing with a chart

- **Start from the goal and work backwards.** Write the last box first, then ask "what does the player need for that?" until you reach things they can just do.
- **Make it wide, not tall.** Two or three threads open at once keep players moving.
- **Give every item a job,** and look twice at any box that leads nowhere.
- **Group by room or chapter** to see how much walking the solution takes.
- **Invent your own conventions.** The editor gives line styles and colours no meaning, so use them however helps you: dashed arrows for optional steps, say, or dotted for parts not built yet.

## Creating a chart

In the BENNE tree, right-click **Puzzle Dependency Charts** and choose **Create Puzzle Chart** (also in the BENNE view's title bar and the Command Palette). Give it a title, such as `Chapter 1 puzzles`, and an id. The editor creates `src/game/pdcs/<id>/<id>.pdc.json` and opens it.

Select a chart in the tree at any time to open it in the chart editor. The starter games each include a `demo` chart to experiment with.

## Using the editor

The chart editor saves by itself a moment after each change, straight to the chart's JSON file. If the file changes on disk (you edit it by hand, or pull someone else's changes), the editor reloads it.

### Boxes

| To | Do this |
|---|---|
| Add a box | Double-click an empty spot, or click **Add node** to add one in the middle of the view. |
| Change its text | Double-click the box, or select it and click **Edit label**. **Enter** finishes, **Shift+Enter** starts a new line, **Esc** cancels. |
| Move it | Drag it. |
| Resize it | Select it, then drag the handles around its edge. |
| Delete it | Select it and press **Delete** or **Backspace**, or click **Delete selected**. Its arrows go with it. |

### Arrows

| To | Do this |
|---|---|
| Connect two boxes | Point at a box: white handles appear on its four sides. Drag from a handle onto another box. **Esc** cancels the drag. |
| Change how arrows look | Select them, then click **Straight**, **Curved** or **90-deg** for the route, and **Solid**, **Dashed** or **Dotted** for the line. |
| Reverse an arrow | Select it and click **Swap ↔**. |
| Make it two-way | Select it and click **Bidir ⇄**. Click again to make it one-way. |
| Select every arrow | Click **Select all connectors**, then change them all at once. |

### Groups

| To | Do this |
|---|---|
| Group boxes | Select two or more and click **Group selected**. Double-click the group's label to name it. |
| Move a box in or out | Drag it into or out of the group. |
| Remove a group | Select the group and click **Ungroup**. The boxes stay. |

### Finding your way around

| To | Do this |
|---|---|
| Select several things | Drag a rectangle across empty space. Hold **Shift** to add to the selection. |
| Pan | Drag with the right mouse button. |
| Zoom | Scroll the mouse wheel. |
| See everything | Click **Fit**. |
| Tidy up | **Layout ↓** arranges the chart top to bottom by its arrows; **Layout →** left to right. |

### Sharing

**Export PNG** and **Export SVG** save a picture of the chart, for a design document, a pitch or a message to a collaborator.

## From chart to game

Each box on a chart usually becomes a handler in a script, and each arrow becomes a condition the code has to check. Here is where every box of the demo chart lives in the 9-verb template:

| Box | Where it happens |
|---|---|
| Get peanut butter, Get knife, Get bread | `peanutButter.onPickUp`, `knife.onPickUp` and `bread.onPickUp` in `apartment.room.ts` |
| Open peanut butter | `items.pb.onOpen` in `PB.inventory.ts`: the jar's icon becomes `PB-open` |
| Use knife on peanut butter | `items.pb.onUseItem(items.knife, …)`, which checks the jar is open |
| Use knife on bread to make sammich | `items.bread.onUseItem(items.knife, …)` in `Bread.inventory.ts`, which checks the knife has peanut butter on it |
| Give sammich to Penny to get key | `penny.onGiveItem(items.sammich, …)` in `apartment.room.ts` |
| Use key on door | `door.onUseItem(items.key, …)`, which sets `flags.unlockedDoor` |
| Push over rock | `rock.onPush` in `outside.room.ts` |
| Pull lever, Win! | `rockMoved.on(['pull', 'push'], …)`, which turns on the fountain and sets `flags.turnedOnFountain` |

The arrows say what each handler has to check. "Open peanut butter → Use knife on peanut butter" is the line `if (items.pb.animation === 'PB')` that makes Hank say he needs to open the jar first. When an arrow has no matching check, the player can do things out of order, which is either a bug or a shortcut worth knowing about.

The chart is also a testing plan. Each box is a state worth starting from, and a [Play From](./creating-a-room#11-test-it) setup gets you there in one click:

```ts
playFrom('gotKey', () => {
  inventory.add(items.key)
})
```

## Where charts are kept

A chart is one JSON file, `src/game/pdcs/<id>/<id>.pdc.json`, holding its title, its boxes and their positions, and its arrows. Commit it with the rest of your game, and it travels with the project.

To delete a chart, right-click it in the BENNE tree and choose **Delete…**. That removes its folder; nothing else in the game changes.
