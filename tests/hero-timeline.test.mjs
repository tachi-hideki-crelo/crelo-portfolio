import assert from 'node:assert/strict';
import test from 'node:test';

import { getHeroTimeline, heroPhaseAt } from '../app/components/site/hero-timeline.ts';

test('Hero timeline keeps the five-act phase boundaries deterministic', () => {
  assert.equal(heroPhaseAt(0), 'sphere');
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
  assert.equal(initial.sphereX, 0);
  assert.ok(first.fdeOpacity > 0.95);
  assert.ok(first.sphereX > 0);
  assert.equal(transfer.fdeOpacity, 0);
  assert.ok(transfer.sphereX < 0);
  assert.ok(statement.statementOpacity > 0.95);
  assert.ok(statement.statementFirstOpacity > 0.95);
  assert.ok(statement.statementSecondOpacity > 0.95);
  assert.ok(cta.ctaOpacity > 0.95);
  assert.ok(cta.cameraYaw < -0.2);
  assert.ok(dissolve.dissolve > 0);
  assert.ok(dissolve.particleOpacity > cta.particleOpacity);
  assert.notEqual(initial.sphereRotationX, first.sphereRotationX);
  assert.notEqual(first.sphereRotationY, statement.sphereRotationY);
  assert.notEqual(statement.cameraYaw, cta.cameraYaw);
});
