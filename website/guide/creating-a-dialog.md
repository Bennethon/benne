---
title: Creating a Dialog
outline: deep
---

# Creating a Dialog

A **dialog** is a conversation where the player chooses what to say. The screen shows a list of things the player can say. When they pick one, their character says it, the other character replies, and the list comes back, maybe with new topics in it, until the player says goodbye.

In BENNE a dialog has two halves:

- **The options** are the lines the player can choose. They live in the dialog's JSON and are edited in the Inspector.
- **The script** says what happens when each one is chosen: the replies, new topics appearing, items changing hands, the conversation ending.

This page builds the 9-verb template's conversation with Penny, then grows it to show the patterns bigger conversations use.

## 1. Create the dialog

In the BENNE tree, right-click **Dialogs** and choose **Create Dialog** (also in the BENNE view's title bar and the Command Palette). Give it:

- a **display name**, such as `Chat with Penny`, shown in the BENNE tree;
- an **id**, such as `chatwithpenny`, which names the folder and files. In scripts the dialog is `dialogs.chatwithpenny`.

The editor creates:

```text
src/game/dialogs/chatwithpenny/chatwithpenny.dialog.json   ← the options
src/game/dialogs/chatwithpenny/chatwithpenny.dialog.ts     ← what each one does
```

with one option to start you off, `greeting`, whose text is "Hello."

## 2. Write the options

Select the dialog in the tree. The Inspector lists its options, and **Add option** adds another. Each option has:

| Field | What it is |
|---|---|
| **id** | The option's name in scripts. `greeting` is `options.greeting`, and an id with spaces works too: `what about the key` is `options.whatAboutTheKey`. |
| **text** | What the player sees in the list, and what their character says when they pick it. |
| **enabled** | Whether the option is in the list when the conversation starts. Untick it for topics the player hasn't earned yet; a script turns them on later. |
| **say line** | Ticked (the default), the player's character speaks the option's text before its handler runs. Untick it for options like "(Leave)" that aren't spoken. |

Drag the **⋮⋮** handle to reorder options; the list on screen follows the same order. Changes are written to the JSON when you leave a field.

<DocShot src="/images/guides/dialog.webp" alt="The ChatWithPenny dialog selected: its script open with handlers for greeting, door and bye, and the Inspector listing the three options with door expanded to show its id, text, enabled, used and say line fields and a Script button." :width="1193" :height="820" caption="Penny’s dialog, with the `door` option open in the Inspector." legend="Add an option.|What the player sees and says.|Whether it is in the list from the start.|Whether the player says it before the handler runs.|Add the handler, or jump to it.|The handler for `door`." />

Penny's dialog has three options:

```json
{
  "id": "chatwithpenny",
  "displayName": "ChatWithPenny",
  "options": [
    { "id": "greeting", "text": "How's it goin?" },
    { "id": "door",     "text": "The door is locked. How do I get out?" },
    { "id": "bye",      "text": "Ok, bye!" }
  ]
}
```

## 3. Script the replies

The dialog's script has a handler for each option. Click **Script…** next to an option in the Inspector to add an empty one, or write it yourself:

```ts
// dialogs/chatwithpenny/chatwithpenny.dialog.ts
import { wait } from '@benne/script'
import { dialog, options } from './chatwithpenny.ids'

// The player says the option's text first, then the handler runs.

options.greeting.onChoose(() => {
  Penny: `Fine.`
})

options.door.onChoose(() => {
  Player: `I want to go outside.`
  Penny: `I want a sandwich.`
  wait(0.5)
  Player: `Uhh...`
  wait(0.5)
  Penny: `Make me a sandwich and I'll give you the key.`
})

options.bye.onChoose(() => {
  Penny: `Bye!`
  dialog.end()
})
```

When a handler finishes, the options come back for the player's next choice. `dialog.end()` closes the conversation instead. Nothing after `dialog.end()` in a handler runs, so put anything that should still happen above it.

## 4. Start the conversation

Conversations usually start from a *Talk to* handler on a character:

```ts
// rooms/apartment/apartment.room.ts
penny.onTalkTo(() => {
  walkToClicked()
  Hank: `Hey Penny!`
  Penny: `Hi!`
  dialogs.chatwithpenny.start()
  // anything here runs after the conversation ends
})
```

`start()` waits until the conversation is over, so lines after it run once the player leaves.

## Options that come and go

Most conversations change as the game goes on. Options are switched on and off from any script, and the game saves which are on.

```ts
options.door.on()                            // in the dialog's own script
dialogs.chatwithpenny.options.door.on()      // from anywhere else
dialogs.chatwithpenny.options.door.off()
if (options.door.enabled) { … }
```

### Topics that unlock other topics

Say you add two options to Penny's dialog, both with **enabled** unticked: `fountain` ("What's up with the fountain outside?") and `sandwich` ("About that sandwich…"). The player has to discover each topic before they can ask about it. Looking out of the window unlocks the fountain question:

```ts
// rooms/apartment/apartment.room.ts
windowHotspot.onLook(() => {
  faceClicked()
  Hank: `There's a fountain across the street. It's not running.`
  dialogs.chatwithpenny.options.fountain.on()
})
```

And asking about the locked door opens up the sandwich topic:

```ts
// dialogs/chatwithpenny/chatwithpenny.dialog.ts
options.door.onChoose(() => {
  cutscene(() => {
    Player: `I want to go outside.`
    Penny: `I want a sandwich.`
    Player: `Uhh...`
    Penny: `Make me a sandwich and I'll give you the key.`
  })
  options.sandwich.on()
})
```

### Options that disappear once chosen

`onChooseOnce` works like `onChoose`, then turns the option off. Use it for questions that only make sense once:

```ts
options.greeting.onChooseOnce(() => {
  Penny: `Fine.`
})
```

Options the player has already chosen, and that stay, are dimmed in the list (the colour is `dialog.usedColor` in `game-config.json`), so players can see what's new.

### Deciding the options as the conversation opens

`dialog.onStart` runs each time the conversation opens, before the player chooses. Use it when the options depend on the state of the game rather than on what was said:

```ts
// dialogs/chatwithpenny/chatwithpenny.dialog.ts
dialog.onStart(() => {
  if (flags.unlockedDoor) options.door.off()   // no point asking any more
})
```

## Ending with an outcome

A choice can do anything a handler can: give items, set flags, change rooms. When the player comes back with the sandwich, the `sandwich` option can make the whole trade and end the conversation:

```ts
options.sandwich.onChoose(() => {
  if (!inventory.has(items.sammich)) {
    Penny: `Well? Where is it?`
    return
  }
  cutscene(() => {
    inventory.remove(items.sammich)
    Penny: `Ooh, peanut butter. My favourite.`
    penny.face('D')
    wait(1)
    inventory.add(items.key)
    Penny: `Here's the key. Don't lose it!`
  })
  options.sandwich.off()
  options.door.off()
  dialog.end()
})
```

`penny` here is Penny in the apartment, imported into the dialog script from the room's `.ids` module (`import { penny } from '../../rooms/apartment/apartment.ids'`). A plain `return` ends the handler and brings the options back.

Wrapping a long answer in `cutscene(…)` lets the player skip the whole thing with **Esc**. A click skips one line at a time either way.

## Sub-conversations

Starting a dialog from inside a choice opens it on top of the current one. When the inner one ends, the outer one's options come back. This keeps big conversations organised into topics. Say Penny has a lot to say about the neighbours: put that in a second dialog, `penny-gossip`, and start it from an option in the first:

```ts
// dialogs/chatwithpenny/chatwithpenny.dialog.ts
options.neighbours.onChoose(() => {
  Penny: `Sure. Who do you want to know about?`
  dialogs.pennyGossip.start()       // back to these choices when it ends
})

// dialogs/penny-gossip/penny-gossip.dialog.ts
options.henry.onChoose(() => {
  Penny: `Henry? He's obsessed with that fountain.`
})

options.thatsAll.onChoose(() => {
  Penny: `Okay!`
  dialog.end()                      // back to Penny's main choices
})
```

## How it looks

The list of choices is drawn by a GUI, `src/game/guis/dialog/dialog.gui.json`, so its font, colours, background and position are yours to change (see [Creating a GUI](./creating-a-gui)). When the list is taller than the space for it, it scrolls; `dialog.choiceOptionsViewportHeightPx` in `game-config.json` sets that height.

<DocShot src="/images/guides/dialog-play.webp" alt="Penny’s dialog in BENNE Play: Hank and Penny stand by the couch, and below the room the three options are listed: How’s it goin?, The door is locked. How do I get out?, and Ok, bye!" :width="872" :height="546" caption="Penny’s options in the 9-verb template." />

A dialog can use a different choice GUI, for a character whose conversations look different, by naming it in the Inspector's **GUI id** field (`guiId` in the JSON).

While a conversation is open, the player can't click on the room, and the game can't be saved.

## Tips

- **Always leave a way out.** Every conversation needs an option that ends it ("Ok, bye!"), and it should stay on.
- **Keep the player's lines short.** The option text is both the list item and the spoken line. A long option is hard to read in the list.
- **Turn options on from where the player learns things.** Unlock "What's up with the fountain outside?" when the player has seen it, not in advance.
- **Test from the middle.** A [Play From](./creating-a-room#11-test-it) setup can turn on the options and flags a late conversation needs.

## Checklist

- Each option has a short, clear text, and options the player hasn't earned yet start with **enabled** off.
- Every option that needs a reply has a handler, and one-time questions use `onChooseOnce`.
- There is always an option that calls `dialog.end()`.
- Something starts the dialog: usually a character's `onTalkTo` handler.
- Scripts elsewhere turn on the topics the player unlocks.
