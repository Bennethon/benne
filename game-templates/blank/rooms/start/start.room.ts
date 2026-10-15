import { room } from './start.ids';

// Start: the room the game opens in (`startingRoomId` in game-config.json). It is empty: add a
// background and props in the room preview, and handlers for them here, for example:
//
//   door.onUse(() => {
//     walkToClicked()
//     rooms.hallway.goTo()
//   })
//
// Things in this room are plain names (`door`, `points.x`, `regions.x`) imported from
// './start.ids'; everything else comes from '@game'. Auto-import adds the import lines as you type.

room.onEnter(() => {
  // Runs before the room fades in: set up positions, visibility and flags here.
  // Music, entrances and cutscenes go in room.onEnterAfterFade(() => { … }).
})
