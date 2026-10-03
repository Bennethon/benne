import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import type { EventBus } from '../../src/engine/events/EventBus';
import { dispatchVerbInteraction } from '../../src/engine/verbs/dispatchVerb';
import * as events from '../../src/engine/events/verbInteractionEvents';
vi.mock('../../src/engine/ConfigManager', () => ({ getGameSettings: () => ({ defaultFallbackLine: 'No.' }) }));
vi.mock('../../src/engine/scenes/interruptPlayerWalkForVerbInteraction', () => ({ interruptPlayerWalkForVerbInteraction: vi.fn() }));
const target = { type: 'character', characterId: 'friend', instanceId: 'friend1', roomId: 'hall', talkPoint: { x: 12, y: 13 } } as const;
const routes = [events.roomObjectVerbEventId(target, 'look'), events.characterVerbEventId('friend', 'look'), events.roomObjectVerbFallbackEventId(target), events.characterVerbFallbackEventId('friend'), events.globalVerbHandlerEventId('look'), events.VERB_GLOBAL_FALLBACK_EVENT, events.VERB_UNHANDLED_EVENT];
it.each(routes.map((route, index) => [route, index] as const))('dispatch chooses only %s when higher priorities are absent', (_route, index) => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const bus = new EventEmitter() as unknown as EventBus;
  const handlers = routes.map(() => vi.fn());
  for (let i = index; i < routes.length; i++) bus.on(routes[i]!, handlers[i]!);
  dispatchVerbInteraction(bus, 'look', { onVerbFallback: true }, target);
  expect(handlers[index]).toHaveBeenCalledOnce();
  for (let i = index + 1; i < handlers.length; i++) expect(handlers[i]).not.toHaveBeenCalled();
  if (index < routes.length - 1) expect(handlers[index]).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'friend', roomId: 'hall', verbId: 'look', talkPoint: { x: 12, y: 13 } }));
});
it('disabled object fallback yields to global verb', () => {
  const bus = new EventEmitter() as unknown as EventBus;
  const fallback = vi.fn(), global = vi.fn();
  bus.on(routes[2]!, fallback); bus.on(routes[4]!, global);
  dispatchVerbInteraction(bus, 'look', { onVerbFallback: false }, target);
  expect(fallback).not.toHaveBeenCalled(); expect(global).toHaveBeenCalledOnce();
});
