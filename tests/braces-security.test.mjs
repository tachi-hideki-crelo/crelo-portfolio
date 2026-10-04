import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const braces = require('../vendor/braces');

test('local braces fork preserves ordinary compile and expansion', () => {
  assert.deepEqual(braces('asset/{one,two}.js'), ['asset/(one|two).js']);
  assert.deepEqual(braces('asset/{one,two}.js', { expand: true }), [
    'asset/one.js',
    'asset/two.js',
  ]);
});

test('deeply nested brace and parenthesis patterns are rejected before recursive walkers', () => {
  const bracesBomb = `${'{'.repeat(101)}x${'}'.repeat(101)}`;
  const parensBomb = `${'('.repeat(101)}x${')'.repeat(101)}`;

  for (const pattern of [bracesBomb, parensBomb]) {
    assert.throws(() => braces(pattern), /maximum nesting depth/);
    assert.throws(() => braces(pattern, { expand: true }), /maximum nesting depth/);
  }

  const advisoryReproduction = `${'{'.repeat(3500)}x${'}'.repeat(3500)}`;
  assert.throws(() => braces(advisoryReproduction), /maximum nesting depth/);
});

test('the maximum supported depth still compiles and expands', () => {
  const deepestAllowed = `${'{'.repeat(100)}x${'}'.repeat(100)}`;
  assert.equal(braces(deepestAllowed).length, 1);
  assert.equal(braces(deepestAllowed, { expand: true }).length, 1);
  assert.deepEqual(braces('{a,b}', { escapeInvalid: true }), ['(a|b)']);
});

test('direct AST callers are also bounded', () => {
  const root = { type: 'root', nodes: [] };
  let node = root;
  for (let index = 0; index < 102; index += 1) {
    const child = { type: 'paren', nodes: [] };
    node.nodes.push(child);
    child.parent = node;
    node = child;
  }
  node.nodes.push({ type: 'text', value: 'x' });

  assert.throws(() => braces.compile(root), /maximum nesting depth/);
  assert.throws(() => braces.stringify(root), /maximum nesting depth/);
  assert.throws(() => braces.expand(root), /maximum nesting depth/);
});

test('cyclic caller-supplied parent links cannot stall expansion', () => {
  const root = { type: 'root', nodes: [] };
  const cyclic = { type: 'paren', nodes: [] };
  cyclic.parent = cyclic;
  root.nodes.push(cyclic);
  assert.throws(() => braces.expand(root), /maximum nesting depth/);
});
