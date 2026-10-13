---
title: Verbs
outline: deep
---

# Verbs

A **verb** is something the player can do to a thing in the world: *Look at* the painting, *Pick up* the knife, *Use* the key *with* the door, *Talk to* Penny. Verbs are the controls of a point-and-click adventure, and in BENNE they belong to you. The engine has no built-in list of verbs. Your game's `game-config.json` names them, and everything else follows from that list: the handlers you write, the buttons in a verb bar, the sentence under the cursor, and what each mouse button does.

This page covers how to define verbs, how BENNE decides which verb a click means, how to handle verbs in scripts, and how inventory items work with them.

## The verbs in your game

Verbs are listed in `src/game/game-config.json`. This is the 9-verb template's list:

```json
"verbs": [
  { "id": "give",   "label": "Give",    "preposition": "to",   "usesItem": true },
  { "id": "pickUp", "label": "Pick up" },
  { "id": "use",    "label": "Use",     "preposition": "with", "usesItem": true },
  { "id": "open",   "label": "Open" },
  { "id": "look",   "label": "Look at" },
  { "id": "push",   "label": "Push" },
  { "id": "close",  "label": "Close" },
  { "id": "talkTo", "label": "Talk to" },
  { "id": "pull",   "label": "Pull" }
],
"defaultVerb": "look"
```

| Field | Required | What it does |
|---|---|---|
| `id` | yes | The verb's name in scripts. `talkTo` gives you `onTalkTo`, `verbs.talkTo` and `fallbacks.onTalkTo`. |
| `label` | yes | What the player reads: on a verb bar button and in the sentence under the cursor ("Talk to Penny"). |
| `preposition` | no | The joining word when an item is involved: "Use knife **with** bread", "Give sandwich **to** Penny". |
| `usesItem` | no | `true` makes this an **item verb**: the player uses it to pick up an inventory item and use it on something. It defaults to `true` when the verb has a `preposition`. See [Items and verbs](#items-and-verbs). |

The two templates use very different sets, and your game can have any set you like:

| Game | Verbs | How it plays |
|---|---|---|
| 9-verb template | Give, Pick up, Use, Open, Look at, Push, Close, Talk to, Pull | The classic LucasArts verb bar. |
| 2-click template | Look at, Use | Modern two-button play: left-click uses, right-click looks. No verb bar. |
| Your own | For example Take, Use, Look at, Clean, Talk to, Move | Whatever your game needs, such as a *Clean* verb for a game about tidying up. |

If `verbs` is left out entirely, the game gets two: `look` ("Look at") and `use` ("Use", with the preposition "with").

### Verb ids become handler names

Each verb id becomes a handler method on every prop, hotspot, character and inventory item in your game: `on` followed by the id in PascalCase.

| Verb id | Handlers you get |
|---|---|
| `look` | `onLook` |
| `talkTo` | `onTalkTo` |
| `pick-up` | `onPickUp` |
| `use` (an item verb) | `onUse`, and `onUseItem(item, …)` for using an item with something |
| `give` (an item verb) | `onGive`, and `onGiveItem(item, …)` |

These names are generated from the config whenever it changes (the editor, `npm run dev` and `npm run build` all regenerate them), so a new verb's handlers show up in autocomplete a moment after you save. They are also checked: a handler for a verb your game doesn't have is a type error, and so is every handler for a verb you rename or remove. Nothing quietly stops working.

A verb id must start with a letter. A few ids are reserved because their handlers would clash with built-in ones: `walkTo`, `defaultVerb`, `item`, `anyItem`, `combine` and `verbItem`. Two verbs whose handlers would collide fail too, such as an item verb `use` (which makes `onUseItem`) next to a verb called `useItem`.

## What a click does

### The two mouse buttons

The `inputProfile` says what the left (primary) and right (secondary) mouse buttons do when the player clicks on something:

```json
"inputProfile": {
  "primaryButtonVerb": "walkTo",
  "secondaryButtonVerb": "defaultVerb"
}
```

Each button takes one of three kinds of value:

- **A verb id** such as `"use"` or `"look"`: the button always does that verb.
- **`"walkTo"`**: the player walks over to the thing. No handler runs.
- **`"defaultVerb"`**: the button does whatever verb the clicked thing names as its default.

Any other value stops the game at startup with an error naming the button. When `inputProfile` is left out, left-click is `look` and right-click is `use`.

### Default verbs

Every prop, hotspot, character and inventory item can name a `defaultVerb`, set in its JSON or with the **Default verb** dropdown in the Inspector. In the 9-verb template the door outside has `"defaultVerb": "open"` and Penny has `"defaultVerb": "talkTo"`, so right-clicking the door opens it and right-clicking Penny starts a conversation.

Something without its own default uses the game's `defaultVerb`. When the game doesn't set one either, it is `look` if the game has a `look` verb, and otherwise the first verb in the list.

### The rules, in order

When the player clicks on a prop, hotspot or character, BENNE works out the verb like this:

1. **The player is holding an item and right-clicks.** The item goes back in the inventory and any verb they picked is cleared. Nothing else happens.
2. **The player picked a verb first**, for example by clicking *Push* on a verb bar. A left-click does that verb on the thing, and then the verb is cleared, so the next click behaves normally again. A right-click only clears the picked verb.
3. **Otherwise the button's setting decides:**
   - `walkTo`: the player walks to the thing. If they are holding an item, the click instead uses the item on the thing, with the `use` verb (or the first item verb, if the game has no `use`).
   - `defaultVerb`: the thing's default verb.
   - A verb id: that verb.

A click on empty floor always walks there with the left button. With the right button, it clears a picked verb.

Clicks on items in an inventory panel follow the same rules, with one difference: an item has nowhere to walk to, so where the button says `walkTo`, the click does the item's default verb instead. In the 9-verb template, clicking an item without picking a verb first looks at it.

### The two template schemes

| Scheme | Left button | Right button | What the player experiences |
|---|---|---|---|
| Verb bar (9-verb template) | `walkTo` | `defaultVerb` | Left-click walks, or does the verb they picked on the bar. Right-click does each thing's default verb, which the bar highlights as they point. |
| Two-click (2-click template) | `use` | `look` | Left-click uses things, right-click looks at them. There is no verb bar, and items are picked up with a left-click. |

The rest of the experience (whether there is a verb bar, what the hover text says, how the inventory opens) is built from GUIs and scripts, so a scheme is the input profile plus the GUIs that go with it. The templates are a good starting point for either.

## Handling verbs in scripts

### Where handlers go

| Thing | Script | Example |
|---|---|---|
| A prop or hotspot | its room's script | `door.onOpen(…)` in `apartment.room.ts` |
| A character, in one room | that room's script | `penny.onTalkTo(…)` in `apartment.room.ts` |
| A character, in every room | the character's own script | `henry.onLook(…)` in `henry.character.ts` |
| An inventory item (a verb on its icon) | the item's script | `items.pb.onOpen(…)` in `PB.inventory.ts` |
| Anything nothing else handles | `globalScript.ts` | `fallbacks.onPull(…)` |

### Walking over is up to you

BENNE doesn't walk the player over before it runs a verb handler. Each handler decides for itself, usually on its first line:

- `walkToClicked()` walks the player to the clicked thing's walk-to point and turns them toward its look-at point.
- `faceClicked()` only turns the player toward it.
- Neither: the player acts from wherever they are standing.

From the street outside the apartment in the 9-verb template:

```ts
rock.onLook(() => {
  faceClicked()                  // looking doesn't need a walk
  Hank: `It's a weird looking, out of place rock.`
})

rock.onPush(() => {
  walkToClicked()                // pushing does
  Player: `I think I can move it.`
  rock.hide()
  rockMoved.show()
  Player: `Huh, some weird lever hidden under the rock.`
})
```

When a thing has no walk-to point, the player walks to the nearest edge of a prop's collider, the middle of a hotspot, or a character's feet. Setting walk-to points is covered in [Creating a room](./creating-a-room#shaping-a-clickable-prop).

While the player is still walking over, a click somewhere else cancels the handler and starts the new action, so players can change their mind on the way.

### One handler for several verbs

```ts
door.on(['open', 'use'], () => {
  walkToClicked()
  rooms.apartment.goTo()
})
```

### Who handles a click

A click runs exactly one handler: the first one BENNE finds, looking in this order.

**A verb on a prop, hotspot or character**

1. The room script's handler for that thing (`penny.onLook` in `apartment.room.ts`).
2. The character's own script, for characters (`penny.onLook` in `penny.character.ts`).
3. The fallback for that verb in `globalScript.ts` (`fallbacks.onLook`).
4. `fallbacks.onAnyVerb`.
5. `fallbacks.onUnhandled`.

So a room can give a character a different reaction there than everywhere else: the room's handler wins in that room.

**A verb on an inventory item**

1. The item's script (`items.pb.onOpen` in `PB.inventory.ts`).
2. `fallbacks.on…` for that verb, then `fallbacks.onAnyVerb`, then `fallbacks.onUnhandled`.

**An item used on a prop, hotspot or character**

1. The room's handler for that item on that thing (`door.onUseItem(items.key, …)`, or `door.onItem(items.key, …)`).
2. The room's catch-all for that thing (`door.onAnyItem(…)`).
3. The character's own script, for characters.
4. The item-verb fallback (`fallbacks.onUseItem(…)`).
5. `fallbacks.onItemUnhandled`.

An item used on another item works the same way, looking in the script of the item that was clicked on.

### Passing a click on

`unhandled()` ends a handler and hands the click to the next step in the list above, as if the handler weren't there. Use it when a handler only applies some of the time:

```ts
door.onUseItem(items.key, () => {
  if (flags.unlockedDoor) unhandled()   // already unlocked: the fallback says "That doesn't work."
  walkToClicked()
  Player: `The door is unlocked.`
  // …
})
```

A plain `return` ends the handler without passing the click on.

### Fallbacks

`globalScript.ts` gives every verb a sensible answer for things nobody wrote a handler for. The 9-verb template's:

```ts
fallbacks.onLook(() => { Player: `Nothing special about that.` })
fallbacks.onUse(() => { Player: `That doesn't work.` })
fallbacks.onPickUp(() => { Player: `I can't take that.` })
fallbacks.onPush(() => { Player: `It won't move.` })
fallbacks.onPull(() => { Player: `It won't move.` })
fallbacks.onOpen(() => { Player: `I can't open that.` })
fallbacks.onClose(() => { Player: `That doesn't need closing.` })
fallbacks.onTalkTo(() => { Player: `I don't have anything to say to that.` })
fallbacks.onGive(() => { Player: `I can't give that.` })

// A verb added to game-config.json later, without a fallback above.
fallbacks.onAnyVerb(() => { Player: game.config.defaultFallbackLine ?? "That doesn't work." })

// An item used on something that has no handler for it.
fallbacks.onItemUnhandled(() => { Player: `That doesn't work.` })
```

Fallbacks are ordinary handlers, so they can do more than say a line. Item fallbacks receive the item and the thing it was used on: `fallbacks.onGiveItem((item, target) => { … })`.

Good fallback lines make a game feel bigger than it is. Players try every verb on everything, and a varied, in-character answer is far better than the same "That doesn't work." every time.

## Items and verbs

### Item verbs put an item in the player's hand

A verb with `"usesItem": true` (or with a `preposition`) is an **item verb**. Doing an item verb on an inventory item puts that item in the player's hand: the cursor shows the item's own cursor animation (if it has one), and the sentence under the cursor reads "Use Knife with". The player's next click on something uses the knife on it.

The 9-verb template's sandwich puzzle shows the whole flow:

1. The player clicks **Use**, then the knife in the inventory. The knife is now in hand: "Use Knife with".
2. They click the opened peanut butter jar in the inventory. Its script runs `items.pb.onUseItem(items.knife, …)`, which spreads peanut butter on the knife.
3. They use the knife on the bread the same way, and `items.bread.onUseItem(items.knife, …)` turns the bread into a sandwich.
4. They click **Give**, the sandwich, then Penny. The apartment script's `penny.onGiveItem(items.sammich, …)` runs, and Penny hands over the key.

In the 2-click template the left button is `use`, so there is no step 1: left-clicking an item in the inventory bar puts it in hand, and left-clicking something in the room uses it there. In either template, a right-click puts the item away.

### Handlers for items

```ts
door.onUseItem(items.key, () => { … })              // Use key with door
penny.onGiveItem(items.sammich, () => { … })        // Give sammich to Penny
door.onItem(items.key, () => { … })                 // the key, with any item verb
henry.onAnyItem((item, verb) => { … })              // any item without its own handler here
items.bread.onUseItem(items.knife, () => { … })     // an item on an item, in Bread.inventory.ts
items.bread.onCombine(items.knife, () => { … })     // the same as onItem, reads better for items
```

`onAnyItem` is the place for a character's "I don't want that" line, so that each item doesn't need its own.

### Item verbs on the item itself

Using an item verb on an item runs the item's own handler first (`items.sammich.onUse`), then puts it in hand. To do something else instead of picking it up, register the handler with `.doNotActivate`:

```ts
// Use says a line instead of picking the sandwich up. Give still picks it up.
items.sammich.onUse.doNotActivate(() => {
  Player: `I am not hungry right now.`
})
```

### When the item leaves the player's hand

After the player uses an item on something, it either stays in hand (so they can try it on something else) or goes back in the inventory. This is decided once the handler has finished, and also applies when nothing handled the use and a fallback answered. Putting the item back also clears any verb the player picked.

- `"dropWhenInventoryUsed"` in `game-config.json` sets this for the whole game. Left out, it is `false`: items stay in hand. The 9-verb template sets it to `true`, so items go back after each use; the 2-click template sets it to `false`.
- An item's own `"dropWhenUsed"` overrides the game setting for that item.
- `{ doNotClear: true }` as the last argument of a handler keeps the item in hand after that handler, whatever the settings say: `door.onUseItem(items.key, () => { … }, { doNotClear: true })`.

Scripts can also put an item in hand or take it away: `pointer.item = items.knife`, `pointer.item = null`.

## Verb bars and the verb line

A verb bar is an ordinary [GUI](./creating-a-gui) with a button for each verb. Here is the 9-verb template's whole script for one, `verbs.gui.ts`:

```ts
import { pointer } from '@benne/script'
import { guis, verbs } from '@game'
import {
  gui, closeBtn, giveBtn, lookAtBtn, menuBtn, openBtn, pickUpBtn, pullBtn, pushBtn, talkToBtn, useBtn, verbLineText,
} from './verbs.ids'

const buttons = new Map([
  [verbs.give, giveBtn],
  [verbs.pickUp, pickUpBtn],
  [verbs.use, useBtn],
  [verbs.open, openBtn],
  [verbs.look, lookAtBtn],
  [verbs.push, pushBtn],
  [verbs.close, closeBtn],
  [verbs.talkTo, talkToBtn],
  [verbs.pull, pullBtn],
])

// Clicking a verb button makes it the verb for the next click on the room.
for (const [verb, button] of buttons) button.onClick(() => verb.select())

menuBtn.onClick(() => guis.gameMenu.show())

// The verb line ("Use Knife with Bread"), and the hovered thing's default verb lit up.
function refresh() {
  verbLineText.text = pointer.sentence
  const highlighted = pointer.hover?.defaultVerb
  for (const [verb, button] of buttons) {
    button.visualState = verb === highlighted ? 'hover' : 'normal'
  }
}

gui.onBuilt(refresh)
pointer.onContextChange(refresh)
```

- `verbs.push.select()` picks a verb, exactly as rule 2 above describes. `verbs.push.isActive` says whether it is the picked one, and `pointer.verb` is the picked verb (or `null`; set it to `null` to clear it).
- `pointer.sentence` is the standard verb line. Once the player clicks, it shows that action until its handler finishes, wherever the pointer moves.
- `pointer.hover` is whatever the pointer is over, including its `defaultVerb`, which is how the bar lights up the right button.
- `pointer.onContextChange` runs whenever any of these change.

| The player… | `pointer.sentence` |
|---|---|
| points at nothing | Walk to |
| points at the door | Walk to door |
| picked Look at, and points at the door | Look at door |
| picked Use and clicked the knife | Use Knife with |
| …and points at the bread | Use Knife with Bread |

The name shown for a thing is its `description`, or its `name` if it has no description (characters and items have names), or its id. Scripts can change it at any time: `door.description = 'broken door'`.

Each verb handle also has the verb's `label`, `preposition` and `usesItem`, so a GUI can build its buttons' text from the config rather than repeating it.

## Cursors

The game cursor comes from `assets/images/cursor/` and the `cursor` block in `game-config.json` (see [Game configuration](./game-configuration#cursor-setup)). It shows `idleAnimation` normally and `activeAnimation` over anything clickable. Two things change that:

- A prop, hotspot or character with `"activeCursorOverride": "Talk"` shows the cursor sheet's `Talk` animation when the pointer is over it. The 2-click template does this on Penny, so the cursor tells the player a left-click will start a conversation.
- An item in hand shows its own `cursorAnimation`, an animation on the item's sheet. Scripts can change it: `items.key.cursorAnimation = 'key-bent'`.

## Verbs in the editor

When you select a prop, hotspot, character or inventory item, the Inspector shows a row of **verb chips**, one per verb in your game:

- **⚡ look**: a handler exists. Click it to jump to the handler in the script.
- **+ push**: no handler yet. Click it to add an empty one at the end of the right script, with its imports, ready to fill in. For a prop, this also makes it clickable.
- **Inv**: the same for item handlers. **+** adds an `onAnyItem` handler; **⚡** jumps to the item handlers that exist.

The **Default verb** dropdown sits next to them. The chips read your scripts, so a handler you type by hand shows up as ⚡ as soon as you save.

## Adding a verb, step by step

Say the 9-verb game needs a *Smell* verb.

1. Add it to `verbs` in `game-config.json`:

   ```json
   { "id": "smell", "label": "Smell" }
   ```

2. Save. Every prop, hotspot, character and item now has `onSmell`, and the Inspector shows a **smell** chip.

3. Give it a fallback in `globalScript.ts`, so the player gets an answer everywhere. Until you do, `fallbacks.onAnyVerb` answers for it.

   ```ts
   fallbacks.onSmell(() => { Player: `It doesn't smell of anything much.` })
   ```

4. Give the player a way to pick it. Add a button to the verb bar GUI (select the GUI, then **Add GUI Control** → **Button**, with the id `smellBtn`), position it in the GUI preview, and add it to the map in `verbs.gui.ts`:

   ```ts
   [verbs.smell, smellBtn],
   ```

5. Write the interesting answers:

   ```ts
   peanutButter.onSmell(() => {
     walkToClicked()
     Hank: `Smooth, not crunchy. Good.`
   })
   ```

Renaming a verb works the same way in reverse: change the `id`, and the type checker lists every handler that still uses the old name.

## Common questions

**My handler doesn't run.** Check that the thing can be clicked: a prop needs `"clickable": true` and a collider, a hotspot must be active, and anything hidden can't be clicked. Then check the handler is in the right script (a prop's handlers go in its own room's script), and that a room handler isn't winning over a character script's.

**The player doesn't walk over before acting.** Add `walkToClicked()` as the handler's first line. BENNE never walks the player over by itself.

**How do I make a verb do something different the second time?** Keep track with a flag or variable from `state.ts`:

```ts
rock.onPush(() => {
  walkToClicked()
  vars.timesPushedRock += 1
  if (vars.timesPushedRock < 3) {
    Hank: `It moved a little.`
  } else {
    Hank: `Huh, some weird lever hidden under the rock.`
    rock.hide()
    rockMoved.show()
  }
})
```

**How do I stop a verb working on one thing?** Don't write a handler for it, and the fallback answers. If a handler only applies sometimes, call `unhandled()` when it doesn't.

**Can the right button pick the next verb, like some Sierra games?** Not as a built-in setting. Each button maps to one verb, `walkTo` or `defaultVerb`. A script can change the picked verb at any time with `verbs.x.select()`, though.

For every verb-related name and property, see the [BenneScript API reference](../reference/bennescript-api#verbs-verbsx).
