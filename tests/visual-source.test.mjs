import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const backdrop = readFileSync(new URL('../app/components/visual/NeuralBackdrop.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../app/components/visual/NeuralFieldCanvas.tsx', import.meta.url), 'utf8');

test('NeuralBackdrop passes a stable context-loss handler to the R3F canvas', () => {
  assert.match(backdrop, /const handleContextLost = useCallback\(\(\) =>/);
  assert.match(backdrop, /\}, \[\]\);/);
  assert.match(backdrop, /onContextLost=\{handleContextLost\}/);
  assert.doesNotMatch(backdrop, /onContextLost=\{\(\) => setWebglAvailable\(false\)\}/);
});

test('NeuralFieldCanvas pairs context-loss listener setup and cleanup', () => {
  assert.match(canvas, /addEventListener\('webglcontextlost', handleContextLost/);
  assert.match(canvas, /removeEventListener\('webglcontextlost', handleContextLost\)/);
});
