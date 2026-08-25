import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../app/not-found.tsx', import.meta.url), 'utf8');
const backdrop = readFileSync(new URL('../app/components/visual/NeuralBackdrop.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('preview metadata omits OG URLs until the strict production origin is available', () => {
  assert.match(layout, /const socialImage = publicOrigin/);
  assert.match(layout, /\.\.\.\(socialImage \? \{ images: socialImage \} : \{\}\)/);
  assert.doesNotMatch(layout, /metadataBase:\s*new URL\(['"]http:\/\/localhost:3000/);
});

test('404 route exposes a meaningful h1 without changing the visual 404 treatment', () => {
  assert.match(notFound, /<h1 className="not-found-page__title"/);
  assert.match(notFound, /FIELD NOT FOUND/);
  assert.match(notFound, /aria-hidden="true">404<\/span>/);
  assert.match(styles, /\.not-found-page__title \{/);
});

test('WebGL1-only browsers take the static fallback path', () => {
  assert.match(backdrop, /R3F_RENDER_CONTEXT = 'webgl2'/);
  assert.match(backdrop, /WebGL1-only browser stays on the deterministic 2D static fallback/);
  assert.match(backdrop, /const canUseWebgl = Boolean\(probeContext\)/);
  assert.match(backdrop, /tier === 'static' \|\| !webglAvailable/);
});
