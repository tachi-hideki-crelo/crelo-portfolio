import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertPullfrogReviewDispatch } from '../scripts/validate-pullfrog-dispatch.mjs';

const review = {
  '~pullfrog': true,
  version: '0.1.98',
  type: 'pr-created',
  model: 'openai/gpt-luna',
  prompt: 'Review the synthetic test PR without changing code.',
  event: { trigger: 'pull_request_opened', is_pr: true, issue_number: 123 },
};

test('accepts structured PR reviews with the existing OpenAI model route', () => {
  assert.deepEqual(assertPullfrogReviewDispatch(JSON.stringify(review)), review);
  const inherited = { ...review };
  delete inherited.model;
  assert.deepEqual(assertPullfrogReviewDispatch(JSON.stringify(inherited)), inherited);
  const rereview = { ...review, type: 'pr-re-review', event: { ...review.event, trigger: 'pull_request_synchronize' } };
  assert.deepEqual(assertPullfrogReviewDispatch(JSON.stringify(rereview)), rereview);
  const ready = { ...review, event: { ...review.event, trigger: 'pull_request_ready_for_review' } };
  assert.deepEqual(assertPullfrogReviewDispatch(JSON.stringify(ready)), ready);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/validate-pullfrog-dispatch.mjs', import.meta.url))], {
    env: { PATH: process.env.PATH, PULLFROG_DISPATCH: JSON.stringify(review) }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pullfrog review dispatch: pass/);
  assert.doesNotMatch(result.stdout, /synthetic test PR/);
});

test('rejects non-review automation and missing or malformed PR context', () => {
  for (const value of [null, [], {}, { ...review, type: 'Build' }, { ...review, type: 'Fix' },
    { ...review, '~pullfrog': false }, { ...review, prompt: null }, { ...review, version: null },
    { ...review, type: 'pr-re-review' },
    { ...review, event: { ...review.event, trigger: 'issue_comment_created' } },
    { ...review, event: null }, { ...review, event: [] },
    ...[0, -1, 1.5, '123', Number.MAX_SAFE_INTEGER + 1].map((issue_number) => (
      { ...review, event: { ...review.event, issue_number } }
    )), { ...review, event: { ...review.event, is_pr: false } }]) {
    assert.throws(() => assertPullfrogReviewDispatch(JSON.stringify(value)));
  }
});

test('rejects cross-repository grants and other or malformed provider routes', () => {
  for (const patch of [{ xrepo: { mode: 'all' } }, { xrepoGrant: 'synthetic-grant' },
    ...['openrouter/openai/gpt-luna', 'anthropic/claude', 'https://example.com',
      'openai/../../other', 'openai/gpt-luna\n', 'openai/', null, {}].map((model) => ({ model }))]) {
    assert.throws(() => assertPullfrogReviewDispatch(JSON.stringify({ ...review, ...patch })));
  }
});

test('rejects invalid and oversized dispatch without echoing untrusted input', () => {
  for (const source of [undefined, '', 'review PR 123', '{"~pullfrog":', 'x'.repeat(65_537),
    JSON.stringify({ ...review, prompt: 'あ'.repeat(22_000) })]) {
    assert.throws(() => assertPullfrogReviewDispatch(source));
  }
  const script = new URL('../scripts/validate-pullfrog-dispatch.mjs', import.meta.url);
  const r = spawnSync(process.execPath, [fileURLToPath(script)], {
    env: { PATH: process.env.PATH, PULLFROG_DISPATCH: 'synthetic-private-marker' },
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private-marker/);
});
