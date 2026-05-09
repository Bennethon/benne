/** @internal — stable id for {@link import('../events/EventBus.js').gameEvents} region-enter subscriptions. */
export function roomRegionEnterEventId(roomId: string, regionId: string): string {
  return `benne:room:${String(roomId)}:region:${String(regionId)}:enter`;
}

/** @internal — stable id for region-exit subscriptions. */
export function roomRegionExitEventId(roomId: string, regionId: string): string {
  return `benne:room:${String(roomId)}:region:${String(regionId)}:exit`;
}
