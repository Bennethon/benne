/**
 * AUTO-GENERATED — do not edit manually.
 *
 * Regenerate: npm run generate:game-ids
 * Source: src/game/ (rooms, characters, dialogs, guis, inventory, game-config.json, assets/videos)
 */

/** Preserves autocomplete for known ids while still accepting any string at compile time. */
type LooseString<T extends string = string> = T | (string & {});

/** Room definition ids from src/game/rooms/<id>/<id>.room.json (folder name). */
export type RoomId = LooseString<'apartment' | 'outside'>;

/** Character definition ids from src/game/characters/<id>/<id>.character.json. */
export type CharacterId = LooseString<'hank' | 'henry' | 'penny'>;

/** Dialog topic ids from src/game/dialogs/<id>/<id>.dialog.json. */
export type DialogId = LooseString<'chatwithpenny'>;

/** GUI overlay ids from src/game/guis/<id>/<id>.gui.json. */
export type GuiId = LooseString<'dialog' | 'display-text' | 'game-menu' | 'hover-text' | 'inventoryBar' | 'load-menu' | 'menu-bar' | 'save-menu' | 'settings-menu' | 'speaking-text'>;

/** Inventory item ids from src/game/inventory/<id>/<id>.inventory.json. */
export type InventoryItemId = LooseString<'Bread' | 'Broom' | 'Key' | 'Knife' | 'Lantern' | 'PB' | 'Sammich'>;

/** Prop ids from all *.room.json props[] — global namespace (first match wins at runtime). */
export type PropId = LooseString<'BG' | 'Bread' | 'Couch' | 'Door' | 'Fan' | 'FountainOff' | 'FountainOn' | 'Knife' | 'LeverPulled' | 'PeanutButter' | 'Rock' | 'RockMoved' | 'Sky' | 'Table' | 'Trees'>;

/** Hotspot ids from all *.room.json hotspots[]. */
export type HotspotId = LooseString<'door'>;

/** Region ids from all *.room.json regions[]. */
export type RegionId = LooseString<'distance'>;

/** Walkable polygon ids from all *.room.json walkable.polygons[]. */
export type WalkableId = LooseString<'walk-1'>;

/** Named room point ids from all *.room.json points[]. */
export type PointId = LooseString<'enter-from-door' | 'henry-fountain'>;

/** Dialog option ids from all *.dialog.json options[].id. */
export type DialogOptionId = LooseString<'bye' | 'door' | 'greeting'>;

/** Verb ids from src/game/game-config.json verbs[] (or engine defaults when omitted). */
export type GameVerbId = LooseString<'look' | 'use'>;

/** Video stem ids from src/game/assets/videos/<stem>.{mp4,webm} (basename without extension). */
export type VideoId = LooseString;

/** Prop, hotspot, or spawned character id for room verb handlers (whenLookAt, whenVerb, whenInventoryUsedOn). */
export type VerbTargetId = PropId | HotspotId | CharacterId;

/** Walk / teleport string target: prop → hotspot → character → room point (see RoomScene.resolveMovementTarget). */
export type ResolvableTargetId = PropId | HotspotId | CharacterId | PointId;
