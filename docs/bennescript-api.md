# Bennescript API Reference

> Last updated: 2026-05-09 — generated from source (`src/engine/scripting/*.ts`, `src/engine/sound/*.ts`)

For architecture, dispatch order, persistence keys, and editor workflows, see [architecture.md §7 Scripting / interaction system (Bennescript)](architecture.md#7-scripting--interaction-system-bennescript), [§3 → Audio system](architecture.md#audio-system), [§3 Game state → Bennescript](architecture.md#game-state-v1), [§3 Inventory → Bennescript](architecture.md#inventory-system), [§3 Dialog system → Bennescript](architecture.md#dialog-system-choice-topics), [§7 → GUI runtime (`GuiRuntime`, `B.onGuiBuilt`)](architecture.md#gui-behavior-runtime-guiruntime-bguitbuilt), and the **Blocking interaction queue** / API tables in §7.

---

## How Bennescript works

**Registration** — Scripts register via side-effect imports (no callable `register*Script(events)` loader):

- **`registerRoomScript(({ B, events, roomId, roomScene }) => …)`** — [`registerRoomScript.ts`](../src/engine/scripting/registerRoomScript.ts); runs once per room load.
- **`registerCharacterScript('id', ({ B, … }) => …)`** — only when that character is spawned in the active room.
- **`registerInventoryScript('id', ({ B, … }) => …)`** — runs each room load; engine calls **`B.ensureDefaultInventoryUseAndGiveActivationAfterRegister()`** after the body so **use**/**give** rows arm **active inventory** even with an empty script file.
- **`registerGlobalScript(({ B, game, events }) => …)`** — after **`createBenneGame`** via **`wireBenneGlobalScripts`**.
- **`registerGuiScript('guiId', ({ B, events, guiId }) => …)`** — at content registration; overlay built per room.
- **`registerDialogScript('dialogId', ({ B, events, dialogId, game }) => …)`** — runs when **`openDialogSessionForId`** opens that dialog (after **`B.dialog(id).start()`** / **`.start.now()`**).

**Interaction queue** — Verb / button handlers registered through **`subscribe`** run inside an **`async`** wrapper that **`beginInteraction()`** (resets the tail), runs your **synchronous** body, then **`await endInteraction()`** on an internal **`interactionTail`** chain. Methods that represent time or ordering (walk, **`say`**, **`display`**, **`wait`**, **`B.sound.play`**, **`B.sound.playAndWait`**, **`B.sound.playMusic`**, **`B.sound.stop`**, **`B.sound.stopMusic`**, queued animation setters, **`B.room.changeTo`**, **`B.inventory.add` / `B.inventory.remove`**, etc.) append **lazy** `() => Promise<…>` factories so the *next* step does not start until the previous promise settles. See [architecture.md — Important implementation detail (lazy factories)](architecture.md#7-scripting--interaction-system-bennescript).

**`BlockingWithNow` pattern** — Many APIs are **`(…args) => void`** plus **`.now(…args)`** with the same parameters. The blocking form **queues** on **`interactionTail`**; **`.now`** performs the same work **without** extending the tail, so later lines in your handler still run in source order but do not wait for that action.

**Payload stack for clicked targets** — While a **`subscribe`** / **`subscribeAfterInteractionTail`** handler runs, **`pushVerbWalkContext(payload)`** / **`popVerbWalkContext()`** bracket the run so **`B.walkToClicked`**, **`B.faceClicked`**, and **`B.player.walkToClicked`**, **`B.player.faceClicked`** know the clicked prop/hotspot/character target. Outside that context or without a world target (e.g. pure inventory-row verb), behavior is skipped and DEV may **`console.warn`** once.

**`subscribeImmediate`** — GUI **`B.whenMouseEnter`** / **`B.whenMouseLeave`** use this: handler runs synchronously and does **not** wait on **`interactionTail`** (avoids HUD hover starving behind **`say`/tween** queues).

**Disposal** — **`BenneScript.dispose()`** runs registered cleanups (**`events.off`**, etc.). The engine calls it on **`RoomScene`** shutdown for room/character instances and when a dialog session ends for **`DialogBenneScript`** (see [architecture.md — Runtime wiring](architecture.md#7-scripting--interaction-system-bennescript)).

**`events` field** — Every **`BenneScriptCore`** subclass exposes **`readonly events`** (**`Phaser.Events.EventEmitter`**) backing **`B.raw`**.

---

## Context matrix (what exists on each `B`)

| Surface | Room | Character | Inventory | Global | GUI | Dialog (session) |
|--------|:----:|:---------:|:---------:|:------:|:---:|:----------------:|
| Core queue, **`raw`**, **`wait`**, **`say`**, **`display`**, **`sound`** (**`B.sound`** — same object on **`B.player.sound`**, **`B.character('…').sound`**, **`B.prop('…').sound`** where applicable), **`walkToClicked`**, **`faceClicked`**, fades, **`room`**, active verb/inventory helpers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.state`** / **`B.inventory`** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **`B.dialog(id)`** | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ |
| **`B.player`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.character(id)`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.prop(id)`** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`B.region(id)`** (**`whenEnter`**, **`whenExit`**), **`whenEnterRegion` / `whenExitRegion`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Room **`when*(`target`,`…)` verb sugar**, **`onProp`**, **`whenGive(item,target,…)`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Character self-only **`when*(() => …)`** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inventory row verbs + **`whenUse` / `whenGive`** registrars | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Global verb fallbacks (**`whenGlobalFallback`**, etc.) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **`whenLeaveRoom`**, **`whenEnterRoom`**, **`whenEnterRoomAfterFade`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`whenLeaveAnyRoom`**, **`whenEnterAnyRoom`**, **`whenEnterAnyRoomAfterFade`** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **`whenButtonClick`**, **`onGuiBuilt`**, **`scene`**, hover | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **`whenChoice`** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`cutscene`** / **`cutscene.now`** — see [Cutscene mode](#cutscene-mode) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\*GUI: if game/manager are not ready, **`B.dialog(id)`** returns a **no-op** surface (**`GuiBenneScript`** constructor).

**GUI `B.wait`** — **`GuiBenneScript`** passes **`getClock: () => null`**; **`B.wait(seconds)`** / **`.now`** resolves **immediately** (no timed delay).

---

## Type exports (signatures)

```ts
// BenneScriptCore
type BlockingWithNow<TArgs extends readonly unknown[]> =
  ((...args: TArgs) => void) & { now: (...args: TArgs) => void };

interface BenneScriptSayLineOptions {
  clickToSkip?: boolean;
}

// Tagged multi-speaker dialogue (room/global/char/inventory on B — not DialogBenneScript’s hybrid on player)
type BenneScriptSayDialogueTagged =
  ((strings: TemplateStringsArray, ...exprValues: unknown[]) => void) & {
    readonly now: (strings: TemplateStringsArray, ...exprValues: unknown[]) => void;
  };

// Player / NPC say: overload string | tagged + .now mirrors both
type BenneScriptSayDialogueHybrid = {
  (line: string, options?: BenneScriptSayLineOptions): void;
  (strings: TemplateStringsArray, ...exprValues: unknown[]): void;
  readonly now: {
    (line: string, options?: BenneScriptSayLineOptions): void;
    (strings: TemplateStringsArray, ...exprValues: unknown[]): void;
  };
};
```

**Facing** — **`CharacterFacingLetter`**: `'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR'`.

**Movement target** — **`Point2 | string`**: **`{ x, y }`** in room pixels, or unified string id (**prop → hotspot → character → `room.points[].id`**).

---

## Core `B` namespace (all contexts that extend `BenneScriptCore`)

### Shared selection & room context

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`setActiveVerb`** | `(verbId: string \| null) => void` | Sets runtime active verb (**`GameStateManager`**); empty string treated as clear. Warns DEV if called before game exists. | Sync |
| **`getActiveVerb`** | `() => string \| null` | Current active verb id. | Sync |
| **`clearActiveVerb`** | `() => void` | **`setActiveVerb(null)`**. | Sync |
| **`setActiveInventory`** | `(id: string \| null) => void` | Arms use-on-target item id; **`null`/empty clears**. Warns DEV if no game. | Sync |
| **`getActiveInventoryItemId`** | `() => string \| null` | | Sync |
| **`clearActiveInventory`** | `() => void` | | Sync |
| **`activeVerb`** | getter → `VerbDefinition \| null` | Config row for **`getActiveVerb()`**; **`null`** in walk-mode / idle. From **`verbContext`** types + **`composeVerbLineText`** helpers. | Sync |
| **`activeInventory`** | getter → **`InventoryItemDefinition \| null`** | Full registry row for the armed **use-on-target** item. | Sync |
| **`onVerbContextChanged`** | getter → **`Phaser.Events.EventEmitter`** | Fires when active verb / active inventory / hover changes. **`B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, handler)`** — import **`BENNE_VERB_CONTEXT_CHANGED_EVENT`** from **`@engine/scripting`**. Listeners for that event are cleared when **`RoomScene`** shuts down. | Sync |
| **`currentHoverDescription`** | getter → `string \| null` | Verb-line hover label under the pointer (**`RoomScene`**; **`null`** when suppressed / empty). | Sync |
| **`currentHoverTarget`** | getter → **`VerbHoverTarget \| null`** | Structured hover (**`verbContext`** types). | Sync |
| **`room`** | See [`BenneScriptRoomFacade`](architecture.md) | **`current`**, **`last`**, **`visitCount`**, **`isFirstVisit`**, **`changeTo`**, **`changeTo.now`**, **`changeToNow`**. | **`changeTo`** queued; **`.now` / `changeToNow`** via orchestrator **`changeTo(roomId, true)`** |

**`VerbHoverTarget`** ([`verbContext.ts`](../src/types/verbContext.ts)): **`description`**; **`targetType`** (`prop` \| `hotspot` \| `character` \| `inventoryRow` \| `null`); **`targetId`** (room entity id) when not an inventory row; **`itemId`** when **`targetType === 'inventoryRow'`**; optional **`defaultVerb`** — non-empty authored **`defaultVerb`** from the same JSON row **`resolvePointerVerbForTarget`** uses (omitted when unset or empty).

**`BenneScriptRoomFacade`** (**`bindRoomFacadeForBenneScriptCore`** / [`benneScriptRoomApi.ts`](../src/engine/scripting/benneScriptRoomApi.ts)):

```ts
interface BenneScriptRoomFacade {
  readonly current: string;
  readonly last: string | null;
  readonly visitCount: number;
  readonly isFirstVisit: boolean;
  changeTo: BlockingWithNow<[roomId: string]>;
  changeToNow(roomId: string): void;
}
```

- **`current` / `last`** mirror **`GameStateManager`** (same idea as **`B.state.getCurrentRoom`** / **`getLastRoom`**).
- **`visitCount`** — persisted number of times the player has **entered** the **current** room (**`1`** on the first enter, **`2`** on the next, …). Stored under **`GameStateManager.variables`** as `` `room:<roomId>:visitCount` ``; **`0`** when there is no manager or **`current`** is empty. Incremented by the engine at room load **before** **`whenEnterRoom`** / **`whenEnterAnyRoom`** (and the same counter in the VS Code room preview). Survives **`B.state.exportJson` / `importJson`** and browser saves.
- **`isFirstVisit`** — **`true`** when **`visitCount === 1`** for the current room (convenience for first-time-enter logic).
- **`changeTo`** queues **`RoomTransitionOrchestrator.changeTo(roomId, false)`** through the facade’s **`chain`**.
- **`changeTo.now`** / **`changeToNow`** call **`orch.changeTo(roomId, true)`** (skip leave-queue behavior per orchestrator).

### Movement helpers (clicked target)

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`walkToClicked`** | `BlockingWithNow<[]>` | **`RoomScene.walkPlayerTo`** to payload-derived target (prop/hotspot/character id), then **`RoomScene.facePlayerTowardClicked`** with the same payload snapshot as **`faceClicked`** after the walk completes; no-op + DEV warn when no **`RoomScene`**, outside verb handler, or no world target (e.g. inventory row only). | Queued vs **`.now`** |
| **`faceClicked`** | `BlockingWithNow<[]>` | **`RoomScene.facePlayerTowardClicked`** uses **`lookAtPoint`**, NPC feet, or walk stand point. Same guard rails as **`walkToClicked`**. | Queued vs **`.now`** |

### Screen fade

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`fadeOut`** | `BlockingWithNow<[durationSeconds?: number, color?: number]>` | Full-screen fade to opaque. Defaults: **0.35** s, **`0x000000`**. Requires active **`RoomScene`** (also resolves via **`tryGetActiveBenneGame`** → **`SCENE_ROOM`**). | Queued vs **`.now`** |
| **`fadeIn`** | `BlockingWithNow<[durationSeconds?: number, color?: number]>` | Fade to transparent; same defaults. | Queued vs **`.now`** |

### Dialogue & narration (tagged **`B.say`**)

| Member | Signature | Context | Blocking |
|--------|-----------|---------|----------|
| **`say`** | **`BenneScriptSayDialogueTagged`** | Room, Character, Inventory, Global, Dialog (inherit **`BenneScriptCore`**). Tagged only: **`B.say`**\`…\``. Prefer **`player.say('…')`** / hybrid for scoped player-only lines in dialog scripts. | Queued per line on tail; **`B.say.now`**— single-line block skips tail orchestration for *that* **`say`** run; multi-line **`now`** sequences lines concurrently with the tail (see **`runDialogueFromTaggedTemplate`** in [`BenneScriptCore.ts`](../src/engine/scripting/BenneScriptCore.ts)) |

Rules: **`Speaker: text`** per line; **`Player`** (any case) → starting player character id; other speakers must match spawned character ids **case-insensitively**; blank lines and **`//`** comments skipped; mismatched unknown speaker throws. Requires active **`RoomScene`** for **`B.say`** (DEV warn otherwise).

Example:

```ts
B.say`Player: Hello.
Npc: Hi there.`; // queued in order per line on interaction tail

B.walkToClicked(); // walk + same facing as B.faceClicked() when the walk finishes
B.player.say('Closer look…', { clickToSkip: true });
```

### Narration — **`B.display`**

| Member | Signature | Context | Blocking |
|--------|-----------|---------|----------|
| **`display`** | **`BlockingWithNow<[text: string]>`** | Same **`BenneScriptCore`** surfaces as **`say`** (room / character / inventory / global / GUI / dialog session). Shows the reserved **`display-text`** overlay (`guis/display-text/display-text.gui.json`); **click anywhere** to dismiss (same scripted-dialog input suppression as **`say`** lines — gameplay paused; verb HUD buttons stay live). No auto-hide timer. | Queued vs **`display.now`** |

Requires active **`RoomScene`** (DEV warn otherwise). See **`setDisplayTextOverlay`** / **`GuiOverlayHandle.setDisplayTextLayout`** in [`RoomScene.ts`](../src/engine/scenes/RoomScene.ts) and [`buildGuiOverlay.ts`](../src/engine/gui/buildGuiOverlay.ts).

Example:

```ts
B.display('The ancient door refused to budge.');
B.player.say('Maybe later.');
```

### Timing & raw bus

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`wait`** | `BlockingWithNow<[seconds: number]>` | **`Clock.delayedCall`** delay; **`seconds ≤ 0` → 0 ms**. No clock (GUI façade) ⇒ immediate resolve. **`wait.now`** schedules delay without tail (still needs clock elsewhere). | Queued vs **`.now`** |
| **`raw`** | `{ on, once, off, emit }` | Thin wrapper on **`this.events`**. | Sync |
| **`events`** | `Phaser.Events.EventEmitter` | Same emitter as **`raw`**. | — |

Example:

```ts
B.whenUse('machine', () => {
  B.player.face('U');
  B.wait(0.5);
  B.player.say('Nothing happens.');
});
```

### Sound (`B.sound`)

Available on every **`BenneScriptCore`** facade (**room / character / inventory / global / GUI / dialog session**). The **same** facade object is exposed as **`B.player.sound`**, **`B.character('…').sound`**, and **`B.prop('…').sound`** (room scripts) for readability.

**Assets** — Put files under **`src/game/assets/audio/sfx/<name>.<ext>`** (sound effects) and **`src/game/assets/audio/music/<name>.<ext>`** (music). Supported extensions include **`.wav`**, **`.mp3`**, **`.ogg`**, **`.m4a`**. Reference them by **basename only** (e.g. **`B.sound.play('creak')`** for **`…/audio/sfx/creak.wav`**). Ids must match **`^[a-zA-Z0-9_-]+$`**.

**Volumes** — Playback uses **`getEffectiveSfxVolume`** / **`getEffectiveMusicVolume`** from **`game-config.json`** **`audio`** (master × category). Optional **`volume`** on **`play` / `playAndWait` / `playMusic`** (0–1) is an extra multiplier. **`setSfxVolume` / `setMusicVolume`** apply **session** multipliers on top of config (see [architecture.md §3 → Audio system](architecture.md#audio-system)).

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`play`** | `BlockingWithNow<[key: string, options?: SoundPlayOptions]>` | Start a one-shot SFX. **Blocking** form **queues** on the interaction tail — use this so **`play`** runs **after** **`walkToClicked`**, **`wait`**, etc. **`play.now`** starts immediately without tail ordering. | Queued vs **`.now`** |
| **`playAndWait`** | `BlockingWithNow<[key: string, options?: SoundPlayOptions]>` | Same as **`play`**, but the **blocking** form **waits** until the sound **finishes or is stopped**. **`playAndWait.now`** starts playback without waiting on prior tail steps; it does **not** make following script lines wait for the sound to end. | Queued vs **`.now`** |
| **`playMusic`** | `BlockingWithNow<[key: string, options?: MusicPlayOptions]>` | One **music** slot; a new **`playMusic`** replaces the current track. Default **`loop: true`** for music; SFX default **`loop: false`**. | Queued vs **`.now`** |
| **`stop`** | `BlockingWithNow<[key?: string]>` | **`stop()`** / **`stop.now()`** with **no** argument stops **all** SFX; with a **key**, stops instances of that stem only. | Queued vs **`.now`** |
| **`stopMusic`** | `BlockingWithNow<[]>` | Stops the current music instance. | Queued vs **`.now`** |
| **`setSfxVolume`** | `(volume: number) => void` | Session SFX multiplier (0–1). | Sync |
| **`setMusicVolume`** | `(volume: number) => void` | Session music multiplier (0–1). | Sync |
| **`isPlaying`** | `(key: string) => boolean` | Whether an SFX with that stem is playing. | Sync |
| **`isMusicPlaying`** | `() => boolean` | Whether music is playing. | Sync |

**`SoundPlayOptions` / `MusicPlayOptions`** — optional **`volume?: number`**, **`loop?: boolean`**.

**Editor previews** — VS Code **room / GUI / inventory / character** previews set **`benneAudioScriptDisabled`** so **`B.sound`** does not load or play audio (full runtime and **BENNE Play** behave normally).

Example (SFX after walk, then a line):

```ts
B.walkToClicked();
B.sound.play('sweeping');
B.player.say('I used the Broom on the Table.');
```

Use **`B.sound.playAndWait('sweeping')`** when the **next** queued step should run only **after** the clip ends.

---

## `B.player` (**`BenneScriptPlayerFacade`**)

Constructed from active **`RoomScene`** (global/dialog resolve **`SCENE_ROOM` on each call**). DEV warns once if **`RoomScene`** missing for movement/speech.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`sound`** | **`BenneScriptSoundFacade`** | Alias of top-level **`B.sound`** (same object). | See [Sound (`B.sound`)](#sound-bsound) |
| **`walkTo`** | `BlockingWithNow<[Point2 \| string]>` | Pathfind + walk tween. | Queued vs **`.now`** |
| **`moveTo`** | `BlockingWithNow<[Point2 \| string]>` | Teleport feet (**`movePlayerToNow`**); updates idle facing. | Queued vs **`.now`** |
| **`moveToNow`** | `(target: Point2 \| string) => void` | Alias for **`moveTo.now`**. | Immediate |
| **`walkToClicked`** | `BlockingWithNow<[]>` | Delegates core **`performWalkToClicked`**. | |
| **`faceClicked`** | `BlockingWithNow<[]>` | Delegates **`performFaceClicked`**. | |
| **`animation`** | getter **`string`**; setter **`string \| null`** | Effective clip tag; **`null`** clears persisted override on set. Setter **queued**. | Setter queued |
| **`animationNow`** | `(tag: string \| null) => void` | Immediate override / clear. | Immediate |
| **`playAnimation`** | `BlockingWithNow<[tag: string]>` | One-shot tag; restores idle/override after. | Queued vs **`.now`** |
| **`stopAnimation`** | `() => void` | Clears override + returns to directional idle. | Immediate |
| **`say`** | **`BenneScriptSayDialogueHybrid`** | **`'line'`**, **`say.now('line', opts?)`**, or tagged scoped to player id. **`clickToSkip`** from arg or **`getDialogSettings().clickToSkip`**. | Per hybrid rules |
| **`face`** | `BlockingWithNow<[CharacterFacingLetter]>` | **`facePlayerScriptDirection`**. | Queued vs **`.now`** |

---

## `B.character(id)` (**`BenneScriptCharacterFacade`**)

Defined on **`BenneScriptCore`**: same movement/teleport/play/stop **`say`** / **`face`** pattern as **`B.player`**, routed to **`walkCharacterTo`**, **`moveCharacterToNow`**, **`faceCharacterScriptDirection`**, character animation scripting APIs (**`NPC`** — no **`walkToClicked`** on facade; use top-level **`B.walkToClicked`** / **`B.player.*`**). Exposes **`sound`** (**same object** as **`B.sound`**).

**Room resolution:** Each call uses the same **`getPlayerWalkRoomScene`** hook as **`B.player`** — room / character / inventory scripts pass a stable **`() => this.roomScene`** closure; dialog / global / GUI pass **`() => game.scene.getScene(SCENE_ROOM)`**. Movement / **`face`** / **`fade`** with no room no-op and DEV **`console.warn`** once. **`hide` / `show` / `visible` / `visibleNow`** still persist to **`GameStateManager`** when a manager is active so visibility survives the next room load even if **`RoomScene`** is not resolved yet.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`hide` / `show`** | **`BlockingWithNow<[]>`** | Script visibility overrides (persisted — see [architecture.md §7](architecture.md#7-scripting--interaction-system-bennescript)); queue vs **`.now`**. | Queued vs **`.now`** |
| **`visible`** get/set | Setter queues like **`animation`**; **`visibleNow(v)`** applies immediately. Both persist a boolean to **`GameStateManager`** (key `` `character:<characterId>:visible` ``). **`getCharacterScriptVisible`** returns the live sprite when one exists, else the saved override, then the first room JSON placement default. | Setter queued |
| **`fade`** | `BlockingWithNow<[fromAlpha: number, toAlpha: number, durationSeconds: number]>` | Tween the character sprite's `alpha` from **`fromAlpha`** to **`toAlpha`** over **`durationSeconds`** (`Linear`); alphas clamp to `[0, 1]`, duration to `>= 0` (`0` snaps to **`toAlpha`**). Each call kills running tweens on the sprite first, then sets `alpha = fromAlpha` before tweening. **`toAlpha`** is **persisted** to **`GameStateManager`** (key `` `character:<characterId>:alpha` ``) at call time and re-applied on every spawn (saving mid-fade restores the intended final alpha). Routes through **`RoomScene.fadeCharacterScriptAlpha`**. | Queued (waits for tween) vs **`.now`** |

```ts
B.character('penny').hide(); // persisted; stays hidden after room change / save when Penny is in the room
B.character('penny').fade(0, 1, 0.5); // fade Penny in from transparent to opaque over 0.5 s
B.character('penny').fade.now(1, 0, 1); // start fade-out immediately, don't block following lines
```

---

## `B.prop(propId)` (**`BenneScriptPropFacade`**)

**Room scripts only.**

| Member | Description | Blocking |
|--------|-------------|--------|
| **`sound`** | Same **`BenneScriptSoundFacade`** as **`B.sound`**. | See [Sound (`B.sound`)](#sound-bsound) |
| **`hide` / `show`** | Script visibility overrides (persisted — see below); **`BlockingWithNow<[]>`** (queue vs **`.now`**). | Queued vs **`.now`** |
| **`visible`** get/set | Setter queues like **`animation`**; **`visibleNow(v)`** applies immediately. Both setter and **`hide` / `show`** persist the boolean to **`GameStateManager`** (key `` `room:<roomId>:prop:<propId>:visible` ``); **`getPropScriptVisible`** returns the live sprite when one exists, else the saved override, else JSON. | Setter queued |
| **`description`** get/set | | Sync |
| **`animation`** get/set | Base prop tag persisted; setter **queued**. | Setter queued |
| **`animationNow(tag)`** | Immediate persist + sprite. | Immediate |
| **`playAnimation`** | **`BlockingWithNow<[string]>`** one-shot → restore base tag. | Queued vs **`.now`** |
| **`fade`** | **`BlockingWithNow<[fromAlpha: number, toAlpha: number, durationSeconds: number]>`** — tween the prop sprite's `alpha` from **`fromAlpha`** to **`toAlpha`** over **`durationSeconds`** (`Linear`); alphas clamp to `[0, 1]`, duration to `>= 0` (`0` snaps to **`toAlpha`**). Each call kills running tweens on the sprite first, then sets `alpha = fromAlpha` before tweening. **`toAlpha`** is **persisted** to **`GameStateManager`** (key `` `room:<roomId>:prop:<propId>:alpha` ``) at call time and re-applied on every spawn (saving mid-fade restores the intended final alpha). Routes through **`RoomScene.fadePropScriptAlpha`**. | Queued (waits for tween) vs **`.now`** |
| **`moveTo`** | **`BlockingWithNow<[Point2]>`** — teleport the prop's **authoring** origin (top-left for canvas placement, the authored origin for **`spritePlacement: "tight"`**, or the parallax base for **`parallaxDepth !== 1`**) to **`{ x, y }`** in room space. **No tween**; **no string-id resolution** (props don't have feet / stand-points). Routes through **`RoomScene.movePropToNow`**, which updates whichever placement field actually drives rendering. Position is **not** eagerly persisted on the call — it is captured on the next snapshot flush (room-leave, **`getSnapshot`**, or **`B.state.flush()`**), keyed `` `room:<roomId>:prop:<propId>:position` ``. | Queued vs **`.now`** |
| **`moveToNow(point)`** | Alias for **`moveTo.now(point)`** — immediate teleport, skips the queue. | Immediate |

```ts
B.prop('Knife').fade(1, 0.5, 2); // fade Knife from opaque to 50% over 2 s; persisted alpha = 0.5
B.prop('Knife').fade.now(0.5, 1, 1); // start fade back to opaque without blocking the chain
B.prop('Knife').hide(); // persisted; the prop stays hidden after B.room.changeTo and reload
B.prop('Rock').moveTo.now({ x: 80, y: 90 }); // teleport authoring origin; persisted on next flush
```

**Persistence keys** — see [architecture.md §7 → Sprite animation & persistence](architecture.md#7-scripting--interaction-system-bennescript) for the full reserved key list. Visibility, alpha, and animation overrides all flow through **`GameStateManager.variables`** and survive **`exportJson` / `importJson`** / **`saveToBrowser` / `loadFromBrowser`** like any other **`B.state`** value. **Position** flows the same way but is **lazily** written — it is pulled into **`variables`** by a snapshot flush hook installed in **`RoomScene.create`** that fires automatically on room-leave (**`prepareForLeave`**), inside **`getSnapshot`** (so **`saveToBrowser`** / **`exportJson`** capture it), and on **`B.state.flush()`**.

---

## `B.inventory` (**`BenneScriptInventoryNamespace`**)

**Not on `GuiBenneScript`.** Callable **`B.inventory(itemId)`** returns **`BenneScriptInventoryItemFacade`** (see **[`benneScriptGameStateApi.ts`](../src/engine/scripting/benneScriptGameStateApi.ts)**).

**Quantity API** — **`add`** and **`remove`** are **`BlockingWithNow<[string, number?]>`** (queue on **`interactionTail`** when the namespace is wired with **`chain`**; **`.now`** mutates **`GameStateManager`** immediately). **`has`**, **`quantityOf`**, **`items`**, and **`clearInventory`** stay synchronous.

```ts
B.inventory(id: string): BenneScriptInventoryItemFacade;

interface BenneScriptInventoryNamespace /* + callable */ {
  add: BlockingWithNow<[string, number?]>;
  remove: BlockingWithNow<[string, number?]>;
  has(id: string): boolean;
  quantityOf(id: string): number;
  readonly items: ReadonlyArray<{ id: string; quantity: number }>;
  clearInventory(): void;
}
```

**Per-item facade:**

| Member | Setter / blocking | Immediate |
|--------|-----------------|----------|
| **`add`**, **`remove`** | Queued when namespace wired with **`chain`** | **`add.now(…)`**, **`remove.now(…)`** |
| **`animation`** get/set — effective **`defaultAnimation`** | Queued when namespace wired with **`chain`** (room/character/inventory/global) | **`animationNow(tag)`** |
| **`cursorAnimation`** get/set — armed cursor clip | Same | **`cursorAnimationNow(tag)`** |
| Setter **empty string** | Clears **`GameStateManager`** override for that field (JSON defaults return). |

---

## `B.state` (**`BenneScriptGameStateNamespace`**)

Mirrors **`GameStateManager`** (flags, variables, saves, room context getters/setters). All methods **synchronous**.

```ts
// Flags / variables
setFlag(id, value): void;
getFlag(id): BenneGameStateFlagValue | undefined;
hasFlag(id): boolean;
clearFlag(id): void;
setVariable(id, value: unknown): void;
getVariable(id): unknown;
hasVariable(id): boolean;
clearVariable(id): void;

// Persistence
saveToBrowser(slot?: number): void;
loadFromBrowser(slot?: number): boolean;
clearBrowserSave(slot?: number): void;
exportJson(): string;
importJson(json: string): void;
flush(): void; // pull lazily-saved runtime state (today: positions) into GameStateManager.variables

// Duplicated selection + room shortcuts (same as B.* helpers)
setActiveVerb(verbId: string | null): void;
getActiveVerb(): string | null;
clearActiveVerb(): void;
setActiveInventory(id: string | null): void;
getActiveInventoryItemId(): string | null;
clearActiveInventory(): void;
getCurrentRoom(): string;
getLastRoom(): string | null;
setCurrentRoom(roomId: string): void;
setLastRoom(roomId: string | null): void;
```

**`flush()`** runs every registered **snapshot flush hook** (see [architecture.md §3 → Game state](architecture.md#game-state-v1) and [§7 → Sprite animation & persistence → Snapshot flush hooks](architecture.md#7-scripting--interaction-system-bennescript)). It pulls **lazily-saved** runtime state on the active **`RoomScene`** — today, character feet world positions and prop authoring positions — into **`GameStateManager.variables`** so the next room load (or save snapshot) restores them. **Most state is already eagerly persisted** on every change (visibility, alpha, animation overrides, flags, variables, inventory) — `flush` exists for fields that are too noisy to write per-tick during walks. It also runs **automatically** inside **`getSnapshot`** (so **`saveToBrowser`** / **`exportJson`** already pick everything up) and on room-transition leave (**`RoomTransitionOrchestrator.prepareForLeave`**). Call it directly only at custom save points.

State change events are observable via **`B.raw.on`** (see **`src/types/gameState.ts`** and [architecture.md — EventBus](architecture.md#game-state-v1)).

---

## `B.dialog(dialogId)` (**`BenneScriptDialogCommandSurface`**)

Returned by accessor on Room / Character / Inventory / Global / GUI (**no-op if empty id / game not ready** on GUI). **`DialogBenneScript`** also has **`dialog(id)`** for controlling *other* dialogs while a session runs.

Each command is **`BlockingWithNow`** on the **owning script’s** interaction tail (**`.now`** skips the tail):

```ts
interface BenneScriptDialogCommandSurface {
  start: BlockingWithNow<[]>;
  stop: BlockingWithNow<[]>;
  optionOn: BlockingWithNow<[optionId: string]>;
  optionOff: BlockingWithNow<[optionId: string]>;
}
```

- **`start` / `.start.now`** — opens session via **`openDialogSessionForId`** (external accessor). Self-session **`DialogBenneScript`** uses **`mode: 'self'`** where **`start` is DEV no-op (“open from elsewhere”).
- **`stop`** — ends matching active dialog session.
- **`optionOn` / `optionOff`** — writes **`dialogOptionEnabledVariableKey`** variable and emits **`DIALOG_OPTION_ENABLED_CHANGED_EVENT`**; unknown ids still write with DEV warning.

Related events/variables — [architecture.md — Dialog system](architecture.md#dialog-system-choice-topics).

---

## Room script — `BenneScript` extras

### Verbs (`when*` sugar)

Alias resolution (**`VERB_ALIAS_CANDIDATES`** in **`BenneScriptCore`**): **`look`** ← `look`/`examine`, **`use`** ← `use`/`interact`, **`pickUp`** ← `pickUp`/`pickup`/`take`, **`give`**, **`talkTo`** ← `talkTo`/`talk`/`speak`, **`push`**, **`pull`**, **`open`**, **`close`**. **`whenVerb`** uses the **literal** **`game-config.json`** verb id.

| Method | Signature | Dispatch |
|--------|-----------|----------|
| **`whenLookAt`**, **`whenUse`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`** | `(targetId, handler)` where handler is **`() => void`** **or **`(p: any) => void`** | **`registerVerbForTarget`**: prop id → **`onProp`**; hotspot → **`onHotspot`**; spawned character → **room + character-global** verb events |
| **`whenVerb`** | `(verbId, targetId, handler)` | Exact verb id |
| **`whenGive`** | `(itemId, targetId, handler)` | **Prop-only** **`targetId`**; maps payload with **`GivePropInteractPayload`** shape **`{ …RoomPropInteractPayload, itemId }`** |
| **`whenInventoryUsedOn`** | **`RoomInventoryUsedOnRegistrar`** — `(targetId, handler, opts?)`, **`whenInventoryUsedOn.doNotClear(targetId, handler)`** — payload handler may **`return false`** to delegate to **`whenInventoryOnVerbTargetUnhandled`** (same bus) | Target-wide channels (room / character / inventory row); **`subscribeAfterInteractionTail`** + **`shouldDropActiveInventoryOnUse`** unless **`return false`** delegated (**`doNotClear`** opts out) |
| **`onProp`** | `(propId, verbId, handler)` | **`RoomPropInteractPayload`** or **`()`** |

### Room transitions (per-room)

```ts
whenLeaveRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
whenEnterRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
whenEnterRoomAfterFade(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
```

**`RoomTransitionContext`** (`src/types/roomTransition.ts`):

```ts
interface RoomTransitionContext {
  roomId: string;
  lastRoom: string | null;
  /** First enter to this roomId in the current browser session (in-memory). */
  isFirstEnter: boolean;
  /** Persisted cumulative enter count for roomId (includes this entry on enter / after-fade). */
  visitCount: number;
}
```

**`isFirstEnter`** vs **`visitCount` / `B.room.isFirstVisit`** — session-scoped **first enter** vs save-backed **visit counter** (see [architecture.md — Room transitions](architecture.md) callout).

Registry from **`tryGetGlobalRoomHookRegistry()`** — if missing, DEV warns and handlers are **not** wired.

### Room regions — enter / exit

```ts
B.region('stage-front').whenEnter((ctx) => {
  if (ctx.isPlayer) {
    B.player.say('Stepping into the light.');
  }
});

B.whenExitRegion('stage-front', (ctx) => {
  // same as B.region('stage-front').whenExit(…)
});
```

- **`B.region(regionId)`** returns **`{ active, whenEnter, whenExit }`**. **`whenEnterRegion(regionId, handler)`** / **`whenExitRegion`** are optional flat sugar.
- **`regionId`** must match **`regions[].id`** in this room’s **`*.room.json`**. Empty / whitespace-only ids: DEV warns, registrations are no-ops.

**`active` get/set** — reads and writes the active state of the region immediately (not queued on the interaction tail). Persisted to **`GameStateManager`** (key `` `room:<roomId>:region:<regionId>:active` ``), so it survives room changes and save/load. Re-applied to the live `roomData.regions` entry at room load. Deactivating a region prevents it from matching any character’s feet (no enter/exit events, no perspective scale, no character tint from that region). The JSON `active: false` field is the authoring default; the script override is layered on top.

```ts
B.region('darkness').active = false;   // immediately deactivate; persisted

if (B.region('leave').active) {
  // only runs when the region is currently active
}
```

- Handlers use **`subscribe`** (same interaction queue as **`whenLookAt`** — queued **`walkTo`**, **`say`**, etc., run to completion before the tail resolves). They are **not** automatically wrapped in **`B.cutscene`** (contrast **`whenEnterRoom` / `whenEnterRoomAfterFade`** in the orchestrator); wrap the body in **`B.cutscene(() => { … })`** when you need full pointer suppression for a beat.
- **`RegionEnterExitContext`** (`src/types/regionEnterExit.ts`): **`roomId`**, **`regionId`**, **`characterId`** (**`CharacterData.id`**), **`isPlayer`** (**`true`** when **`characterId`** equals **`game-config.json`** **`startingPlayerCharacter`**), **`feetX`**, **`feetY`** (room pixels at detection).
- The engine tracks the **winning** region at feet each frame (**last** overlapping active polygon with ≥3 points — same rule as perspective **`computeRoomRegionPerspective`**). The **first** frame after **`RoomScene`** load only seeds internal state (no **`whenEnter`** if the character already spawns inside the polygon). Crossing from region A to B fires **`whenExit`** on **A** then **`whenEnter`** on **B**.
- **Character tint** (data-only): optional **`tint`** (`#rrggbb`) and **`tintAlpha`** (0–1) on a region in **`*.room.json`** multiply-tint character sprites while their feet are in that **winning** region (Phaser **`setTint`** / **`clearTint`** via **`applyCharacterSpriteRegionTintFromWinningRegion`**); see **`RoomRegionData`** in **`src/types/room.ts`** and **`packedTintFromWinningRegion`** / **`applyCharacterSpriteRegionTintFromWinningRegion`** in **`src/engine/room/regionCharacterScale.ts`**. There is no separate Bennescript API — clear the **Character tint** field in the Inspector (or omit both keys in JSON) to disable.

Advanced: stable event strings **`roomRegionEnterEventId(roomId, regionId)`** / **`roomRegionExitEventId`** in **`src/engine/events/regionEnterExitEvents.ts`** for **`B.raw.on`** tooling.

---

## Character script — `CharacterBenneScript` extras

Self-only verbs — **`characterVerbEventId(characterId, verbId)`** only (**room handlers still preferred by dispatch when both exist**):

| Method | Handler payload |
|--------|----------------|
| **`whenLookAt`**, **`whenUse`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`** | **`() => void`** or **`(p: CharacterVerbInteractPayload) => void`** |
| **`whenVerb(verbId, handler)`** | Same |

**`whenInventoryUsedOn`** — **`targetId` must equal `characterId`**; otherwise handler not registered (DEV warns once). Payload handlers may **`return false`** so **`whenInventoryOnVerbTargetUnhandled`** runs (see room **`whenInventoryUsedOn`**).

---

## Inventory script — `InventoryBenneScript` extras

Row verbs (room-scoped **`roomInventoryVerbEventId`** + global **`inventoryVerbEventId`**):

| **`when*`** | Payload |
|-------------|---------|
| **`whenLookAt`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`**, **`whenVerb`** | **`InventoryVerbInteractPayload`** or **`()`** |

**`whenUse`** / **`whenGive`** (**`InventoryWhenUseRegistrar`** / **`InventoryWhenGiveRegistrar`**):

```ts
B.whenUse(handler);
B.whenUse.doNotActivate(handler); // omit arming after this verb if ALL handlers use doNotActivate
B.whenGive(handler);
B.whenGive.doNotActivate(handler);
```

Engine always wires **use/give** → **`subscribeAfterInteractionTail`** so **`setActiveInventory(this.itemId)`** runs **after** handlers unless **every** handler for that verb used **`doNotActivate`**.

**`whenInventoryUsedOn`** — **`targetId` must equal this item id** (inventory combine row target). Payload handler may **`return false`** for global **`whenInventoryOnVerbTargetUnhandled`** (same as room script).

---

## Global script — `GlobalBenneScript` extras

```ts
whenGlobalFallback(
  handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
): void;

whenVerbUnhandled(
  handler: ((payload: VerbUnhandledPayload) => void) | (() => void),
): void;

whenGlobalVerb(
  verbId: string,
  handler: ((payload: VerbGlobalFallbackPayload) => void) | (() => void),
): void;

whenInventoryOnVerbTargetUnhandled(
  handler: ((payload: AnyInventoryUsedOnPayload) => void) | (() => void),
): void;

whenLeaveAnyRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
whenEnterAnyRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
whenEnterAnyRoomAfterFade(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
```

All use **`subscribe`** (queued interaction semantics) except as noted elsewhere. **`B.player`** / **`walkToClicked`** resolve room scene from **`game.scene.getScene(SCENE_ROOM)`**.

**No **`B.prop`** or **`when*`** room sugar on global.** **`B.character`** exists (inherited from **`BenneScriptCore`**) but only affects the world when an active **`RoomScene`** is resolved — same as **`B.player`**.

Payload types live in **`src/engine/events/verbInteractionEvents.ts`** and **`inventoryOnVerbEvents.ts`**.

---

## GUI script — `GuiBenneScript` extras

```ts
get scene(): Phaser.Scene;
onGuiBuilt(callback: (gui: GuiRuntime) => void): void;
queueInteraction(factory: () => Promise<unknown>): void;

gui(overlayGuiId: string): BenneScriptGuiOverlayRef;

whenButtonClick(buttonId: string, handler: () => void): void;
whenAnyButtonClick(handler: (buttonId: string) => void): void;

whenMouseEnter(controlId: string, handler: () => void): void;
whenMouseLeave(controlId: string, handler: () => void): void;

notifyGuiBuilt(gui: GuiRuntime): void; // engine-use; runs onGuiBuilt registrations
```

```ts
// Re-exported from @engine/scripting (see benneScriptFacades.ts / GuiRuntime.ts)
interface BenneScriptGuiOverlayRef {
  control(controlId: string): ControlFacade;
}
```

- **`get scene`** — throws unless called synchronously inside an **`onGuiBuilt`** invocation (during **`notifyGuiBuilt`**); prefer **`gui.scene`** argument.
- **`B.gui('otherOverlayId')`** — resolves controls on **any** overlay that has a **`*.gui.ts`** (the engine registers **`GuiRuntime`** on **`RoomScene`** before **`onGuiBuilt`** runs). **`control`** always returns a facade: the real control, or a safe inert one when the **`id`** is missing/blank, the overlay/runtime is absent, or the control is unknown ( **`text`** assigns are no-ops on the inert facade). On real **`text`** controls, **`ControlFacade.text`** maps to **`BitmapText`** / **`Text`**.
- **Verb HUD** — combine **`B.activeVerb`**, **`B.activeInventory`**, **`B.currentHoverDescription`** (or **`composeVerbLineText`** in code); in **`onGuiBuilt`**, call **`B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, refresh)`** (see **[`verbs.gui.ts`](../src/game/guis/verbs/verbs.gui.ts)**). Subscriptions reset when the room scene shuts down.
- Hover handlers use **`subscribeImmediate`** (**no interaction-tail wait**).
- Button clicks use **`subscribe`** (queued with other **`B`** work on **this GUI’s** script instance).

[`GuiRuntime` / **`ControlFacade`**](architecture.md) — **`tweenTo`** / **`tweenTo.now`** participate in **`queueInteraction`**.

**`ControlFacade.setVisualState(state)`** — **`button`** controls only. **`state`** is **`'normal'`** \| **`'hover'`** \| **`'pressed'`** \| **`'disabled'`** (case-insensitive strings accepted). Applies the same Aseprite frame tags (**`states.*`** in **`*.gui.json`**) and label **`textColorStates`** tints the pointer pipeline would (**`'disabled'`** also dims chrome to **`0.45`** alpha like authoring **`enabled: false`**). **`'normal'`** restores full alpha and **releases** manual control so hover / pressed tracking works again; the other modes **suppress** pointer-driven chrome until the next **`'normal'`** call.

---

## Dialog session script — `DialogBenneScript` extras

Owned fields: **`readonly dialogId`**, **`readonly dialogGuiId`**, **`readonly game`**.

**Session dialog commands (`start`, `stop`, `optionOn`, `optionOff`)** — Self-mode **`start`** enqueues a DEV no-op and warns if **`B.start()`** is called from **`registerDialogScript`**; open this dialog from **`B.dialog('…').start()`** in another script. **`B.dialog(id)`** on the session instance forwards to **`createBenneScriptDialogAccessor`** (**`BlockingWithNow`**, same interaction tail).

```ts
whenChoice(
  optionId: string,
  handler: (() => void) | ((payload: { optionId: string }) => void),
): void;
```

Wired to **`guiButtonClickEventId(dialogGuiId, dialogChoiceSyntheticButtonId(optionId))`**. **`RoomScene.suppressDialogChoiceGuiForWhenChoice`** hides the choice GUI during handler execution + **`interactionTail`** drain; restored after (**`restoreDialogChoiceGuiAfterWhenChoiceDrain`**).

Tagged **`B.say`** and the rest of **`BenneScriptCore`** (**`wait`**, **`fadeOut`**, **`room`**, **`raw`**, **`B.character(id)`** …) apply as usual. **`DialogBenneScript`** adds **`state`** and **`inventory`**; **`cutscene`** / **`cutscene.now`** are inherited from **`BenneScriptCore`** like all other surfaces.

---

## Verb / `when*` quick reference tables

### Room (**`BenneScript`**)

| Method | Verb / notes |
|--------|----------------|
| **`whenLookAt(target, …)`** | Resolved **`look`** verb id |
| **`whenUse`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`** | Aliased verbs |
| **`whenVerb(id, target, …)`** | Explicit id |
| **`whenGive(itemId, targetPropId, …)`** | **Give** on **that prop** ; payload includes **`itemId`** |
| **`B.region(id).whenEnter` / `whenExit`**, **`whenEnterRegion` / `whenExitRegion`** | **`RegionEnterExitContext`** (not verb dispatch) |

### Character (**`CharacterBenneScript`**)

| Method |
|--------|
| **`whenLookAt`**, **`whenUse`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`**, **`whenVerb`** — **no **`target`** parameter |

### Inventory row (**`InventoryBenneScript`**)

| **`when*`** | Notes |
|-------------|-------|
| **`whenLookAt`**, **`whenPickUp`**, **`whenPush`**, **`whenPull`**, **`whenOpen`**, **`whenClose`**, **`whenTalkTo`**, **`whenVerb`** | Standard row verbs |
| **`whenUse`** / **`whenGive`** | Registrars + **`doNotActivate`** variant |

Character scripts omit **`whenGive`** (**give targets props in room layer**).

---

## Cutscene mode

Enter-room handlers (`whenEnterRoom`, `whenEnterRoomAfterFade`, and their `Any` variants) and `whenChoice` handlers are **automatically** wrapped in a cutscene block. Region **`whenEnter` / `whenExit`** handlers are **not** — use **`B.cutscene`** inside them when you need the same suppression. For other sequences, use `B.cutscene(callback)` (or `.now`), available on every Bennescript surface:

```ts
B.cutscene(() => {
  B.player.walkTo('gate');
  B.player.say('Here we go.');
  B.wait(0.5);
  B.character('guard').say('Stop right there!');
});
```

- **Blocking form** — waits for prior queued steps, pushes the cutscene flag, runs the callback (queueing further `B.*` steps), then pops after those steps complete.
- **`.now` form** — pushes immediately, runs the callback, pops after the callback's steps complete.

While active, all pointer input is suppressed (props, hotspots, characters, GUI buttons, inventory rows, background walks, hover descriptions). Click-to-skip scripted `say` lines remain live. `B.state.isCutsceneActive` exposes the flag for GUI and global scripts.

For the full reference — automatic activation table, suppressed-input matrix, walk promise contract, `busyAnimation` cursor config, and implementation modules — see [architecture.md §7 → Cutscene mode](architecture.md#cutscene-mode).

---

## Common patterns

**Cutscene-style ordering** — Use the automatic wrapping from `whenEnterRoomAfterFade` / `whenChoice`, or wrap explicit sequences with `B.cutscene(…)`. Use blocking **`walkTo`**, **`wait`**, **`player.say`**, **`fadeOut`** / **`fadeIn`** inside; reserve **`.now`** for overlapping effects you intentionally do not wait for.

**Use-on-target** — Player arms item via **`B.inventory('key').*`** verb row (**use**/ **give**) or **`B.setActiveInventory`**. Room: **`B.whenInventoryUsedOn('door', ({ itemId }) => { … })`**. Use **`return false`** when no branch handles the combo so **`globalScript.ts`**’s **`whenInventoryOnVerbTargetUnhandled`** runs (no duplicated fallback line). Clearing: **`doNotClear`** / **`shouldDropActiveInventoryOnUse`** on the handler that actually concludes the click (after delegation, that is the global unhandled listener — see [`dispatchInventoryOnVerbTarget`](../src/engine/verbs/dispatchInventoryOnVerbTarget.ts) and [architecture.md — Drop policy](architecture.md#inventory-system)).

**GUI verb bar → world** — From **`whenButtonClick`**, call **`B.setActiveVerb('open')`** (or any configured id).

**Dialogs from gameplay** — **`B.dialog('shopTopics').start()`**; options toggled via **`optionOn`** / **`optionOff`**; per-line reactions in **`registerDialogScript`** via **`whenChoice`**.

---

## Payload pointers (typed imports)

Strict typing when bypassing **`(p: any)`**:

- Props / hotspots / characters: **`RoomPropInteractPayload`**, **`RoomHotspotInteractPayload`**, **`CharacterVerbInteractPayload`** (`propInteractionEvents.ts`).
- Inventory row: **`InventoryVerbInteractPayload`** (`inventoryVerbEvents.ts`).
- Use-on-target: **`AnyInventoryUsedOnPayload`** (`inventoryOnVerbEvents.ts`).
- Global fallbacks: **`VerbGlobalFallbackPayload`**, **`VerbUnhandledPayload`** (`verbInteractionEvents.ts`).
- Room hooks: **`RoomTransitionContext`** (`types/roomTransition.ts`).
- Region enter/exit: **`RegionEnterExitContext`** (`types/regionEnterExit.ts`).
- Give-on-prop augmentation: **`GivePropInteractPayload`** (`benneScriptPayloads.ts`).

---

## Source files

| Module | Role |
|--------|------|
| [`BenneScriptCore.ts`](../src/engine/scripting/BenneScriptCore.ts) | **`BlockingWithNow`**, queue, **`say`/`wait`/fades/clicks/active selection**, **`sound`**, **`events`/`raw`**, inventory-on-target **`subscribe*`** helpers, **`cutscene`** / **`cutscene.now`** |
| [`benneScriptSoundApi.ts`](../src/engine/scripting/benneScriptSoundApi.ts) | **`createBenneScriptSoundFacade`** (**`B.sound`**) |
| [`SoundManager.ts`](../src/engine/sound/SoundManager.ts) | **`Phaser.Game#sound`** playback, SFX tracking, music slot, lifecycle |
| [`BenneScript.ts`](../src/engine/scripting/BenneScript.ts) | Room **`B`**, verb sugar, **`prop`/`character`/`player`/`region`**, **`state`/`inventory`/`dialog`** |
| [`CharacterBenneScript.ts`](../src/engine/scripting/CharacterBenneScript.ts) | Character facade |
| [`InventoryBenneScript.ts`](../src/engine/scripting/InventoryBenneScript.ts) | Inventory row façade |
| [`GlobalBenneScript.ts`](../src/engine/scripting/GlobalBenneScript.ts) | Global fallbacks + any-room hooks |
| [`GuiBenneScript.ts`](../src/engine/scripting/GuiBenneScript.ts) | GUI buttons, **`onGuiBuilt`**, hover (**`subscribeImmediate`**), null clock |
| [`DialogBenneScript.ts`](../src/engine/scripting/DialogBenneScript.ts) | Dialog session **`B`**, **`whenChoice`**, **`openDialogSessionForId`** |
| [`benneScriptFacades.ts`](../src/engine/scripting/benneScriptFacades.ts) | **`BenneScript*Facade`** interfaces |
| [`benneScriptGameStateApi.ts`](../src/engine/scripting/benneScriptGameStateApi.ts) | **`B.state`**, **`B.inventory`** factories |
| [`benneScriptRoomApi.ts`](../src/engine/scripting/benneScriptRoomApi.ts) | **`B.room`** |
| [`snapshotFlushHooks.ts`](../src/engine/gameState/snapshotFlushHooks.ts) | **`registerSnapshotFlushHook`** / **`runSnapshotFlushHooks`** (powers **`B.state.flush`**, run inside **`getSnapshot`** and **`prepareForLeave`**) |
| [`benneAnimationRuntime.ts`](../src/engine/benneAnimationRuntime.ts) | Variable-key + read/write helpers for prop/character animation, visibility, alpha, **and position** |
| [`types.ts`](../src/engine/scripting/types.ts) | **`RoomScriptContext`**, **`CharacterScriptContext`**, etc. |
