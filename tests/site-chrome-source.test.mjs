import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/components/site/SiteChrome.tsx', import.meta.url), 'utf8');

test('menu replay delegates focus to Intro while ordinary close returns to the trigger', () => {
  assert.match(source, /const replayPendingRef = useRef\(false\)/);
  assert.match(source, /replayPendingRef\.current = open/);
  assert.match(source, /const replayingIntro = replayPendingRef\.current/);
  assert.match(source, /replayPendingRef\.current = false/);
  assert.match(source, /if \(!replayingIntro\) menuButtonRef\.current\?\.focus\(\)/);
});

test('header brand is logo-only while remaining accessible', () => {
  const brandSource = source.slice(source.indexOf('<a className="brand-mark"'), source.indexOf('</a>', source.indexOf('<a className="brand-mark"')) + 4);
  assert.match(brandSource, /aria-label="Crelo home"/);
  assert.match(brandSource, /<Image src="\/assets\/crelo-logo\.png" alt="Crelo"/);
  assert.doesNotMatch(brandSource, /<span>Crelo<\/span>/);
});
