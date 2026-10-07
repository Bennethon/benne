import { expect, it } from 'vitest';
import { targetLabel } from '../../src/engine/verbs/targetLabel';

it.each([
  ['Old mug', 'Mug', 'mug', 'Old mug'],
  ['  Old mug  ', 'Mug', 'mug', 'Old mug'],
  ['', 'Mug', 'mug', 'Mug'],
  ['   ', undefined, 'mug', 'mug'],
  [null, '  ', 'mug', 'mug'],
  [undefined, null, 'mug', 'mug'],
] as const)('description %j, name %j, id %j → %j', (description, name, id, expected) => {
  expect(targetLabel(description, name, id)).toBe(expected);
});
