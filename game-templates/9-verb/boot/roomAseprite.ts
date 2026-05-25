/** Loader / animation cache key for a room’s prop spritesheet (`images/rooms/<roomId>/`). */
export function getRoomAsepriteTextureKey(roomId: string): string {
  return `roomAseprite:${roomId}`;
}

export function getRoomAsepriteAssetPaths(roomId: string): { png: string; json: string } {
  const base = `images/rooms/${roomId}/${roomId}`;
  return { png: `${base}.png`, json: `${base}.json` };
}
