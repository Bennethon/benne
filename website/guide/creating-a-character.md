---
title: Creating a Character
outline: deep
---

# Creating a Character

**Characters** are the people (and robots, and cats) who walk, talk and get clicked on: the player, and everyone the player meets. You define a character once and can then place them in as many rooms as you like. The 9-verb template has three: Hank, the player; Penny, his roommate; and Henry, his friend outside.

## 1. Create the character

In the BENNE tree, right-click **Characters** and choose **Create Character** (also in the BENNE view's title bar and the Command Palette). Give it:

- a **display name**, such as `Penny`, which is shown on screen and can also start a line of dialogue;
- an **id**, such as `penny`, which names the folder and files. In scripts the character is `characters.penny`.

The editor creates:

```text
src/game/characters/penny/penny.character.json   ← who Penny is
src/game/characters/penny/penny.character.ts     ← her handlers, in every room
src/game/assets/images/characters/penny/         ← where her art goes
```

The new character walks at 88 pixels per second, has a starting walk-to point and talk point, and isn't clickable yet.

## 2. Draw the animations

A character's art is one Aseprite file, `assets/images/characters/penny/penny.aseprite`, exported next to it as `penny.png` and `penny.json` (see [Exporting from Aseprite](./creating-a-room#exporting-from-aseprite)). Every frame is the same size, with the character in the same place on it.

Name the animation tags after what the character is doing and which way they face:

| Tag | When it plays |
|---|---|
| `IdleL`, `IdleR`, `IdleU`, `IdleD` | Standing still, facing left, right, up (away) or down (toward the player) |
| `WalkL`, `WalkR`, `WalkU`, `WalkD` | Walking |
| `TalkL`, `TalkR`, `TalkU`, `TalkD` | Speaking a line |

Diagonals work too: `UL`, `UR`, `DL` and `DR`.

You don't have to draw every direction. When a tag is missing, BENNE uses the nearest direction that exists, and it mirrors left and right: draw `WalkL`, and walking right is `WalkL` flipped. Hank in the templates has only `L`, `U` and `D` tags. A character who never walks, like Penny, needs no `Walk` tags at all.

Any other tag is an animation you play from scripts, such as a `Wave` or a `Shrug`.

## 3. Import the animations

<DocShot src="/images/guides/character-animations.webp" alt="Hank’s animations in the Inspector: an Import Animations from Aseprite Tags button, then IdleD, IdleL, IdleU, TalkD, TalkL, TalkU and WalkD, and WalkL expanded to show loop ticked and frameDuration 80." :width="276" :height="710" legend="Import more tags at any time.|Each clip’s loop and frame duration.">

Right-click the character in the tree and choose **Import Animations from Aseprite Tags**. Pick the tags; each one gets an entry in the character's `animations`, set to loop. Then adjust them in the Inspector:

- **Loop** should be on for `Idle`, `Walk` and `Talk`, and off for one-off animations such as a wave, which play once and return to idle.
- **Frame duration** sets milliseconds per frame for the whole tag, instead of the timings drawn in Aseprite. Hank walks left at 80 ms per frame and up and down at 60.

</DocShot>

## 4. Set the feet, walk-to point, talk point and collider

Selecting a character opens the **character preview**. Pick any animation from the **Animation** menu to see it play. Then drag the handles into place:

| Handle | What it is |
|---|---|
| **Feet** | Where the character touches the ground. This is the point that walks along the floor, is placed in rooms, and is compared with baselines and regions. Put it between the feet, at the bottom of the shoes. |
| **Walk to** | Where *another* character stands to interact with this one, relative to the sprite. Penny's is to her right, so Hank stands beside her rather than on top of her. |
| **Talk** | Where speech text appears above this character, usually just above the head. |
| **Collider** (magenta) | The clickable shape. Click three times to start one, double-click an edge to add a point, and press **Delete** to remove a selected point. Without a collider, a clickable character is clicked anywhere on their frame. |

Click **Save to JSON** to keep the changes. The mouse wheel zooms, a middle-button drag pans, and **F** fits the character back in view.

<DocShot src="/images/guides/character-preview.webp" alt="Hank in the character preview, zoomed in: a magenta collider around him with yellow points, Talk above his head, Feet between his shoes and Walk to beside him. The Inspector shows his name, walkSpeed 88, clickable, movable, speech colour, and walkToPoint, talkPoint and feet fields." :width="1193" :height="620" caption="Hank in the character preview." legend="Pick an animation to play.|The collider (magenta).|The handles you drag, as numbers: `walkToPoint`, `talkPoint` and `feet`.|His `speechColor`." />

## 5. Fill in the details

Select the character and set the rest in the Inspector:

| Setting | What it does |
|---|---|
| `name` | The display name, used in the hover sentence when there's no description, and as a speaker name. |
| `description` | The name in the hover sentence ("Talk to **Henry**"). Leave it empty to use `name`. |
| `walkSpeed` | Pixels per second. |
| `speechColor` | The colour of this character's lines, such as `"#ffc2c2"`. Give each character their own. |
| `clickable` | Whether the player can point at and click this character. The player character is usually clickable too, so the player can look at themselves. |
| `defaultVerb` | The verb for a "default verb" click: `talkTo` for most people. See [Verbs](./verbs#default-verbs). |
| `movable` | `false` keeps the character from walking (they can still be moved by script with `moveTo`). |
| `activeCursorOverride` | A cursor animation to show over this character, such as a speech bubble. |

## 6. Place the character in rooms

A character appears in a room once the room places them. Right-click the room and choose **Add Spawned Character**, pick the character, drag them into position in the room preview and **Save to JSON**. Each placement has its own starting position, facing, animation, visibility and `zIndex`. See [Creating a room](./creating-a-room#8-put-characters-in-the-room).

### The player character

`startingPlayerCharacter` in `game-config.json` names the character the player controls when a new game starts. That character also has to be placed in each room they walk around in, like anyone else; the room's `onEnter` usually moves them to where they come in.

A game can switch the player to someone else in the same room:

```ts
penny.onPush(() => {
  player.switchTo(penny)     // the player now controls Penny
})
```

In scripts, `player` always means whoever the player controls now, and `Player:` speaks as them. `hank` means Hank, whoever is in control.

## 7. Script the character

A character's handlers can go in two places:

- **The character's own script** (`penny.character.ts`) applies in every room the character is in. Put their general reactions here.
- **A room's script** applies in that room only, and wins over the character script there.

```ts
// characters/henry/henry.character.ts: Henry, wherever he is.
import { faceClicked } from '@benne/script'
import { henry } from './henry.ids'

henry.onLook(() => {
  faceClicked()
  Player: `It looks like my buddy, Henry.`
})

henry.onPickUp(() => {
  faceClicked()
  Player: `He's too heavy.`
})
```

```ts
// rooms/apartment/apartment.room.ts: Penny, in the apartment.
penny.onTalkTo(() => {
  walkToClicked()
  Hank: `Hey Penny!`
  Penny: `Hi!`
  dialogs.chatwithpenny.start()
})

penny.onGiveItem(items.sammich, () => {
  walkToClicked()
  Hank: `Here, Penny! Have a sandwich.`
  inventory.remove(items.sammich)
  Penny: `Thank you! Here's the key.`
  inventory.add(items.key)
})
```

In the character script, the character is imported from its own `.ids` module, and other characters are `characters.x` from `@game`. In a room script, every character placed in that room is a plain name.

The Inspector's [verb chips](./verbs#verbs-in-the-editor) add handlers for you: on a character in the tree, they write to the character script; on a character placed in a room, to that room's script.

### Speaking

A line of dialogue is the character's name, a colon and the line:

```ts
Penny: `Make me a sandwich and I'll give you the key.`
```

The name can be the character's id or display name, in any capitalisation. While a character speaks, their `Talk` animation plays and the line appears at their talk point in their `speechColor`. A mistyped name stops the build with a suggestion. See [BenneScript → Talking](./bennescript#talking) for conversations, narration and voice files.

### Moving, facing and animating

```ts
henry.walkTo(points.henryFountain)    // walks there, and the script waits
henry.face('L')                       // 'L', 'R', 'U' or 'D'
henry.startFacing(hank)               // keeps turning to face Hank as he moves
henry.startFollowing(player, { minDistance: 60 })
henry.play('Wave')                    // a one-shot animation you've drawn; waits for it
henry.animation = 'IdleU'             // stays until henry.stopAnimation()
penny.hide()                          // and penny.show()
```

All of these are saved with the game, so a character is where the player left them when they come back. The full list is in the [API reference](../reference/bennescript-api#characters-penny-characterspenny).

### Size and lighting

Characters shrink as they walk into the distance, and darken in shadows, through the [regions](./creating-a-room#7-add-regions) of the room they're in rather than settings on the character. Draw characters at the size they should be closest to the camera.

## Checklist

- The sheet is exported to `assets/images/characters/<id>/` with `Idle`, `Walk` and `Talk` tags for the directions you need.
- Animations are imported, with `Idle`, `Walk` and `Talk` looping.
- Feet, walk-to point, talk point and collider are set and saved in the character preview.
- The character has a `speechColor`, and a `defaultVerb` if they can be clicked.
- The character is placed in each room they appear in, and the player character in every room they walk around in.
- Look and talk handlers exist, in the character script or the rooms.
