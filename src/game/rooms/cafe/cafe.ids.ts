/**
 * The café's handles. HAND-WRITTEN for the BenneScript Phase 1 spike; Phase 3 generates it from
 * `cafe.room.json` (docs/bennescript-ergonomics-refactor.md §7). Names follow §7.2: camelCase,
 * with the `cafe-hotspot-` prefix stripped.
 */
import { CharacterHandle, HotspotHandle, PropHandle } from '@benne/script';
import { rooms, withGameVerbs } from '@game';

export const room = rooms.cafe;

// Props
export const dishes = withGameVerbs(new PropHandle('cafe', 'dishes'));
export const relay = withGameVerbs(new PropHandle('cafe', 'relay'));

// Hotspots
export const window = withGameVerbs(new HotspotHandle('cafe', 'cafe-hotspot-window'));
export const coffeemaker = withGameVerbs(new HotspotHandle('cafe', 'cafe-hotspot-coffeemaker'));
export const door = withGameVerbs(new HotspotHandle('cafe', 'cafe-hotspot-door'));
export const menu = withGameVerbs(new HotspotHandle('cafe', 'menu'));
export const cleaningStuff = withGameVerbs(new HotspotHandle('cafe', 'cleaning-stuff'));

// Characters
export const hank = withGameVerbs(new CharacterHandle('cafe', 'hank'));
export const barista = withGameVerbs(new CharacterHandle('cafe', 'barista'));
export const customer = withGameVerbs(new CharacterHandle('cafe', 'customer'));
