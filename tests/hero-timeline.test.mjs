import assert from 'node:assert/strict';
import test from 'node:test';

import { getHeroFormationTimeline, getHeroTimeline, heroPhaseAt } from '../app/components/site/hero-timeline.ts';

test('Hero timeline keeps the five-act phase boundaries deterministic', () => {
  assert.equal(heroPhaseAt(0), 'field');
  assert.equal(heroPhaseAt(0.3), 'fde');
  assert.equal(heroPhaseAt(0.4), 'hold');
  assert.equal(heroPhaseAt(0.55), 'transfer');
  assert.equal(heroPhaseAt(0.72), 'statement');
  assert.equal(heroPhaseAt(0.9), 'cta');
  assert.equal(heroPhaseAt(1), 'dissolve');
});

test('Hero timeline matches the requested checkpoint choreography', () => {
  const initial = getHeroTimeline(0);
  const first = getHeroTimeline(0.3);
  const transfer = getHeroTimeline(0.55);
  const statement = getHeroTimeline(0.72);
  const cta = getHeroTimeline(0.9);
  const dissolve = getHeroTimeline(0.97);

  assert.equal(initial.fdeOpacity, 0);
  assert.equal(initial.statementOpacity, 0);
  assert.equal(initial.ctaOpacity, 0);
  assert.equal(initial.coordinateOpacity, 0);
  assert.equal(getHeroTimeline(0.1).coordinateOpacity, 0);
  assert.equal(getHeroTimeline(0.139).coordinateOpacity, 0);
  assert.equal(getHeroTimeline(0.14).coordinateOpacity, 0);
  assert.equal(initial.fieldOffsetX, 0);
  assert.equal(initial.tagReveal, 0);
  assert.equal(initial.order, 0);
  assert.ok(first.fdeOpacity > 0.95);
  assert.ok(first.fieldOffsetX > 0);
  assert.ok(first.tagReveal > 0.95);
  assert.equal(first.order, 0);
  assert.equal(transfer.fdeOpacity, 0);
  assert.ok(transfer.order > 0 && transfer.order < 1);
  assert.ok(transfer.fieldOffsetX < first.fieldOffsetX);
  assert.ok(statement.statementOpacity > 0.95);
  assert.ok(statement.statementFirstOpacity > 0.95);
  assert.ok(statement.statementSecondOpacity > 0.95);
  assert.equal(statement.order, 1);
  assert.ok(statement.fieldOffsetX < 0);
  assert.ok(getHeroTimeline(0.62).route > 0 && getHeroTimeline(0.62).route < 1);
  assert.equal(getHeroTimeline(0.8).route, 1);
  assert.ok(cta.ctaOpacity > 0.95);
  assert.ok(cta.ship > 0.5);
  assert.ok(cta.cameraPitch > statement.cameraPitch + 0.3);
  assert.notEqual(first.cameraYaw, statement.cameraYaw);
  assert.equal(statement.dissolve, 0);
  assert.ok(dissolve.dissolve > 0);
});

test('Hero formation starts empty, lays rows in from the horizon, then settles the light', () => {
  assert.deepEqual(getHeroFormationTimeline(0), { rowReveal: 0, fieldLight: 0 });

  const rows = getHeroFormationTimeline(0.1);
  assert.ok(rows.rowReveal > 0);
  assert.equal(rows.fieldLight, 0);

  const middle = getHeroFormationTimeline(0.5);
  assert.ok(middle.rowReveal > middle.fieldLight);
  assert.ok(middle.fieldLight > 0);

  assert.deepEqual(getHeroFormationTimeline(1), { rowReveal: 1, fieldLight: 1 });
  assert.deepEqual(getHeroFormationTimeline(2), { rowReveal: 1, fieldLight: 1 });
});
