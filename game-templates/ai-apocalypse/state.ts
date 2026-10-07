/**
 * The game's flags and variables, with defaults (docs/bennescript-ergonomics-refactor.md §4.7).
 * `@game` re-exports `flags` and `vars` from here.
 *
 * Flags whose old key had spaces keep it as their `saveKey`, so the baseline playthrough (which
 * reads flags by key) passes unchanged.
 */
import { defineFlags, defineVars, flag } from '@benne/script';

export const flags = defineFlags({
  // 2027 lab
  firstBanana: false,
  scientistRequest: false,

  // Hallway: Jensen
  jensenBlockingDoor: false,
  jensenCrying: false,
  spokeWithJensenFirstTime: false,
  gotMission: flag(false, { saveKey: 'got mission' }),
  leftMitFirstTime: flag(false, { saveKey: 'left MIT first time' }),

  // Plaza: the time machine parts
  gotLens: false,
  gotRelay: false,
  gotRegulator: false,
  talkedWithBottieOnce: false,

  // Gallery
  canCleanPaint: false,
  canTakeLens: false,

  // Café
  canWork: false,
  tookOrder: false,
  deliveredOrder: false,

  // Club
  askedAboutBattery: false,
  batteryClean: false,
  batteryFixed: false,
  askedAboutWrench: false,

  // Finale
  allDone: flag(false, { saveKey: 'all done' }),
  escapedCloset: flag(false, { saveKey: 'escaped closet' }),
  leftClosetAgain: flag(false, { saveKey: 'left closet again' }),
});

export const vars = defineVars({});
