import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFieldRoute,
  FIELD_SCAN_PERIOD_SECONDS,
  FIELD_TAGS,
  FIELD_TIERS,
  fieldCellSeed,
  fieldGridCoordinate,
  fieldPointHeight,
  fieldPointOrder,
  fieldScanAt,
  fieldSurfaceHeight,
  fieldTagCells,
  fieldViewFor,
  HERO_FIELD_PALETTE,
  projectFieldPoint,
} from '../app/components/visual/hero-field.ts';
import { getHeroTimeline } from '../app/components/site/hero-timeline.ts';

test('field palette reuses the site tokens instead of a separate neon palette', () => {
  assert.deepEqual(HERO_FIELD_PALETTE, {
    background: '#05080b',
    ink: '#f3f6f3',
    mint: '#a6ffdb',
    amber: '#ffc779',
  });
  assert.equal(FIELD_SCAN_PERIOD_SECONDS, 6);
});

test('field surface is deterministic and bounded', () => {
  for (let index = 0; index < 200; index += 1) {
    const x = Math.sin(index) * 1.2;
    const z = Math.cos(index * 1.7) * 1.2;
    const t = index * 0.37;
    const height = fieldSurfaceHeight(x, z, t);
    assert.equal(height, fieldSurfaceHeight(x, z, t));
    assert.ok(Math.abs(height) <= 1);
  }
});

test('ordering travels as a wave from the left edge to the right edge', () => {
  assert.equal(fieldPointOrder(0, -1), 0);
  assert.equal(fieldPointOrder(0, 1), 0);
  assert.ok(fieldPointOrder(0.4, -1) > fieldPointOrder(0.4, 1));
  assert.equal(fieldPointOrder(1, -1), 1);
  assert.equal(fieldPointOrder(1, 1), 1);
});

test('an ordered field is perfectly flat while the raw field has relief', () => {
  let relief = 0;
  for (let i = 0; i < 24; i += 1) {
    for (let j = 0; j < 12; j += 1) {
      const x = fieldGridCoordinate(i, 24);
      const z = fieldGridCoordinate(j, 12);
      relief = Math.max(relief, Math.abs(fieldPointHeight(x, z, 3, 0, 0, 0.5)));
      assert.ok(Math.abs(fieldPointHeight(x, z, 3, 1, 0, 0.5)) < 1e-9);
    }
  }
  assert.ok(relief > 0.1);
  assert.ok(fieldPointHeight(0, 0, 0, 1, 1, 0.5) < -0.3);
});

test('grid coordinates and cell seeds stay inside their ranges', () => {
  assert.equal(fieldGridCoordinate(0, 10), -1);
  assert.equal(fieldGridCoordinate(9, 10), 1);
  for (let i = 0; i < 40; i += 1) {
    const seed = fieldCellSeed(i, i * 3);
    assert.ok(seed >= 0 && seed < 1);
  }
});

test('the scan plane sweeps across the whole field once per period', () => {
  assert.ok(fieldScanAt(0) < -1.2);
  assert.ok(fieldScanAt(FIELD_SCAN_PERIOD_SECONDS * 0.999) > 1.2);
  assert.ok(Math.abs(fieldScanAt(FIELD_SCAN_PERIOD_SECONDS) - fieldScanAt(0)) < 1e-9);
});

test('projection anchors the field centre and recedes with distance', () => {
  const view = { width: 1000, height: 600, scale: 600, offsetX: 0.1, offsetY: 0.6, pitch: 0.32, yaw: 0, distance: 3.1 };
  const centre = projectFieldPoint(0, 0, 0, view);
  assert.ok(centre);
  assert.ok(Math.abs(centre.x - 600) < 1e-9);
  assert.ok(Math.abs(centre.y - 360) < 1e-9);

  const nearLeft = projectFieldPoint(-0.1, 0, -1, view);
  const nearRight = projectFieldPoint(0.1, 0, -1, view);
  const farLeft = projectFieldPoint(-0.1, 0, 1, view);
  const farRight = projectFieldPoint(0.1, 0, 1, view);
  assert.ok(nearRight.x - nearLeft.x > farRight.x - farLeft.x);
  assert.ok(farLeft.y < nearLeft.y);
  assert.equal(projectFieldPoint(0, 0, 0, { ...view, distance: -5 }), null);
});

test('tags sit inside the grid and the route visits them with orthogonal moves only', () => {
  FIELD_TAGS.forEach(([u, v]) => {
    assert.ok(u >= 0 && u <= 1);
    assert.ok(v >= 0 && v <= 1);
  });
  const columns = 72;
  const cells = fieldTagCells(columns, 40);
  assert.equal(cells.length, FIELD_TAGS.length);
  const route = buildFieldRoute(cells, columns);
  assert.equal(route[0][0], 0);
  assert.equal(route[route.length - 1][0], columns - 1);
  for (let index = 1; index < route.length; index += 1) {
    const [pi, pj] = route[index - 1];
    const [i, j] = route[index];
    assert.ok(pi === i || pj === j, `segment ${index} must be axis-aligned`);
  }
  cells.forEach(([i, j]) => assert.ok(route.some(([ri, rj]) => ri === i && rj === j)));
});

test('tiers trade density for performance and drop labels on phones', () => {
  const pointsOf = (tier) => FIELD_TIERS[tier].columns * FIELD_TIERS[tier].rows;
  assert.ok(pointsOf('pc') > pointsOf('tablet'));
  assert.ok(pointsOf('tablet') > pointsOf('mobile'));
  assert.ok(pointsOf('pc') <= 12000);
  assert.equal(FIELD_TIERS.pc.labels, true);
  assert.equal(FIELD_TIERS.mobile.labels, false);
  assert.ok(FIELD_TIERS.mobile.dpr <= 1);
});

test('view follows the timeline: right for the title, left for the statement, overhead for the CTA', () => {
  const at = (progress, tier = 'pc') => fieldViewFor(1440, 900, FIELD_TIERS[tier], getHeroTimeline(progress));
  const opening = at(0);
  const title = at(0.3);
  const statement = at(0.72);
  const cta = at(0.92);
  assert.ok(title.offsetX > opening.offsetX);
  assert.ok(statement.offsetX < opening.offsetX);
  assert.ok(cta.pitch > statement.pitch + 0.3);
  assert.ok(Math.abs(at(0.3, 'mobile').offsetX) < Math.abs(title.offsetX));
});
