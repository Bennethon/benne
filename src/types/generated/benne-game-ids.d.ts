/**
 * AUTO-GENERATED — do not edit manually.
 *
 * Regenerate: npm run generate:game-ids
 * Source: src/game/ (rooms, characters, dialogs, guis, inventory, game-config.json, assets/videos)
 */

/** Preserves autocomplete for known ids while still accepting any string at compile time. */
type LooseString<T extends string = string> = T | (string & {});

/** Room definition ids from src/game/rooms/<id>/<id>.room.json (folder name). */
export type RoomId = LooseString<'cafe' | 'closet' | 'club' | 'credits' | 'gallery' | 'hallway' | 'hallway27' | 'lab' | 'lab27' | 'opening' | 'plaza' | 'title'>;

/** Character definition ids from src/game/characters/<id>/<id>.character.json. */
export type CharacterId = LooseString<'barista' | 'botti3' | 'botti3-27' | 'botti3-disembodied' | 'curator' | 'customer' | 'driver' | 'hank' | 'jensen' | 'scientists'>;

/** Dialog topic ids from src/game/dialogs/<id>/<id>.dialog.json. */
export type DialogId = LooseString<'barista' | 'botti3' | 'botti3-ai-future' | 'botti3-local-area' | 'curator' | 'customer' | 'driver' | 'jensen-in-hallway' | 'jensen-in-plaza'>;

/** GUI overlay ids from src/game/guis/<id>/<id>.gui.json. */
export type GuiId = LooseString<'credits' | 'dialog' | 'display-text' | 'game-menu' | 'load-menu' | 'opening-text' | 'save-menu' | 'settings-menu' | 'speaking-text' | 'title-buttons' | 'verbs'>;

/** Inventory item ids from src/game/inventory/<id>/<id>.inventory.json. */
export type InventoryItemId = LooseString<'antenna' | 'coffee' | 'coin' | 'lens' | 'magnet' | 'magnetStick' | 'mop' | 'regulator' | 'relay' | 'soda' | 'timeonium' | 'wrench'>;

/** Prop ids from all *.room.json props[] — global namespace (first match wins at runtime). */
export type PropId = LooseString<'antenna' | 'banana' | 'bg' | 'botti3' | 'car' | 'chamberMask' | 'closetMask' | 'closetOpen' | 'cord' | 'counter' | 'crash' | 'dishes' | 'doorOpen' | 'electricalBox' | 'filingCabinet' | 'mop' | 'mopping' | 'regulator' | 'relay' | 'slip' | 'smack' | 'statue' | 'table' | 'time-travel-final' | 'timeonium' | 'titles' | 'travelHome'>;

/** Hotspot ids from all *.room.json hotspots[]. */
export type HotspotId = LooseString<'art-1' | 'art-2' | 'bulliten-board' | 'cafe-hotspot-coffeemaker' | 'cafe-hotspot-door' | 'cafe-hotspot-window' | 'cleanBot' | 'cleaning-stuff' | 'closet-door' | 'club-hotspot-battery' | 'club-hotspot-toolChest' | 'door' | 'door-lab' | 'door-outside' | 'door-to-lab' | 'exit' | 'exit-door' | 'gallery-hotspot-canvas' | 'gallery-hotspot-paint-spill' | 'hallway-hotspot-bulliten-board' | 'hallway-hotspot-exit' | 'lab27-hotspot-door' | 'menu' | 'outside' | 'plaza-hotspot-cafe' | 'plaza-hotspot-club' | 'plaza-hotspot-gallery' | 'plaza-hotspot-mit' | 'shelves' | 'window'>;

/** Region ids from all *.room.json regions[]. */
export type RegionId = LooseString<'bananaGuard' | 'cant-walk' | 'club-region-leave' | 'darkness' | 'distance' | 'distance-cafe' | 'distance2' | 'distance3' | 'enter-closet' | 'gallery-region-leave' | 'jensen-move-left' | 'jensen-move-right' | 'plaza-region-cafe-exit' | 'plaza-region-gallery-exit' | 'plaza-region-garage-exit' | 'plaza-region-mit-exit'>;

/** Walkable polygon ids from all *.room.json walkable.polygons[]. */
export type WalkableId = LooseString<'cafe-walk' | 'closet-walk' | 'club-walk' | 'gallery-walk' | 'hallway-walk' | 'hallway27-walk' | 'lab-walk' | 'lab27-walk' | 'plaza-walk'>;

/** Named room point ids from all *.room.json points[]. */
export type PointId = LooseString<'camera-pan' | 'club-point-standBack' | 'club-point-walkout' | 'enter-from-plaza' | 'gallery-point-enter' | 'hallway-point-1' | 'hallway-point-2' | 'lab-point-1' | 'lab-point-2' | 'lab-point-finalie-start' | 'lab-point-jensen' | 'lab-point-time-chamber' | 'lab27-point-ending-startWalk' | 'lab27-point-ending-stopWalk' | 'lab27-point-ending-zoom' | 'leave-closet' | 'plaza-point-enter-from-cafe' | 'plaza-point-enter-from-gallery' | 'plaza-point-enter-from-garage' | 'plaza-point-enter-from-hall' | 'plaza-point-enter-from-hall-jensen' | 'plaza-point-first-visit' | 'plaza-point-first-visit-jensen' | 'plaza-point-jensen-right-side' | 'walk-back' | 'walk-cord' | 'walk-in' | 'walk-to-closet'>;

/** Dialog option ids from all *.dialog.json options[].id. */
export type DialogOptionId = LooseString<'ai future' | 'AI problem' | 'around here' | 'ask about lens' | 'bye' | 'cafe' | 'can have lens' | 'cant drive' | 'club' | 'crime' | 'dirty dishes' | 'drive' | 'fix battery' | 'found all' | 'found lens' | 'found regulator' | 'found relay' | 'gallery' | 'greet curator' | 'greet driver' | 'greeting' | 'greeting barista' | 'helped' | 'high tech thing' | 'how long' | 'hows it going curator' | 'its the future' | 'jobs' | 'nevermind' | 'nice car' | 'nice place' | 'out of the way' | 'paint spill' | 'smoke' | 'take order' | 'thats all' | 'time scientist' | 'waiting customer' | 'what about AI' | 'what are you' | 'what do we need' | 'what is a time scientist' | 'Whatcha lookin at' | 'why car broke' | 'why remember' | 'why unplugged' | 'wrench'>;

/** Verb ids from src/game/game-config.json verbs[] (or engine defaults when omitted). */
export type GameVerbId = LooseString<'clean' | 'look' | 'move' | 'take' | 'talkTo' | 'use'>;

/** Video stem ids from src/game/assets/videos/<stem>.{mp4,webm} (basename without extension). */
export type VideoId = LooseString;

/** Prop, hotspot, or spawned character id for room verb handlers (whenLookAt, whenVerb, whenInventoryUsedOn). */
export type VerbTargetId = PropId | HotspotId | CharacterId;

/** Walk / teleport string target: prop → hotspot → character → room point (see RoomScene.resolveMovementTarget). */
export type ResolvableTargetId = PropId | HotspotId | CharacterId | PointId;
