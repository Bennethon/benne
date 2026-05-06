# Bennescript API Reference

> Last updated: 2026-05-05 — generated from source (`src/engine/scripting/*.ts`)

For architecture, dispatch order, persistence keys, and editor workflows, see [architecture.md §7 Scripting / interaction system (Bennescript)](architecture.md#7-scripting--interaction-system-bennescript), [§3 Game state → Bennescript](architecture.md#game-state-v1), [§3 Inventory → Bennescript](architecture.md#inventory-system), [§3 Dialog system → Bennescript](architecture.md#dialog-system-choice-topics), [§7 → GUI runtime (`GuiRuntime`, `B.onGuiBuilt`)](architecture.md#gui-behavior-runtime-guiruntime-bguitbuilt), and the **Blocking interaction queue** / API tables in §7.

---

## How Bennescript works

**Registration** — Scripts register via side-effect imports (no callable `register*Script(events)` loader):

- **`registerRoomScript(({ B, events, roomId, roomScene }) => …)`** — [`registerRoomScript.ts`](../src/engine/scripting/registerRoomScript.ts); runs once per room load.
- **`registerCharacterScript('id', ({ B, … }) => …)`** — only when that character is spawned in the active room.
- **`registerInventoryScript('id', ({ B, … }) => …)`** — runs each room load; engine calls **`B.ensureDefaultInventoryUseAndGiveActivationAfterRegister()`** after the body so **use**/**give** rows arm **active inventory** even with an empty script file.
- **`registerGlobalScript(({ B, game, events }) => …)`** — after **`createBenneGame`** via **`wireBenneGlobalScripts`**.
- **`registerGuiScript('guiId', ({ B, events, guiId }) => …)`** — at content registration; overlay built per room.
- **`registerDialogScript('dialogId', ({ B, events, dialogId, game }) => …)`** — runs when **`openDialogSessionForId`** opens that dialog (after **`B.dialog(id).start()`** / **`.start.now()`**).

**Interaction queue** — Verb / button handlers registered through **`subscribe`** run inside an **`async`** wrapper that **`beginInteraction()`** (resets the tail), runs your **synchronous** body, then **`await endInteraction()`** on an internal **`interactionTail`** chain. Methods that represent time or ordering (walk, **`say`**, **`wait`**, queued animation setters, **`B.room.changeTo`**, **`B.inventory.add` / `B.inventory.remove`**, etc.) append **lazy** `() => Promise<…>` factories so the *next* step does not start until the previous promise settles. See [architecture.md — Important implementation detail (lazy factories)](architecture.md#7-scripting--interaction-system-bennescript).

**`BlockingWithNow` pattern** — Many APIs are **`(…args) => void`** plus **`.now(…args)`** with the same parameters. The blocking form **queues** on **`interactionTail`**; **`.now`** performs the same work **without** extending the tail, so later lines in your handler still run in source order but do not wait for that action.

**Payload stack for clicked targets** — While a **`subscribe`** / **`subscribeAfterInteractionTail`** handler runs, **`pushVerbWalkContext(payload)`** / **`popVerbWalkContext()`** bracket the run so **`B.walkToClicked`**, **`B.faceClicked`**, and **`B.player.walkToClicked`**, **`B.player.faceClicked`** know the clicked prop/hotspot/character target. Outside that context or without a world target (e.g. pure inventory-row verb), behavior is skipped and DEV may **`console.warn`** once.

**`subscribeImmediate`** — GUI **`B.whenMouseEnter`** / **`B.whenMouseLeave`** use this: handler runs synchronously and does **not** wait on **`interactionTail`** (avoids HUD hover starving behind **`say`/tween** queues).

**Disposal** — **`BenneScript.dispose()`** runs registered cleanups (**`events.off`**, etc.). The engine calls it on **`RoomScene`** shutdown for room/character instances and when a dialog session ends for **`DialogBenneScript`** (see [architecture.md — Runtime wiring](architecture.md#7-scripting--interaction-system-bennescript)).

**`events` field** — Every **`BenneScriptCore`** subclass exposes **`readonly events`** (**`Phaser.Events.EventEmitter`**) backing **`B.raw`**.

---

## Context matrix (what exists on each `B`)

| Surface | Room | Character | Inventory | Global | GUI | Dialog (session) |
|--------|:----:|:---------:|:---------:|:------:|:---:|:----------------:|
| Core queue, **`raw`**, **`wait`**, **`say`**, **`walkToClicked`**, **`faceClicked`**, fades, **`room`**, active verb/inventory helpers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.state`** / **`B.inventory`** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **`B.dialog(id)`** | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ |
| **`B.player`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.character(id)`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`B.prop(id)`** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
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
| **`room`** | See [`BenneScriptRoomFacade`](architecture.md) | **`current`**, **`last`**, **`changeTo`**, **`changeTo.now`**, **`changeToNow`**. | **`changeTo`** queued; **`.now` / `changeToNow`** via orchestrator **`changeTo(roomId, true)`** |

**`BenneScriptRoomFacade`** (**`bindRoomFacadeForBenneScriptCore`** / [`benneScriptRoomApi.ts`](../src/engine/scripting/benneScriptRoomApi.ts)):

```ts
interface BenneScriptRoomFacade {
  readonly current: string;
  readonly last: string | null;
  changeTo: BlockingWithNow<[roomId: string]>;
  changeToNow(roomId: string): void;
}
```

- **`current` / `last`** mirror **`GameStateManager`** (same idea as **`B.state.getCurrentRoom`** / **`getLastRoom`**).
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

---

## `B.player` (**`BenneScriptPlayerFacade`**)

Constructed from active **`RoomScene`** (global/dialog resolve **`SCENE_ROOM` on each call**). DEV warns once if **`RoomScene`** missing for movement/speech.

| Member | Signature | Description | Blocking |
|--------|-----------|-------------|--------|
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

Defined on **`BenneScriptCore`**: same movement/teleport/play/stop **`say`** / **`face`** pattern as **`B.player`**, routed to **`walkCharacterTo`**, **`moveCharacterToNow`**, **`faceCharacterScriptDirection`**, character animation scripting APIs (**`NPC`** — no **`walkToClicked`** on facade; use top-level **`B.walkToClicked`** / **`B.player.*`**).

**Room resolution:** Each call uses the same **`getPlayerWalkRoomScene`** hook as **`B.player`** — room / character / inventory scripts pass a stable **`() => this.roomScene`** closure; dialog / global / GUI pass **`() => game.scene.getScene(SCENE_ROOM)`**. When there is **no** active **`RoomScene`**, calls no-op and DEV **`console.warn`** once (same spirit as **`B.player`** without a room).

---

## `B.prop(propId)` (**`BenneScriptPropFacade`**)

**Room scripts only.**

| Member | Description | Blocking |
|--------|-------------|--------|
| **`hide` / `show`** | Script visibility overrides; **`BlockingWithNow<[]>`** (queue vs **`.now`**). | Queued vs **`.now`** |
| **`visible`** get/set | Setter queues like **`animation`**; **`visibleNow(v)`** applies immediately. | Setter queued |
| **`description`** get/set | | Sync |
| **`animation`** get/set | Base prop tag persisted; setter **queued**. | Setter queued |
| **`animationNow(tag)`** | Immediate persist + sprite. | Immediate |
| **`playAnimation`** | **`BlockingWithNow<[string]>`** one-shot → restore base tag. | Queued vs **`.now`** |

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

Registry from **`tryGetGlobalRoomHookRegistry()`** — if missing, DEV warns and handlers are **not** wired.

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

Enter-room handlers (`whenEnterRoom`, `whenEnterRoomAfterFade`, and their `Any` variants) and `whenChoice` handlers are **automatically** wrapped in a cutscene block. For other sequences, use `B.cutscene(callback)` (or `.now`), available on every Bennescript surface:

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
- Give-on-prop augmentation: **`GivePropInteractPayload`** (`benneScriptPayloads.ts`).

---

## Source files

| Module | Role |
|--------|------|
| [`BenneScriptCore.ts`](../src/engine/scripting/BenneScriptCore.ts) | **`BlockingWithNow`**, queue, **`say`/`wait`/fades/clicks/active selection**, **`events`/`raw`**, inventory-on-target **`subscribe*`** helpers, **`cutscene`** / **`cutscene.now`** |
| [`BenneScript.ts`](../src/engine/scripting/BenneScript.ts) | Room **`B`**, verb sugar, **`prop`/`character`/`player`**, **`state`/`inventory`/`dialog`** |
| [`CharacterBenneScript.ts`](../src/engine/scripting/CharacterBenneScript.ts) | Character facade |
| [`InventoryBenneScript.ts`](../src/engine/scripting/InventoryBenneScript.ts) | Inventory row façade |
| [`GlobalBenneScript.ts`](../src/engine/scripting/GlobalBenneScript.ts) | Global fallbacks + any-room hooks |
| [`GuiBenneScript.ts`](../src/engine/scripting/GuiBenneScript.ts) | GUI buttons, **`onGuiBuilt`**, hover (**`subscribeImmediate`**), null clock |
| [`DialogBenneScript.ts`](../src/engine/scripting/DialogBenneScript.ts) | Dialog session **`B`**, **`whenChoice`**, **`openDialogSessionForId`** |
| [`benneScriptFacades.ts`](../src/engine/scripting/benneScriptFacades.ts) | **`BenneScript*Facade`** interfaces |
| [`benneScriptGameStateApi.ts`](../src/engine/scripting/benneScriptGameStateApi.ts) | **`B.state`**, **`B.inventory`** factories |
| [`benneScriptRoomApi.ts`](../src/engine/scripting/benneScriptRoomApi.ts) | **`B.room`** |
| [`types.ts`](../src/engine/scripting/types.ts) | **`RoomScriptContext`**, **`CharacterScriptContext`**, etc. |
