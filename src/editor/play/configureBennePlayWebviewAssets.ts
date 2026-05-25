import { setBenneWebviewPlayAssetBase } from '../../game/boot/resolveGameAssetUrl';

const g = globalThis as { __BENNE_PLAY_MEDIA_BASE__?: string };
const raw = typeof g.__BENNE_PLAY_MEDIA_BASE__ === 'string' ? g.__BENNE_PLAY_MEDIA_BASE__ : undefined;
if (typeof raw === 'string' && raw.trim().length > 0) {
  setBenneWebviewPlayAssetBase(raw);
}
