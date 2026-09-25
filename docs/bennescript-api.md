# Bennescript API Reference

> Last updated: 2026-09-25 — generated from source (`src/engine/scripting/*.ts`, `src/engine/sound/*.ts`)

For architecture, dispatch order, persistence keys, and editor workflows, see [architecture.md §7 Scripting / interaction system (Bennescript)](architecture.md#7-scripting--interaction-system-bennescript), [§7 → Generated game ID types](architecture.md#generated-game-id-types-bennescript-intellisense), [§3 → Audio system](architecture.md#audio-system), [§3 Game state → Bennescript](architecture.md#game-state-v1), [§3 Inventory → Bennescript](architecture.md#inventory-system), [§3 Dialog system → Bennescript](architecture.md#dialog-system-choice-topics), [§7 → GUI runtime (`GuiRuntime`, `B.onGuiBuilt`, `B.onGuiShow`, `B.onGuiHide`)](architecture.md#gui-behavior-runtime-guiruntime-bguitbuilt-bonguishow-bonguihide), and the **Blocking interaction queue** / API tables in §7.

---

## Generated game ID types

String parameters for **content ids** in registration and facade calls use types from [`src/types/generated/benne-game-ids.d.ts`](../src/types/generated/benne-game-ids.d.ts) (regenerate with **`npm run generate:game-ids`**). Examples:

| API | Type |
|-----|------|
| `registerCharacterScript('…')`, `B.character('…')` | `CharacterId` |
| `B.prop('…')`, `whenGive(item, '…')` prop target | `PropId` |
| `B.hotspot('…')`, `B.region('…')`, `B.walkable('…')` | `HotspotId`, `RegionId`, `WalkableId` |
| `whenLookAt('…')`, `whenVerb(verb, '…')` target | `VerbTargetId` |
| `B.player.walkTo('…')`, `moveTo('…')` | `ResolvableTargetId` |
| `B.room.changeTo('…')`, `B.state.setCurrentRoom('…')` | `RoomId` |
| `B.dialog('…')`, `registerDialogScript('…')` | `DialogId` |
| `whenChoice('…')`, `B.dialog('…').optionOn('…')` | `DialogOptionId` |
| `B.gui('…')`, `registerGuiScript('…')` | `GuiId` |
| `B.inventory('…')`, `registerInventoryScript('…')` | `InventoryItemId` |
| `whenVerb('…', …)`, `B.setActiveVerb('…')` | `GameVerbId` |

Each union is **`LooseString<…>`** — known literals from your game appear in IntelliSense; dynamic strings still compile. See [architecture.md — Generated game ID types](architecture.md#generated-game-id-types-bennescript-intellisense) for scan rules and maintenance.

---

## How Bennescript works

**Registration** — Scripts register via side-effect imports (no callable `register*Script(events)` loader):

- **`registerRoomScript(({ B, events, roomId, roomScene }) => …)`** — [`registerRoomScript.ts`](../src/engine/scripting/registerRoomScript.ts); runs once per room load.
- **`registerCharacterScript('id', ({ B, … }) => …)`** — only when that character is spawned in the active room.
- **`registerInventoryScript('id', ({ B, … }) => …)`** — runs each room load; engine calls **`B.ensureDefaultInventoryUseAndGiveActivationAfterRegister()`** after the body so **use**/**give** rows arm **active inventory** even with an empty script file.
- **`registerGlobalScript(({ B, game, events }) => …)`** — after **`createBenneGame`** via **`wireBenneGlobalScripts`**.
- **`registerGuiScript('guiId', ({ B, events, guiId }) => …)`** — at content registration; overlay built per room.
- **`registerDialogScript('dialogId', ({ B, events, dialogId, game }) => …)`** — runs when **`openDialogSessionForId`** opens that dialog (after **`B.dialog(id).start()`** / **`.start.now()`**).

**Interaction queue** — Verb / button handlers registered through **`subscribe`** run inside an **`async`** wrapper that **`beginInteraction()`** (resets the tail), runs your **synchronous** body, then **`await endInteraction()`** on an internal **`interactionTail`** chain. Methods that represent time or ordering (walk, **`say`**, **`display`**, **`wait`**, **`B.sound.play`**, **`B.sound.playAndWait`**, **`B.sound.playMusic`**, **`B.sound.stop`**, **`B.sound.stopMusic`**, **`B.video.play`**, **`B.video.playAndWait`**, **`B.camera.focus`**, **`B.camera.setZoom`**, **`B.camera.reset`**, etc., queued animation setters, **`B.room.changeTo`**, **`B.inventory.add` / `B.inventory.remove`**, etc.) append **lazy** `() => Promise<…>` factories so the *next* step does not start until the previous promise settles. **`B.gui('id').show()` / `hide()`** on **GUI** scripts, and **`B.camera.shake`**, are immediate (not queued on the interaction tail). On **room** scripts, **`B.gui('id').show()` / `hide()`** queue on that room’s tail ( **`.now`** is immediate). See [architecture.md — Important implementation detail (lazy factories)](architecture.md#7-scripting--interaction-system-bennescript).

**`BlockingWithNow` pattern** — Many APIs are **`(…args) => void`** plus **`.now(…args)`** with the same parameters. The blocking form **queues** on **`interactionTail`**; **`.now`** performs the same work **without** extending the tail, so later lines in your handler still run in source order but do not wait for that action.

**Payload stack for clicked targets** — While a **`subscribe`** / **`subscribeAfterInteractionTail`** handler runs, **`pushVerbWalkContext(payload)`** / **`popVerbWalkContext()`** bracket the run so **`B.walkToClicked`**, **`B.faceClicked`**, and **`B.player.walkToClicked`**, **`B.player.faceClicked`** know the clicked prop/hotspot/character target. Outside that context or without a world target (e.g. pure inventory-row verb), behavior is skipped and DEV may **`console.warn`** once.

**`subscribeImmediate`** — GUI **`B.whenMouseEnter`** / **`B.whenMouseLeave`** use this: handler runs synchronously and does **not** wait on **`interactionTail`** (avoids HUD hover starving behind **`say`/tween** queues).

**Disposal** — **`BenneScript.dispose()`** runs registered cleanups (**`events.off`**, **`B.onUpdate`** unregister, etc.). The engine calls it on **`RoomScene`** shutdown for room/character instances and when a dialog session ends for **`DialogBenneScript`** (see [architecture.md — Runtime wiring](architecture.md#7-scripting--interaction-system-bennescript)). Global **`B.onUpdate`** handlers are cleared when the **`Phaser.Game`** fires **`Phaser.Core.Events.DESTROY`** (see **`wireBenneGlobalScripts`**).

**`events` field** — Every **`BenneScriptCore`** subclass exposes **`readonly events`** (**`Phaser.Events.EventEmitter`**) backing **`B.raw`**.

---

## Context matrix (what exists on each `B`)

| Surface | Room | Character | Inventory | Global | GUI | Dialog (session) |
|--------|:----:|:---------:|:---------:|:------:|:---:|:----------------:|
| Core queue, **`raw`**, **`wait`**, **`say`**, **`display`**, **`sound`** (**`B.sound`** — same object on **`B.player.sound`**, **`B.character('…').sound`**, **`B.prop('…').sound`** where applicable), **`video`** (**`B.video`** — same object on the same nested facades), **`camera`** (**`B.camera`**), **`speechSettings`**, **`dialogSettings`**, **`onSpeechSettingsChanged`**, **`walkToClicked`**, **`faceClicked`**, fades, **`room`**, active verb/inventory helpers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.state`** / **`B.inventory`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.dialog(id)`** | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ |
| **`B.player`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.character(id)`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.prop(id)`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`B.region(id).active`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`B.region(id).whenEnter` / `whenExit`**, **`whenEnterRegion` / `whenExitRegion`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`B.walkable(id).active`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`B.hotspot(id).active`** / **`.clickable`** / **`.description`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`B.onUpdate`** (per-frame, **not** on **`interactionTail`**) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Room **`when*(`target`,`…)` verb sugar**, **`onProp`**, **`whenGive(item,target,…)`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Character self-only **`when*(() => …)`** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inventory row verbs + **`whenUse` / `whenGive`** registrars | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Global verb fallbacks (**`whenGlobalFallback`**, etc.) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **`whenLeaveRoom`**, **`whenLoadedRoom`**, **`whenEnterRoom`**, **`whenEnterRoomAfterFade`** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`whenLeaveAnyRoom`**, **`whenLoadedAnyRoom`**, **`whenEnterAnyRoom`**, **`whenEnterAnyRoomAfterFade`** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **`B.gui('…').show` / `hide` / `control`** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **`whenButtonClick`**, **`whenCheckboxCheck`**, **`whenCheckboxUncheck`**, **`onGuiBuilt`**, **`onGuiShow`**, **`onGuiHide`**, **`scene`**, hover | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
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
| **`walkToClicked`** | `BlockingWithNow<[]>` | **`RoomScene.walkPlayerTo`** to payload-derived target (prop/hotspot/character id), then **`RoomScene.facePlayerTowardClicked`** with the same payload snapshot as **`faceClicked`** after the walk completes; no-op + DEV warn when no **`RoomScene`**, outside verb handler, or no world target (e.g. inventory row only). Also a **no-op** when **`B.player.movable`** is **`false`** (no walk tween; facing still runs after the skipped walk). | Queued vs **`.now`** |
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

Rules: **`Speaker: text`** per line; **`Player`** (any case) → active player character id; other speakers must match spawned character ids **case-insensitively**; blank lines and **`//`** comments skipped; mismatched unknown speaker throws. Requires active **`RoomScene`** for **`B.say`** (DEV warn otherwise).

**Voice markers** — A say line may start with **`|number|`** to play a matching voice clip while the line is shown. The marker is stripped before display/logging. Voice files live under **`src/game/assets/audio/voice/`** and are named **`<characterId><number>.<ext>`**; for example, **`B.character('hank').say('|17| Hello.')`** resolves **`hank17.mp3`** / **`.ogg`** / **`.wav`** / **`.m4a`**. **`B.player.say('|42| …')`** uses the active player id, and tagged lines use the resolved speaker before the colon. Voice playback uses **`audio.dialogueVolume`**, keeps Speaking Text visible for the voice-driven duration (clamped by speech min/max settings), and click-to-skip stops both the overlay and voice.

Example:

```ts
B.say`Player: Hello.
Npc: Hi there.`; // queued in order per line on interaction tail

B.walkToClicked(); // walk + same facing as B.faceClicked() when the walk finishes
B.player.say('Closer look…', { clickToSkip: true });
B.character('hank').say('|17| This case just got a lot more complicated.');
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

**Assets** — Put files under **`src/game/assets/audio/sfx/<name>.<ext>`** (sound effects), **`src/game/assets/audio/music/<name>.<ext>`** (music), and **`src/game/assets/audio/voice/<characterId><number>.<ext>`** (voice clips for **`say`** markers). Supported extensions include **`.wav`**, **`.mp3`**, **`.ogg`**, **`.m4a`**. SFX/music APIs reference stems by **basename only** (e.g. **`B.sound.play('creak')`** for **`…/audio/sfx/creak.wav`**). Voice stems are resolved automatically from the speaker id and leading **`|number|`** marker. Ids must match **`^[a-zA-Z0-9_-]+$`**.

**Volumes** — Playback uses **`getEffectiveSfxVolume`** / **`getEffectiveMusicVolume`** from **`game-config.json`** **`audio`** (master × category); voice clips use **`audio.masterVolume * audio.dialogueVolume`**. Optional **`volume`** on **`play` / `playAndWait` / `playMusic`** (0–1) is an extra multiplier. **`setSfxVolume` / `setMusicVolume`** apply **session** multipliers on top of config and **persist** to **`GameStateManager`** variables **`settings:sfxVolume`** / **`settings:musicVolume`** (included in save snapshots). **`getSfxVolume` / `getMusicVolume`** read the live session multiplier (for GUI sliders, use `× 100` when driving **`slider`** controls). When a variable is unset, defaults come from **`game-config.json`** **`audio.sfxVolume`** / **`audio.musicVolume`**. Loading a snapshot re-applies persisted values to **`SoundManager`**; applying a snapshot that **omits** those keys keeps the previous in-memory values unless **`initialGameState.variables`** seeds them (see [architecture.md §3 → Audio system](architecture.md#audio-system)).

**Music track (save/load)** — **`B.sound.playMusic`** / **`stopMusic`** eagerly persist the current stem to **`settings:currentMusicId`** (cleared when music stops). Save snapshots include that variable; **`B.state.load`** restores the saved track via the engine (**instant** replace), not via **`whenEnterRoom`** hooks (which are skipped on load). Playback **position** is not saved. Legacy snapshots without **`settings:currentMusicId`** leave whatever music was already playing until the player saves again.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`play`** | `BlockingWithNow<[key: string, options?: SoundPlayOptions]>` | Start a one-shot SFX. **Blocking** form **queues** on the interaction tail — use this so **`play`** runs **after** **`walkToClicked`**, **`wait`**, etc. **`play.now`** starts immediately without tail ordering. | Queued vs **`.now`** |
| **`playAndWait`** | `BlockingWithNow<[key: string, options?: SoundPlayOptions]>` | Same as **`play`**, but the **blocking** form **waits** until the sound **finishes or is stopped**. **`playAndWait.now`** starts playback without waiting on prior tail steps; it does **not** make following script lines wait for the sound to end. | Queued vs **`.now`** |
| **`playMusic`** | `BlockingWithNow<[key: string, options?: MusicPlayOptions]>` | One **music** slot; a new **`playMusic`** replaces the current track (instant by default). With **`fadeSeconds` > 0**, volumes crossfade and the **blocking** form waits for that duration. **`sync: true`** (with a fade) seeks the new clip to the outgoing playback position when supported. Default **`loop: true`** for music; SFX default **`loop: false`**. Updates **`settings:currentMusicId`** in save snapshots. | Queued vs **`.now`** |
| **`stop`** | `BlockingWithNow<[key?: string]>` | **`stop()`** / **`stop.now()`** with **no** argument stops **all** SFX; with a **key**, stops instances of that stem only. | Queued vs **`.now`** |
| **`stopMusic`** | `BlockingWithNow<[]>` | Stops the current music instance; clears **`settings:currentMusicId`**. | Queued vs **`.now`** |
| **`setSfxVolume`** | `(volume: number) => void` | Session SFX multiplier (0–1); persisted to **`settings:sfxVolume`**. | Sync |
| **`setMusicVolume`** | `(volume: number) => void` | Session music multiplier (0–1); persisted to **`settings:musicVolume`**. | Sync |
| **`getSfxVolume`** | `() => number` | Current session SFX multiplier (0–1). | Sync |
| **`getMusicVolume`** | `() => number` | Current session music multiplier (0–1). | Sync |
| **`isPlaying`** | `(key: string) => boolean` | Whether an SFX with that stem is playing. | Sync |
| **`isMusicPlaying`** | `() => boolean` | Whether music is playing. | Sync |

**`SoundPlayOptions` / `MusicPlayOptions`** — optional **`volume?: number`**, **`loop?: boolean`**. Music-only: **`fadeSeconds?: number`**, **`sync?: boolean`** (see examples below).

**Editor previews** — VS Code **room / GUI / inventory / character** previews set **`benneAudioScriptDisabled`** so **`B.sound`** does not load or play audio (full runtime and **BENNE Play** behave normally).

Example (SFX after walk, then a line):

```ts
B.walkToClicked();
B.sound.play('sweeping');
B.player.say('I used the Broom on the Table.');
```

Use **`B.sound.playAndWait('sweeping')`** when the **next** queued step should run only **after** the clip ends.

Crossfade to a new room theme (blocking call waits **2** seconds before the tail continues):

```ts
B.sound.playMusic('outside-ambient', { fadeSeconds: 2 });
```

Same handoff but aligned to the outgoing track’s playback head (best effort; falls back to a plain crossfade):

```ts
B.sound.playMusic('outside-ambient', { fadeSeconds: 2, sync: true });
```

### Video (`B.video`)

Available on every **`BenneScriptCore`** facade (**room / character / inventory / global / GUI / dialog session**). The **same** facade object is exposed as **`B.player.video`**, **`B.character('…').video`**, and **`B.prop('…').video`** for readability. Cinematic video renders full-screen in the active **`RoomScene`** **above** room art. On playback start the engine **hides the HUD** (all generic GUIs — verbs, menus, the dialog choice band, etc.) and **restores** their prior visibility when the video ends, is stopped, or the room tears down. Speaking Text (**`say`**) and Display Text (**`B.display`**) are **not** hidden — they keep working **on top** of the playing video, so you can show dialog and narration over a cinematic.

**Assets** — Put files under **`src/game/assets/videos/<name>.{mp4,webm}`** and reference them by **basename only** (e.g. **`B.video.play('intro-cinematic')`** for **`…/videos/intro-cinematic.mp4`**). Stems are auto-discovered (no manifest) and typed as **`VideoId`** for autocomplete (regenerated by **`npm run generate:game-ids`**). Multiple container formats sharing a stem become fallback URLs.

**Rendering** — Single slot: a new **`play`** replaces any in-flight video. The video is letterboxed to the internal resolution over a black backdrop, screen-fixed, and forced to **nearest-neighbor** filtering for crisp upscaling of low-res sources (e.g. 320×180), matching BENNE's **`pixelArt`** / **`roundPixels`** renderer.

**Volume** — Audio tracks play at **`game-config.json`** **`audio.masterVolume`** × **`VideoPlayOptions.volume`** (0–1, default 1). There is no separate video slider or save persistence in v1.

**Concurrency** — Blocking **`play`** is queued on the interaction tail (so it orders after prior **`walkTo`** / **`wait`** steps) but **resolves immediately** — the script keeps running while the video plays. Use **`playAndWait`** when the next step should run only **after** the video finishes.

**Input while playing** — Active video playback blocks gameplay and GUI input: props, hotspots, characters, inventory rows, GUI buttons/inputs, background walks, and hover descriptions are ignored while the video is up. The custom game cursor uses **`cursor.busyAnimation`** during playback (or hides when no busy clip is configured). **ESC** stops the active video — or, when the video is playing inside a skippable cutscene, skips that whole cutscene (see [Cutscene mode → Skipping](#skipping)). Primary click/tap stops the video only when the playback was started with **`{ clickToSkip: true }`**; otherwise clicks are swallowed.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`play`** | `BlockingWithNow<[key: VideoId, options?: VideoPlayOptions]>` | Start a full-screen cinematic. **Blocking** form queues on the tail then resolves immediately (playback runs concurrently). **`play.now`** starts immediately without tail ordering. | Queued vs **`.now`** |
| **`playAndWait`** | `BlockingWithNow<[key: VideoId, options?: VideoPlayOptions]>` | Same as **`play`**, but the **blocking** form **waits** until the video **ends or is stopped**. **`playAndWait.now`** starts playback without making following lines wait. | Queued vs **`.now`** |
| **`pause`** | `BlockingWithNow<[]>` | Pause the active video. | Queued vs **`.now`** |
| **`resume`** | `BlockingWithNow<[]>` | Resume a paused video. | Queued vs **`.now`** |
| **`stop`** | `BlockingWithNow<[]>` | Stop the active video (resolves any **`playAndWait`** waiters; fires **`onComplete`** + **`benne:video:ended`**). | Queued vs **`.now`** |
| **`seek`** | `BlockingWithNow<[seconds: number]>` | Seek the active video to **`seconds`** from its start. | Queued vs **`.now`** |
| **`isPlaying`** | `() => boolean` | Whether a video is currently loaded and playing/paused. | Sync |

**`VideoPlayOptions`** — optional **`loop?: boolean`** (default false; looping videos never fire completion), **`volume?: number`** (0–1), **`clickToSkip?: boolean`** (default false; primary click/tap stops the video when true), **`onComplete?: () => void`** (called once on end/stop).

**Lifecycle** — Playback stops on room-leave and the video object is destroyed on **`RoomScene`** shutdown, so cinematics never leak across rooms. Calling **`B.video`** with no active **`RoomScene`** is a safe no-op (DEV warn-once, like **`B.camera`**).

**Editor previews** — VS Code **room / GUI / inventory / character** previews set **`benneVideoScriptDisabled`** so **`B.video`** never loads or plays cinematics (full runtime and **BENNE Play** behave normally).

Example (cinematic plays while the player narrates over it, then a queued line waits for the outro):

```ts
B.video.play('intro-cinematic');
B.player.say('It all started on a rainy night...');
B.wait(2);
B.video.playAndWait('outro-cinematic');
B.player.say('And that was the end of it.');
```

### Camera (`B.camera`)

Available on every **`BenneScriptCore`** facade (**room / character / inventory / global / GUI / dialog session**). Script camera state is **runtime-only** — it resets automatically on room transitions and when loading a saved game (fresh **`RoomScene`** boot). Use **`B.camera.reset()`** to return control to the player during a cutscene.

**Config** — Global defaults and limits live in **`game-config.json`** **`camera`** (`minZoom`, `maxZoom`, `defaultTransitionSeconds`, **`shake`** defaults). See **`getCameraSettings()`** in **`ConfigManager.ts`**.

**Targets** — String ids resolve prop → hotspot → character → room point (first match wins). Props and hotspots use **`lookAtPoint`** when set (not **`walkToPoint`**); characters use **`talkPoint`** in frame space when set, else world feet. Room **`points`** and explicit **`Point2`** values are used as-is in room pixels. When **`lookAtPoint`** / **`talkPoint`** is omitted, props fall back to collider geometry / frame center; hotspots fall back to polygon centroid.

**Zoom** — **`1.0`** is the room default (normal). Gameplay zoom composes on top of the engine’s display letterbox zoom; GUI overlays stay aligned via the runtime UI camera.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|----------|
| **`focus`** | `BlockingWithNow<[target: Point2 \| ResolvableTargetId, transitionSeconds?: number]>` | Centers the camera on the target. Suspends player follow until **`reset`**. Omitted / **`0`** **`transitionSeconds`** = instant snap. | Queued vs **`.now`** |
| **`reset`** | `BlockingWithNow<[transitionSeconds?: number]>` | Clears focus and gameplay zoom; restores default player follow. Omitted **`transitionSeconds`** uses config **`defaultTransitionSeconds`**; pass **`0`** for an instant snap. | Queued vs **`.now`** |
| **`setZoom`** | `BlockingWithNow<[zoom: number, transitionSeconds?: number]>` | Sets gameplay zoom (clamped to config **`minZoom`** / **`maxZoom`**). | Queued vs **`.now`** |
| **`resetZoom`** | `BlockingWithNow<[transitionSeconds?: number]>` | Returns zoom to room default (**`1.0`**). Does not clear focus or restore follow — use **`reset`** for that. | Queued vs **`.now`** |
| **`zoomTo`** | `BlockingWithNow<[target, zoom, transitionSeconds?: number]>` | **`focus`** + **`setZoom`** in parallel with one shared transition time. | Queued vs **`.now`** |
| **`shake`** | `(intensity?: number, durationSeconds?: number, falloff?: boolean) => void` | Screen shake. **Fire-and-forget** — never queued, no **`.now`** variant. Omitted args use **`camera.shake`** config defaults. | Immediate |

Example (cutscene):

```ts
B.cutscene(() => {
  B.camera.zoomTo('villain', 1.5, 0.6);
  B.player.say`Look out!`;
  B.camera.shake(0.04, 0.5);
  B.camera.reset(); // uses camera.defaultTransitionSeconds from game-config.json
});
```

Instant reset (no tween):

```ts
B.camera.reset(0);
```

### Speech settings (`B.speechSettings`)

Available on every **`BenneScriptCore`** facade (**room / character / inventory / global / GUI / dialog session**). **Getter/setter properties only** — reads and writes are **sync** (not queued on **`interactionTail`**, unlike **`B.sound.play`**).

**Effective values** — getters return the runtime value: saved **`GameStateManager`** variable when present and typed correctly, else the merged default from **`game-config.json`** **`speech`**. Engine code uses **`getSpeechSettings(manager)`** with the same resolution.

**Persistence** — setters write immediately to **`variables`** (included in **`B.state.save`**, **`exportJson`**, etc.). **`applySnapshot`** keeps prior in-memory **`speech:*`** values when the incoming snapshot omits a key (unless **`initialGameState.variables`** seeds it). See [architecture.md — `B.speechSettings`](architecture.md#benne--architecture).

**Reactivity** — import **`BENNE_SPEECH_SETTINGS_CHANGED_EVENT`** from **`@engine/scripting`** and subscribe in GUI scripts:

```ts
import { BENNE_SPEECH_SETTINGS_CHANGED_EVENT, registerGuiScript } from '@engine/scripting';

registerGuiScript('settings-menu', ({ B }) => {
  const sync = () => {
    // e.g. B.gui('settings-menu').control('clickToSkip').checked = B.speechSettings.clickToSkip;
  };
  B.onGuiBuilt(sync);
  B.onSpeechSettingsChanged.on(BENNE_SPEECH_SETTINGS_CHANGED_EVENT, sync);
});
```

**`RoomScene`** clears **`onSpeechSettingsChanged`** listeners on shutdown (same pattern as **`onVerbContextChanged`**).

| Property | Variable key | Description |
|----------|--------------|-------------|
| **`clickToSkip`** | `speech:clickToSkip` | Global default for timed **`say`** lines when the call omits **`{ clickToSkip }`**. Per-line **`say('…', { clickToSkip: true \| false })`** still wins. |
| **`showText`** | `speech:showText` | When **`false`**, **`.say()`** timing still runs but the Speaking Text overlay stays hidden. |
| **`msPerCharacter`** | `speech:msPerCharacter` | Base ms per character for line duration. |
| **`durationMultiplier`** | `speech:durationMultiplier` | Multiplier on character count (must be **> 0**). |
| **`minDurationMs`** | `speech:minDurationMs` | Minimum line display time (ms). |
| **`maxDurationMs`** | `speech:maxDurationMs` | Maximum line display time (ms). |
| **`defaultTalkOffset`** | `speech:defaultTalkOffset` | **`{ x, y }`** offset in canvas pixels after projecting **`talkPoint`**. |

### Dialog settings (`B.dialogSettings`)

Available on every **`BenneScriptCore`** facade. Controls settings for the SCUMM-style dialog choice UI.

| Property | Variable key | Description |
|----------|--------------|-------------|
| **`choiceOptionsViewportHeightPx`** | `dialog:choiceOptionsViewportHeightPx` | Game-level cap for choice option stacking; **`undefined`** setter clears override. Per-GUI **`choiceOptionsViewportHeightPx`** on **`*.gui.json`** still wins when set. |
| **`usedColor`** | `dialog:usedColor` | Hex color (e.g. **`"#888888"`**) applied to dialog option rows the player has already picked. When set, tints bullet, label, outlines, and background instead of alpha-dimming. Omitted / **`undefined`** = legacy **`setAlpha(0.45)`** behavior. **`undefined`** setter clears override. |

---

## `B.player` (**`BenneScriptPlayerFacade`**)

Constructed from active **`RoomScene`** (global/dialog resolve **`SCENE_ROOM` on each call**). DEV warns once if **`RoomScene`** missing for movement/speech.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`sound`** | **`BenneScriptSoundFacade`** | Alias of top-level **`B.sound`** (same object). | See [Sound (`B.sound`)](#sound-bsound) |
| **`video`** | **`BenneScriptVideoFacade`** | Alias of top-level **`B.video`** (same object). | See [Video (`B.video`)](#video-bvideo) |
| **`id`** | getter **`CharacterId`** | Current active player character id (`GameStateManager.activePlayerCharacterId`). | Sync |
| **`switchTo`** | `BlockingWithNow<[characterId: string]>` | Switches live player control to a spawned character in the active room: persists **`activePlayerCharacterId`**, rebinds `RoomScene.player`, refreshes camera follow, hover/cursor state, and active-player inventory panels. DEV warns + no-op when the id is empty or not spawned in the current room. | Queued vs **`.now`** |
| **`switchToNow`** | `(characterId: string) => void` | Alias for **`switchTo.now`**. | Immediate |
| **`walkTo`** | `BlockingWithNow<[Point2 \| string]>` | Pathfind + walk tween. **No-op** when **`movable`** is **`false`** (promise resolves immediately). | Queued vs **`.now`** |
| **`moveTo`** | `BlockingWithNow<[Point2 \| string]>` | Teleport feet (**`movePlayerToNow`**); updates idle facing. **Not** gated by **`movable`**. | Queued vs **`.now`** |
| **`moveToNow`** | `(target: Point2 \| string) => void` | Alias for **`moveTo.now`**. | Immediate |
| **`walkToClicked`** | `BlockingWithNow<[]>` | Delegates core **`performWalkToClicked`** (no-op when **`movable`** is **`false`**). | |
| **`faceClicked`** | `BlockingWithNow<[]>` | Delegates **`performFaceClicked`**. | |
| **`animation`** | getter **`string`**; setter **`string \| null`** | Effective clip tag; **`null`** clears persisted override on set. Setter **queued**. | Setter queued |
| **`animationNow`** | `(tag: string \| null) => void` | Immediate override / clear. | Immediate |
| **`playAnimation`** | `BlockingWithNow<[tag: string]>` | One-shot tag; restores idle/override after. | Queued vs **`.now`** |
| **`stopAnimation`** | `() => void` | Clears override + returns to directional idle. | Immediate |
| **`say`** | **`BenneScriptSayDialogueHybrid`** | **`'line'`**, **`say.now('line', opts?)`**, or tagged scoped to player id. **`clickToSkip`** from arg or effective **`B.speechSettings.clickToSkip`**. | Per hybrid rules |
| **`face`** | `BlockingWithNow<[CharacterFacingLetter]>` | **`facePlayerScriptDirection`**. | Queued vs **`.now`** |
| **`movable`** get/set | `boolean` | When **`false`**, **`walkTo`**, **`walkToClicked`**, click-to-walk, and verb-driven player walks are ignored; **`moveTo`** / **`moveTo.now` / `moveToNow`** still teleport. Setter **queues** on the interaction tail (like **`visible`** on **`B.character`**); persists `` `character:<activePlayerId>:movable` `` (see [architecture.md §7 → Persistence](architecture.md#7-scripting--interaction-system-bennescript)). Getter with no **`RoomScene`** falls back to saved state, else **`true`**. | Setter queued |
| **`startFollowingCharacter`** | **`(targetId: string, options?: CharacterFollowOptions) => void`** | Persists follow state for the active player (keys `` `character:<activePlayerId>:followingTarget` `` and `` `character:<activePlayerId>:followOptions` ``). **`targetId`** is another character’s definition id or the string **`"player"`** (case-insensitive **`"player"`** is stored as lowercase **`"player"`** — resolves to the current active player at runtime). Idempotent for the same target; re-call merges new **`options`**. Self-follow / empty target: DEV warn + no-op. When a **`RoomScene`** is active, **`RoomScene.startCharacterFollowingCharacter`** also clears the follow goal cache for repath; without a room, **`applyPersistedCharacterFollowFromScript`** still writes **`GameStateManager`** if a manager exists. | Queued |
| **`stopFollowingCharacter`** | **`() => void`** | Clears persisted follow keys and stops a follow-initiated walk tween if the player’s sprite has follow purpose data. | Queued |
| **`isFollowing`** | getter **`boolean`** | **`true`** when `` `character:<activePlayerId>:followingTarget` `` is set in **`GameStateManager`**; **`false`** when no manager. | Sync |
| **`followingTarget`** | getter **`string \| null`** | Raw persisted target string (**`"player"`** or a character id), or **`null`**. | Sync |
| **`setSpeechPosition`** | **`BlockingWithNow<[x: number, y: number]>`** | Absolute world/room-space bottom-center for the active player's speaking-text GUI. Persists `` `character:<activePlayerId>:speechPosition` ``; bypasses **`talkPoint`** and **`B.speechSettings.defaultTalkOffset`**. Highest precedence when set. | Queued vs **`.now`** |
| **`setSpeechOffset`** | **`BlockingWithNow<[x: number, y: number]>`** | Canvas-pixel offset added after default talk anchor + **`defaultTalkOffset`** when no absolute position is set. Persists `` `character:<activePlayerId>:speechOffset` ``. | Queued vs **`.now`** |
| **`resetSpeechPosition`** | **`BlockingWithNow<[]>`** | Clears both speech position and offset overrides for the active player. | Queued vs **`.now`** |

The **`options`** argument is **`CharacterFollowOptions`** (**`src/types/characterFollow.ts`**); see **`B.character(id)`** below for defaults and examples.

```ts
B.player.setSpeechOffset(0, -120);
B.player.say('Hello from up here.');
B.player.setSpeechPosition(400, 300);
B.player.say('Fixed world spot.');
B.player.resetSpeechPosition();
```

---

## `B.character(id)` (**`BenneScriptCharacterFacade`**)

Defined on **`BenneScriptCore`**: same movement/teleport/play/stop **`say`** / **`face`** / **`movable`** / **follow** pattern as **`B.player`**, routed to **`walkCharacterTo`**, **`moveCharacterToNow`**, **`faceCharacterScriptDirection`**, **`startCharacterFollowingCharacter` / `stopCharacterFollowingCharacter`**, **`startCharacterFacingCharacter` / `stopCharacterFacingCharacter`**, character animation scripting APIs (**`NPC`** — no **`walkToClicked`** on facade; use top-level **`B.walkToClicked`** / **`B.player.*`**). Exposes **`sound`** (**same object** as **`B.sound`**).

**Room resolution:** Each call uses the same **`getPlayerWalkRoomScene`** hook as **`B.player`** — room / character / inventory scripts pass a stable **`() => this.roomScene`** closure; dialog / global / GUI pass **`() => game.scene.getScene(SCENE_ROOM)`**. Movement / **`face`** / **`fade`** / **`startFacingCharacter` / `stopFacingCharacter`** with no room no-op and DEV **`console.warn`** once. **`hide` / `show` / `visible` / `visibleNow`**, **`movable`**, **`clickable`**, **`description`**, **`setSpeechPosition` / `setSpeechOffset` / `resetSpeechPosition`**, and **`startFollowingCharacter` / `stopFollowingCharacter`** setters still persist to **`GameStateManager`** when a manager is active so values survive the next room load even if **`RoomScene`** is not resolved yet.

**`movable` getter:** Effective value is the saved override (if any), else **`CharacterData.movable`** from the **first** spawn of that **`characterId`** in the active room’s JSON (**`true`** when omitted). If that id is **not** spawned in the current room, there is no JSON row from this room — the getter still returns a saved **`character:<id>:movable`** boolean when set; otherwise **`true`**. Use **`B.player.movable`** when you mean the protagonist, not an arbitrary **`B.character('…')`** id that might be absent from the room.

**`clickable` getter:** Effective value is the saved override (if any), else **`CharacterData.clickable`** from the **first** spawn of that **`characterId`** in the active room’s JSON. When **`false`**, the NPC is not hit-tested (no hover label, verb dispatch, or inventory-on-target). **`B.player.walkTo('penny')`** / **`resolveMovementTarget`** still resolve the character id for movement (same rule as inactive hotspots — interaction only). Not exposed on **`B.player`**.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
| **`hide` / `show`** | **`BlockingWithNow<[]>`** | Script visibility overrides (persisted — see [architecture.md §7](architecture.md#7-scripting--interaction-system-bennescript)); queue vs **`.now`**. | Queued vs **`.now`** |
| **`visible`** get/set | Setter queues like **`animation`**; **`visibleNow(v)`** applies immediately. Both persist a boolean to **`GameStateManager`** (key `` `character:<characterId>:visible` ``). **`getCharacterScriptVisible`** returns the live sprite when one exists, else the saved override, then the first room JSON placement default. | Setter queued |
| **`movable`** get/set | When **`false`**, **`walkTo`** is a no-op for this NPC (**`walkCharacterTo`** returns immediately). Setter queues like **`visible`**; persists `` `character:<characterId>:movable` ``. **`moveTo`** is **not** gated. | Setter queued |
| **`clickable`** get/set | When **`false`**, the NPC is not hit-tested (no hover, verbs, or inventory-on-target). Setter queues like **`movable`**; persists `` `character:<characterId>:clickable` ``. **`walkTo('id')`** / movement resolution is **not** gated. | Setter queued |
| **`description`** get/set | Hover / verb-line label. Setter is **immediate** (not queued). Persists `` `character:<characterId>:description` `` over JSON **`CharacterData.description`**. Empty string is stored as empty (does **not** clear to JSON). Hover still falls back to **name** when the effective (trimmed) string is empty. | Sync |
| **`startFollowingCharacter`** | **`(targetId: string, options?: CharacterFollowOptions) => void`** | Same persistence and semantics as **`B.player.startFollowingCharacter`** (keys use this NPC’s **`characterId`**). **`RoomScene.startCharacterFollowingCharacter`** when a room is active. | Queued |
| **`stopFollowingCharacter`** | **`() => void`** | Clears follow state and stops a follow-initiated NPC walk if applicable. | Queued |
| **`isFollowing`** | getter **`boolean`** | Whether this id has a persisted **`followingTarget`**. | Sync |
| **`followingTarget`** | getter **`string \| null`** | Persisted target id or **`null`**. | Sync |
| **`inventory`** | **`BenneScriptCharacterInventoryNamespace`** | This NPC's carried-items bag (**`add` / `remove` / `has` / `quantityOf` / `items` / `clearInventory`** — same signatures as **`B.inventory`**, without callable **`B.inventory(itemId)`**). | Mixed |
| **`startFacingCharacter`** | **`(targetCharacterId: string, minWaitTime?: number, maxWaitTime?: number) => void`** | Keeps this NPC’s **Idle** facing toward **`targetCharacterId`**’s **feet** (same **`CharacterData.id`** as other **`B.character`** calls). When either character’s feet move by more than a small epsilon, **`RoomScene`** cancels any pending turn and schedules a new one after a **uniform random** delay in **`[minWaitTime, maxWaitTime]`** seconds — defaults **`0.2`** and **`0.4`**. Negative bounds clamp to **`0`**; if **`minWaitTime > maxWaitTime`**, the engine swaps them. Calling **`startFacingCharacter`** again on the same observer replaces the previous target and timing. No-op when observer **equals** target, or when either id has no **`Sprite`** instance in the room. Not persisted across room loads (cleared in **`RoomScene`** **`create`** / **shutdown**). | Queued |
| **`stopFacingCharacter`** | **`() => void`** | Removes the observer’s active face-target lock and cancels its pending timer. | Queued |
| **`fade`** | `BlockingWithNow<[fromAlpha: number, toAlpha: number, durationSeconds: number]>` | Tween the character sprite's `alpha` from **`fromAlpha`** to **`toAlpha`** over **`durationSeconds`** (`Linear`); alphas clamp to `[0, 1]`, duration to `>= 0` (`0` snaps to **`toAlpha`**). Each call kills running tweens on the sprite first, then sets `alpha = fromAlpha` before tweening. **`toAlpha`** is **persisted** to **`GameStateManager`** (key `` `character:<characterId>:alpha` ``) at call time and re-applied on every spawn (saving mid-fade restores the intended final alpha). Routes through **`RoomScene.fadeCharacterScriptAlpha`**. | Queued (waits for tween) vs **`.now`** |
| **`setSpeechPosition`** | **`BlockingWithNow<[x: number, y: number]>`** | Absolute world/room-space bottom-center for this character's speaking-text GUI. Persists `` `character:<characterId>:speechPosition` ``; bypasses authored **`talkPoint`** and global **`B.speechSettings.defaultTalkOffset`**. Takes precedence over **`setSpeechOffset`**. Applied on-demand when that character speaks. | Queued vs **`.now`** |
| **`setSpeechOffset`** | **`BlockingWithNow<[x: number, y: number]>`** | Canvas-pixel offset added after the default talk anchor is projected and **`defaultTalkOffset`** is applied. Persists `` `character:<characterId>:speechOffset` ``. Ignored while an absolute **`speechPosition`** override is set. | Queued vs **`.now`** |
| **`resetSpeechPosition`** | **`BlockingWithNow<[]>`** | Clears both **`speechPosition`** and **`speechOffset`** overrides for this character id. | Queued vs **`.now`** |

```ts
B.character('penny').inventory.add('Flower');
B.inventory.remove('Key'); // active player's bag

B.character('hank').setSpeechOffset(0, -120); // fine-tune above head
B.character('hank').say('Hello from up here.');

B.character('narrator').setSpeechPosition(400, 300); // fixed world spot
B.character('narrator').say('This line always appears at the same screen location.');

B.character('hank').resetSpeechPosition(); // back to default

B.character('penny').movable = false; // queued; penny won't pathfind-walk until set true again
B.character('penny').clickable = false; // queued; penny can't be clicked until set true again
B.character('penny').description = 'A soggy detective.'; // immediate; persisted hover label
if (B.character('penny').clickable) {
  B.character('penny').say('Try clicking me.');
}
B.character('penny').hide(); // persisted; stays hidden after room change / save when Penny is in the room
B.character('penny').startFollowingCharacter('hank');
B.character('penny').startFollowingCharacter('hank', {
  minDistance: 60,
  offset: { x: 40, y: 0 },
  speedMultiplier: 0.9,
});
B.character('penny').stopFollowingCharacter();
if (B.character('penny').followingTarget === 'hank') {
  B.character('penny').stopFollowingCharacter();
}
B.character('henry').startFacingCharacter('hank');
B.character('henry').stopFacingCharacter();
B.character('penny').fade(0, 1, 0.5); // fade Penny in from transparent to opaque over 0.5 s
B.character('penny').fade.now(1, 0, 1); // start fade-out immediately, don't block following lines
```

**`CharacterFollowOptions`** (all fields optional) — TypeScript type in **`src/types/characterFollow.ts`**; exported from **`BenneScript`** / **`@engine/scripting`** as **`CharacterFollowOptions`**. Defaults: **`minDistance`** `48`; **`repathThreshold`** `minDistance + 12` (clamped to be **`>= minDistance`**); **`offset`** `{ x: 0, y: 0 }` in the target’s facing frame (**`+x`** forward, **`+y`** 90° clockwise in screen space); **`speedMultiplier`** `1`; **`faceTargetWhenIdle`** `true`; **`pauseDuringCutscene`** `true` (while **`RoomScene`** input suppression is active — cutscene depth or scripted-dialog suppression — the follow driver does not start new follow walks).

---

## `B.prop(propId)` (**`BenneScriptPropFacade`**)

**Room scripts and dialog sessions.** Ids are props in the **active** room (`props[].id`). Dialog calls resolve that room’s `RoomScene` when each operation runs (DEV warn once and no-op if no room is active). Queued members use the calling script’s interaction tail.

| Member | Description | Blocking |
|--------|-------------|--------|
| **`sound`** | Same **`BenneScriptSoundFacade`** as **`B.sound`**. | See [Sound (`B.sound`)](#sound-bsound) |
| **`video`** | Same **`BenneScriptVideoFacade`** as **`B.video`**. | See [Video (`B.video`)](#video-bvideo) |
| **`hide` / `show`** | Script visibility overrides (persisted — see below); **`BlockingWithNow<[]>`** (queue vs **`.now`**). | Queued vs **`.now`** |
| **`visible`** get/set | Setter queues like **`animation`**; **`visibleNow(v)`** applies immediately. Both setter and **`hide` / `show`** persist the boolean to **`GameStateManager`** (key `` `room:<roomId>:prop:<propId>:visible` ``); **`getPropScriptVisible`** returns the live sprite when one exists, else the saved override, else JSON. | Setter queued |
| **`clickable`** get/set | When **`false`**, the prop is not hit-tested (no hover, verbs, or inventory-on-target). Setter queues like **`visible`**; persists `` `room:<roomId>:prop:<propId>:clickable` `` over JSON **`RoomPropInstance.clickable`**. Enabling at runtime needs an authored collider (≥3 points); missing collider is persisted but the sprite stays non-interactive (warn). **`walkTo('id')`** / movement resolution is **not** gated. | Setter queued |
| **`description`** get/set | Hover / verb-line label. Setter is **immediate** (not queued). Persists `` `room:<roomId>:prop:<propId>:description` `` over JSON **`RoomPropInstance.description`**. Empty string is stored as empty (does **not** clear to JSON). Hover still falls back to the **prop id** when the effective (trimmed) string is empty. | Sync |
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
B.prop('FountainOff').clickable = false; // queued; fountain can't be clicked until set true again
B.prop('Knife').description = 'Still sticky.'; // immediate; persisted hover label
B.prop('Rock').moveTo.now({ x: 80, y: 90 }); // teleport authoring origin; persisted on next flush
```

**Persistence keys** — see [architecture.md §7 → Sprite animation & persistence](architecture.md#7-scripting--interaction-system-bennescript) for the full reserved key list. Visibility, **movable**, **clickable**, **description**, **speech position / offset**, **follow** (**`followingTarget`** + **`followOptions`**), alpha, and animation overrides all flow through **`GameStateManager.variables`** and survive **`exportJson` / `importJson`** / **`save` / `load`** like any other **`B.state`** value. **Position** flows the same way but is **lazily** written — it is pulled into **`variables`** by a snapshot flush hook installed in **`RoomScene.create`** that fires automatically on room-leave (**`prepareForLeave`**), inside **`getSnapshot`** (so **`save`** / **`exportJson`** capture it), and on **`B.state.flush()`**.

---

## `B.inventory` (**`BenneScriptInventoryNamespace`**)

Callable **`B.inventory(itemId)`** returns **`BenneScriptInventoryItemFacade`** (see **[`benneScriptGameStateApi.ts`](../src/engine/scripting/benneScriptGameStateApi.ts)**). GUI scripts now share the same inventory namespace as room/global/dialog surfaces (pre-game calls no-op with a DEV warning until the manager is active).

**Bag scope** — Quantity helpers (**`add`**, **`remove`**, **`has`**, **`quantityOf`**, **`items`**, **`clearInventory`**) mutate the **active player's** bag (`GameStateManager.getActivePlayerCharacterId()`, persisted as **`activePlayerCharacterId`** in save snapshots v2; defaults to **`startingPlayerCharacter`** from **`game-config.json`**). **`B.player.inventory`** is the same active-player bag. For another character's bag use **`B.character('penny').inventory`**.

**Quantity API** — **`add`** and **`remove`** are **`BlockingWithNow<[string, number?]>`** (queue on **`interactionTail`** when the namespace is wired with **`chain`**; **`.now`** mutates **`GameStateManager`** immediately). **`has`**, **`quantityOf`**, **`items`**, and **`clearInventory`** stay synchronous. After **`remove`** from the **active player's** bag, if that id was the armed use-on-target item (**`activeInventory`**) and the id is no longer carried (quantity 0), the engine clears **active verb** and **active inventory** — even when **`dropWhenInventoryUsed`** is **`false`** in **`game-config.json`** (that flag applies to post–use-on-target clicks, not script removal).

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

/** Per-item row: effective GUI icon tag + armed use-on-target cursor tag (see below). */
interface BenneScriptInventoryItemFacade {
  get animation(): string;
  set animation(tag: string);
  animationNow(tag: string): void;
  get cursorAnimation(): string;
  set cursorAnimation(tag: string);
  cursorAnimationNow(tag: string): void;
  get description(): string;
  set description(v: string);
}
```

**Per-item facade:**

| Member | Setter / blocking | Immediate |
|--------|-----------------|----------|
| **`add`**, **`remove`** | Queued when namespace wired with **`chain`** | **`add.now(…)`**, **`remove.now(…)`** |
| **`animation`** get/set — effective **`defaultAnimation`** | Queued when namespace wired with **`chain`** (room/character/inventory/global/dialog) | **`animationNow(tag)`** |
| **`cursorAnimation`** get/set — effective armed cursor Aseprite tag (`InventoryItemData.cursorAnimation` ± save override) | Same | **`cursorAnimationNow(tag)`** |
| **`description`** get/set — hover / verb-line label | Immediate (not queued) | — |
| Setter **empty string** on **`animation`** / **`cursorAnimation`** | Clears **`GameStateManager`** override for that field (JSON defaults return). **`description = ''`** persists as empty (does **not** clear to JSON). |

**`cursorAnimation` getter** — Returns the **effective** tag the engine uses when this item is **`activeInventory`** (same resolution as the custom game cursor). **`''`** means *no* per-item cursor clip (fall back to the verb / global cursor). Unknown **`itemId`** yields **`''`** (DEV may warn).

Example:

```ts
if (B.inventory('Knife').cursorAnimation === 'Knife-PB') {
  // matches JSON and/or a runtime override for that tag
}
B.inventory('Knife').cursorAnimation = 'Knife-alt'; // queued on interaction tail
B.inventory('Knife').cursorAnimationNow('Knife-alt'); // immediate
B.inventory('Key').description = 'Now slightly bent.'; // immediate; persisted hover label
```

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
getSaveList(): SaveMetadata[];
save(name: string, slot?: number): void;
save.now(name: string, slot?: number): void;
load(nameOrSlot: string | number): boolean;
load.now(nameOrSlot: string | number): boolean;
deleteSave(nameOrSlot: string | number): void;
deleteSave.now(nameOrSlot: string | number): void;
renameSave(oldName: string, newName: string): void;
renameSave.now(oldName: string, newName: string): void;
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
getActivePlayerCharacterId(): string;
setActivePlayerCharacterId(characterId: string): void;
getCurrentRoom(): string;
getLastRoom(): string | null;
setCurrentRoom(roomId: string): void;
setLastRoom(roomId: string | null): void;
```

**Active player character** — **`getActivePlayerCharacterId()`** returns the persisted id used by **`B.player`**, **`B.inventory`**, and default **`inventoryPanel`** controls. **`setActivePlayerCharacterId(id)`** updates the saved id and emits **`GAME_STATE_ACTIVE_PLAYER_CHARACTER_CHANGED_EVENT`**; in an active room, use **`B.player.switchTo(id)`** when you also want the live controlled sprite, camera follow, and input routing to switch immediately.

**`flush()`** runs every registered **snapshot flush hook** (see [architecture.md §3 → Game state](architecture.md#game-state-v1) and [§7 → Sprite animation & persistence → Snapshot flush hooks](architecture.md#7-scripting--interaction-system-bennescript)). It pulls **lazily-saved** runtime state on the active **`RoomScene`** — today, character feet world positions and prop authoring positions — into **`GameStateManager.variables`** so the next room load (or save snapshot) restores them. **Most state is already eagerly persisted** on every change (visibility, alpha, animation overrides, flags, variables, inventory) — `flush` exists for fields that are too noisy to write per-tick during walks. It also runs **automatically** inside **`getSnapshot`** (so **`save`** / **`exportJson`** already pick everything up) and on room-transition leave (**`RoomTransitionOrchestrator.prepareForLeave`**). Call it directly only at custom save points.

**Named saves** — `save/load/deleteSave/renameSave/getSaveList` are manifest-backed (`benne-saves-manifest-v1`) and operate on names (or slot numbers for `load/deleteSave`). Named snapshots use `benne-save-v1-<sanitized-name>` keys; legacy slot keys (`benne-save-<slot>`) remain fully supported and are surfaced in `getSaveList()` with `slot` metadata.

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

**Choice GUI layout (authoring, not Bennescript)** — Option rows and scroll paging use a vertical budget below **`Option-Grid`**. By default that budget runs to the bottom of the internal resolution; for top-of-screen or short strips, set **`choiceOptionsViewportHeightPx`** in **`game-config.json`** (`dialog` block) and/or on the choice GUI’s **`*.gui.json`** root (per-GUI overrides game-config). See [architecture.md — Dialog system](architecture.md#dialog-system-choice-topics).

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
whenLoadedRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
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

**Load order** — on `B.state.load(...)` room restarts, the loaded-hook order is:
`whenLoadedAnyRoom` → `whenLoadedRoom`.

On load, the orchestrator skips both room-local and global enter-phase hooks:
`whenEnterRoom`, `whenEnterAnyRoom`, `whenEnterRoomAfterFade`, and `whenEnterAnyRoomAfterFade`.

**Non-load order** (`boot`, `preview`, `transition`) — global enter hooks run before room-local hooks in each phase:
`whenEnterAnyRoom` → `whenEnterRoom`, then after fade `whenEnterAnyRoomAfterFade` → `whenEnterRoomAfterFade`.

### Room regions — `active`, enter / exit

**`B.region(id).active`** is available on **room scripts and dialog sessions** (immediate get/set against the active room). **`whenEnter` / `whenExit`** (and **`whenEnterRegion` / `whenExitRegion`**) are **room scripts only** — a dialog session is disposed when the dialog stops, so those listeners belong in `*.room.ts`.

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
- The engine tracks the **winning** region at feet each frame (**last** overlapping active polygon with ≥3 points — enter/exit only, via **`resolveWinningRoomRegionIdAtFeet`**). Scale and tint use separate winners inside **`computeRoomRegionPerspective`**: the last containing region with **`scaleEnabled: true`**, and the last with **`tintEnabled: true`**. A later region with that flag omitted or **`false`** does not cancel the earlier feature. The **first** frame after **`RoomScene`** load only seeds internal state (no **`whenEnter`** if the character already spawns inside the polygon). Crossing from region A to B fires **`whenExit`** on **A** then **`whenEnter`** on **B**.
- **Character tint** (data-only): optional **`tintEnabled`** (omit or not **`true`** = off), **`tint`** (`#rrggbb`), and **`tintAlpha`** (0–1) on a region in **`*.room.json`**. While feet are in the **tint winner** (last overlapping region with **`tintEnabled: true`**), the sprite multiply-tints (Phaser **`setTint`** / **`clearTint`** via **`applyCharacterSpriteRegionTintFromWinningRegion`**); see **`RoomRegionData`** in **`src/types/room.ts`** and **`packedTintFromWinningRegion`** / **`applyCharacterSpriteRegionTintFromWinningRegion`** in **`src/engine/room/regionCharacterScale.ts`**. There is no separate Bennescript API — uncheck **Tint** in the Inspector (or omit **`tintEnabled`**) to disable. Perspective scale is the same pattern: **`scaleEnabled`** (default off) gates **`scaleTop`** / **`scaleBottom`** / **`scaleWalkSpeed`**.

Advanced: stable event strings **`roomRegionEnterEventId(roomId, regionId)`** / **`roomRegionExitEventId`** in **`src/engine/events/regionEnterExitEvents.ts`** for **`B.raw.on`** tooling.

### Walkable areas — `B.walkable(id).active`

**Room scripts and dialog sessions** — **`B.walkable('walkableId').active`** getter and setter (same persistence pattern as **`B.region(…).active`**). Dialog calls use the active room; the setter is **immediate** (it does not wait behind earlier `say` lines on the interaction tail).

- **`active` get/set** — immediate (not queued). Persisted to **`GameStateManager`** (key `` `room:<roomId>:walkable:<walkableId>:active` ``), re-applied to the live **`roomData.walkable.polygons`** entry at room load. When **inactive**, that polygon is ignored by walk tests, destination clamping, and pathfinding; its holes are ignored with it. A walk that has already started keeps its current path. The JSON **`active: false`** field is the authoring default; the script override is layered on top.
- **`walkableId`** must match **`walkable.polygons[].id`** in this room’s **`*.room.json`** exactly (**case-sensitive**). If there is no matching polygon, the getter returns **`false`**, the setter is a no-op, and DEV logs once per room load with the list of known walkable ids.
- Hole rings are not script ids. To stop a hole from cutting the mesh, set **`holes[].active`** to **`false`** in JSON, or deactivate the owning polygon.

```ts
B.walkable('bridge').active = false; // immediately drop it from the nav mesh; persisted

if (B.walkable('bridge').active) {
  B.player.walkTo({ x: 120, y: 80 });
}
```

### Room hotspots — `active` / `description`

**Room scripts and dialog sessions** — **`B.hotspot('hotspotId').active`** getter and setter (same persistence pattern as **`B.region(…).active`**). **`B.hotspot(id).clickable`** is an alias of **`.active`** (same persist key, same immediate setter) so hotspots share a **`.clickable`** name with **`B.character(id).clickable`** / **`B.prop(id).clickable`**. Dialog calls use the active room; setters stay **immediate** (they do not wait behind earlier `say` lines on the interaction tail).

- **`active` get/set** — immediate (not queued on the interaction tail). Persisted to **`GameStateManager`** (key `` `room:<roomId>:hotspot:<hotspotId>:active` ``), re-applied to the live **`roomData.hotspots`** entry at room load. When **inactive**, the engine removes the polygon input zone (no hit-test, hover, or verb dispatch for that hotspot). When **active** and the hotspot has a valid polygon (≥3 points), the zone is mounted or left mounted. **`RoomScene.resolveMovementTarget`** still resolves string ids to hotspot geometry for **`walkTo` / `moveTo`** even when the hotspot is inactive — **`active`** gates **interaction** only.
- **`clickable` get/set** — alias of **`active`**. Prefer **`.active`** in new scripts when you mean the JSON **`active`** field; **`.clickable`** is the character/prop-symmetric name.
- **`description` get/set** — immediate (not queued). Persisted to **`GameStateManager`** (key `` `room:<roomId>:hotspot:<hotspotId>:description` ``) over JSON **`hotspots[].description`**. Empty string is stored as empty. Hover still shows **`null`** (and the hover-text GUI may fall back to **`targetId`**) when the effective (trimmed) string is empty. Unknown id: getter **`''`**, setter no-op, DEV warn once per room load.
- **`hotspotId`** must match **`hotspots[].id`** in this room’s **`*.room.json`** exactly (**case-sensitive**). If there is no matching row, the **`active`** getter returns **`false`**, the **`description`** getter returns **`''`**, the setter is a no-op, and DEV logs once per room load with the list of known hotspot ids.

```ts
B.hotspot('secret-door').active = false;
B.hotspot('window').clickable = false; // same as .active = false
B.hotspot('secret-door').description = 'A door that used to be locked.';

if (B.hotspot('secret-door').active) {
  // …
}
```

### Room GUIs — `B.gui(id)`

Room scripts can show, hide, and drive any GUI overlay that **`RoomScene`** has already built (`*.gui.json` id, typed as **`GuiId`**). Overlays are composed **before** `registerRoomScript` runs, so **`B.gui`** is valid in **`whenEnterRoom`**, verb handlers, and the top level of the room script.

```ts
B.whenUse('door', () => {
  B.player.walkToClicked();
  B.player.say('Let me check the panel.');
  B.gui('puzzle-panel').show(); // runs after the walk and the line
});

B.gui('puzzle-panel').hide.now(); // immediate, does not wait on the tail
B.gui('puzzle-panel').control('status').text = 'Locked';
```

- **`show` / `hide`** are **`BlockingWithNow`**: the plain call queues on **this room script’s** interaction tail (same idea as **`B.prop(id).hide()`**); **`.now`** applies immediately. GUI scripts keep immediate **`show()` / `hide()`** ( **`.now`** is the same immediate call there).
- Both paths use **`GuiOverlayHandle.setVisible`**, then the target overlay’s **`onGuiShow` / `onGuiHide`**.
- **`control(id)`** is the same facade as in a GUI script (real control, or an inert facade when the overlay or control id is missing). Most setters are immediate. **`tweenTo`** and text-input **`text` / `focused`** still queue on the **owning GUI script’s** tail, because that queue is bound when the overlay is built.
- Visibility is **not** persisted. The next room load rebuilds each overlay from **`*.gui.json` `visible`**. Re-apply in **`whenEnterRoom`** when a puzzle GUI must stay hidden.
- **`speaking-text`**, **`display-text`**, and dialog choice overlays stay engine-driven (**`say`**, **`display`**, **`B.dialog`**). Do not use them as generic panels.
- Missing or not-yet-built overlays are a no-op (DEV warns).

**`whenButtonClick`**, checkbox and hover hooks, **`onGuiBuilt` / `onGuiShow` / `onGuiHide`**, and **`B.scene`** stay on the GUI’s own script.

### Per-frame hook — `B.onUpdate`

```ts
import type { UpdateContext } from '@engine/scripting/types';

B.onUpdate((ctx: UpdateContext) => {
  // runs every frame while this room is active — outside the interaction queue
});
```

- **Where** — **`registerRoomScript`** and **`registerGlobalScript`** only (room **`B`** and global **`B`**). Other facades inherit **`BenneScriptCore.onUpdate`** but it is a no-op with a **one-time** dev **`console.warn`**.
- **Not queued** — unlike **`whenLookAt`**, **`B.region(…).whenEnter`**, or **`B.wait`**, **`B.onUpdate`** does **not** use **`interactionTail`** and has **no** **`.now`** variant.
- **Order** — Each frame, after **`RoomScene.update`** finishes its engine work (walking snap, character follow, region scale/tint + enter/exit detection, parallax, stack depths, path debug), **room** script handlers run **first** (registration order within the room), then **global** script handlers (registration order). Same “room first, then global” spirit as verb dispatch fallbacks.
- **Cutscenes** — Handlers **always** run; the engine does **not** suppress **`B.onUpdate`** when **`cutsceneDepth > 0`**.
- **`UpdateContext`** (`src/engine/scripting/types.ts`):
  - **`deltaSeconds`** — `game.loop.delta / 1000` from the active room scene’s Phaser step (uncapped; same source as other room timing code that clamps elsewhere).
  - **`roomId`** — the active room’s id (**`roomData.id`**).
- **Lifecycle** — Room: each handler is tied to that room load’s **`BenneScript`**; **`RoomScene`** **`SHUTDOWN`** calls **`B.dispose()`**, which runs the per-registration unregister (removes that callback from the room list). Global: **`wireBenneGlobalScripts`** registers **`Phaser.Core.Events.DESTROY`** on the **`Phaser.Game`** to call **`clearGlobalBenneScriptOnUpdateHandlers`** (drops every global **`B.onUpdate`** subscription). Each global registration also pushes the same unregister onto **`BenneScriptCore`**’s disposable list so a future **`GlobalBenneScript.dispose()`** would remove that handler individually if you call it.
- **Errors** — A throwing handler is logged (`[Benne] B.onUpdate (room|global) handler #… failed:`); other handlers still run.

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
whenLoadedAnyRoom(handler: (ctx: RoomTransitionContext) => void | Promise<void>): void;
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
onGuiShow(callback: (gui: GuiRuntime) => void): void;
onGuiHide(callback: (gui: GuiRuntime) => void): void;
queueInteraction(factory: () => Promise<unknown>): void;

gui(overlayGuiId: string): BenneScriptGuiOverlayRef;

whenButtonClick(buttonId: string, handler: () => void): void;
whenAnyButtonClick(handler: (buttonId: string) => void): void;
whenCheckboxCheck(checkboxId: string, handler: () => void): void;
whenCheckboxUncheck(checkboxId: string, handler: () => void): void;

whenMouseEnter(controlId: string, handler: () => void): void;
whenMouseLeave(controlId: string, handler: () => void): void;

notifyGuiBuilt(gui: GuiRuntime): void;  // engine-use; runs onGuiBuilt registrations
notifyGuiShown(gui: GuiRuntime): void;   // engine-use; runs onGuiShow after B.gui(id).show()
notifyGuiHidden(gui: GuiRuntime): void; // engine-use; runs onGuiHide after B.gui(id).hide()
```

```ts
// Re-exported from @engine/scripting (see benneScriptFacades.ts / GuiRuntime.ts)
interface BenneScriptGuiOverlayRef {
  control(controlId: string): ControlFacade;
  show: BlockingWithNow<[]>;
  hide: BlockingWithNow<[]>;
}
```

- **`get scene`** — throws unless called synchronously inside an **`onGuiBuilt`** invocation (during **`notifyGuiBuilt`**); prefer **`gui.scene`** argument.
- **`onGuiBuilt`** — runs once per room load when **`RoomScene`** builds the overlay and constructs a fresh **`GuiRuntime`**. Wire control listeners, initial layout/tweens, and first-time sync from JSON or game state.
- **`onGuiShow` / `onGuiHide`** — run when **`B.gui('thatGuiId').show()`** or **`.hide()`** is called from a GUI script or a room script. **`onGuiShow`** receives the live **`GuiRuntime`** for that overlay; use it to re-read **`B.state.getSaveList()`** and repaint list rows on every open (see **[`load-menu.gui.ts`](../src/game/guis/load-menu/load-menu.gui.ts)** / **[`save-menu.gui.ts`](../src/game/guis/save-menu/save-menu.gui.ts)**). Does **not** run when the overlay starts **`visible: true`** at room load — use **`onGuiBuilt`** for that first paint. Does **not** run for engine-internal visibility restores (e.g. dialog hiding HUD overlays).
- **`B.gui('otherOverlayId')`** — resolves controls on **any** built overlay (`*.gui.json`) in the active room. Also available on **room** scripts (see [Room GUIs](#room-guis--bguiid)). **`control`** always returns a facade: the real control, or a safe inert one when the **`id`** is missing/blank, the overlay/runtime is absent, or the control is unknown ( **`text`** assigns are no-ops on the inert facade). On real **`text`** controls, **`ControlFacade.text`** maps to **`BitmapText`**; on real **`textInput`** controls, **`text`** is queued and **`textNow`** applies immediately. **`show()` / `hide()`** toggle the whole overlay visibility (same path as engine overlay visibility, including modal blocker behavior when **`modal: true`**), then invoke the target overlay’s **`onGuiShow`** / **`onGuiHide`** handlers; unknown / unavailable overlays are no-op (DEV warns). On **GUI** scripts both the call and **`.now`** are immediate. On **room** scripts the plain call queues on that room’s interaction tail and **`.now`** is immediate.
- **Verb HUD** — combine **`B.activeVerb`**, **`B.activeInventory`**, **`B.currentHoverDescription`** (or **`composeVerbLineText`** in code); in **`onGuiBuilt`**, call **`B.onVerbContextChanged.on(BENNE_VERB_CONTEXT_CHANGED_EVENT, refresh)`** (see **[`verbs.gui.ts`](../src/game/guis/verbs/verbs.gui.ts)**). Subscriptions reset when the room scene shuts down.
- Hover handlers use **`subscribeImmediate`** (**no interaction-tail wait**).
- Button clicks use **`subscribe`** (queued with other **`B`** work on **this GUI’s** script instance).
- Checkbox check / uncheck use **`subscribe`** the same way; only **player pointer toggles** emit — programmatic **`control(…).checked = …`** updates art only.

[`GuiRuntime` / **`ControlFacade`**](architecture.md) — **`tweenTo`** / **`tweenTo.now`** participate in **`queueInteraction`**.

**`ControlFacade.enabled`** — **`button`** and **`textInput`** controls only. Read/write whether the control accepts pointer input and shows enabled chrome (buttons use disabled sheet/colours at **0.45** alpha when **`false`**). Matches JSON **`enabled`** at build time; runtime updates are immediate (not queued). Does **not** emit **`whenButtonClick`** or text-input change/submit events. On buttons, prefer **`.enabled`** over **`setVisualState('disabled')`** when clicks must be blocked — **`setVisualState`** is visual-only while **`enabled === true`**.

**`ControlFacade.checked`** / **`ControlFacade.disabled`** — **`checkbox`** controls only ( **`disabled`** mirrors JSON **`enabled: false`** ). Read/write the live toggle; does not fire **`whenCheckboxCheck`** / **`whenCheckboxUncheck`**.

**`ControlFacade.value`** / **`ControlFacade.setValue(n)`** — **`slider`** controls only. Read/write the snapped numeric value (**`min`** / **`max`** / **`step`** from **`*.gui.json`**). Programmatic updates reposition the handle and refresh sheet tags; they **do not** emit value-changed events.

**`ControlFacade.whenValueChanged(handler)`** — register at the top level of **`registerGuiScript`** via **`B.gui('<guiId>').control('<sliderId>').whenValueChanged((newVal) => { … })`** (same registration-time pattern as **`whenButtonClick`** — wires through this GUI script’s **`events`** bus before **`RoomScene`** / **`GuiRuntime`** exist). Subscribes with **`subscribeImmediate`** so stepped pointer drag updates run without waiting on the interaction tail. Only **pointer-driven** changes emit (not programmatic **`.value`** / **`.setValue`**). Use **`onGuiBuilt`** for initial **`.value`** from config when sliders must sync on overlay build.

**`textInput` control facade members** — on **`type: "textInput"`** controls:

- **`text`** getter returns current value.
- **`text = "..."`** queues the assignment on the GUI interaction tail.
- **`textNow("...")`** applies immediately (no tail wait).
- **`focused`** getter/setter uses the same queued/immediate split as `text` (queued setter).
- **`focusedNow(true|false)`** applies focus immediately.
- **`whenValueChanged((newValue, oldValue) => { ... })`** subscribes to pointer/keyboard edits.
- **`whenSubmit((finalValue) => { ... })`** subscribes to Enter submit (queued through `subscribe` like button/checkbox click handlers).

**`ControlFacade.setVisualState(state)`** — **`button`** controls only. **`state`** is **`'normal'`** \| **`'hover'`** \| **`'pressed'`** \| **`'disabled'`** (case-insensitive strings accepted). Applies the same Aseprite frame tags (**`states.*`** in **`*.gui.json`**) and label **`textColorStates`** tints the pointer pipeline would (**`'disabled'`** also dims chrome to **`0.45`** alpha like authoring **`enabled: false`**). **`'normal'`** restores full alpha and **releases** manual control so hover / pressed tracking works again; the other modes **suppress** pointer-driven chrome until the next **`'normal'`** call. Does **not** block **`whenButtonClick`** while **`enabled === true`** — use **`.enabled = false`** for functional disable.

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

Tagged **`B.say`** and the rest of **`BenneScriptCore`** (**`wait`**, **`fadeOut`**, **`room`**, **`raw`**, **`B.character(id)`** …) apply as usual. **`DialogBenneScript`** adds **`state`**, **`inventory`**, and the active-room mutators **`B.prop(id)`**, **`B.hotspot(id)`**, **`B.region(id).active`**, and **`B.walkable(id).active`** (same persistence and queue rules as a room script; ids are the current room’s). Region **`whenEnter` / `whenExit`** and room verb sugar stay on **`*.room.ts`**. **`cutscene`** / **`cutscene.now`** are inherited from **`BenneScriptCore`** like all other surfaces.

```ts
B.whenChoice('open-it', () => {
  B.player.say('There.');
  B.prop('cabinet').playAnimation('open');
  B.prop('cabinet').clickable = false;
  B.hotspot('inside').active = true;
});
```

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

### Skipping

Unless `game-config.json` sets `"cutscenesSkippable": false`, pressing **ESC** fast-forwards the cutscene. Every remaining step still runs in order — waits, say lines, walks, fades, camera moves, and video just finish instantly at their final value — so the skipped cutscene leaves the game in the same state it would have reached had it played out.

Pass `{ skippable: false }` to make one cutscene unskippable, the same way `say('…', { clickToSkip: false })` pins one line:

```ts
B.cutscene(() => {
  B.display('The door locks behind you.');
  B.state.setFlag('trapped', true);
}, { skippable: false });

B.whenEnterRoomAfterFade(() => {
  B.player.say('No skipping this intro.');
}, { skippable: false });
```

The same option is accepted by `whenEnterRoom`, `whenEnterRoomAfterFade`, `whenEnterAnyRoom`, `whenEnterAnyRoomAfterFade`, and `whenChoice(optionId, handler, options)`.

For the full reference — automatic activation table, suppressed-input matrix, per-step skip behavior, walk promise contract, `busyAnimation` cursor config, and implementation modules — see [architecture.md §7 → Cutscene mode](architecture.md#cutscene-mode).

---

## Common patterns

**Cutscene-style ordering** — Use the automatic wrapping from `whenEnterRoomAfterFade` / `whenChoice`, or wrap explicit sequences with `B.cutscene(…)`. Use blocking **`walkTo`**, **`wait`**, **`player.say`**, **`fadeOut`** / **`fadeIn`**, **`B.camera.focus`** / **`zoomTo`** / **`reset`** inside; reserve **`.now`** for overlapping effects you intentionally do not wait for. **`B.camera.shake`** is fire-and-forget and can overlap queued steps.

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
- Per-frame hook: **`UpdateContext`** (`src/engine/scripting/types.ts`).
- Give-on-prop augmentation: **`GivePropInteractPayload`** (`benneScriptPayloads.ts`).

---

## Source files

| Module | Role |
|--------|------|
| [`BenneScriptCore.ts`](../src/engine/scripting/BenneScriptCore.ts) | **`BlockingWithNow`**, queue, **`say`/`wait`/fades/clicks/active selection**, **`sound`**, **`camera`**, **`speechSettings`**, **`dialogSettings`**, **`onSpeechSettingsChanged`**, **`events`/`raw`**, inventory-on-target **`subscribe*`** helpers, **`cutscene`** / **`cutscene.now`**, **`onUpdate`** (room/global subclasses) |
| [`benneScriptSpeechSettingsApi.ts`](../src/engine/scripting/benneScriptSpeechSettingsApi.ts) | **`createBenneScriptSpeechSettingsFacade`** (**`B.speechSettings`**) |
| [`benneScriptDialogSettingsApi.ts`](../src/engine/scripting/benneScriptDialogSettingsApi.ts) | **`createBenneScriptDialogSettingsFacade`** (**`B.dialogSettings`**) |
| [`benneSpeechSettingsScriptSurface.ts`](../src/engine/scripting/benneSpeechSettingsScriptSurface.ts) | **`BENNE_SPEECH_SETTINGS_CHANGED_EVENT`**, change emitter |
| [`speechGameState.ts`](../src/engine/dialog/speechGameState.ts) | **`speech:*`** variable keys, read/write, snapshot merge |
| [`dialogGameState.ts`](../src/engine/dialog/dialogGameState.ts) | **`dialog:*`** variable keys (choice viewport height), read/write, snapshot merge |
| [`benneScriptOnUpdateRegistry.ts`](../src/engine/scripting/benneScriptOnUpdateRegistry.ts) | Global **`B.onUpdate`** handler list + **`runGlobalBenneScriptOnUpdateHandlers`**, **`clearGlobalBenneScriptOnUpdateHandlers`** (game **`DESTROY`**) |
| [`benneScriptSoundApi.ts`](../src/engine/scripting/benneScriptSoundApi.ts) | **`createBenneScriptSoundFacade`** (**`B.sound`**) |
| [`benneScriptVideoApi.ts`](../src/engine/scripting/benneScriptVideoApi.ts) | **`createBenneScriptVideoFacade`** (**`B.video`**) |
| [`benneScriptCameraApi.ts`](../src/engine/scripting/benneScriptCameraApi.ts) | **`createBenneScriptCameraFacade`** (**`B.camera`**) |
| [`SoundManager.ts`](../src/engine/sound/SoundManager.ts) | **`Phaser.Game#sound`** playback, SFX tracking, music slot, lifecycle |
| [`BenneScript.ts`](../src/engine/scripting/BenneScript.ts) | Room **`B`**, verb sugar, **`prop`/`character`/`player`/`region`/`walkable`**, **`state`/`inventory`/`dialog`**, **`gui`** (queued **`show`/`hide`**) |
| [`CharacterBenneScript.ts`](../src/engine/scripting/CharacterBenneScript.ts) | Character facade |
| [`InventoryBenneScript.ts`](../src/engine/scripting/InventoryBenneScript.ts) | Inventory row façade |
| [`GlobalBenneScript.ts`](../src/engine/scripting/GlobalBenneScript.ts) | Global fallbacks + any-room hooks |
| [`GuiBenneScript.ts`](../src/engine/scripting/GuiBenneScript.ts) | GUI buttons, **`onGuiBuilt`**, **`onGuiShow`**, **`onGuiHide`**, cross-overlay control access (**`B.gui`**), overlay **`show`/`hide`** (immediate), hover (**`subscribeImmediate`**), null clock |
| [`benneScriptGuiApi.ts`](../src/engine/scripting/benneScriptGuiApi.ts) | Shared **`B.gui(id)`** accessor (room scripts queue **`show`/`hide`**; GUI scripts stay immediate) |
| [`DialogBenneScript.ts`](../src/engine/scripting/DialogBenneScript.ts) | Dialog session **`B`**, **`whenChoice`**, **`openDialogSessionForId`**, **`B.prop` / `B.hotspot` / `B.region().active` / `B.walkable().active`** |
| [`benneScriptRoomEntityApi.ts`](../src/engine/scripting/benneScriptRoomEntityApi.ts) | Shared **`B.prop`**, **`B.hotspot`**, **`B.region().active`**, and **`B.walkable().active`** facades (room scripts and dialog sessions) |
| [`benneScriptFacades.ts`](../src/engine/scripting/benneScriptFacades.ts) | **`BenneScript*Facade`** interfaces |
| [`benneScriptGameStateApi.ts`](../src/engine/scripting/benneScriptGameStateApi.ts) | **`B.state`**, **`B.inventory`** factories |
| [`benneScriptRoomApi.ts`](../src/engine/scripting/benneScriptRoomApi.ts) | **`B.room`** |
| [`snapshotFlushHooks.ts`](../src/engine/gameState/snapshotFlushHooks.ts) | **`registerSnapshotFlushHook`** / **`runSnapshotFlushHooks`** (powers **`B.state.flush`**, run inside **`getSnapshot`** and **`prepareForLeave`**) |
| [`benneAnimationRuntime.ts`](../src/engine/benneAnimationRuntime.ts) | Variable-key + read/write helpers for prop/character/hotspot animation, visibility, alpha, **description**, **and position** |
| [`types.ts`](../src/engine/scripting/types.ts) | **`RoomScriptContext`**, **`CharacterScriptContext`**, **`UpdateContext`**, etc. |
