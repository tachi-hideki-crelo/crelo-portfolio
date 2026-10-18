import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createMethodPlateArt,
  createSeededRandom,
  getMethodStepProgress,
  getMethodTimeline,
  METHOD_COMPOSITE_INDEX,
  METHOD_PLATE_SIZE,
  METHOD_STEP_COUNT,
  routePath,
} from '../app/components/site/fde-method-motion.ts';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const methodSource = readFileSync(new URL('../app/components/site/FdeMethod.tsx', import.meta.url), 'utf8');
const methodStyles = readFileSync(new URL('../app/components/site/fde-method.module.css', import.meta.url), 'utf8');

const PLATE_WIDTH = 560;

test('plate art is deterministic and stays inside the shared plate', () => {
  const first = createMethodPlateArt();
  assert.deepEqual(first, createMethodPlateArt());

  const inside = ([x, y]) => x >= 0 && x <= METHOD_PLATE_SIZE && y >= 0 && y <= METHOD_PLATE_SIZE;
  first.field.forEach(({ x, y }) => assert.ok(inside([x, y])));
  first.nodes.forEach((node) => assert.ok(inside(node)));
  first.routes.flat().forEach((point) => assert.ok(inside(point)));
  assert.equal(first.registration.length, 4);

  const random = createSeededRandom(3);
  for (let index = 0; index < 20; index += 1) {
    const value = random();
    assert.ok(value > 0 && value < 1);
  }
});

test('plate art registers: the scope, prototype and routes share one centre', () => {
  const art = createMethodPlateArt();
  const [cx, cy] = art.center;
  assert.ok(art.field.some((point) => point.inFrame));
  assert.ok(art.field.some((point) => !point.inFrame));
  art.prototype.forEach(([x, y]) => {
    assert.ok(x > art.frame.x0 && x < art.frame.x1);
    assert.ok(y > art.frame.y0 && y < art.frame.y1);
  });
  art.routes.forEach((route) => assert.deepEqual(route[0], [cx, cy]));
  // Every route is orthogonal.
  art.routes.forEach((route) => route.slice(1).forEach(([x, y], index) => {
    const [px, py] = route[index];
    assert.ok(x === px || y === py);
  }));
  // Adoption only lights field points outside the original scope.
  assert.ok(art.adopted.length > 0);
  art.adopted.forEach(([x, y]) => assert.ok(!(x > art.frame.x0 && x < art.frame.x1 && y > art.frame.y0 && y < art.frame.y1)));
  assert.equal(routePath([[0, 0], [10, 0]]), 'M0 0 L10 0');
});

test('timeline drops plates in order, then collapses and turns to plan view', () => {
  const start = getMethodTimeline(0, PLATE_WIDTH);
  assert.equal(start.active, 0);
  assert.ok(start.plates[0].opacity > 0.9);
  assert.equal(start.plates[1].opacity, 0);
  assert.equal(start.plan, 0);
  assert.equal(start.tilt.x, 58);

  for (let step = 0; step < METHOD_STEP_COUNT; step += 1) {
    const hold = getMethodTimeline(getMethodStepProgress(step), PLATE_WIDTH);
    assert.equal(hold.active, step);
    assert.equal(hold.composite, false);
    assert.ok(hold.plates.slice(0, step + 1).every((plate) => plate.arrived));
    // The active plate is lifted above where it would rest.
    const rest = (step - (METHOD_STEP_COUNT - 1) / 2) * PLATE_WIDTH * 0.156;
    assert.ok(hold.plates[step].z > rest);
  }

  const end = getMethodTimeline(1, PLATE_WIDTH);
  assert.equal(end.active, METHOD_COMPOSITE_INDEX);
  assert.equal(end.composite, true);
  assert.equal(end.collapse, 1);
  assert.equal(end.plan, 1);
  assert.equal(end.tilt.x, 0);
  assert.equal(end.pin.visible, false);
  end.plates.forEach((plate) => {
    assert.equal(plate.z, 0);
    assert.equal(plate.opacity, 1);
  });
});

test('timeline is monotonic in arrival and bounded for any input', () => {
  let previous = getMethodTimeline(0, PLATE_WIDTH);
  for (let sample = 1; sample <= 200; sample += 1) {
    const current = getMethodTimeline(sample / 200, PLATE_WIDTH);
    assert.ok(current.active >= previous.active);
    assert.ok(current.plan >= previous.plan);
    current.plates.forEach((plate, index) => assert.ok(plate.opacity >= previous.plates[index].opacity));
    previous = current;
  }
  assert.deepEqual(getMethodTimeline(-5, PLATE_WIDTH), getMethodTimeline(0, PLATE_WIDTH));
  assert.deepEqual(getMethodTimeline(9, PLATE_WIDTH), getMethodTimeline(1, PLATE_WIDTH));
  assert.equal(getMethodTimeline(0, PLATE_WIDTH, true).composite, true);
  assert.equal(getMethodStepProgress(METHOD_COMPOSITE_INDEX), 1);
  assert.equal(getMethodStepProgress(-3), getMethodStepProgress(0));
});

test('method section ships the plates with plain copy and static fallbacks', () => {
  assert.match(homeSource, /<FdeMethod \/>/);
  assert.match(methodSource, /03 \/ HOW I WORK/);
  assert.match(methodSource, /<h2 id="method-title">進め方<\/h2>/);
  assert.match(methodSource, /作って納品するだけでは、現場は変わりません。/);
  ['見極める', '確かめる', '組み上げる', '根づかせる', '一枚の仕組みに。'].forEach((text) => assert.match(methodSource, new RegExp(text)));
  assert.doesNotMatch(methodSource, /FIELD LOOP|4つのFlow/);
  assert.match(methodSource, /<ol className=\{styles\.steps\}>/);
  assert.match(methodSource, /className=\{styles\.scene\} aria-hidden="true"/);
  assert.match(methodSource, /aria-current=\{active === index \? 'step' : undefined\}/);
  assert.match(methodSource, /useReducedMotion/);
  assert.match(methodSource, /useSyncExternalStore/);
  assert.match(methodSource, /data-motion=\{live \? 'live' : 'static'\}/);
  // Sticky scroll stage only while motion is live; static stays a normal page.
  assert.match(methodStyles, /\.methodSection\[data-motion='live'\] \{\s*height: 620vh;/);
  assert.match(methodStyles, /\.methodSection\[data-motion='live'\] \.stage \{[\s\S]*position: sticky/);
  assert.match(methodStyles, /\.methodSection\[data-motion='live'\] \.step,[\s\S]*opacity: 0/);
  assert.match(methodStyles, /@media \(max-width: 760px\)/);
  assert.match(methodStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
});
