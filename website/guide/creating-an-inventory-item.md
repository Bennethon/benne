---
title: Creating an Inventory Item
outline: deep
---

# Creating an Inventory Item

**Inventory items** are the things the player carries: the key, the knife, the suspiciously useful rubber chicken. The player picks them up in rooms, looks at them, combines them with each other and uses them on the world. Most adventure game puzzles are built from items.

An item lives in two places at once. In a room it is a **prop** (the knife on the table), and in the inventory it is an **item** (the knife icon). Picking it up hides one and adds the other:

```ts
knife.onPickUp(() => {
  walkToClicked()
  inventory.add(items.knife)
  knife.hide()
})
```

This page covers the item side. The prop is an ordinary [room prop](./creating-a-room#3-add-the-props).

## 1. Draw the icons

All item icons usually share one Aseprite file, `src/game/assets/images/inventory/inventory.aseprite`, exported next to it as `inventory.png` and `inventory.json` (see [Exporting from Aseprite](./creating-a-room#exporting-from-aseprite)). Each tag is an item's icon, named after the item's id. The 9-verb template's sheet has:

```text
Broom  Lantern  Lantern-glowing  Key  Knife  Knife-PB  PB  PB-open  Bread  Sammich
```

As with props, an item's other looks are tags named after it: `PB` is the closed jar and `PB-open` the open one. An animated icon is a tag over several frames (`Knife-PB` has three).

An item can have its own sheet instead, at `assets/images/inventory/<id>/<id>.png` and `.json`, by setting `"display": { "aseprite": true }` rather than the shared sheet's `"shared"`.

## 2. Create the items

**From the sheet, several at once:** right-click **Inventory** in the BENNE tree and choose **Import Inventory Items from Aseprite Tags**. Pick the tags that are items (leave out extra looks like `PB-open`), and say whether to create a script for each. Every tag you pick becomes an item with that id.

**One at a time:** right-click **Inventory** and choose **Create Inventory Item**. Give it a display name (`Peanut butter`) and an id (`PB`). The id is also the tag the item uses on the shared sheet, unless you set `defaultAnimation` to another tag.

Either way, each item gets a folder:

```text
src/game/inventory/PB/PB.inventory.json   ← the item
src/game/inventory/PB/PB.inventory.ts     ← what happens when the player does things with it
```

In scripts the item is `items.pb`: ids become camelCase, and an all-capitals first word is lower-cased.

## 3. Set it up

Select the item in the tree to edit it in the Inspector, with its icon shown in the inventory preview.

| Setting | What it does |
|---|---|
| `name` | The item's display name. |
| `description` | The name in the hover sentence ("Look at **peanut butter**"). Leave it empty to use `name`. |
| `stackable` | `true` lets the player carry more than one (coins, matches). `false` means they have it or they don't. |
| `defaultVerb` | The verb a "default verb" click does on the icon. See [Verbs](./verbs#default-verbs). |
| `cursorAnimation` | A tag on the item's sheet to use as the cursor while the item is in the player's hand, so using the key on the door shows a key cursor. |
| `cursor.hotspot` | The cursor's click point, `{ "x": …, "y": … }`, when `cursorAnimation` is set. |
| `dropWhenUsed` | Whether the item goes back in the inventory after it is used on something. Overrides the game's `dropWhenInventoryUsed`. |
| `animations` | Per-tag `loop` and `frameDuration`, for animated icons. |

The Inspector's [verb chips](./verbs#verbs-in-the-editor) list your game's verbs for the item: **+** adds a handler to its script, **⚡** jumps to one.

<DocShot src="/images/guides/inventory-item.webp" alt="The PB item selected: the inventory preview showing the peanut butter jar icon, PB.inventory.ts underneath with its onOpen and onUseItem handlers, and the Inspector with its name, stackable, shared sheet, default frame tag, description, verb chips with open handled, and its PB and PB-open animations." :width="1193" :height="864" caption="The peanut butter jar." legend="Its icon, as an inventory panel shows it.|Its script, `PB.inventory.ts`.|⚡ open: the jar has an `onOpen` handler.|Its two looks, `PB` and `PB-open`." />

## 4. Give it to the player

Items reach the inventory from scripts:

```ts
inventory.add(items.knife)
inventory.remove(items.sammich)
inventory.add(items.bread, 3)           // three, for a stackable item
if (inventory.has(items.key)) { … }
inventory.count(items.bread)
penny.inventory.add(items.sammich)      // another character's inventory
```

To start a new game with items already in the inventory, list their ids in `game-config.json`:

```json
"initialGameState": {
  "inventory": ["Broom", "Lantern", "Key"]
}
```

The player sees their items in an **inventory panel**, a GUI control that fills itself with whatever the player is carrying. Both templates include one: a panel beside the verb bar in 9-verb, and a bar that slides down from the top of the screen in 2-click. See [Creating a GUI](./creating-a-gui#controls).

<DocShot src="/images/guides/inventory-play.webp" alt="The 9-verb template running in BENNE Play: the verb buttons and, beside them, the inventory panel holding a broom, a lantern, a key and bread. Above the game, BENNE Play’s Inventory menu and Give button." :width="872" :height="546" caption="The 9-verb inventory panel in BENNE Play, with the template’s starting items and some bread from the **Give** button." />

## 5. Make it do things

An item's own script, `PB.inventory.ts`, handles two kinds of click:

- **A verb on the item's icon**: *Look at* the jar, *Open* the jar.
- **Another item used on this one**: the knife used on the jar.

```ts
// inventory/PB/PB.inventory.ts
import { items } from '@game'

items.pb.onOpen(() => {
  items.pb.animation = 'PB-open'
  Hank: `I opened the jar.`
})

items.pb.onUseItem(items.knife, () => {
  if (items.pb.animation === 'PB') {
    Hank: `I need to open the jar first.`
  } else {
    items.knife.animation = 'Knife-PB'
    Hank: `Mmmm... gooey peanut butter.`
  }
})
```

Notice that the jar's state lives in its icon: `items.pb.animation` is `'PB'` while it is closed and `'PB-open'` once opened, and the game saves it. Changing an icon's look is often all the state a small puzzle needs.

**Using an item on something in a room** belongs in that room's script, because it depends on the room:

```ts
// rooms/apartment/apartment.room.ts
door.onUseItem(items.key, () => {
  walkToClicked()
  flags.unlockedDoor = true
  inventory.remove(items.key)
  Player: `The door is unlocked.`
})
```

[Verbs → Items and verbs](./verbs#items-and-verbs) explains how the player gets an item into their hand, which handler runs, and what happens to the item afterwards.

### Combining items into a new one

Remove the ingredients and add the result. From `Bread.inventory.ts`:

```ts
items.bread.onUseItem(items.knife, () => {
  if (items.knife.animation === 'Knife') {
    Hank: `It won't do any good without something to spread!`
  } else {
    inventory.add(items.sammich)
    inventory.remove(items.bread)
    Hank: `This looks delicious!`
  }
})
```

The result needs to be an item of its own (here `Sammich`), with its own icon and JSON.

Players try items both ways round: knife on bread *and* bread on knife. BENNE runs the handler of the item that was clicked on, so handle both, or the second falls through to "That doesn't work." The simplest way is to write the work once, in a helper both scripts can call:

```ts
// scripts/sandwich.script.ts
export function makeSandwich() { … }

// inventory/Bread/Bread.inventory.ts
items.bread.onUseItem(items.knife, () => makeSandwich())

// inventory/Knife/Knife.inventory.ts
items.knife.onUseItem(items.bread, () => makeSandwich())
```

### An item verb that shouldn't pick the item up

Using an item verb on an icon (*Use* the sandwich) puts the item in the player's hand, ready to use on something. When that verb should do something else instead, add `.doNotActivate`:

```ts
// inventory/Sammich/Sammich.inventory.ts
items.sammich.onLook(() => {
  Player: `It looks delicious!`
})

// Use says a line instead of picking the sandwich up. Give still picks it up.
items.sammich.onUse.doNotActivate(() => {
  Player: `I am not hungry right now.`
})
```

### Changing an item from a script

```ts
items.lantern.animation = 'Lantern-glowing'   // a different icon
items.key.description = 'bent key'            // a different name on screen
items.key.cursorAnimation = 'Key-bent'        // a different cursor while in hand
```

All of these are saved.

## Checklist

- The item's icon is a tag on `assets/images/inventory/inventory.aseprite` (or its own sheet), exported.
- The item exists in `src/game/inventory/`, with a name and description.
- Something adds it to the inventory: a room prop's handler, a character, or `initialGameState`.
- It has an `onLook` handler. Players look at everything they pick up.
- Every combination the puzzle needs is handled, in both orders.
- Its uses on things in rooms are handled in those rooms' scripts.
