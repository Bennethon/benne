import { expect, it } from 'vitest';
import { normalizeGridTracks, cumulativeOffsets, spanCellRect, buildGuiGridLayoutRuntimeMap, resolveGuiControlRootTopLeft } from '../../src/engine/gui/guiGridLayout';
import { tagsInHyphenFamily, computeAsepriteTagCandidateBases, tagBelongsToRootSet } from '../../benne-editor/src/asepriteTagFamily';
it.each([undefined, [0, 10], [NaN, 10], [2]])('invalid tracks fall back to equal division: %s', tracks => {
  expect(normalizeGridTracks(100, 2, tracks)).toEqual([50, 50]);
});
it('normalizes tracks and computes spanning cells', () => {
  expect(normalizeGridTracks(100, 2, [1, 3])).toEqual([25, 75]);
  expect(cumulativeOffsets([25, 75])).toEqual([0, 25]);
  expect(spanCellRect([0, 25], [0, 10], [25, 75], [10, 20], 0, 0, 2, 2)).toEqual({ x: 0, y: 0, w: 100, h: 30 });
  expect(spanCellRect([0], [0], [10], [10], 0, 0, 2, 1)).toBeNull();
});
it('grid placement combines GUI/grid offsets and centered control dimensions', () => {
  const grids = buildGuiGridLayoutRuntimeMap([{ type: 'grid', id: 'g', x: 10, y: 20, columns: 2, rows: 1, width: 100, height: 40 }]);
  expect(resolveGuiControlRootTopLeft(grids, 2, 3, { gridControlId: 'g', col: 1, row: 0, align: 'center' }, 10, 10, 0, 0)).toEqual({ x: 82, y: 38 });
  expect(resolveGuiControlRootTopLeft(grids, 2, 3, { gridControlId: 'missing', col: 0, row: 0 }, 10, 10, 4, 5)).toEqual({ x: 6, y: 8 });
});
it('Aseprite families require a literal hyphen boundary', () => {
  const tags = ['key', 'keyboard', 'key-open', 'key-open-fast', 'door'];
  expect(computeAsepriteTagCandidateBases(tags)).toEqual(['door', 'key', 'keyboard']);
  expect(tagsInHyphenFamily('key', tags)).toEqual(['key', 'key-open', 'key-open-fast']);
  expect(tagBelongsToRootSet('keyboard', new Set(['key']))).toBe(false);
  expect(tagBelongsToRootSet('key-open', new Set(['key']))).toBe(true);
});
