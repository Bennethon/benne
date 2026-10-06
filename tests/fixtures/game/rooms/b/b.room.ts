import { saves } from '@benne/script';
import { flags, rooms, vars } from '@game';
import { room, door, load } from './b.ids';

room.onEnter(() => { vars.entered += 1 })
room.onLoaded(() => { flags.loaded = true })
door.onUse(() => rooms.a.goTo())
load.onUse(() => saves.load(0))
