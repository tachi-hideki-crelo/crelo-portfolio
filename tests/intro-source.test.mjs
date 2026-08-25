import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/components/visual/IntroExperience.tsx', import.meta.url), 'utf8');

test('intro installs keyboard handling before the Canvas2D failure branch', () => {
  const listener = source.indexOf('overlay.addEventListener(\'keydown\', keydown)');
  const failureBranch = source.indexOf('if (!context)');
  assert.ok(listener >= 0);
  assert.ok(failureBranch >= 0);
  assert.ok(listener < failureBranch);
  assert.match(source, /overlay\.removeEventListener\('keydown', keydown\)/);
});

test('intro failure paths restore scroll and focus through the shared finish cleanup', () => {
  assert.match(source, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(source, /finishTimer = window\.setTimeout\(finish, reducedMotion \? 700 : 3100\)/);
  assert.match(source, /logo\.onerror = \(\) =>/);
  assert.match(source, /mainRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});
