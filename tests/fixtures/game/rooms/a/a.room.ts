import { background, game, playFrom, saves, wait } from '@benne/script';
import { flags, rooms, vars } from '@game';
import { room, count, door, load, reset, save } from './a.ids';

room.onEnter(() => { vars.entered += 1 })
room.onLoaded(() => { flags.loaded = true })
door.onUse(() => rooms.b.goTo())
// Saving is refused while an interaction runs (decision 2): save once this click's handler has ended.
save.onUse(() => {
  background(() => {
    wait(0)
    saves.save('checkpoint')
  })
})
load.onUse(() => saves.load('checkpoint'))
count.onUse(() => { vars.count += 1 })
count.onLook(() => { flags.looked = true })
reset.onUse(() => game.newGame(rooms.a))
playFrom('seeded', () => { flags.seeded = true })
