import * as Phaser from 'phaser';

/**
 * Phaser's boot sequence appends the DOM container first, then the canvas. In HTML paint order the
 * later sibling (canvas) covers the DOM layer, so {@link Phaser.GameObjects.DOMElement} GUI text is
 * invisible and pointer routing can break in subtle ways. Moving the container to the end of the
 * parent puts DOM **above** the WebGL canvas; the container keeps Phaser's default
 * `pointer-events: none`, so input still reaches the canvas for sprites / custom cursor.
 */
export function benneRaisePhaserDomContainerAboveCanvas(game: Phaser.Game): void {
  const dom = game.domContainer;
  const canvas = game.canvas as HTMLElement | undefined;
  const parent = canvas?.parentElement ?? null;
  if (!dom || !canvas || !parent) {
    return;
  }
  if (dom.parentNode !== parent || canvas.parentNode !== parent) {
    return;
  }
  parent.appendChild(dom);
}

/** Register once on {@link Phaser.Core.Events.BOOT} (after DOM + canvas exist). */
export function wireBennePhaserDomContainerLayerOrder(game: Phaser.Game): void {
  game.events.once(Phaser.Core.Events.BOOT, () => {
    benneRaisePhaserDomContainerAboveCanvas(game);
  });
}
