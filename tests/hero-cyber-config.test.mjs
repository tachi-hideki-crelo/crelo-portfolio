import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CIRCUIT_SCAN_PERIOD_SECONDS,
  CORE_BREATH_PERIOD_SECONDS,
  getHeroCircuitReveal,
  getHeroRingPhase,
  HERO_CYBER_PALETTE,
  RING_DIRECTIONS,
  RING_PERIODS,
} from '../app/components/visual/hero-cyber-config.ts';
import { getHeroFormationTimeline } from '../app/components/site/hero-timeline.ts';

test('cyber timing helpers preserve the requested cycles and ordering', () => {
  assert.deepEqual(HERO_CYBER_PALETTE, {
    dark: '#050812',
    cyan: '#70E9FF',
    violet: '#9E72FF',
    gold: '#FFD24A',
  });
  assert.equal(CORE_BREATH_PERIOD_SECONDS, 8);
  assert.equal(CIRCUIT_SCAN_PERIOD_SECONDS, 6);

  RING_PERIODS.forEach((period, index) => {
    const phaseAtPeriod = getHeroRingPhase(period, index);
    const phaseAtThreeCycles = getHeroRingPhase(period * 3, index);
    const phaseAtHalf = getHeroRingPhase(period / 2, index);
    assert.ok(Math.abs(phaseAtPeriod) < 1e-10);
    assert.ok(Math.abs(phaseAtThreeCycles) < 1e-10);
    assert.ok(Math.abs(phaseAtHalf - RING_DIRECTIONS[index] * Math.PI) < 1e-10);
  });
});

test('cyber shell waits for a readable core before forming', () => {
  assert.equal(getHeroCircuitReveal(0), 0);
  assert.equal(getHeroCircuitReveal(0.12), 0);
  assert.ok(getHeroCircuitReveal(0.5) > 0);
  assert.equal(getHeroCircuitReveal(1), 1);
  assert.equal(getHeroCircuitReveal(2), 1);
});

test('cyber shell begins before orbital hardware in the existing formation timeline', () => {
  const preOrbit = getHeroFormationTimeline(0.3);
  const orbitVisible = getHeroFormationTimeline(0.31);
  assert.equal(preOrbit.orbitReveal, 0);
  assert.ok(preOrbit.sphereReveal > 0);
  assert.ok(getHeroCircuitReveal(preOrbit.sphereReveal) > 0);
  assert.ok(orbitVisible.orbitReveal > 0);
  assert.ok(getHeroCircuitReveal(orbitVisible.sphereReveal) > 0);
});
