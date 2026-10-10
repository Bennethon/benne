import { afterEach, expect, it, vi } from 'vitest';
import { beginActionSentence, clearActionSentence, getActionSentence } from '../../src/engine/verbs/actionSentence';
import { beginInteractionActivity } from '../../src/engine/interaction/interactionActivity';
import { BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT, getBenneVerbContextChangedEmitter } from '../../src/engine/verbs/verbContext';
vi.mock('../../src/engine/ConfigManager', () => ({
  getGameSettings: () => ({ verbs: [{ id: 'look', label: 'Look at' }, { id: 'use', label: 'Use', preposition: 'with' }] }),
}));
vi.mock('../../src/engine/verbs/targetLabel', () => ({ inventoryItemLabel: () => 'Coffee' }));
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => clearActionSentence());

it('a click that starts no handler ends its sentence after the dispatch', async () => {
  const changed = vi.fn();
  getBenneVerbContextChangedEmitter().on(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT, changed);
  beginActionSentence('look', 'Door');
  expect(getActionSentence()).toBe('Look at Door');
  await macrotask();
  expect(getActionSentence()).toBeNull();
  expect(changed).toHaveBeenCalledTimes(2);
  getBenneVerbContextChangedEmitter().off(BENNE_VERB_CONTEXT_CHANGED_PERSISTENT_EVENT, changed);
});

it('the sentence lasts until the handler it started finishes', async () => {
  beginActionSentence('use', 'Coffee maker', 'coffee');
  const activity = beginInteractionActivity();
  await macrotask();
  expect(getActionSentence()).toBe('Use Coffee with Coffee maker');
  activity.end();
  await macrotask();
  expect(getActionSentence()).toBeNull();
});

it('unhandled() handing the click to the next handler keeps the sentence', async () => {
  beginActionSentence('use', 'Door');
  const first = beginInteractionActivity();
  first.end();
  let second: ReturnType<typeof beginInteractionActivity> | undefined;
  void Promise.resolve().then(() => (second = beginInteractionActivity()));
  await macrotask();
  expect(getActionSentence()).toBe('Use Door');
  second!.end();
  await macrotask();
  expect(getActionSentence()).toBeNull();
});

it('GUI handlers do not hold the sentence', async () => {
  beginActionSentence('look', 'Door');
  const gui = beginInteractionActivity({ gameplay: false });
  await macrotask();
  expect(getActionSentence()).toBeNull();
  gui.end();
});
