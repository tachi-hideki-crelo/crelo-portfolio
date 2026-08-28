import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getMethodCardTimeline,
  getMethodHoverTimeline,
  getMethodStageTimeline,
  METHOD_SPREAD_END,
  METHOD_SPREAD_START,
} from '../app/components/site/fde-method-motion.ts';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const methodSource = readFileSync(new URL('../app/components/site/FdeMethod.tsx', import.meta.url), 'utf8');
const methodStyles = readFileSync(new URL('../app/components/site/fde-method.module.css', import.meta.url), 'utf8');

test('FDE method spread timeline is bounded, gradual, and deterministic', () => {
  const initial = getMethodStageTimeline(0);
  const beforeStart = getMethodStageTimeline(METHOD_SPREAD_START - 0.001);
  const middle = getMethodStageTimeline((METHOD_SPREAD_START + METHOD_SPREAD_END) / 2);
  const complete = getMethodStageTimeline(METHOD_SPREAD_END);
  const settled = getMethodStageTimeline(0.92);

  assert.equal(initial.spread, 0);
  assert.equal(beforeStart.spread, 0);
  assert.ok(middle.spread > 0 && middle.spread < 1);
  assert.equal(complete.spread, 1);
  assert.equal(settled.settle, 1);

  const samples = Array.from({ length: 101 }, (_, index) => getMethodStageTimeline(index / 100).spread);
  samples.slice(1).forEach((value, index) => assert.ok(value >= samples[index]));
});

test('FDE cards begin centrally and finish in a symmetric four-card fan', () => {
  const start = Array.from({ length: 4 }, (_, index) => getMethodCardTimeline({
    progress: 0,
    index,
    viewportWidth: 1440,
  }));
  const end = Array.from({ length: 4 }, (_, index) => getMethodCardTimeline({
    progress: 1,
    index,
    viewportWidth: 1440,
  }));

  assert.ok(Math.max(...start.map((card) => Math.abs(card.x))) < 20);
  assert.ok(end[0].x < end[1].x && end[1].x < 0);
  assert.ok(end[3].x > end[2].x && end[2].x > 0);
  assert.ok(Math.abs(end[0].x + end[3].x) < Number.EPSILON);
  assert.ok(Math.abs(end[1].x + end[2].x) < Number.EPSILON);
  assert.ok(end[0].yaw > 0 && end[3].yaw < 0);

  const clampedLow = getMethodCardTimeline({ progress: 1, index: -10, viewportWidth: 1440 });
  const clampedHigh = getMethodCardTimeline({ progress: 1, index: 99, viewportWidth: 1440 });
  assert.equal(clampedLow.x, end[0].x);
  assert.equal(clampedHigh.x, end[3].x);
});

test('FDE method hover lifts the target and softly separates siblings', () => {
  const neutral = getMethodHoverTimeline(2, null);
  const active = getMethodHoverTimeline(2, 2);
  const leftSibling = getMethodHoverTimeline(1, 2);
  const rightSibling = getMethodHoverTimeline(3, 2);

  assert.deepEqual(neutral, { pushX: 0, liftY: 0, liftZ: 0, scale: 1, opacity: 1 });
  assert.ok(active.liftY < 0);
  assert.ok(active.liftZ > 0);
  assert.ok(active.scale > 1);
  assert.ok(leftSibling.pushX < 0);
  assert.ok(rightSibling.pushX > 0);
  assert.ok(leftSibling.opacity < active.opacity);
});

test('FDE method uses a sticky desktop deck with accessible mobile and reduced-motion fallbacks', () => {
  assert.match(homeSource, /<FdeMethod \/>/);
  assert.match(methodSource, /requestAnimationFrame/);
  assert.match(methodSource, /useReducedMotion/);
  assert.match(methodSource, /tabIndex=\{0\}/);
  assert.match(methodSource, /onFocus=\{\(\) => setActiveIndex\(index\)\}/);
  assert.match(methodSource, /onPointerLeave=\{\(event\) => handlePointerLeave\(event, index\)\}/);
  assert.doesNotMatch(methodSource, /data-method-deck-stage onPointerLeave/);
  assert.match(methodStyles, /\.methodSection \{[\s\S]*min-height: 300vh/);
  assert.match(methodStyles, /\.stickyStage \{[\s\S]*position: sticky/);
  assert.match(methodStyles, /@media \(max-width: 900px\)[\s\S]*\.methodCard \{[\s\S]*transform: none !important/);
  assert.match(methodStyles, /\.methodSection\[data-reduced-motion='true'\][\s\S]*min-height: auto/);
  assert.match(methodStyles, /\.methodCard:focus-visible \.cardSurface/);
});
