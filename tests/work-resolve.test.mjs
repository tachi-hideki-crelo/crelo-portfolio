import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RESOLVE_GROW,
  getHalftoneDot,
  getLeadPath,
  getSliceWidths,
} from '../app/components/work/work-resolve.ts';

test('slice widths split the band into one open plate and equal closed slices', () => {
  const widths = getSliceWidths({ bandWidth: 1301, count: 5, gap: 1 });
  assert.equal(RESOLVE_GROW, 7);
  assert.equal(widths.open + widths.closed * 4 + 4, 1301);
  assert.ok(Math.abs(widths.open / widths.closed - RESOLVE_GROW) < 1e-9);
});

test('slice widths stay finite for degenerate bands', () => {
  assert.deepEqual(getSliceWidths({ bandWidth: 0, count: 5, gap: 1 }), { open: 0, closed: 0 });
  assert.deepEqual(getSliceWidths({ bandWidth: 600, count: 1, gap: 1 }), { open: 600, closed: 0 });
});

test('lead path drops from the active slice and turns into the info column', () => {
  const widths = getSliceWidths({ bandWidth: 1301, count: 5, gap: 1 });
  assert.equal(getLeadPath({ activeIndex: 0, widths, gap: 1, inset: 24, depth: 56 }), 'M24.5 0 V24 H0.5 V56');
  const third = getLeadPath({ activeIndex: 2, widths, gap: 1, inset: 24, depth: 56 });
  const x = 2 * (widths.closed + 1) + 24 + 0.5;
  assert.equal(third, `M${x} 0 V24 H0.5 V56`);
});

test('halftone dots stay calm: dark pixels keep a floor, highlights are compressed', () => {
  const dark = getHalftoneDot(0, 9);
  const mid = getHalftoneDot(0.5, 9);
  const light = getHalftoneDot(1, 9);
  assert.equal(dark.radius, 0.5);
  assert.ok(dark.alpha > 0.1 && dark.alpha < 0.15);
  assert.ok(mid.radius > dark.radius && mid.radius < light.radius);
  assert.ok(light.radius <= 9 * 0.36 + 1e-9);
  assert.ok(light.alpha <= 0.55);
  assert.deepEqual(getHalftoneDot(-1, 9), dark);
  assert.deepEqual(getHalftoneDot(2, 9), light);
});
