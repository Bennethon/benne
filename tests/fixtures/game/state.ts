import { defineFlags, defineVars } from '@benne/script';

export const flags = defineFlags({
  loaded: false,
  looked: false,
  seeded: false,
});

export const vars = defineVars({
  entered: 0,
  count: 0,
});
